import React, { useState } from 'react'
import {
  Music, Mic, Volume2, ChevronDown, Play, Pause,
  Plus, Search, SlidersHorizontal, Waves, Radio
} from 'lucide-react'
import { useEditorStore } from '../../store/editorStore.js'

const MUSIC_LIBRARY = [
  { id: 'bg1', name: 'Cinematic Tension', genre: 'Cinematic', duration: 124, bpm: 85 },
  { id: 'bg2', name: 'Upbeat Corporate', genre: 'Corporate', duration: 90, bpm: 128 },
  { id: 'bg3', name: 'Lo-Fi Chill Study', genre: 'Lo-Fi', duration: 180, bpm: 75 },
  { id: 'bg4', name: 'Epic Orchestra', genre: 'Cinematic', duration: 210, bpm: 100 },
  { id: 'bg5', name: 'Synthwave Drive', genre: 'Electronic', duration: 155, bpm: 118 },
  { id: 'bg6', name: 'Acoustic Folk', genre: 'Folk', duration: 95, bpm: 90 },
  { id: 'bg7', name: 'Deep House Groove', genre: 'Electronic', duration: 240, bpm: 124 },
  { id: 'bg8', name: 'Minimal Piano', genre: 'Ambient', duration: 170, bpm: 60 },
]

const GENRES = ['All', 'Cinematic', 'Corporate', 'Lo-Fi', 'Electronic', 'Folk', 'Ambient']

function formatDur(s) {
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${m}:${sec.toString().padStart(2, '0')}`
}

export default function AudioPanel() {
  const { clips, updateClip, selectedClipIds, addMediaToTimeline } = useEditorStore()
  const [activeTab, setActiveTab] = useState('music') // 'music' | 'voiceover' | 'clip'
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedGenre, setSelectedGenre] = useState('All')
  const [isRecording, setIsRecording] = useState(false)
  const [previewingId, setPreviewingId] = useState(null)
  const [recordingTime, setRecordingTime] = useState(0)

  const selectedClip = clips.find(c => selectedClipIds[0] === c.id && (c.type === 'audio' || c.type === 'video'))

  const filteredMusic = MUSIC_LIBRARY.filter(track => {
    const matchGenre = selectedGenre === 'All' || track.genre === selectedGenre
    const matchSearch = !searchQuery || track.name.toLowerCase().includes(searchQuery.toLowerCase())
    return matchGenre && matchSearch
  })

  const toggleRecording = () => {
    if (isRecording) {
      setIsRecording(false)
      setRecordingTime(0)
    } else {
      setIsRecording(true)
      const timer = setInterval(() => {
        setRecordingTime(t => {
          if (t >= 299) { clearInterval(timer); setIsRecording(false); return 0 }
          return t + 1
        })
      }, 1000)
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="panel-header">
        <span className="panel-title">Audio</span>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border-subtle">
        {[
          { id: 'music', icon: Music, label: 'Music' },
          { id: 'voiceover', icon: Mic, label: 'Voice' },
          { id: 'clip', icon: SlidersHorizontal, label: 'Clip' },
        ].map(({ id, icon: Icon, label }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex-1 flex items-center justify-center gap-1 py-2 text-xs font-ui
                       transition-colors duration-150 border-b-2
                       ${activeTab === id
                         ? 'text-cyan-brand border-cyan-brand bg-cyan-brand/5'
                         : 'text-text-muted border-transparent hover:text-text-secondary'
                       }`}
          >
            <Icon size={12} />
            {label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin">

        {/* ── Music library ── */}
        {activeTab === 'music' && (
          <div className="flex flex-col">
            {/* Search */}
            <div className="p-2.5 border-b border-border-subtle">
              <div className="relative">
                <Search size={11} className="absolute left-2 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search music…"
                  className="ef-input pl-6 h-7 text-xs"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                />
              </div>
            </div>

            {/* Genre pills */}
            <div className="flex gap-1 px-2.5 py-2 flex-wrap border-b border-border-subtle">
              {GENRES.map(g => (
                <button
                  key={g}
                  onClick={() => setSelectedGenre(g)}
                  className={`px-2 py-0.5 text-2xs font-ui rounded-full border transition-colors duration-150
                             ${selectedGenre === g
                               ? 'bg-emerald-900/40 text-emerald-400 border-emerald-800/60'
                               : 'text-text-muted border-border-subtle hover:text-text-secondary hover:border-border-default'
                             }`}
                >
                  {g}
                </button>
              ))}
            </div>

            {/* Track list */}
            <div className="divide-y divide-border-subtle">
              {filteredMusic.map(track => (
                <div
                  key={track.id}
                  className={`flex items-center gap-2 px-3 py-2 hover:bg-surface-hover
                             transition-colors duration-150 cursor-pointer group`}
                >
                  <button
                    className="w-6 h-6 rounded-full border border-border-default flex items-center justify-center
                               text-text-muted hover:border-emerald-500 hover:text-emerald-400 transition-colors duration-150 shrink-0"
                    onClick={() => setPreviewingId(previewingId === track.id ? null : track.id)}
                  >
                    {previewingId === track.id
                      ? <Pause size={9} />
                      : <Play size={9} style={{ marginLeft: 1 }} />
                    }
                  </button>

                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-ui text-text-secondary truncate">{track.name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-2xs font-ui text-text-disabled">{track.genre}</span>
                      <span className="text-2xs font-mono text-text-disabled">{track.bpm} BPM</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <span className="text-2xs font-mono text-text-muted">{formatDur(track.duration)}</span>
                    <button
                      className="btn-icon-sm opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Add to timeline"
                      onClick={() => addMediaToTimeline(track.id)}
                    >
                      <Plus size={11} className="text-emerald-400" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {filteredMusic.length === 0 && (
              <div className="py-8 flex flex-col items-center gap-2">
                <Music size={20} className="text-text-disabled" />
                <p className="text-xs text-text-muted">No tracks found</p>
              </div>
            )}
          </div>
        )}

        {/* ── Voice-over recording ── */}
        {activeTab === 'voiceover' && (
          <div className="flex flex-col items-center p-4 gap-4">
            <div className="text-center">
              <h3 className="text-sm font-ui text-text-primary mb-1">Voice-over Recording</h3>
              <p className="text-xs text-text-muted">Record narration directly to timeline</p>
            </div>

            {/* Recording button */}
            <button
              className={`w-20 h-20 rounded-full flex items-center justify-center transition-all duration-200
                         ${isRecording
                           ? 'bg-red-600 hover:bg-red-700 shadow-[0_0_30px_rgba(220,38,38,0.4)] animate-pulse-slow'
                           : 'bg-surface-overlay border-2 border-border-default hover:border-red-500 hover:bg-red-900/20'
                         }`}
              onClick={toggleRecording}
            >
              <Mic size={28} className={isRecording ? 'text-white' : 'text-text-secondary'} />
            </button>

            {isRecording && (
              <div className="flex flex-col items-center gap-1">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                  <span className="font-mono text-sm text-red-400">REC</span>
                </div>
                <span className="font-mono text-lg text-text-primary">
                  {Math.floor(recordingTime / 60).toString().padStart(2, '0')}:{(recordingTime % 60).toString().padStart(2, '0')}
                </span>
              </div>
            )}

            {!isRecording && (
              <p className="text-xs text-text-muted text-center">
                Click to start recording. Recording will be added to the voice track.
              </p>
            )}

            {/* Input device selector */}
            <div className="w-full">
              <label className="ef-label">Input Device</label>
              <select className="ef-input text-xs">
                <option>Default Microphone</option>
                <option>Built-in Microphone</option>
                <option>USB Audio Interface</option>
              </select>
            </div>

            {/* Monitoring level */}
            <div className="w-full">
              <div className="flex items-center justify-between mb-1">
                <label className="ef-label mb-0">Input Level</label>
                <span className="text-2xs font-mono text-text-muted">-12 dB</span>
              </div>
              <input type="range" min={-60} max={0} defaultValue={-12} className="ef-slider w-full"
                style={{ '--slider-pct': '80%' }} />
            </div>

            {/* VU meter (fake) */}
            {isRecording && (
              <div className="w-full">
                <label className="ef-label">Level Meter</label>
                <div className="flex gap-0.5 h-2 rounded overflow-hidden">
                  {Array.from({ length: 20 }).map((_, i) => {
                    const level = Math.random() * 20
                    const color = i < 14 ? '#059669' : i < 17 ? '#D97706' : '#DC2626'
                    return (
                      <div
                        key={i}
                        className="flex-1 rounded-sm transition-all duration-75"
                        style={{ background: level > i ? color : '#1B2A4A' }}
                      />
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Clip audio properties ── */}
        {activeTab === 'clip' && (
          <div className="flex flex-col gap-4 p-3">
            {selectedClip ? (
              <>
                <div className="bg-surface-raised rounded-md p-2.5 border border-border-subtle">
                  <p className="text-xs font-ui text-text-secondary truncate">{selectedClip.name}</p>
                  <p className="text-2xs text-text-muted mt-0.5">{selectedClip.type} clip</p>
                </div>

                {/* Volume */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="ef-label mb-0">Volume</label>
                    <span className="text-xs font-mono text-cyan-brand">
                      {Math.round(selectedClip.volume * 100)}%
                    </span>
                  </div>
                  <input
                    type="range" min={0} max={2} step={0.01}
                    value={selectedClip.volume}
                    onChange={e => updateClip(selectedClip.id, { volume: parseFloat(e.target.value) })}
                    className="ef-slider w-full"
                    style={{ '--slider-pct': `${(selectedClip.volume / 2) * 100}%` }}
                  />
                </div>

                {/* Fade in */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="ef-label mb-0">Fade In</label>
                    <span className="text-xs font-mono text-cyan-brand">
                      {selectedClip.fadeIn.toFixed(1)}s
                    </span>
                  </div>
                  <input
                    type="range" min={0} max={5} step={0.1}
                    value={selectedClip.fadeIn}
                    onChange={e => updateClip(selectedClip.id, { fadeIn: parseFloat(e.target.value) })}
                    className="ef-slider w-full"
                    style={{ '--slider-pct': `${(selectedClip.fadeIn / 5) * 100}%` }}
                  />
                </div>

                {/* Fade out */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="ef-label mb-0">Fade Out</label>
                    <span className="text-xs font-mono text-cyan-brand">
                      {selectedClip.fadeOut.toFixed(1)}s
                    </span>
                  </div>
                  <input
                    type="range" min={0} max={5} step={0.1}
                    value={selectedClip.fadeOut}
                    onChange={e => updateClip(selectedClip.id, { fadeOut: parseFloat(e.target.value) })}
                    className="ef-slider w-full"
                    style={{ '--slider-pct': `${(selectedClip.fadeOut / 5) * 100}%` }}
                  />
                </div>

                {/* Speed */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="ef-label mb-0">Speed</label>
                    <span className="text-xs font-mono text-cyan-brand">
                      {selectedClip.speed}×
                    </span>
                  </div>
                  <input
                    type="range" min={0.1} max={4} step={0.05}
                    value={selectedClip.speed}
                    onChange={e => updateClip(selectedClip.id, { speed: parseFloat(e.target.value) })}
                    className="ef-slider w-full"
                    style={{ '--slider-pct': `${((selectedClip.speed - 0.1) / 3.9) * 100}%` }}
                  />
                  <div className="flex justify-between mt-1">
                    {[0.25, 0.5, 1, 1.5, 2, 4].map(v => (
                      <button
                        key={v}
                        onClick={() => updateClip(selectedClip.id, { speed: v })}
                        className={`text-2xs font-mono transition-colors duration-150
                                   ${selectedClip.speed === v ? 'text-cyan-brand' : 'text-text-disabled hover:text-text-muted'}`}
                      >
                        {v}×
                      </button>
                    ))}
                  </div>
                </div>

                {/* Reverse */}
                <div className="flex items-center justify-between">
                  <label className="text-xs font-ui text-text-secondary">Reverse Clip</label>
                  <button
                    onClick={() => updateClip(selectedClip.id, { reversed: !selectedClip.reversed })}
                    className={`relative w-9 h-5 rounded-full transition-colors duration-200
                               ${selectedClip.reversed ? 'bg-cyan-brand' : 'bg-surface-overlay border border-border-default'}`}
                  >
                    <span
                      className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200
                                 ${selectedClip.reversed ? 'translate-x-4' : 'translate-x-0.5'}`}
                    />
                  </button>
                </div>
              </>
            ) : (
              <div className="py-8 flex flex-col items-center gap-2">
                <Volume2 size={20} className="text-text-disabled" />
                <p className="text-xs text-text-muted text-center">
                  Select a clip on the timeline to edit its audio properties
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
