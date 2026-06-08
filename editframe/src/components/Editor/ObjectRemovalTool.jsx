import { useState, useRef, useEffect, useCallback } from 'react';
import { Eraser, RotateCcw, Check, RefreshCw, Brush, Minus, Plus, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../services/api.service.js';
import SaveOptionsDialog from './SaveOptionsDialog.jsx';

const PHASE = {
  IDLE:     'idle',      // nothing painted yet
  PAINTED:  'painted',   // user has painted some mask
  REMOVING: 'removing',  // LaMa running
  DONE:     'done',
};

export default function ObjectRemovalTool({ asset, onSaved }) {
  const baseRef    = useRef(null);   // displays the image
  const maskRef    = useRef(null);   // black/white mask (sent to backend)
  const overlayRef = useRef(null);   // red visual overlay (what user sees)

  const [phase, setPhase]       = useState(PHASE.IDLE);
  const [brushSize, setBrushSize] = useState(40);
  const [showSave, setShowSave] = useState(false);
  const [saving, setSaving]     = useState(false);
  const [dims, setDims]         = useState({ w: 1, h: 1 });

  const drawing = useRef(false);
  const lastPt  = useRef(null);

  // ── Load image ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const base = baseRef.current, mask = maskRef.current, overlay = overlayRef.current;
    if (!base || !mask || !overlay) return;

    const img = new window.Image();
    img.crossOrigin = 'anonymous';
    img.src = asset.cloudinarySecureUrl || asset.cloudinaryUrl;

    img.onload = () => {
      const parent = base.parentElement;
      const maxW   = parent ? parent.clientWidth  - 32 : 600;
      const maxH   = parent ? parent.clientHeight - 32 : 420;
      const ratio  = Math.min(maxW / img.width, maxH / img.height, 1);
      const w = Math.round(img.width * ratio);
      const h = Math.round(img.height * ratio);

      base.width = mask.width = overlay.width = w;
      base.height = mask.height = overlay.height = h;
      setDims({ w, h });

      base.getContext('2d').drawImage(img, 0, 0, w, h);

      // Mask starts fully black (keep everything)
      const mctx = mask.getContext('2d');
      mctx.fillStyle = '#000000';
      mctx.fillRect(0, 0, w, h);
    };
  }, [asset]);

  // ── Pointer → canvas coords ──────────────────────────────────────────────────
  const getPoint = (e) => {
    const base = baseRef.current;
    const rect = base.getBoundingClientRect();
    const sx   = base.width  / rect.width;
    const sy   = base.height / rect.height;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return { x: (clientX - rect.left) * sx, y: (clientY - rect.top) * sy };
  };

  // ── Paint a stroke ────────────────────────────────────────────────────────────
  const paint = useCallback((from, to) => {
    const mask    = maskRef.current;
    const overlay = overlayRef.current;
    if (!mask || !overlay) return;

    // White on the mask canvas (areas to remove)
    const mctx = mask.getContext('2d');
    mctx.strokeStyle = '#FFFFFF';
    mctx.fillStyle   = '#FFFFFF';
    mctx.lineWidth   = brushSize;
    mctx.lineCap     = 'round';
    mctx.lineJoin    = 'round';
    mctx.beginPath();
    mctx.moveTo(from.x, from.y);
    mctx.lineTo(to.x, to.y);
    mctx.stroke();
    mctx.beginPath();
    mctx.arc(to.x, to.y, brushSize / 2, 0, Math.PI * 2);
    mctx.fill();

    // Red on the visible overlay
    const octx = overlay.getContext('2d');
    octx.strokeStyle = 'rgba(239,68,68,0.55)';
    octx.fillStyle   = 'rgba(239,68,68,0.55)';
    octx.lineWidth   = brushSize;
    octx.lineCap     = 'round';
    octx.lineJoin    = 'round';
    octx.beginPath();
    octx.moveTo(from.x, from.y);
    octx.lineTo(to.x, to.y);
    octx.stroke();
    octx.beginPath();
    octx.arc(to.x, to.y, brushSize / 2, 0, Math.PI * 2);
    octx.fill();
  }, [brushSize]);

  const handleDown = useCallback((e) => {
    if (phase === PHASE.REMOVING || phase === PHASE.DONE) return;
    e.preventDefault();
    drawing.current = true;
    const pt = getPoint(e);
    lastPt.current = pt;
    paint(pt, pt);
    if (phase === PHASE.IDLE) setPhase(PHASE.PAINTED);
  }, [phase, paint]);

  const handleMove = useCallback((e) => {
    if (!drawing.current) return;
    e.preventDefault();
    const pt = getPoint(e);
    paint(lastPt.current, pt);
    lastPt.current = pt;
  }, [paint]);

  const handleUp = useCallback(() => {
    drawing.current = false;
    lastPt.current  = null;
  }, []);

  // ── Clear ─────────────────────────────────────────────────────────────────────
  const handleClear = useCallback(() => {
    const mask = maskRef.current, overlay = overlayRef.current;
    if (mask) {
      const mctx = mask.getContext('2d');
      mctx.fillStyle = '#000000';
      mctx.fillRect(0, 0, mask.width, mask.height);
    }
    if (overlay) overlay.getContext('2d').clearRect(0, 0, overlay.width, overlay.height);
    setPhase(PHASE.IDLE);
  }, []);

  // ── Confirm remove ──────────────────────────────────────────────────────────
  const handleConfirmRemove = useCallback(async ({ mode, newName }) => {
    setSaving(true);
    setPhase(PHASE.REMOVING);
    const toastId = toast.loading('Removing object with LaMa AI… (5–15s)');

    try {
      // Export the mask canvas as a PNG data URL
      const maskDataUrl = maskRef.current.toDataURL('image/png');

      const res = await api.post(`/media/${asset.id}/remove-object`, {
        maskDataUrl, mode, newName,
      });

      const { asset: saved, mode: savedMode } = res.data.data;
      toast.success(
        savedMode === 'replace' ? 'Object removed — original updated!' : `Saved as "${saved.name}"!`,
        { id: toastId }
      );
      setShowSave(false);
      setPhase(PHASE.DONE);
      onSaved?.(saved, savedMode);

    } catch (err) {
      toast.error(err.response?.data?.message || 'Removal failed. Please try again.', { id: toastId });
      setShowSave(false);
      setPhase(PHASE.PAINTED);
    } finally {
      setSaving(false);
    }
  }, [asset, onSaved]);

  const statusMsg = {
    [PHASE.IDLE]:     'Paint over the object you want to remove',
    [PHASE.PAINTED]:  'Looks good? Click "Remove Object". Paint more or Clear to adjust.',
    [PHASE.REMOVING]: 'LaMa is removing the object…',
    [PHASE.DONE]:     'Object removed successfully!',
  };

  const statusColor = {
    [PHASE.IDLE]:     'bg-white/20',
    [PHASE.PAINTED]:  'bg-cyan-400 animate-pulse',
    [PHASE.REMOVING]: 'bg-amber-400 animate-pulse',
    [PHASE.DONE]:     'bg-emerald-400',
  };

  return (
    <>
      <div className="flex flex-col h-full">

        {/* Status */}
        <div className="flex items-center gap-2.5 px-4 py-2.5 bg-[#0A0F1E] border-b border-white/8 flex-shrink-0">
          <div className={`w-2 h-2 rounded-full flex-shrink-0 ${statusColor[phase]}`} />
          <p className="text-xs text-white/60">{statusMsg[phase]}</p>
        </div>

        {/* Canvas */}
        <div className="flex-1 bg-[#060C18] flex items-center justify-center overflow-hidden p-4 relative">
          <div className="relative" style={{ lineHeight: 0 }}>
            <canvas ref={baseRef} className="block rounded-lg" style={{ maxWidth: '100%' }} />
            {/* Hidden mask canvas (not shown to user) */}
            <canvas ref={maskRef} className="hidden" />
            {/* Visible red overlay + pointer handlers */}
            <canvas
              ref={overlayRef}
              className="absolute inset-0 rounded-lg"
              style={{ cursor: phase === PHASE.REMOVING || phase === PHASE.DONE ? 'default' : 'crosshair', touchAction: 'none' }}
              onMouseDown={handleDown}
              onMouseMove={handleMove}
              onMouseUp={handleUp}
              onMouseLeave={handleUp}
              onTouchStart={handleDown}
              onTouchMove={handleMove}
              onTouchEnd={handleUp}
            />

            {phase === PHASE.REMOVING && (
              <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center gap-3 rounded-lg">
                <RefreshCw className="w-9 h-9 text-cyan-400 animate-spin" />
                <p className="text-sm text-white font-semibold">Removing object…</p>
                <p className="text-xs text-white/50">LaMa is filling the background</p>
              </div>
            )}

            {phase === PHASE.DONE && (
              <div className="absolute inset-0 bg-emerald-500/15 border-2 border-emerald-500/40 flex items-center justify-center rounded-lg">
                <div className="flex items-center gap-2 bg-[#0D1526]/90 px-4 py-2.5 rounded-xl border border-emerald-500/30">
                  <Check className="w-5 h-5 text-emerald-400" />
                  <span className="text-sm text-emerald-400 font-medium">Object removed</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Tools */}
        <div className="flex items-center gap-3 px-4 py-3 bg-[#0D1526] border-t border-white/8 flex-shrink-0">

          {/* Brush size */}
          <div className="flex items-center gap-2">
            <Brush className="w-4 h-4 text-white/40" />
            <button onClick={() => setBrushSize(s => Math.max(10, s - 10))}
              className="p-1 rounded text-white/40 hover:text-white hover:bg-white/10">
              <Minus className="w-3.5 h-3.5" />
            </button>
            <span className="text-xs font-mono text-white/60 w-7 text-center">{brushSize}</span>
            <button onClick={() => setBrushSize(s => Math.min(120, s + 10))}
              className="p-1 rounded text-white/40 hover:text-white hover:bg-white/10">
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="w-px h-6 bg-white/10" />

          {/* Clear */}
          {(phase === PHASE.PAINTED || phase === PHASE.DONE) && (
            <button onClick={phase === PHASE.DONE ? handleClear : handleClear}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-white/50 hover:text-white text-xs transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" /> Clear
            </button>
          )}

          <div className="flex-1" />

          {/* Remove */}
          {phase === PHASE.PAINTED && (
            <button onClick={() => setShowSave(true)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 text-red-400 text-sm font-semibold transition-all"
            >
              <Eraser className="w-4 h-4" /> Remove Object
            </button>
          )}

          {phase === PHASE.IDLE && (
            <span className="text-[11px] text-white/25">Brush over the object, then click Remove</span>
          )}

          {phase === PHASE.DONE && (
            <div className="flex items-center gap-2 text-emerald-400 text-sm font-medium">
              <Check className="w-4 h-4" /> Done
            </div>
          )}
        </div>
      </div>

      {showSave && (
        <SaveOptionsDialog
          asset={asset}
          saving={saving}
          onConfirm={handleConfirmRemove}
          onCancel={() => setShowSave(false)}
        />
      )}
    </>
  );
}