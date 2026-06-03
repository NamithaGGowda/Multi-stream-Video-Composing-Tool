import { useState, useMemo } from 'react';
import { Search, Play, Plus, Film, Music, Image, Clock, ChevronDown, Star, TrendingUp, Zap, Globe, Filter, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useEditorStore } from '../../store/editorStore';

// ─── Mock stock library ─────────────────────────────────────────────────────

const STOCK_CATEGORIES = [
  { id: 'trending',  label: 'Trending',   icon: TrendingUp },
  { id: 'featured',  label: 'Featured',   icon: Star       },
  { id: 'video',     label: 'Video',      icon: Film       },
  { id: 'music',     label: 'Music',      icon: Music      },
  { id: 'photo',     label: 'Photos',     icon: Image      },
  { id: 'sfx',       label: 'Sound FX',   icon: Zap        },
];

const TOPICS = [
  'Nature', 'City', 'Business', 'Tech', 'Travel', 'Food', 'Sport', 'Abstract', 'People', 'Aerial'
];

const LICENSES = ['All Licenses', 'Free', 'Premium'];

const SORT_OPTIONS = ['Relevance', 'Newest', 'Popular', 'Duration'];

// Generate mock stock items
const generateStockItems = () => {
  const videoItems = [
    { id: 'sv1',  type: 'video', title: 'Aerial City at Night',        duration: '0:15', res: '4K',  topic: 'City',     license: 'Free',    gradient: 'from-blue-900 to-indigo-950',   accent: '#2DD4BF', fps: 30 },
    { id: 'sv2',  type: 'video', title: 'Ocean Waves Slow Motion',     duration: '0:30', res: '4K',  topic: 'Nature',   license: 'Free',    gradient: 'from-cyan-900 to-blue-950',     accent: '#7B8CDE', fps: 120 },
    { id: 'sv3',  type: 'video', title: 'Neon Rain Street Walk',       duration: '0:20', res: '1080p', topic: 'City',   license: 'Premium', gradient: 'from-purple-900 to-pink-950',   accent: '#a78bfa', fps: 24 },
    { id: 'sv4',  type: 'video', title: 'Mountain Sunrise Timelapse',  duration: '0:45', res: '4K',  topic: 'Nature',   license: 'Free',    gradient: 'from-orange-950 to-red-950',    accent: '#fb923c', fps: 24 },
    { id: 'sv5',  type: 'video', title: 'Corporate Office B-Roll',     duration: '0:12', res: '1080p', topic: 'Business', license: 'Premium', gradient: 'from-slate-800 to-slate-950', accent: '#94a3b8', fps: 30 },
    { id: 'sv6',  type: 'video', title: 'Abstract Fluid Simulation',   duration: '0:10', res: '4K',  topic: 'Abstract', license: 'Free',    gradient: 'from-teal-900 to-emerald-950',  accent: '#2dd4bf', fps: 60 },
    { id: 'sv7',  type: 'video', title: 'Drone Coastal Fly-Through',   duration: '0:25', res: '4K',  topic: 'Aerial',   license: 'Free',    gradient: 'from-sky-900 to-blue-950',      accent: '#38bdf8', fps: 30 },
    { id: 'sv8',  type: 'video', title: 'Tokyo Street Hyperlapse',     duration: '0:35', res: '4K',  topic: 'Travel',   license: 'Premium', gradient: 'from-rose-900 to-red-950',      accent: '#fb7185', fps: 24 },
    { id: 'sv9',  type: 'video', title: 'Bokeh Particle Background',   duration: '0:20', res: '1080p', topic: 'Abstract', license: 'Free',  gradient: 'from-violet-900 to-purple-950', accent: '#c4b5fd', fps: 30 },
    { id: 'sv10', type: 'video', title: 'Sports Action Highlights',    duration: '0:18', res: '4K',  topic: 'Sport',    license: 'Premium', gradient: 'from-green-900 to-emerald-950', accent: '#34d399', fps: 60 },
    { id: 'sv11', type: 'video', title: 'Chef Cooking Close-Up',       duration: '0:22', res: '1080p', topic: 'Food',   license: 'Free',    gradient: 'from-amber-900 to-yellow-950',  accent: '#fbbf24', fps: 30 },
    { id: 'sv12', type: 'video', title: 'Server Room Data Center',     duration: '0:14', res: '4K',  topic: 'Tech',     license: 'Premium', gradient: 'from-blue-900 to-cyan-950',     accent: '#22d3ee', fps: 30 },
  ];

  const musicItems = [
    { id: 'sm1', type: 'music', title: 'Midnight Lo-Fi Chill',       duration: '2:34', genre: 'Lo-Fi',      bpm: 85,  license: 'Free',    waveColor: '#2DD4BF' },
    { id: 'sm2', type: 'music', title: 'Epic Cinematic Rise',        duration: '1:48', genre: 'Cinematic',  bpm: 120, license: 'Free',    waveColor: '#7B8CDE' },
    { id: 'sm3', type: 'music', title: 'Upbeat Corporate Pop',       duration: '2:10', genre: 'Corporate',  bpm: 128, license: 'Premium', waveColor: '#a78bfa' },
    { id: 'sm4', type: 'music', title: 'Deep Ambient Drone',         duration: '3:20', genre: 'Ambient',    bpm: 70,  license: 'Free',    waveColor: '#38bdf8' },
    { id: 'sm5', type: 'music', title: 'Funk Groove Bass Line',      duration: '1:55', genre: 'Funk',       bpm: 105, license: 'Premium', waveColor: '#fb923c' },
    { id: 'sm6', type: 'music', title: 'Acoustic Indie Folk',        duration: '2:42', genre: 'Folk',       bpm: 92,  license: 'Free',    waveColor: '#34d399' },
  ];

  const photoItems = [
    { id: 'sp1', type: 'photo', title: 'Mountain Ridge Fog',         topic: 'Nature',   license: 'Free',    gradient: 'from-slate-700 to-slate-900',   res: '6000×4000' },
    { id: 'sp2', type: 'photo', title: 'Neon Alley Night',           topic: 'City',     license: 'Free',    gradient: 'from-purple-800 to-indigo-900', res: '5000×3333' },
    { id: 'sp3', type: 'photo', title: 'Business Handshake',         topic: 'Business', license: 'Premium', gradient: 'from-slate-600 to-slate-800',   res: '4000×6000' },
    { id: 'sp4', type: 'photo', title: 'Tropical Beach Aerial',      topic: 'Aerial',   license: 'Free',    gradient: 'from-cyan-700 to-teal-900',     res: '7000×4666' },
    { id: 'sp5', type: 'photo', title: 'Flat Lay Tech Workspace',    topic: 'Tech',     license: 'Premium', gradient: 'from-zinc-700 to-zinc-900',     res: '5500×3667' },
    { id: 'sp6', type: 'photo', title: 'Abstract Light Painting',    topic: 'Abstract', license: 'Free',    gradient: 'from-violet-800 to-pink-900',   res: '4800×3200' },
  ];

  const sfxItems = [
    { id: 'ss1', type: 'sfx', title: 'Whoosh Transition Fast',    duration: '0:01', category: 'Transition', license: 'Free',    waveColor: '#2DD4BF' },
    { id: 'ss2', type: 'sfx', title: 'Notification Ping Soft',    duration: '0:02', category: 'UI',         license: 'Free',    waveColor: '#7B8CDE' },
    { id: 'ss3', type: 'sfx', title: 'Cinematic Impact Boom',     duration: '0:03', category: 'Impact',     license: 'Free',    waveColor: '#fb923c' },
    { id: 'ss4', type: 'sfx', title: 'Thunder Clap Deep',         duration: '0:04', category: 'Nature',     license: 'Free',    waveColor: '#818cf8' },
    { id: 'ss5', type: 'sfx', title: 'Keyboard Typing Loop',      duration: '0:05', category: 'Ambient',    license: 'Free',    waveColor: '#34d399' },
    { id: 'ss6', type: 'sfx', title: 'Vinyl Record Scratch',      duration: '0:02', category: 'Music',      license: 'Premium', waveColor: '#f472b6' },
  ];

  return [...videoItems, ...musicItems, ...photoItems, ...sfxItems];
};

const ALL_ITEMS = generateStockItems();

// ─── Sub-components ──────────────────────────────────────────────────────────

function WaveformPreview({ color = '#2DD4BF', barCount = 28 }) {
  const bars = useMemo(() => Array.from({ length: barCount }, () => 0.2 + Math.random() * 0.8), [barCount]);
  return (
    <div className="flex items-center gap-[2px] h-6">
      {bars.map((h, i) => (
        <div
          key={i}
          className="w-[2px] rounded-full flex-shrink-0"
          style={{ height: `${h * 100}%`, background: color, opacity: 0.7 }}
        />
      ))}
    </div>
  );
}

function VideoCard({ item, onAdd, onPreview }) {
  const [hovered, setHovered] = useState(false);

  return (
    <motion.div
      className="group relative rounded-lg overflow-hidden cursor-pointer border border-white/5 hover:border-cyan-500/30 transition-colors"
      onHoverStart={() => setHovered(true)}
      onHoverEnd={() => setHovered(false)}
      whileHover={{ y: -2 }}
      transition={{ duration: 0.15 }}
    >
      {/* Thumbnail */}
      <div className={`aspect-video bg-gradient-to-br ${item.gradient} relative flex items-center justify-center`}>
        {/* Fake content */}
        <div className="absolute inset-0 opacity-20"
          style={{ backgroundImage: 'radial-gradient(circle at 30% 40%, white 1px, transparent 1px), radial-gradient(circle at 70% 60%, white 1px, transparent 1px)', backgroundSize: '40px 40px' }}
        />

        {/* Badges */}
        <div className="absolute top-1.5 left-1.5 flex gap-1">
          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold tracking-wide bg-black/50 text-white font-mono">
            {item.res}
          </span>
          {item.fps && (
            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold tracking-wide bg-black/50 text-white/70 font-mono">
              {item.fps}fps
            </span>
          )}
        </div>

        {/* License badge */}
        <div className="absolute top-1.5 right-1.5">
          <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold tracking-wide ${
            item.license === 'Free'
              ? 'bg-emerald-500/30 text-emerald-300 border border-emerald-500/40'
              : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
          }`}>
            {item.license === 'Free' ? 'FREE' : 'PRO'}
          </span>
        </div>

        {/* Duration */}
        <div className="absolute bottom-1.5 left-1.5">
          <span className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-black/60 text-white/80">
            {item.duration}
          </span>
        </div>

        {/* Hover overlay */}
        <AnimatePresence>
          {hovered && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="absolute inset-0 bg-black/50 flex items-center justify-center gap-2"
            >
              <button
                className="p-2 rounded-full bg-white/10 hover:bg-white/20 border border-white/20 transition-colors"
                onClick={(e) => { e.stopPropagation(); onPreview(item); }}
              >
                <Play className="w-3 h-3 text-white fill-white" />
              </button>
              <button
                className="p-2 rounded-full bg-cyan-500/80 hover:bg-cyan-400/80 transition-colors"
                onClick={(e) => { e.stopPropagation(); onAdd(item); }}
              >
                <Plus className="w-3 h-3 text-white" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Info */}
      <div className="px-2 py-1.5 bg-[#0D1526]">
        <p className="text-[11px] text-ice-200 truncate font-medium leading-tight">{item.title}</p>
        <p className="text-[10px] text-ice-500 mt-0.5">{item.topic}</p>
      </div>
    </motion.div>
  );
}

function MusicCard({ item, onAdd }) {
  const [playing, setPlaying] = useState(false);

  return (
    <div className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg hover:bg-white/5 border border-transparent hover:border-white/10 transition-all group cursor-pointer">
      {/* Play button */}
      <button
        className={`w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center border transition-all ${
          playing
            ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-400'
            : 'bg-white/5 border-white/10 text-ice-400 hover:border-cyan-500/40'
        }`}
        onClick={() => setPlaying(!playing)}
      >
        {playing ? (
          <div className="flex gap-[2px] items-center">
            <div className="w-[2px] h-2.5 bg-current rounded-full animate-pulse" />
            <div className="w-[2px] h-3.5 bg-current rounded-full animate-pulse [animation-delay:0.15s]" />
            <div className="w-[2px] h-2 bg-current rounded-full animate-pulse [animation-delay:0.3s]" />
          </div>
        ) : (
          <Play className="w-3 h-3 fill-current" />
        )}
      </button>

      {/* Info + waveform */}
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between mb-1">
          <p className="text-[11px] text-ice-200 font-medium truncate">{item.title}</p>
          <span className="text-[10px] font-mono text-ice-500 ml-2 flex-shrink-0">{item.duration}</span>
        </div>
        <div className="flex items-center gap-2">
          <WaveformPreview color={item.waveColor} barCount={32} />
        </div>
        <div className="flex items-center gap-1.5 mt-1">
          <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/5 text-ice-400 border border-white/10">{item.genre}</span>
          <span className="text-[9px] text-ice-500">{item.bpm} BPM</span>
          <span className={`text-[9px] ml-auto ${item.license === 'Free' ? 'text-emerald-400' : 'text-amber-400'}`}>
            {item.license === 'Free' ? 'FREE' : 'PRO'}
          </span>
        </div>
      </div>

      {/* Add button */}
      <button
        className="w-6 h-6 rounded flex-shrink-0 flex items-center justify-center bg-white/5 hover:bg-cyan-500/20 border border-white/10 hover:border-cyan-500/40 text-ice-400 hover:text-cyan-400 transition-all opacity-0 group-hover:opacity-100"
        onClick={() => onAdd(item)}
      >
        <Plus className="w-3 h-3" />
      </button>
    </div>
  );
}

function PhotoCard({ item, onAdd }) {
  const [hovered, setHovered] = useState(false);

  return (
    <motion.div
      className="group relative rounded-lg overflow-hidden cursor-pointer border border-white/5 hover:border-cyan-500/30 transition-colors"
      onHoverStart={() => setHovered(true)}
      onHoverEnd={() => setHovered(false)}
      whileHover={{ y: -2 }}
      transition={{ duration: 0.15 }}
    >
      <div className={`aspect-[4/3] bg-gradient-to-br ${item.gradient} relative`}>
        <div className="absolute inset-0 opacity-10"
          style={{ backgroundImage: 'linear-gradient(45deg, white 1px, transparent 1px), linear-gradient(-45deg, white 1px, transparent 1px)', backgroundSize: '20px 20px' }}
        />
        <div className="absolute top-1.5 right-1.5">
          <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
            item.license === 'Free'
              ? 'bg-emerald-500/30 text-emerald-300 border border-emerald-500/40'
              : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
          }`}>
            {item.license === 'Free' ? 'FREE' : 'PRO'}
          </span>
        </div>
        <AnimatePresence>
          {hovered && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/50 flex items-center justify-center"
            >
              <button
                className="p-2 rounded-full bg-cyan-500/80 hover:bg-cyan-400/80 transition-colors"
                onClick={() => onAdd(item)}
              >
                <Plus className="w-3.5 h-3.5 text-white" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <div className="px-2 py-1.5 bg-[#0D1526]">
        <p className="text-[11px] text-ice-200 truncate font-medium">{item.title}</p>
        <p className="text-[10px] text-ice-500">{item.res}</p>
      </div>
    </motion.div>
  );
}

function SFXCard({ item, onAdd }) {
  const [playing, setPlaying] = useState(false);

  return (
    <div className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg hover:bg-white/5 border border-transparent hover:border-white/10 group transition-all cursor-pointer">
      <button
        className={`w-7 h-7 rounded flex-shrink-0 flex items-center justify-center border transition-all ${
          playing
            ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-400'
            : 'bg-white/5 border-white/10 text-ice-400'
        }`}
        onClick={() => setPlaying(!playing)}
      >
        {playing ? (
          <div className="w-2.5 h-2.5 rounded-sm bg-current" />
        ) : (
          <Play className="w-3 h-3 fill-current" />
        )}
      </button>

      <div className="flex-1 min-w-0">
        <p className="text-[11px] text-ice-200 font-medium truncate">{item.title}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <WaveformPreview color={item.waveColor} barCount={20} />
          <span className="text-[9px] font-mono text-ice-500">{item.duration}</span>
        </div>
      </div>

      <div className="flex items-center gap-1.5 flex-shrink-0">
        <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/5 text-ice-400 border border-white/10">{item.category}</span>
        <button
          className="w-6 h-6 rounded flex items-center justify-center bg-white/5 hover:bg-cyan-500/20 border border-white/10 hover:border-cyan-500/40 text-ice-400 hover:text-cyan-400 transition-all opacity-0 group-hover:opacity-100"
          onClick={() => onAdd(item)}
        >
          <Plus className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}

// ─── Preview Modal ────────────────────────────────────────────────────────────

function PreviewModal({ item, onClose }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-6"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="bg-[#0D1526] border border-white/10 rounded-xl overflow-hidden w-full max-w-lg shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className={`aspect-video bg-gradient-to-br ${item.gradient} relative flex items-center justify-center`}>
          <div className="w-14 h-14 rounded-full bg-black/40 border border-white/20 flex items-center justify-center">
            <Play className="w-6 h-6 text-white fill-white ml-0.5" />
          </div>
          <button
            className="absolute top-3 right-3 w-7 h-7 rounded-full bg-black/40 hover:bg-black/60 flex items-center justify-center text-white transition-colors"
            onClick={onClose}
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="p-4">
          <h3 className="text-sm font-semibold text-ice-100 mb-1">{item.title}</h3>
          <div className="flex items-center gap-2 text-[11px] text-ice-400">
            {item.duration && <span className="font-mono">{item.duration}</span>}
            {item.res && <span>{item.res}</span>}
            {item.fps && <span>{item.fps}fps</span>}
            {item.topic && <span>{item.topic}</span>}
          </div>
          <div className="flex gap-2 mt-4">
            <button
              className="flex-1 py-2 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/40 text-cyan-400 text-xs font-medium transition-colors"
              onClick={onClose}
            >
              Add to Timeline
            </button>
            <button
              className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-ice-300 text-xs transition-colors"
              onClick={onClose}
            >
              Close
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Main Panel ───────────────────────────────────────────────────────────────

export default function StockPanel() {
  const addMediaItem = useEditorStore((s) => s.addMediaItem);

  const [activeCategory, setActiveCategory] = useState('trending');
  const [searchQuery, setSearchQuery]       = useState('');
  const [activeTopic, setActiveTopic]       = useState(null);
  const [activeLicense, setActiveLicense]   = useState('All Licenses');
  const [sortBy, setSortBy]                 = useState('Relevance');
  const [previewItem, setPreviewItem]       = useState(null);
  const [showFilters, setShowFilters]       = useState(false);

  // Filter items based on current category / search / topic / license
  const filteredItems = useMemo(() => {
    let items = ALL_ITEMS;

    // Category filter
    if (activeCategory === 'video')    items = items.filter(i => i.type === 'video');
    else if (activeCategory === 'music') items = items.filter(i => i.type === 'music');
    else if (activeCategory === 'photo') items = items.filter(i => i.type === 'photo');
    else if (activeCategory === 'sfx')   items = items.filter(i => i.type === 'sfx');
    else if (activeCategory === 'featured') items = items.filter((_, idx) => idx % 2 === 0);
    // trending = all items

    // Search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      items = items.filter(i => i.title.toLowerCase().includes(q) || (i.topic || '').toLowerCase().includes(q) || (i.genre || '').toLowerCase().includes(q));
    }

    // Topic filter
    if (activeTopic) {
      items = items.filter(i => (i.topic || i.genre || i.category || '') === activeTopic);
    }

    // License
    if (activeLicense !== 'All Licenses') {
      items = items.filter(i => i.license === activeLicense);
    }

    return items;
  }, [activeCategory, searchQuery, activeTopic, activeLicense]);

  const videoResults  = filteredItems.filter(i => i.type === 'video');
  const musicResults  = filteredItems.filter(i => i.type === 'music');
  const photoResults  = filteredItems.filter(i => i.type === 'photo');
  const sfxResults    = filteredItems.filter(i => i.type === 'sfx');

  const handleAdd = (item) => {
    addMediaItem({
      id: item.id,
      name: item.title,
      type: item.type === 'photo' ? 'image' : item.type === 'music' || item.type === 'sfx' ? 'audio' : 'video',
      duration: item.duration ? parseFloat(item.duration.replace(':', '.')) * (item.duration.includes(':') ? 1 : 1) : 5,
      thumbnail: null,
      gradient: item.gradient || null,
    });
  };

  const currentCat = STOCK_CATEGORIES.find(c => c.id === activeCategory);

  const showVideos = (activeCategory === 'trending' || activeCategory === 'featured' || activeCategory === 'video') && videoResults.length > 0;
  const showMusic  = (activeCategory === 'trending' || activeCategory === 'featured' || activeCategory === 'music') && musicResults.length > 0;
  const showPhotos = (activeCategory === 'trending' || activeCategory === 'featured' || activeCategory === 'photo') && photoResults.length > 0;
  const showSFX    = (activeCategory === 'trending' || activeCategory === 'featured' || activeCategory === 'sfx')   && sfxResults.length > 0;

  return (
    <div className="flex flex-col h-full text-ice-200">

      {/* ── Header ── */}
      <div className="px-3 pt-3 pb-2 border-b border-white/5">
        <div className="flex items-center gap-2 mb-2.5">
          <Globe className="w-4 h-4 text-cyan-400 flex-shrink-0" />
          <span className="text-xs font-semibold text-ice-100 tracking-wide">Stock Media</span>
          <span className="ml-auto text-[10px] text-cyan-400 font-medium bg-cyan-500/10 border border-cyan-500/20 px-1.5 py-0.5 rounded">
            {filteredItems.length} items
          </span>
        </div>

        {/* Search */}
        <div className="relative mb-2.5">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-ice-500 pointer-events-none" />
          <input
            type="text"
            placeholder="Search stock media…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="ef-input pl-8 pr-8 w-full"
          />
          {searchQuery && (
            <button
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ice-500 hover:text-ice-300 transition-colors"
              onClick={() => setSearchQuery('')}
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        {/* Category tabs */}
        <div className="flex gap-1 overflow-x-auto scrollbar-hide pb-1">
          {STOCK_CATEGORIES.map((cat) => {
            const Icon = cat.icon;
            return (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`flex-shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-medium transition-all ${
                  activeCategory === cat.id
                    ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40'
                    : 'text-ice-400 hover:bg-white/5 border border-transparent hover:border-white/10'
                }`}
              >
                <Icon className="w-2.5 h-2.5" />
                {cat.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Filters bar ── */}
      <div className="px-3 py-2 border-b border-white/5 flex items-center gap-1.5">
        <button
          className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] border transition-colors ${
            showFilters
              ? 'bg-lavender-500/20 border-lavender-500/40 text-lavender-300'
              : 'bg-white/5 border-white/10 text-ice-400 hover:border-white/20'
          }`}
          onClick={() => setShowFilters(!showFilters)}
        >
          <Filter className="w-2.5 h-2.5" />
          Filters
          {(activeTopic || activeLicense !== 'All Licenses') && (
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 ml-0.5" />
          )}
        </button>

        {/* Sort */}
        <div className="relative ml-auto">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="appearance-none bg-white/5 border border-white/10 text-ice-400 text-[10px] pl-2 pr-5 py-1 rounded cursor-pointer focus:outline-none hover:border-white/20 transition-colors"
          >
            {SORT_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
          </select>
          <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 w-2.5 h-2.5 text-ice-500 pointer-events-none" />
        </div>
      </div>

      {/* Expanded filters */}
      <AnimatePresence>
        {showFilters && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden border-b border-white/5"
          >
            <div className="px-3 py-2 space-y-2">
              {/* Topics */}
              <div>
                <p className="text-[9px] uppercase tracking-wider text-ice-500 mb-1.5 font-semibold">Topic</p>
                <div className="flex flex-wrap gap-1">
                  {TOPICS.map(topic => (
                    <button
                      key={topic}
                      onClick={() => setActiveTopic(activeTopic === topic ? null : topic)}
                      className={`px-1.5 py-0.5 rounded text-[10px] border transition-all ${
                        activeTopic === topic
                          ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-400'
                          : 'bg-white/5 border-white/10 text-ice-400 hover:border-white/20'
                      }`}
                    >
                      {topic}
                    </button>
                  ))}
                </div>
              </div>
              {/* License */}
              <div>
                <p className="text-[9px] uppercase tracking-wider text-ice-500 mb-1.5 font-semibold">License</p>
                <div className="flex gap-1">
                  {LICENSES.map(lic => (
                    <button
                      key={lic}
                      onClick={() => setActiveLicense(lic)}
                      className={`px-2 py-0.5 rounded text-[10px] border transition-all ${
                        activeLicense === lic
                          ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-400'
                          : 'bg-white/5 border-white/10 text-ice-400 hover:border-white/20'
                      }`}
                    >
                      {lic}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Results ── */}
      <div className="flex-1 overflow-y-auto scrollbar-hide px-3 pb-4 pt-3 space-y-4">
        {filteredItems.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-ice-500">
            <Globe className="w-8 h-8 mb-3 opacity-30" />
            <p className="text-xs font-medium">No results found</p>
            <p className="text-[10px] mt-1">Try a different search or filter</p>
          </div>
        )}

        {/* Videos */}
        {showVideos && (
          <section>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-[10px] uppercase tracking-widest font-bold text-ice-500 flex items-center gap-1.5">
                <Film className="w-3 h-3 text-cyan-400" /> Stock Video
              </h3>
              <span className="text-[10px] text-ice-500">{videoResults.length}</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {videoResults.map(item => (
                <VideoCard
                  key={item.id}
                  item={item}
                  onAdd={handleAdd}
                  onPreview={setPreviewItem}
                />
              ))}
            </div>
          </section>
        )}

        {/* Music */}
        {showMusic && (
          <section>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-[10px] uppercase tracking-widest font-bold text-ice-500 flex items-center gap-1.5">
                <Music className="w-3 h-3 text-lavender-400" /> Music
              </h3>
              <span className="text-[10px] text-ice-500">{musicResults.length}</span>
            </div>
            <div className="space-y-0.5">
              {musicResults.map(item => (
                <MusicCard key={item.id} item={item} onAdd={handleAdd} />
              ))}
            </div>
          </section>
        )}

        {/* Photos */}
        {showPhotos && (
          <section>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-[10px] uppercase tracking-widest font-bold text-ice-500 flex items-center gap-1.5">
                <Image className="w-3 h-3 text-blue-400" /> Photos
              </h3>
              <span className="text-[10px] text-ice-500">{photoResults.length}</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {photoResults.map(item => (
                <PhotoCard key={item.id} item={item} onAdd={handleAdd} />
              ))}
            </div>
          </section>
        )}

        {/* SFX */}
        {showSFX && (
          <section>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-[10px] uppercase tracking-widest font-bold text-ice-500 flex items-center gap-1.5">
                <Zap className="w-3 h-3 text-amber-400" /> Sound Effects
              </h3>
              <span className="text-[10px] text-ice-500">{sfxResults.length}</span>
            </div>
            <div className="space-y-0.5">
              {sfxResults.map(item => (
                <SFXCard key={item.id} item={item} onAdd={handleAdd} />
              ))}
            </div>
          </section>
        )}
      </div>

      {/* Preview modal */}
      <AnimatePresence>
        {previewItem && (
          <PreviewModal item={previewItem} onClose={() => setPreviewItem(null)} />
        )}
      </AnimatePresence>
    </div>
  );
}
