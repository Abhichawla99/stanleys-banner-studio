import { Handle, Position, type NodeProps, useEdges } from '@xyflow/react'
import { Layers, Star } from 'lucide-react'
import { useState, useEffect, useRef } from 'react'
import { useNodeStore } from '../store'
import { useSettings } from '../SettingsContext'
import { NodeMenu } from '../components/NodeMenu'
import { registerNodeRunner, unregisterNodeRunner } from '../nodeRunner'
import { generateImage } from '../api/nanoBanana'
import { trackApiCall } from '../apiCallTracker'

const VARIATION_SEEDS = [
  'slightly different angle and composition',
  'warm golden hour lighting',
  'alternative complementary color palette',
  'more dynamic and energetic framing',
  'softer, more ethereal atmosphere',
  'high-contrast bold graphic style',
  'wider establishing perspective',
  'tight close-up with detail focus',
  'minimal clean negative space',
  'vibrant saturated color treatment',
]

export function BatchVariantsNode({ id, selected }: NodeProps) {
  const { nodes, updateNodeData } = useNodeStore()
  const edges = useEdges()
  const node = nodes.find(n => n.id === id)
  const data = (node?.data as Record<string, unknown>) ?? {}
  const settings = useSettings()

  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [error, setError] = useState('')
  const [progress, setProgress] = useState(0)
  const runRef = useRef<() => Promise<void>>(async () => {})

  const count = (data.count as number) ?? 4
  const provider = (data.provider as string) ?? 'gemini'
  const aspectRatio = (data.aspectRatio as string) ?? '1:1'
  const variants = (data.variants as string[]) ?? []
  const starred = (data.starred as number[]) ?? []

  function getInputs(): { prompt: string; referenceImage: string } {
    let prompt = ''
    let referenceImage = ''
    for (const edge of edges.filter(e => e.target === id)) {
      const src = nodes.find(n => n.id === edge.source)
      const d = (src?.data as Record<string, unknown>) ?? {}
      const img = d.imageUrl as string
      if (img) referenceImage = img
      const txt = (d.text as string) ?? (d.output as string) ?? (d.prompt as string)
      if (txt && !img) prompt = txt
    }
    return { prompt, referenceImage }
  }

  async function run() {
    const { prompt, referenceImage } = getInputs()
    if (!prompt && !referenceImage) { setError('Connect a text or image node first'); return }

    const apiKey = provider === 'fal' ? settings.falApiKey : settings.geminiApiKey
    if (!apiKey) { setError(`No ${provider === 'fal' ? 'fal.ai' : 'Gemini'} API key`); return }

    setStatus('loading')
    setError('')
    setProgress(0)

    const results: string[] = []
    for (let i = 0; i < count; i++) {
      const seed = VARIATION_SEEDS[i % VARIATION_SEEDS.length]
      const variantPrompt = prompt
        ? `${prompt} — ${seed}`
        : `Variation: ${seed}`
      try {
        const result = await generateImage({
          prompt: variantPrompt,
          aspectRatio: aspectRatio as any,
          provider: provider as 'gemini' | 'fal',
          apiKey,
          referenceImages: referenceImage ? [{ name: 'source', url: referenceImage }] : undefined,
        })
        results.push(result.imageUrl)
        trackApiCall('nanoBanana')
        setProgress(i + 1)
        updateNodeData(id, { variants: [...results], starred: [] })
      } catch (e: any) {
        setError(`Variant ${i + 1} failed: ${e.message}`)
        setStatus('error')
        return
      }
    }

    updateNodeData(id, { variants: results, starred: [], imageUrl: results[0] })
    setStatus('done')
  }

  runRef.current = run
  useEffect(() => {
    registerNodeRunner(id, () => runRef.current())
    return () => unregisterNodeRunner(id)
  }, [id])

  function toggleStar(i: number) {
    const newStarred = starred.includes(i)
      ? starred.filter(s => s !== i)
      : [...starred, i]
    const outputImages = newStarred.length > 0
      ? newStarred.map(s => variants[s])
      : variants
    updateNodeData(id, { starred: newStarred, imageUrl: outputImages[0] ?? variants[0] })
  }

  const cols = variants.length <= 2 ? 2 : variants.length <= 4 ? 2 : 3

  return (
    <div className={`node-wrapper ${selected ? 'selected' : ''}`} data-node-type="batchVariants" style={{ minWidth: 320 }}>
      <Handle type="target" position={Position.Left} style={{ top: '50%' }} />
      <div className="node-header">
        <Layers size={13} color="#a78bfa" />
        <span style={{ color: '#a78bfa' }}>Batch Variants</span>
        <span style={{ marginLeft: 'auto' }} className={`status-badge status-${status}`}>
          {status === 'loading' && <><div className="spinner" />{progress}/{count}</>}
          {status !== 'loading' && status}
        </span>
        <NodeMenu id={id} />
      </div>
      <div className="node-body">

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
          <div>
            <div className="field-label">Count</div>
            <select value={count} onChange={e => updateNodeData(id, { count: Number(e.target.value) })}>
              {[2, 4, 6, 8, 10].map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          <div>
            <div className="field-label">Provider</div>
            <select value={provider} onChange={e => updateNodeData(id, { provider: e.target.value })}>
              <option value="gemini">Gemini</option>
              <option value="fal">fal.ai</option>
            </select>
          </div>
          <div>
            <div className="field-label">Aspect</div>
            <select value={aspectRatio} onChange={e => updateNodeData(id, { aspectRatio: e.target.value })}>
              <option value="1:1">1:1</option>
              <option value="16:9">16:9</option>
              <option value="9:16">9:16</option>
              <option value="4:3">4:3</option>
            </select>
          </div>
        </div>

        {error && <div style={{ color: 'var(--red)', fontSize: 11 }}>{error}</div>}

        <button className="btn-run" onClick={run} disabled={status === 'loading'}>
          {status === 'loading'
            ? <><div className="spinner" /> Generating {progress}/{count}...</>
            : <><Layers size={13} /> Generate {count} Variants</>}
        </button>

        {variants.length > 0 && (
          <div>
            <div className="field-label" style={{ marginBottom: 6 }}>
              {starred.length > 0 ? `${starred.length} starred — click star to select` : 'Click to star favorites'}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 4 }}>
              {variants.map((url, i) => (
                <div
                  key={i}
                  onClick={() => toggleStar(i)}
                  style={{
                    position: 'relative', cursor: 'pointer', borderRadius: 6, overflow: 'hidden',
                    border: starred.includes(i) ? '2px solid #fbbf24' : '1px solid var(--border2)',
                    transition: 'border-color 0.12s',
                  }}
                >
                  <img src={url} alt={`v${i + 1}`} style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', display: 'block' }} />
                  <div style={{
                    position: 'absolute', bottom: 3, right: 3,
                    background: starred.includes(i) ? 'rgba(251,191,36,0.9)' : 'rgba(0,0,0,0.5)',
                    borderRadius: 4, padding: '2px 4px', display: 'flex', alignItems: 'center',
                  }}>
                    <Star size={10} fill={starred.includes(i) ? '#fff' : 'none'} color={starred.includes(i) ? '#fff' : '#aaa'} />
                  </div>
                  <div style={{ position: 'absolute', top: 3, left: 4, fontSize: 9, color: 'rgba(255,255,255,0.6)' }}>
                    {i + 1}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      <Handle type="source" position={Position.Right} style={{ top: '50%' }} />
    </div>
  )
}
