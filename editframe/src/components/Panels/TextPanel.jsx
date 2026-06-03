import React, { useState } from 'react'
import { Type, AlignLeft, AlignCenter, AlignRight, Bold, Italic, Underline, Plus, Sparkles } from 'lucide-react'
import { useEditorStore } from '../../store/editorStore.js'

const FONTS = [
  'Syne', 'DM Sans', 'JetBrains Mono', 'Georgia', 'Impact',
  'Arial', 'Helvetica', 'Times New Roman', 'Courier New',
]

const TEXT_ANIMATIONS = [
  { id: 'none', label: 'None' },
  { id: 'fade-in', label: 'Fade In' },
  { id: 'slide-up', label: 'Slide Up' },
  { id: 'slide-down', label: 'Slide Down' },
  { id: 'slide-left', label: 'Slide Left' },
  { id: 'slide-right', label: 'Slide Right' },
  { id: 'typewriter', label: 'Typewriter' },
  { id: 'zoom-in', label: 'Zoom In' },
  { id: 'bounce', label: 'Bounce' },
  { id: 'glitch', label: 'Glitch' },
  { id: 'neon-flicker', label: 'Neon Flicker' },
  { id: 'word-by-word', label: 'Word by Word' },
]

const TEXT_PRESETS = [
  { id: 'title', label: 'Title', style: { fontSize: 72, fontFamily: 'Syne', color: '#FFFFFF', animation: 'slide-up' } },
  { id: 'subtitle', label: 'Subtitle', style: { fontSize: 36, fontFamily: 'DM Sans', color: '#E8EDF7', animation: 'fade-in' } },
  { id: 'caption', label: 'Caption', style: { fontSize: 22, fontFamily: 'DM Sans', color: '#FFFFFF', animation: 'none' } },
  { id: 'lower-third', label: 'Lower Third', style: { fontSize: 28, fontFamily: 'Syne', color: '#2DD4BF', animation: 'slide-left' } },
  { id: 'credits', label: 'Credits', style: { fontSize: 18, fontFamily: 'DM Sans', color: '#A8B4CE', animation: 'fade-in' } },
  { id: 'quote', label: 'Quote', style: { fontSize: 32, fontFamily: 'Georgia', color: '#E8EDF7', animation: 'typewriter' } },
]

export default function TextPanel() {
  const { clips, selectedClipIds, updateClip } = useEditorStore()
  const [activeTab, setActiveTab] = useState('add') // 'add' | 'captions'
  const [textInput, setTextInput] = useState('Your Text Here')
  const [fontFamily, setFontFamily] = useState('Syne')
  const [fontSize, setFontSize] = useState(48)
  const [fontColor, setFontColor] = useState('#FFFFFF')
  const [alignment, setAlignment] = useState('center')
  const [bold, setBold] = useState(false)
  const [italic, setItalic] = useState(false)
  const [animation, setAnimation] = useState('fade-in')
  const [captionStatus, setCaptionStatus] = useState('idle') // 'idle' | 'generating' | 'done'

  const selectedTextClip = clips.find(c => selectedClipIds.includes(c.id) && c.type === 'text')

  const handleGenerateCaptions = () => {
    setCaptionStatus('generating')
    setTimeout(() => setCaptionStatus('done'), 3200)
  }

  return (
    <div className="flex flex-col h-full">
      <div className="panel-header">
        <span className="panel-title">Text & Captions</span>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border-subtle">
        {[
          { id: 'add', label: 'Text' },
          { id: 'captions', label: 'Auto-Captions' },
        ].map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex-1 py-2 text-xs font-ui transition-colors duration-150 border-b-2
                       ${activeTab === id
                         ? 'text-cyan-brand border-cyan-brand bg-cyan-brand/5'
                         : 'text-text-muted border-transparent hover:text-text-secondary'
                       }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin">

        {activeTab === 'add' && (
          <div className="flex flex-col gap-4 p-3">

            {/* Quick presets */}
            <div>
              <p className="ef-label">Presets</p>
              <div className="grid grid-cols-2 gap-1.5">
                {TEXT_PRESETS.map(preset => (
                  <button
                    key={preset.id}
                    onClick={() => {
                      setFontFamily(preset.style.fontFamily)
                      setFontSize(preset.style.fontSize)
                      setFontColor(preset.style.color)
                      setAnimation(preset.style.animation)
                    }}
                    className="px-2 py-1.5 rounded-md border border-border-subtle bg-surface-raised
                               hover:bg-surface-hover hover:border-border-strong transition-colors duration-150
                               text-left"
                  >
                    <span className="text-xs font-ui text-text-secondary block">{preset.label}</span>
                    <span className="text-2xs text-text-disabled" style={{ fontFamily: preset.style.fontFamily }}>
                      {preset.style.fontFamily}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Text input */}
            <div>
              <label className="ef-label">Text Content</label>
              <textarea
                value={textInput}
                onChange={e => setTextInput(e.target.value)}
                className="ef-input resize-none text-sm"
                rows={2}
                placeholder="Enter your text…"
              />
            </div>

            {/* Font family */}
            <div>
              <label className="ef-label">Font Family</label>
              <select
                className="ef-input text-sm"
                value={fontFamily}
                onChange={e => setFontFamily(e.target.value)}
              >
                {FONTS.map(f => (
                  <option key={f} value={f} style={{ fontFamily: f }}>{f}</option>
                ))}
              </select>
            </div>

            {/* Font size + color row */}
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="ef-label">Size</label>
                <input
                  type="number"
                  min={8}
                  max={300}
                  value={fontSize}
                  onChange={e => setFontSize(parseInt(e.target.value))}
                  className="ef-input text-sm"
                />
              </div>
              <div className="flex-1">
                <label className="ef-label">Color</label>
                <div className="relative">
                  <input
                    type="color"
                    value={fontColor}
                    onChange={e => setFontColor(e.target.value)}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  <div className="ef-input flex items-center gap-2 cursor-pointer">
                    <div className="w-4 h-4 rounded border border-border-default shrink-0"
                      style={{ background: fontColor }} />
                    <span className="font-mono text-xs">{fontColor.toUpperCase()}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Style toggles */}
            <div>
              <label className="ef-label">Style</label>
              <div className="flex items-center gap-1">
                {[
                  { icon: Bold, active: bold, toggle: () => setBold(v => !v), title: 'Bold' },
                  { icon: Italic, active: italic, toggle: () => setItalic(v => !v), title: 'Italic' },
                ].map(({ icon: Icon, active, toggle, title }) => (
                  <button
                    key={title}
                    onClick={toggle}
                    title={title}
                    className={`btn-icon w-8 h-8 ${active ? 'bg-surface-active text-cyan-brand ring-1 ring-cyan-brand/40' : ''}`}
                  >
                    <Icon size={14} />
                  </button>
                ))}

                <div className="w-px h-4 bg-border-subtle mx-1" />

                {/* Alignment */}
                {[
                  { icon: AlignLeft, id: 'left' },
                  { icon: AlignCenter, id: 'center' },
                  { icon: AlignRight, id: 'right' },
                ].map(({ icon: Icon, id }) => (
                  <button
                    key={id}
                    onClick={() => setAlignment(id)}
                    className={`btn-icon w-8 h-8 ${alignment === id ? 'bg-surface-active text-cyan-brand ring-1 ring-cyan-brand/40' : ''}`}
                  >
                    <Icon size={14} />
                  </button>
                ))}
              </div>
            </div>

            {/* Animation */}
            <div>
              <label className="ef-label">Animation</label>
              <div className="grid grid-cols-3 gap-1">
                {TEXT_ANIMATIONS.map(anim => (
                  <button
                    key={anim.id}
                    onClick={() => setAnimation(anim.id)}
                    className={`py-1.5 px-1 rounded-md text-2xs font-ui text-center border transition-colors duration-150
                               ${animation === anim.id
                                 ? 'bg-surface-active text-cyan-brand border-cyan-brand/40'
                                 : 'text-text-muted border-border-subtle hover:border-border-default hover:text-text-secondary bg-surface-raised'
                               }`}
                  >
                    {anim.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Add to timeline button */}
            <button className="btn-primary justify-center w-full">
              <Plus size={13} />
              Add Text to Timeline
            </button>

            {/* Preview */}
            <div className="bg-navy-950 rounded-md border border-border-subtle p-3 text-center overflow-hidden"
              style={{ minHeight: 60 }}>
              <span
                style={{
                  fontFamily,
                  fontSize: Math.min(fontSize, 36),
                  color: fontColor,
                  fontWeight: bold ? 700 : 400,
                  fontStyle: italic ? 'italic' : 'normal',
                  textAlign: alignment,
                }}
                className="block leading-tight break-words"
              >
                {textInput || 'Preview'}
              </span>
            </div>
          </div>
        )}

        {activeTab === 'captions' && (
          <div className="flex flex-col gap-4 p-3">
            <div className="bg-surface-raised rounded-md p-3 border border-border-subtle">
              <div className="flex items-start gap-2.5">
                <Sparkles size={16} className="text-lavender-brand mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs font-ui text-text-primary mb-0.5">Auto-Caption Generation</p>
                  <p className="text-2xs text-text-muted leading-relaxed">
                    AI-powered captions generated from your audio. Supports 40+ languages with word-level timestamps.
                  </p>
                </div>
              </div>
            </div>

            {/* Language */}
            <div>
              <label className="ef-label">Language</label>
              <select className="ef-input text-sm">
                <option>English (US)</option>
                <option>Spanish</option>
                <option>French</option>
                <option>German</option>
                <option>Japanese</option>
                <option>Korean</option>
                <option>Portuguese</option>
                <option>Chinese (Simplified)</option>
              </select>
            </div>

            {/* Style */}
            <div>
              <label className="ef-label">Caption Style</label>
              <div className="grid grid-cols-1 gap-1.5">
                {['Subtitles (Bottom)', 'Word Highlight', 'Pop-up Karaoke', 'Lower Third'].map(style => (
                  <label key={style} className="flex items-center gap-2.5 px-2.5 py-2 rounded-md cursor-pointer
                                              border border-border-subtle hover:border-border-default
                                              hover:bg-surface-hover transition-colors duration-150">
                    <input type="radio" name="captionStyle" className="accent-cyan-500" defaultChecked={style === 'Subtitles (Bottom)'} />
                    <span className="text-xs font-ui text-text-secondary">{style}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Max chars */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="ef-label mb-0">Max chars per line</label>
                <span className="text-xs font-mono text-text-muted">42</span>
              </div>
              <input type="range" min={20} max={80} defaultValue={42} className="ef-slider w-full"
                style={{ '--slider-pct': `${((42 - 20) / 60) * 100}%` }} />
            </div>

            {/* Generate button */}
            <button
              className={`btn-primary justify-center w-full ${captionStatus === 'generating' ? 'opacity-70 cursor-wait' : ''}`}
              onClick={handleGenerateCaptions}
              disabled={captionStatus === 'generating'}
            >
              <Sparkles size={13} />
              {captionStatus === 'idle' && 'Generate Captions'}
              {captionStatus === 'generating' && 'Generating…'}
              {captionStatus === 'done' && 'Regenerate'}
            </button>

            {captionStatus === 'generating' && (
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-text-muted">Processing audio…</span>
                  <span className="text-xs font-mono text-cyan-brand">64%</span>
                </div>
                <div className="h-1 bg-surface-overlay rounded-full overflow-hidden">
                  <div className="h-full bg-cyan-brand rounded-full animate-shimmer"
                    style={{ width: '64%', backgroundImage: 'linear-gradient(90deg, #2DD4BF 0%, #4FFCE8 50%, #2DD4BF 100%)', backgroundSize: '200% 100%' }} />
                </div>
              </div>
            )}

            {captionStatus === 'done' && (
              <div className="bg-emerald-900/20 border border-emerald-800/40 rounded-md p-3">
                <p className="text-xs text-emerald-400 font-ui mb-2">✓ 24 captions generated</p>
                <p className="text-2xs text-text-muted">Captions added to text track. Click any caption to edit.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
