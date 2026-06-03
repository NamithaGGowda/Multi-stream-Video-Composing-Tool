import React, { useEffect, useCallback, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Film, Music, Type, Sparkles, Wand2, Sticker, Image, Layers,
  ChevronLeft, ChevronRight, Menu, X,
  Undo2, Redo2, Scissors, Trash2, Copy, FlipHorizontal,
  ZoomIn, ZoomOut, Play, Pause, SkipBack, SkipForward,
  Volume2, VolumeX, Maximize2, Download, Settings,
  FolderOpen, Search, Plus, Camera, Mic, Upload,
  AlignJustify, Sliders, Palette, Clock, Zap
} from 'lucide-react'

// ─── Sub-components ───────────────────────────────────────────────────────────
import TopBar from './components/Toolbar/TopBar.jsx'
import SidebarNav from './components/Sidebar/SidebarNav.jsx'
import SidePanel from './components/Sidebar/SidePanel.jsx'
import PreviewPlayer from './components/Preview/PreviewPlayer.jsx'
import Timeline from './components/Timeline/Timeline.jsx'
import ExportModal from './components/Export/ExportModal.jsx'
import MobileToolbar from './components/Toolbar/MobileToolbar.jsx'

// ─── Store ────────────────────────────────────────────────────────────────────
import { useEditorStore } from './store/editorStore.js'

// ─── Hooks ────────────────────────────────────────────────────────────────────
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts.js'
import { useMediaQuery } from './hooks/useMediaQuery.js'

// ─── Constants ───────────────────────────────────────────────────────────────
const PANEL_MIN_WIDTH = 220
const PANEL_MAX_WIDTH = 380
const TIMELINE_MIN_HEIGHT = 140
const TIMELINE_MAX_HEIGHT = 420

export default function App() {
  const {
    activePanel,
    setActivePanel,
    isPlaying,
    exportModalOpen,
    setExportModalOpen,
    timelineHeight,
    setTimelineHeight,
    panelWidth,
    setPanelWidth,
    sidePanelOpen,
    setSidePanelOpen,
  } = useEditorStore()

  const isMobile = useMediaQuery('(max-width: 768px)')
  const isTablet = useMediaQuery('(max-width: 1024px)')

  // Register keyboard shortcuts
  useKeyboardShortcuts()

  // ─── Timeline vertical resize ───────────────────────────────────────────────
  const timelineResizeRef = useRef(null)
  const isResizingTimeline = useRef(false)
  const resizeStartY = useRef(0)
  const resizeStartHeight = useRef(0)

  const handleTimelineResizeStart = useCallback((e) => {
    isResizingTimeline.current = true
    resizeStartY.current = e.clientY
    resizeStartHeight.current = timelineHeight
    document.body.style.cursor = 'row-resize'
    document.body.style.userSelect = 'none'
  }, [timelineHeight])

  useEffect(() => {
    const onMouseMove = (e) => {
      if (!isResizingTimeline.current) return
      const delta = resizeStartY.current - e.clientY
      const newHeight = Math.min(TIMELINE_MAX_HEIGHT, Math.max(TIMELINE_MIN_HEIGHT, resizeStartHeight.current + delta))
      setTimelineHeight(newHeight)
    }
    const onMouseUp = () => {
      if (!isResizingTimeline.current) return
      isResizingTimeline.current = false
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [setTimelineHeight])

  // ─── Panel horizontal resize ────────────────────────────────────────────────
  const isPanelResizing = useRef(false)
  const panelResizeStartX = useRef(0)
  const panelResizeStartWidth = useRef(0)

  const handlePanelResizeStart = useCallback((e) => {
    isPanelResizing.current = true
    panelResizeStartX.current = e.clientX
    panelResizeStartWidth.current = panelWidth
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }, [panelWidth])

  useEffect(() => {
    const onMouseMove = (e) => {
      if (!isPanelResizing.current) return
      const delta = e.clientX - panelResizeStartX.current
      const newWidth = Math.min(PANEL_MAX_WIDTH, Math.max(PANEL_MIN_WIDTH, panelResizeStartWidth.current + delta))
      setPanelWidth(newWidth)
    }
    const onMouseUp = () => {
      if (!isPanelResizing.current) return
      isPanelResizing.current = false
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [setPanelWidth])

  // ─── Mobile layout ───────────────────────────────────────────────────────────
  if (isMobile) {
    return (
      <MobileLayout
        exportModalOpen={exportModalOpen}
        setExportModalOpen={setExportModalOpen}
        activePanel={activePanel}
        setActivePanel={setActivePanel}
      />
    )
  }

  // ─── Desktop/Tablet layout ───────────────────────────────────────────────────
  return (
    <div
      className="flex flex-col w-full h-full bg-navy-900 overflow-hidden select-none"
      style={{ '--timeline-height': `${timelineHeight}px` }}
    >
      {/* ── Top Bar ── */}
      <TopBar
        onExport={() => setExportModalOpen(true)}
        isTablet={isTablet}
      />

      {/* ── Main workspace ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── Icon sidebar (always visible) ── */}
        <SidebarNav
          activePanel={activePanel}
          onPanelSelect={(id) => {
            if (activePanel === id && sidePanelOpen) {
              setSidePanelOpen(false)
            } else {
              setActivePanel(id)
              setSidePanelOpen(true)
            }
          }}
        />

        {/* ── Slide-out content panel ── */}
        <AnimatePresence initial={false}>
          {sidePanelOpen && (
            <motion.div
              key="side-panel"
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: panelWidth, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
              className="relative flex-shrink-0 overflow-hidden"
              style={{ width: panelWidth }}
            >
              <SidePanel activePanel={activePanel} />

              {/* Panel resize handle */}
              <div
                onMouseDown={handlePanelResizeStart}
                className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize
                           hover:bg-cyan-brand/40 active:bg-cyan-brand/60
                           transition-colors duration-150 z-panel"
                title="Drag to resize panel"
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Center: Preview + Timeline ── */}
        <div className="flex flex-col flex-1 min-w-0 overflow-hidden">

          {/* Preview player */}
          <div
            className="flex-1 overflow-hidden"
            style={{ minHeight: 0 }}
          >
            <PreviewPlayer />
          </div>

          {/* Timeline resize handle */}
          <div
            ref={timelineResizeRef}
            onMouseDown={handleTimelineResizeStart}
            className="h-1.5 cursor-row-resize bg-navy-950 hover:bg-cyan-brand/30
                       active:bg-cyan-brand/50 transition-colors duration-150
                       flex items-center justify-center group shrink-0"
            title="Drag to resize timeline"
          >
            <div className="w-12 h-0.5 rounded-full bg-border-default group-hover:bg-cyan-brand/50 transition-colors duration-150" />
          </div>

          {/* Timeline */}
          <div
            className="shrink-0 overflow-hidden border-t border-border-subtle"
            style={{ height: timelineHeight }}
          >
            <Timeline />
          </div>
        </div>
      </div>

      {/* ── Export Modal ── */}
      <AnimatePresence>
        {exportModalOpen && (
          <ExportModal onClose={() => setExportModalOpen(false)} />
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Mobile Layout ─────────────────────────────────────────────────────────────
function MobileLayout({ exportModalOpen, setExportModalOpen, activePanel, setActivePanel }) {
  const [mobileView, setMobileView] = useState('preview') // 'preview' | 'timeline' | 'panel'
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  return (
    <div className="flex flex-col w-full h-full bg-navy-900 overflow-hidden">

      {/* Mobile top bar */}
      <div
        className="flex items-center justify-between px-3 shrink-0 border-b border-border-subtle bg-navy-800"
        style={{ height: 48, paddingTop: 'env(safe-area-inset-top)' }}
      >
        <div className="flex items-center gap-2">
          <button
            className="btn-icon"
            onClick={() => setMobileMenuOpen(true)}
          >
            <Menu size={18} />
          </button>
          <span className="font-display font-700 text-base text-text-primary tracking-tight">
            Edit<span className="text-cyan-brand">Frame</span>
          </span>
        </div>

        <div className="flex items-center gap-1">
          <button className="btn-icon">
            <Undo2 size={16} />
          </button>
          <button className="btn-icon">
            <Redo2 size={16} />
          </button>
          <button
            className="btn-primary text-xs py-1 px-2.5"
            onClick={() => setExportModalOpen(true)}
          >
            <Download size={13} />
            Export
          </button>
        </div>
      </div>

      {/* Mobile view switcher tabs */}
      <div className="flex border-b border-border-subtle bg-navy-800 shrink-0">
        {[
          { id: 'preview', label: 'Preview' },
          { id: 'timeline', label: 'Timeline' },
          { id: 'panel', label: activePanel || 'Tools' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setMobileView(tab.id)}
            className={`flex-1 py-2 text-xs font-ui font-500 capitalize transition-colors duration-150
                       ${mobileView === tab.id
                         ? 'text-cyan-brand border-b-2 border-cyan-brand bg-cyan-brand/5'
                         : 'text-text-muted hover:text-text-secondary'
                       }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Main content area */}
      <div className="flex-1 overflow-hidden">
        {mobileView === 'preview' && <PreviewPlayer mobile />}
        {mobileView === 'timeline' && <Timeline mobile />}
        {mobileView === 'panel' && (
          <SidePanel activePanel={activePanel} mobile />
        )}
      </div>

      {/* Mobile bottom toolbar */}
      <MobileToolbar
        activePanel={activePanel}
        onPanelSelect={(id) => {
          setActivePanel(id)
          setMobileView('panel')
        }}
        onExport={() => setExportModalOpen(true)}
      />

      {/* Mobile slide-up menu */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-modal-backdrop bg-navy-950/80 backdrop-blur-sm"
            onClick={() => setMobileMenuOpen(false)}
          >
            <motion.div
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ ease: [0.4, 0, 0.2, 1], duration: 0.25 }}
              className="absolute left-0 top-0 bottom-0 w-64 bg-navy-800 border-r border-border-subtle p-4"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <span className="font-display font-700 text-xl text-text-primary">
                  Edit<span className="text-cyan-brand">Frame</span>
                </span>
                <button className="btn-icon" onClick={() => setMobileMenuOpen(false)}>
                  <X size={16} />
                </button>
              </div>
              <MobileMenuItems onClose={() => setMobileMenuOpen(false)} />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Export Modal */}
      <AnimatePresence>
        {exportModalOpen && (
          <ExportModal onClose={() => setExportModalOpen(false)} mobile />
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Mobile menu content ───────────────────────────────────────────────────────
function MobileMenuItems({ onClose }) {
  const items = [
    { icon: FolderOpen, label: 'Open Project', shortcut: 'Ctrl+O' },
    { icon: Plus, label: 'New Project', shortcut: 'Ctrl+N' },
    { icon: Upload, label: 'Import Media', shortcut: 'Ctrl+I' },
    { icon: Download, label: 'Export Video', shortcut: 'Ctrl+E' },
    { icon: Copy, label: 'Duplicate Project', shortcut: '' },
    { icon: Settings, label: 'Settings', shortcut: ',' },
  ]
  return (
    <nav className="flex flex-col gap-0.5">
      {items.map(({ icon: Icon, label, shortcut }) => (
        <button
          key={label}
          onClick={onClose}
          className="flex items-center justify-between px-3 py-2.5 rounded-md
                     text-text-secondary hover:bg-surface-hover hover:text-text-primary
                     transition-colors duration-150 group"
        >
          <span className="flex items-center gap-3">
            <Icon size={16} className="text-text-muted group-hover:text-cyan-brand transition-colors duration-150" />
            <span className="text-sm font-ui">{label}</span>
          </span>
          {shortcut && <span className="kbd">{shortcut}</span>}
        </button>
      ))}
    </nav>
  )
}