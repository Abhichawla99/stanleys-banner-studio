import { Handle, Position, type NodeProps, useEdges } from '@xyflow/react'
import { Image, ChevronDown, ChevronUp } from 'lucide-react'
import { useState, useEffect, useRef } from 'react'
import { generateImage } from '../api/nanoBanana'
import { useNodeStore } from '../store'
import { useSettings } from '../SettingsContext'
import { NodeMenu } from '../components/NodeMenu'
import { registerNodeRunner, unregisterNodeRunner } from '../nodeRunner'
import { getNodeInputs } from '../utils/nodeInputs'
import { trackApiCall } from '../apiCallTracker'
import { ImageHistory, pushHistory, type HistoryItem } from '../components/ImageHistory'

export function NanoBananaNode({ id, selected }: NodeProps) {
  const { nodes, updateNodeData } = useNodeStore()
  const edges = useEdges()
  const node = nodes.find(n => n.id === id)
  const data = (node?.data as Record<string, unknown>) ?? {}
  const settings = useSettings()

  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [error, setError] = useState('')
  const [showSettings, setShowSettings] = useState(false)
  const runRef = useRef<() => Promise<void>>(async () => {})

  const negPrompt = (data.negPrompt as string) ?? ''
  const aspectRatio = (data.aspectRatio as string) ?? '1:1'
  const provider = (data.provider as string) ?? 'gemini'
  const imageUrl = (data.imageUrl as string) ?? ''
  const history: HistoryItem[] = (data.history as HistoryItem[]) ?? []

  function getInputs() {
    return getNodeInputs(edges, nodes, id, (data.prompt as string) ?? '')
  }

  async function run() {
    const { prompt, referenceImages } = getInputs()
    if (!prompt.trim() && referenceImages.length === 0) {
      setError('Connect a text or image node, or enter a prompt')
      return
    }

    const apiKey = provider === 'fal' ? settings.falApiKey : settings.geminiApiKey
    if (!apiKey) { setError(`No ${provider === 'fal' ? 'fal.ai' : 'Gemini'} API key in settings`); return }

    setStatus('loading')
    setError('')
    try {
      const result = await generateImage({
        prompt: prompt || 'Generate an image based on the provided reference images.',
        negativePrompt: negPrompt,
        aspectRatio: aspectRatio as any,
        provider: provider as 'gemini' | 'fal',
        apiKey,
        referenceImages: referenceImages.length > 0 ? referenceImages : undefined,
      })
      updateNodeData(id, pushHistory(history, result.imageUrl, prompt))
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
        {connectedRefs.length > 0 && (
          <div>
            <div className="field-label">{connectedRefs.length} Reference Image{connectedRefs.length > 1 ? 's' : ''}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {connectedRefs.map((ref, i) => (
                <div
                  key={i}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    background: 'var(--s2)', borderRadius: 6,
                    padding: '4px 8px', border: '1px solid var(--border)',
                  }}
                >
                  <img
                    src={ref.url}
                    alt={ref.name}
                    style={{ width: 36, height: 36, objectFit: 'cover', borderRadius: 4, flexShrink: 0 }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--t1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {ref.name}
                    </div>
                    <div style={{ fontSize: 9, color: 'var(--t3)', fontFamily: 'monospace' }}>
                      image{i + 1}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div>
          <div className="field-label">Prompt {connectedRefs.length > 0 && <span style={{ color: 'var(--t3)', fontWeight: 400 }}>(reference images by name)</span>}</div>
          <textarea
            rows={3}
            value={(data.prompt as string) ?? ''}
            onChange={e => updateNodeData(id, { prompt: e.target.value })}
            placeholder={connectedRefs.length > 0
              ? `e.g. "Place the artwork from [image1] into the white space of [image2]."`
              : 'Describe the image to generate...'}
          />
        </div>

        <button
          onClick={() => setShowSettings(!showSettings)}
          style={{
            background: 'none', border: 'none', color: 'var(--t3)', cursor: 'pointer',
            fontSize: 11, display: 'flex', alignItems: 'center', gap: 4, padding: '2px 0',
          }}
        >
          {showSettings ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          Settings
        </button>

        {showSettings && (
          <>
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
                  <optgroup label="Square">
                    <option value="1:1">1:1 Square</option>
                  </optgroup>
                  <optgroup label="Landscape">
                    <option value="4:3">4:3 — 48 Sheet</option>
                    <option value="3:2">3:2 — Press Landscape</option>
                    <option value="16:9">16:9 Wide</option>
                    <option value="2:1">2:1 Panoramic</option>
                    <option value="3:1">3:1 — Extreme Landscape</option>
                    <option value="4:1">4:1 — 96 Sheet</option>
                    <option value="21:9">21:9 Ultra Wide</option>
                  </optgroup>
                  <optgroup label="Portrait">
                    <option value="3:4">3:4 — 6 Sheet</option>
                    <option value="2:3">2:3 — Press Portrait</option>
                    <option value="9:16">9:16 Tall</option>
                    <option value="1:2">1:2 Tall Narrow</option>
                    <option value="1:3">1:3 — Extreme Portrait OOH</option>
                    <option value="1:4">1:4 Ultra Tall</option>
                    <option value="9:21">9:21</option>
                  </optgroup>
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
          </>
        )}

        {error && <div style={{ color: '#f87171', fontSize: 11 }}>{error}</div>}

        <button className="btn-run" onClick={run} disabled={status === 'loading'}>
          {status === 'loading' ? <><div className="spinner" /> Generating...</> : <><Image size={13} /> Generate</>}
        </button>

        <ImageHistory
          imageUrl={imageUrl}
          history={history}
          onSelectImage={url => updateNodeData(id, { imageUrl: url })}
          downloadName="nano-banana"
        />
      </div>
      <Handle type="source" position={Position.Right} style={{ top: '50%' }} />
    </div>
  )
}
