import React from 'react'
import { Film, Music, Type, Sparkles, Wand2, Sticker, Image, Download } from 'lucide-react'

const MOBILE_NAV = [
  { id: 'media', icon: Film, label: 'Media' },
  { id: 'audio', icon: Music, label: 'Audio' },
  { id: 'text', icon: Type, label: 'Text' },
  { id: 'filters', icon: Wand2, label: 'Filter' },
  { id: 'effects', icon: Sparkles, label: 'FX' },
  { id: 'stickers', icon: Sticker, label: 'Stickers' },
]

export default function MobileToolbar({ activePanel, onPanelSelect, onExport }) {
  return (
    <nav
      className="flex items-stretch border-t border-border-subtle bg-navy-800 shrink-0"
      style={{
        height: 60,
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      {MOBILE_NAV.map(({ id, icon: Icon, label }) => (
        <button
          key={id}
          onClick={() => onPanelSelect(id)}
          className={`flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors duration-150
                     ${activePanel === id
                       ? 'text-cyan-brand bg-cyan-brand/5'
                       : 'text-text-muted hover:text-text-secondary'
                     }`}
        >
          <Icon size={18} />
          <span className="text-2xs font-ui">{label}</span>
        </button>
      ))}
    </nav>
  )
}
