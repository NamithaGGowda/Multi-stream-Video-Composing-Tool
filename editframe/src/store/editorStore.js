import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import { subscribeWithSelector } from 'zustand/middleware'

// ─── Mock initial data ─────────────────────────────────────────────────────────
const MOCK_CLIPS = [
  {
    id: 'clip-1',
    type: 'video',
    name: 'intro_scene.mp4',
    trackId: 'track-video-1',
    startTime: 0,
    duration: 8.5,
    thumbnail: null,
    volume: 1,
    speed: 1,
    reversed: false,
    fadeIn: 0,
    fadeOut: 0,
    filters: [],
    effects: [],
    color: '#2563EB',
  },
  {
    id: 'clip-2',
    type: 'video',
    name: 'main_footage.mp4',
    trackId: 'track-video-1',
    startTime: 9,
    duration: 14.2,
    thumbnail: null,
    volume: 1,
    speed: 1,
    reversed: false,
    fadeIn: 0.3,
    fadeOut: 0.3,
    filters: [],
    effects: [],
    color: '#2563EB',
  },
  {
    id: 'clip-3',
    type: 'video',
    name: 'b_roll_city.mp4',
    trackId: 'track-video-1',
    startTime: 24,
    duration: 6.0,
    thumbnail: null,
    volume: 1,
    speed: 1,
    reversed: false,
    fadeIn: 0,
    fadeOut: 0,
    filters: ['Vivid'],
    effects: [],
    color: '#2563EB',
  },
  {
    id: 'clip-4',
    type: 'audio',
    name: 'background_music.mp3',
    trackId: 'track-audio-1',
    startTime: 0,
    duration: 30,
    thumbnail: null,
    volume: 0.6,
    speed: 1,
    reversed: false,
    fadeIn: 1.5,
    fadeOut: 2.0,
    filters: [],
    effects: [],
    color: '#059669',
  },
  {
    id: 'clip-5',
    type: 'audio',
    name: 'voiceover_take2.wav',
    trackId: 'track-audio-2',
    startTime: 2,
    duration: 18.5,
    thumbnail: null,
    volume: 1,
    speed: 1,
    reversed: false,
    fadeIn: 0.2,
    fadeOut: 0.5,
    filters: [],
    effects: [],
    color: '#059669',
  },
  {
    id: 'clip-6',
    type: 'text',
    name: 'Title Card',
    trackId: 'track-text-1',
    startTime: 1,
    duration: 3.5,
    thumbnail: null,
    volume: 0,
    speed: 1,
    reversed: false,
    fadeIn: 0.4,
    fadeOut: 0.4,
    filters: [],
    effects: ['FadeIn'],
    color: '#D97706',
    textContent: 'CHAPTER ONE',
    fontFamily: 'Syne',
    fontSize: 64,
    fontColor: '#FFFFFF',
    textAnimation: 'slide-up',
  },
  {
    id: 'clip-7',
    type: 'image',
    name: 'logo_overlay.png',
    trackId: 'track-overlay-1',
    startTime: 0,
    duration: 30,
    thumbnail: null,
    volume: 0,
    speed: 1,
    reversed: false,
    fadeIn: 0,
    fadeOut: 0,
    filters: [],
    effects: [],
    color: '#7C3AED',
  },
]

const MOCK_TRACKS = [
  { id: 'track-video-1', type: 'video', label: 'VID 1', muted: false, locked: false, solo: false, height: 56 },
  { id: 'track-overlay-1', type: 'image', label: 'OVL 1', muted: false, locked: false, solo: false, height: 44 },
  { id: 'track-text-1', type: 'text', label: 'TXT 1', muted: false, locked: false, solo: false, height: 44 },
  { id: 'track-audio-1', type: 'audio', label: 'AUD 1', muted: false, locked: false, solo: false, height: 52 },
  { id: 'track-audio-2', type: 'audio', label: 'VOX 1', muted: false, locked: false, solo: false, height: 52 },
]

const MOCK_MEDIA = [
  { id: 'm1', type: 'video', name: 'intro_scene.mp4', duration: 8.5, size: '42.1 MB', fps: 30 },
  { id: 'm2', type: 'video', name: 'main_footage.mp4', duration: 14.2, size: '78.4 MB', fps: 60 },
  { id: 'm3', type: 'video', name: 'b_roll_city.mp4', duration: 6.0, size: '31.2 MB', fps: 30 },
  { id: 'm4', type: 'video', name: 'talking_head.mp4', duration: 22.8, size: '115 MB', fps: 24 },
  { id: 'm5', type: 'audio', name: 'background_music.mp3', duration: 180, size: '4.2 MB' },
  { id: 'm6', type: 'audio', name: 'voiceover_take2.wav', duration: 18.5, size: '1.8 MB' },
  { id: 'm7', type: 'audio', name: 'ambient_noise.wav', duration: 60, size: '5.6 MB' },
  { id: 'm8', type: 'image', name: 'logo_overlay.png', size: '0.4 MB' },
  { id: 'm9', type: 'image', name: 'lower_third.png', size: '0.2 MB' },
  { id: 'm10', type: 'image', name: 'end_card.jpg', size: '0.8 MB' },
]

const initialColorGrading = {
  brightness: 0,
  contrast: 0,
  saturation: 0,
  hue: 0,
  warmth: 0,
  tint: 0,
  shadows: 0,
  highlights: 0,
  vignette: 0,
  sharpness: 0,
}

// ─── Store ─────────────────────────────────────────────────────────────────────
export const useEditorStore = create(
  subscribeWithSelector(
    immer((set, get) => ({
      // ── Layout state ────────────────────────────────────────────────────────
      activePanel: 'media',
      sidePanelOpen: true,
      timelineHeight: 220,
      panelWidth: 280,

      setActivePanel: (id) => set(state => { state.activePanel = id }),
      setSidePanelOpen: (open) => set(state => { state.sidePanelOpen = open }),
      setTimelineHeight: (h) => set(state => { state.timelineHeight = h }),
      setPanelWidth: (w) => set(state => { state.panelWidth = w }),

      // ── Playback state ───────────────────────────────────────────────────────
      isPlaying: false,
      currentTime: 4.2,
      duration: 30,
      volume: 1,
      muted: false,
      loop: false,
      playbackRate: 1,

      setIsPlaying: (v) => set(state => { state.isPlaying = v }),
      togglePlay: () => set(state => { state.isPlaying = !state.isPlaying }),
      setCurrentTime: (t) => set(state => { state.currentTime = Math.max(0, Math.min(t, state.duration)) }),
      setVolume: (v) => set(state => { state.volume = Math.max(0, Math.min(1, v)) }),
      toggleMute: () => set(state => { state.muted = !state.muted }),
      setPlaybackRate: (r) => set(state => { state.playbackRate = r }),
      seekTo: (t) => set(state => { state.currentTime = Math.max(0, Math.min(t, state.duration)) }),

      // ── Timeline state ───────────────────────────────────────────────────────
      tracks: MOCK_TRACKS,
      clips: MOCK_CLIPS,
      selectedClipIds: [],
      timelineZoom: 40, // pixels per second
      timelineScrollX: 0,
      timelineScrollY: 0,
      snapToGrid: true,
      snapInterval: 0.5,

      setTimelineZoom: (z) => set(state => { state.timelineZoom = Math.max(10, Math.min(200, z)) }),
      zoomIn: () => set(state => { state.timelineZoom = Math.min(200, state.timelineZoom * 1.3) }),
      zoomOut: () => set(state => { state.timelineZoom = Math.max(10, state.timelineZoom / 1.3) }),
      setTimelineScrollX: (x) => set(state => { state.timelineScrollX = x }),
      setTimelineScrollY: (y) => set(state => { state.timelineScrollY = y }),

      selectClip: (id, multi = false) => set(state => {
        if (multi) {
          if (state.selectedClipIds.includes(id)) {
            state.selectedClipIds = state.selectedClipIds.filter(c => c !== id)
          } else {
            state.selectedClipIds.push(id)
          }
        } else {
          state.selectedClipIds = [id]
        }
      }),
      clearSelection: () => set(state => { state.selectedClipIds = [] }),

      updateClip: (id, updates) => set(state => {
        const idx = state.clips.findIndex(c => c.id === id)
        if (idx !== -1) Object.assign(state.clips[idx], updates)
      }),

      deleteSelectedClips: () => set(state => {
        state.clips = state.clips.filter(c => !state.selectedClipIds.includes(c.id))
        state.selectedClipIds = []
      }),

      splitClipAt: (clipId, time) => set(state => {
        const idx = state.clips.findIndex(c => c.id === clipId)
        if (idx === -1) return
        const clip = state.clips[idx]
        if (time <= clip.startTime || time >= clip.startTime + clip.duration) return
        const leftDuration = time - clip.startTime
        const rightDuration = clip.duration - leftDuration
        state.clips[idx] = { ...clip, duration: leftDuration }
        state.clips.splice(idx + 1, 0, {
          ...clip,
          id: `clip-${Date.now()}`,
          startTime: time,
          duration: rightDuration,
        })
      }),

      duplicateClip: (clipId) => set(state => {
        const clip = state.clips.find(c => c.id === clipId)
        if (!clip) return
        state.clips.push({
          ...clip,
          id: `clip-${Date.now()}`,
          startTime: clip.startTime + clip.duration + 0.1,
        })
      }),

      toggleTrackMute: (trackId) => set(state => {
        const track = state.tracks.find(t => t.id === trackId)
        if (track) track.muted = !track.muted
      }),

      toggleTrackLock: (trackId) => set(state => {
        const track = state.tracks.find(t => t.id === trackId)
        if (track) track.locked = !track.locked
      }),

      toggleTrackSolo: (trackId) => set(state => {
        const track = state.tracks.find(t => t.id === trackId)
        if (track) track.solo = !track.solo
      }),

      addTrack: (type) => set(state => {
        const labelMap = { video: 'VID', audio: 'AUD', text: 'TXT', image: 'OVL' }
        const count = state.tracks.filter(t => t.type === type).length + 1
        state.tracks.push({
          id: `track-${type}-${Date.now()}`,
          type,
          label: `${labelMap[type] || 'TRK'} ${count + 1}`,
          muted: false,
          locked: false,
          solo: false,
          height: type === 'audio' ? 52 : 44,
        })
      }),

      // ── History / undo-redo ──────────────────────────────────────────────────
      history: [],
      historyIndex: -1,
      canUndo: false,
      canRedo: false,

      undo: () => set(state => {
        if (state.historyIndex > 0) state.historyIndex--
      }),
      redo: () => set(state => {
        if (state.historyIndex < state.history.length - 1) state.historyIndex++
      }),

      // ── Media library ────────────────────────────────────────────────────────
      mediaItems: MOCK_MEDIA,
      mediaSearch: '',
      mediaFilter: 'all', // 'all' | 'video' | 'audio' | 'image'
      selectedMediaId: null,

      setMediaSearch: (q) => set(state => { state.mediaSearch = q }),
      setMediaFilter: (f) => set(state => { state.mediaFilter = f }),
      setSelectedMedia: (id) => set(state => { state.selectedMediaId = id }),

      addMediaItem: (item) => set(state => {
        state.mediaItems.push({ id: `m-${Date.now()}`, ...item })
      }),

      addMediaToTimeline: (mediaId) => set(state => {
        const media = state.mediaItems.find(m => m.id === mediaId)
        if (!media) return
        const typeTrackMap = { video: 'track-video-1', audio: 'track-audio-1', image: 'track-overlay-1' }
        const trackId = typeTrackMap[media.type] || 'track-video-1'
        const colorMap = { video: '#2563EB', audio: '#059669', image: '#7C3AED' }
        const lastClipOnTrack = state.clips
          .filter(c => c.trackId === trackId)
          .reduce((max, c) => (c.startTime + c.duration > (max?.startTime + max?.duration || 0) ? c : max), null)
        const startTime = lastClipOnTrack
          ? lastClipOnTrack.startTime + lastClipOnTrack.duration + 0.1
          : 0
        state.clips.push({
          id: `clip-${Date.now()}`,
          type: media.type,
          name: media.name,
          trackId,
          startTime,
          duration: media.duration || 5,
          thumbnail: null,
          volume: 1,
          speed: 1,
          reversed: false,
          fadeIn: 0,
          fadeOut: 0,
          filters: [],
          effects: [],
          color: colorMap[media.type] || '#2563EB',
        })
      }),

      // ── Active clip properties ───────────────────────────────────────────────
      colorGrading: { ...initialColorGrading },
      setColorGrading: (key, value) => set(state => { state.colorGrading[key] = value }),
      resetColorGrading: () => set(state => { state.colorGrading = { ...initialColorGrading } }),

      activeFilter: null,
      setActiveFilter: (f) => set(state => { state.activeFilter = f }),

      activeTransition: null,
      setActiveTransition: (t) => set(state => { state.activeTransition = t }),

      // ── Export ───────────────────────────────────────────────────────────────
      exportModalOpen: false,
      exportProgress: null, // null | 0-100
      exportSettings: {
        resolution: '1080p',
        format: 'mp4',
        fps: 30,
        quality: 'high',
        includeAudio: true,
      },

      setExportModalOpen: (v) => set(state => { state.exportModalOpen = v }),
      setExportProgress: (v) => set(state => { state.exportProgress = v }),
      setExportSettings: (settings) => set(state => {
        Object.assign(state.exportSettings, settings)
      }),

      startExport: () => {
        set(state => { state.exportProgress = 0 })
        // Simulate export progress
        let progress = 0
        const interval = setInterval(() => {
          progress += Math.random() * 4 + 1
          if (progress >= 100) {
            progress = 100
            clearInterval(interval)
            setTimeout(() => {
              set(state => { state.exportProgress = null })
            }, 1500)
          }
          set(state => { state.exportProgress = Math.min(100, progress) })
        }, 150)
      },

      // ── UI toggles ───────────────────────────────────────────────────────────
      showRuler: true,
      showWaveforms: true,
      showThumbnails: true,
      showGrid: false,

      toggleRuler: () => set(state => { state.showRuler = !state.showRuler }),
      toggleWaveforms: () => set(state => { state.showWaveforms = !state.showWaveforms }),
      toggleThumbnails: () => set(state => { state.showThumbnails = !state.showThumbnails }),
      toggleGrid: () => set(state => { state.showGrid = !state.showGrid }),

      // ── Transitions between clips ────────────────────────────────────────────
      transitions: [
        { id: 'tr-1', type: 'Dissolve', clipId: 'clip-1', position: 'end', duration: 0.5 },
        { id: 'tr-2', type: 'Fade', clipId: 'clip-2', position: 'end', duration: 0.8 },
      ],
      addTransition: (t) => set(state => { state.transitions.push({ id: `tr-${Date.now()}`, ...t }) }),
      removeTransition: (id) => set(state => { state.transitions = state.transitions.filter(t => t.id !== id) }),

      // ── Text overlays (separate from timeline clips for property editing) ────
      activeTextClip: null,
      setActiveTextClip: (id) => set(state => { state.activeTextClip = id }),
    }))
  )
)
