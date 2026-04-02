import { Handle, Position, type NodeProps, useEdges } from '@xyflow/react'
import { Wand2 } from 'lucide-react'
import { useNodeStore } from '../store'
import { NodeMenu } from '../components/NodeMenu'

// Merges multiple inputs and applies a template
export function PromptBuilderNode({ id, selected }: NodeProps) {
  const { nodes, updateNodeData } = useNodeStore()
  const edges = useEdges()
  const node = nodes.find(n => n.id === id)
  const data = (node?.data as Record<string, unknown>) ?? {}

  const template = (data.template as string) ?? '{{input}}'
  const style = (data.style as string) ?? ''
  const quality = (data.quality as string) ?? ''

  function buildPrompt(): string {
    const incomingEdge = edges.find(e => e.target === id)
    let input = ''
    if (incomingEdge) {
      const src = nodes.find(n => n.id === incomingEdge.source)
      const srcData = (src?.data as Record<string, unknown>) ?? {}
      input = (srcData.text as string) ?? (srcData.prompt as string) ?? (srcData.lastPayload as string) ?? ''
    }

    let result = template.replace('{{input}}', input)
    if (style) result += `, ${style}`
    if (quality) result += `, ${quality}`
    return result
  }

  const preview = buildPrompt()

  return (
    <div className={`node-wrapper ${selected ? 'selected' : ''}`} data-node-type="promptBuilder" style={{ minWidth: 280 }}>
      <Handle type="target" position={Position.Left} style={{ top: '50%' }} />
      <div className="node-header">
        <Wand2 size={13} color="#86efac" />
        <span style={{ color: '#86efac' }}>Prompt Builder</span>
              <NodeMenu id={id} />
      </div>
      <div className="node-body">
        <div>
          <div className="field-label">Template (use {'{{input}}'})</div>
          <textarea
            rows={3}
            value={template}
            onChange={e => updateNodeData(id, { template: e.target.value })}
            placeholder="A photorealistic {{input}}, cinematic lighting..."
          />
        </div>
        <div>
          <div className="field-label">Style Modifier</div>
          <input type="text" value={style} onChange={e => updateNodeData(id, { style: e.target.value })} placeholder="cinematic, 4K, Kodak film..." />
        </div>
        <div>
          <div className="field-label">Quality Tags</div>
          <input type="text" value={quality} onChange={e => updateNodeData(id, { quality: e.target.value })} placeholder="masterpiece, ultra-detailed..." />
        </div>
        <div>
          <div className="field-label">Preview Output</div>
          <textarea rows={2} value={preview} readOnly style={{ fontSize: 11, color: '#a0a0c0' }} />
        </div>
      </div>
      <Handle type="source" position={Position.Right} style={{ top: '50%' }} />
    </div>
  )
}
