// ─────────────────────────────────────────────────────────────────────────────
// src/utils/ffmpeg.pipeline.js
// High-level ffmpeg pipeline builder.
// Each function accepts job parameters and returns a Promise that resolves
// with a local output file path.  Callers then upload that path to Cloudinary.
// ─────────────────────────────────────────────────────────────────────────────

import ffmpeg from 'fluent-ffmpeg';
import path from 'path';
import fs from 'fs';
import { tempFilePath, cleanTempFile, buildColorFilter, getOutputOptions, getScaleFilter } from '../config/ffmpeg.js';

// ─── Progress event normaliser ────────────────────────────────────────────────

/**
 * Attach a normalised progress handler to an ffmpeg command.
 * fluent-ffmpeg's `progress` event gives percent 0–100.
 *
 * @param {ffmpeg.FfmpegCommand} cmd
 * @param {function(number):void} onProgress  - Called with 0–100
 */
function attachProgress(cmd, onProgress) {
  if (typeof onProgress !== 'function') return;
  cmd.on('progress', (p) => {
    const pct = Math.min(100, Math.max(0, Math.round(p.percent || 0)));
    onProgress(pct);
  });
}

// ─── Trim ─────────────────────────────────────────────────────────────────────

/**
 * Trim a video/audio file to a specific time range.
 *
 * @param {object} params
 * @param {string} params.inputUrl        - Cloudinary URL or local path
 * @param {number} params.startSecs       - Start time in seconds
 * @param {number} params.endSecs         - End time in seconds
 * @param {string} [params.format]        - Output format ('mp4')
 * @param {function} [params.onProgress]
 * @returns {Promise<string>}  Local output file path
 */
export function trimClip({ inputUrl, startSecs, endSecs, format = 'mp4', onProgress }) {
  const duration   = endSecs - startSecs;
  const outputPath = tempFilePath(`.${format}`, 'trim_');

  return new Promise((resolve, reject) => {
    const cmd = ffmpeg(inputUrl)
      .setStartTime(startSecs)
      .setDuration(duration)
      .outputOptions('-c', 'copy')         // stream copy — fast, no re-encode
      .output(outputPath);

    attachProgress(cmd, onProgress);

    cmd
      .on('error', (err) => reject(new Error(`Trim failed: ${err.message}`)))
      .on('end',   () => resolve(outputPath))
      .run();
  });
}

// ─── Merge ────────────────────────────────────────────────────────────────────

/**
 * Concatenate multiple video clips into one output file.
 * Uses ffmpeg concat demuxer via a temp list file.
 *
 * @param {object} params
 * @param {string[]} params.inputUrls     - Ordered array of Cloudinary URLs or local paths
 * @param {string}  [params.format]
 * @param {string}  [params.quality]
 * @param {function} [params.onProgress]
 * @returns {Promise<string>}
 */
export async function mergeClips({ inputUrls, format = 'mp4', quality = 'high', onProgress }) {
  if (!inputUrls || inputUrls.length < 2) {
    throw new Error('mergeClips requires at least 2 input URLs');
  }

  // Build concat list file
  const listPath   = tempFilePath('.txt', 'concat_');
  const outputPath = tempFilePath(`.${format}`, 'merge_');

  const listContent = inputUrls.map((u) => `file '${u}'`).join('\n');
  fs.writeFileSync(listPath, listContent, 'utf8');

  return new Promise((resolve, reject) => {
    const cmd = ffmpeg()
      .input(listPath)
      .inputOptions(['-f', 'concat', '-safe', '0'])
      .outputOptions(getOutputOptions(quality, format))
      .output(outputPath);

    attachProgress(cmd, onProgress);

    cmd
      .on('error', (err) => {
        cleanTempFile(listPath);
        reject(new Error(`Merge failed: ${err.message}`));
      })
      .on('end', () => {
        cleanTempFile(listPath);
        resolve(outputPath);
      })
      .run();
  });
}

// ─── Filter / colour grade ────────────────────────────────────────────────────

/**
 * Apply colour grading and/or a named filter preset to a clip.
 *
 * @param {object} params
 * @param {string} params.inputUrl
 * @param {object} [params.colorGrade]    - { brightness, contrast, saturation, hue, sharpness }
 * @param {string} [params.filterPreset]  - Named LUT/filter (future: apply a LUT file)
 * @param {string} [params.format]
 * @param {string} [params.quality]
 * @param {function} [params.onProgress]
 * @returns {Promise<string>}
 */
export function applyFilter({ inputUrl, colorGrade = {}, filterPreset = null, format = 'mp4', quality = 'high', onProgress }) {
  const outputPath = tempFilePath(`.${format}`, 'filter_');

  return new Promise((resolve, reject) => {
    const vfFilters = [];

    // Build eq/hue/unsharp filters from colorGrade params
    const colorFilterStr = buildColorFilter(colorGrade);
    if (colorFilterStr) vfFilters.push(colorFilterStr);

    // TODO: add LUT support here when filterPreset is a named LUT
    // if (filterPreset) vfFilters.push(`lut3d=${getLutPath(filterPreset)}`);

    const cmd = ffmpeg(inputUrl);

    if (vfFilters.length > 0) {
      cmd.videoFilter(vfFilters.join(','));
    }

    cmd
      .outputOptions(getOutputOptions(quality, format))
      .output(outputPath);

    attachProgress(cmd, onProgress);

    cmd
      .on('error', (err) => reject(new Error(`Filter failed: ${err.message}`)))
      .on('end',   () => resolve(outputPath))
      .run();
  });
}

// ─── Speed change ─────────────────────────────────────────────────────────────

/**
 * Change the playback speed of a video clip.
 * Handles both video (setpts) and audio (atempo) streams.
 * atempo only supports 0.5–2× per filter; this chains filters for extremes.
 *
 * @param {object} params
 * @param {string} params.inputUrl
 * @param {number} params.speed        - e.g. 0.5 = half speed, 2 = double speed
 * @param {boolean} [params.keepAudio] - Set false to drop audio on extreme speed
 * @param {string}  [params.format]
 * @param {string}  [params.quality]
 * @param {function} [params.onProgress]
 * @returns {Promise<string>}
 */
export function changeSpeed({ inputUrl, speed, keepAudio = true, format = 'mp4', quality = 'medium', onProgress }) {
  const outputPath = tempFilePath(`.${format}`, 'speed_');
  const ptsFactor  = 1 / speed;

  // Build atempo filter chain (each atempo must be 0.5–2.0)
  function buildAtempoChain(spd) {
    const filters = [];
    let remaining = spd;
    while (remaining > 2.0) {
      filters.push('atempo=2.0');
      remaining /= 2.0;
    }
    while (remaining < 0.5) {
      filters.push('atempo=0.5');
      remaining /= 0.5;
    }
    filters.push(`atempo=${remaining.toFixed(4)}`);
    return filters.join(',');
  }

  return new Promise((resolve, reject) => {
    const cmd = ffmpeg(inputUrl);

    const videoFilter = `setpts=${ptsFactor.toFixed(6)}*PTS`;
    const audioFilter = buildAtempoChain(speed);

    if (keepAudio) {
      cmd.complexFilter([
        { filter: 'setpts', options: `${ptsFactor.toFixed(6)}*PTS`, inputs: '[0:v]', outputs: '[v]' },
        { filter: 'atempo', options: String(Math.min(2, Math.max(0.5, speed))), inputs: '[0:a]', outputs: '[a]' },
      ], ['[v]', '[a]']);
    } else {
      cmd.videoFilter(videoFilter).noAudio();
    }

    cmd
      .outputOptions(getOutputOptions(quality, format))
      .output(outputPath);

    attachProgress(cmd, onProgress);

    cmd
      .on('error', (err) => reject(new Error(`Speed change failed: ${err.message}`)))
      .on('end',   () => resolve(outputPath))
      .run();
  });
}

// ─── Reverse ─────────────────────────────────────────────────────────────────

/**
 * Reverse a video clip (plays backwards).
 * Note: reverse filter requires loading the entire clip into memory —
 * keep clips short or use trimming before reversing.
 *
 * @param {object} params
 * @param {string} params.inputUrl
 * @param {boolean} [params.reverseAudio]
 * @param {string}  [params.format]
 * @param {string}  [params.quality]
 * @param {function} [params.onProgress]
 * @returns {Promise<string>}
 */
export function reverseClip({ inputUrl, reverseAudio = true, format = 'mp4', quality = 'medium', onProgress }) {
  const outputPath = tempFilePath(`.${format}`, 'reverse_');

  return new Promise((resolve, reject) => {
    const cmd = ffmpeg(inputUrl);

    if (reverseAudio) {
      cmd.complexFilter([
        { filter: 'reverse',  inputs: '[0:v]', outputs: '[v]' },
        { filter: 'areverse', inputs: '[0:a]', outputs: '[a]' },
      ], ['[v]', '[a]']);
    } else {
      cmd.videoFilter('reverse').noAudio();
    }

    cmd
      .outputOptions(getOutputOptions(quality, format))
      .output(outputPath);

    attachProgress(cmd, onProgress);

    cmd
      .on('error', (err) => reject(new Error(`Reverse failed: ${err.message}`)))
      .on('end',   () => resolve(outputPath))
      .run();
  });
}

// ─── Text overlay ─────────────────────────────────────────────────────────────

/**
 * Burn a text overlay onto a video using ffmpeg drawtext filter.
 *
 * @param {object} params
 * @param {string} params.inputUrl
 * @param {string} params.text
 * @param {object} [params.style]
 * @param {string} [params.style.fontFile]     - Path to a .ttf font file
 * @param {number} [params.style.fontSize]     - Default: 48
 * @param {string} [params.style.fontColor]    - Default: 'white'
 * @param {string} [params.style.bgColor]      - Background box colour (default: none)
 * @param {string} [params.style.x]            - X expression (default: '(w-text_w)/2')
 * @param {string} [params.style.y]            - Y expression (default: 'h-th-20')
 * @param {number} [params.style.startSecs]    - When text appears
 * @param {number} [params.style.endSecs]      - When text disappears
 * @param {string} [params.format]
 * @param {string} [params.quality]
 * @param {function} [params.onProgress]
 * @returns {Promise<string>}
 */
export function addTextOverlay({ inputUrl, text, style = {}, format = 'mp4', quality = 'high', onProgress }) {
  const outputPath = tempFilePath(`.${format}`, 'text_');

  const {
    fontFile   = null,
    fontSize   = 48,
    fontColor  = 'white',
    bgColor    = null,
    x          = '(w-text_w)/2',
    y          = 'h-th-20',
    startSecs  = null,
    endSecs    = null,
  } = style;

  // Escape special chars in text for ffmpeg drawtext
  const escapedText = text
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/:/g, '\\:');

  let drawtextOpts = `text='${escapedText}':fontsize=${fontSize}:fontcolor=${fontColor}:x=${x}:y=${y}`;

  if (fontFile) drawtextOpts += `:fontfile='${fontFile}'`;
  if (bgColor)  drawtextOpts += `:box=1:boxcolor=${bgColor}:boxborderw=5`;
  if (startSecs !== null && endSecs !== null) {
    drawtextOpts += `:enable='between(t,${startSecs},${endSecs})'`;
  }

  return new Promise((resolve, reject) => {
    const cmd = ffmpeg(inputUrl)
      .videoFilter(`drawtext=${drawtextOpts}`)
      .outputOptions(getOutputOptions(quality, format))
      .output(outputPath);

    attachProgress(cmd, onProgress);

    cmd
      .on('error', (err) => reject(new Error(`Text overlay failed: ${err.message}`)))
      .on('end',   () => resolve(outputPath))
      .run();
  });
}

// ─── Audio mix ────────────────────────────────────────────────────────────────

/**
 * Mix a background audio track into a video.
 *
 * @param {object} params
 * @param {string} params.videoUrl
 * @param {string} params.audioUrl
 * @param {number} [params.videoVolume]   - 0.0–1.0, default 1.0
 * @param {number} [params.audioVolume]   - 0.0–1.0, default 0.8
 * @param {number} [params.fadeInSecs]    - Audio fade-in duration
 * @param {number} [params.fadeOutSecs]   - Audio fade-out duration
 * @param {string} [params.format]
 * @param {string} [params.quality]
 * @param {function} [params.onProgress]
 * @returns {Promise<string>}
 */
export function mixAudio({
  videoUrl,
  audioUrl,
  videoVolume = 1.0,
  audioVolume = 0.8,
  fadeInSecs  = 0,
  fadeOutSecs = 0,
  format      = 'mp4',
  quality     = 'high',
  onProgress,
}) {
  const outputPath = tempFilePath(`.${format}`, 'mix_');

  return new Promise((resolve, reject) => {
    const audioFilters = [`volume=${audioVolume}`];
    if (fadeInSecs  > 0) audioFilters.push(`afade=t=in:ss=0:d=${fadeInSecs}`);
    if (fadeOutSecs > 0) audioFilters.push(`afade=t=out:st=end:d=${fadeOutSecs}`);

    const cmd = ffmpeg()
      .input(videoUrl)
      .input(audioUrl)
      .complexFilter([
        // Scale original video audio volume
        `[0:a]volume=${videoVolume}[va]`,
        // Apply filters to the background track
        `[1:a]${audioFilters.join(',')}[ba]`,
        // Mix both audio streams
        `[va][ba]amix=inputs=2:duration=first:dropout_transition=2[aout]`,
      ], ['[aout]'])
      .outputOptions([
        '-map', '0:v',
        '-map', '[aout]',
        ...getOutputOptions(quality, format),
      ])
      .output(outputPath);

    attachProgress(cmd, onProgress);

    cmd
      .on('error', (err) => reject(new Error(`Audio mix failed: ${err.message}`)))
      .on('end',   () => resolve(outputPath))
      .run();
  });
}

// ─── Full timeline export ─────────────────────────────────────────────────────

/**
 * Build and run a complete export pipeline from a timeline JSON.
 * This is the main function called by the export worker.
 *
 * Steps:
 *  1. For each track+clip: download → trim to clip bounds
 *  2. Apply per-clip effects (speed, color, text, reverse)
 *  3. Concatenate all processed clips in timeline order
 *  4. Mix final audio tracks
 *  5. Scale to target resolution
 *  6. Encode to final output format/quality
 *
 * @param {object} params
 * @param {object} params.timelineData   - Full timeline JSON from DB
 * @param {object} params.exportSettings - { format, resolution, fps, quality, codec }
 * @param {function} [params.onProgress] - Called with 0–100
 * @returns {Promise<string>}            - Local path of the final output file
 */
export async function buildExportPipeline({ timelineData, exportSettings, onProgress }) {
  const {
    format     = 'mp4',
    resolution = 'R_1080P',
    fps        = 30,
    quality    = 'high',
    codec      = 'H.264',
  } = exportSettings;

  const tempFiles = [];
  const report = (pct) => onProgress && onProgress(pct);

  report(2);

  try {
    // ── Step 1: Collect all video clips from the timeline in order ──────────
    const { tracks = [], clips = [] } = timelineData;

    // Get only video-type clips, sorted by startTime
    const videoClips = clips
      .filter((c) => !c.muted && c.type !== 'audio')
      .sort((a, b) => a.startTime - b.startTime);

    const audioClips = clips
      .filter((c) => c.type === 'audio' && !c.muted)
      .sort((a, b) => a.startTime - b.startTime);

    if (videoClips.length === 0) {
      throw new Error('Timeline has no video clips to export');
    }

    report(5);

    // ── Step 2: Process each video clip ──────────────────────────────────────
    const processedClipPaths = [];
    const perClipProgress = 60 / videoClips.length; // 5–65% of total

    for (let i = 0; i < videoClips.length; i++) {
      const clip = videoClips[i];
      let currentPath = clip.sourceUrl; // Cloudinary URL

      const clipReport = (pct) => report(5 + i * perClipProgress + (pct / 100) * perClipProgress);

      // 2a. Trim to clip in/out points
      if (clip.trimStart !== undefined || clip.trimEnd !== undefined) {
        const trimmed = await trimClip({
          inputUrl:  currentPath,
          startSecs: clip.trimStart || 0,
          endSecs:   clip.trimEnd   || clip.duration,
          format:    'mp4',
          onProgress: (p) => clipReport(p * 0.3),
        });
        tempFiles.push(trimmed);
        currentPath = trimmed;
      }

      // 2b. Speed change
      if (clip.speed && clip.speed !== 1) {
        const sped = await changeSpeed({
          inputUrl:  currentPath,
          speed:     clip.speed,
          format:    'mp4',
          onProgress: (p) => clipReport(30 + p * 0.2),
        });
        tempFiles.push(sped);
        currentPath = sped;
      }

      // 2c. Reverse
      if (clip.reversed) {
        const reversed = await reverseClip({
          inputUrl:  currentPath,
          format:    'mp4',
          onProgress: (p) => clipReport(50 + p * 0.2),
        });
        tempFiles.push(reversed);
        currentPath = reversed;
      }

      // 2d. Color grade / filter
      if (clip.colorGrade || clip.filter) {
        const filtered = await applyFilter({
          inputUrl:    currentPath,
          colorGrade:  clip.colorGrade || {},
          filterPreset: clip.filter,
          format:      'mp4',
          onProgress:  (p) => clipReport(70 + p * 0.2),
        });
        tempFiles.push(filtered);
        currentPath = filtered;
      }

      // 2e. Text overlays
      if (clip.textOverlays && clip.textOverlays.length > 0) {
        for (const textOverlay of clip.textOverlays) {
          const texted = await addTextOverlay({
            inputUrl: currentPath,
            text:     textOverlay.text,
            style:    textOverlay.style,
            format:   'mp4',
          });
          tempFiles.push(texted);
          currentPath = texted;
        }
      }

      processedClipPaths.push(currentPath);
      clipReport(100);
    }

    report(65);

    // ── Step 3: Concatenate all processed clips ───────────────────────────────
    let mergedPath;
    if (processedClipPaths.length === 1) {
      mergedPath = processedClipPaths[0];
    } else {
      mergedPath = await mergeClips({
        inputUrls:  processedClipPaths,
        format:     'mp4',
        quality:    'high',
        onProgress: (p) => report(65 + p * 0.1),
      });
      tempFiles.push(mergedPath);
    }

    report(75);

    // ── Step 4: Final encode with target resolution/fps/quality ──────────────
    const outputPath = tempFilePath(`.${format.toLowerCase()}`, 'export_');

    const scaleFilter = getScaleFilter(resolution);
    const outputOpts  = getOutputOptions(quality, format.toLowerCase(), codec);

    await new Promise((resolve, reject) => {
      const cmd = ffmpeg(mergedPath)
        .videoFilter(scaleFilter)
        .fps(fps)
        .outputOptions(outputOpts)
        .output(outputPath);

      cmd.on('progress', (p) => report(75 + Math.round((p.percent || 0) * 0.22)));
      cmd
        .on('error', (err) => reject(new Error(`Final encode failed: ${err.message}`)))
        .on('end',   resolve)
        .run();
    });

    report(97);

    // Clean up all intermediary temp files (not the final output)
    for (const f of tempFiles) {
      if (f !== outputPath) cleanTempFile(f);
    }

    report(100);
    return outputPath;

  } catch (err) {
    // Clean up everything on failure
    for (const f of tempFiles) cleanTempFile(f);
    throw err;
  }
}