import { Handle, Position, type NodeProps, useEdges } from '@xyflow/react'
import { Combine } from 'lucide-react'
import { useNodeStore } from '../store'
import { NodeMenu } from '../components/NodeMenu'

const HANDLE_POSITIONS = [
  { id: 'a', top: '20%', label: 'A' },
  { id: 'b', top: '38%', label: 'B' },
  { id: 'c', top: '56%', label: 'C' },
  { id: 'd', top: '74%', label: 'D' },
]

export function PromptConcatenatorNode({ id, selected }: NodeProps) {
  const { nodes, updateNodeData } = useNodeStore()
  const edges = useEdges()
  const node = nodes.find(n => n.id === id)
  const data = (node?.data as Record<string, unknown>) ?? {}

  const separator = (data.separator as string) ?? '\n\n'
  const customSep = (data.customSep as string) ?? ''
  const prefix = (data.prefix as string) ?? ''
  const suffix = (data.suffix as string) ?? ''

  // Collect text from connected edges in slot order
  function getSlotText(slotId: string): string {
    const edge = edges.find(e => e.target === id && e.targetHandle === slotId)
    if (!edge) return ''
    const srcNode = nodes.find(n => n.id === edge.source)
    const d = (srcNode?.data as Record<string, unknown>) ?? {}
    return (d.text as string) ?? (d.prompt as string) ?? (d.output as string) ?? ''
  }

  const sep = separator === 'custom' ? customSep : separator
  const parts = HANDLE_POSITIONS.map(h => getSlotText(h.id)).filter(t => t.trim())
  const result = parts.length > 0
    ? (prefix ? prefix + sep : '') + parts.join(sep) + (suffix ? sep + suffix : '')
    : ''

  const SEPS = [
    { label: 'Double newline', value: '\n\n' },
    { label: 'Newline', value: '\n' },
    { label: 'Space', value: ' ' },
    { label: 'Comma', value: ', ' },
    { label: 'Custom', value: 'custom' },
  ]

  return (
    <div className={`node-wrapper ${selected ? 'selected' : ''}`} data-node-type="promptConcatenator" style={{ minWidth: 300 }}>
      {/* Target handles */}
      {HANDLE_POSITIONS.map(h => (
        <Handle key={h.id} type="target" id={h.id} position={Position.Left} style={{ top: h.top }} />
      ))}

      <div className="node-header">
        <Combine size={13} color="#a3e635" />
        <span style={{ color: '#a3e635' }}>Prompt Concatenator</span>
        <NodeMenu id={id} />
      </div>

      <div className="node-body">
        {/* Slot labels */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4, marginBottom: 6 }}>
          {HANDLE_POSITIONS.map(h => {
            const txt = getSlotText(h.id)
            return (
              <div key={h.id} style={{
                background: txt ? 'var(--s4)' : 'var(--s2)',
                border: `1px solid ${txt ? 'var(--border2)' : 'var(--border)'}`,
                borderRadius: 5, padding: '4px 6px', fontSize: 10, color: txt ? 'var(--t1)' : 'var(--t3)',
              }}>
                <span style={{ fontWeight: 700, color: '#a3e635', marginRight: 3 }}>{h.label}</span>
                {txt ? (txt.length > 18 ? txt.slice(0, 18) + '…' : txt) : 'empty'}
              </div>
            )
          })}
        </div>

        {/* Separator */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <div>
            <div className="field-label">Separator</div>
            <select value={separator} onChange={e => updateNodeData(id, { separator: e.target.value })}>
              {SEPS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
          {separator === 'custom' && (
            <div>
              <div className="field-label">Custom separator</div>
              <input
                type="text"
                value={customSep}
                onChange={e => updateNodeData(id, { customSep: e.target.value })}
                placeholder=", or | etc."
              />
            </div>
          )}
        </div>

        {/* Prefix / Suffix */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <div>
            <div className="field-label">Prefix</div>
            <input type="text" value={prefix} onChange={e => updateNodeData(id, { prefix: e.target.value })} placeholder="Optional prefix" />
          </div>
          <div>
            <div className="field-label">Suffix</div>
            <input type="text" value={suffix} onChange={e => updateNodeData(id, { suffix: e.target.value })} placeholder="Optional suffix" />
          </div>
        </div>

        {/* Preview */}
        {result ? (
          <div>
            <div className="field-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Output preview</span>
              <span style={{ color: 'var(--accent)' }}>{result.length} chars · {parts.length} parts</span>
            </div>
            <div style={{
              background: 'var(--s2)', border: '1px solid var(--border)', borderRadius: 6,
              padding: '7px 9px', fontSize: 11, color: 'var(--t2)', lineHeight: 1.6,
              maxHeight: 90, overflow: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
            }}>
              {result}
            </div>
          </div>
        ) : (
          <div style={{ fontSize: 11, color: 'var(--t3)', textAlign: 'center', padding: '8px 0' }}>
            Connect text nodes to slots A–D
          </div>
        )}
      </div>

      <Handle type="source" position={Position.Right} style={{ top: '50%' }} />
    </div>
  )
}
