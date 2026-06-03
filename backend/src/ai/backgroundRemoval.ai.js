// ─────────────────────────────────────────────────────────────────────────────
// src/ai/backgroundRemoval.ai.js
// AI handler stub: Background removal for video and image assets.
//
// Pluggable integration point. When implementing:
//  1. Choose a provider: Remove.bg (images), Replicate (video), or a custom model
//  2. Set the API key in .env (BACKGROUND_REMOVAL_API_KEY)
//  3. Replace the TODO block with the real API call
//  4. Upload the result to Cloudinary and return the outputData shape
// ─────────────────────────────────────────────────────────────────────────────

import prisma from '../config/db.js';

/**
 * Run a background removal job.
 *
 * @param {object}   params
 * @param {string}   params.mediaAssetId    - ID of the video or image MediaAsset
 * @param {string}   params.outputFormat    - 'webm' (video with alpha) | 'png' (image)
 * @param {function} onProgress
 * @returns {Promise<object>}
 */
export async function runBackgroundRemovalJob(params, onProgress) {
  const { mediaAssetId, outputFormat = 'webm' } = params;

  onProgress(5);

  const asset = await prisma.mediaAsset.findUnique({
    where:  { id: mediaAssetId },
    select: { cloudinarySecureUrl: true, type: true, name: true },
  });

  if (!asset) throw new Error(`Media asset ${mediaAssetId} not found`);

  onProgress(10);

  // ─── TODO: Replace with your background removal API ───────────────────────
  //
  // Option A — Remove.bg (images only):
  //   import Jimp from 'jimp';
  //   const { data } = await axios.post(
  //     'https://api.remove.bg/v1.0/removebg',
  //     { image_url: asset.cloudinarySecureUrl, size: 'auto' },
  //     { headers: { 'X-Api-Key': process.env.BACKGROUND_REMOVAL_API_KEY },
  //       responseType: 'arraybuffer' }
  //   );
  //   // Upload resultant PNG to Cloudinary
  //
  // Option B — Replicate (video with alpha):
  //   import Replicate from 'replicate';
  //   const replicate = new Replicate({ auth: process.env.BACKGROUND_REMOVAL_API_KEY });
  //   const output = await replicate.run('arielreplicate/robust_video_matting:...', {
  //     input: { video: asset.cloudinarySecureUrl }
  //   });
  //   onProgress(80);
  //   // output is a URL — upload to Cloudinary
  //
  // ─────────────────────────────────────────────────────────────────────────

  await simulateDelay(4000, onProgress, 10, 90);
  onProgress(100);

  return {
    outputFormat,
    outputUrl:  null, // TODO: Set to Cloudinary URL of processed asset
    message:    `[STUB] Background removal pending. Replace runBackgroundRemovalJob() with a real API call.`,
    assetType:  asset.type,
    stubMode:   true,
  };
}

async function simulateDelay(totalMs, onProgress, startPct, endPct) {
  const steps    = 10;
  const stepMs   = totalMs / steps;
  const pctRange = endPct - startPct;
  for (let i = 1; i <= steps; i++) {
    await new Promise((r) => setTimeout(r, stepMs));
    onProgress(Math.round(startPct + (pctRange * i) / steps));
  }
}