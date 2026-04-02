import { Handle, Position, type NodeProps } from '@xyflow/react'
import { Hash, Shuffle } from 'lucide-react'
import { useNodeStore } from '../store'
import { NodeMenu } from '../components/NodeMenu'

export function SeedNode({ id, selected }: NodeProps) {
  const { nodes, updateNodeData } = useNodeStore()
  const node = nodes.find(n => n.id === id)
  const data = (node?.data as Record<string, unknown>) ?? {}

  const seed = (data.seed as number) ?? 42
  const locked = (data.locked as boolean) ?? false

  function randomize() {
    const newSeed = Math.floor(Math.random() * 2147483647)
    updateNodeData(id, { seed: newSeed, text: String(newSeed) })
  }

  function setSeed(v: string) {
    const n = parseInt(v.replace(/\D/g, ''))
    if (!isNaN(n)) updateNodeData(id, { seed: n, text: String(n) })
  }

  return (
    <div className={`node-wrapper ${selected ? 'selected' : ''}`} data-node-type="seed" style={{ minWidth: 200 }}>
      <div className="node-header">
        <Hash size={13} color="#94a3b8" />
        <span style={{ color: '#94a3b8' }}>Seed</span>
        <NodeMenu id={id} />
      </div>
      <div className="node-body">
        <div>
          <div className="field-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Value</span>
            <label style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', userSelect: 'none' }}
              onMouseDown={e => e.stopPropagation()}>
              <input
                type="checkbox"
                checked={locked}
                onChange={e => updateNodeData(id, { locked: e.target.checked })}
                style={{ accentColor: 'var(--accent)', cursor: 'pointer' }}
              />
              <span style={{ fontSize: 9, color: 'var(--t3)' }}>LOCK</span>
            </label>
          </div>
          <input
            type="text"
            value={seed}
            onChange={e => setSeed(e.target.value)}
            style={{ fontFamily: 'monospace', fontSize: 18, fontWeight: 700, textAlign: 'center', color: '#94a3b8' }}
          />
        </div>

        <button
          className="btn-run"
          onClick={randomize}
          disabled={locked}
          style={{ background: locked ? 'var(--s4)' : '#334155' }}
        >
          <Shuffle size={13} /> {locked ? 'Locked' : 'Randomize'}
        </button>

        <div style={{ fontSize: 10, color: 'var(--t3)', textAlign: 'center', lineHeight: 1.5 }}>
          Connect to Seed input of<br />image/video generation nodes
        </div>
      </div>
      <Handle type="source" position={Position.Right} style={{ top: '50%' }} />
    </div>
  )
}
