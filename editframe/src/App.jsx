// ─────────────────────────────────────────────────────────────────────────────
// src/App.jsx
// Root component — handles auth state, shows LoginPage or the editor
// ─────────────────────────────────────────────────────────────────────────────

import React, { useEffect, useCallback, useRef, useState } from 'react'
import { Toaster } from 'react-hot-toast'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Film, Music, Type, Sparkles, Wand2, Sticker, Image, Layers,
  ChevronLeft, ChevronRight, Menu, X,
  Undo2, Redo2, Scissors, Trash2, Copy,
  ZoomIn, ZoomOut, Download, Gauge,
  AlignJustify, Sliders, Palette, Zap, Globe, LogOut, User
} from 'lucide-react'

import TopBar         from './components/Toolbar/TopBar.jsx'
import SidebarNav     from './components/Sidebar/SidebarNav.jsx'
import SidePanel      from './components/Sidebar/SidePanel.jsx'
import PreviewPlayer  from './components/Preview/PreviewPlayer.jsx'
import Timeline       from './components/Timeline/Timeline.jsx'
import ExportModal    from './components/Export/ExportModal.jsx'
import MobileToolbar  from './components/Toolbar/MobileToolbar.jsx'
import LoginPage      from './components/Auth/LoginPage.jsx'

import { useEditorStore }        from './store/editorStore.js'
import { useKeyboardShortcuts }  from './hooks/useKeyboardShortcuts.js'
import { useMediaQuery }         from './hooks/useMediaQuery.js'
import { useWebSocketConnection } from './hooks/useWebSocket.js'
import { useAuth }               from './hooks/useAuth.js'
import { useTimeline }           from './hooks/useTimeline.js'

const PANEL_MIN_WIDTH = 220
const PANEL_MAX_WIDTH = 380
const TIMELINE_MIN_H  = 140
const TIMELINE_MAX_H  = 520

export default function App() {
  const {
    activePanel, setActivePanel,
    exportModalOpen, setExportModalOpen,
    timelineHeight, setTimelineHeight,
    panelWidth, setPanelWidth,
    sidePanelOpen, setSidePanelOpen,
  } = useEditorStore()

  const isMobile = useMediaQuery('(max-width: 768px)')
  const isTablet = useMediaQuery('(max-width: 1024px)')

  // ── Auth ───────────────────────────────────────────────────────────────────
  const { user, loading, submitting, isAuthenticated, login, register, logout } = useAuth()

  // ── WebSocket (only when authenticated) ───────────────────────────────────
  const accessToken = useEditorStore((s) => s.accessToken)
  useWebSocketConnection(accessToken)

  // ── Timeline auto-save ─────────────────────────────────────────────────────
  // TODO: set activeProjectId when user opens a project
  const activeProjectId = useEditorStore((s) => s.activeProjectId || null)
  const { saving, lastSaved, saveTimeline } = useTimeline(activeProjectId, isAuthenticated)

  // ── Keyboard shortcuts ─────────────────────────────────────────────────────
  useKeyboardShortcuts()

  // ── Panel resize ───────────────────────────────────────────────────────────
  const panelResizeRef   = useRef(false)
  const timelineResizeRef = useRef(false)

  const onPanelMouseDown = useCallback(() => { panelResizeRef.current = true }, [])

  useEffect(() => {
    const onMove = (e) => {
      if (panelResizeRef.current) {
        const newW = e.clientX - 48
        setPanelWidth(Math.min(PANEL_MAX_WIDTH, Math.max(PANEL_MIN_WIDTH, newW)))
      }
      if (timelineResizeRef.current) {
        const newH = window.innerHeight - e.clientY
        setTimelineHeight(Math.min(TIMELINE_MAX_H, Math.max(TIMELINE_MIN_H, newH)))
      }
    }
    const onUp = () => {
      panelResizeRef.current   = false
      timelineResizeRef.current = false
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [setPanelWidth, setTimelineHeight])

  // ── Loading screen ─────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A0F1E] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Film className="w-10 h-10 text-cyan-400 animate-pulse" />
          <p className="text-white/40 text-sm">Loading EditFrame…</p>
        </div>
      </div>
    )
  }

  // ── Login page ─────────────────────────────────────────────────────────────
  if (!isAuthenticated) {
    return (
      <>
        <Toaster position="top-right" toastOptions={{ style: { background: '#0D1526', color: '#E8EDF7', border: '1px solid rgba(255,255,255,0.1)' } }} />
        <LoginPage onLogin={login} onRegister={register} submitting={submitting} />
      </>
    )
  }

  // ── Editor (authenticated) ─────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-screen bg-[#0A0F1E] text-white overflow-hidden">
      <Toaster position="top-right" toastOptions={{ style: { background: '#0D1526', color: '#E8EDF7', border: '1px solid rgba(255,255,255,0.1)' } }} />

      {isMobile ? (
        <MobileLayout
          user={user}
          onLogout={logout}
          exportModalOpen={exportModalOpen}
          setExportModalOpen={setExportModalOpen}
          activePanel={activePanel}
          setActivePanel={setActivePanel}
        />
      ) : (
        <DesktopLayout
          user={user}
          onLogout={logout}
          saving={saving}
          lastSaved={lastSaved}
          onSave={() => saveTimeline('Manual save')}
          activePanel={activePanel}
          setActivePanel={setActivePanel}
          sidePanelOpen={sidePanelOpen}
          setSidePanelOpen={setSidePanelOpen}
          panelWidth={panelWidth}
          onPanelMouseDown={onPanelMouseDown}
          timelineHeight={timelineHeight}
          timelineResizeRef={timelineResizeRef}
          exportModalOpen={exportModalOpen}
          setExportModalOpen={setExportModalOpen}
          isTablet={isTablet}
        />
      )}
    </div>
  )
}

// ─── Desktop Layout ───────────────────────────────────────────────────────────

function DesktopLayout({
  user, onLogout, saving, lastSaved, onSave,
  activePanel, setActivePanel,
  sidePanelOpen, setSidePanelOpen,
  panelWidth, onPanelMouseDown,
  timelineHeight, timelineResizeRef,
  exportModalOpen, setExportModalOpen,
  isTablet,
}) {
  return (
    <>
      {/* Top bar */}
      <TopBar
        user={user}
        onLogout={onLogout}
        saving={saving}
        lastSaved={lastSaved}
        onSave={onSave}
        onExport={() => setExportModalOpen(true)}
      />

      {/* Main area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar icon strip */}
        <SidebarNav
          activePanel={activePanel}
          setActivePanel={setActivePanel}
          sidePanelOpen={sidePanelOpen}
          setSidePanelOpen={setSidePanelOpen}
        />

        {/* Side panel */}
        <AnimatePresence>
          {sidePanelOpen && !isTablet && (
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: panelWidth, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="flex-shrink-0 border-r border-white/5 bg-[#0D1526] overflow-hidden relative"
              style={{ width: panelWidth }}
            >
              <SidePanel activePanel={activePanel} />
              {/* Resize handle */}
              <div
                className="absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-cyan-500/30 transition-colors"
                onMouseDown={onPanelMouseDown}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Preview + Timeline column */}
        <div className="flex flex-col flex-1 overflow-hidden">
          {/* Preview */}
          <div className="flex-1 overflow-hidden">
            <PreviewPlayer />
          </div>

          {/* Timeline resize handle */}
          <div
            className="h-1 bg-white/5 hover:bg-cyan-500/30 cursor-row-resize transition-colors flex-shrink-0"
            onMouseDown={() => { timelineResizeRef.current = true }}
          />

          {/* Timeline */}
          <div className="flex-shrink-0 border-t border-white/5" style={{ height: timelineHeight }}>
            <Timeline />
          </div>
        </div>
      </div>

      {/* Export modal */}
      <ExportModal />
    </>
  )
}

// ─── Mobile Layout ────────────────────────────────────────────────────────────

function MobileLayout({ user, onLogout, exportModalOpen, setExportModalOpen, activePanel, setActivePanel }) {
  const [mobileTab, setMobileTab] = useState('preview')

  return (
    <div className="flex flex-col h-full">
      {/* Mobile top bar */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/5 bg-[#0D1526]">
        <div className="flex items-center gap-2">
          <Film className="w-5 h-5 text-cyan-400" />
          <span className="text-sm font-semibold text-white">EditFrame</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setExportModalOpen(true)} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-cyan-500/20 text-cyan-400 text-xs border border-cyan-500/30">
            <Download className="w-3 h-3" /> Export
          </button>
          <button onClick={onLogout} className="p-1.5 rounded-lg text-white/40 hover:text-white/60">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {mobileTab === 'preview'  && <PreviewPlayer />}
        {mobileTab === 'timeline' && <Timeline />}
        {mobileTab === 'panel'    && <div className="h-full bg-[#0D1526]"><SidePanel activePanel={activePanel} /></div>}
      </div>

      {/* Mobile bottom nav */}
      <MobileToolbar
        mobileTab={mobileTab}
        setMobileTab={setMobileTab}
        activePanel={activePanel}
        setActivePanel={setActivePanel}
      />

      <ExportModal />
    </div>
  )
}