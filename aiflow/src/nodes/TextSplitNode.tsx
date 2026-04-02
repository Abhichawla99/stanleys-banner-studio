import { Handle, Position, type NodeProps, useEdges } from '@xyflow/react'
import { ListFilter } from 'lucide-react'
import { useNodeStore } from '../store'
import { NodeMenu } from '../components/NodeMenu'

export function TextSplitNode({ id, selected }: NodeProps) {
  const { nodes, updateNodeData } = useNodeStore()
  const edges = useEdges()
  const node = nodes.find(n => n.id === id)
  const data = (node?.data as Record<string, unknown>) ?? {}

  const delimiter = (data.delimiter as string) ?? 'newline'
  const customDelim = (data.customDelim as string) ?? ','
  const selectedIndex = (data.selectedIndex as number) ?? 0

  function getConnectedText(): string {
    const incomingEdge = edges.find(e => e.target === id)
    if (!incomingEdge) return ''
    const src = nodes.find(n => n.id === incomingEdge.source)
    const d = (src?.data as Record<string, unknown>) ?? {}
    return (d.text as string) ?? (d.output as string) ?? ''
  }

  function split(text: string): string[] {
    if (!text.trim()) return []
    let parts: string[]
    if (delimiter === 'newline') parts = text.split('\n')
    else if (delimiter === 'double_newline') parts = text.split('\n\n')
    else if (delimiter === 'comma') parts = text.split(',')
    else if (delimiter === 'numbered') parts = text.split(/\n\d+[\.\)]\s*/)
    else parts = text.split(customDelim)
    return parts.map(s => s.trim()).filter(Boolean)
  }

  const rawText = getConnectedText()
  const items = split(rawText)
  const clampedIndex = Math.min(selectedIndex, Math.max(0, items.length - 1))
  const selectedText = items[clampedIndex] ?? ''

  // Auto-update output when selected changes
  if (selectedText !== (data.text as string)) {
    updateNodeData(id, { text: selectedText, items })
  }

  return (
    <div className={`node-wrapper ${selected ? 'selected' : ''}`} data-node-type="textSplit" style={{ minWidth: 270 }}>
      <Handle type="target" position={Position.Left} style={{ top: '50%' }} />
      <div className="node-header">
        <ListFilter size={13} color="#fb923c" />
        <span style={{ color: '#fb923c' }}>Text Split</span>
        <span style={{ marginLeft: 'auto', fontSize: 9, color: 'var(--t3)' }}>{items.length} items</span>
        <NodeMenu id={id} />
      </div>
      <div className="node-body">
        <div>
          <div className="field-label">Split by</div>
          <select value={delimiter} onChange={e => updateNodeData(id, { delimiter: e.target.value })}>
            <option value="newline">New line</option>
            <option value="double_newline">Double new line</option>
            <option value="numbered">Numbered list (1. 2. 3.)</option>
            <option value="comma">Comma</option>
            <option value="custom">Custom delimiter</option>
          </select>
          {delimiter === 'custom' && (
            <input
              type="text"
              value={customDelim}
              onChange={e => updateNodeData(id, { customDelim: e.target.value })}
              placeholder="Delimiter..."
              style={{ marginTop: 6 }}
            />
          )}
        </div>

        {items.length > 0 && (
          <div>
            <div className="field-label">Items — select output</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 200, overflowY: 'auto' }}>
              {items.map((item, i) => (
                <button
                  key={i}
                  onMouseDown={e => e.stopPropagation()}
                  onClick={() => updateNodeData(id, { selectedIndex: i, text: item, items })}
                  style={{
                    background: i === clampedIndex ? 'var(--accent-bg)' : 'var(--s3)',
                    border: `1px solid ${i === clampedIndex ? 'var(--accent)' : 'var(--border2)'}`,
                    borderRadius: 6,
                    padding: '5px 8px',
                    textAlign: 'left',
                    cursor: 'pointer',
                    fontSize: 11,
                    color: i === clampedIndex ? 'var(--t1)' : 'var(--t2)',
                    lineHeight: 1.4,
                  }}
                >
                  <span style={{ color: 'var(--t3)', marginRight: 6, fontSize: 9 }}>{i + 1}</span>
                  {item.length > 80 ? item.slice(0, 80) + '…' : item}
                </button>
              ))}
            </div>
          </div>
        )}

        {items.length === 0 && (
          <div style={{ fontSize: 11, color: 'var(--t3)', textAlign: 'center', padding: '12px 0' }}>
            Connect an LLM or Text Input node
          </div>
        )}
      </div>
      <Handle type="source" position={Position.Right} style={{ top: '50%' }} />
    </div>
  )
}
