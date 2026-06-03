import { useEffect } from 'react'
import { useEditorStore } from '../store/editorStore.js'

export function useKeyboardShortcuts() {
  const {
    togglePlay,
    undo,
    redo,
    zoomIn,
    zoomOut,
    deleteSelectedClips,
    splitClipAt,
    currentTime,
    selectedClipIds,
    setCurrentTime,
    duration,
    setExportModalOpen,
  } = useEditorStore()

  useEffect(() => {
    const handler = (e) => {
      // Don't fire when typing in inputs
      if (
        e.target.tagName === 'INPUT' ||
        e.target.tagName === 'TEXTAREA' ||
        e.target.isContentEditable
      ) return

      const ctrl = e.ctrlKey || e.metaKey

      switch (e.key) {
        // ── Playback ──
        case ' ':
          e.preventDefault()
          togglePlay()
          break
        case 'k':
          if (!ctrl) {
            e.preventDefault()
            togglePlay()
          }
          break
        case 'j':
          if (!ctrl) {
            e.preventDefault()
            setCurrentTime(currentTime - 5)
          }
          break
        case 'l':
          if (!ctrl) {
            e.preventDefault()
            setCurrentTime(currentTime + 5)
          }
          break
        case 'ArrowLeft':
          e.preventDefault()
          setCurrentTime(currentTime - (e.shiftKey ? 10 : 1))
          break
        case 'ArrowRight':
          e.preventDefault()
          setCurrentTime(currentTime + (e.shiftKey ? 10 : 1))
          break
        case 'Home':
          e.preventDefault()
          setCurrentTime(0)
          break
        case 'End':
          e.preventDefault()
          setCurrentTime(duration)
          break

        // ── Edit ──
        case 'z':
          if (ctrl && e.shiftKey) { e.preventDefault(); redo() }
          else if (ctrl) { e.preventDefault(); undo() }
          break
        case 'y':
          if (ctrl) { e.preventDefault(); redo() }
          break
        case 'Delete':
        case 'Backspace':
          if (selectedClipIds.length > 0) {
            e.preventDefault()
            deleteSelectedClips()
          }
          break

        // ── Timeline zoom ──
        case '=':
        case '+':
          if (ctrl) { e.preventDefault(); zoomIn() }
          break
        case '-':
          if (ctrl) { e.preventDefault(); zoomOut() }
          break

        // ── Split ──
        case 's':
          if (!ctrl && selectedClipIds.length > 0) {
            e.preventDefault()
            selectedClipIds.forEach(id => splitClipAt(id, currentTime))
          }
          break

        // ── Export ──
        case 'e':
          if (ctrl) { e.preventDefault(); setExportModalOpen(true) }
          break

        default:
          break
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [
    togglePlay, undo, redo, zoomIn, zoomOut,
    deleteSelectedClips, splitClipAt, currentTime,
    selectedClipIds, setCurrentTime, duration, setExportModalOpen
  ])
}
