// ─────────────────────────────────────────────────────────────────────────────
// src/hooks/useTimeline.js
// Auto-save timeline to backend every 30 seconds or on manual save
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useRef, useCallback, useState } from 'react';
import toast from 'react-hot-toast';
import * as timelineService from '../services/timeline.service.js';
import { useEditorStore } from '../store/editorStore.js';

const AUTO_SAVE_INTERVAL = 30000; // 30 seconds

export function useTimeline(projectId, isAuthenticated) {
  const [saving, setSaving]         = useState(false);
  const [lastSaved, setLastSaved]   = useState(null);
  const [versions, setVersions]     = useState([]);
  const autoSaveTimer               = useRef(null);

  const tracks      = useEditorStore((s) => s.tracks);
  const clips       = useEditorStore((s) => s.clips);
  const transitions = useEditorStore((s) => s.transitions);

  const currentTimelineData = { tracks, clips, transitions };

  // ── Manual save ────────────────────────────────────────────────────────────
  const saveTimeline = useCallback(async (label = 'Auto-save') => {
    if (!projectId || !isAuthenticated) return;
    setSaving(true);
    try {
      await timelineService.saveTimeline(projectId, currentTimelineData, label);
      setLastSaved(new Date());
    } catch (err) {
      toast.error('Failed to save timeline');
    } finally {
      setSaving(false);
    }
  }, [projectId, isAuthenticated, tracks, clips, transitions]);

  // ── Auto-save every 30s ────────────────────────────────────────────────────
  useEffect(() => {
    if (!projectId || !isAuthenticated) return;

    autoSaveTimer.current = setInterval(() => {
      saveTimeline('Auto-save');
    }, AUTO_SAVE_INTERVAL);

    return () => clearInterval(autoSaveTimer.current);
  }, [saveTimeline, projectId, isAuthenticated]);

  // ── Load version history ───────────────────────────────────────────────────
  const loadVersions = useCallback(async () => {
    if (!projectId || !isAuthenticated) return;
    try {
      const v = await timelineService.getVersionHistory(projectId);
      setVersions(v);
    } catch (_) {}
  }, [projectId, isAuthenticated]);

  // ── Restore version ────────────────────────────────────────────────────────
  const restoreVersion = useCallback(async (versionId) => {
    if (!projectId) return;
    try {
      const result = await timelineService.restoreVersion(projectId, versionId);
      toast.success('Timeline restored');
      return result;
    } catch (err) {
      toast.error('Failed to restore version');
      throw err;
    }
  }, [projectId]);

  return {
    saving,
    lastSaved,
    versions,
    saveTimeline,
    loadVersions,
    restoreVersion,
  };
}