import { Handle, Position, type NodeProps, useEdges } from '@xyflow/react'
import { Download, Image } from 'lucide-react'
import { useNodeStore } from '../store'
import { NodeMenu } from '../components/NodeMenu'

export function ImageDisplayNode({ id, selected }: NodeProps) {
  const { nodes, updateNodeData } = useNodeStore()
  const edges = useEdges()
  const node = nodes.find(n => n.id === id)
  const data = (node?.data as Record<string, unknown>) ?? {}
  const title = (data.title as string) ?? 'Image Output'

  function getImage(): string {
    const incomingEdge = edges.find(e => e.target === id)
    if (incomingEdge) {
      const src = nodes.find(n => n.id === incomingEdge.source)
      const img = ((src?.data as Record<string, unknown>)?.imageUrl as string) ?? ''
      if (img) return img
    }
    return ''
  }

  const imageUrl = getImage()

  return (
    <div
      className={`node-wrapper ${selected ? 'selected' : ''}`}
      data-node-type="imageDisplay"
      style={{ minWidth: 280, maxWidth: 420, padding: 0, overflow: 'hidden' }}
    >
      <Handle type="target" position={Position.Left} style={{ top: '45%' }} />

      {/* Header */}
      <div className="node-header" style={{ padding: '8px 10px 8px 12px' }}>
        <Image size={13} color="#f97316" />
        <input
          type="text"
          value={title}
          onChange={e => updateNodeData(id, { title: e.target.value })}
          onMouseDown={e => e.stopPropagation()}
          style={{
            background: 'transparent', border: 'none', outline: 'none',
            color: 'var(--t1)', fontSize: 12, fontWeight: 600,
            fontFamily: 'inherit', flex: 1, padding: 0, marginLeft: 4,
          }}
        />
        <NodeMenu id={id} />
      </div>

      {/* Image area — always full bleed */}
      <div
        className={imageUrl ? '' : 'checker-bg'}
        style={{ minHeight: 220, position: 'relative' }}
      >
        {imageUrl ? (
          <img src={imageUrl} alt="Output" style={{ width: '100%', display: 'block', maxHeight: 400, objectFit: 'contain' }} />
        ) : (
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}>
            <Image size={24} color="rgba(255,255,255,0.12)" strokeWidth={1.2} />
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.15)', fontWeight: 500 }}>
              Connect an image node
            </span>
          </div>
        )}
      </div>

      {/* Download bar */}
      {imageUrl && (
        <a
          href={imageUrl}
          download="aiflow-image.png"
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
            padding: '7px 12px',
            borderTop: '1px solid var(--border)',
            fontSize: 11, color: 'var(--t3)', textDecoration: 'none',
            transition: 'color 0.12s',
          }}
          onMouseEnter={e => (e.currentTarget.style.color = 'var(--accent)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'var(--t3)')}
        >
          <Download size={11} /> Save Image
        </a>
      )}
    </div>
  )
}
