// ─────────────────────────────────────────────────────────────────────────────
// src/config/ffmpeg.js
// fluent-ffmpeg configuration: binary paths, temp directory, codec presets.
// ─────────────────────────────────────────────────────────────────────────────

import ffmpeg from 'fluent-ffmpeg';
import fs from 'fs';
import path from 'path';
import os from 'os';

/**
 * Configure fluent-ffmpeg paths and ensure the temp directory exists.
 * Soft-fails on permission errors — ffmpeg features won't work but server boots.
 */
export function configureFfmpeg() {
  // Set explicit binary paths if provided
  if (process.env.FFMPEG_PATH)  ffmpeg.setFfmpegPath(process.env.FFMPEG_PATH);
  if (process.env.FFPROBE_PATH) ffmpeg.setFfprobePath(process.env.FFPROBE_PATH);

  // Build temp dir path — fall back to OS temp dir if env not set
  const tempDir = getTempDir();

  try {
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
      console.log(`[FFmpeg] Temp directory created: ${tempDir}`);
    }
  } catch (err) {
    // Try fallback to OS temp dir
    const fallback = path.join(os.tmpdir(), 'editframe');
    console.warn(
      `[FFmpeg] Could not create temp dir at ${tempDir}: ${err.message}\n` +
      `         Falling back to: ${fallback}`
    );
    try {
      if (!fs.existsSync(fallback)) {
        fs.mkdirSync(fallback, { recursive: true });
      }
      process.env.FFMPEG_TEMP_DIR = fallback;
      console.log(`[FFmpeg] Using fallback temp dir: ${fallback}`);
    } catch (err2) {
      console.warn(
        `[FFmpeg] Could not create fallback temp dir: ${err2.message}\n` +
        `         Video processing features will be unavailable.`
      );
    }
  }
}

// ─── Temp file helpers ────────────────────────────────────────────────────────

/**
 * Returns the configured temp directory path.
 * @returns {string}
 */
export function getTempDir() {
  // Use env var if set, otherwise use OS temp dir
  return process.env.FFMPEG_TEMP_DIR || path.join(os.tmpdir(), 'editframe');
}

/**
 * Build a unique temp file path for intermediate ffmpeg outputs.
 * @param {string} suffix   - File extension e.g. '.mp4'
 * @param {string} [prefix] - Optional prefix e.g. 'trim_'
 * @returns {string}
 */
export function tempFilePath(suffix = '.mp4', prefix = 'ef_') {
  const name = `${prefix}${Date.now()}_${Math.random().toString(36).slice(2, 8)}${suffix}`;
  return path.join(getTempDir(), name);
}

/**
 * Delete a temp file, ignoring errors.
 * @param {string} filePath
 */
export function cleanTempFile(filePath) {
  try {
    if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch (_) { /* noop */ }
}

// ─── FFprobe helper ───────────────────────────────────────────────────────────

/**
 * Probe a media file and return its metadata.
 * @param {string} filePath
 * @returns {Promise<ffmpeg.FfprobeData>}
 */
export function probeMedia(filePath) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) return reject(err);
      resolve(metadata);
    });
  });
}

/**
 * Extract key media properties from ffprobe metadata.
 * @param {ffmpeg.FfprobeData} metadata
 * @returns {object}
 */
export function extractMediaInfo(metadata) {
  const videoStream = metadata.streams.find((s) => s.codec_type === 'video');
  const audioStream = metadata.streams.find((s) => s.codec_type === 'audio');

  let fps = null;
  if (videoStream?.r_frame_rate) {
    const [num, den] = videoStream.r_frame_rate.split('/').map(Number);
    fps = den ? Math.round((num / den) * 100) / 100 : null;
  }

  return {
    duration:  parseFloat(metadata.format?.duration) || 0,
    width:     videoStream?.width  || null,
    height:    videoStream?.height || null,
    fps,
    hasVideo:  !!videoStream,
    hasAudio:  !!audioStream,
    bitrate:   parseInt(metadata.format?.bit_rate) || null,
    sizeBytes: parseInt(metadata.format?.size)     || null,
  };
}

// ─── Codec & quality presets ──────────────────────────────────────────────────

/**
 * Returns ffmpeg output options for a given quality preset + format.
 * @param {'draft'|'medium'|'high'|'master'} quality
 * @param {'mp4'|'mov'|'webm'|'gif'}         format
 * @param {string}                            [codec]
 * @returns {string[]}
 */
export function getOutputOptions(quality = 'high', format = 'mp4', codec = null) {
  const presets = {
    draft:  { videoBitrate: '2000k',  audioBitrate: '128k', crf: 28 },
    medium: { videoBitrate: '4000k',  audioBitrate: '192k', crf: 23 },
    high:   { videoBitrate: '8000k',  audioBitrate: '256k', crf: 20 },
    master: { videoBitrate: '20000k', audioBitrate: '320k', crf: 16 },
  };
  const preset = presets[quality] || presets.high;

  if (format === 'gif') return ['-loop', '0'];

  if (format === 'webm') {
    return [
      '-c:v', codec || 'libvpx-vp9',
      '-b:v', preset.videoBitrate,
      '-crf', String(preset.crf),
      '-c:a', 'libopus',
      '-b:a', preset.audioBitrate,
    ];
  }

  if (format === 'mov') {
    return [
      '-c:v', codec === 'ProRes 422' ? 'prores_ks' : 'libx264',
      '-profile:v', codec === 'ProRes 422' ? 'lt' : 'high',
      '-crf', String(preset.crf),
      '-b:v', preset.videoBitrate,
      '-c:a', 'aac',
      '-b:a', preset.audioBitrate,
      '-movflags', '+faststart',
    ];
  }

  const videoCodec = codec === 'H.265/HEVC' ? 'libx265' : 'libx264';
  return [
    '-c:v', videoCodec,
    '-preset', quality === 'master' ? 'slow' : quality === 'draft' ? 'ultrafast' : 'medium',
    '-crf', String(preset.crf),
    '-b:v', preset.videoBitrate,
    '-c:a', 'aac',
    '-b:a', preset.audioBitrate,
    '-movflags', '+faststart',
  ];
}

/**
 * Returns the ffmpeg scale filter string for a resolution identifier.
 * @param {string} resolution
 * @returns {string}
 */
export function getScaleFilter(resolution) {
  const map = {
    R_480P:  'scale=854:480',
    R_720P:  'scale=1280:720',
    R_1080P: 'scale=1920:1080',
    R_1440P: 'scale=2560:1440',
    R_4K:    'scale=3840:2160',
  };
  return map[resolution] || 'scale=1920:1080';
}

/**
 * Build color grading vf filter string from timeline clip settings.
 * @param {object} colorGrade
 * @returns {string}
 */
export function buildColorFilter(colorGrade = {}) {
  const {
    brightness = 0,
    contrast   = 1,
    saturation = 1,
    hue        = 0,
    sharpness  = 0,
  } = colorGrade;

  const filters = [];
  filters.push(`eq=brightness=${brightness}:contrast=${contrast}:saturation=${saturation}`);
  if (hue !== 0) {
    const hueRad = (hue * Math.PI) / 180;
    filters.push(`hue=h=${hueRad}`);
  }
  if (sharpness > 0) {
    const amount = (sharpness / 100) * 3;
    filters.push(`unsharp=5:5:${amount}:5:5:0`);
  }
  return filters.join(',');
}

export default ffmpeg;