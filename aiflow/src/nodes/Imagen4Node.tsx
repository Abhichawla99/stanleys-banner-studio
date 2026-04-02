import { Handle, Position, type NodeProps, useEdges } from '@xyflow/react'
import { Sparkles } from 'lucide-react'
import { useState, useEffect, useRef } from 'react'
import { generateImagen4 } from '../api/imagen4'
import { useNodeStore } from '../store'
import { useSettings } from '../SettingsContext'
import { NodeMenu } from '../components/NodeMenu'
import { registerNodeRunner, unregisterNodeRunner } from '../nodeRunner'
import { getNodeInputs } from '../utils/nodeInputs'
import { trackApiCall } from '../apiCallTracker'

export function Imagen4Node({ id, selected }: NodeProps) {
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
  const imageUrl = (data.imageUrl as string) ?? ''

  function getInputs(): { prompt: string; referenceImages: string[] } {
    return getNodeInputs(edges, nodes, id, (data.prompt as string) ?? '')
  }

  async function run() {
    const { prompt, referenceImages } = getInputs()
    if (!prompt.trim()) { setError('No prompt connected or entered'); return }
    if (!settings.geminiApiKey) { setError('No Gemini API key in settings'); return }

    setStatus('loading')
    setError('')
    updateNodeData(id, { imageUrl: '' })

    try {
      const result = await generateImagen4({
        prompt,
        negativePrompt: negPrompt || undefined,
        aspectRatio: aspectRatio as any,
        apiKey: settings.geminiApiKey,
        referenceImages: referenceImages.length > 0 ? referenceImages : undefined,
      })
      updateNodeData(id, { imageUrl: result.imageUrl })
      trackApiCall('imagen4')
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
    <div className={`node-wrapper ${selected ? 'selected' : ''}`} data-node-type="imagen4" style={{ minWidth: 300 }}>
      <Handle type="target" position={Position.Left} style={{ top: '50%' }} />
      <div className="node-header">
        <Sparkles size={13} color="#4ade80" />
        <span style={{ color: '#4ade80' }}>Imagen 4</span>
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
        <div>
          <div className="field-label">Negative Prompt</div>
          <textarea
            rows={1}
            value={negPrompt}
            onChange={e => updateNodeData(id, { negPrompt: e.target.value })}
            placeholder="blurry, distorted, watermark..."
          />
        </div>
        <div>
          <div className="field-label">Aspect Ratio</div>
          <select value={aspectRatio} onChange={e => updateNodeData(id, { aspectRatio: e.target.value })}>
            <option value="1:1">1:1 Square</option>
            <option value="16:9">16:9 Landscape</option>
            <option value="9:16">9:16 Portrait</option>
            <option value="4:3">4:3</option>
            <option value="3:4">3:4</option>
          </select>
        </div>

        {connectedRefs.length > 0 && (
          <div>
            <div className="field-label">
              {connectedRefs.length} Reference Image{connectedRefs.length > 1 ? 's' : ''} (Gemini remix mode)
            </div>
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

        <div style={{ background: 'var(--s2)', border: '1px solid var(--border)', borderRadius: 6, padding: '6px 9px', fontSize: 10, color: 'var(--t3)', lineHeight: 1.7 }}>
          Uses <strong style={{ color: 'var(--t2)' }}>Gemini API key</strong> · {connectedRefs.length > 0 ? 'Gemini Flash Image (ref mode)' : 'imagen-4.0-generate-preview'}
        </div>

        {error && <div style={{ color: '#f87171', fontSize: 11 }}>{error}</div>}

        <button className="btn-run" onClick={run} disabled={status === 'loading'}>
          {status === 'loading' ? <><div className="spinner" /> Generating...</> : <><Sparkles size={13} /> Generate with Imagen 4</>}
        </button>

        {imageUrl && (
          <div style={{ margin: '0 -12px -12px', borderTop: '1px solid var(--border)' }}>
            <div className="checker-bg" style={{ borderRadius: '0 0 11px 11px', overflow: 'hidden' }}>
              <img src={imageUrl} alt="Generated" style={{ width: '100%', display: 'block', maxHeight: 320, objectFit: 'contain' }} />
            </div>
            <a
              href={imageUrl}
              download="imagen4.png"
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
