import React, { useState } from 'react'
import {
  Undo2, Redo2, Download, Settings, ChevronDown,
  Scissors, Trash2, Copy, ZoomIn, ZoomOut,
  AlignJustify, Grid, Eye, EyeOff, Layers
} from 'lucide-react'
import { useEditorStore } from '../../store/editorStore.js'

export default function TopBar({ onExport, isTablet }) {
  const {
    undo, redo, canUndo, canRedo,
    zoomIn, zoomOut, timelineZoom,
    showWaveforms, toggleWaveforms,
    showThumbnails, toggleThumbnails,
    showGrid, toggleGrid,
    snapToGrid,
    selectedClipIds, deleteSelectedClips, duplicateClip, splitClipAt, currentTime,
  } = useEditorStore()

  const [settingsOpen, setSettingsOpen] = useState(false)

  const selectedCount = selectedClipIds.length
  const zoomPct = Math.round((timelineZoom / 40) * 100)

  return (
    <header
      className="flex items-center justify-between border-b border-border-subtle bg-navy-800 shrink-0 px-2 gap-2 z-topbar"
      style={{ height: 48 }}
    >
      {/* ── Left: Logo + Project name ── */}
      <div className="flex items-center gap-3 shrink-0">
        {/* Logo */}
        <div className="flex items-center gap-1.5 pl-1">
          <div className="flex items-center justify-center w-7 h-7 rounded-md bg-gradient-to-br from-cyan-brand to-lavender-brand">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <rect x="1" y="3" width="12" height="8" rx="1.5" stroke="#0A0F1E" strokeWidth="1.5" />
              <path d="M5 5.5L9 7L5 8.5V5.5Z" fill="#0A0F1E" />
            </svg>
          </div>
          {!isTablet && (
            <span className="font-display font-800 text-base text-text-primary tracking-tight leading-none">
              Edit<span className="text-cyan-brand">Frame</span>
            </span>
          )}
        </div>

        {/* Divider */}
        <div className="w-px h-5 bg-border-subtle" />

        {/* Project name */}
        <button className="flex items-center gap-1.5 group">
          <span className="text-sm font-ui text-text-secondary group-hover:text-text-primary transition-colors duration-150">
            Untitled Project
          </span>
          <ChevronDown
            size={12}
            className="text-text-muted group-hover:text-text-secondary transition-colors duration-150"
          />
        </button>
      </div>

      {/* ── Center: Edit toolbar ── */}
      <div className="flex items-center gap-0.5 flex-1 justify-center">
        {/* Undo / Redo */}
        <div className="flex items-center gap-0.5 mr-1">
          <button
            className={`btn-icon ${!canUndo ? 'opacity-30 cursor-not-allowed' : ''}`}
            onClick={undo}
            disabled={!canUndo}
            title="Undo (Ctrl+Z)"
          >
            <Undo2 size={15} />
          </button>
          <button
            className={`btn-icon ${!canRedo ? 'opacity-30 cursor-not-allowed' : ''}`}
            onClick={redo}
            disabled={!canRedo}
            title="Redo (Ctrl+Y)"
          >
            <Redo2 size={15} />
          </button>
        </div>

        <div className="w-px h-4 bg-border-subtle mx-1" />

        {/* Clip operations — context-sensitive */}
        <button
          className={`btn-icon ${selectedCount === 0 ? 'opacity-30 cursor-not-allowed' : ''}`}
          onClick={() => selectedClipIds.forEach(id => splitClipAt(id, currentTime))}
          disabled={selectedCount === 0}
          title="Split at playhead (S)"
        >
          <Scissors size={15} />
        </button>
        <button
          className={`btn-icon ${selectedCount === 0 ? 'opacity-30 cursor-not-allowed' : ''}`}
          onClick={() => selectedClipIds.forEach(id => duplicateClip(id))}
          disabled={selectedCount === 0}
          title="Duplicate clip"
        >
          <Copy size={15} />
        </button>
        <button
          className={`btn-icon ${selectedCount === 0 ? 'opacity-30 cursor-not-allowed' : 'hover:text-red-400'}`}
          onClick={deleteSelectedClips}
          disabled={selectedCount === 0}
          title="Delete selected (Del)"
        >
          <Trash2 size={15} />
        </button>

        <div className="w-px h-4 bg-border-subtle mx-1" />

        {/* Zoom controls */}
        <button className="btn-icon" onClick={zoomOut} title="Zoom out (Ctrl+-)">
          <ZoomOut size={15} />
        </button>
        <span
          className="font-mono text-2xs text-text-muted w-10 text-center select-none"
          title="Timeline zoom level"
        >
          {zoomPct}%
        </span>
        <button className="btn-icon" onClick={zoomIn} title="Zoom in (Ctrl+=)">
          <ZoomIn size={15} />
        </button>

        <div className="w-px h-4 bg-border-subtle mx-1" />

        {/* View toggles */}
        <button
          className={`btn-icon ${showWaveforms ? 'text-cyan-brand' : ''}`}
          onClick={toggleWaveforms}
          title="Toggle waveforms"
        >
          <AlignJustify size={15} />
        </button>
        <button
          className={`btn-icon ${showThumbnails ? 'text-cyan-brand' : ''}`}
          onClick={toggleThumbnails}
          title="Toggle thumbnails"
        >
          <Layers size={15} />
        </button>
        <button
          className={`btn-icon ${showGrid ? 'text-cyan-brand' : ''}`}
          onClick={toggleGrid}
          title="Toggle snap grid"
        >
          <Grid size={15} />
        </button>
      </div>

      {/* ── Right: Export + Settings ── */}
      <div className="flex items-center gap-1.5 shrink-0">
        {/* Selection indicator */}
        {selectedCount > 0 && (
          <span className="text-2xs font-mono text-text-muted bg-surface-overlay
                           border border-border-subtle px-2 py-0.5 rounded-md">
            {selectedCount} clip{selectedCount > 1 ? 's' : ''} selected
          </span>
        )}

        <button className="btn-icon" title="Settings">
          <Settings size={15} />
        </button>

        <button
          className="btn-primary"
          onClick={onExport}
          title="Export video (Ctrl+E)"
        >
          <Download size={14} />
          {!isTablet && 'Export'}
        </button>
      </div>
    </header>
  )
}
