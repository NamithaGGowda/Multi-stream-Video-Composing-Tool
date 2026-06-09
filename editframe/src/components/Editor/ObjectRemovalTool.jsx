import { useState, useRef, useEffect, useCallback } from 'react';
import { Eraser, RotateCcw, Check, RefreshCw, Brush, Minus, Plus, Trash2, MousePointerClick, Wand2 } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../services/api.service.js';
import SaveOptionsDialog from './SaveOptionsDialog.jsx';

const PHASE = { IDLE: 'idle', PAINTED: 'painted', DETECTING: 'detecting', REMOVING: 'removing', DONE: 'done' };
const TOOL  = { DETECT: 'detect', BRUSH: 'brush', ERASE: 'erase' };

export default function ObjectRemovalTool({ asset, onSaved }) {
  const baseRef    = useRef(null);
  const overlayRef = useRef(null);

  const [phase, setPhase]       = useState(PHASE.IDLE);
  const [tool, setTool]         = useState(TOOL.DETECT);
  const [brushSize, setBrushSize] = useState(40);
  const [showSave, setShowSave] = useState(false);
  const [saving, setSaving]     = useState(false);
  const [dims, setDims]         = useState({ w: 1, h: 1 });

  const drawing = useRef(false);
  const lastPt  = useRef(null);

  // ── Load image ───────────────────────────────────────────────────────────
  useEffect(() => {
    const base = baseRef.current, overlay = overlayRef.current;
    if (!base || !overlay) return;
    const img = new window.Image();
    img.crossOrigin = 'anonymous';
    img.src = asset.cloudinarySecureUrl || asset.cloudinaryUrl;
    img.onload = () => {
      const parent = base.parentElement;
      const maxW = parent ? parent.clientWidth - 32 : 600;
      const maxH = parent ? parent.clientHeight - 32 : 420;
      const ratio = Math.min(maxW / img.width, maxH / img.height, 1);
      const w = Math.round(img.width * ratio);
      const h = Math.round(img.height * ratio);
      base.width = overlay.width = w;
      base.height = overlay.height = h;
      setDims({ w, h });
      base.getContext('2d').drawImage(img, 0, 0, w, h);
    };
  }, [asset]);

  const getPoint = (e) => {
    const base = baseRef.current;
    const rect = base.getBoundingClientRect();
    const sx = base.width / rect.width, sy = base.height / rect.height;
    const cx = e.touches ? e.touches[0].clientX : e.clientX;
    const cy = e.touches ? e.touches[0].clientY : e.clientY;
    return { x: (cx - rect.left) * sx, y: (cy - rect.top) * sy };
  };

  // ── Paint / erase a stroke on the overlay ─────────────────────────────────
  const stroke = useCallback((from, to, erase) => {
    const overlay = overlayRef.current;
    const ctx = overlay.getContext('2d');
    ctx.globalCompositeOperation = erase ? 'destination-out' : 'source-over';
    ctx.strokeStyle = 'rgba(239,68,68,0.55)';
    ctx.fillStyle   = 'rgba(239,68,68,0.55)';
    ctx.lineWidth = brushSize; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(from.x, from.y); ctx.lineTo(to.x, to.y); ctx.stroke();
    ctx.beginPath(); ctx.arc(to.x, to.y, brushSize/2, 0, Math.PI*2); ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
  }, [brushSize]);

  // ── Detect with MobileSAM ──────────────────────────────────────────────────
  const detectAt = useCallback(async (pt) => {
    const base = baseRef.current;
    setPhase(PHASE.DETECTING);
    try {
      const res = await api.post(`/media/${asset.id}/detect-object`, {
        x: pt.x / base.width,
        y: pt.y / base.height,
      });
      const { maskDataUrl } = res.data.data;

      // Paint the detected mask onto the overlay (additive, so it's editable)
      const maskImg = new window.Image();
      maskImg.onload = () => {
        const off = document.createElement('canvas');
        off.width = base.width; off.height = base.height;
        const octx = off.getContext('2d');
        octx.drawImage(maskImg, 0, 0, base.width, base.height);
        const md = octx.getImageData(0, 0, base.width, base.height).data;

        const overlay = overlayRef.current;
        const ctx = overlay.getContext('2d');
        const cur = ctx.getImageData(0, 0, overlay.width, overlay.height);
        for (let i = 0; i < md.length; i += 4) {
          if (md[i] > 127) { // white = detected
            cur.data[i] = 239; cur.data[i+1] = 68; cur.data[i+2] = 68; cur.data[i+3] = 140;
          }
        }
        ctx.putImageData(cur, 0, 0);
        setPhase(PHASE.PAINTED);
        toast.success('Object detected — refine with brush/erase, then Remove');
      };
      maskImg.src = maskDataUrl;
    } catch (err) {
      setPhase(PHASE.PAINTED);
      toast.error(err.response?.data?.message || 'Detection failed. Try another spot or use the brush.');
    }
  }, [asset]);

  // ── Pointer handlers ────────────────────────────────────────────────────────
  const handleDown = useCallback((e) => {
    if (phase === PHASE.REMOVING || phase === PHASE.DETECTING || phase === PHASE.DONE) return;
    e.preventDefault();
    const pt = getPoint(e);
    if (tool === TOOL.DETECT) {
      detectAt(pt);
      return;
    }
    drawing.current = true;
    lastPt.current = pt;
    stroke(pt, pt, tool === TOOL.ERASE);
    if (phase === PHASE.IDLE) setPhase(PHASE.PAINTED);
  }, [phase, tool, detectAt, stroke]);

  const handleMove = useCallback((e) => {
    if (!drawing.current) return;
    e.preventDefault();
    const pt = getPoint(e);
    stroke(lastPt.current, pt, tool === TOOL.ERASE);
    lastPt.current = pt;
  }, [tool, stroke]);

  const handleUp = useCallback(() => { drawing.current = false; lastPt.current = null; }, []);

  const handleClear = useCallback(() => {
    const overlay = overlayRef.current;
    if (overlay) overlay.getContext('2d').clearRect(0, 0, overlay.width, overlay.height);
    setPhase(PHASE.IDLE);
  }, []);

  // ── Confirm remove ──────────────────────────────────────────────────────────
  const handleConfirmRemove = useCallback(async ({ mode, newName }) => {
    setSaving(true);
    setPhase(PHASE.REMOVING);
    const toastId = toast.loading('Removing object with LaMa AI…');
    try {
      const overlay = overlayRef.current;
      const oImg = overlay.getContext('2d').getImageData(0, 0, overlay.width, overlay.height);
      const maskCanvas = document.createElement('canvas');
      maskCanvas.width = overlay.width; maskCanvas.height = overlay.height;
      const mCtx = maskCanvas.getContext('2d');
      const mImg = mCtx.createImageData(overlay.width, overlay.height);
      let painted = 0;
      for (let i = 0; i < oImg.data.length; i += 4) {
        const on = oImg.data[i+3] > 10;
        if (on) painted++;
        const v = on ? 255 : 0;
        mImg.data[i] = v; mImg.data[i+1] = v; mImg.data[i+2] = v; mImg.data[i+3] = 255;
      }
      mCtx.putImageData(mImg, 0, 0);
      if (painted === 0) {
        toast.error('Select or paint an object first', { id: toastId });
        setShowSave(false); setPhase(PHASE.PAINTED); setSaving(false); return;
      }

      const res = await api.post(`/media/${asset.id}/remove-object`, {
        maskDataUrl: maskCanvas.toDataURL('image/png'), mode, newName,
      });
      const { asset: saved, mode: savedMode } = res.data.data;
      toast.success(savedMode === 'replace' ? 'Object removed — original updated!' : `Saved as "${saved.name}"!`, { id: toastId });
      setShowSave(false); setPhase(PHASE.DONE);
      onSaved?.(saved, savedMode);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Removal failed. Please try again.', { id: toastId });
      setShowSave(false); setPhase(PHASE.PAINTED);
    } finally {
      setSaving(false);
    }
  }, [asset, onSaved]);

  const statusMsg = {
    [PHASE.IDLE]:      tool === TOOL.DETECT ? 'Click on an object to auto-detect it' : 'Paint over the object to remove',
    [PHASE.DETECTING]: 'MobileSAM is detecting the object…',
    [PHASE.PAINTED]:   'Refine with brush (add) or erase (subtract), then Remove Object',
    [PHASE.REMOVING]:  'LaMa is removing the object…',
    [PHASE.DONE]:      'Object removed successfully!',
  };
  const dot = {
    [PHASE.IDLE]: 'bg-white/20', [PHASE.DETECTING]: 'bg-blue-400 animate-pulse',
    [PHASE.PAINTED]: 'bg-cyan-400 animate-pulse', [PHASE.REMOVING]: 'bg-amber-400 animate-pulse',
    [PHASE.DONE]: 'bg-emerald-400',
  };

  const busy = phase === PHASE.DETECTING || phase === PHASE.REMOVING || phase === PHASE.DONE;

  const ToolBtn = ({ id, icon: Icon, label }) => (
    <button onClick={() => setTool(id)}
      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs transition-all ${
        tool === id ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-400' : 'bg-white/5 border-white/10 text-white/50 hover:text-white hover:bg-white/10'
      }`}
    >
      <Icon className="w-3.5 h-3.5" /> {label}
    </button>
  );

  return (
    <>
      <div className="flex flex-col h-full">
        {/* Status */}
        <div className="flex items-center gap-2.5 px-4 py-2.5 bg-[#0A0F1E] border-b border-white/8 flex-shrink-0">
          <div className={`w-2 h-2 rounded-full flex-shrink-0 ${dot[phase]}`} />
          <p className="text-xs text-white/60">{statusMsg[phase]}</p>
        </div>

        {/* Canvas */}
        <div className="flex-1 bg-[#060C18] flex items-center justify-center overflow-hidden p-4 relative">
          <div className="relative" style={{ lineHeight: 0 }}>
            <canvas ref={baseRef} className="block rounded-lg" style={{ maxWidth: '100%' }} />
            <canvas ref={overlayRef}
              className="absolute inset-0 rounded-lg"
              style={{ cursor: busy ? 'default' : (tool === TOOL.DETECT ? 'pointer' : 'crosshair'), touchAction: 'none', opacity: 0.85 }}
              onMouseDown={handleDown} onMouseMove={handleMove} onMouseUp={handleUp} onMouseLeave={handleUp}
              onTouchStart={handleDown} onTouchMove={handleMove} onTouchEnd={handleUp}
            />
            {phase === PHASE.DETECTING && (
              <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center gap-3 rounded-lg">
                <RefreshCw className="w-9 h-9 text-blue-400 animate-spin" />
                <p className="text-sm text-white font-semibold">MobileSAM detecting…</p>
              </div>
            )}
            {phase === PHASE.REMOVING && (
              <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center gap-3 rounded-lg">
                <RefreshCw className="w-9 h-9 text-cyan-400 animate-spin" />
                <p className="text-sm text-white font-semibold">Removing object…</p>
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

        {/* Toolbar */}
        <div className="flex items-center gap-3 px-4 py-3 bg-[#0D1526] border-t border-white/8 flex-shrink-0 flex-wrap">
          {/* Tool modes */}
          <div className="flex items-center gap-1.5">
            <ToolBtn id={TOOL.DETECT} icon={Wand2}             label="Detect" />
            <ToolBtn id={TOOL.BRUSH}  icon={Brush}             label="Add" />
            <ToolBtn id={TOOL.ERASE}  icon={Eraser}            label="Erase" />
          </div>

          {/* Brush size (for add/erase) */}
          {tool !== TOOL.DETECT && (
            <>
              <div className="w-px h-6 bg-white/10" />
              <div className="flex items-center gap-2">
                <button onClick={() => setBrushSize(s => Math.max(10, s-10))} className="p-1 rounded text-white/40 hover:text-white hover:bg-white/10"><Minus className="w-3.5 h-3.5" /></button>
                <span className="text-xs font-mono text-white/60 w-7 text-center">{brushSize}</span>
                <button onClick={() => setBrushSize(s => Math.min(120, s+10))} className="p-1 rounded text-white/40 hover:text-white hover:bg-white/10"><Plus className="w-3.5 h-3.5" /></button>
              </div>
            </>
          )}

          <div className="w-px h-6 bg-white/10" />
          {(phase === PHASE.PAINTED || phase === PHASE.DONE) && (
            <button onClick={handleClear} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-white/50 hover:text-white text-xs transition-colors">
              <Trash2 className="w-3.5 h-3.5" /> Clear
            </button>
          )}

          <div className="flex-1" />

          {phase === PHASE.PAINTED && (
            <button onClick={() => setShowSave(true)} className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 text-red-400 text-sm font-semibold transition-all">
              <Eraser className="w-4 h-4" /> Remove Object
            </button>
          )}
          {phase === PHASE.DONE && (
            <div className="flex items-center gap-2 text-emerald-400 text-sm font-medium"><Check className="w-4 h-4" /> Done</div>
          )}
        </div>
      </div>

      {showSave && (
        <SaveOptionsDialog asset={asset} saving={saving} onConfirm={handleConfirmRemove} onCancel={() => setShowSave(false)} />
      )}
    </>
  );
}