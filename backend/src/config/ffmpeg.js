// ─────────────────────────────────────────────────────────────────────────────
// src/config/ffmpeg.js
// fluent-ffmpeg global configuration: binary paths, temp directory setup,
// and shared codec/filter presets.
// ─────────────────────────────────────────────────────────────────────────────

import ffmpeg from 'fluent-ffmpeg';
import fs from 'fs';
import path from 'path';

/**
 * Configure fluent-ffmpeg with paths from environment variables
 * and ensure the temp directory exists.
 * Called once during server bootstrap.
 */
export function configureFfmpeg() {
  // Set explicit ffmpeg binary path if provided (useful on Windows / Docker)
  if (process.env.FFMPEG_PATH) {
    ffmpeg.setFfmpegPath(process.env.FFMPEG_PATH);
  }

  // Set explicit ffprobe binary path if provided
  if (process.env.FFPROBE_PATH) {
    ffmpeg.setFfprobePath(process.env.FFPROBE_PATH);
  }

  // Ensure temp directory exists
  const tempDir = process.env.FFMPEG_TEMP_DIR || '/tmp/editframe';
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
    console.log(`[FFmpeg] Temp directory created: ${tempDir}`);
  }
}

// ─── Temp file helpers ────────────────────────────────────────────────────────

/**
 * Returns the configured temp directory path.
 * @returns {string}
 */
export function getTempDir() {
  return process.env.FFMPEG_TEMP_DIR || '/tmp/editframe';
}

/**
 * Build a unique temp file path for intermediate ffmpeg outputs.
 *
 * @param {string} suffix  - File extension including dot, e.g. '.mp4'
 * @param {string} [prefix] - Optional prefix, e.g. 'trim_'
 * @returns {string}
 */
export function tempFilePath(suffix = '.mp4', prefix = 'ef_') {
  const name = `${prefix}${Date.now()}_${Math.random().toString(36).slice(2, 8)}${suffix}`;
  return path.join(getTempDir(), name);
}

/**
 * Delete a temp file, ignoring errors (file may already be gone).
 * @param {string} filePath
 */
export function cleanTempFile(filePath) {
  try {
    if (filePath && fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (_) {
    // noop — temp cleanup is best-effort
  }
}

// ─── FFprobe helper ───────────────────────────────────────────────────────────

/**
 * Probe a media file and return its metadata.
 *
 * @param {string} filePath  - Local path or URL to the media file
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
 *
 * @param {ffmpeg.FfprobeData} metadata
 * @returns {{ duration: number, width: number|null, height: number|null, fps: number|null, hasAudio: boolean, hasVideo: boolean }}
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
 * Returns ffmpeg output options for a given quality preset + format combination.
 *
 * @param {'draft'|'medium'|'high'|'master'} quality
 * @param {'mp4'|'mov'|'webm'|'gif'}         format
 * @param {string}                            [codec]   - Override codec
 * @returns {string[]}  Array of ffmpeg output option strings
 */
export function getOutputOptions(quality = 'high', format = 'mp4', codec = null) {
  const presets = {
    draft:  { videoBitrate: '2000k',  audioBitrate: '128k', crf: 28 },
    medium: { videoBitrate: '4000k',  audioBitrate: '192k', crf: 23 },
    high:   { videoBitrate: '8000k',  audioBitrate: '256k', crf: 20 },
    master: { videoBitrate: '20000k', audioBitrate: '320k', crf: 16 },
  };

  const preset = presets[quality] || presets.high;

  if (format === 'gif') {
    return ['-loop', '0'];
  }

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

  // Default: MP4 H.264 / H.265
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
 * Returns the ffmpeg scale filter string for a given resolution identifier.
 *
 * @param {'R_480P'|'R_720P'|'R_1080P'|'R_1440P'|'R_4K'} resolution
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
 * Color grading vf filter string from timeline clip settings.
 * Maps EditFrame color parameters → ffmpeg eq + curves filters.
 *
 * @param {object} colorGrade  - { brightness, contrast, saturation, hue }
 * @returns {string}  ffmpeg -vf filter_complex fragment
 */
export function buildColorFilter(colorGrade = {}) {
  const {
    brightness = 0,   // -1 to 1
    contrast   = 1,   // 0 to 3
    saturation = 1,   // 0 to 3
    hue        = 0,   // -180 to 180
    sharpness  = 0,   // 0 to 100
  } = colorGrade;

  const filters = [];

  // eq filter: brightness (-1 to 1), contrast (0–), saturation (0–), gamma
  filters.push(`eq=brightness=${brightness}:contrast=${contrast}:saturation=${saturation}`);

  // hue shift
  if (hue !== 0) {
    const hueRad = (hue * Math.PI) / 180;
    filters.push(`hue=h=${hueRad}`);
  }

  // unsharp mask for sharpness
  if (sharpness > 0) {
    const amount = (sharpness / 100) * 3;
    filters.push(`unsharp=5:5:${amount}:5:5:0`);
  }

  return filters.join(',');
}

export default ffmpeg;