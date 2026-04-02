import { useState, useEffect } from 'react'
import { ChevronLeft, ChevronRight, Maximize2, Download } from 'lucide-react'

export interface HistoryItem {
  url: string
  timestamp: number
  prompt: string
}

interface ImageHistoryProps {
  imageUrl: string
  history: HistoryItem[]
  onSelectImage: (url: string) => void
  downloadName?: string
}

export function ImageHistory({ imageUrl, history, onSelectImage, downloadName = 'image' }: ImageHistoryProps) {
  const [index, setIndex] = useState(history.length > 0 ? history.length - 1 : 0)
  const [expanded, setExpanded] = useState(false)

  const hasHistory = history.length > 1
  const currentImage = history.length > 0 ? history[index]?.url : imageUrl

  useEffect(() => {
    if (history.length > 0 && index >= history.length) {
      setIndex(history.length - 1)
    }
  }, [history.length])

  // Jump to latest when new generation comes in
  useEffect(() => {
    if (history.length > 0) setIndex(history.length - 1)
  }, [history.length])

  function select(i: number) {
    setIndex(i)
    if (history[i]) onSelectImage(history[i].url)
  }

  if (!currentImage) return null

  return (
    <div style={{ margin: '0 -12px -12px', borderTop: '1px solid var(--border)' }}>
      {/* Carousel controls */}
      {hasHistory && (
        <div className="gen-carousel-bar">
          <button
            className="gen-carousel-btn"
            onClick={() => select(Math.max(0, index - 1))}
            disabled={index === 0}
          >
            <ChevronLeft size={14} />
          </button>
          <span className="gen-carousel-count">{index + 1} / {history.length}</span>
          <button
            className="gen-carousel-btn"
            onClick={() => select(Math.min(history.length - 1, index + 1))}
            disabled={index === history.length - 1}
          >
            <ChevronRight size={14} />
          </button>
          <div style={{ flex: 1 }} />
          <button className="gen-carousel-btn" onClick={() => setExpanded(!expanded)}>
            <Maximize2 size={12} />
          </button>
          <a href={currentImage} download={`${downloadName}-${index + 1}.png`} className="gen-carousel-btn" style={{ textDecoration: 'none' }}>
            <Download size={12} />
          </a>
        </div>
      )}

      {/* Main image */}
      <div className="checker-bg" style={{ borderRadius: hasHistory ? 0 : '0 0 11px 11px', overflow: 'hidden' }}>
        <img src={currentImage} alt="Generated" style={{ width: '100%', display: 'block', maxHeight: expanded ? 600 : 350, objectFit: 'contain' }} />
      </div>

      {/* Thumbnail strip */}
      {hasHistory && (
        <div className="gen-history-strip">
          {history.map((item, i) => (
            <button
              key={i}
              className={`gen-history-thumb ${i === index ? 'active' : ''}`}
              onClick={() => select(i)}
              title={item.prompt || `Generation ${i + 1}`}
            >
              <img src={item.url} alt={`Gen ${i + 1}`} />
            </button>
          ))}
        </div>
      )}

      {/* Simple download link (single image, no history) */}
      {!hasHistory && (
        <a
          href={currentImage}
          download={`${downloadName}.png`}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, padding: '7px 12px', fontSize: 11, color: 'var(--t3)', textDecoration: 'none', borderTop: '1px solid var(--border)' }}
        >
          ↓ Save Image
        </a>
      )}
    </div>
  )
}

/** Helper to push a new result into node history and return updated data */
export function pushHistory(
  currentHistory: HistoryItem[],
  newUrl: string,
  prompt: string,
): { imageUrl: string; history: HistoryItem[] } {
  const item: HistoryItem = { url: newUrl, timestamp: Date.now(), prompt: prompt.slice(0, 80) }
  const history = [...currentHistory, item]
  return { imageUrl: newUrl, history }
}
