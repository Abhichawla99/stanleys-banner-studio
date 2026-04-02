import { type NodeProps } from '@xyflow/react'
import { StickyNote } from 'lucide-react'
import { useNodeStore } from '../store'
import { NodeMenu } from '../components/NodeMenu'

const NOTE_COLORS = [
  { label: 'Purple', bg: '#1e1730', border: '#4c3a8a', text: '#c4b5fd' },
  { label: 'Blue',   bg: '#0f1e30', border: '#1e4a8a', text: '#93c5fd' },
  { label: 'Green',  bg: '#0f201a', border: '#1a5a3a', text: '#6ee7b7' },
  { label: 'Amber',  bg: '#201a0a', border: '#7a4a10', text: '#fcd34d' },
  { label: 'Rose',   bg: '#200f15', border: '#7a1a30', text: '#fda4af' },
]

export function NoteNode({ id, selected }: NodeProps) {
  const { nodes, updateNodeData } = useNodeStore()
  const node = nodes.find(n => n.id === id)
  const data = (node?.data as Record<string, unknown>) ?? {}

  const content = (data.content as string) ?? ''
  const colorIndex = (data.colorIndex as number) ?? 0
  const color = NOTE_COLORS[colorIndex] ?? NOTE_COLORS[0]

  return (
    <div
      className={`node-wrapper ${selected ? 'selected' : ''}`}
      data-node-type="note"
      style={{
        minWidth: 220, maxWidth: 340,
        background: color.bg,
        borderColor: selected ? 'var(--accent)' : color.border,
        borderLeftColor: selected ? 'var(--accent)' : color.border,
      }}
    >
      <div className="node-header" style={{ background: 'transparent !important', borderBottomColor: color.border }}>
        <StickyNote size={13} color={color.text} />
        <span style={{ color: color.text, fontSize: 11, fontWeight: 600 }}>Note</span>
        {/* Color picker */}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 3, alignItems: 'center' }} onMouseDown={e => e.stopPropagation()}>
          {NOTE_COLORS.map((c, i) => (
            <button
              key={i}
              onClick={() => updateNodeData(id, { colorIndex: i })}
              style={{
                width: 10, height: 10, borderRadius: '50%',
                background: c.text,
                border: i === colorIndex ? '2px solid white' : '1px solid transparent',
                cursor: 'pointer', padding: 0,
              }}
            />
          ))}
        </div>
        <NodeMenu id={id} />
      </div>
      <div className="node-body" style={{ paddingTop: 8 }}>
        <textarea
          rows={5}
          value={content}
          onChange={e => updateNodeData(id, { content: e.target.value })}
          placeholder="Add a note, label this section, or describe your workflow..."
          style={{
            background: 'transparent',
            border: '1px solid ' + color.border,
            color: color.text,
            resize: 'vertical',
            fontSize: 12,
            lineHeight: 1.6,
          }}
          onMouseDown={e => e.stopPropagation()}
        />
      </div>
    </div>
  )
}
