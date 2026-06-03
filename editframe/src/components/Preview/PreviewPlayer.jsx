import React, { useState, useRef, useEffect, useCallback } from 'react'
import {
  Play, Pause, SkipBack, SkipForward, Volume2, VolumeX,
  Maximize2, Minimize2, RotateCcw, ChevronDown, Monitor
} from 'lucide-react'
import { useEditorStore } from '../../store/editorStore.js'

// Format seconds → HH:MM:SS:FF
function formatTimecode(seconds, fps = 30) {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  const f = Math.floor((seconds % 1) * fps)
  return [
    h.toString().padStart(2, '0'),
    m.toString().padStart(2, '0'),
    s.toString().padStart(2, '0'),
    f.toString().padStart(2, '0'),
  ].join(':')
}

const PLAYBACK_RATES = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 4]
const ASPECT_RATIOS = [
  { label: '16:9', value: 16 / 9 },
  { label: '9:16', value: 9 / 16 },
  { label: '1:1', value: 1 },
  { label: '4:3', value: 4 / 3 },
  { label: '21:9', value: 21 / 9 },
]

export default function PreviewPlayer({ mobile }) {
  const {
    isPlaying, togglePlay,
    currentTime, setCurrentTime,
    duration,
    volume, setVolume,
    muted, toggleMute,
    playbackRate, setPlaybackRate,
    seekTo,
  } = useEditorStore()

  const [isFullscreen, setIsFullscreen] = useState(false)
  const [showRateMenu, setShowRateMenu] = useState(false)
  const [showRatioMenu, setShowRatioMenu] = useState(false)
  const [aspectRatio, setAspectRatio] = useState(16 / 9)
  const [scrubbing, setScrubbing] = useState(false)
  const [hovering, setHovering] = useState(false)
  const [controlsVisible, setControlsVisible] = useState(true)

  const containerRef = useRef(null)
  const progressRef = useRef(null)
  const hideControlsTimer = useRef(null)
  const playbackInterval = useRef(null)

  // Simulate playback
  useEffect(() => {
    if (isPlaying) {
      playbackInterval.current = setInterval(() => {
        useEditorStore.setState(state => {
          const next = state.currentTime + (0.1 * state.playbackRate)
          if (next >= state.duration) {
            clearInterval(playbackInterval.current)
            return { isPlaying: false, currentTime: 0 }
          }
          return { currentTime: next }
        })
      }, 100)
    } else {
      clearInterval(playbackInterval.current)
    }
    return () => clearInterval(playbackInterval.current)
  }, [isPlaying])

  // Auto-hide controls when playing
  useEffect(() => {
    clearTimeout(hideControlsTimer.current)
    if (isPlaying && !hovering) {
      hideControlsTimer.current = setTimeout(() => setControlsVisible(false), 2500)
    } else {
      setControlsVisible(true)
    }
    return () => clearTimeout(hideControlsTimer.current)
  }, [isPlaying, hovering])

  const handleProgressClick = useCallback((e) => {
    if (!progressRef.current) return
    const rect = progressRef.current.getBoundingClientRect()
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    seekTo(pct * duration)
  }, [seekTo, duration])

  const handleVolumeChange = useCallback((e) => {
    setVolume(parseFloat(e.target.value))
  }, [setVolume])

  const progress = duration > 0 ? currentTime / duration : 0

  // Preview canvas — simulated black preview with timecode overlay
  return (
    <div
      ref={containerRef}
      className="relative flex flex-col items-center justify-center w-full h-full bg-navy-950 overflow-hidden"
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      onMouseMove={() => {
        setControlsVisible(true)
        clearTimeout(hideControlsTimer.current)
        if (isPlaying) {
          hideControlsTimer.current = setTimeout(() => setControlsVisible(false), 2500)
        }
      }}
    >
      {/* Background grid */}
      <div
        className="absolute inset-0 bg-grid-subtle opacity-20 pointer-events-none"
        style={{ backgroundSize: '20px 20px' }}
      />

      {/* Canvas area — sized by aspect ratio */}
      <div
        className="relative bg-black shadow-modal overflow-hidden"
        style={{
          maxHeight: '100%',
          maxWidth: '100%',
          aspectRatio: `${aspectRatio}`,
          ...(aspectRatio > 1
            ? { width: 'min(100%, calc((100vh - 280px) * ' + aspectRatio + '))', height: 'auto' }
            : { height: 'min(100%, calc((100vw - 340px) / ' + aspectRatio + '))', width: 'auto' }
          ),
        }}
      >
        {/* Preview placeholder — studio static */}
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-navy-800 to-navy-950">
          {/* Fake video frame visualization */}
          <div className="absolute inset-0 bg-scanline opacity-30 pointer-events-none" />

          {/* Center crosshair */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="relative">
              <div className="w-px h-8 bg-white/10 absolute left-1/2 -translate-x-1/2 -top-4" />
              <div className="h-px w-8 bg-white/10 absolute top-1/2 -translate-y-1/2 -left-4" />
              <div className="w-3 h-3 rounded-full border border-white/20" />
            </div>
          </div>

          {/* Safe zone guides */}
          <div className="absolute inset-[5%] border border-white/5 pointer-events-none rounded" />
          <div className="absolute inset-[10%] border border-white/5 pointer-events-none rounded" />

          {/* Simulated content label */}
          <div className="flex flex-col items-center gap-3 z-10 pointer-events-none">
            <div className="w-16 h-16 rounded-full flex items-center justify-center"
              style={{ background: 'rgba(45, 212, 191, 0.08)', border: '1px solid rgba(45, 212, 191, 0.2)' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <rect x="2" y="5" width="20" height="14" rx="2" stroke="rgba(45,212,191,0.4)" strokeWidth="1.5" />
                <path d="M10 9L15 12L10 15V9Z" fill="rgba(45,212,191,0.5)" />
              </svg>
            </div>
            <span className="text-text-muted text-sm font-ui">
              {isPlaying ? 'Playing preview…' : 'No media loaded — drag clips to timeline'}
            </span>
          </div>

          {/* Timecode overlay (top-left like real NLEs) */}
          <div className="absolute top-3 left-3 timecode text-xs pointer-events-none">
            {formatTimecode(currentTime)}
          </div>

          {/* Resolution badge */}
          <div className="absolute top-3 right-3 flex items-center gap-1.5 pointer-events-none">
            <span className="font-mono text-2xs text-text-muted bg-navy-950/80 px-1.5 py-0.5 rounded border border-border-subtle">
              1920×1080
            </span>
            <span className="font-mono text-2xs text-text-muted bg-navy-950/80 px-1.5 py-0.5 rounded border border-border-subtle">
              30fps
            </span>
          </div>

          {/* Playback rate badge when not 1x */}
          {playbackRate !== 1 && (
            <div className="absolute bottom-3 left-3 pointer-events-none">
              <span className="font-mono text-xs text-cyan-brand bg-navy-950/80 px-1.5 py-0.5 rounded border border-cyan-brand/30">
                {playbackRate}×
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ── Controls overlay ── */}
      <div
        className={`absolute bottom-0 left-0 right-0 transition-opacity duration-300 ${controlsVisible ? 'opacity-100' : 'opacity-0'}`}
        style={{
          background: 'linear-gradient(to top, rgba(6,11,21,0.95) 0%, rgba(6,11,21,0.4) 70%, transparent 100%)',
          paddingTop: 48,
        }}
      >
        {/* Progress bar */}
        <div
          ref={progressRef}
          className="mx-4 mb-3 relative h-1.5 rounded-full cursor-pointer group"
          style={{ background: 'rgba(27,42,74,0.8)' }}
          onClick={handleProgressClick}
        >
          {/* Buffered (fake) */}
          <div
            className="absolute inset-y-0 left-0 rounded-full"
            style={{ width: `${Math.min(100, progress * 100 + 15)}%`, background: 'rgba(45,212,191,0.2)' }}
          />
          {/* Played */}
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-cyan-brand transition-all duration-100"
            style={{ width: `${progress * 100}%` }}
          />
          {/* Scrub thumb */}
          <div
            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 rounded-full
                       bg-cyan-brand border-2 border-navy-950 shadow-glow-sm
                       opacity-0 group-hover:opacity-100 transition-opacity duration-150"
            style={{ left: `${progress * 100}%` }}
          />
        </div>

        {/* Control row */}
        <div className="flex items-center justify-between px-4 pb-3">

          {/* Left controls */}
          <div className="flex items-center gap-1">
            {/* Skip back */}
            <button
              className="btn-icon w-7 h-7"
              onClick={() => seekTo(0)}
              title="Go to start (Home)"
            >
              <SkipBack size={15} />
            </button>

            {/* Play/Pause */}
            <button
              className="flex items-center justify-center w-9 h-9 rounded-full
                         bg-cyan-brand text-navy-900 hover:bg-cyan-glow transition-colors duration-150
                         hover:shadow-glow-cyan"
              onClick={togglePlay}
              title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
            >
              {isPlaying
                ? <Pause size={16} />
                : <Play size={16} style={{ marginLeft: 1 }} />
              }
            </button>

            {/* Skip forward */}
            <button
              className="btn-icon w-7 h-7"
              onClick={() => seekTo(duration)}
              title="Go to end (End)"
            >
              <SkipForward size={15} />
            </button>

            {/* Volume */}
            <div className="flex items-center gap-1.5 ml-1">
              <button className="btn-icon w-7 h-7" onClick={toggleMute} title="Toggle mute">
                {muted || volume === 0
                  ? <VolumeX size={14} />
                  : <Volume2 size={14} />
                }
              </button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={muted ? 0 : volume}
                onChange={handleVolumeChange}
                className="w-16 ef-slider"
                style={{ '--slider-pct': `${(muted ? 0 : volume) * 100}%` }}
                title={`Volume: ${Math.round(volume * 100)}%`}
              />
            </div>

            {/* Timecode */}
            <div className="ml-2 timecode hidden sm:block">
              {formatTimecode(currentTime)} / {formatTimecode(duration)}
            </div>
          </div>

          {/* Right controls */}
          <div className="flex items-center gap-1">
            {/* Playback rate */}
            <div className="relative">
              <button
                className="btn-ghost text-xs font-mono px-2 py-1"
                onClick={() => {
                  setShowRateMenu(v => !v)
                  setShowRatioMenu(false)
                }}
                title="Playback speed"
              >
                {playbackRate}×
              </button>
              {showRateMenu && (
                <div className="absolute bottom-8 right-0 bg-navy-700 border border-border-default
                                rounded-md shadow-modal py-1 z-tooltip min-w-max">
                  {PLAYBACK_RATES.map(rate => (
                    <button
                      key={rate}
                      onClick={() => { setPlaybackRate(rate); setShowRateMenu(false) }}
                      className={`block w-full text-left px-3 py-1.5 text-xs font-mono
                                  hover:bg-surface-hover transition-colors duration-150
                                  ${playbackRate === rate ? 'text-cyan-brand' : 'text-text-secondary'}`}
                    >
                      {rate}×
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Aspect ratio */}
            <div className="relative">
              <button
                className="btn-ghost text-xs font-ui px-2 py-1 flex items-center gap-1"
                onClick={() => {
                  setShowRatioMenu(v => !v)
                  setShowRateMenu(false)
                }}
                title="Canvas aspect ratio"
              >
                <Monitor size={12} />
                <span>{ASPECT_RATIOS.find(r => Math.abs(r.value - aspectRatio) < 0.01)?.label || 'Custom'}</span>
              </button>
              {showRatioMenu && (
                <div className="absolute bottom-8 right-0 bg-navy-700 border border-border-default
                                rounded-md shadow-modal py-1 z-tooltip min-w-max">
                  {ASPECT_RATIOS.map(({ label, value }) => (
                    <button
                      key={label}
                      onClick={() => { setAspectRatio(value); setShowRatioMenu(false) }}
                      className={`block w-full text-left px-3 py-1.5 text-xs font-ui
                                  hover:bg-surface-hover transition-colors duration-150
                                  ${Math.abs(aspectRatio - value) < 0.01 ? 'text-cyan-brand' : 'text-text-secondary'}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Fullscreen */}
            <button className="btn-icon w-7 h-7" title="Fullscreen">
              <Maximize2 size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Click-to-play on preview canvas */}
      <div
        className="absolute inset-0 cursor-pointer"
        onClick={(e) => {
          // Only toggle if not clicking controls
          if (e.target === e.currentTarget) togglePlay()
        }}
        style={{ pointerEvents: controlsVisible ? 'none' : 'auto' }}
      />
    </div>
  )
}
