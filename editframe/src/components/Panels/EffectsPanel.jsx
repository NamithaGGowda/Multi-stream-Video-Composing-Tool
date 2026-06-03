import React, { useState } from 'react'
import { Sparkles, ChevronDown, Plus, SlidersHorizontal } from 'lucide-react'
import { useEditorStore } from '../../store/editorStore.js'

const EFFECT_CATEGORIES = {
  blur: {
    label: 'Blur & Depth',
    items: [
      { id: 'gaussian-blur', name: 'Gaussian Blur', params: [{ key: 'amount', label: 'Amount', min: 0, max: 50, default: 10 }] },
      { id: 'motion-blur', name: 'Motion Blur', params: [{ key: 'strength', label: 'Strength', min: 0, max: 100, default: 30 }, { key: 'angle', label: 'Angle', min: 0, max: 360, default: 90 }] },
      { id: 'bokeh', name: 'Bokeh DOF', params: [{ key: 'amount', label: 'Amount', min: 0, max: 100, default: 50 }, { key: 'focus', label: 'Focus Point', min: 0, max: 100, default: 50 }] },
      { id: 'radial-blur', name: 'Radial Blur', params: [{ key: 'amount', label: 'Intensity', min: 0, max: 100, default: 40 }] },
    ]
  },
  distort: {
    label: 'Distort',
    items: [
      { id: 'glitch', name: 'Glitch', params: [{ key: 'intensity', label: 'Intensity', min: 0, max: 100, default: 30 }, { key: 'speed', label: 'Speed', min: 0, max: 100, default: 50 }] },
      { id: 'chromatic-aberration', name: 'Chromatic', params: [{ key: 'amount', label: 'Amount', min: 0, max: 50, default: 8 }] },
      { id: 'lens-distortion', name: 'Lens Warp', params: [{ key: 'amount', label: 'Distortion', min: -100, max: 100, default: 0 }] },
      { id: 'wave', name: 'Wave', params: [{ key: 'amplitude', label: 'Amplitude', min: 0, max: 100, default: 20 }, { key: 'frequency', label: 'Frequency', min: 1, max: 20, default: 5 }] },
    ]
  },
  light: {
    label: 'Light & Glow',
    items: [
      { id: 'bloom', name: 'Bloom', params: [{ key: 'threshold', label: 'Threshold', min: 0, max: 100, default: 70 }, { key: 'intensity', label: 'Intensity', min: 0, max: 100, default: 40 }] },
      { id: 'lens-flare', name: 'Lens Flare', params: [{ key: 'intensity', label: 'Intensity', min: 0, max: 100, default: 60 }] },
      { id: 'glow', name: 'Outer Glow', params: [{ key: 'radius', label: 'Radius', min: 0, max: 100, default: 20 }, { key: 'intensity', label: 'Intensity', min: 0, max: 100, default: 50 }] },
      { id: 'light-rays', name: 'Light Rays', params: [{ key: 'length', label: 'Length', min: 0, max: 100, default: 60 }] },
    ]
  },
  stylize: {
    label: 'Stylize',
    items: [
      { id: 'pixelate', name: 'Pixelate', params: [{ key: 'size', label: 'Pixel Size', min: 1, max: 50, default: 8 }] },
      { id: 'noise', name: 'Film Grain', params: [{ key: 'amount', label: 'Amount', min: 0, max: 100, default: 20 }] },
      { id: 'vhs', name: 'VHS', params: [{ key: 'intensity', label: 'Intensity', min: 0, max: 100, default: 50 }] },
      { id: 'halftone', name: 'Halftone', params: [{ key: 'size', label: 'Dot Size', min: 1, max: 20, default: 4 }] },
      { id: 'outline', name: 'Outline', params: [{ key: 'thickness', label: 'Thickness', min: 1, max: 10, default: 2 }] },
      { id: 'oil-paint', name: 'Oil Paint', params: [{ key: 'radius', label: 'Brush Size', min: 1, max: 20, default: 5 }] },
    ]
  }
}

export default function EffectsPanel() {
  const { clips, selectedClipIds, updateClip } = useEditorStore()
  const [expandedCategories, setExpandedCategories] = useState({ blur: true, distort: false, light: false, stylize: false })
  const [appliedEffects, setAppliedEffects] = useState({}) // effectId -> params
  const [expandedEffect, setExpandedEffect] = useState(null)

  const selectedClip = clips.find(c => selectedClipIds.includes(c.id))

  const toggleCategory = (id) => setExpandedCategories(prev => ({ ...prev, [id]: !prev[id] }))

  const applyEffect = (effectId, defaultParams) => {
    setAppliedEffects(prev => {
      if (prev[effectId]) {
        const { [effectId]: _, ...rest } = prev
        return rest
      }
      const params = {}
      defaultParams.forEach(p => { params[p.key] = p.default })
      return { ...prev, [effectId]: params }
    })
    setExpandedEffect(effectId)
  }

  const updateParam = (effectId, key, value) => {
    setAppliedEffects(prev => ({
      ...prev,
      [effectId]: { ...prev[effectId], [key]: value }
    }))
  }

  const appliedCount = Object.keys(appliedEffects).length

  return (
    <div className="flex flex-col h-full">
      <div className="panel-header">
        <span className="panel-title">Visual Effects</span>
        {appliedCount > 0 && (
          <span className="text-2xs font-mono bg-cyan-brand/15 text-cyan-brand px-1.5 py-0.5 rounded-full border border-cyan-brand/30">
            {appliedCount} active
          </span>
        )}
      </div>

      {/* Active effects */}
      {appliedCount > 0 && (
        <div className="px-2.5 py-2 border-b border-border-subtle">
          <p className="ef-label">Active Effects</p>
          <div className="flex flex-col gap-1">
            {Object.keys(appliedEffects).map(effectId => {
              const effectDef = Object.values(EFFECT_CATEGORIES)
                .flatMap(c => c.items)
                .find(e => e.id === effectId)
              if (!effectDef) return null

              return (
                <div key={effectId} className="bg-surface-overlay rounded-md border border-cyan-brand/20 overflow-hidden">
                  <button
                    className="flex items-center justify-between w-full px-2.5 py-1.5
                               hover:bg-surface-hover transition-colors duration-150"
                    onClick={() => setExpandedEffect(expandedEffect === effectId ? null : effectId)}
                  >
                    <div className="flex items-center gap-1.5">
                      <Sparkles size={10} className="text-cyan-brand" />
                      <span className="text-xs font-ui text-text-secondary">{effectDef.name}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        className="text-text-disabled hover:text-red-400 transition-colors duration-150 text-xs"
                        onClick={(e) => { e.stopPropagation(); applyEffect(effectId, effectDef.params) }}
                        title="Remove effect"
                      >
                        ×
                      </button>
                      <ChevronDown
                        size={10}
                        className={`text-text-muted transition-transform duration-150 ${expandedEffect === effectId ? '' : '-rotate-90'}`}
                      />
                    </div>
                  </button>

                  {expandedEffect === effectId && (
                    <div className="px-2.5 pb-2 flex flex-col gap-2">
                      {effectDef.params.map(param => {
                        const val = appliedEffects[effectId]?.[param.key] ?? param.default
                        const pct = ((val - param.min) / (param.max - param.min)) * 100
                        return (
                          <div key={param.key}>
                            <div className="flex items-center justify-between mb-1">
                              <label className="ef-label mb-0">{param.label}</label>
                              <span className="text-2xs font-mono text-cyan-brand">{val}</span>
                            </div>
                            <input
                              type="range"
                              min={param.min}
                              max={param.max}
                              value={val}
                              onChange={e => updateParam(effectId, param.key, parseInt(e.target.value))}
                              className="ef-slider w-full"
                              style={{ '--slider-pct': `${pct}%` }}
                            />
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Effect library */}
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {!selectedClip && (
          <div className="px-3 py-2 bg-navy-700/30 border-b border-border-subtle">
            <p className="text-2xs text-text-muted">Select a clip on the timeline to apply effects to it.</p>
          </div>
        )}

        {Object.entries(EFFECT_CATEGORIES).map(([catId, category]) => (
          <div key={catId} className="border-b border-border-subtle">
            <button
              className="flex items-center justify-between w-full px-3 py-2
                         hover:bg-surface-hover transition-colors duration-150"
              onClick={() => toggleCategory(catId)}
            >
              <span className="text-xs font-ui text-text-secondary">{category.label}</span>
              <ChevronDown
                size={12}
                className={`text-text-muted transition-transform duration-150 ${expandedCategories[catId] ? '' : '-rotate-90'}`}
              />
            </button>

            {expandedCategories[catId] && (
              <div className="grid grid-cols-2 gap-1.5 p-2.5 pt-1">
                {category.items.map(effect => {
                  const isApplied = !!appliedEffects[effect.id]
                  return (
                    <button
                      key={effect.id}
                      onClick={() => applyEffect(effect.id, effect.params)}
                      className={`flex flex-col items-start gap-1 p-2 rounded-md border cursor-pointer
                                 transition-all duration-150 text-left
                                 ${isApplied
                                   ? 'bg-surface-active border-cyan-brand/50 ring-1 ring-cyan-brand/30'
                                   : 'bg-surface-raised border-border-subtle hover:border-border-default hover:bg-surface-hover'
                                 }`}
                    >
                      <div className="flex items-center justify-between w-full">
                        <span className={`text-xs font-ui ${isApplied ? 'text-cyan-brand' : 'text-text-secondary'}`}>
                          {effect.name}
                        </span>
                        {isApplied && (
                          <div className="w-1.5 h-1.5 rounded-full bg-cyan-brand shrink-0" />
                        )}
                      </div>
                      <span className="text-2xs text-text-disabled">
                        {effect.params.length} param{effect.params.length !== 1 ? 's' : ''}
                      </span>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
