import React from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import MediaPanel from '../Panels/MediaPanel.jsx'
import AudioPanel from '../Panels/AudioPanel.jsx'
import TextPanel from '../Panels/TextPanel.jsx'
import TransitionsPanel from '../Panels/TransitionsPanel.jsx'
import FiltersPanel from '../Panels/FiltersPanel.jsx'
import EffectsPanel from '../Panels/EffectsPanel.jsx'
import StickersPanel from '../Panels/StickersPanel.jsx'
import StockPanel from '../Panels/StockPanel.jsx'
import SpeedPanel from '../Panels/SpeedPanel.jsx'

const PANEL_MAP = {
  media: MediaPanel,
  audio: AudioPanel,
  text: TextPanel,
  transitions: TransitionsPanel,
  filters: FiltersPanel,
  effects: EffectsPanel,
  stickers: StickersPanel,
  stock: StockPanel,
  speed: SpeedPanel,
}

export default function SidePanel({ activePanel, mobile }) {
  const PanelComponent = PANEL_MAP[activePanel] || MediaPanel

  return (
    <div
      className={`panel-chrome h-full ${mobile ? 'border-r-0' : ''}`}
      style={{ width: '100%' }}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={activePanel}
          initial={{ opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 8 }}
          transition={{ duration: 0.18, ease: [0.4, 0, 0.2, 1] }}
          className="flex flex-col h-full"
        >
          <PanelComponent />
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
