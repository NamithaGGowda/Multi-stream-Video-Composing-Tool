import { useState, useCallback } from 'react';
import { Gauge, Rewind, Zap, ChevronRight, RotateCcw, Wind, Layers, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useEditorStore } from '../../store/editorStore';

// ─── Speed preset buttons ─────────────────────────────────────────────────────

const SPEED_PRESETS = [
  { label: '0.25×', value: 0.25, tag: 'Ultra Slow' },
  { label: '0.5×',  value: 0.5,  tag: 'Half'       },
  { label: '0.75×', value: 0.75, tag: 'Slow'        },
  { label: '1×',    value: 1,    tag: 'Normal'      },
  { label: '1.5×',  value: 1.5,  tag: 'Fast'        },
  { label: '2×',    value: 2,    tag: 'Double'      },
  { label: '4×',    value: 4,    tag: 'Quad'        },
  { label: '8×',    value: 8,    tag: 'Hyper'       },
];

const MOTION_BLUR_PRESETS = [
  { label: 'None',   value: 0   },
  { label: 'Light',  value: 25  },
  { label: 'Medium', value: 50  },
  { label: 'Heavy',  value: 80  },
  { label: 'Max',    value: 100 },
];

const RAMP_TYPES = [
  { id: 'linear',    label: 'Linear',     icon: '╱' },
  { id: 'ease-in',   label: 'Ease In',    icon: '⌒' },
  { id: 'ease-out',  label: 'Ease Out',   icon: '⌓' },
  { id: 'ease-both', label: 'Ease Both',  icon: '∿' },
  { id: 'custom',    label: 'Custom',     icon: '⋮' },
];

// ─── Speed dial visual ────────────────────────────────────────────────────────

function SpeedDial({ speed, onChange }) {
  const MIN_SPEED = 0.1;
  const MAX_SPEED = 10;
  const MIN_DEG   = -135;
  const MAX_DEG   = 135;

  const logMin = Math.log(MIN_SPEED);
  const logMax = Math.log(MAX_SPEED);
  const logVal = Math.log(Math.max(MIN_SPEED, Math.min(MAX_SPEED, speed)));
  const t      = (logVal - logMin) / (logMax - logMin);
  const deg    = MIN_DEG + t * (MAX_DEG - MIN_DEG);

  const speedColor =
    speed < 0.75  ? '#7B8CDE'   // slow  → lavender
    : speed < 1.1 ? '#2DD4BF'  // normal → cyan
    : speed < 4   ? '#fbbf24'  // fast  → amber
    : '#f87171';               // very fast → red

  const handleMouseDown = useCallback((e) => {
    const startY = e.clientY;
    const startSpeed = speed;

    const onMouseMove = (me) => {
      const delta = (startY - me.clientY) / 150;
      const logStart = Math.log(Math.max(MIN_SPEED, startSpeed));
      const newLog = Math.max(Math.log(MIN_SPEED), Math.min(Math.log(MAX_SPEED), logStart + delta));
      const newSpeed = Math.round(Math.exp(newLog) * 100) / 100;
      onChange(newSpeed);
    };

    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }, [speed, onChange]);

  return (
    <div className="flex flex-col items-center select-none">
      <div
        className="relative w-24 h-24 cursor-ns-resize"
        onMouseDown={handleMouseDown}
      >
        {/* Outer ring */}
        <svg viewBox="0 0 96 96" className="w-full h-full -rotate-90">
          {/* Track arc */}
          <circle
            cx="48" cy="48" r="38"
            fill="none"
            stroke="rgba(255,255,255,0.06)"
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={`${270 / 360 * 2 * Math.PI * 38} ${2 * Math.PI * 38}`}
            strokeDashoffset={`${-45 / 360 * 2 * Math.PI * 38}`}
          />
          {/* Filled arc */}
          <circle
            cx="48" cy="48" r="38"
            fill="none"
            stroke={speedColor}
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={`${t * 270 / 360 * 2 * Math.PI * 38} ${2 * Math.PI * 38}`}
            strokeDashoffset={`${-45 / 360 * 2 * Math.PI * 38}`}
            style={{ filter: `drop-shadow(0 0 6px ${speedColor}80)`, transition: 'all 0.1s' }}
          />
        </svg>

        {/* Inner dial face */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-14 h-14 rounded-full bg-[#0D1526] border border-white/10 flex flex-col items-center justify-center"
            style={{ boxShadow: `0 0 20px ${speedColor}20` }}
          >
            {/* Needle */}
            <div
              className="absolute"
              style={{
                transform: `rotate(${deg}deg)`,
                transformOrigin: '50% 100%',
                left: 'calc(50% - 1px)',
                bottom: '50%',
                height: '20px',
                width: '2px',
                transition: 'transform 0.1s, filter 0.1s',
              }}
            >
              <div className="w-full h-full rounded-full" style={{ background: speedColor, boxShadow: `0 0 4px ${speedColor}` }} />
            </div>

            <span className="text-[9px] text-ice-500 font-mono mt-5">SPEED</span>
          </div>
        </div>
      </div>

      {/* Speed value */}
      <div className="mt-2 text-center">
        <span
          className="text-2xl font-bold font-mono tabular-nums"
          style={{ color: speedColor, textShadow: `0 0 20px ${speedColor}50` }}
        >
          {speed.toFixed(2)}
        </span>
        <span className="text-sm text-ice-500 ml-0.5">×</span>
      </div>

      <p className="text-[10px] text-ice-500 mt-0.5">
        {speed < 0.5 ? 'Ultra slow motion' : speed < 0.9 ? 'Slow motion' : speed < 1.1 ? 'Normal speed' : speed < 3 ? 'Fast forward' : 'Hyperlapse'}
      </p>
    </div>
  );
}

// ─── Section wrapper ──────────────────────────────────────────────────────────

function Section({ title, icon: Icon, iconColor = 'text-cyan-400', children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="border border-white/5 rounded-lg overflow-hidden">
      <button
        className="w-full flex items-center gap-2 px-3 py-2.5 bg-white/3 hover:bg-white/5 transition-colors text-left"
        onClick={() => setOpen(!open)}
      >
        <Icon className={`w-3.5 h-3.5 ${iconColor} flex-shrink-0`} />
        <span className="text-[11px] font-semibold text-ice-200 flex-1">{title}</span>
        <ChevronRight className={`w-3 h-3 text-ice-500 transition-transform ${open ? 'rotate-90' : ''}`} />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: 'auto' }}
            exit={{ height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="p-3 pt-2 space-y-2.5">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function SpeedPanel() {
  const { clips, selectedClipIds, updateClip } = useEditorStore((s) => ({
    clips: s.clips,
    selectedClipIds: s.selectedClipIds,
    updateClip: s.updateClip,
  }));

  const selectedClip = clips.find(c => selectedClipIds.includes(c.id));

  const [speed, setSpeedLocal]       = useState(selectedClip?.speed ?? 1);
  const [reversed, setReversed]      = useState(selectedClip?.reversed ?? false);
  const [motionBlur, setMotionBlur]  = useState(selectedClip?.motionBlur ?? 0);
  const [rampType, setRampType]      = useState('linear');
  const [freezeAt, setFreezeAt]      = useState(selectedClip?.startTime ?? 0);
  const [freezeDur, setFreezeDur]    = useState(1);

  const applySpeed = useCallback((val) => {
    setSpeedLocal(val);
    if (selectedClip) updateClip(selectedClip.id, { speed: val });
  }, [selectedClip, updateClip]);

  const applyReverse = (val) => {
    setReversed(val);
    if (selectedClip) updateClip(selectedClip.id, { reversed: val });
  };

  const applyMotionBlur = (val) => {
    setMotionBlur(val);
    if (selectedClip) updateClip(selectedClip.id, { motionBlur: val });
  };

  const applyReset = () => {
    applySpeed(1);
    applyReverse(false);
    applyMotionBlur(0);
    setRampType('linear');
  };

  return (
    <div className="flex flex-col h-full text-ice-200">

      {/* Header */}
      <div className="px-3 pt-3 pb-2 border-b border-white/5">
        <div className="flex items-center gap-2">
          <Gauge className="w-4 h-4 text-cyan-400" />
          <span className="text-xs font-semibold text-ice-100 tracking-wide">Speed & Motion</span>
          {selectedClip && (
            <span className="ml-auto text-[10px] text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 px-1.5 py-0.5 rounded truncate max-w-[90px]">
              {selectedClip.label}
            </span>
          )}
        </div>

        {!selectedClip && (
          <div className="mt-2 flex items-start gap-1.5 text-[10px] text-ice-500 bg-white/3 border border-white/8 rounded-md px-2.5 py-2">
            <Info className="w-3 h-3 flex-shrink-0 mt-0.5 text-lavender-400" />
            <span>Select a clip on the timeline to adjust its speed and motion settings.</span>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-hide px-3 pb-4 pt-3 space-y-3">

        {/* ── Speed Dial ── */}
        <Section title="Playback Speed" icon={Gauge} defaultOpen>
          <div className="flex justify-center py-2">
            <SpeedDial speed={speed} onChange={applySpeed} />
          </div>

          {/* Fine slider */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="ef-label">Speed</label>
              <input
                type="number"
                min="0.1" max="10" step="0.05"
                value={speed}
                onChange={(e) => applySpeed(Math.max(0.1, Math.min(10, parseFloat(e.target.value) || 1)))}
                className="ef-input w-16 text-right text-[11px] py-0.5 px-1.5"
              />
            </div>
            <input
              type="range"
              min="0.1" max="10" step="0.05"
              value={speed}
              onChange={(e) => applySpeed(parseFloat(e.target.value))}
              className="ef-slider w-full"
            />
            <div className="flex justify-between text-[9px] text-ice-600 mt-0.5">
              <span>0.1×</span>
              <span>1×</span>
              <span>5×</span>
              <span>10×</span>
            </div>
          </div>

          {/* Presets */}
          <div>
            <label className="ef-label mb-1.5 block">Quick Presets</label>
            <div className="grid grid-cols-4 gap-1.5">
              {SPEED_PRESETS.map((p) => (
                <button
                  key={p.value}
                  onClick={() => applySpeed(p.value)}
                  className={`py-1.5 rounded-md text-[10px] font-mono font-semibold border transition-all ${
                    Math.abs(speed - p.value) < 0.01
                      ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-300'
                      : 'bg-white/5 border-white/10 text-ice-300 hover:bg-white/10 hover:border-white/20'
                  }`}
                  title={p.tag}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Duration impact */}
          {selectedClip && (
            <div className="bg-[#0D1526] border border-white/8 rounded-lg p-2.5 text-[10px]">
              <p className="text-ice-500 mb-1.5 font-semibold uppercase tracking-wider text-[9px]">Duration Impact</p>
              <div className="flex items-center justify-between">
                <span className="text-ice-400">Original</span>
                <span className="font-mono text-ice-200">{(selectedClip.duration || 5).toFixed(2)}s</span>
              </div>
              <div className="flex items-center justify-between mt-1">
                <span className="text-ice-400">At {speed.toFixed(2)}×</span>
                <span className="font-mono text-cyan-400">{((selectedClip.duration || 5) / speed).toFixed(2)}s</span>
              </div>
              <div className="h-px bg-white/5 my-1.5" />
              <div className="flex items-center justify-between">
                <span className="text-ice-500">Change</span>
                <span className={`font-mono ${speed > 1 ? 'text-amber-400' : speed < 1 ? 'text-blue-400' : 'text-ice-400'}`}>
                  {speed > 1 ? '-' : speed < 1 ? '+' : ''}
                  {Math.abs(((selectedClip.duration || 5) / speed) - (selectedClip.duration || 5)).toFixed(2)}s
                </span>
              </div>
            </div>
          )}
        </Section>

        {/* ── Speed Ramp ── */}
        <Section title="Speed Ramp" icon={Layers} iconColor="text-lavender-400">
          <p className="text-[10px] text-ice-500 leading-relaxed">
            Speed ramp eases the transition when speed changes throughout the clip.
          </p>
          <div className="grid grid-cols-5 gap-1.5">
            {RAMP_TYPES.map((r) => (
              <button
                key={r.id}
                onClick={() => setRampType(r.id)}
                className={`flex flex-col items-center gap-1 py-2 rounded-lg border transition-all ${
                  rampType === r.id
                    ? 'bg-lavender-500/20 border-lavender-500/50 text-lavender-300'
                    : 'bg-white/5 border-white/10 text-ice-400 hover:bg-white/10'
                }`}
              >
                <span className="text-base leading-none">{r.icon}</span>
                <span className="text-[9px] font-medium">{r.label}</span>
              </button>
            ))}
          </div>
        </Section>

        {/* ── Reverse ── */}
        <Section title="Reverse Clip" icon={Rewind} iconColor="text-blue-400">
          <p className="text-[10px] text-ice-500 leading-relaxed">
            Play the clip backwards from end to start. Works with speed control.
          </p>
          <div className="flex items-center justify-between bg-[#0D1526] border border-white/8 rounded-lg px-3 py-2.5">
            <div>
              <p className="text-[11px] font-medium text-ice-200">Reverse Playback</p>
              <p className="text-[10px] text-ice-500 mt-0.5">Play from end to beginning</p>
            </div>
            <button
              onClick={() => applyReverse(!reversed)}
              className={`relative w-10 h-5 rounded-full transition-colors duration-200 flex-shrink-0 ${
                reversed ? 'bg-blue-500' : 'bg-white/10'
              }`}
            >
              <span
                className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-200 ${
                  reversed ? 'translate-x-5' : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>

          {reversed && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-1.5 text-[10px] text-blue-400 bg-blue-500/10 border border-blue-500/20 rounded-md px-2.5 py-1.5"
            >
              <Rewind className="w-2.5 h-2.5 flex-shrink-0" />
              Clip will play in reverse
            </motion.div>
          )}
        </Section>

        {/* ── Motion Blur ── */}
        <Section title="Motion Blur" icon={Wind} iconColor="text-teal-400">
          <p className="text-[10px] text-ice-500 leading-relaxed">
            Add motion blur to simulate natural camera movement at high speed.
          </p>

          {/* Presets */}
          <div className="grid grid-cols-5 gap-1.5">
            {MOTION_BLUR_PRESETS.map((p) => (
              <button
                key={p.value}
                onClick={() => applyMotionBlur(p.value)}
                className={`py-1.5 rounded-md text-[10px] font-medium border transition-all ${
                  motionBlur === p.value
                    ? 'bg-teal-500/20 border-teal-500/50 text-teal-300'
                    : 'bg-white/5 border-white/10 text-ice-400 hover:bg-white/10'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Slider */}
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="ef-label">Blur Amount</label>
              <span className="text-[11px] font-mono text-teal-400">{motionBlur}</span>
            </div>
            <input
              type="range"
              min="0" max="100"
              value={motionBlur}
              onChange={(e) => applyMotionBlur(parseInt(e.target.value))}
              className="ef-slider w-full"
              style={{ '--slider-fill': '#2dd4bf' }}
            />
          </div>

          {/* Preview indicator */}
          <div
            className="h-8 rounded-md border border-white/10 overflow-hidden flex items-center justify-center relative"
            style={{
              background: 'linear-gradient(135deg, #1B2A4A, #0A0F1E)',
              filter: `blur(${motionBlur * 0.03}px)`,
            }}
          >
            <div className="flex gap-2 items-center">
              {[...Array(7)].map((_, i) => (
                <div
                  key={i}
                  className="w-2 h-2 rounded-full bg-cyan-400"
                  style={{
                    opacity: 1 - i * (motionBlur / 700),
                    transform: `translateX(${i * -motionBlur * 0.3}px)`,
                  }}
                />
              ))}
            </div>
            <p className="absolute bottom-0.5 right-1.5 text-[9px] text-ice-600 font-mono">preview</p>
          </div>
        </Section>

        {/* ── Freeze Frame ── */}
        <Section title="Freeze Frame" icon={Zap} iconColor="text-amber-400" defaultOpen={false}>
          <p className="text-[10px] text-ice-500 leading-relaxed">
            Insert a freeze frame at a specific timecode within the clip.
          </p>

          <div className="space-y-2">
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="ef-label">Freeze at (seconds)</label>
                <span className="text-[11px] font-mono text-amber-400">{freezeAt.toFixed(2)}s</span>
              </div>
              <input
                type="range"
                min={selectedClip?.startTime ?? 0}
                max={selectedClip ? (selectedClip.startTime + (selectedClip.duration || 5)) : 30}
                step="0.1"
                value={freezeAt}
                onChange={(e) => setFreezeAt(parseFloat(e.target.value))}
                className="ef-slider w-full"
              />
            </div>

            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="ef-label">Hold duration (seconds)</label>
                <span className="text-[11px] font-mono text-amber-400">{freezeDur.toFixed(1)}s</span>
              </div>
              <input
                type="range"
                min="0.1" max="10" step="0.1"
                value={freezeDur}
                onChange={(e) => setFreezeDur(parseFloat(e.target.value))}
                className="ef-slider w-full"
              />
            </div>

            <button className="w-full py-2 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-400 text-xs font-medium transition-colors">
              Insert Freeze Frame
            </button>
          </div>
        </Section>

        {/* ── Reset all ── */}
        <button
          onClick={applyReset}
          className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg bg-white/3 hover:bg-white/8 border border-white/8 text-ice-400 hover:text-ice-200 text-xs transition-colors"
        >
          <RotateCcw className="w-3 h-3" />
          Reset All Speed & Motion
        </button>
      </div>
    </div>
  );
}
