import React, { useState } from 'react'
import { Clock, ChevronDown } from 'lucide-react'
import { useEditorStore } from '../../store/editorStore.js'

const TRANSITION_CATEGORIES = {
  basic: {
    label: 'Basic',
    items: [
      { id: 'cut', name: 'Cut', icon: '|', description: 'Instant hard cut' },
      { id: 'fade', name: 'Fade', icon: '◐', description: 'Fade to/from black' },
      { id: 'dissolve', name: 'Dissolve', icon: '⊕', description: 'Cross-dissolve blend' },
      { id: 'dip-white', name: 'Dip White', icon: '◑', description: 'Fade through white' },
    ]
  },
  motion: {
    label: 'Motion',
    items: [
      { id: 'slide-left', name: 'Slide Left', icon: '←', description: 'Slides new clip in from right' },
      { id: 'slide-right', name: 'Slide Right', icon: '→', description: 'Slides new clip in from left' },
      { id: 'slide-up', name: 'Slide Up', icon: '↑', description: 'Slides in from bottom' },
      { id: 'slide-down', name: 'Slide Down', icon: '↓', description: 'Slides in from top' },
      { id: 'push-left', name: 'Push Left', icon: '⟵', description: 'Pushes outgoing clip out' },
      { id: 'push-right', name: 'Push Right', icon: '⟶', description: 'Pushes outgoing clip out' },
    ]
  },
  zoom: {
    label: 'Zoom',
    items: [
      { id: 'zoom-in', name: 'Zoom In', icon: '⊕', description: 'Zooms into new clip' },
      { id: 'zoom-out', name: 'Zoom Out', icon: '⊖', description: 'Zooms out to new clip' },
      { id: 'zoom-blur', name: 'Zoom Blur', icon: '◎', description: 'Motion blur zoom' },
      { id: 'spin-zoom', name: 'Spin Zoom', icon: '↻', description: 'Rotate and zoom' },
    ]
  },
  stylized: {
    label: 'Stylized',
    items: [
      { id: 'glitch', name: 'Glitch', icon: '⚡', description: 'Digital glitch effect' },
      { id: 'flash', name: 'Flash', icon: '✦', description: 'Quick flash burst' },
      { id: 'wipe-horizontal', name: 'Wipe H', icon: '▷', description: 'Horizontal wipe' },
      { id: 'wipe-vertical', name: 'Wipe V', icon: '▽', description: 'Vertical wipe' },
      { id: 'spin', name: 'Spin', icon: '↺', description: '360° spin transition' },
      { id: 'blur', name: 'Blur', icon: '◉', description: 'Gaussian blur transition' },
      { id: 'light-leak', name: 'Light Leak', icon: '☀', description: 'Film light leak' },
      { id: 'film-burn', name: 'Film Burn', icon: '♨', description: 'Vintage film burn' },
    ]
  }
}

export default function TransitionsPanel() {
  const { activeTransition, setActiveTransition } = useEditorStore()
  const [selectedDuration, setSelectedDuration] = useState(0.5)
  const [expandedCategories, setExpandedCategories] = useState({ basic: true, motion: true, zoom: false, stylized: false })
  const [hovered, setHovered] = useState(null)

  const toggleCategory = (cat) => {
    setExpandedCategories(prev => ({ ...prev, [cat]: !prev[cat] }))
  }

  return (
    <div className="flex flex-col h-full">
      <div className="panel-header">
        <span className="panel-title">Transitions</span>
      </div>

      {/* Duration control */}
      <div className="px-3 py-2.5 border-b border-border-subtle bg-surface-raised/40">
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-1.5">
            <Clock size={11} className="text-text-muted" />
            <label className="text-2xs font-mono uppercase tracking-wider text-text-muted">Duration</label>
          </div>
          <span className="text-xs font-mono text-cyan-brand">{selectedDuration.toFixed(1)}s</span>
        </div>
        <input
          type="range"
          min={0.1}
          max={3}
          step={0.1}
          value={selectedDuration}
          onChange={e => setSelectedDuration(parseFloat(e.target.value))}
          className="ef-slider w-full"
          style={{ '--slider-pct': `${((selectedDuration - 0.1) / 2.9) * 100}%` }}
        />
        <div className="flex justify-between mt-1">
          {[0.2, 0.5, 1, 1.5, 2].map(v => (
            <button
              key={v}
              onClick={() => setSelectedDuration(v)}
              className={`text-2xs font-mono transition-colors duration-150
                         ${selectedDuration === v ? 'text-cyan-brand' : 'text-text-disabled hover:text-text-muted'}`}
            >
              {v}s
            </button>
          ))}
        </div>
      </div>

      {/* Instructions */}
      <div className="px-3 py-2 border-b border-border-subtle">
        <p className="text-2xs text-text-muted leading-relaxed">
          Drag a transition between two clips on the timeline, or select a clip and click to apply.
        </p>
      </div>

      {/* Transition categories */}
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {Object.entries(TRANSITION_CATEGORIES).map(([catId, category]) => (
          <div key={catId} className="border-b border-border-subtle">
            <button
              className="flex items-center justify-between w-full px-3 py-2
                         hover:bg-surface-hover transition-colors duration-150"
              onClick={() => toggleCategory(catId)}
            >
              <span className="text-xs font-ui text-text-secondary">{category.label}</span>
              <ChevronDown
                size={12}
                className={`text-text-muted transition-transform duration-150
                           ${expandedCategories[catId] ? '' : '-rotate-90'}`}
              />
            </button>

            {expandedCategories[catId] && (
              <div className="grid grid-cols-2 gap-1.5 p-2.5 pt-1">
                {category.items.map(transition => (
                  <TransitionCard
                    key={transition.id}
                    transition={transition}
                    active={activeTransition === transition.id}
                    hovered={hovered === transition.id}
                    onMouseEnter={() => setHovered(transition.id)}
                    onMouseLeave={() => setHovered(null)}
                    onClick={() => setActiveTransition(transition.id === activeTransition ? null : transition.id)}
                  />
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function TransitionCard({ transition, active, hovered, onMouseEnter, onMouseLeave, onClick }) {
  return (
    <button
      className={`flex flex-col items-center gap-1 p-2 rounded-md border cursor-pointer
                 transition-all duration-150 text-center
                 ${active
                   ? 'bg-surface-active border-cyan-brand/50 ring-1 ring-cyan-brand/30'
                   : 'bg-surface-raised border-border-subtle hover:border-border-default hover:bg-surface-hover'
                 }`}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onClick={onClick}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('transition', JSON.stringify(transition))
      }}
      title={transition.description}
    >
      {/* Icon preview */}
      <div
        className={`w-10 h-7 rounded flex items-center justify-center text-base
                   transition-colors duration-150
                   ${active ? 'bg-cyan-brand/15' : 'bg-navy-950/60'}`}
      >
        <span
          className={active ? 'text-cyan-brand' : 'text-text-muted'}
          style={{ fontFamily: 'system-ui', lineHeight: 1 }}
        >
          {transition.icon}
        </span>
      </div>
      <span className={`text-2xs font-ui leading-none ${active ? 'text-cyan-brand' : 'text-text-muted'}`}>
        {transition.name}
      </span>
    </button>
  )
}
