import { Handle, Position, type NodeProps } from '@xyflow/react'
import { Type } from 'lucide-react'
import { useNodeStore } from '../store'
import { NodeMenu } from '../components/NodeMenu'

export function TextInputNode({ id, selected }: NodeProps) {
  const { nodes, updateNodeData } = useNodeStore()
  const node = nodes.find(n => n.id === id)
  const data = node?.data as Record<string, unknown> ?? {}
  const text = (data.text as string) ?? ''

  return (
    <div className={`node-wrapper ${selected ? 'selected' : ''}`} data-node-type="textInput" style={{ minWidth: 260 }}>
      <div className="node-header">
        <Type size={13} color="#a78bfa" />
        <span style={{ color: '#a78bfa' }}>Text Input</span>
              <NodeMenu id={id} />
      </div>
      <div className="node-body">
        <div>
          <div className="field-label">Prompt</div>
          <textarea
            rows={4}
            value={text}
            onChange={e => updateNodeData(id, { text: e.target.value })}
            placeholder="Describe what you want to generate..."
          />
        </div>
      </div>
      <Handle type="source" position={Position.Right} style={{ top: '50%' }} />
    </div>
  )
}
