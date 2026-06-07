// ─────────────────────────────────────────────────────────────────────────────
// src/hooks/useMedia.js
// Media library hook — upload, list, delete with quota tracking
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import * as mediaService from '../services/media.service.js';
import { useEditorStore } from '../store/editorStore.js';

export function useMedia(isAuthenticated) {
  const [assets, setAssets]           = useState([]);
  const [loading, setLoading]         = useState(false);
  const [uploading, setUploading]     = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [pagination, setPagination]   = useState(null);
  const [typeFilter, setTypeFilter]   = useState(null);

  const addMediaItem = useEditorStore((s) => s.addMediaItem);

  // ── Load assets ────────────────────────────────────────────────────────────
  const loadAssets = useCallback(async (params = {}) => {
    if (!isAuthenticated) return;
    setLoading(true);
    try {
      const result = await mediaService.listMedia({
        ...params,
        ...(typeFilter && { type: typeFilter }),
      });
      setAssets(result.assets);
      setPagination(result.pagination);
    } catch (err) {
      toast.error('Failed to load media library');
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, typeFilter]);

  useEffect(() => {
    loadAssets();
  }, [loadAssets]);

  // ── Upload single file ─────────────────────────────────────────────────────
  const uploadFile = useCallback(async (file) => {
    setUploading(true);
    setUploadProgress(0);
    const toastId = toast.loading(`Uploading ${file.name}…`);

    try {
      const asset = await mediaService.uploadMedia(file, (pct) => {
        setUploadProgress(pct);
      });

      setAssets((prev) => [asset, ...prev]);

      // Also add to the editor timeline media library
      addMediaItem({
        id:           asset.id,
        name:         asset.name,
        type:         asset.type.toLowerCase(),
        duration:     asset.duration || 5,
        thumbnail:    asset.thumbnailUrl || null,
        cloudinaryUrl: asset.cloudinarySecureUrl,
      });

      toast.success(`${file.name} uploaded`, { id: toastId });
      // Reload full list from API to stay in sync with DB
      loadAssets();
      return asset;
    } catch (err) {
      const message = err.response?.data?.message || 'Upload failed';
      toast.error(message, { id: toastId });
      throw err;
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  }, [addMediaItem, loadAssets]);

  // ── Upload multiple files ──────────────────────────────────────────────────
  const uploadFiles = useCallback(async (files) => {
    setUploading(true);
    const toastId = toast.loading(`Uploading ${files.length} files…`);

    try {
      const result = await mediaService.uploadBulkMedia(
        Array.from(files),
        (pct) => setUploadProgress(pct)
      );

      const uploaded = result.assets || result.succeeded || [];
      const failed    = result.errors  || result.failed   || [];
      setAssets((prev) => [...uploaded, ...prev]);
      toast.success(
        `Uploaded ${uploaded.length} of ${files.length} files`,
        { id: toastId }
      );

      if (failed.length > 0) {
        toast.error(`${failed.length} file(s) failed to upload`);
      }

      return result;
    } catch (err) {
      toast.error('Bulk upload failed', { id: toastId });
      throw err;
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  }, []);

  // ── Delete ─────────────────────────────────────────────────────────────────
  const deleteAsset = useCallback(async (assetId) => {
    try {
      await mediaService.deleteMedia(assetId);
      setAssets((prev) => prev.filter((a) => a.id !== assetId));
      toast.success('File deleted');
    } catch (err) {
      toast.error('Failed to delete file');
      throw err;
    }
  }, []);

  return {
    assets,
    loading,
    uploading,
    uploadProgress,
    pagination,
    typeFilter,
    setTypeFilter,
    loadAssets,
    uploadFile,
    uploadFiles,
    deleteAsset,
  };
}