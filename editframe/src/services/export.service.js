// src/services/export.service.js
import api from './api.service.js';

export async function queueExport(settings) {
  const response = await api.post('/export', settings);
  return response.data.data.job;
}

export async function getExportJob(jobId) {
  const response = await api.get(`/export/${jobId}`);
  return response.data.data.job;
}

export async function listExportJobs(params = {}) {
  const response = await api.get('/export', { params });
  return {
    jobs:       response.data.data,
    pagination: response.data.pagination,
  };
}

export async function cancelExportJob(jobId) {
  await api.post(`/export/${jobId}/cancel`);
}