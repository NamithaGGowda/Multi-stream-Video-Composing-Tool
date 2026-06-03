// ─────────────────────────────────────────────────────────────────────────────
// src/ai/caption.ai.js
// AI handler stub: Auto-caption / subtitle generation.
//
// Pluggable integration point. When implementing:
//  1. Install the AI SDK (e.g. assemblyai, openai-whisper, deepgram)
//  2. Set the API key in .env (ASSEMBLYAI_API_KEY)
//  3. Replace the TODO block below with the real API call
//  4. The function must return the outputData shape defined at the bottom
// ─────────────────────────────────────────────────────────────────────────────

import prisma from '../config/db.js';

/**
 * Run an auto-caption job.
 *
 * @param {object}   params
 * @param {string}   params.mediaAssetId   - ID of the MediaAsset to transcribe
 * @param {string}   params.language       - BCP-47 language code, e.g. 'en', 'fr'
 * @param {string}   params.format         - Output format: 'srt' | 'vtt' | 'json'
 * @param {function} onProgress            - Call with 0–100
 * @returns {Promise<object>}              - outputData stored on the AIJob record
 */
export async function runCaptionJob(params, onProgress) {
  const { mediaAssetId, language = 'en', format = 'vtt' } = params;

  onProgress(5);

  // Load the media asset to get its Cloudinary URL
  const asset = await prisma.mediaAsset.findUnique({
    where:  { id: mediaAssetId },
    select: { cloudinarySecureUrl: true, name: true, duration: true },
  });

  if (!asset) throw new Error(`Media asset ${mediaAssetId} not found`);

  onProgress(10);

  // ─── TODO: Replace this block with your chosen transcription API ─────────
  //
  // Example using AssemblyAI:
  //
  //   import { AssemblyAI } from 'assemblyai';
  //   const client = new AssemblyAI({ apiKey: process.env.ASSEMBLYAI_API_KEY });
  //
  //   const transcript = await client.transcripts.transcribe({
  //     audio_url:  asset.cloudinarySecureUrl,
  //     language_code: language,
  //   });
  //
  //   onProgress(80);
  //
  //   const subtitles = await client.transcripts.subtitles(transcript.id, format);
  //   onProgress(95);
  //
  //   return {
  //     transcriptId: transcript.id,
  //     subtitleContent: subtitles,
  //     format,
  //     language,
  //     wordCount: transcript.words?.length || 0,
  //     message: `Captions generated in ${format.toUpperCase()} format`,
  //   };
  //
  // ─────────────────────────────────────────────────────────────────────────

  // STUB: Simulate processing delay and return placeholder output
  await simulateDelay(3000, onProgress, 10, 90);

  onProgress(100);

  return {
    format,
    language,
    subtitleContent: generateStubVTT(asset.name, asset.duration || 60),
    wordCount:       42,
    message:         `[STUB] Captions generated. Replace runCaptionJob() with a real transcription API call.`,
    stubMode:        true,
  };
}

// ─── Stub helpers ─────────────────────────────────────────────────────────────

function generateStubVTT(filename, durationSecs) {
  const lines = [
    'WEBVTT',
    '',
    '00:00:01.000 --> 00:00:04.000',
    `[Auto-caption stub for: ${filename}]`,
    '',
    '00:00:05.000 --> 00:00:09.000',
    'Replace this stub with a real transcription API call.',
    '',
    `00:00:10.000 --> 00:00:${String(Math.min(Math.round(durationSecs) - 1, 59)).padStart(2, '0')}.000`,
    'See src/ai/caption.ai.js for integration instructions.',
  ];
  return lines.join('\n');
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