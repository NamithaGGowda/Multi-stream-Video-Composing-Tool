// ─────────────────────────────────────────────────────────────────────────────
// src/hooks/useProjects.js
// Project CRUD hook — loads projects from the API and keeps the store in sync
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import * as projectService from '../services/project.service.js';

export function useProjects(isAuthenticated) {
  const [projects, setProjects]   = useState([]);
  const [loading, setLoading]     = useState(false);
  const [pagination, setPagination] = useState(null);

  // ── Load projects ──────────────────────────────────────────────────────────
  const loadProjects = useCallback(async (params = {}) => {
    if (!isAuthenticated) return;
    setLoading(true);
    try {
      const result = await projectService.listProjects(params);
      setProjects(result.projects);
      setPagination(result.pagination);
    } catch (err) {
      toast.error('Failed to load projects');
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  // ── Create ─────────────────────────────────────────────────────────────────
  const createProject = useCallback(async (data = {}) => {
    try {
      const project = await projectService.createProject(data);
      setProjects((prev) => [project, ...prev]);
      toast.success('Project created');
      return project;
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create project');
      throw err;
    }
  }, []);

  // ── Update ─────────────────────────────────────────────────────────────────
  const updateProject = useCallback(async (projectId, data) => {
    try {
      const updated = await projectService.updateProject(projectId, data);
      setProjects((prev) => prev.map((p) => (p.id === projectId ? updated : p)));
      return updated;
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update project');
      throw err;
    }
  }, []);

  // ── Delete ─────────────────────────────────────────────────────────────────
  const deleteProject = useCallback(async (projectId) => {
    try {
      await projectService.deleteProject(projectId);
      setProjects((prev) => prev.filter((p) => p.id !== projectId));
      toast.success('Project deleted');
    } catch (err) {
      toast.error('Failed to delete project');
      throw err;
    }
  }, []);

  // ── Duplicate ──────────────────────────────────────────────────────────────
  const duplicateProject = useCallback(async (projectId) => {
    try {
      const copy = await projectService.duplicateProject(projectId);
      setProjects((prev) => [copy, ...prev]);
      toast.success('Project duplicated');
      return copy;
    } catch (err) {
      toast.error('Failed to duplicate project');
      throw err;
    }
  }, []);

  return {
    projects,
    loading,
    pagination,
    loadProjects,
    createProject,
    updateProject,
    deleteProject,
    duplicateProject,
  };
}