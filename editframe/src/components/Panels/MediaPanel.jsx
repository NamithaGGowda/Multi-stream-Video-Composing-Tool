import { useState, useRef, useCallback } from 'react';
import { Upload, Search, Film, Music, Image, X,
         Plus, Trash2, HardDrive, RefreshCw, AlertCircle, Eye } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useEditorStore } from '../../store/editorStore.js';
import { useMedia } from '../../hooks/useMedia.js';
import toast from 'react-hot-toast';
import AssetPreviewModal from '../Media/AssetPreviewModal.jsx';

const TYPE_TABS = [
  { id: null,    label: 'All'   },
  { id: 'VIDEO', label: 'Video' },
  { id: 'AUDIO', label: 'Audio' },
  { id: 'IMAGE', label: 'Image' },
];

function formatDuration(secs) {
  if (!secs) return null;
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function formatSize(mb) {
  if (!mb) return null;
  return mb < 1 ? `${Math.round(mb * 1000)}KB` : `${mb.toFixed(1)}MB`;
}

// ─── Asset card ───────────────────────────────────────────────────────────────

function AssetCard({ asset, onPreview, onAddToTimeline, onDelete }) {
  const [hovered, setHovered] = useState(false);

  const typeColor = {
    VIDEO: 'text-cyan-400 bg-cyan-500/15',
    AUDIO: 'text-purple-400 bg-purple-500/15',
    IMAGE: 'text-blue-400 bg-blue-500/15',
  }[asset.type] || 'text-white/40 bg-white/5';

  const TypeIcon = asset.type === 'VIDEO' ? Film :
                   asset.type === 'AUDIO' ? Music : Image;

  return (
    <motion.div
      className="group relative rounded-lg overflow-hidden border border-white/8 hover:border-cyan-500/40 transition-all cursor-pointer bg-[#0D1526]"
      onHoverStart={() => setHovered(true)}
      onHoverEnd={() => setHovered(false)}
      whileHover={{ y: -1 }}
      onClick={() => onPreview(asset)}
    >
      {/* Thumbnail */}
      <div className="aspect-video relative overflow-hidden bg-[#0A0F1E]">
        {asset.thumbnailUrl ? (
          <img src={asset.thumbnailUrl} alt={asset.name} className="w-full h-full object-cover" />
        ) : (
          <div className={`w-full h-full flex items-center justify-center`}>
            <div className={`p-2.5 rounded-xl ${typeColor}`}>
              <TypeIcon className="w-5 h-5" />
            </div>
          </div>
        )}

        {/* Duration */}
        {asset.duration && (
          <span className="absolute bottom-1 left-1 text-[9px] font-mono bg-black/70 text-white/80 px-1 rounded">
            {formatDuration(asset.duration)}
          </span>
        )}

        {/* Type badge */}
        <span className={`absolute top-1 left-1 text-[9px] font-bold px-1.5 py-0.5 rounded flex items-center gap-0.5 ${typeColor}`}>
          <TypeIcon className="w-2.5 h-2.5" /> {asset.type}
        </span>

        {/* Hover overlay */}
        <AnimatePresence>
          {hovered && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 flex items-center justify-center gap-2"
            >
              {/* Preview button */}
              <button
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 border border-white/20 text-white text-[11px] font-medium transition-colors"
                onClick={(e) => { e.stopPropagation(); onPreview(asset); }}
              >
                <Eye className="w-3 h-3" /> View
              </button>
              {/* Add to timeline */}
              <button
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-cyan-500/80 hover:bg-cyan-400 text-white text-[11px] font-medium transition-colors"
                onClick={(e) => { e.stopPropagation(); onAddToTimeline(asset); }}
              >
                <Plus className="w-3 h-3" /> Add
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Info */}
      <div className="px-2 py-1.5">
        <p className="text-[11px] text-white/80 truncate font-medium">{asset.name}</p>
        <div className="flex items-center gap-1.5 mt-0.5 text-[10px] text-white/30">
          {asset.fileSizeMb && (
            <span className="flex items-center gap-0.5">
              <HardDrive className="w-2.5 h-2.5" />
              {formatSize(asset.fileSizeMb)}
            </span>
          )}
          {asset.width && asset.height && (
            <span>{asset.width}×{asset.height}</span>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ─── Upload zone ──────────────────────────────────────────────────────────────

function UploadZone({ onFiles, uploading, uploadProgress }) {
  const inputRef = useRef();
  const [dragging, setDragging] = useState(false);

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length) onFiles(files);
  };

  return (
    <div
      className={`border-2 border-dashed rounded-xl p-4 text-center transition-all cursor-pointer ${
        dragging ? 'border-cyan-500/70 bg-cyan-500/10' : 'border-white/10 hover:border-white/20 hover:bg-white/3'
      }`}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      onClick={() => !uploading && inputRef.current?.click()}
    >
      <input
        ref={inputRef}
        type="file"
        multiple
        accept="video/*,audio/*,image/*"
        className="hidden"
        onChange={(e) => onFiles(Array.from(e.target.files))}
      />
      {uploading ? (
        <div className="py-1">
          <div className="w-full bg-white/10 rounded-full h-1.5 mb-2">
            <div className="bg-cyan-400 h-1.5 rounded-full transition-all" style={{ width: `${uploadProgress}%` }} />
          </div>
          <p className="text-xs text-cyan-400 font-medium">Uploading… {uploadProgress}%</p>
        </div>
      ) : (
        <>
          <Upload className="w-5 h-5 text-white/30 mx-auto mb-1.5" />
          <p className="text-xs text-white/50">
            Drop files or <span className="text-cyan-400">browse</span>
          </p>
          <p className="text-[10px] text-white/25 mt-0.5">Video · Audio · Image</p>
        </>
      )}
    </div>
  );
}

// ─── Main panel ───────────────────────────────────────────────────────────────

export default function MediaPanel() {
  const addMediaItem    = useEditorStore((s) => s.addMediaItem);
  const isAuthenticated = !!useEditorStore((s) => s.accessToken);

  const {
    assets, loading, uploading, uploadProgress,
    typeFilter, setTypeFilter,
    loadAssets, uploadFile, uploadFiles, deleteAsset,
  } = useMedia(isAuthenticated);

  const [search, setSearch]           = useState('');
  const [previewAsset, setPreviewAsset] = useState(null);
  const [previewIndex, setPreviewIndex] = useState(0);

  const filtered = assets.filter((a) =>
    !search || a.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleFiles = useCallback(async (files) => {
    if (!isAuthenticated) { toast.error('Please log in to upload files'); return; }
    if (files.length === 1) {
      await uploadFile(files[0]);
    } else {
      await uploadFiles(files);
    }
  }, [isAuthenticated, uploadFile, uploadFiles]);

  const handlePreview = useCallback((asset) => {
    const idx = filtered.findIndex((a) => a.id === asset.id);
    setPreviewIndex(idx >= 0 ? idx : 0);
    setPreviewAsset(asset);
  }, [filtered]);

  const handleAddToTimeline = useCallback((asset) => {
    addMediaItem({
      id:            asset.id,
      name:          asset.name,
      type:          asset.type.toLowerCase(),
      duration:      asset.duration || 5,
      thumbnail:     asset.thumbnailUrl || null,
      cloudinaryUrl: asset.cloudinarySecureUrl || asset.cloudinaryUrl,
    });
    toast.success(`${asset.name} added to timeline`);
  }, [addMediaItem]);

  const navigatePreview = useCallback((direction) => {
    const newIndex = previewIndex + direction;
    if (newIndex >= 0 && newIndex < filtered.length) {
      setPreviewIndex(newIndex);
      setPreviewAsset(filtered[newIndex]);
    }
  }, [previewIndex, filtered]);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-3 pt-3 pb-2 border-b border-white/5">
        <div className="flex items-center justify-between mb-2.5">
          <span className="text-xs font-semibold text-white/70 tracking-wide uppercase">Media Library</span>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-white/30">{assets.length} files</span>
            <button onClick={() => loadAssets()} className="p-1 rounded text-white/30 hover:text-white/60 hover:bg-white/5 transition-colors" title="Refresh">
              <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        <UploadZone onFiles={handleFiles} uploading={uploading} uploadProgress={uploadProgress} />

        <div className="relative mt-2.5">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/25 pointer-events-none" />
          <input
            type="text"
            placeholder="Search files…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-white/5 border border-white/8 rounded-lg pl-8 pr-7 py-1.5 text-xs text-white placeholder-white/20 focus:outline-none focus:border-cyan-500/40 transition-colors"
          />
          {search && (
            <button className="absolute right-2 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60" onClick={() => setSearch('')}>
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        <div className="flex gap-1 mt-2">
          {TYPE_TABS.map((tab) => (
            <button
              key={String(tab.id)}
              onClick={() => setTypeFilter(tab.id)}
              className={`flex-1 py-1 rounded-md text-[10px] font-medium transition-all ${
                typeFilter === tab.id
                  ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                  : 'text-white/40 hover:bg-white/5 border border-transparent'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto scrollbar-hide p-3">
        {!isAuthenticated && (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <AlertCircle className="w-7 h-7 text-white/20 mb-2" />
            <p className="text-xs text-white/40">Log in to access your media library</p>
          </div>
        )}
        {isAuthenticated && loading && assets.length === 0 && (
          <div className="flex flex-col items-center justify-center py-10 gap-2">
            <RefreshCw className="w-5 h-5 text-cyan-400 animate-spin" />
            <p className="text-xs text-white/40">Loading your files…</p>
          </div>
        )}
        {isAuthenticated && !loading && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <Film className="w-8 h-8 text-white/15 mb-2" />
            <p className="text-xs text-white/40 font-medium">
              {search ? 'No files match your search' : 'No files yet'}
            </p>
            <p className="text-[10px] text-white/25 mt-1">
              {search ? 'Try a different term' : 'Upload a video, audio, or image above'}
            </p>
          </div>
        )}
        {filtered.length > 0 && (
          <div className="grid grid-cols-2 gap-2">
            {filtered.map((asset) => (
              <AssetCard
                key={asset.id}
                asset={asset}
                onPreview={handlePreview}
                onAddToTimeline={handleAddToTimeline}
                onDelete={deleteAsset}
              />
            ))}
          </div>
        )}
      </div>

      {/* Preview modal */}
      <AnimatePresence>
        {previewAsset && (
          <AssetPreviewModal
            asset={previewAsset}
            onClose={() => setPreviewAsset(null)}
            onAddToTimeline={handleAddToTimeline}
            onDelete={deleteAsset}
            onPrev={() => navigatePreview(-1)}
            onNext={() => navigatePreview(1)}
            hasPrev={previewIndex > 0}
            hasNext={previewIndex < filtered.length - 1}
          />
        )}
      </AnimatePresence>
    </div>
  );
}