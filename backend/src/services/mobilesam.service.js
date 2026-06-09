// ─────────────────────────────────────────────────────────────────────────────
// src/services/mobilesam.service.js
// Local object detection with MobileSAM (ONNX) via onnxruntime-node.
// encoder (once per image) → embedding → decoder (per click) → mask.
// Returns a black/white mask the frontend paints onto its editable canvas.
// ─────────────────────────────────────────────────────────────────────────────

import sharp from 'sharp';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import prisma from '../config/db.js';
import { createAppError } from '../middleware/error.middleware.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Model files live in backend/models/
const ENCODER_PATH = path.resolve(__dirname, '../../models/mobilesam.encoder.onnx');
const DECODER_PATH = path.resolve(__dirname, '../../models/mobilesam.decoder.onnx');

// SAM constants
const SAM_SIZE = 1024;
const MEAN = [123.675, 116.28, 103.53];
const STD  = [58.395, 57.12, 57.375];

// ─── Lazy-loaded sessions ─────────────────────────────────────────────────────

let ortModule       = null;
let encoderPromise  = null;
let decoderPromise  = null;

async function loadOrt() {
  if (!ortModule) {
    try {
      ortModule = await import('onnxruntime-node');
    } catch {
      throw createAppError('onnxruntime-node is not installed. Run: npm install onnxruntime-node', 500, 'ONNX_NOT_INSTALLED');
    }
  }
  return ortModule;
}

async function getEncoder() {
  if (!fs.existsSync(ENCODER_PATH)) {
    throw createAppError('MobileSAM encoder not found at backend/models/mobilesam.encoder.onnx', 500, 'ENCODER_NOT_FOUND');
  }
  const ort = await loadOrt();
  if (!encoderPromise) {
    console.log('[MobileSAM] Loading encoder…');
    encoderPromise = ort.InferenceSession.create(ENCODER_PATH, { executionProviders: ['cpu'] })
      .then((s) => { console.log('[MobileSAM] Encoder ready. inputs:', s.inputNames, 'outputs:', s.outputNames); return s; });
  }
  return encoderPromise;
}

async function getDecoder() {
  if (!fs.existsSync(DECODER_PATH)) {
    throw createAppError('MobileSAM decoder not found at backend/models/mobilesam.decoder.onnx', 500, 'DECODER_NOT_FOUND');
  }
  const ort = await loadOrt();
  if (!decoderPromise) {
    console.log('[MobileSAM] Loading decoder…');
    decoderPromise = ort.InferenceSession.create(DECODER_PATH, { executionProviders: ['cpu'] })
      .then((s) => { console.log('[MobileSAM] Decoder ready. inputs:', s.inputNames, 'outputs:', s.outputNames); return s; });
  }
  return decoderPromise;
}

// ─── Embedding cache (per asset, in memory) ──────────────────────────────────
// Avoids re-running the (slow) encoder on repeated clicks of the same image.

const embeddingCache = new Map(); // assetId -> { data, dims, origW, origH, scale }
const CACHE_MAX = 8;

function cacheSet(key, value) {
  if (embeddingCache.size >= CACHE_MAX) {
    embeddingCache.delete(embeddingCache.keys().next().value); // evict oldest
  }
  embeddingCache.set(key, value);
}

// ─── Image fetch ──────────────────────────────────────────────────────────────

async function fetchImageBuffer(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch image: HTTP ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

// ─── Encode image → embedding ─────────────────────────────────────────────────

async function encodeImage(assetId, imageBuffer) {
  if (embeddingCache.has(assetId)) {
    return embeddingCache.get(assetId);
  }

  const ort     = await loadOrt();
  const encoder = await getEncoder();

  const meta  = await sharp(imageBuffer).metadata();
  const origW = meta.width;
  const origH = meta.height;
  const scale = SAM_SIZE / Math.max(origW, origH);
  const newW  = Math.round(origW * scale);
  const newH  = Math.round(origH * scale);

  // Resize (long side → 1024) then pad to 1024×1024, HWC, raw [0,255]
  // This encoder takes [1024,1024,3] and normalizes internally.
  const { data } = await sharp(imageBuffer)
    .resize(newW, newH, { fit: 'fill' })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  // sharp raw output is already HWC interleaved RGB — just pad to 1024×1024
  const input = new Float32Array(SAM_SIZE * SAM_SIZE * 3); // zeros = black padding
  for (let y = 0; y < newH; y++) {
    for (let x = 0; x < newW; x++) {
      const si = (y * newW + x) * 3;
      const di = (y * SAM_SIZE + x) * 3;
      input[di]     = data[si];
      input[di + 1] = data[si + 1];
      input[di + 2] = data[si + 2];
    }
  }

  const encInput = new ort.Tensor('float32', input, [SAM_SIZE, SAM_SIZE, 3]); // HWC, rank-3
  const feeds    = {};
  feeds[encoder.inputNames[0]] = encInput;

  console.log('[MobileSAM] Encoding image…');
  const t0 = Date.now();
  const out = await encoder.run(feeds);
  console.log(`[MobileSAM] Encoded in ${Date.now() - t0}ms`);

  const emb = out[encoder.outputNames[0]]; // [256,64,64] or [1,256,64,64]
  // Decoder needs rank-4 [1,256,64,64] — add batch dim if missing
  const embDims = emb.dims.length === 3 ? [1, ...emb.dims] : emb.dims;
  const entry = {
    data:  emb.data,
    dims:  embDims,
    origW, origH, scale,
  };
  cacheSet(assetId, entry);
  return entry;
}

// ─── Detect object at a click point ──────────────────────────────────────────

/**
 * @param {string} assetId
 * @param {string} userId
 * @param {{x:number, y:number}} params  - normalised click (0–1)
 * @returns {Promise<{ maskDataUrl: string }>}  white = detected object
 */
export async function detectObjectAtPoint(assetId, userId, { x, y }) {
  const asset = await prisma.mediaAsset.findFirst({
    where: { id: assetId, userId, deletedAt: null },
  });
  if (!asset) throw createAppError('Asset not found', 404, 'NOT_FOUND');
  if (asset.type !== 'IMAGE') {
    throw createAppError('Object detection only supports images.', 400, 'UNSUPPORTED_TYPE');
  }

  const ort     = await loadOrt();
  const decoder = await getDecoder();

  // 1. Encode (cached)
  const imageBuffer = await fetchImageBuffer(asset.cloudinarySecureUrl);
  const emb = await encodeImage(assetId, imageBuffer);

  // 2. Click point → 1024 space (+ padding point required by SAM ONNX)
  const clickX = x * emb.origW * emb.scale;
  const clickY = y * emb.origH * emb.scale;
  const pointCoords = new Float32Array([clickX, clickY, 0, 0]);
  const pointLabels = new Float32Array([1, -1]); // 1=foreground, -1=padding

  // 3. Decoder inputs (standard SAMExporter interface)
  const embTensor  = new ort.Tensor('float32', emb.data, emb.dims);
  const feeds = {
    image_embeddings: embTensor,
    point_coords:     new ort.Tensor('float32', pointCoords, [1, 2, 2]),
    point_labels:     new ort.Tensor('float32', pointLabels, [1, 2]),
    mask_input:       new ort.Tensor('float32', new Float32Array(256 * 256), [1, 1, 256, 256]),
    has_mask_input:   new ort.Tensor('float32', new Float32Array([0]), [1]),
    orig_im_size:     new ort.Tensor('float32', new Float32Array([emb.origH, emb.origW]), [2]),
  };

  console.log('[MobileSAM] Decoding mask…');
  const t0 = Date.now();
  const out = await decoder.run(feeds);
  console.log(`[MobileSAM] Decoded in ${Date.now() - t0}ms`);

  // 4. Pick best mask by IoU
  const masks = out.masks || out[decoder.outputNames[0]];
  const [_, numMasks, mh, mw] = masks.dims;
  let best = 0;
  const iouTensor = out.iou_predictions;
  if (iouTensor && numMasks > 1) {
    const iou = iouTensor.data;
    for (let i = 1; i < numMasks; i++) if (iou[i] > iou[best]) best = i;
  }

  // 5. Threshold logits (>0) → white mask PNG
  const mdata  = masks.data;
  const offset = best * mh * mw;
  const gray   = Buffer.alloc(mw * mh);
  let whiteCount = 0;
  for (let i = 0; i < mw * mh; i++) {
    const on = mdata[offset + i] > 0;
    gray[i] = on ? 255 : 0;
    if (on) whiteCount++;
  }
  console.log(`[MobileSAM] Mask covers ${(whiteCount / (mw*mh) * 100).toFixed(1)}% of image`);

  const maskPng = await sharp(gray, { raw: { width: mw, height: mh, channels: 1 } })
    .png()
    .toBuffer();

  return { maskDataUrl: `data:image/png;base64,${maskPng.toString('base64')}` };
}