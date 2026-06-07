import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  X, RotateCcw, RotateCw, FlipHorizontal, FlipVertical,
  Sliders, Palette, Crop, Type, Check, RefreshCw,
  Sun, Contrast, Droplets, Zap, Wind, Eye, Circle
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../services/api.service.js';
import SaveOptionsDialog from './SaveOptionsDialog.jsx';

const DEFAULT_EDITS = {
  brightness: 0, contrast: 0, saturation: 0, exposure: 0,
  sharpness: 0, blur: 0, vignette: 0,
  rotate: 0, flipH: false, flipV: false,
  filter: null, crop: null, text: null,
};

const FILTERS = [
  { id: null,             label: 'None',      style: {} },
  { id: 'art_aurora',     label: 'Aurora',    style: { filter: 'saturate(1.4) brightness(1.1)' } },
  { id: 'grayscale',      label: 'B&W',       style: { filter: 'grayscale(1)' } },
  { id: 'sepia',          label: 'Sepia',     style: { filter: 'sepia(0.8)' } },
  { id: 'art_incognito',  label: 'Incognito', style: { filter: 'contrast(1.2) brightness(0.9)' } },
  { id: 'art_peacock',    label: 'Peacock',   style: { filter: 'hue-rotate(180deg) saturate(1.3)' } },
  { id: 'art_primavera',  label: 'Spring',    style: { filter: 'saturate(1.6) brightness(1.05)' } },
  { id: 'art_eucalyptus', label: 'Forest',    style: { filter: 'hue-rotate(90deg) saturate(1.2)' } },
  { id: 'art_linen',      label: 'Linen',     style: { filter: 'sepia(0.3) brightness(1.1)' } },
  { id: 'art_frost',      label: 'Frost',     style: { filter: 'brightness(1.2) saturate(0.8) hue-rotate(200deg)' } },
  { id: 'negate',         label: 'Invert',    style: { filter: 'invert(1)' } },
];

const CROP_RATIOS = [
  { id: null,   label: 'Free' },
  { id: '16:9', label: '16:9' },
  { id: '9:16', label: '9:16' },
  { id: '1:1',  label: '1:1'  },
  { id: '4:3',  label: '4:3'  },
  { id: '3:4',  label: '3:4'  },
  { id: '21:9', label: '21:9' },
];

const TABS = [
  { id: 'adjust',    label: 'Adjust',    icon: Sliders },
  { id: 'filters',   label: 'Filters',   icon: Palette },
  { id: 'transform', label: 'Transform', icon: Crop    },
  { id: 'text',      label: 'Text',      icon: Type    },
];

// ─── Slider ───────────────────────────────────────────────────────────────────

function Slider({ icon: Icon, label, value, min, max, onChange, color = 'cyan' }) {
  const pct = ((value - min) / (max - min)) * 100;
  const colors = { cyan: '#2DD4BF', amber: '#fbbf24', purple: '#a78bfa', blue: '#60a5fa', green: '#34d399' };
  const accent = colors[color] || colors.cyan;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          {Icon && <Icon className="w-3.5 h-3.5 text-white/40" />}
          <span className="text-[11px] text-white/60 font-medium">{label}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-mono w-8 text-right" style={{ color: value !== 0 ? accent : 'rgba(255,255,255,0.3)' }}>
            {value > 0 ? `+${value}` : value}
          </span>
          {value !== 0 && (
            <button onClick={() => onChange(0)} className="text-white/20 hover:text-white/50">
              <RotateCcw className="w-2.5 h-2.5" />
            </button>
          )}
        </div>
      </div>
      <div className="relative h-1.5 bg-white/10 rounded-full cursor-pointer"
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          onChange(Math.round(min + (e.clientX - rect.left) / rect.width * (max - min)));
        }}
      >
        {min < 0 && <div className="absolute top-0 bottom-0 w-px bg-white/20" style={{ left: `${(0-min)/(max-min)*100}%` }} />}
        <div className="absolute top-0 h-full rounded-full" style={{
          left: min < 0 ? `${Math.min(50,pct)}%` : '0%',
          width: min < 0 ? `${Math.abs(pct-50)}%` : `${pct}%`,
          background: accent, opacity: 0.8,
        }} />
        <input type="range" min={min} max={max} value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="absolute inset-0 w-full opacity-0 cursor-pointer h-full"
        />
        <div className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full border-2 border-white shadow-sm"
          style={{ left: `calc(${pct}% - 6px)`, background: accent }}
        />
      </div>
    </div>
  );
}

// ─── Tabs ─────────────────────────────────────────────────────────────────────

function AdjustTab({ edits, onChange }) {
  const set = (key) => (val) => onChange({ ...edits, [key]: val });
  return (
    <div className="space-y-4 p-4">
      <Slider icon={Sun}      label="Brightness" value={edits.brightness} min={-100} max={100} onChange={set('brightness')} color="amber"  />
      <Slider icon={Contrast} label="Contrast"   value={edits.contrast}   min={-100} max={100} onChange={set('contrast')}   color="blue"   />
      <Slider icon={Droplets} label="Saturation" value={edits.saturation} min={-100} max={100} onChange={set('saturation')} color="cyan"   />
      <Slider icon={Zap}      label="Exposure"   value={edits.exposure}   min={-100} max={100} onChange={set('exposure')}   color="amber"  />
      <Slider icon={Eye}      label="Sharpness"  value={edits.sharpness}  min={0}    max={100} onChange={set('sharpness')}  color="green"  />
      <Slider icon={Wind}     label="Blur"       value={edits.blur}       min={0}    max={100} onChange={set('blur')}       color="purple" />
      <Slider icon={Circle}   label="Vignette"   value={edits.vignette}   min={0}    max={100} onChange={set('vignette')}   color="purple" />
    </div>
  );
}

function FiltersTab({ edits, onChange, previewSrc }) {
  return (
    <div className="p-4">
      <div className="grid grid-cols-3 gap-2">
        {FILTERS.map((f) => (
          <button key={String(f.id)} onClick={() => onChange({ ...edits, filter: f.id })}
            className={`flex flex-col items-center gap-1.5 p-1.5 rounded-xl border transition-all ${
              edits.filter === f.id ? 'border-cyan-500/60 bg-cyan-500/10' : 'border-white/8 hover:border-white/20 bg-white/3'
            }`}
          >
            <div className="w-full aspect-square rounded-lg overflow-hidden bg-[#0A0F1E]">
              {previewSrc
                ? <img src={previewSrc} alt={f.label} className="w-full h-full object-cover" style={f.style} />
                : <div className="w-full h-full" style={{ background: 'linear-gradient(135deg,#1B2A4A,#0A0F1E)', ...f.style }} />
              }
            </div>
            <span className={`text-[10px] font-medium ${edits.filter === f.id ? 'text-cyan-400' : 'text-white/40'}`}>{f.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function TransformTab({ edits, onChange }) {
  const rotate = (deg) => onChange({ ...edits, rotate: ((edits.rotate || 0) + deg + 360) % 360 });
  return (
    <div className="p-4 space-y-5">
      <div>
        <p className="text-[10px] uppercase tracking-wider text-white/30 font-semibold mb-2">Rotate</p>
        <div className="flex gap-2">
          <button onClick={() => rotate(-90)} className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/60 hover:text-white text-xs transition-all">
            <RotateCcw className="w-4 h-4" /> −90°
          </button>
          <div className="flex-shrink-0 flex items-center justify-center w-16 text-sm font-mono text-cyan-400">{edits.rotate || 0}°</div>
          <button onClick={() => rotate(90)} className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/60 hover:text-white text-xs transition-all">
            <RotateCw className="w-4 h-4" /> +90°
          </button>
        </div>
      </div>
      <div>
        <p className="text-[10px] uppercase tracking-wider text-white/30 font-semibold mb-2">Flip</p>
        <div className="flex gap-2">
          {[
            { key: 'flipH', Icon: FlipHorizontal, label: 'Horizontal' },
            { key: 'flipV', Icon: FlipVertical,   label: 'Vertical'   },
          ].map(({ key, Icon, label }) => (
            <button key={key} onClick={() => onChange({ ...edits, [key]: !edits[key] })}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl border text-xs transition-all ${
                edits[key] ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-400' : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10'
              }`}
            >
              <Icon className="w-4 h-4" /> {label}
            </button>
          ))}
        </div>
      </div>
      <div>
        <p className="text-[10px] uppercase tracking-wider text-white/30 font-semibold mb-2">Crop Ratio</p>
        <div className="grid grid-cols-4 gap-1.5">
          {CROP_RATIOS.map((r) => (
            <button key={String(r.id)} onClick={() => onChange({ ...edits, crop: r.id ? { aspectRatio: r.id } : null })}
              className={`py-2 rounded-lg border text-[10px] font-medium transition-all ${
                (edits.crop?.aspectRatio || null) === r.id
                  ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-400'
                  : 'bg-white/5 border-white/10 text-white/40 hover:border-white/20'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function TextTab({ edits, onChange }) {
  const text = edits.text || { content: '', font: 'Arial', size: 48, color: '#FFFFFF', gravity: 'south' };
  const set  = (key) => (val) => onChange({ ...edits, text: { ...text, [key]: val } });
  const FONTS = ['Arial', 'Impact', 'Georgia', 'Courier', 'Verdana', 'Trebuchet MS'];
  const hasText = text.content?.trim().length > 0;
  return (
    <div className="p-4 space-y-4">
      <div>
        <label className="block text-[10px] uppercase tracking-wider text-white/30 font-semibold mb-1.5">Text Content</label>
        <textarea value={text.content} onChange={(e) => set('content')(e.target.value)}
          placeholder="Type your text here…" rows={2}
          className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-white/20 focus:outline-none focus:border-cyan-500/40 resize-none"
        />
      </div>
      {hasText && (
        <>
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-white/30 font-semibold mb-1.5">Font</label>
            <div className="grid grid-cols-2 gap-1.5">
              {FONTS.map((f) => (
                <button key={f} onClick={() => set('font')(f)}
                  className={`py-1.5 rounded-lg border text-xs transition-all ${text.font === f ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-400' : 'bg-white/5 border-white/10 text-white/50 hover:border-white/20'}`}
                  style={{ fontFamily: f }}
                >{f}</button>
              ))}
            </div>
          </div>
          <Slider label="Size" value={text.size || 48} min={12} max={120} onChange={set('size')} color="cyan" />
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-white/30 font-semibold mb-1.5">Color</label>
            <div className="flex items-center gap-2">
              <input type="color" value={text.color || '#FFFFFF'} onChange={(e) => set('color')(e.target.value)}
                className="w-10 h-8 rounded cursor-pointer border border-white/20 bg-transparent"
              />
              <span className="text-xs font-mono text-white/40">{text.color || '#FFFFFF'}</span>
            </div>
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-white/30 font-semibold mb-1.5">Position</label>
            <div className="flex gap-1.5">
              {[{ id: 'north', label: 'Top' }, { id: 'center', label: 'Center' }, { id: 'south', label: 'Bottom' }].map((g) => (
                <button key={g.id} onClick={() => set('gravity')(g.id)}
                  className={`flex-1 py-1.5 rounded-lg border text-xs transition-all ${text.gravity === g.id ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-400' : 'bg-white/5 border-white/10 text-white/50 hover:border-white/20'}`}
                >{g.label}</button>
              ))}
            </div>
          </div>
          <button onClick={() => onChange({ ...edits, text: null })}
            className="w-full py-1.5 rounded-lg border border-red-500/30 text-red-400 text-xs hover:bg-red-500/10 transition-colors"
          >Remove Text</button>
        </>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function AssetEditorModal({ asset, onClose, onSaved }) {
  const [edits, setEdits]               = useState({ ...DEFAULT_EDITS });
  const [activeTab, setActiveTab]       = useState('adjust');
  const [saving, setSaving]             = useState(false);
  const [showSaveDialog, setShowSaveDialog] = useState(false);

  const hasChanges = JSON.stringify(edits) !== JSON.stringify(DEFAULT_EDITS);
  const mediaUrl   = asset.cloudinarySecureUrl || asset.cloudinaryUrl;
  const isVideo    = asset.type === 'VIDEO';

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape' && !showSaveDialog) onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose, showSaveDialog]);

  const cssPreview = {
    filter: [
      edits.brightness !== 0 ? `brightness(${1 + edits.brightness / 100})` : '',
      edits.contrast   !== 0 ? `contrast(${1 + edits.contrast / 100})`     : '',
      edits.saturation !== 0 ? `saturate(${1 + edits.saturation / 100})`   : '',
      edits.blur       >   0 ? `blur(${edits.blur * 0.1}px)`               : '',
      ...(FILTERS.find(f => f.id === edits.filter)?.style?.filter ? [FILTERS.find(f => f.id === edits.filter).style.filter] : []),
    ].filter(Boolean).join(' ') || 'none',
    transform: [
      edits.rotate ? `rotate(${edits.rotate}deg)` : '',
      edits.flipH  ? 'scaleX(-1)' : '',
      edits.flipV  ? 'scaleY(-1)' : '',
    ].filter(Boolean).join(' ') || 'none',
  };

  const handleSaveClick = () => {
    if (!hasChanges) { onClose(); return; }
    setShowSaveDialog(true);
  };

  const handleConfirmSave = async ({ mode, newName }) => {
    setSaving(true);
    const toastId = toast.loading(mode === 'replace' ? 'Replacing original file…' : 'Saving new copy…');
    try {
      const response = await api.post(`/media/${asset.id}/edit`, { edits, mode, newName });
      const { asset: savedAsset, mode: savedMode } = response.data.data;
      toast.success(
        savedMode === 'replace'
          ? 'Original file updated successfully!'
          : `Saved as "${savedAsset.name}" in your media library!`,
        { id: toastId }
      );
      setShowSaveDialog(false);
      onSaved?.(savedAsset, savedMode);
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save edits', { id: toastId });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-[#060C18] flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-[#0D1526] border-b border-white/10 flex-shrink-0">
          <div className="flex items-center gap-3">
            <button onClick={onClose} className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition-colors">
              <X className="w-4 h-4" />
            </button>
            <div>
              <p className="text-sm font-semibold text-white">Edit — {asset.name}</p>
              <p className="text-[11px] text-white/30">{asset.type}{asset.width ? ` · ${asset.width}×${asset.height}` : ''}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {hasChanges && (
              <button onClick={() => setEdits({ ...DEFAULT_EDITS })}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/5 text-xs transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" /> Reset
              </button>
            )}
            <button onClick={handleSaveClick} disabled={saving}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/40 text-cyan-400 text-sm font-medium transition-all disabled:opacity-50"
            >
              {saving
                ? <><RefreshCw className="w-4 h-4 animate-spin" /> Saving…</>
                : <><Check className="w-4 h-4" /> Save</>
              }
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex flex-1 overflow-hidden">
          {/* Preview */}
          <div className="flex-1 bg-[#060C18] flex items-center justify-center overflow-hidden relative">
            {isVideo
              ? <video src={mediaUrl} controls className="max-w-full max-h-full" style={{ maxHeight: '80vh', ...cssPreview }} />
              : <img src={mediaUrl} alt={asset.name} className="max-w-full max-h-full object-contain"
                  style={{ maxHeight: '80vh', ...cssPreview, transition: 'filter 0.15s, transform 0.15s' }}
                />
            }
            {hasChanges && (
              <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-cyan-500/20 border border-cyan-500/30 rounded-lg px-2.5 py-1">
                <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                <span className="text-[11px] text-cyan-400 font-medium">Edits applied</span>
              </div>
            )}
          </div>

          {/* Right panel */}
          <div className="w-72 bg-[#0D1526] border-l border-white/8 flex flex-col flex-shrink-0">
            {/* Tab bar */}
            <div className="flex border-b border-white/8">
              {TABS.map(({ id, label, icon: Icon }) => (
                <button key={id} onClick={() => setActiveTab(id)}
                  className={`flex-1 flex flex-col items-center gap-1 py-2.5 text-[10px] font-medium transition-colors border-b-2 ${
                    activeTab === id ? 'border-cyan-500 text-cyan-400' : 'border-transparent text-white/30 hover:text-white/60'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {label}
                </button>
              ))}
            </div>

            {/* Tab content */}
            <div className="flex-1 overflow-y-auto scrollbar-hide">
              {activeTab === 'adjust'    && <AdjustTab    edits={edits} onChange={setEdits} />}
              {activeTab === 'filters'   && <FiltersTab   edits={edits} onChange={setEdits} previewSrc={mediaUrl} />}
              {activeTab === 'transform' && <TransformTab edits={edits} onChange={setEdits} />}
              {activeTab === 'text'      && <TextTab      edits={edits} onChange={setEdits} />}
            </div>

            <div className="p-3 border-t border-white/8 text-center">
              <p className="text-[10px] text-white/20 leading-relaxed">
                Preview updates instantly. Saving creates a new copy or replaces the original.
              </p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Save dialog — rendered as sibling, outside the editor motion.div */}
      {showSaveDialog && (
        <SaveOptionsDialog
          asset={asset}
          saving={saving}
          onConfirm={handleConfirmSave}
          onCancel={() => setShowSaveDialog(false)}
        />
      )}
      
    </>
  );
}