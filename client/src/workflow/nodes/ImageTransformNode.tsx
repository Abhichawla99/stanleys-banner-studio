import { Handle, Position, type NodeProps, useEdges } from '@xyflow/react'
import { Crop } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { useNodeStore } from '../store'
import { NodeMenu } from '../components/NodeMenu'

export function ImageTransformNode({ id, selected }: NodeProps) {
  const { nodes, updateNodeData } = useNodeStore()
  const edges = useEdges()
  const node = nodes.find(n => n.id === id)
  const data = (node?.data as Record<string, unknown>) ?? {}
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const width = (data.width as number) ?? 512
  const height = (data.height as number) ?? 512
  const fit = (data.fit as string) ?? 'cover'
  const outputUrl = (data.outputUrl as string) ?? ''

  function getSourceImage(): string {
    const edge = edges.find(e => e.target === id)
    if (!edge) return ''
    const src = nodes.find(n => n.id === edge.source)
    return ((src?.data as Record<string, unknown>)?.imageUrl as string) ?? ''
  }

  function process() {
    const srcUrl = getSourceImage()
    if (!srcUrl) return
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')!
    const img = new window.Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      ctx.clearRect(0, 0, width, height)
      if (fit === 'fill') {
        ctx.drawImage(img, 0, 0, width, height)
      } else if (fit === 'contain') {
        const scale = Math.min(width / img.width, height / img.height)
        const sw = img.width * scale
        const sh = img.height * scale
        const sx = (width - sw) / 2
        const sy = (height - sh) / 2
        ctx.fillStyle = '#000'
        ctx.fillRect(0, 0, width, height)
        ctx.drawImage(img, sx, sy, sw, sh)
      } else {
        // cover — crop to fill
        const scale = Math.max(width / img.width, height / img.height)
        const sw = img.width * scale
        const sh = img.height * scale
        const sx = (width - sw) / 2
        const sy = (height - sh) / 2
        ctx.drawImage(img, sx, sy, sw, sh)
      }
      const dataUrl = canvas.toDataURL('image/png')
      updateNodeData(id, { outputUrl: dataUrl })
    }
    img.src = srcUrl
  }

  // Auto-process when source image changes
  const sourceUrl = getSourceImage()
  useEffect(() => {
    if (sourceUrl) process()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceUrl, width, height, fit])

  const PRESETS = [
    { label: '1:1 512', w: 512, h: 512 },
    { label: '1:1 1024', w: 1024, h: 1024 },
    { label: '16:9', w: 1280, h: 720 },
    { label: '9:16', w: 720, h: 1280 },
    { label: '4:3', w: 1024, h: 768 },
    { label: '3:2', w: 1024, h: 683 },
  ]

  return (
    <div className={`node-wrapper ${selected ? 'selected' : ''}`} data-node-type="imageTransform" style={{ minWidth: 300 }}>
      <Handle type="target" position={Position.Left} style={{ top: '50%' }} />
      <div className="node-header">
        <Crop size={13} color="#fb923c" />
        <span style={{ color: '#fb923c' }}>Image Resize / Crop</span>
        <NodeMenu id={id} />
      </div>
      <div className="node-body">
        {/* Presets */}
        <div>
          <div className="field-label">Presets</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {PRESETS.map(p => (
              <button
                key={p.label}
                onClick={() => updateNodeData(id, { width: p.w, height: p.h })}
                style={{
                  fontSize: 10, padding: '3px 8px', borderRadius: 4, cursor: 'pointer',
                  background: width === p.w && height === p.h ? 'var(--accent)' : 'var(--s3)',
                  border: `1px solid ${width === p.w && height === p.h ? 'var(--accent)' : 'var(--border)'}`,
                  color: width === p.w && height === p.h ? '#fff' : 'var(--t2)',
                }}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* W x H */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
          <div>
            <div className="field-label">Width</div>
            <input
              type="number"
              value={width}
              min={32} max={4096} step={8}
              onChange={e => updateNodeData(id, { width: Number(e.target.value) })}
            />
          </div>
          <div>
            <div className="field-label">Height</div>
            <input
              type="number"
              value={height}
              min={32} max={4096} step={8}
              onChange={e => updateNodeData(id, { height: Number(e.target.value) })}
            />
          </div>
          <div>
            <div className="field-label">Fit</div>
            <select value={fit} onChange={e => updateNodeData(id, { fit: e.target.value })}>
              <option value="cover">Cover (crop)</option>
              <option value="contain">Contain (letterbox)</option>
              <option value="fill">Fill (stretch)</option>
            </select>
          </div>
        </div>

        <button className="btn-run" onClick={process} disabled={!sourceUrl}>
          <Crop size={13} /> Apply Transform
        </button>

        {/* Hidden canvas for processing */}
        <canvas ref={canvasRef} style={{ display: 'none' }} />

        {!sourceUrl && (
          <div style={{ fontSize: 11, color: 'var(--t3)', textAlign: 'center', padding: '4px 0' }}>
            Connect an image node to transform
          </div>
        )}

        {outputUrl && (
          <div style={{ margin: '0 -12px -12px', borderTop: '1px solid var(--border)' }}>
            <div className="checker-bg" style={{ borderRadius: '0 0 11px 11px', overflow: 'hidden' }}>
              <img src={outputUrl} alt="Transformed" style={{ width: '100%', display: 'block', maxHeight: 260, objectFit: 'contain' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 12px', borderTop: '1px solid var(--border)' }}>
              <span style={{ fontSize: 10, color: 'var(--t3)' }}>{width} × {height}px</span>
              <a
                href={outputUrl}
                download="transformed.png"
                style={{ fontSize: 11, color: 'var(--t3)', textDecoration: 'none' }}
              >
                ↓ Save
              </a>
            </div>
          </div>
        )}
      </div>
      <Handle type="source" position={Position.Right} style={{ top: '50%' }} />
    </div>
  )
}
