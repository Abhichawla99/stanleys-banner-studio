import { Handle, Position, type NodeProps } from '@xyflow/react'
import { Target } from 'lucide-react'
import { useNodeStore } from '../store'
import { NodeMenu } from '../components/NodeMenu'

function buildContext(
  campaignName: string, objective: string, productName: string,
  targetAudience: string, keyMessage: string, mood: string,
): string {
  const parts: string[] = []
  if (campaignName.trim()) parts.push(`Campaign: "${campaignName.trim()}"`)
  if (objective) parts.push(`Objective: ${objective}`)
  if (productName.trim()) parts.push(`Product/Service: ${productName.trim()}`)
  if (mood) parts.push(`Campaign mood: ${mood}`)
  if (targetAudience.trim()) parts.push(`Target audience: ${targetAudience.trim()}`)
  if (keyMessage.trim()) parts.push(`Key message: ${keyMessage.trim()}`)
  return parts.join('. ')
}

export function CampaignContextNode({ id, selected }: NodeProps) {
  const { nodes, updateNodeData } = useNodeStore()
  const node = nodes.find(n => n.id === id)
  const data = (node?.data as Record<string, unknown>) ?? {}

  const campaignName  = (data.campaignName as string) ?? ''
  const objective     = (data.objective as string) ?? 'awareness'
  const productName   = (data.productName as string) ?? ''
  const targetAudience = (data.targetAudience as string) ?? ''
  const keyMessage    = (data.keyMessage as string) ?? ''
  const mood          = (data.mood as string) ?? 'professional'

  function set(field: string, val: string) {
    const next = { campaignName, objective, productName, targetAudience, keyMessage, mood, [field]: val }
    const ctx = buildContext(next.campaignName, next.objective, next.productName, next.targetAudience, next.keyMessage, next.mood)
    updateNodeData(id, { [field]: val, text: ctx, campaignContext: ctx })
  }

  const ctx = buildContext(campaignName, objective, productName, targetAudience, keyMessage, mood)

  return (
    <div className={`node-wrapper ${selected ? 'selected' : ''}`} data-node-type="campaignContext" style={{ minWidth: 300 }}>
      <div className="node-header">
        <Target size={13} color="#fb923c" />
        <span style={{ color: '#fb923c' }}>Campaign Context</span>
        <NodeMenu id={id} />
      </div>
      <div className="node-body">

        <div>
          <div className="field-label">Campaign Name</div>
          <input type="text" value={campaignName} onChange={e => set('campaignName', e.target.value)} placeholder="Summer Launch 2025" />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <div>
            <div className="field-label">Objective</div>
            <select value={objective} onChange={e => set('objective', e.target.value)}>
              <option value="awareness">Awareness</option>
              <option value="consideration">Consideration</option>
              <option value="conversion">Conversion</option>
              <option value="retention">Retention</option>
            </select>
          </div>
          <div>
            <div className="field-label">Campaign Mood</div>
            <select value={mood} onChange={e => set('mood', e.target.value)}>
              <option value="energetic">Energetic</option>
              <option value="luxurious">Luxurious</option>
              <option value="playful">Playful</option>
              <option value="professional">Professional</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>
        </div>

        <div>
          <div className="field-label">Product / Service</div>
          <input type="text" value={productName} onChange={e => set('productName', e.target.value)} placeholder="Product or service name" />
        </div>

        <div>
          <div className="field-label">Target Audience</div>
          <textarea rows={2} value={targetAudience} onChange={e => set('targetAudience', e.target.value)} placeholder="e.g. millennials 25–35, interested in fitness" />
        </div>

        <div>
          <div className="field-label">Key Message</div>
          <textarea rows={2} value={keyMessage} onChange={e => set('keyMessage', e.target.value)} placeholder="e.g. Transform your morning routine" />
        </div>

        {ctx && (
          <div style={{ background: 'var(--s3)', borderRadius: 6, padding: '6px 9px', fontSize: 10, color: 'var(--t2)', lineHeight: 1.5, fontStyle: 'italic', borderLeft: '2px solid #fb923c40' }}>
            {ctx}
          </div>
        )}
      </div>
      <Handle type="source" position={Position.Right} style={{ top: '50%' }} />
    </div>
  )
}
