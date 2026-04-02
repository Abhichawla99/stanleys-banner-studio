import { Handle, Position, type NodeProps, useEdges } from '@xyflow/react'
import { Image, Loader } from 'lucide-react'
import { useState, useEffect, useRef } from 'react'
import { generateImage } from '../api/nanoBanana'
import { useNodeStore } from '../store'
import { useSettings } from '../SettingsContext'
import { NodeMenu } from '../components/NodeMenu'
import { registerNodeRunner, unregisterNodeRunner } from '../nodeRunner'
import { getNodeInputs } from '../utils/nodeInputs'
import { trackApiCall } from '../apiCallTracker'

export function NanoBananaNode({ id, selected }: NodeProps) {
  const { nodes, updateNodeData } = useNodeStore()
  const edges = useEdges()
  const node = nodes.find(n => n.id === id)
  const data = (node?.data as Record<string, unknown>) ?? {}
  const settings = useSettings()

  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [error, setError] = useState('')
  const runRef = useRef<() => Promise<void>>(async () => {})

  const negPrompt = (data.negPrompt as string) ?? ''
  const aspectRatio = (data.aspectRatio as string) ?? '1:1'
  const provider = (data.provider as string) ?? 'gemini'
  const imageUrl = (data.imageUrl as string) ?? ''

  function getInputs(): { prompt: string; referenceImages: string[] } {
    return getNodeInputs(edges, nodes, id, (data.prompt as string) ?? '')
  }

  async function run() {
    const { prompt, referenceImages } = getInputs()
    if (!prompt.trim()) { setError('No prompt connected or entered'); return }

    const apiKey = provider === 'fal' ? settings.falApiKey : settings.geminiApiKey
    if (!apiKey) { setError(`No ${provider === 'fal' ? 'fal.ai' : 'Gemini'} API key in settings`); return }

    setStatus('loading')
    setError('')
    try {
      const result = await generateImage({
        prompt,
        negativePrompt: negPrompt,
        aspectRatio: aspectRatio as any,
        provider: provider as 'gemini' | 'fal',
        apiKey,
        referenceImages: referenceImages.length > 0 ? referenceImages : undefined,
      })
      updateNodeData(id, { imageUrl: result.imageUrl })
      trackApiCall('nanoBanana')
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
    <div className={`node-wrapper ${selected ? 'selected' : ''}`} data-node-type="nanoBanana" style={{ minWidth: 300 }}>
      <Handle type="target" position={Position.Left} style={{ top: '50%' }} />
      <div className="node-header">
        <Image size={13} color="#f59e0b" />
        <span style={{ color: '#f59e0b' }}>Nano Banana 2</span>
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
            placeholder="Leave empty to use connected text node..."
          />
        </div>
        <div>
          <div className="field-label">Negative Prompt</div>
          <textarea
            rows={1}
            value={negPrompt}
            onChange={e => updateNodeData(id, { negPrompt: e.target.value })}
            placeholder="blurry, distorted..."
          />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <div>
            <div className="field-label">Aspect Ratio</div>
            <select value={aspectRatio} onChange={e => updateNodeData(id, { aspectRatio: e.target.value })}>
              <option value="1:1">1:1 Square</option>
              <option value="16:9">16:9 Wide</option>
              <option value="9:16">9:16 Portrait</option>
              <option value="4:3">4:3</option>
              <option value="3:4">3:4</option>
            </select>
          </div>
          <div>
            <div className="field-label">Provider</div>
            <select value={provider} onChange={e => updateNodeData(id, { provider: e.target.value })}>
              <option value="gemini">Gemini API</option>
              <option value="fal">fal.ai</option>
            </select>
          </div>
        </div>

        {connectedRefs.length > 0 && (
          <div>
            <div className="field-label">{connectedRefs.length} Reference Image{connectedRefs.length > 1 ? 's' : ''} Connected</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {connectedRefs.map((src, i) => (
                <img
                  key={i}
                  src={src}
                  alt={`ref ${i + 1}`}
                  style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 5, border: '1px solid var(--border2)' }}
                />
              ))}
            </div>
          </div>
        )}

        {error && <div style={{ color: '#f87171', fontSize: 11 }}>{error}</div>}

        <button className="btn-run" onClick={run} disabled={status === 'loading'}>
          {status === 'loading' ? <><div className="spinner" /> Generating...</> : <><Image size={13} /> Generate Image</>}
        </button>

        {imageUrl && (
          <div style={{ margin: '0 -12px -12px', borderTop: '1px solid var(--border)' }}>
            <div className="checker-bg" style={{ borderRadius: '0 0 11px 11px', overflow: 'hidden' }}>
              <img src={imageUrl} alt="Generated" style={{ width: '100%', display: 'block', maxHeight: 320, objectFit: 'contain' }} />
            </div>
            <a
              href={imageUrl}
              download="nano-banana-2.png"
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, padding: '7px 12px', fontSize: 11, color: 'var(--t3)', textDecoration: 'none', borderTop: '1px solid var(--border)' }}
            >
              ↓ Save Image
            </a>
          </div>
        )}
      </div>
      <Handle type="source" position={Position.Right} style={{ top: '50%' }} />
    </div>
  )
}
