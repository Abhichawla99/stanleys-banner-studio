import { Handle, Position, type NodeProps, useEdges } from '@xyflow/react'
import { Image } from 'lucide-react'
import { useState, useEffect, useRef } from 'react'
import { generateGPTImage } from '../api/gptImage'
import { useNodeStore } from '../store'
import { useSettings } from '../SettingsContext'
import { NodeMenu } from '../components/NodeMenu'
import { registerNodeRunner, unregisterNodeRunner } from '../nodeRunner'
import { getNodeInputs } from '../utils/nodeInputs'
import { trackApiCall } from '../apiCallTracker'
import { ImageHistory, pushHistory, type HistoryItem } from '../components/ImageHistory'

export function GPTImageNode({ id, selected }: NodeProps) {
  const { nodes, updateNodeData } = useNodeStore()
  const edges = useEdges()
  const node = nodes.find(n => n.id === id)
  const data = (node?.data as Record<string, unknown>) ?? {}
  const settings = useSettings()

  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [error, setError] = useState('')
  const runRef = useRef<() => Promise<void>>(async () => {})

  const size = (data.size as string) ?? '1024x1024'
  const quality = (data.quality as string) ?? 'high'
  const background = (data.background as string) ?? 'auto'
  const imageUrl = (data.imageUrl as string) ?? ''
  const history: HistoryItem[] = (data.history as HistoryItem[]) ?? []

  function getInputs() {
    return getNodeInputs(edges, nodes, id, (data.prompt as string) ?? '')
  }

  async function run() {
    const { prompt, referenceImages } = getInputs()
    if (!prompt.trim()) { setError('No prompt connected or entered'); return }
    if (!settings.openAiApiKey) { setError('No OpenAI API key in settings'); return }

    setStatus('loading')
    setError('')

    try {
      const result = await generateGPTImage({
        prompt,
        size: size as any,
        quality: quality as any,
        background: background as any,
        apiKey: settings.openAiApiKey,
        referenceImages: referenceImages.length > 0 ? referenceImages.map(r => r.url) : undefined,
      })
      updateNodeData(id, pushHistory(history, result.imageUrl, prompt))
      trackApiCall('gptImage')
      setStatus('done')
    } catch (e: any) {
      setError(e.message)
      setStatus('error')
    }
  }

  runRef.current = run
  useEffect(() => {
    registerNodeRunner(id, () => runRef.current())
    return () => unregisterNodeRunner(id)
  }, [id])

  const { referenceImages: connectedRefs } = getInputs()

  return (
    <div className={`node-wrapper ${selected ? 'selected' : ''}`} data-node-type="gptImage" style={{ minWidth: 300 }}>
      <Handle type="target" position={Position.Left} style={{ top: '50%' }} />
      <div className="node-header">
        <Image size={13} color="#22d3ee" />
        <span style={{ color: '#22d3ee' }}>GPT Image 1</span>
        <span style={{ marginLeft: 'auto' }} className={`status-badge status-${status}`}>
          {status === 'loading' && <div className="spinner" />}
          {status}
        </span>
        <NodeMenu id={id} />
      </div>
      <div className="node-body">
        <div>
          <div className="field-label">Prompt (or connect Text / Image nodes)</div>
          <textarea
            rows={2}
            value={(data.prompt as string) ?? ''}
            onChange={e => updateNodeData(id, { prompt: e.target.value })}
            placeholder="Leave empty to use connected node..."
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
          <div>
            <div className="field-label">Size</div>
            <select value={size} onChange={e => updateNodeData(id, { size: e.target.value })}>
              <option value="1024x1024">1024² Square</option>
              <option value="1536x1024">1536×1024 Wide</option>
              <option value="1024x1536">1024×1536 Portrait</option>
              <option value="auto">Auto</option>
            </select>
          </div>
          <div>
            <div className="field-label">Quality</div>
            <select value={quality} onChange={e => updateNodeData(id, { quality: e.target.value })}>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>
          <div>
            <div className="field-label">Background</div>
            <select value={background} onChange={e => updateNodeData(id, { background: e.target.value })}>
              <option value="auto">Auto</option>
              <option value="opaque">Opaque</option>
              <option value="transparent">Transparent</option>
            </select>
          </div>
        </div>

        {connectedRefs.length > 0 && (
          <div>
            <div className="field-label">{connectedRefs.length} Reference Image{connectedRefs.length > 1 ? 's' : ''} (edit mode)</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {connectedRefs.map((ref, i) => (
                <img
                  key={i}
                  src={ref.url}
                  alt={`ref ${i + 1}`}
                  style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 5, border: '1px solid var(--border2)' }}
                />
              ))}
            </div>
          </div>
        )}

        {error && <div style={{ color: '#f87171', fontSize: 11 }}>{error}</div>}

        <button className="btn-run" onClick={run} disabled={status === 'loading'}>
          {status === 'loading' ? <><div className="spinner" /> Generating...</> : <><Image size={13} /> Generate</>}
        </button>

        <ImageHistory
          imageUrl={imageUrl}
          history={history}
          onSelectImage={url => updateNodeData(id, { imageUrl: url })}
          downloadName="gpt-image"
        />
      </div>
      <Handle type="source" position={Position.Right} style={{ top: '50%' }} />
    </div>
  )
}
