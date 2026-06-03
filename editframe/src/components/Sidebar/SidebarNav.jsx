import React from 'react'
import {
  Film, Music, Type, Sparkles, Wand2, Sticker,
  Image, Layers, Clock, ChevronRight, Gauge
} from 'lucide-react'

const NAV_ITEMS = [
  { id: 'media',       icon: Film,     label: 'Media',          shortcut: 'M' },
  { id: 'audio',       icon: Music,    label: 'Audio',          shortcut: 'A' },
  { id: 'text',        icon: Type,     label: 'Text',           shortcut: 'T' },
  { id: 'transitions', icon: Layers,   label: 'Transitions',    shortcut: null },
  { id: 'filters',     icon: Wand2,    label: 'Filters & Color',shortcut: 'F' },
  { id: 'effects',     icon: Sparkles, label: 'Effects',        shortcut: null },
  { id: 'speed',       icon: Gauge,    label: 'Speed',          shortcut: null },
  { id: 'stickers',    icon: Sticker,  label: 'Stickers',       shortcut: null },
  { id: 'stock',       icon: Image,    label: 'Stock Media',    shortcut: null },
]

export default function SidebarNav({ activePanel, onPanelSelect }) {
  return (
    <aside
      className="flex flex-col border-r border-border-subtle bg-navy-800 shrink-0 z-panel"
      style={{ width: 48 }}
    >
      <div className="flex flex-col flex-1 py-1">
        {NAV_ITEMS.map(({ id, icon: Icon, label, shortcut }) => (
          <button
            key={id}
            onClick={() => onPanelSelect(id)}
            className={`nav-icon ${activePanel === id ? 'active' : ''}`}
            title={`${label}${shortcut ? ` (${shortcut})` : ''}`}
          >
            <Icon size={17} strokeWidth={activePanel === id ? 2 : 1.75} />
            <span className="text-2xs font-ui leading-none mt-0.5" style={{ fontSize: '0.55rem' }}>
              {label.split(' ')[0]}
            </span>
          </button>
        ))}
      </div>

      {/* Bottom — version / branding */}
      <div className="pb-2 flex justify-center">
        <div
          className="w-5 h-5 rounded flex items-center justify-center"
          style={{ background: 'linear-gradient(135deg, #2DD4BF 0%, #7B8CDE 100%)' }}
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <rect x="0.5" y="2" width="9" height="6" rx="1.5" stroke="#0A0F1E" strokeWidth="1.25" />
            <path d="M3.5 3.5L6.5 5L3.5 6.5V3.5Z" fill="#0A0F1E" />
          </svg>
        </div>
      </div>
    </aside>
  )
}
