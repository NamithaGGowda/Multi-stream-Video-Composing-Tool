// ─────────────────────────────────────────────────────────────────────────────
// src/components/Editor/SaveOptionsDialog.jsx
// Dialog that asks the user how they want to save their edits:
//   - Replace original (overwrites the existing Cloudinary asset)
//   - Save as new copy (creates a new asset, original untouched)
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from 'react';
import { motion } from 'framer-motion';
import { RefreshCw, FilePlus, AlertTriangle, Check, X } from 'lucide-react';

export default function SaveOptionsDialog({ asset, onConfirm, onCancel, saving }) {
  const [mode, setMode]         = useState('new');
  const [newName, setNewName]   = useState(() => {
    const base = asset.name.replace(/\.[^.]+$/, '');
    const ext  = asset.name.match(/\.[^.]+$/)?.[0] || '';
    return `${base}_edited${ext}`;
  });

  const handleConfirm = () => {
    onConfirm({ mode, newName: mode === 'new' ? newName : undefined });
  };

  return (
    // Backdrop
    <div className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <motion.div
        initial={{ scale: 0.92, opacity: 0, y: 12 }}
        animate={{ scale: 1,    opacity: 1, y: 0  }}
        exit={{    scale: 0.92, opacity: 0, y: 12 }}
        transition={{ type: 'spring', damping: 25, stiffness: 320 }}
        className="bg-[#0D1526] border border-white/10 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden"
        style={{ boxShadow: '0 0 60px rgba(45,212,191,0.08), 0 20px 40px rgba(0,0,0,0.6)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/8">
          <h2 className="text-sm font-semibold text-white">Save Edited File</h2>
          <button onClick={onCancel} className="p-1.5 rounded-lg text-white/30 hover:text-white hover:bg-white/10 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Options */}
        <div className="p-5 space-y-3">

          {/* Option 1 — Save as new copy */}
          <button
            onClick={() => setMode('new')}
            className={`w-full text-left p-4 rounded-xl border transition-all ${
              mode === 'new'
                ? 'bg-cyan-500/10 border-cyan-500/40'
                : 'bg-white/3 border-white/8 hover:border-white/20 hover:bg-white/5'
            }`}
          >
            <div className="flex items-start gap-3">
              <div className={`p-2 rounded-lg mt-0.5 flex-shrink-0 ${mode === 'new' ? 'bg-cyan-500/20 text-cyan-400' : 'bg-white/8 text-white/40'}`}>
                <FilePlus className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <p className={`text-sm font-medium ${mode === 'new' ? 'text-cyan-400' : 'text-white/70'}`}>
                    Save as new copy
                  </p>
                  {mode === 'new' && (
                    <div className="w-4 h-4 rounded-full bg-cyan-500 flex items-center justify-center flex-shrink-0">
                      <Check className="w-2.5 h-2.5 text-white" />
                    </div>
                  )}
                </div>
                <p className="text-[11px] text-white/35 mt-0.5 leading-relaxed">
                  Creates a new file. Your original <span className="text-white/50 font-medium">"{asset.name}"</span> stays untouched.
                </p>
              </div>
            </div>

            {/* New name input */}
            {mode === 'new' && (
              <div className="mt-3 ml-11">
                <label className="block text-[10px] text-white/30 uppercase tracking-wider mb-1">File name</label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder-white/20 focus:outline-none focus:border-cyan-500/40 transition-colors"
                  placeholder="Enter file name…"
                />
              </div>
            )}
          </button>

          {/* Option 2 — Replace original */}
          <button
            onClick={() => setMode('replace')}
            className={`w-full text-left p-4 rounded-xl border transition-all ${
              mode === 'replace'
                ? 'bg-amber-500/10 border-amber-500/40'
                : 'bg-white/3 border-white/8 hover:border-white/20 hover:bg-white/5'
            }`}
          >
            <div className="flex items-start gap-3">
              <div className={`p-2 rounded-lg mt-0.5 flex-shrink-0 ${mode === 'replace' ? 'bg-amber-500/20 text-amber-400' : 'bg-white/8 text-white/40'}`}>
                <RefreshCw className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <p className={`text-sm font-medium ${mode === 'replace' ? 'text-amber-400' : 'text-white/70'}`}>
                    Replace original
                  </p>
                  {mode === 'replace' && (
                    <div className="w-4 h-4 rounded-full bg-amber-500 flex items-center justify-center flex-shrink-0">
                      <Check className="w-2.5 h-2.5 text-white" />
                    </div>
                  )}
                </div>
                <p className="text-[11px] text-white/35 mt-0.5 leading-relaxed">
                  Overwrites <span className="text-white/50 font-medium">"{asset.name}"</span> in Cloudinary. This cannot be undone.
                </p>
              </div>
            </div>

            {/* Warning */}
            {mode === 'replace' && (
              <div className="mt-3 ml-11 flex items-start gap-2 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 mt-0.5" />
                <p className="text-[11px] text-amber-300/70 leading-relaxed">
                  The original file will be permanently overwritten in Cloudinary. Any other projects using this file will see the edited version.
                </p>
              </div>
            )}
          </button>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 pb-5">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/50 hover:text-white/80 text-sm transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={saving || (mode === 'new' && !newName.trim())}
            className={`flex items-center gap-2 px-5 py-2 rounded-xl border text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
              mode === 'replace'
                ? 'bg-amber-500/20 hover:bg-amber-500/30 border-amber-500/40 text-amber-400'
                : 'bg-cyan-500/20 hover:bg-cyan-500/30 border-cyan-500/40 text-cyan-400'
            }`}
          >
            {saving ? (
              <><RefreshCw className="w-4 h-4 animate-spin" /> Saving…</>
            ) : (
              <><Check className="w-4 h-4" /> {mode === 'replace' ? 'Replace' : 'Save Copy'}</>
            )}
          </button>
        </div>
      </motion.div>
    </div>
    
  );
}