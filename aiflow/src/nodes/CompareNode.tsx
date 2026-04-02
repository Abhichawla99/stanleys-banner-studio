import { Handle, Position, type NodeProps, useEdges } from '@xyflow/react'
import { SplitSquareHorizontal, Download } from 'lucide-react'
import { useState } from 'react'
import { useNodeStore } from '../store'
import { NodeMenu } from '../components/NodeMenu'

export function CompareNode({ id, selected }: NodeProps) {
  const { nodes } = useNodeStore()
  const edges = useEdges()
  const [sliderPos, setSliderPos] = useState(50)

  // Accept 2 incoming edges
  const inEdges = edges.filter(e => e.target === id)
  const imgA = (() => {
    const src = nodes.find(n => n.id === inEdges[0]?.source)
    return ((src?.data as Record<string, unknown>)?.imageUrl as string) ?? ''
  })()
  const imgB = (() => {
    const src = nodes.find(n => n.id === inEdges[1]?.source)
    return ((src?.data as Record<string, unknown>)?.imageUrl as string) ?? ''
  })()

  return (
    <div className={`node-wrapper ${selected ? 'selected' : ''}`} data-node-type="compare" style={{ minWidth: 300 }}>
      {/* Two target handles */}
      <Handle type="target" id="a" position={Position.Left} style={{ top: '35%' }} />
      <Handle type="target" id="b" position={Position.Left} style={{ top: '65%' }} />
      <div className="node-header">
        <SplitSquareHorizontal size={13} color="#a78bfa" />
        <span style={{ color: '#a78bfa' }}>Compare</span>
        <span style={{ marginLeft: 'auto', fontSize: 9, color: 'var(--t3)' }}>A vs B</span>
        <NodeMenu id={id} />
      </div>
      <div className="node-body">
        {(imgA || imgB) ? (
          <>
            {/* Slider compare */}
            <div style={{ position: 'relative', borderRadius: 7, overflow: 'hidden', userSelect: 'none' }}>
              {/* Image B (behind) */}
              {imgB ? (
                <img src={imgB} alt="B" style={{ width: '100%', display: 'block', borderRadius: 7 }} />
              ) : (
                <div style={{ height: 160, background: 'var(--s3)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--t3)', fontSize: 11 }}>B — connect second image</div>
              )}

              {/* Image A (clipped) */}
              {imgA && (
                <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', width: `${sliderPos}%` }}>
                  <img src={imgA} alt="A" style={{ width: `${10000 / sliderPos}%`, maxWidth: 'none', display: 'block', height: '100%', objectFit: 'cover' }} />
                </div>
              )}

              {/* Divider line */}
              <div style={{
                position: 'absolute', top: 0, bottom: 0,
                left: `${sliderPos}%`, width: 2,
                background: 'white', boxShadow: '0 0 6px rgba(0,0,0,0.6)',
                transform: 'translateX(-1px)',
              }} />

              {/* Labels */}
              <div style={{ position: 'absolute', top: 6, left: 8, fontSize: 9, fontWeight: 700, background: 'rgba(0,0,0,0.6)', padding: '2px 6px', borderRadius: 4, color: 'white' }}>A</div>
              <div style={{ position: 'absolute', top: 6, right: 8, fontSize: 9, fontWeight: 700, background: 'rgba(0,0,0,0.6)', padding: '2px 6px', borderRadius: 4, color: 'white' }}>B</div>
            </div>

            {/* Slider control */}
            <div>
              <div className="field-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Divider</span>
                <span style={{ color: 'var(--accent)' }}>{sliderPos}%</span>
              </div>
              <input
                type="range"
                min={0} max={100}
                value={sliderPos}
                onChange={e => setSliderPos(Number(e.target.value))}
                style={{ width: '100%', accentColor: 'var(--accent)' }}
                onMouseDown={e => e.stopPropagation()}
              />
            </div>

            {/* Download both */}
            <div style={{ display: 'flex', gap: 6 }}>
              {imgA && <a href={imgA} download="compare-A.png" style={{ flex: 1, textAlign: 'center', fontSize: 11, color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}><Download size={11} /> Save A</a>}
              {imgB && <a href={imgB} download="compare-B.png" style={{ flex: 1, textAlign: 'center', fontSize: 11, color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}><Download size={11} /> Save B</a>}
            </div>
          </>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ height: 80, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--t3)', fontSize: 11, border: '1px dashed var(--border2)', borderRadius: 6 }}>
              Connect 2 image nodes to compare
            </div>
            <div style={{ fontSize: 10, color: 'var(--t3)', textAlign: 'center', lineHeight: 1.7 }}>
              Handle A → top connection<br />
              Handle B → bottom connection
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
