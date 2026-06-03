import React, { useState } from 'react'
import { RotateCcw, ChevronDown, ChevronRight } from 'lucide-react'
import { useEditorStore } from '../../store/editorStore.js'

const COLOR_FILTERS = [
  { id: null, name: 'None', css: '' },
  { id: 'vivid', name: 'Vivid', css: 'saturate(1.6) contrast(1.1)' },
  { id: 'cinematic', name: 'Cinematic', css: 'contrast(1.15) brightness(0.95) saturate(0.85)' },
  { id: 'warm', name: 'Warm', css: 'sepia(0.2) saturate(1.2) brightness(1.05)' },
  { id: 'cool', name: 'Cool', css: 'hue-rotate(20deg) saturate(0.9) brightness(1.02)' },
  { id: 'bw', name: 'B&W', css: 'grayscale(1) contrast(1.1)' },
  { id: 'faded', name: 'Faded', css: 'contrast(0.85) brightness(1.1) saturate(0.7)' },
  { id: 'noir', name: 'Noir', css: 'grayscale(0.8) contrast(1.3) brightness(0.9)' },
  { id: 'summer', name: 'Summer', css: 'saturate(1.4) brightness(1.05) hue-rotate(-10deg)' },
  { id: 'matte', name: 'Matte', css: 'contrast(0.9) saturate(0.8) brightness(1.08)' },
  { id: 'neon', name: 'Neon', css: 'saturate(2) contrast(1.2) brightness(1.1) hue-rotate(180deg)' },
  { id: 'vintage', name: 'Vintage', css: 'sepia(0.4) contrast(0.95) brightness(0.95) saturate(0.8)' },
]

const GRADING_CONTROLS = [
  { key: 'brightness', label: 'Brightness', min: -100, max: 100, default: 0, unit: '' },
  { key: 'contrast', label: 'Contrast', min: -100, max: 100, default: 0, unit: '' },
  { key: 'saturation', label: 'Saturation', min: -100, max: 100, default: 0, unit: '' },
  { key: 'hue', label: 'Hue Rotate', min: -180, max: 180, default: 0, unit: '°' },
  { key: 'warmth', label: 'Warmth', min: -100, max: 100, default: 0, unit: '' },
  { key: 'tint', label: 'Tint', min: -100, max: 100, default: 0, unit: '' },
  { key: 'shadows', label: 'Shadows', min: -100, max: 100, default: 0, unit: '' },
  { key: 'highlights', label: 'Highlights', min: -100, max: 100, default: 0, unit: '' },
  { key: 'vignette', label: 'Vignette', min: 0, max: 100, default: 0, unit: '' },
  { key: 'sharpness', label: 'Sharpness', min: 0, max: 100, default: 0, unit: '' },
]

export default function FiltersPanel() {
  const { activeFilter, setActiveFilter, colorGrading, setColorGrading, resetColorGrading } = useEditorStore()
  const [gradingExpanded, setGradingExpanded] = useState(true)

  const hasGradingChanges = Object.values(colorGrading).some(v => v !== 0)

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="panel-header">
        <span className="panel-title">Filters & Color</span>
        {hasGradingChanges && (
          <button className="btn-ghost text-2xs gap-1 py-0.5" onClick={resetColorGrading}>
            <RotateCcw size={10} />
            Reset
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {/* ── Filter presets ── */}
        <div className="p-2.5 border-b border-border-subtle">
          <p className="ef-label">Presets</p>
          <div className="grid grid-cols-3 gap-1.5">
            {COLOR_FILTERS.map(filter => (
              <FilterSwatch
                key={filter.id ?? 'none'}
                filter={filter}
                active={activeFilter === filter.id}
                onClick={() => setActiveFilter(filter.id)}
              />
            ))}
          </div>
        </div>

        {/* ── Color grading ── */}
        <div>
          <button
            className="flex items-center justify-between w-full px-3 py-2 border-b border-border-subtle
                       hover:bg-surface-hover transition-colors duration-150"
            onClick={() => setGradingExpanded(v => !v)}
          >
            <span className="text-xs font-ui text-text-secondary">Color Grading</span>
            <div className="flex items-center gap-2">
              {hasGradingChanges && (
                <div className="w-1.5 h-1.5 rounded-full bg-cyan-brand" />
              )}
              {gradingExpanded ? <ChevronDown size={12} className="text-text-muted" /> : <ChevronRight size={12} className="text-text-muted" />}
            </div>
          </button>

          {gradingExpanded && (
            <div className="p-3 flex flex-col gap-3">
              {GRADING_CONTROLS.map(control => (
                <GradingSlider
                  key={control.key}
                  control={control}
                  value={colorGrading[control.key]}
                  onChange={val => setColorGrading(control.key, val)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function FilterSwatch({ filter, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`filter-swatch ${active ? 'active' : ''}`}
    >
      <div className={`preview ${active ? 'ring-2 ring-cyan-brand border-cyan-brand/50' : ''}`}>
        {/* Fake preview image */}
        <div
          className="w-full aspect-video relative overflow-hidden"
          style={{
            background: 'linear-gradient(135deg, #1B3A5A 0%, #0D1526 40%, #1A2E50 70%, #0A1828 100%)',
            filter: filter.css || 'none',
          }}
        >
          {/* Fake scene content */}
          <div className="absolute inset-0 flex items-end p-1">
            <div className="w-full">
              <div className="h-1 rounded-sm bg-white/20 mb-0.5 w-3/4" />
              <div className="h-0.5 rounded-sm bg-white/10 w-1/2" />
            </div>
          </div>
          <div className="absolute top-1 right-1 w-3 h-3 rounded-full bg-white/20" />
        </div>
      </div>
      <span className={`text-2xs font-ui leading-none ${active ? 'text-cyan-brand' : 'text-text-muted'}`}>
        {filter.name}
      </span>
    </button>
  )
}

function GradingSlider({ control, value, onChange }) {
  const pct = ((value - control.min) / (control.max - control.min)) * 100
  const isChanged = value !== control.default

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className={`text-2xs font-mono uppercase tracking-wider ${isChanged ? 'text-cyan-brand' : 'text-text-muted'}`}>
          {control.label}
        </label>
        <div className="flex items-center gap-1.5">
          {isChanged && (
            <button
              className="text-2xs text-text-disabled hover:text-text-muted transition-colors"
              onClick={() => onChange(control.default)}
              title="Reset"
            >
              ↺
            </button>
          )}
          <span className={`text-2xs font-mono w-10 text-right ${isChanged ? 'text-cyan-brand' : 'text-text-muted'}`}>
            {value > 0 ? '+' : ''}{value}{control.unit}
          </span>
        </div>
      </div>
      <input
        type="range"
        min={control.min}
        max={control.max}
        step={1}
        value={value}
        onChange={e => onChange(parseInt(e.target.value))}
        className="ef-slider w-full"
        style={{
          '--slider-fill': isChanged ? '#2DD4BF' : '#3A5080',
          '--slider-pct': `${pct}%`,
        }}
      />
    </div>
  )
}
