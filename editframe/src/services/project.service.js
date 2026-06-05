// ─────────────────────────────────────────────────────────────────────────────
// src/services/project.service.js
// Project CRUD API calls
// ─────────────────────────────────────────────────────────────────────────────

import api from './api.service.js';

export async function listProjects(params = {}) {
  const response = await api.get('/projects', { params });
  return {
    projects:   response.data.data,
    pagination: response.data.pagination,
  };
}

export async function getProject(projectId) {
  const response = await api.get(`/projects/${projectId}`);
  return response.data.data.project;
}

export async function createProject(data = {}) {
  const response = await api.post('/projects', data);
  return response.data.data.project;
}

export async function updateProject(projectId, data) {
  const response = await api.patch(`/projects/${projectId}`, data);
  return response.data.data.project;
}

export async function deleteProject(projectId) {
  await api.delete(`/projects/${projectId}`);
}

export async function duplicateProject(projectId) {
  const response = await api.post(`/projects/${projectId}/duplicate`);
  return response.data.data.project;
}

export async function uploadProjectThumbnail(projectId, file) {
  const formData = new FormData();
  formData.append('thumbnail', file);
  const response = await api.post(`/projects/${projectId}/thumbnail`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data.data.project;
}