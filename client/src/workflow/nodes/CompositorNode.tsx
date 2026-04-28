import { Handle, Position, type NodeProps, useEdges } from '@xyflow/react'
import { Layers, Plus, Trash2, ChevronUp, ChevronDown } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useNodeStore } from '../store'
import { NodeMenu } from '../components/NodeMenu'

type Fit = 'cover' | 'contain' | 'fill' | 'native'
type Blend = 'normal' | 'multiply' | 'screen' | 'overlay' | 'darken' | 'lighten'

interface Layer {
  id: string
  name: string
  enabled: boolean
  x: number      // % of canvas
  y: number      // % of canvas
  w: number      // % of canvas
  h: number      // % of canvas
  fit: Fit
  opacity: number  // 0..1
  blend: Blend
}

const MAX_LAYERS = 8

const PRESETS: { label: string; w: number; h: number }[] = [
  { label: '1:1 1024',      w: 1024, h: 1024 },
  { label: '16:9 1920',     w: 1920, h: 1080 },
  { label: '9:16 1080',     w: 1080, h: 1920 },
  { label: '4:5 IG',        w: 1080, h: 1350 },
  { label: '4:3',           w: 1024, h: 768 },
  { label: '3:2',           w: 1200, h: 800 },
  { label: '6 Sheet',       w: 1200, h: 1800 },
  { label: '48 Sheet',      w: 2400, h: 1200 },
  { label: '96 Sheet',      w: 3000, h: 1000 },
  { label: 'Press Land',    w: 1800, h: 1200 },
  { label: 'Press Port',    w: 1200, h: 1600 },
]

function defaultLayer(idx: number): Layer {
  return {
    id: `L${idx}`,
    name: idx === 0 ? 'Background' : `Layer ${idx}`,
    enabled: true,
    x: 0, y: 0, w: 100, h: 100,
    fit: idx === 0 ? 'cover' : 'contain',
    opacity: 1,
    blend: 'normal',
  }
}

const BLEND_MODES: Blend[] = ['normal', 'multiply', 'screen', 'overlay', 'darken', 'lighten']

export function CompositorNode({ id, selected }: NodeProps) {
  const { nodes, updateNodeData } = useNodeStore()
  const edges = useEdges()
  const node = nodes.find(n => n.id === id)
  const data = (node?.data as Record<string, unknown>) ?? {}
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const width   = (data.width as number)   ?? 1200
  const height  = (data.height as number)  ?? 1200
  const bgColor = (data.bgColor as string) ?? '#ffffff'
  const layers: Layer[] = ((data.layers as Layer[]) ?? [defaultLayer(0), defaultLayer(1)])
  const selectedLayerIdx = (data.selectedLayerIdx as number) ?? 0
  const outputUrl = (data.outputUrl as string) ?? ''
  const sel = layers[selectedLayerIdx] ?? layers[0]
  const editorRef = useRef<HTMLDivElement>(null)
  const [snapGuides, setSnapGuides] = useState<{ x: number[]; y: number[] }>({ x: [], y: [] })
  const dragRef = useRef<null | {
    mode: 'move' | 'resize'
    layerIdx: number
    handle?: 'nw' | 'ne' | 'sw' | 'se' | 'n' | 's' | 'e' | 'w'
    startClientX: number
    startClientY: number
    startLayer: Layer
    rectW: number
    rectH: number
  }>(null)

  function getLayerSrc(layerId: string): string {
    const edge = edges.find(e => e.target === id && e.targetHandle === layerId)
    if (!edge) return ''
    const src = nodes.find(n => n.id === edge.source)
    const d = (src?.data as Record<string, unknown>) ?? {}
    return ((d.imageUrl as string) ?? (d.outputUrl as string) ?? '') as string
  }

  function setLayer(idx: number, patch: Partial<Layer>) {
    const next = layers.map((l, i) => i === idx ? { ...l, ...patch } : l)
    updateNodeData(id, { layers: next })
  }

  function addLayer() {
    if (layers.length >= MAX_LAYERS) return
    const next = [...layers, defaultLayer(layers.length)]
    updateNodeData(id, { layers: next, selectedLayerIdx: next.length - 1 })
  }

  function removeLayer(idx: number) {
    if (layers.length <= 1) return
    const next = layers.filter((_, i) => i !== idx)
    updateNodeData(id, { layers: next, selectedLayerIdx: Math.max(0, Math.min(selectedLayerIdx, next.length - 1)) })
  }

  function moveLayer(idx: number, dir: -1 | 1) {
    const j = idx + dir
    if (j < 0 || j >= layers.length) return
    const next = [...layers]
    const tmp = next[idx]
    next[idx] = next[j]
    next[j] = tmp
    updateNodeData(id, { layers: next, selectedLayerIdx: j })
  }

  async function compose() {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')!

    // Background fill
    ctx.fillStyle = bgColor
    ctx.fillRect(0, 0, width, height)

    // Composite each enabled layer in order
    for (const layer of layers) {
      if (!layer.enabled) continue
      const url = getLayerSrc(layer.id)
      if (!url) continue
      try {
        const img = await loadImage(url)
        const dx = (layer.x / 100) * width
        const dy = (layer.y / 100) * height
        const dw = (layer.w / 100) * width
        const dh = (layer.h / 100) * height

        ctx.save()
        ctx.globalAlpha = Math.max(0, Math.min(1, layer.opacity))
        ctx.globalCompositeOperation = layer.blend === 'normal' ? 'source-over' : (layer.blend as GlobalCompositeOperation)

        if (layer.fit === 'fill') {
          ctx.drawImage(img, dx, dy, dw, dh)
        } else if (layer.fit === 'native') {
          ctx.drawImage(img, dx, dy)
        } else {
          // cover or contain — fit img into (dw, dh) bbox
          const ratio = layer.fit === 'cover'
            ? Math.max(dw / img.width, dh / img.height)
            : Math.min(dw / img.width, dh / img.height)
          const sw = img.width * ratio
          const sh = img.height * ratio
          const sx = dx + (dw - sw) / 2
          const sy = dy + (dh - sh) / 2
          if (layer.fit === 'cover') {
            // Clip to bbox so cover doesn't bleed
            ctx.beginPath()
            ctx.rect(dx, dy, dw, dh)
            ctx.clip()
          }
          ctx.drawImage(img, sx, sy, sw, sh)
        }
        ctx.restore()
      } catch {
        // skip failed layer
      }
    }

    const dataUrl = canvas.toDataURL('image/png')
    updateNodeData(id, { outputUrl: dataUrl, imageUrl: dataUrl })
  }

  // ─── Drag / resize on the interactive preview ───
  const SNAP_TARGETS = [0, 25, 50, 75, 100]
  const SNAP_THRESHOLD = 1.5  // %

  function snap(v: number, axis: 'x' | 'y'): { v: number; hit: number | null } {
    for (const t of SNAP_TARGETS) {
      if (Math.abs(v - t) < SNAP_THRESHOLD) return { v: t, hit: t }
    }
    return { v, hit: null }
  }

  function clampLayer(l: Layer): Layer {
    const x = Math.max(-50, Math.min(150, l.x))
    const y = Math.max(-50, Math.min(150, l.y))
    const w = Math.max(1, Math.min(200, l.w))
    const h = Math.max(1, Math.min(200, l.h))
    return { ...l, x: round1(x), y: round1(y), w: round1(w), h: round1(h) }
  }

  function startDrag(e: React.PointerEvent, mode: 'move' | 'resize', layerIdx: number, handle?: any) {
    if (e.button !== 0) return
    e.stopPropagation()
    e.preventDefault()
    const rect = editorRef.current?.getBoundingClientRect()
    if (!rect) return
    updateNodeData(id, { selectedLayerIdx: layerIdx })
    dragRef.current = {
      mode, layerIdx, handle,
      startClientX: e.clientX,
      startClientY: e.clientY,
      startLayer: { ...layers[layerIdx] },
      rectW: rect.width,
      rectH: rect.height,
    }
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }

  function onPointerMove(e: React.PointerEvent) {
    const drag = dragRef.current
    if (!drag) return
    const dxPct = ((e.clientX - drag.startClientX) / drag.rectW) * 100
    const dyPct = ((e.clientY - drag.startClientY) / drag.rectH) * 100
    const s = drag.startLayer
    let next: Layer = { ...s }
    const guides: { x: number[]; y: number[] } = { x: [], y: [] }

    if (drag.mode === 'move') {
      next.x = s.x + dxPct
      next.y = s.y + dyPct
      // Snap on edges and center
      const sx1 = snap(next.x, 'x')
      const sxC = snap(next.x + next.w / 2, 'x')
      const sx2 = snap(next.x + next.w, 'x')
      if (sx1.hit != null) { next.x = sx1.v; guides.x.push(sx1.v) }
      else if (sxC.hit != null) { next.x = sxC.v - next.w / 2; guides.x.push(sxC.v) }
      else if (sx2.hit != null) { next.x = sx2.v - next.w; guides.x.push(sx2.v) }

      const sy1 = snap(next.y, 'y')
      const syC = snap(next.y + next.h / 2, 'y')
      const sy2 = snap(next.y + next.h, 'y')
      if (sy1.hit != null) { next.y = sy1.v; guides.y.push(sy1.v) }
      else if (syC.hit != null) { next.y = syC.v - next.h / 2; guides.y.push(syC.v) }
      else if (sy2.hit != null) { next.y = sy2.v - next.h; guides.y.push(sy2.v) }
    } else {
      // resize — anchor opposite corner / edge
      const h = drag.handle!
      const left = s.x, top = s.y, right = s.x + s.w, bottom = s.y + s.h
      let nl = left, nt = top, nr = right, nb = bottom
      if (h.includes('w')) nl = left + dxPct
      if (h.includes('e')) nr = right + dxPct
      if (h.includes('n')) nt = top + dyPct
      if (h.includes('s')) nb = bottom + dyPct
      // Snap edges
      if (h.includes('w')) { const sn = snap(nl, 'x'); if (sn.hit != null) { nl = sn.v; guides.x.push(sn.v) } }
      if (h.includes('e')) { const sn = snap(nr, 'x'); if (sn.hit != null) { nr = sn.v; guides.x.push(sn.v) } }
      if (h.includes('n')) { const sn = snap(nt, 'y'); if (sn.hit != null) { nt = sn.v; guides.y.push(sn.v) } }
      if (h.includes('s')) { const sn = snap(nb, 'y'); if (sn.hit != null) { nb = sn.v; guides.y.push(sn.v) } }
      // Keep min size 1%
      if (nr - nl < 1) { if (h.includes('w')) nl = nr - 1; else nr = nl + 1 }
      if (nb - nt < 1) { if (h.includes('n')) nt = nb - 1; else nb = nt + 1 }
      next.x = nl; next.y = nt; next.w = nr - nl; next.h = nb - nt
    }

    setLayer(drag.layerIdx, clampLayer(next))
    setSnapGuides(guides)
  }

  function endDrag(e: React.PointerEvent) {
    if (!dragRef.current) return
    dragRef.current = null
    setSnapGuides({ x: [], y: [] })
    try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId) } catch {}
  }

  // Auto-compose when inputs or settings change
  const sigParts = layers.map(l => `${l.id}:${getLayerSrc(l.id)}:${l.enabled}:${l.x},${l.y},${l.w},${l.h}:${l.fit}:${l.opacity}:${l.blend}`).join('|')
  const signature = `${width}x${height}|${bgColor}|${sigParts}`
  useEffect(() => { compose() /* eslint-disable-next-line */ }, [signature])

  return (
    <div className={`node-wrapper ${selected ? 'selected' : ''}`} data-node-type="compositor" style={{ minWidth: 340 }}>
      {/* Per-layer target handles down the left side */}
      {layers.map((l, i) => (
        <Handle
          key={l.id}
          type="target"
          id={l.id}
          position={Position.Left}
          style={{ top: `${20 + (i * 60) / Math.max(1, layers.length - 1) || 50}%` }}
        />
      ))}

      <div className="node-header">
        <Layers size={13} color="#0ea5e9" />
        <span style={{ color: '#0ea5e9' }}>Compositor</span>
        <NodeMenu id={id} />
      </div>

      <div className="node-body">
        {/* Canvas size */}
        <div>
          <div className="field-label">Canvas size</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 6 }}>
            {PRESETS.map(p => (
              <button
                key={p.label}
                onClick={() => updateNodeData(id, { width: p.w, height: p.h })}
                style={{
                  fontSize: 10, padding: '3px 7px', borderRadius: 4, cursor: 'pointer',
                  background: width === p.w && height === p.h ? '#0ea5e9' : 'var(--s3)',
                  border: `1px solid ${width === p.w && height === p.h ? '#0ea5e9' : 'var(--border)'}`,
                  color: width === p.w && height === p.h ? '#fff' : 'var(--t2)',
                }}
              >
                {p.label}
              </button>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
            <div>
              <div className="field-label">W</div>
              <input type="number" value={width} min={32} max={8192} step={8}
                onChange={e => updateNodeData(id, { width: Number(e.target.value) })} />
            </div>
            <div>
              <div className="field-label">H</div>
              <input type="number" value={height} min={32} max={8192} step={8}
                onChange={e => updateNodeData(id, { height: Number(e.target.value) })} />
            </div>
            <div>
              <div className="field-label">BG color</div>
              <input type="color" value={bgColor}
                onChange={e => updateNodeData(id, { bgColor: e.target.value })}
                style={{ width: '100%', height: 26, padding: 0, border: '1px solid var(--border)', borderRadius: 4, background: 'transparent' }} />
            </div>
          </div>
        </div>

        {/* Layers list */}
        <div>
          <div className="field-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Layers ({layers.length}/{MAX_LAYERS})</span>
            <button
              onClick={addLayer}
              disabled={layers.length >= MAX_LAYERS}
              style={{
                fontSize: 10, padding: '2px 6px', borderRadius: 4, cursor: 'pointer',
                background: 'var(--s3)', border: '1px solid var(--border)', color: 'var(--t2)',
                display: 'inline-flex', alignItems: 'center', gap: 3,
                opacity: layers.length >= MAX_LAYERS ? 0.4 : 1,
              }}
            >
              <Plus size={10} /> Add
            </button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {layers.map((l, i) => {
              const hasInput = !!getLayerSrc(l.id)
              const isSel = i === selectedLayerIdx
              return (
                <div
                  key={l.id}
                  onClick={() => updateNodeData(id, { selectedLayerIdx: i })}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 5,
                    padding: '4px 6px', borderRadius: 5, cursor: 'pointer',
                    background: isSel ? 'rgba(14,165,233,0.12)' : 'var(--s2)',
                    border: `1px solid ${isSel ? '#0ea5e9' : 'var(--border)'}`,
                  }}
                >
                  <input
                    type="checkbox" checked={l.enabled}
                    onClick={e => e.stopPropagation()}
                    onChange={e => setLayer(i, { enabled: e.target.checked })}
                  />
                  <span style={{ fontSize: 10, fontWeight: 700, color: '#0ea5e9', width: 22 }}>{l.id}</span>
                  <input
                    type="text" value={l.name}
                    onClick={e => e.stopPropagation()}
                    onChange={e => setLayer(i, { name: e.target.value })}
                    style={{ flex: 1, fontSize: 11, padding: '2px 5px', background: 'transparent', border: 'none', color: 'var(--t1)' }}
                  />
                  <span style={{ fontSize: 9, color: hasInput ? '#10b981' : 'var(--t3)' }}>
                    {hasInput ? '●' : '○'}
                  </span>
                  <button onClick={e => { e.stopPropagation(); moveLayer(i, -1) }} disabled={i === 0}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--t3)', padding: 1, opacity: i === 0 ? 0.3 : 1 }}>
                    <ChevronUp size={11} />
                  </button>
                  <button onClick={e => { e.stopPropagation(); moveLayer(i, 1) }} disabled={i === layers.length - 1}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--t3)', padding: 1, opacity: i === layers.length - 1 ? 0.3 : 1 }}>
                    <ChevronDown size={11} />
                  </button>
                  <button onClick={e => { e.stopPropagation(); removeLayer(i) }} disabled={layers.length <= 1}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--red)', padding: 1, opacity: layers.length <= 1 ? 0.3 : 1 }}>
                    <Trash2 size={10} />
                  </button>
                </div>
              )
            })}
          </div>
        </div>

        {/* Selected layer controls */}
        {sel && (
          <div style={{ background: 'var(--s2)', border: '1px solid var(--border)', borderRadius: 6, padding: 8 }}>
            <div className="field-label" style={{ marginBottom: 6 }}>
              Editing: <span style={{ color: '#0ea5e9' }}>{sel.name}</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 5, marginBottom: 6 }}>
              <div>
                <div className="field-label" style={{ fontSize: 9 }}>X %</div>
                <input type="number" value={sel.x} step={1}
                  onChange={e => setLayer(selectedLayerIdx, { x: Number(e.target.value) })} />
              </div>
              <div>
                <div className="field-label" style={{ fontSize: 9 }}>Y %</div>
                <input type="number" value={sel.y} step={1}
                  onChange={e => setLayer(selectedLayerIdx, { y: Number(e.target.value) })} />
              </div>
              <div>
                <div className="field-label" style={{ fontSize: 9 }}>W %</div>
                <input type="number" value={sel.w} step={1}
                  onChange={e => setLayer(selectedLayerIdx, { w: Number(e.target.value) })} />
              </div>
              <div>
                <div className="field-label" style={{ fontSize: 9 }}>H %</div>
                <input type="number" value={sel.h} step={1}
                  onChange={e => setLayer(selectedLayerIdx, { h: Number(e.target.value) })} />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 5 }}>
              <div>
                <div className="field-label" style={{ fontSize: 9 }}>Fit</div>
                <select value={sel.fit} onChange={e => setLayer(selectedLayerIdx, { fit: e.target.value as Fit })}>
                  <option value="cover">Cover</option>
                  <option value="contain">Contain</option>
                  <option value="fill">Fill</option>
                  <option value="native">Native</option>
                </select>
              </div>
              <div>
                <div className="field-label" style={{ fontSize: 9 }}>Opacity</div>
                <input type="number" min={0} max={1} step={0.05} value={sel.opacity}
                  onChange={e => setLayer(selectedLayerIdx, { opacity: Number(e.target.value) })} />
              </div>
              <div>
                <div className="field-label" style={{ fontSize: 9 }}>Blend</div>
                <select value={sel.blend} onChange={e => setLayer(selectedLayerIdx, { blend: e.target.value as Blend })}>
                  {BLEND_MODES.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>
            </div>
            <div style={{ marginTop: 6, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {[
                { label: 'Full',     x: 0,  y: 0,  w: 100, h: 100 },
                { label: 'Center',   x: 25, y: 25, w: 50,  h: 50 },
                { label: 'Top-L',    x: 2,  y: 2,  w: 20,  h: 20 },
                { label: 'Top-R',    x: 78, y: 2,  w: 20,  h: 20 },
                { label: 'Bot-L',    x: 2,  y: 78, w: 20,  h: 20 },
                { label: 'Bot-R',    x: 78, y: 78, w: 20,  h: 20 },
                { label: 'Bot bar',  x: 0,  y: 90, w: 100, h: 10 },
                { label: 'Top bar',  x: 0,  y: 0,  w: 100, h: 10 },
              ].map(p => (
                <button
                  key={p.label}
                  onClick={() => setLayer(selectedLayerIdx, { x: p.x, y: p.y, w: p.w, h: p.h })}
                  style={{
                    fontSize: 9, padding: '2px 6px', borderRadius: 4, cursor: 'pointer',
                    background: 'var(--s3)', border: '1px solid var(--border)', color: 'var(--t2)',
                  }}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        )}

        <button className="btn-run" onClick={compose}>
          <Layers size={13} /> Compose
        </button>

        <canvas ref={canvasRef} style={{ display: 'none' }} />

        {/* Interactive editor */}
        <div style={{ margin: '0 -12px -12px', borderTop: '1px solid var(--border)' }}>
          <div
            ref={editorRef}
            className="checker-bg"
            style={{
              position: 'relative',
              width: '100%',
              aspectRatio: `${width} / ${height}`,
              maxHeight: 360,
              overflow: 'hidden',
              borderRadius: '0 0 11px 11px',
              cursor: dragRef.current ? 'grabbing' : 'default',
              touchAction: 'none',
              userSelect: 'none',
            }}
            onPointerMove={onPointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            onPointerDown={e => {
              // Click empty area = deselect-style (no-op for now, leave selection)
              if (e.target === e.currentTarget) e.stopPropagation()
            }}
          >
            {/* Composed image as background */}
            {outputUrl && (
              <img
                src={outputUrl}
                alt="Composite"
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain', pointerEvents: 'none' }}
                draggable={false}
              />
            )}

            {/* Layer outlines (unselected, only those with bbox) */}
            {layers.map((l, i) => {
              if (i === selectedLayerIdx) return null
              return (
                <div
                  key={l.id}
                  onPointerDown={e => startDrag(e, 'move', i)}
                  style={{
                    position: 'absolute',
                    left: `${l.x}%`, top: `${l.y}%`,
                    width: `${l.w}%`, height: `${l.h}%`,
                    border: `1px dashed ${l.enabled ? 'rgba(14,165,233,0.4)' : 'rgba(150,150,150,0.3)'}`,
                    cursor: 'pointer',
                    boxSizing: 'border-box',
                  }}
                  title={l.name}
                />
              )
            })}

            {/* Selected layer: draggable + resize handles */}
            {sel && (() => {
              const showHandles = sel.w > 4 && sel.h > 4
              const handlePositions: { id: 'nw'|'ne'|'sw'|'se'|'n'|'s'|'e'|'w'; left: string; top: string; cursor: string }[] = [
                { id: 'nw', left: '0%',   top: '0%',   cursor: 'nwse-resize' },
                { id: 'ne', left: '100%', top: '0%',   cursor: 'nesw-resize' },
                { id: 'sw', left: '0%',   top: '100%', cursor: 'nesw-resize' },
                { id: 'se', left: '100%', top: '100%', cursor: 'nwse-resize' },
                { id: 'n',  left: '50%',  top: '0%',   cursor: 'ns-resize' },
                { id: 's',  left: '50%',  top: '100%', cursor: 'ns-resize' },
                { id: 'w',  left: '0%',   top: '50%',  cursor: 'ew-resize' },
                { id: 'e',  left: '100%', top: '50%',  cursor: 'ew-resize' },
              ]
              return (
                <div
                  onPointerDown={e => startDrag(e, 'move', selectedLayerIdx)}
                  style={{
                    position: 'absolute',
                    left: `${sel.x}%`, top: `${sel.y}%`,
                    width: `${sel.w}%`, height: `${sel.h}%`,
                    border: '2px solid #0ea5e9',
                    background: 'rgba(14,165,233,0.06)',
                    cursor: 'move',
                    boxSizing: 'border-box',
                  }}
                >
                  {showHandles && handlePositions.map(h => (
                    <div
                      key={h.id}
                      onPointerDown={e => startDrag(e, 'resize', selectedLayerIdx, h.id)}
                      style={{
                        position: 'absolute',
                        left: h.left, top: h.top,
                        transform: 'translate(-50%, -50%)',
                        width: 10, height: 10,
                        background: '#fff',
                        border: '2px solid #0ea5e9',
                        borderRadius: 2,
                        cursor: h.cursor,
                      }}
                    />
                  ))}
                </div>
              )
            })()}

            {/* Snap guides */}
            {snapGuides.x.map((px, i) => (
              <div key={`gx-${i}`} style={{ position: 'absolute', left: `${px}%`, top: 0, bottom: 0, width: 1, background: '#f43f5e', pointerEvents: 'none' }} />
            ))}
            {snapGuides.y.map((py, i) => (
              <div key={`gy-${i}`} style={{ position: 'absolute', top: `${py}%`, left: 0, right: 0, height: 1, background: '#f43f5e', pointerEvents: 'none' }} />
            ))}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 12px', borderTop: '1px solid var(--border)' }}>
            <span style={{ fontSize: 10, color: 'var(--t3)' }}>{width} × {height}px · {layers.filter(l => l.enabled && getLayerSrc(l.id)).length} active · drag to move, handles to resize</span>
            {outputUrl && (
              <a href={outputUrl} download="composite.png" style={{ fontSize: 11, color: 'var(--t3)', textDecoration: 'none' }}>
                ↓ Save
              </a>
            )}
          </div>
        </div>
      </div>

      <Handle type="source" position={Position.Right} style={{ top: '50%' }} />
    </div>
  )
}

function round1(n: number) { return Math.round(n * 10) / 10 }

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new window.Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}
