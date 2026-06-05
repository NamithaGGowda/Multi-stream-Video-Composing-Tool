// src/services/timeline.service.js
import api from './api.service.js';

export async function getTimeline(projectId) {
  const response = await api.get(`/timeline/${projectId}`);
  return response.data.data.timeline;
}

export async function saveTimeline(projectId, timelineData, label = 'Auto-save') {
  const response = await api.put(`/timeline/${projectId}`, { timelineData, label });
  return response.data.data;
}

export async function getVersionHistory(projectId) {
  const response = await api.get(`/timeline/${projectId}/versions`);
  return response.data.data.versions;
}

export async function restoreVersion(projectId, versionId) {
  const response = await api.post(`/timeline/${projectId}/versions/${versionId}/restore`);
  return response.data.data;
}