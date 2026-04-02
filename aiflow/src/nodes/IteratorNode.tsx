import { Handle, Position, type NodeProps } from '@xyflow/react'
import { Repeat2, ChevronLeft, ChevronRight } from 'lucide-react'
import { useNodeStore } from '../store'
import { NodeMenu } from '../components/NodeMenu'

export function IteratorNode({ id, selected }: NodeProps) {
  const { nodes, updateNodeData } = useNodeStore()
  const node = nodes.find(n => n.id === id)
  const data = (node?.data as Record<string, unknown>) ?? {}

  const raw = (data.items as string) ?? ''
  const delimiter = (data.delimiter as string) ?? 'newline'
  const customDelim = (data.customDelim as string) ?? ','
  const currentIndex = (data.currentIndex as number) ?? 0

  const sep = delimiter === 'newline' ? '\n'
    : delimiter === 'comma' ? ','
    : delimiter === 'pipe' ? '|'
    : delimiter === 'tab' ? '\t'
    : customDelim

  const items = raw.split(sep).map(s => s.trim()).filter(Boolean)
  const total = items.length
  const current = Math.min(currentIndex, Math.max(0, total - 1))
  const currentText = items[current] ?? ''

  function go(dir: 1 | -1) {
    const next = Math.max(0, Math.min(total - 1, current + dir))
    updateNodeData(id, { currentIndex: next, text: items[next] ?? '' })
  }

  // Keep output text in sync
  if (items[current] && data.text !== items[current]) {
    updateNodeData(id, { text: items[current] })
  }

  const DELIMS = [
    { label: 'Newline', value: 'newline' },
    { label: 'Comma', value: 'comma' },
    { label: 'Pipe |', value: 'pipe' },
    { label: 'Tab', value: 'tab' },
    { label: 'Custom', value: 'custom' },
  ]

  return (
    <div className={`node-wrapper ${selected ? 'selected' : ''}`} data-node-type="iterator" style={{ minWidth: 300 }}>
      <div className="node-header">
        <Repeat2 size={13} color="#38bdf8" />
        <span style={{ color: '#38bdf8' }}>Text Iterator</span>
        {total > 0 && (
          <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--accent)', fontVariantNumeric: 'tabular-nums' }}>
            {current + 1} / {total}
          </span>
        )}
        <NodeMenu id={id} />
      </div>
      <div className="node-body">
        <div>
          <div className="field-label">Items (one per delimiter)</div>
          <textarea
            rows={4}
            value={raw}
            onChange={e => updateNodeData(id, { items: e.target.value, currentIndex: 0, text: '' })}
            placeholder={"Prompt 1\nPrompt 2\nPrompt 3"}
            style={{ fontFamily: 'monospace', fontSize: 11 }}
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <div>
            <div className="field-label">Delimiter</div>
            <select value={delimiter} onChange={e => updateNodeData(id, { delimiter: e.target.value })}>
              {DELIMS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
            </select>
          </div>
          {delimiter === 'custom' && (
            <div>
              <div className="field-label">Custom</div>
              <input type="text" value={customDelim} onChange={e => updateNodeData(id, { customDelim: e.target.value })} placeholder=";" />
            </div>
          )}
        </div>

        {total > 0 ? (
          <>
            {/* Navigator */}
            <div style={{ background: 'var(--s2)', border: '1px solid var(--border)', borderRadius: 7, padding: '8px 10px' }}>
              <div style={{ fontSize: 10, color: 'var(--t3)', marginBottom: 4, display: 'flex', justifyContent: 'space-between' }}>
                <span>Current output</span>
                <span style={{ color: 'var(--accent)' }}>item {current + 1}</span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--t1)', lineHeight: 1.5, wordBreak: 'break-word', minHeight: 20 }}>
                {currentText}
              </div>
            </div>

            {/* Prev / Next */}
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                className="btn-run"
                style={{ flex: 1 }}
                onClick={() => go(-1)}
                disabled={current === 0}
              >
                <ChevronLeft size={13} /> Prev
              </button>
              <button
                className="btn-run"
                style={{ flex: 1 }}
                onClick={() => go(1)}
                disabled={current >= total - 1}
              >
                Next <ChevronRight size={13} />
              </button>
            </div>

            {/* Mini list */}
            <div style={{ maxHeight: 80, overflowY: 'auto' }}>
              {items.map((item, i) => (
                <div
                  key={i}
                  onClick={() => updateNodeData(id, { currentIndex: i, text: item })}
                  style={{
                    padding: '3px 8px', fontSize: 10, cursor: 'pointer', borderRadius: 4,
                    background: i === current ? 'var(--accent)' : 'transparent',
                    color: i === current ? '#fff' : 'var(--t3)',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}
                >
                  <span style={{ opacity: 0.5, marginRight: 5 }}>{i + 1}.</span>{item}
                </div>
              ))}
            </div>
          </>
        ) : (
          <div style={{ fontSize: 11, color: 'var(--t3)', textAlign: 'center', padding: '6px 0' }}>
            Add items above to iterate
          </div>
        )}
      </div>
      <Handle type="source" position={Position.Right} style={{ top: '50%' }} />
    </div>
  )
}
