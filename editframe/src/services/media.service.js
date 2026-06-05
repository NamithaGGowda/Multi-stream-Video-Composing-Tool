// ─────────────────────────────────────────────────────────────────────────────
// src/services/media.service.js
// Media library API calls
// ─────────────────────────────────────────────────────────────────────────────

import api from './api.service.js';

export async function listMedia(params = {}) {
  const response = await api.get('/media', { params });
  return {
    assets:     response.data.data,
    pagination: response.data.pagination,
  };
}

export async function getMediaAsset(assetId) {
  const response = await api.get(`/media/${assetId}`);
  return response.data.data.asset;
}

/**
 * Upload a single media file with progress reporting.
 * @param {File}     file
 * @param {function} onProgress  - Called with 0–100
 */
export async function uploadMedia(file, onProgress) {
  const formData = new FormData();
  formData.append('file', file);

  const response = await api.post('/media/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: (e) => {
      if (onProgress && e.total) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    },
  });

  return response.data.data.asset;
}

/**
 * Upload multiple files.
 * @param {File[]}   files
 * @param {function} onProgress
 */
export async function uploadBulkMedia(files, onProgress) {
  const formData = new FormData();
  files.forEach((file) => formData.append('files', file));

  const response = await api.post('/media/upload/bulk', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: (e) => {
      if (onProgress && e.total) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    },
  });

  return response.data.data;
}

export async function deleteMedia(assetId) {
  await api.delete(`/media/${assetId}`);
}

export async function getUploadSignature() {
  const response = await api.get('/media/signature');
  return response.data.data;
}