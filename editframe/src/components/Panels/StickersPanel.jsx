import React, { useState } from 'react'
import { Search } from 'lucide-react'

const STICKER_CATEGORIES = [
  { id: 'all', label: 'All' },
  { id: 'emoji', label: 'Emoji' },
  { id: 'animated', label: 'Animated' },
  { id: 'shapes', label: 'Shapes' },
  { id: 'text-badges', label: 'Badges' },
  { id: 'arrows', label: 'Arrows' },
  { id: 'reactions', label: 'Reactions' },
]

const STICKERS = [
  // Emoji
  { id: 's1', cat: 'emoji', emoji: '🔥', label: 'Fire', animated: false },
  { id: 's2', cat: 'emoji', emoji: '⭐', label: 'Star', animated: false },
  { id: 's3', cat: 'emoji', emoji: '💥', label: 'Boom', animated: false },
  { id: 's4', cat: 'emoji', emoji: '✨', label: 'Sparkle', animated: false },
  { id: 's5', cat: 'emoji', emoji: '💯', label: '100', animated: false },
  { id: 's6', cat: 'emoji', emoji: '🎯', label: 'Target', animated: false },
  { id: 's7', cat: 'emoji', emoji: '🚀', label: 'Rocket', animated: false },
  { id: 's8', cat: 'emoji', emoji: '👑', label: 'Crown', animated: false },
  { id: 's9', cat: 'emoji', emoji: '🎬', label: 'Clapboard', animated: false },
  { id: 's10', cat: 'emoji', emoji: '🎵', label: 'Note', animated: false },
  { id: 's11', cat: 'emoji', emoji: '❤️', label: 'Heart', animated: false },
  { id: 's12', cat: 'emoji', emoji: '😎', label: 'Cool', animated: false },

  // Animated
  { id: 'a1', cat: 'animated', emoji: '🌊', label: 'Wave', animated: true },
  { id: 'a2', cat: 'animated', emoji: '⚡', label: 'Lightning', animated: true },
  { id: 'a3', cat: 'animated', emoji: '🌟', label: 'Glow Star', animated: true },
  { id: 'a4', cat: 'animated', emoji: '🎆', label: 'Firework', animated: true },
  { id: 'a5', cat: 'animated', emoji: '💫', label: 'Swirl', animated: true },
  { id: 'a6', cat: 'animated', emoji: '🔮', label: 'Crystal', animated: true },

  // Shapes
  { id: 'sh1', cat: 'shapes', emoji: '⬛', label: 'Black Box', animated: false },
  { id: 'sh2', cat: 'shapes', emoji: '⭕', label: 'Circle', animated: false },
  { id: 'sh3', cat: 'shapes', emoji: '🔷', label: 'Diamond', animated: false },
  { id: 'sh4', cat: 'shapes', emoji: '▶️', label: 'Play', animated: false },
  { id: 'sh5', cat: 'shapes', emoji: '🔲', label: 'Frame', animated: false },
  { id: 'sh6', cat: 'shapes', emoji: '〰️', label: 'Wave Line', animated: false },

  // Badges
  { id: 'b1', cat: 'text-badges', emoji: '🆕', label: 'New', animated: false },
  { id: 'b2', cat: 'text-badges', emoji: '🔴', label: 'Live', animated: false },
  { id: 'b3', cat: 'text-badges', emoji: '⚠️', label: 'Warning', animated: false },
  { id: 'b4', cat: 'text-badges', emoji: '🏆', label: 'Trophy', animated: false },
  { id: 'b5', cat: 'text-badges', emoji: '✅', label: 'Check', animated: false },
  { id: 'b6', cat: 'text-badges', emoji: '❌', label: 'Cross', animated: false },

  // Arrows
  { id: 'ar1', cat: 'arrows', emoji: '⬆️', label: 'Up', animated: false },
  { id: 'ar2', cat: 'arrows', emoji: '⬇️', label: 'Down', animated: false },
  { id: 'ar3', cat: 'arrows', emoji: '➡️', label: 'Right', animated: false },
  { id: 'ar4', cat: 'arrows', emoji: '⬅️', label: 'Left', animated: false },
  { id: 'ar5', cat: 'arrows', emoji: '↗️', label: 'Up-Right', animated: false },
  { id: 'ar6', cat: 'arrows', emoji: '↙️', label: 'Down-Left', animated: false },

  // Reactions
  { id: 'r1', cat: 'reactions', emoji: '👍', label: 'Like', animated: false },
  { id: 'r2', cat: 'reactions', emoji: '👏', label: 'Clap', animated: false },
  { id: 'r3', cat: 'reactions', emoji: '😂', label: 'LOL', animated: false },
  { id: 'r4', cat: 'reactions', emoji: '🤯', label: 'Mind Blown', animated: false },
  { id: 'r5', cat: 'reactions', emoji: '😍', label: 'Love', animated: false },
  { id: 'r6', cat: 'reactions', emoji: '🙌', label: 'Celebrate', animated: false },
]

export default function StickersPanel() {
  const [activeCategory, setActiveCategory] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedSticker, setSelectedSticker] = useState(null)

  const filtered = STICKERS.filter(s => {
    const matchCat = activeCategory === 'all' || s.cat === activeCategory
    const matchSearch = !searchQuery || s.label.toLowerCase().includes(searchQuery.toLowerCase())
    return matchCat && matchSearch
  })

  return (
    <div className="flex flex-col h-full">
      <div className="panel-header">
        <span className="panel-title">Stickers & Overlays</span>
      </div>

      {/* Search */}
      <div className="px-2.5 py-2 border-b border-border-subtle">
        <div className="relative">
          <Search size={11} className="absolute left-2 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
          <input
            type="text"
            placeholder="Search stickers…"
            className="ef-input pl-6 h-7 text-xs"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Category scroll */}
      <div className="flex gap-1 px-2.5 py-1.5 overflow-x-auto scrollbar-hide border-b border-border-subtle">
        {STICKER_CATEGORIES.map(cat => (
          <button
            key={cat.id}
            onClick={() => setActiveCategory(cat.id)}
            className={`px-2 py-0.5 text-2xs font-ui rounded-full border whitespace-nowrap transition-colors duration-150 shrink-0
                       ${activeCategory === cat.id
                         ? 'bg-surface-overlay text-text-primary border-border-strong'
                         : 'text-text-muted border-border-subtle hover:text-text-secondary hover:border-border-default'
                       }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Sticker grid */}
      <div className="flex-1 overflow-y-auto scrollbar-thin p-2.5">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8">
            <span className="text-2xl">🔍</span>
            <p className="text-xs text-text-muted">No stickers found</p>
          </div>
        ) : (
          <div className="grid grid-cols-4 gap-1.5">
            {filtered.map(sticker => (
              <button
                key={sticker.id}
                onClick={() => setSelectedSticker(sticker.id === selectedSticker ? null : sticker.id)}
                draggable
                onDragStart={e => {
                  e.dataTransfer.setData('sticker', JSON.stringify(sticker))
                }}
                className={`flex flex-col items-center gap-1 p-1.5 rounded-md border cursor-pointer
                           transition-all duration-150 group
                           ${selectedSticker === sticker.id
                             ? 'bg-surface-active border-cyan-brand/50 ring-1 ring-cyan-brand/30'
                             : 'bg-surface-raised border-border-subtle hover:border-border-default hover:bg-surface-hover'
                           }`}
                title={sticker.label}
              >
                <span
                  className={`text-xl leading-none ${sticker.animated ? 'group-hover:animate-bounce' : ''}`}
                  style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.5))' }}
                >
                  {sticker.emoji}
                </span>
                <span className="text-2xs text-text-disabled leading-none truncate w-full text-center"
                  style={{ fontSize: '0.55rem' }}>
                  {sticker.label}
                </span>
                {sticker.animated && (
                  <div className="w-1 h-1 rounded-full bg-cyan-brand/60" />
                )}
              </button>
            ))}
          </div>
        )}

        {/* Selected sticker actions */}
        {selectedSticker && (
          <div className="mt-3 p-2.5 bg-surface-raised rounded-md border border-border-default">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xl">{STICKERS.find(s => s.id === selectedSticker)?.emoji}</span>
              <div>
                <p className="text-xs font-ui text-text-secondary">
                  {STICKERS.find(s => s.id === selectedSticker)?.label}
                </p>
                <p className="text-2xs text-text-muted">
                  {STICKERS.find(s => s.id === selectedSticker)?.animated ? '● Animated' : '○ Static'}
                </p>
              </div>
            </div>

            {/* Size */}
            <div className="mb-2">
              <div className="flex items-center justify-between mb-1">
                <label className="ef-label mb-0">Size</label>
                <span className="text-2xs font-mono text-text-muted">80%</span>
              </div>
              <input type="range" min={10} max={200} defaultValue={80} className="ef-slider w-full"
                style={{ '--slider-pct': '40%' }} />
            </div>

            {/* Opacity */}
            <div className="mb-2">
              <div className="flex items-center justify-between mb-1">
                <label className="ef-label mb-0">Opacity</label>
                <span className="text-2xs font-mono text-text-muted">100%</span>
              </div>
              <input type="range" min={0} max={100} defaultValue={100} className="ef-slider w-full"
                style={{ '--slider-pct': '100%' }} />
            </div>

            <button className="btn-primary w-full justify-center text-xs">
              Add to Timeline
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
