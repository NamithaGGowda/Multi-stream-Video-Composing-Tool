import { useState, useEffect, useRef } from 'react';
import { X, Download, Settings, Zap, CheckCircle, AlertCircle, ChevronDown, Film, Cpu, HardDrive, Clock, Layers } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useEditorStore } from '../../store/editorStore';

// ─── Config ────────────────────────────────────────────────────────────────────

const RESOLUTIONS = [
  { id: '480p',   label: '480p SD',    w: 854,  h: 480,  badge: 'SD',  badgeColor: 'text-ice-400' },
  { id: '720p',   label: '720p HD',    w: 1280, h: 720,  badge: 'HD',  badgeColor: 'text-blue-400' },
  { id: '1080p',  label: '1080p FHD',  w: 1920, h: 1080, badge: 'FHD', badgeColor: 'text-cyan-400' },
  { id: '1440p',  label: '1440p QHD',  w: 2560, h: 1440, badge: 'QHD', badgeColor: 'text-lavender-300' },
  { id: '4k',     label: '4K UHD',     w: 3840, h: 2160, badge: '4K',  badgeColor: 'text-amber-300' },
];

const FORMATS = [
  { id: 'mp4',  label: 'MP4',  ext: '.mp4',  desc: 'Best compatibility',    icon: '▶', codecOptions: ['H.264', 'H.265/HEVC'] },
  { id: 'mov',  label: 'MOV',  ext: '.mov',  desc: 'Apple ecosystem',        icon: '◆', codecOptions: ['ProRes 422', 'H.264'] },
  { id: 'webm', label: 'WebM', ext: '.webm', desc: 'Web optimized',          icon: '◉', codecOptions: ['VP9', 'AV1'] },
  { id: 'gif',  label: 'GIF',  ext: '.gif',  desc: 'Animated image',         icon: '◈', codecOptions: ['LZW'] },
];

const FPS_OPTIONS = [23.976, 24, 25, 29.97, 30, 50, 59.94, 60, 120];

const QUALITY_PRESETS = [
  { id: 'draft',   label: 'Draft',     bitrate: '4 Mbps',  desc: 'Fast export, smaller file',  color: 'text-ice-400' },
  { id: 'medium',  label: 'Medium',    bitrate: '8 Mbps',  desc: 'Balanced quality and size',   color: 'text-blue-400' },
  { id: 'high',    label: 'High',      bitrate: '16 Mbps', desc: 'Great for sharing online',    color: 'text-cyan-400' },
  { id: 'master',  label: 'Master',    bitrate: '40 Mbps', desc: 'Maximum quality, large file', color: 'text-amber-300' },
];

const AUDIO_BITRATES = ['96 kbps', '128 kbps', '192 kbps', '320 kbps'];

// ─── Estimated file size calc ──────────────────────────────────────────────────

function estimateFileSize(res, quality, fps, duration) {
  const bitrateMap = { draft: 4, medium: 8, high: 16, master: 40 };
  const mbps = bitrateMap[quality] || 8;
  const bytes = (mbps * 1_000_000 / 8) * duration;
  if (bytes > 1_000_000_000) return `${(bytes / 1_000_000_000).toFixed(1)} GB`;
  return `${(bytes / 1_000_000).toFixed(0)} MB`;
}

// ─── Progress stages ───────────────────────────────────────────────────────────

const EXPORT_STAGES = [
  { label: 'Analyzing timeline',        icon: Layers },
  { label: 'Rendering video frames',    icon: Film   },
  { label: 'Encoding audio tracks',     icon: Cpu    },
  { label: 'Applying color grading',    icon: Zap    },
  { label: 'Muxing and finalizing',     icon: HardDrive },
];

// ─── Sub components ───────────────────────────────────────────────────────────

function SelectCard({ selected, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`text-left w-full rounded-lg border transition-all px-3 py-2.5 ${
        selected
          ? 'bg-cyan-500/10 border-cyan-500/40 ring-1 ring-cyan-500/20'
          : 'bg-white/3 border-white/8 hover:border-white/20 hover:bg-white/6'
      }`}
    >
      {children}
    </button>
  );
}

// ─── Export modal ─────────────────────────────────────────────────────────────

export default function ExportModal() {
  const { exportModalOpen, exportProgress, exportSettings, setExportModalOpen, startExport, updateExportSettings } =
    useEditorStore((s) => ({
      exportModalOpen:    s.exportModalOpen,
      exportProgress:     s.exportProgress,
      exportSettings:     s.exportSettings,
      setExportModalOpen: (open) => s.setExportModalOpen ? s.setExportModalOpen(open) : s.openExportModal && (open ? s.openExportModal() : s.closeExportModal?.()),
      startExport:        s.startExport,
      updateExportSettings: s.updateExportSettings,
    }));

  const duration = useEditorStore((s) => s.duration);

  // Local state (mirrors exportSettings from store)
  const [resolution, setResolution]   = useState(exportSettings?.resolution || '1080p');
  const [format, setFormat]           = useState(exportSettings?.format || 'mp4');
  const [fps, setFps]                 = useState(exportSettings?.fps || 30);
  const [quality, setQuality]         = useState(exportSettings?.quality || 'high');
  const [codec, setCodec]             = useState('H.264');
  const [audioBitrate, setAudioBitrate] = useState('192 kbps');
  const [fileName, setFileName]       = useState('EditFrame_Export');
  const [tab, setTab]                 = useState('settings'); // 'settings' | 'advanced'

  // Advanced options toggles (can't use useState inside .map)
  const [optHardware,  setOptHardware]  = useState(true);
  const [optEffects,   setOptEffects]   = useState(true);
  const [optMetadata,  setOptMetadata]  = useState(false);
  const [optStreaming, setOptStreaming]  = useState(true);

  // Progress state (simulated)
  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress]       = useState(0);
  const [stage, setStage]             = useState(0);
  const [done, setDone]               = useState(false);
  const [error, setError]             = useState(null);
  const progressRef = useRef(null);

  const selectedRes    = RESOLUTIONS.find(r => r.id === resolution) || RESOLUTIONS[2];
  const selectedFormat = FORMATS.find(f => f.id === format) || FORMATS[0];
  const selectedQuality = QUALITY_PRESETS.find(q => q.id === quality) || QUALITY_PRESETS[2];
  const estSize        = estimateFileSize(resolution, quality, fps, duration || 30);
  const estTime        = Math.ceil((duration || 30) * (quality === 'master' ? 3 : quality === 'high' ? 1.5 : 0.8));

  const handleClose = () => {
    if (isExporting) return; // don't close mid-export
    setIsExporting(false);
    setProgress(0);
    setStage(0);
    setDone(false);
    setError(null);
    setTab('settings');
    if (typeof setExportModalOpen === 'function') setExportModalOpen(false);
  };

  const handleExport = () => {
    setIsExporting(true);
    setProgress(0);
    setStage(0);
    setDone(false);
    setError(null);

    // Simulate multi-stage export progress
    let p = 0;
    let s = 0;
    const stageThresholds = [10, 40, 65, 85, 100];

    progressRef.current = setInterval(() => {
      p += Math.random() * 2.5 + 0.5;
      if (p > 100) p = 100;

      // advance stage
      const newStage = stageThresholds.findIndex(t => p <= t);
      s = newStage === -1 ? EXPORT_STAGES.length - 1 : newStage;

      setProgress(Math.round(p));
      setStage(s);

      if (p >= 100) {
        clearInterval(progressRef.current);
        setTimeout(() => setDone(true), 300);
      }
    }, 80);
  };

  const handleCancel = () => {
    if (progressRef.current) clearInterval(progressRef.current);
    setIsExporting(false);
    setProgress(0);
    setStage(0);
    setError(null);
  };

  // Clean up on unmount
  useEffect(() => {
    return () => { if (progressRef.current) clearInterval(progressRef.current); };
  }, []);

  if (!exportModalOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        key="export-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
        onClick={!isExporting ? handleClose : undefined}
      >
        <motion.div
          key="export-card"
          initial={{ scale: 0.92, opacity: 0, y: 16 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.92, opacity: 0, y: 16 }}
          transition={{ type: 'spring', damping: 28, stiffness: 320 }}
          className="bg-[#0A1020] border border-white/10 rounded-2xl overflow-hidden w-full max-w-lg shadow-2xl"
          style={{ boxShadow: '0 0 80px rgba(45,212,191,0.07), 0 25px 60px rgba(0,0,0,0.6)' }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* ── Header ── */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/8">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center">
                <Download className="w-3.5 h-3.5 text-cyan-400" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-ice-100">Export Video</h2>
                <p className="text-[10px] text-ice-500">{fileName}{selectedFormat.ext}</p>
              </div>
            </div>
            {!isExporting && (
              <button
                onClick={handleClose}
                className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-ice-400 hover:text-ice-200 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* ── Exporting / Done state ── */}
          {(isExporting || done) ? (
            <div className="px-5 py-6 space-y-5">
              {/* Progress visualization */}
              <div className="flex flex-col items-center">
                {done ? (
                  <motion.div
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: 'spring', damping: 15 }}
                    className="flex flex-col items-center gap-3"
                  >
                    <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center">
                      <CheckCircle className="w-8 h-8 text-emerald-400" />
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-semibold text-ice-100">Export Complete!</p>
                      <p className="text-[11px] text-ice-400 mt-0.5">
                        {fileName}{selectedFormat.ext} · {estSize}
                      </p>
                    </div>
                  </motion.div>
                ) : (
                  <>
                    {/* Circular progress */}
                    <div className="relative w-24 h-24">
                      <svg viewBox="0 0 96 96" className="w-full h-full -rotate-90">
                        <circle cx="48" cy="48" r="40" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="5" />
                        <circle
                          cx="48" cy="48" r="40"
                          fill="none"
                          stroke="#2DD4BF"
                          strokeWidth="5"
                          strokeLinecap="round"
                          strokeDasharray={`${progress / 100 * 2 * Math.PI * 40} ${2 * Math.PI * 40}`}
                          style={{ filter: 'drop-shadow(0 0 6px #2DD4BF80)', transition: 'stroke-dasharray 0.1s' }}
                        />
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-2xl font-bold font-mono text-cyan-400">{progress}</span>
                        <span className="text-[9px] text-ice-500 font-mono">%</span>
                      </div>
                    </div>

                    {/* Stage indicator */}
                    <div className="mt-4 w-full space-y-1.5">
                      {EXPORT_STAGES.map((s_item, i) => {
                        const Icon = s_item.icon;
                        const isActive = i === stage;
                        const isDone   = i < stage;
                        return (
                          <div
                            key={i}
                            className={`flex items-center gap-2.5 px-3 py-1.5 rounded-lg transition-all ${
                              isActive ? 'bg-cyan-500/10 border border-cyan-500/20' : 'opacity-40'
                            }`}
                          >
                            <Icon className={`w-3 h-3 flex-shrink-0 ${isActive ? 'text-cyan-400' : isDone ? 'text-emerald-400' : 'text-ice-500'}`} />
                            <span className={`text-[11px] ${isActive ? 'text-ice-100 font-medium' : 'text-ice-400'}`}>
                              {s_item.label}
                            </span>
                            {isActive && (
                              <div className="ml-auto flex gap-0.5">
                                {[0,1,2].map(d => (
                                  <span key={d} className="w-1 h-1 rounded-full bg-cyan-400 animate-pulse" style={{ animationDelay: `${d * 0.2}s` }} />
                                ))}
                              </div>
                            )}
                            {isDone && <CheckCircle className="ml-auto w-3 h-3 text-emerald-400" />}
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>

              {/* Summary */}
              {!done && (
                <div className="grid grid-cols-3 gap-2 text-center">
                  {[
                    { label: 'Resolution', value: selectedRes.badge },
                    { label: 'Format',     value: selectedFormat.label },
                    { label: 'Est. size',  value: estSize },
                  ].map(({ label, value }) => (
                    <div key={label} className="bg-white/3 border border-white/8 rounded-lg py-2">
                      <p className="text-[10px] text-ice-500">{label}</p>
                      <p className="text-xs font-mono font-semibold text-ice-200 mt-0.5">{value}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2">
                {done ? (
                  <>
                    <button
                      className="flex-1 py-2.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-400 text-xs font-semibold transition-colors flex items-center justify-center gap-1.5"
                      onClick={handleClose}
                    >
                      <Download className="w-3.5 h-3.5" />
                      Save File
                    </button>
                    <button
                      className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-ice-300 text-xs font-medium transition-colors"
                      onClick={handleClose}
                    >
                      Close
                    </button>
                  </>
                ) : (
                  <button
                    className="flex-1 py-2.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 text-xs font-medium transition-colors"
                    onClick={handleCancel}
                  >
                    Cancel Export
                  </button>
                )}
              </div>
            </div>
          ) : (
            <>
              {/* ── Tabs ── */}
              <div className="flex border-b border-white/8">
                {[
                  { id: 'settings', label: 'Export Settings', icon: Film },
                  { id: 'advanced', label: 'Advanced',        icon: Settings },
                ].map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    onClick={() => setTab(id)}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium border-b-2 transition-all ${
                      tab === id
                        ? 'border-cyan-500 text-cyan-400'
                        : 'border-transparent text-ice-500 hover:text-ice-300'
                    }`}
                  >
                    <Icon className="w-3 h-3" />
                    {label}
                  </button>
                ))}
              </div>

              <div className="px-5 py-4 max-h-[calc(100vh-220px)] overflow-y-auto scrollbar-hide space-y-4">
                <AnimatePresence mode="wait">
                  {tab === 'settings' ? (
                    <motion.div
                      key="settings"
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -8 }}
                      transition={{ duration: 0.15 }}
                      className="space-y-4"
                    >
                      {/* File name */}
                      <div>
                        <label className="ef-label block mb-1.5">File Name</label>
                        <input
                          type="text"
                          value={fileName}
                          onChange={(e) => setFileName(e.target.value)}
                          className="ef-input w-full"
                          placeholder="EditFrame_Export"
                        />
                      </div>

                      {/* Resolution */}
                      <div>
                        <label className="ef-label block mb-2">Resolution</label>
                        <div className="grid grid-cols-5 gap-1.5">
                          {RESOLUTIONS.map((r) => (
                            <button
                              key={r.id}
                              onClick={() => setResolution(r.id)}
                              className={`flex flex-col items-center py-2 rounded-lg border text-center transition-all ${
                                resolution === r.id
                                  ? 'bg-cyan-500/10 border-cyan-500/40'
                                  : 'bg-white/3 border-white/8 hover:border-white/20'
                              }`}
                            >
                              <span className={`text-[11px] font-bold ${resolution === r.id ? 'text-cyan-400' : r.badgeColor}`}>
                                {r.badge}
                              </span>
                              <span className="text-[9px] text-ice-500 mt-0.5">{r.h}p</span>
                            </button>
                          ))}
                        </div>
                        <p className="text-[10px] text-ice-500 mt-1.5">
                          {selectedRes.w} × {selectedRes.h} pixels
                        </p>
                      </div>

                      {/* Format */}
                      <div>
                        <label className="ef-label block mb-2">Format</label>
                        <div className="grid grid-cols-4 gap-1.5">
                          {FORMATS.map((f) => (
                            <SelectCard key={f.id} selected={format === f.id} onClick={() => setFormat(f.id)}>
                              <p className="text-xs font-bold text-center text-ice-100 mb-0.5">{f.label}</p>
                              <p className="text-[9px] text-ice-500 text-center leading-tight">{f.desc}</p>
                            </SelectCard>
                          ))}
                        </div>
                      </div>

                      {/* FPS */}
                      <div>
                        <label className="ef-label block mb-2">Frame Rate</label>
                        <div className="flex flex-wrap gap-1.5">
                          {FPS_OPTIONS.map((f) => (
                            <button
                              key={f}
                              onClick={() => setFps(f)}
                              className={`px-2.5 py-1 rounded-md text-[10px] font-mono font-semibold border transition-all ${
                                fps === f
                                  ? 'bg-cyan-500/15 border-cyan-500/50 text-cyan-300'
                                  : 'bg-white/5 border-white/10 text-ice-400 hover:border-white/20'
                              }`}
                            >
                              {f}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Quality */}
                      <div>
                        <label className="ef-label block mb-2">Quality Preset</label>
                        <div className="space-y-1.5">
                          {QUALITY_PRESETS.map((q) => (
                            <SelectCard key={q.id} selected={quality === q.id} onClick={() => setQuality(q.id)}>
                              <div className="flex items-center gap-2.5">
                                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                                  quality === q.id ? 'bg-cyan-400 shadow-[0_0_6px_#2DD4BF]' : 'bg-white/20'
                                }`} />
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center justify-between">
                                    <span className={`text-xs font-semibold ${quality === q.id ? 'text-cyan-400' : q.color}`}>
                                      {q.label}
                                    </span>
                                    <span className="text-[10px] font-mono text-ice-400">{q.bitrate}</span>
                                  </div>
                                  <p className="text-[10px] text-ice-500 mt-0.5">{q.desc}</p>
                                </div>
                              </div>
                            </SelectCard>
                          ))}
                        </div>
                      </div>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="advanced"
                      initial={{ opacity: 0, x: 8 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 8 }}
                      transition={{ duration: 0.15 }}
                      className="space-y-4"
                    >
                      {/* Codec */}
                      <div>
                        <label className="ef-label block mb-2">Video Codec</label>
                        <div className="grid grid-cols-2 gap-1.5">
                          {selectedFormat.codecOptions.map((c) => (
                            <button
                              key={c}
                              onClick={() => setCodec(c)}
                              className={`py-2 rounded-lg border text-xs font-medium transition-all ${
                                codec === c
                                  ? 'bg-cyan-500/10 border-cyan-500/40 text-cyan-400'
                                  : 'bg-white/3 border-white/8 text-ice-400 hover:border-white/20'
                              }`}
                            >
                              {c}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Audio bitrate */}
                      <div>
                        <label className="ef-label block mb-2">Audio Bitrate</label>
                        <div className="flex gap-1.5 flex-wrap">
                          {AUDIO_BITRATES.map((b) => (
                            <button
                              key={b}
                              onClick={() => setAudioBitrate(b)}
                              className={`px-2.5 py-1 rounded-md text-[10px] font-mono border transition-all ${
                                audioBitrate === b
                                  ? 'bg-cyan-500/15 border-cyan-500/50 text-cyan-300'
                                  : 'bg-white/5 border-white/10 text-ice-400 hover:border-white/20'
                              }`}
                            >
                              {b}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Options */}
                      <div className="space-y-2">
                        <label className="ef-label block">Options</label>
                        {[
                          { label: 'Hardware acceleration',  desc: 'Use GPU encoder when available',     val: optHardware,  set: setOptHardware  },
                          { label: 'Render effects',         desc: 'Include all applied effects',        val: optEffects,   set: setOptEffects   },
                          { label: 'Embed project metadata', desc: 'Add EditFrame project info to file', val: optMetadata,  set: setOptMetadata  },
                          { label: 'Optimize for streaming', desc: 'Move moov atom to file start',       val: optStreaming,  set: setOptStreaming  },
                        ].map(({ label, desc, val, set }) => (
                          <div key={label} className="flex items-center justify-between bg-white/3 border border-white/8 rounded-lg px-3 py-2.5">
                            <div>
                              <p className="text-[11px] font-medium text-ice-200">{label}</p>
                              <p className="text-[10px] text-ice-500 mt-0.5">{desc}</p>
                            </div>
                            <button
                              onClick={() => set(!val)}
                              className={`relative w-9 h-5 rounded-full transition-colors duration-200 flex-shrink-0 ml-3 ${
                                val ? 'bg-cyan-500' : 'bg-white/10'
                              }`}
                            >
                              <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-200 ${val ? 'translate-x-4' : 'translate-x-0.5'}`} />
                            </button>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* ── Summary + Export button ── */}
              <div className="px-5 py-4 border-t border-white/8 space-y-3">
                {/* Stats row */}
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { label: 'Resolution', value: `${selectedRes.w}×${selectedRes.h}`,   icon: Film   },
                    { label: 'FPS',        value: `${fps}fps`,                            icon: Clock  },
                    { label: 'Est. Size',  value: estSize,                                icon: HardDrive },
                    { label: 'Est. Time',  value: `~${estTime}s`,                         icon: Cpu    },
                  ].map(({ label, value, icon: Icon }) => (
                    <div key={label} className="bg-white/3 border border-white/8 rounded-lg py-2 px-2 text-center">
                      <Icon className="w-3 h-3 text-ice-500 mx-auto mb-1" />
                      <p className="text-[10px] font-mono text-ice-200 font-semibold truncate">{value}</p>
                      <p className="text-[9px] text-ice-600">{label}</p>
                    </div>
                  ))}
                </div>

                {/* Export button */}
                <button
                  onClick={handleExport}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-cyan-500/80 to-blue-500/80 hover:from-cyan-400/80 hover:to-blue-400/80 border border-cyan-500/40 text-white text-sm font-semibold transition-all flex items-center justify-center gap-2 shadow-lg"
                  style={{ boxShadow: '0 4px 24px rgba(45,212,191,0.25)' }}
                >
                  <Download className="w-4 h-4" />
                  Export {selectedFormat.label} · {selectedRes.badge}
                </button>
              </div>
            </>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}