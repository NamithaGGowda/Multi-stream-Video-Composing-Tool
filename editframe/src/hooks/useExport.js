// ─────────────────────────────────────────────────────────────────────────────
// src/hooks/useExport.js
// Export hook — queues export job and tracks real-time progress via WebSocket
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import * as exportService from '../services/export.service.js';
import { wsSubscribeToJob } from '../services/ws.service.js';
import { useEditorStore } from '../store/editorStore.js';

export function useExport(projectId) {
  const [exporting, setExporting]   = useState(false);
  const [progress, setProgress]     = useState(0);
  const [stage, setStage]           = useState('');
  const [outputUrl, setOutputUrl]   = useState(null);
  const [error, setError]           = useState(null);
  const [jobId, setJobId]           = useState(null);

  const openExportModal = useEditorStore((s) => s.setExportModalOpen);

  const startExport = useCallback(async (settings = {}) => {
    if (!projectId) {
      toast.error('No project selected');
      return;
    }

    setExporting(true);
    setProgress(0);
    setStage('Queuing export…');
    setOutputUrl(null);
    setError(null);

    try {
      const job = await exportService.queueExport({
        projectId,
        format:      settings.format      || 'MP4',
        resolution:  settings.resolution  || 'R_1080P',
        fps:         settings.fps         || 30,
        quality:     settings.quality     || 'high',
        codec:       settings.codec       || 'H.264',
        audioBitrate: settings.audioBitrate || '192k',
      });

      setJobId(job.id);

      // Subscribe to real-time progress updates via WebSocket
      wsSubscribeToJob(job.id);

      toast.success('Export started! Progress will appear in real-time.');
      return job;
    } catch (err) {
      const message = err.response?.data?.message || 'Failed to start export';
      setError(message);
      setExporting(false);
      toast.error(message);
      throw err;
    }
  }, [projectId]);

  const cancelExport = useCallback(async () => {
    if (!jobId) return;
    try {
      await exportService.cancelExportJob(jobId);
      setExporting(false);
      setProgress(0);
      setStage('');
      setJobId(null);
      toast.success('Export cancelled');
    } catch (err) {
      toast.error('Failed to cancel export');
    }
  }, [jobId]);

  // Called by useWebSocketConnection when WS events arrive
  const handleProgress = useCallback(({ progress: pct, stage: s }) => {
    setProgress(pct);
    if (s) setStage(s);
  }, []);

  const handleComplete = useCallback(({ outputUrl: url }) => {
    setProgress(100);
    setStage('Complete!');
    setOutputUrl(url);
    setExporting(false);
    toast.success('Export complete! Your video is ready.');
  }, []);

  const handleFailed = useCallback(({ error: err }) => {
    setError(err);
    setExporting(false);
    setProgress(0);
    toast.error(`Export failed: ${err}`);
  }, []);

  return {
    exporting,
    progress,
    stage,
    outputUrl,
    error,
    jobId,
    startExport,
    cancelExport,
    handleProgress,
    handleComplete,
    handleFailed,
  };
}