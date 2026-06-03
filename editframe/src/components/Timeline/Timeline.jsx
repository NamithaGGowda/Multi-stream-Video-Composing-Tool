import React, { useRef, useCallback, useEffect, useState } from 'react'
import {
  Volume2, VolumeX, Lock, Unlock, Eye, EyeOff,
  Plus, MoreHorizontal, ChevronDown, ChevronRight,
  Layers, Music, Type, Film, Image
} from 'lucide-react'
import { useEditorStore } from '../../store/editorStore.js'

const TRACK_HEADER_WIDTH = 80 // px
const RULER_HEIGHT = 24 // px
const SCROLL_PADDING = 16

// ─── Ruler tick generator ─────────────────────────────────────────────────────
function generateRulerTicks(duration, zoom, scrollX, containerWidth) {
  const totalPx = duration * zoom
  const ticks = []

  // Determine tick interval based on zoom
  let majorInterval, minorInterval
  if (zoom >= 100) { majorInterval = 1; minorInterval = 0.25 }
  else if (zoom >= 50) { majorInterval = 2; minorInterval = 0.5 }
  else if (zoom >= 25) { majorInterval = 5; minorInterval = 1 }
  else if (zoom >= 10) { majorInterval = 10; minorInterval = 2 }
  else { majorInterval = 30; minorInterval = 5 }

  const startSec = Math.max(0, scrollX / zoom - 1)
  const endSec = Math.min(duration, (scrollX + containerWidth) / zoom + 1)

  // Minor ticks
  let t = Math.floor(startSec / minorInterval) * minorInterval
  while (t <= endSec) {
    const px = t * zoom - scrollX
    const isMajor = Math.abs(t % majorInterval) < 0.001
    if (px >= -10 && px <= containerWidth + 10) {
      ticks.push({ t, px, isMajor })
    }
    t = Math.round((t + minorInterval) * 1000) / 1000
  }
  return ticks
}

function formatRulerTime(seconds) {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  if (m === 0) return `${s}s`
  return `${m}:${s.toString().padStart(2, '0')}`
}

// ─── Track type config ─────────────────────────────────────────────────────────
const TRACK_TYPE_CONFIG = {
  video: { icon: Film, color: '#2563EB', bgColor: 'rgba(37,99,235,0.12)', label: 'Video' },
  audio: { icon: Music, color: '#059669', bgColor: 'rgba(5,150,105,0.12)', label: 'Audio' },
  text: { icon: Type, color: '#D97706', bgColor: 'rgba(217,119,6,0.12)', label: 'Text' },
  image: { icon: Image, color: '#7C3AED', bgColor: 'rgba(124,58,237,0.12)', label: 'Overlay' },
}

// ─── Single clip block ─────────────────────────────────────────────────────────
function ClipBlock({ clip, zoom, trackHeight, scrollX, selected, onClick, onDragStart, showWaveforms, showThumbnails }) {
  const x = clip.startTime * zoom - scrollX
  const width = Math.max(2, clip.duration * zoom)
  const typeConfig = TRACK_TYPE_CONFIG[clip.type] || TRACK_TYPE_CONFIG.video

  if (x + width < -20 || x > 4000) return null // clip off-screen, skip render

  return (
    <div
      className={`timeline-clip ${selected ? 'selected' : ''}`}
      style={{
        left: x,
        width,
        top: 4,
        bottom: 4,
        background: `linear-gradient(180deg, ${typeConfig.color}28 0%, ${typeConfig.color}18 100%)`,
        borderColor: selected ? typeConfig.color : `${typeConfig.color}50`,
        borderWidth: selected ? 2 : 1,
      }}
      onClick={(e) => onClick(e, clip.id)}
      onMouseDown={(e) => onDragStart(e, clip)}
      title={`${clip.name} — ${clip.duration.toFixed(1)}s`}
    >
      {/* Clip header stripe */}
      <div
        className="h-1.5 w-full shrink-0"
        style={{ background: typeConfig.color, opacity: 0.7 }}
      />

      {/* Content area */}
      <div className="flex items-center px-1.5 py-0.5 gap-1 overflow-hidden h-full">
        {/* Waveform for audio clips */}
        {showWaveforms && clip.type === 'audio' && width > 30 && (
          <div className="absolute inset-x-0 bottom-1 top-3 flex items-center overflow-hidden opacity-50 px-1">
            <AudioWaveform width={width - 8} />
          </div>
        )}

        {/* Clip label */}
        {width > 40 && (
          <span
            className="text-2xs font-ui truncate relative z-10 select-none leading-none"
            style={{ color: typeConfig.color, filter: 'brightness(1.8)', fontSize: '0.6rem' }}
          >
            {clip.name}
          </span>
        )}
      </div>

      {/* Speed indicator */}
      {clip.speed !== 1 && (
        <div
          className="absolute top-2 right-1 text-2xs font-mono leading-none rounded px-0.5"
          style={{ color: '#E8EDF7', background: 'rgba(0,0,0,0.5)', fontSize: '0.55rem' }}
        >
          {clip.speed}×
        </div>
      )}

      {/* Trim handles (left) */}
      <div
        className="absolute left-0 top-0 bottom-0 w-1 cursor-ew-resize
                   hover:bg-white/20 transition-colors duration-100"
        onMouseDown={(e) => { e.stopPropagation(); /* trim start logic */ }}
      />
      {/* Trim handle (right) */}
      <div
        className="absolute right-0 top-0 bottom-0 w-1 cursor-ew-resize
                   hover:bg-white/20 transition-colors duration-100"
        onMouseDown={(e) => { e.stopPropagation(); /* trim end logic */ }}
      />
    </div>
  )
}

// ─── Fake waveform visualization ───────────────────────────────────────────────
function AudioWaveform({ width }) {
  const bars = Math.floor(width / 3)
  return (
    <div className="flex items-center gap-px h-full w-full">
      {Array.from({ length: Math.min(bars, 200) }).map((_, i) => {
        const h = 20 + Math.sin(i * 0.7) * 15 + Math.sin(i * 2.3) * 8 + Math.random() * 0
        return (
          <div
            key={i}
            className="waveform-bar"
            style={{ height: `${h}%`, opacity: 0.7 }}
          />
        )
      })}
    </div>
  )
}

// ─── Track row ─────────────────────────────────────────────────────────────────
function TrackRow({
  track, clips, zoom, scrollX, selectedClipIds,
  onClipClick, onClipDragStart, showWaveforms, showThumbnails,
  onToggleMute, onToggleLock, onToggleSolo
}) {
  const config = TRACK_TYPE_CONFIG[track.type] || TRACK_TYPE_CONFIG.video
  const Icon = config.icon

  return (
    <div
      className="track-row group"
      style={{ height: track.height, minHeight: track.height }}
    >
      {/* Track header */}
      <div
        className="track-label flex-col justify-center gap-0.5 py-1 relative"
        style={{ width: TRACK_HEADER_WIDTH, background: 'rgba(10,15,30,0.6)' }}
      >
        <div className="flex items-center gap-1 w-full">
          <Icon size={9} style={{ color: config.color, flexShrink: 0 }} />
          <span className="text-2xs font-mono truncate" style={{ color: config.color, fontSize: '0.55rem' }}>
            {track.label}
          </span>
        </div>

        {/* Track controls */}
        <div className="flex items-center gap-0.5">
          <button
            className={`btn-icon-sm w-4 h-4 ${track.muted ? 'text-red-400' : 'text-text-disabled'}`}
            onClick={() => onToggleMute(track.id)}
            title={track.muted ? 'Unmute' : 'Mute'}
          >
            {track.muted ? <VolumeX size={8} /> : <Volume2 size={8} />}
          </button>
          <button
            className={`btn-icon-sm w-4 h-4 ${track.locked ? 'text-yellow-500' : 'text-text-disabled'}`}
            onClick={() => onToggleLock(track.id)}
            title={track.locked ? 'Unlock' : 'Lock'}
          >
            {track.locked ? <Lock size={8} /> : <Unlock size={8} />}
          </button>
          {track.type === 'audio' && (
            <button
              className={`btn-icon-sm w-4 h-4 ${track.solo ? 'text-cyan-brand' : 'text-text-disabled'}`}
              onClick={() => onToggleSolo(track.id)}
              title={track.solo ? 'Unsolo' : 'Solo'}
            >
              <span style={{ fontSize: '0.5rem', fontFamily: 'monospace', fontWeight: 700 }}>S</span>
            </button>
          )}
        </div>

        {/* Muted overlay stripe */}
        {track.muted && (
          <div className="absolute inset-0 bg-red-900/10 pointer-events-none" />
        )}
      </div>

      {/* Clip area */}
      <div
        className="relative flex-1 overflow-hidden"
        style={{
          background: track.muted
            ? 'rgba(220,38,38,0.04)'
            : track.locked
            ? 'rgba(234,179,8,0.03)'
            : config.bgColor,
        }}
        data-drag-target={track.id}
      >
        {clips.map(clip => (
          <ClipBlock
            key={clip.id}
            clip={clip}
            zoom={zoom}
            trackHeight={track.height}
            scrollX={scrollX}
            selected={selectedClipIds.includes(clip.id)}
            onClick={onClipClick}
            onDragStart={onClipDragStart}
            showWaveforms={showWaveforms}
            showThumbnails={showThumbnails}
          />
        ))}

        {/* Locked overlay */}
        {track.locked && (
          <div className="absolute inset-0 pointer-events-none" style={{
            background: 'repeating-linear-gradient(45deg, transparent, transparent 8px, rgba(234,179,8,0.04) 8px, rgba(234,179,8,0.04) 16px)'
          }} />
        )}
      </div>
    </div>
  )
}

// ─── Main Timeline ─────────────────────────────────────────────────────────────
export default function Timeline({ mobile }) {
  const {
    tracks, clips, selectedClipIds,
    timelineZoom: zoom, timelineScrollX: scrollX,
    currentTime, duration,
    setCurrentTime, setTimelineScrollX,
    selectClip, clearSelection,
    toggleTrackMute, toggleTrackLock, toggleTrackSolo,
    splitClipAt, addTrack, updateClip,
    showWaveforms, showThumbnails,
    isPlaying,
    zoomIn, zoomOut,
  } = useEditorStore()

  const containerRef = useRef(null)
  const scrollRef = useRef(null)
  const [containerWidth, setContainerWidth] = useState(800)
  const isDraggingClip = useRef(false)
  const dragClipData = useRef(null)

  // Measure container
  useEffect(() => {
    if (!scrollRef.current) return
    const observer = new ResizeObserver(entries => {
      setContainerWidth(entries[0].contentRect.width)
    })
    observer.observe(scrollRef.current)
    return () => observer.disconnect()
  }, [])

  // Auto-scroll scrubber into view while playing
  useEffect(() => {
    if (!isPlaying || !scrollRef.current) return
    const scrubberPx = currentTime * zoom
    const viewStart = scrollX
    const viewEnd = scrollX + containerWidth - TRACK_HEADER_WIDTH
    if (scrubberPx > viewEnd - 60) {
      setTimelineScrollX(scrubberPx - (containerWidth - TRACK_HEADER_WIDTH) / 2)
    }
  }, [currentTime, isPlaying, zoom, scrollX, containerWidth, setTimelineScrollX])

  // Handle scroll
  const handleScroll = useCallback((e) => {
    setTimelineScrollX(e.target.scrollLeft)
  }, [setTimelineScrollX])

  // Click on ruler to seek
  const handleRulerClick = useCallback((e) => {
    if (!scrollRef.current) return
    const rect = scrollRef.current.getBoundingClientRect()
    const clickX = e.clientX - rect.left + scrollX
    const t = Math.max(0, Math.min(duration, (clickX - TRACK_HEADER_WIDTH) / zoom))
    setCurrentTime(t)
  }, [scrollX, zoom, duration, setCurrentTime])

  // Clip click
  const handleClipClick = useCallback((e, clipId) => {
    e.stopPropagation()
    selectClip(clipId, e.ctrlKey || e.metaKey || e.shiftKey)
  }, [selectClip])

  // Clip drag start
  const handleClipDragStart = useCallback((e, clip) => {
    if (e.button !== 0) return
    e.preventDefault()
    isDraggingClip.current = true
    const clipX = clip.startTime * zoom - scrollX
    dragClipData.current = {
      clipId: clip.id,
      startX: e.clientX,
      originalStartTime: clip.startTime,
      offsetX: e.clientX - clipX,
    }
    selectClip(clip.id)
    document.body.style.cursor = 'grabbing'

    const onMouseMove = (ev) => {
      if (!dragClipData.current) return
      const dx = ev.clientX - dragClipData.current.startX
      const newStartTime = Math.max(0, dragClipData.current.originalStartTime + dx / zoom)
      updateClip(dragClipData.current.clipId, { startTime: newStartTime })
    }
    const onMouseUp = () => {
      isDraggingClip.current = false
      dragClipData.current = null
      document.body.style.cursor = ''
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
  }, [zoom, scrollX, selectClip, updateClip])

  // Wheel zoom
  const handleWheel = useCallback((e) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault()
      if (e.deltaY < 0) zoomIn()
      else zoomOut()
    }
  }, [zoomIn, zoomOut])

  const ticks = generateRulerTicks(duration, zoom, scrollX, containerWidth)
  const totalWidth = Math.max(duration * zoom + 200, containerWidth)
  const scrubberLeft = currentTime * zoom - scrollX + TRACK_HEADER_WIDTH

  return (
    <div
      ref={containerRef}
      className="flex flex-col h-full bg-navy-950 overflow-hidden"
      onWheel={handleWheel}
    >
      {/* ── Timeline toolbar ── */}
      <div className="flex items-center gap-2 px-2 h-8 border-b border-border-subtle bg-navy-800 shrink-0">
        <span className="text-2xs font-mono text-text-muted uppercase tracking-wider">Timeline</span>
        <div className="flex-1" />

        {/* Track add buttons */}
        <div className="flex items-center gap-0.5">
          {['video', 'audio', 'text', 'image'].map(type => {
            const config = TRACK_TYPE_CONFIG[type]
            const Icon = config.icon
            return (
              <button
                key={type}
                className="btn-icon-sm gap-0.5 px-1.5 h-5 text-2xs"
                onClick={() => addTrack(type)}
                title={`Add ${config.label} track`}
                style={{ color: config.color }}
              >
                <Plus size={9} />
                <Icon size={9} />
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Scrollable timeline body ── */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-x-auto overflow-y-auto scrollbar-thin relative"
        onScroll={handleScroll}
        onClick={(e) => {
          if (!isDraggingClip.current && e.target === e.currentTarget) clearSelection()
        }}
        style={{ scrollbarGutter: 'stable' }}
      >
        <div style={{ width: totalWidth + TRACK_HEADER_WIDTH, position: 'relative' }}>

          {/* ── Ruler ── */}
          <div
            className="sticky top-0 z-timeline flex bg-navy-900 border-b border-border-subtle"
            style={{ height: RULER_HEIGHT }}
            onClick={handleRulerClick}
          >
            {/* Header corner */}
            <div
              className="shrink-0 border-r border-border-subtle flex items-center justify-center bg-navy-800"
              style={{ width: TRACK_HEADER_WIDTH }}
            >
              <span className="text-2xs font-mono text-text-disabled">RULER</span>
            </div>

            {/* Tick marks */}
            <div className="relative flex-1 overflow-hidden cursor-crosshair">
              {ticks.map(({ t, px, isMajor }) => (
                <div
                  key={t}
                  className="absolute top-0 bottom-0 flex flex-col items-start"
                  style={{ left: px + TRACK_HEADER_WIDTH - TRACK_HEADER_WIDTH }}
                >
                  <div
                    className="w-px"
                    style={{
                      height: isMajor ? '100%' : '50%',
                      background: isMajor ? 'rgba(100,120,160,0.6)' : 'rgba(100,120,160,0.3)',
                      marginTop: isMajor ? 0 : RULER_HEIGHT / 2,
                    }}
                  />
                  {isMajor && (
                    <span
                      className="absolute top-1 font-mono text-text-disabled"
                      style={{ left: 3, fontSize: '0.55rem' }}
                    >
                      {formatRulerTime(t)}
                    </span>
                  )}
                </div>
              ))}

              {/* Scrubber needle on ruler */}
              <div
                className="absolute top-0 bottom-0 w-px pointer-events-none"
                style={{
                  left: currentTime * zoom - scrollX,
                  background: '#2DD4BF',
                  boxShadow: '0 0 4px rgba(45,212,191,0.8)',
                }}
              >
                {/* Scrubber head diamond */}
                <div
                  className="absolute -top-0.5 left-1/2 -translate-x-1/2 w-2.5 h-2.5 rotate-45 bg-cyan-brand"
                  style={{ boxShadow: '0 0 6px rgba(45,212,191,0.7)' }}
                />
              </div>
            </div>
          </div>

          {/* ── Track rows ── */}
          <div className="relative">
            {/* Global scrubber needle across tracks */}
            <div
              className="absolute top-0 bottom-0 w-px pointer-events-none z-scrubber"
              style={{
                left: currentTime * zoom - scrollX + TRACK_HEADER_WIDTH,
                background: 'rgba(45, 212, 191, 0.5)',
                boxShadow: '0 0 6px rgba(45, 212, 191, 0.3)',
              }}
            />

            {tracks.map(track => {
              const trackClips = clips.filter(c => c.trackId === track.id)
              return (
                <TrackRow
                  key={track.id}
                  track={track}
                  clips={trackClips}
                  zoom={zoom}
                  scrollX={scrollX}
                  selectedClipIds={selectedClipIds}
                  onClipClick={handleClipClick}
                  onClipDragStart={handleClipDragStart}
                  showWaveforms={showWaveforms}
                  showThumbnails={showThumbnails}
                  onToggleMute={toggleTrackMute}
                  onToggleLock={toggleTrackLock}
                  onToggleSolo={toggleTrackSolo}
                />
              )
            })}

            {/* Empty state / drop zone */}
            {tracks.length === 0 && (
              <div className="flex items-center justify-center h-24 text-text-disabled text-sm font-ui">
                Add a track or drop media here
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
