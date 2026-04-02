import { Handle, Position, type NodeProps, useEdges } from '@xyflow/react'
import { Zap } from 'lucide-react'
import { useState, useEffect, useRef } from 'react'
import { generateFalImage } from '../api/falImage'
import { useNodeStore } from '../store'
import { useSettings } from '../SettingsContext'
import { NodeMenu } from '../components/NodeMenu'
import { registerNodeRunner, unregisterNodeRunner } from '../nodeRunner'
import { getNodeInputs } from '../utils/nodeInputs'
import { trackApiCall } from '../apiCallTracker'
import { ImageHistory, pushHistory, type HistoryItem } from '../components/ImageHistory'

const FAL_MODELS = [
  { id: 'fal-ai/flux-pro/v1.1-ultra', label: 'Flux Pro 1.1 Ultra', color: '#f59e0b' },
  { id: 'fal-ai/flux-pro',            label: 'Flux Pro',            color: '#f59e0b' },
  { id: 'fal-ai/flux/dev',            label: 'Flux Dev',            color: '#fbbf24' },
  { id: 'fal-ai/recraft-v3',          label: 'Recraft V3',          color: '#a78bfa' },
  { id: 'fal-ai/ideogram/v3',         label: 'Ideogram V3',         color: '#34d399' },
  { id: 'fal-ai/stable-diffusion-v3-medium', label: 'SD3 Medium', color: '#60a5fa' },
]

const IMAGE_SIZES = [
  { value: 'square_hd',        label: '1:1 HD' },
  { value: 'landscape_16_9',   label: '16:9' },
  { value: 'portrait_9_16',    label: '9:16' },
  { value: 'landscape_4_3',    label: '4:3' },
  { value: 'portrait_4_5',     label: '4:5' },
]

export function FluxNode({ id, selected }: NodeProps) {
  const { nodes, updateNodeData } = useNodeStore()
  const edges = useEdges()
  const node = nodes.find(n => n.id === id)
  const data = (node?.data as Record<string, unknown>) ?? {}
  const settings = useSettings()

  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [error, setError] = useState('')
  const runRef = useRef<() => Promise<void>>(async () => {})

  const modelId = (data.modelId as string) ?? 'fal-ai/flux-pro/v1.1-ultra'
  const imageSize = (data.imageSize as string) ?? 'landscape_16_9'
  const seed = (data.seed as number | undefined)
  const negPrompt = (data.negPrompt as string) ?? ''
  const imageUrl = (data.imageUrl as string) ?? ''
  const history: HistoryItem[] = (data.history as HistoryItem[]) ?? []
  const currentModel = FAL_MODELS.find(m => m.id === modelId) ?? FAL_MODELS[0]

  function getInputs() {
    return getNodeInputs(edges, nodes, id, (data.prompt as string) ?? '')
  }

  async function run() {
    if (!settings.falApiKey) { setError('No fal.ai API key in settings'); return }
    const { prompt, referenceImages } = getInputs()
    if (!prompt.trim()) { setError('No prompt entered or connected'); return }

    setStatus('loading')
    setError('')
    try {
      const result = await generateFalImage({
        modelId,
        prompt,
        negativePrompt: negPrompt || undefined,
        imageSize,
        seed,
        apiKey: settings.falApiKey,
        referenceImages: referenceImages.length > 0 ? referenceImages.map(r => r.url) : undefined,
      })
      updateNodeData(id, pushHistory(history, result.imageUrl, prompt))
      trackApiCall('flux')
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
    <div className={`node-wrapper ${selected ? 'selected' : ''}`} data-node-type="flux" style={{ minWidth: 300 }}>
      <Handle type="target" position={Position.Left} style={{ top: '50%' }} />
      <div className="node-header">
        <Zap size={13} color={currentModel.color} />
        <span style={{ color: currentModel.color }}>{currentModel.label}</span>
        <span style={{ marginLeft: 'auto' }} className={`status-badge status-${status}`}>
          {status === 'loading' && <div className="spinner" />}
          {status}
        </span>
        <NodeMenu id={id} />
      </div>
      <div className="node-body">
        <div>
          <div className="field-label">Model</div>
          <select value={modelId} onChange={e => updateNodeData(id, { modelId: e.target.value })}>
            {FAL_MODELS.map(m => (
              <option key={m.id} value={m.id}>{m.label}</option>
            ))}
          </select>
        </div>

        <div>
          <div className="field-label">Prompt (or connect Text / Image nodes)</div>
          <textarea
            rows={2}
            value={(data.prompt as string) ?? ''}
            onChange={e => updateNodeData(id, { prompt: e.target.value })}
            placeholder="Leave empty to use connected node..."
          />
        </div>

        <div>
          <div className="field-label">Negative Prompt</div>
          <textarea rows={1} value={negPrompt} onChange={e => updateNodeData(id, { negPrompt: e.target.value })} placeholder="blurry, low quality..." />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <div>
            <div className="field-label">Image Size</div>
            <select value={imageSize} onChange={e => updateNodeData(id, { imageSize: e.target.value })}>
              {IMAGE_SIZES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
          <div>
            <div className="field-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Seed</span>
              <button
                onMouseDown={e => e.stopPropagation()}
                onClick={() => updateNodeData(id, { seed: Math.floor(Math.random() * 2147483647) })}
                style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: 9, cursor: 'pointer', padding: 0 }}
              >
                random
              </button>
            </div>
            <input
              type="text"
              value={seed ?? ''}
              onChange={e => updateNodeData(id, { seed: e.target.value === '' ? undefined : parseInt(e.target.value) })}
              placeholder="auto"
            />
          </div>
        </div>

        {connectedRefs.length > 0 && (
          <div>
            <div className="field-label">
              {connectedRefs.length} Reference Image{connectedRefs.length > 1 ? 's' : ''} · converted to base64 server-side
            </div>
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

        {error && <div style={{ color: 'var(--red)', fontSize: 11 }}>{error}</div>}

        <button className="btn-run" onClick={run} disabled={status === 'loading'}>
          {status === 'loading' ? <><div className="spinner" /> Generating...</> : <><Zap size={13} /> Generate</>}
        </button>

        <ImageHistory
          imageUrl={imageUrl}
          history={history}
          onSelectImage={url => updateNodeData(id, { imageUrl: url })}
          downloadName="flux-image"
        />
      </div>
      <Handle type="source" position={Position.Right} style={{ top: '50%' }} />
    </div>
  )
}
