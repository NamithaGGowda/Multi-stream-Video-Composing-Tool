import React, { useRef } from 'react'
import {
  Upload, Search, Film, Music, Image, Plus,
  MoreHorizontal, Clock, HardDrive, Play, ChevronDown
} from 'lucide-react'
import { useEditorStore } from '../../store/editorStore.js'

const FILTER_TABS = [
  { id: 'all', label: 'All' },
  { id: 'video', label: 'Video' },
  { id: 'audio', label: 'Audio' },
  { id: 'image', label: 'Image' },
]

function TypeIcon({ type, size = 12 }) {
  if (type === 'video') return <Film size={size} className="text-blue-400" />
  if (type === 'audio') return <Music size={size} className="text-emerald-400" />
  return <Image size={size} className="text-purple-400" />
}

function formatDuration(s) {
  if (!s) return '--'
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return m > 0 ? `${m}:${sec.toString().padStart(2, '0')}` : `${sec}s`
}

export default function MediaPanel() {
  const {
    mediaItems, mediaSearch, mediaFilter, selectedMediaId,
    setMediaSearch, setMediaFilter, setSelectedMedia,
    addMediaToTimeline, addMediaItem,
  } = useEditorStore()

  const fileInputRef = useRef(null)

  const filtered = mediaItems.filter(item => {
    const matchType = mediaFilter === 'all' || item.type === mediaFilter
    const matchSearch = !mediaSearch || item.name.toLowerCase().includes(mediaSearch.toLowerCase())
    return matchType && matchSearch
  })

  const handleFileImport = (e) => {
    Array.from(e.target.files || []).forEach(file => {
      const type = file.type.startsWith('video/') ? 'video'
                 : file.type.startsWith('audio/') ? 'audio'
                 : 'image'
      addMediaItem({
        type,
        name: file.name,
        size: `${(file.size / 1024 / 1024).toFixed(1)} MB`,
        duration: type === 'image' ? undefined : 10,
        fps: type === 'video' ? 30 : undefined,
      })
    })
    e.target.value = ''
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="panel-header">
        <span className="panel-title">Media Library</span>
        <div className="flex items-center gap-1">
          <button
            className="btn-primary text-xs py-1 px-2"
            onClick={() => fileInputRef.current?.click()}
            title="Import media files"
          >
            <Upload size={11} />
            Import
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="video/*,audio/*,image/*"
            multiple
            className="hidden"
            onChange={handleFileImport}
          />
        </div>
      </div>

      {/* Search */}
      <div className="px-2.5 py-2 border-b border-border-subtle">
        <div className="relative">
          <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
          <input
            type="text"
            placeholder="Search media…"
            className="ef-input pl-7 text-xs h-7"
            value={mediaSearch}
            onChange={e => setMediaSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex border-b border-border-subtle px-2.5 py-1.5 gap-1">
        {FILTER_TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setMediaFilter(tab.id)}
            className={`px-2 py-0.5 text-xs font-ui rounded-sm transition-colors duration-150
                       ${mediaFilter === tab.id
                         ? 'bg-surface-overlay text-text-primary border border-border-strong'
                         : 'text-text-muted hover:text-text-secondary'
                       }`}
          >
            {tab.label}
          </button>
        ))}
        <div className="flex-1" />
        <span className="text-2xs font-mono text-text-disabled self-center">
          {filtered.length} file{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Media grid */}
      <div className="flex-1 overflow-y-auto scrollbar-thin p-2.5">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 gap-3">
            <div className="w-10 h-10 rounded-full bg-surface-overlay flex items-center justify-center">
              <Film size={18} className="text-text-disabled" />
            </div>
            <p className="text-text-muted text-xs font-ui text-center">
              {mediaSearch ? 'No results found' : 'Import media to get started'}
            </p>
            {!mediaSearch && (
              <button
                className="btn-secondary text-xs py-1 px-2.5"
                onClick={() => fileInputRef.current?.click()}
              >
                <Plus size={11} />
                Add Files
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {filtered.map(item => (
              <MediaThumb
                key={item.id}
                item={item}
                selected={selectedMediaId === item.id}
                onSelect={() => setSelectedMedia(item.id)}
                onAddToTimeline={() => addMediaToTimeline(item.id)}
              />
            ))}
          </div>
        )}

        {/* Drop zone */}
        <div
          className="mt-2 border border-dashed border-border-default rounded-md p-4
                     flex flex-col items-center gap-1.5 cursor-pointer
                     hover:border-cyan-brand/50 hover:bg-cyan-brand/5 transition-colors duration-200"
          onClick={() => fileInputRef.current?.click()}
          onDragOver={e => e.preventDefault()}
          onDrop={e => {
            e.preventDefault()
            const files = Array.from(e.dataTransfer.files)
            files.forEach(file => {
              const type = file.type.startsWith('video/') ? 'video'
                         : file.type.startsWith('audio/') ? 'audio'
                         : 'image'
              addMediaItem({ type, name: file.name, size: `${(file.size / 1024 / 1024).toFixed(1)} MB` })
            })
          }}
        >
          <Upload size={14} className="text-text-disabled" />
          <span className="text-2xs text-text-disabled font-ui">Drop files here</span>
        </div>
      </div>
    </div>
  )
}

function MediaThumb({ item, selected, onSelect, onAddToTimeline }) {
  const typeColors = { video: '#2563EB', audio: '#059669', image: '#7C3AED' }

  return (
    <div
      className={`media-thumb ${selected ? 'selected' : ''}`}
      onClick={onSelect}
      onDoubleClick={onAddToTimeline}
    >
      {/* Thumbnail area */}
      <div className="aspect-video bg-navy-950 relative overflow-hidden">
        {/* Fake thumbnail gradient */}
        <div
          className="absolute inset-0"
          style={{
            background: `linear-gradient(135deg, ${typeColors[item.type]}22 0%, ${typeColors[item.type]}08 100%)`,
          }}
        />
        <div className="absolute inset-0 flex items-center justify-center">
          <TypeIcon type={item.type} size={20} />
        </div>

        {/* Duration badge */}
        {item.duration && (
          <div className="absolute bottom-1 right-1 bg-navy-950/90 rounded px-1 py-0.5">
            <span className="font-mono text-2xs text-text-muted">{formatDuration(item.duration)}</span>
          </div>
        )}

        {/* FPS badge for video */}
        {item.fps && (
          <div className="absolute top-1 right-1 bg-navy-950/90 rounded px-1 py-0.5">
            <span className="font-mono text-2xs text-text-muted">{item.fps}fps</span>
          </div>
        )}

        {/* Hover overlay */}
        <div className="absolute inset-0 bg-navy-950/0 group-hover:bg-navy-950/40 transition-colors duration-150 flex items-center justify-center">
          <button
            className="opacity-0 group-hover:opacity-100 bg-cyan-brand text-navy-900 rounded-full p-1.5
                       transition-all duration-150 hover:scale-110"
            onClick={(e) => { e.stopPropagation(); onAddToTimeline() }}
            title="Add to timeline"
          >
            <Plus size={11} />
          </button>
        </div>
      </div>

      {/* Metadata */}
      <div className="px-1.5 py-1">
        <p className="text-2xs font-ui text-text-secondary truncate leading-tight" title={item.name}>
          {item.name}
        </p>
        <div className="flex items-center justify-between mt-0.5">
          <span className="text-2xs font-mono text-text-disabled">{item.size}</span>
          <TypeIcon type={item.type} size={9} />
        </div>
      </div>
    </div>
  )
}
