import { Handle, Position, type NodeProps, useEdges } from '@xyflow/react'
import { Filter } from 'lucide-react'
import { useNodeStore } from '../store'
import { NodeMenu } from '../components/NodeMenu'

export function FilterNode({ id, selected }: NodeProps) {
  const { nodes, updateNodeData } = useNodeStore()
  const edges = useEdges()
  const node = nodes.find(n => n.id === id)
  const data = (node?.data as Record<string, unknown>) ?? {}

  const field = (data.field as string) ?? 'text'
  const condition = (data.condition as string) ?? 'contains'
  const value = (data.value as string) ?? ''
  const passed = (data.passed as boolean) ?? false

  function evaluate() {
    const incomingEdge = edges.find(e => e.target === id)
    if (!incomingEdge) return
    const src = nodes.find(n => n.id === incomingEdge.source)
    const srcData = (src?.data as Record<string, unknown>) ?? {}
    const fieldVal = String(srcData[field] ?? '')

    let result = false
    switch (condition) {
      case 'contains': result = fieldVal.toLowerCase().includes(value.toLowerCase()); break
      case 'equals': result = fieldVal === value; break
      case 'starts_with': result = fieldVal.startsWith(value); break
      case 'not_empty': result = fieldVal.trim().length > 0; break
    }

    updateNodeData(id, { passed: result, text: result ? fieldVal : undefined })
  }

  return (
    <div className={`node-wrapper ${selected ? 'selected' : ''}`} data-node-type="filter" style={{ minWidth: 260 }}>
      <Handle type="target" position={Position.Left} style={{ top: '50%' }} />
      <div className="node-header">
        <Filter size={13} color="#fb923c" />
        <span style={{ color: '#fb923c' }}>Filter / Router</span>
        <span style={{ marginLeft: 'auto', fontSize: 10, color: passed ? '#4ade80' : '#8888a0' }}>
          {passed ? '✓ pass' : '✗ block'}
        </span>
              <NodeMenu id={id} />
      </div>
      <div className="node-body">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <div>
            <div className="field-label">Field</div>
            <input type="text" value={field} onChange={e => updateNodeData(id, { field: e.target.value })} placeholder="text" />
          </div>
          <div>
            <div className="field-label">Condition</div>
            <select value={condition} onChange={e => updateNodeData(id, { condition: e.target.value })}>
              <option value="contains">Contains</option>
              <option value="equals">Equals</option>
              <option value="starts_with">Starts with</option>
              <option value="not_empty">Not empty</option>
            </select>
          </div>
        </div>
        {condition !== 'not_empty' && (
          <div>
            <div className="field-label">Value</div>
            <input type="text" value={value} onChange={e => updateNodeData(id, { value: e.target.value })} />
          </div>
        )}
        <button className="btn-run" onClick={evaluate}><Filter size={13} /> Evaluate</button>
      </div>
      <Handle type="source" position={Position.Right} id="pass" style={{ top: '35%' }} />
      <Handle type="source" position={Position.Right} id="fail" style={{ top: '65%' }} />
      <div style={{ position: 'absolute', right: -30, top: '30%', fontSize: 9, color: '#4ade80' }}>pass</div>
      <div style={{ position: 'absolute', right: -28, top: '60%', fontSize: 9, color: '#f87171' }}>fail</div>
    </div>
  )
}
