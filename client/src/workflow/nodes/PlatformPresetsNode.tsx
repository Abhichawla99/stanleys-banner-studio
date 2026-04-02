import { Handle, Position, type NodeProps, useEdges } from '@xyflow/react'
import { Monitor } from 'lucide-react'
import { useState, useEffect, useRef } from 'react'
import { useNodeStore } from '../store'
import { useSettings } from '../SettingsContext'
import { NodeMenu } from '../components/NodeMenu'
import { registerNodeRunner, unregisterNodeRunner } from '../nodeRunner'
import { generateImage } from '../api/nanoBanana'
import { trackApiCall } from '../apiCallTracker'

interface Platform {
  id: string
  label: string
  aspectRatio: '1:1' | '16:9' | '9:16' | '4:3' | '3:4'
  dims: string
}

const PLATFORMS: Platform[] = [
  { id: 'instagram_post',   label: 'Instagram Post',    aspectRatio: '1:1',  dims: '1080×1080' },
  { id: 'instagram_story',  label: 'Instagram Story',   aspectRatio: '9:16', dims: '1080×1920' },
  { id: 'linkedin',         label: 'LinkedIn Post',     aspectRatio: '16:9', dims: '1200×627' },
  { id: 'youtube',          label: 'YouTube Thumbnail', aspectRatio: '16:9', dims: '1280×720' },
  { id: 'tiktok',           label: 'TikTok',            aspectRatio: '9:16', dims: '1080×1920' },
  { id: 'twitter',          label: 'Twitter/X Post',    aspectRatio: '16:9', dims: '1600×900' },
  { id: 'facebook',         label: 'Facebook Ad',       aspectRatio: '16:9', dims: '1200×628' },
]

interface PlatformResult { platformId: string; imageUrl: string }

export function PlatformPresetsNode({ id, selected }: NodeProps) {
  const { nodes, updateNodeData } = useNodeStore()
  const edges = useEdges()
  const node = nodes.find(n => n.id === id)
  const data = (node?.data as Record<string, unknown>) ?? {}
  const settings = useSettings()

  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [error, setError] = useState('')
  const [currentPlatform, setCurrentPlatform] = useState('')
  const runRef = useRef<() => Promise<void>>(async () => {})

  const selectedPlatforms = (data.selectedPlatforms as string[]) ?? ['instagram_post']
  const provider = (data.provider as string) ?? 'gemini'
  const results = (data.results as PlatformResult[]) ?? []
  const activePlatformId = (data.activePlatformId as string) ?? (results[0]?.platformId ?? '')

  function getUpstreamImage(): { imageUrl: string; prompt: string } {
    for (const edge of edges.filter(e => e.target === id)) {
      const src = nodes.find(n => n.id === edge.source)
      const d = (src?.data as Record<string, unknown>) ?? {}
      const img = d.imageUrl as string
      if (img) {
        const txt = (d.prompt as string) ?? (d.text as string) ?? ''
        return { imageUrl: img, prompt: txt }
      }
    }
    return { imageUrl: '', prompt: '' }
  }

  async function run() {
    const { imageUrl, prompt } = getUpstreamImage()
    if (!imageUrl) { setError('Connect an image node first'); return }

    const apiKey = provider === 'fal' ? settings.falApiKey : settings.geminiApiKey
    if (!apiKey) { setError(`No ${provider === 'fal' ? 'fal.ai' : 'Gemini'} API key`); return }
    if (selectedPlatforms.length === 0) { setError('Select at least one platform'); return }

    setStatus('loading')
    setError('')

    const newResults: PlatformResult[] = []
    for (const platformId of selectedPlatforms) {
      const platform = PLATFORMS.find(p => p.id === platformId)!
      setCurrentPlatform(platform.label)
      const recomposePrompt = prompt
        ? `${prompt}. Recomposed and optimized for ${platform.label} (${platform.dims}) format.`
        : `Recompose this image for ${platform.label} (${platform.dims}) format at ${platform.aspectRatio} aspect ratio. Maintain the key visual elements, focus, and overall style while optimizing the composition for this platform.`
      try {
        const result = await generateImage({
          prompt: recomposePrompt,
          aspectRatio: platform.aspectRatio,
          provider: provider as 'gemini' | 'fal',
          apiKey,
          referenceImages: [imageUrl],
        })
        trackApiCall('nanoBanana')
        newResults.push({ platformId, imageUrl: result.imageUrl })
        updateNodeData(id, { results: [...newResults], imageUrl: newResults[0].imageUrl, activePlatformId: newResults[0].platformId })
      } catch (e: any) {
        setError(`${platform.label} failed: ${e.message}`)
        setStatus('error')
        return
      }
    }

    updateNodeData(id, { results: newResults, imageUrl: newResults[0]?.imageUrl, activePlatformId: newResults[0]?.platformId })
    setStatus('done')
    setCurrentPlatform('')
  }

  runRef.current = run
  useEffect(() => {
    registerNodeRunner(id, () => runRef.current())
    return () => unregisterNodeRunner(id)
  }, [id])

  function togglePlatform(platformId: string) {
    const next = selectedPlatforms.includes(platformId)
      ? selectedPlatforms.filter(p => p !== platformId)
      : [...selectedPlatforms, platformId]
    updateNodeData(id, { selectedPlatforms: next })
  }

  const { imageUrl: upstream } = getUpstreamImage()
  const activeResult = results.find(r => r.platformId === activePlatformId)

  return (
    <div className={`node-wrapper ${selected ? 'selected' : ''}`} data-node-type="platformPresets" style={{ minWidth: 320 }}>
      <Handle type="target" position={Position.Left} style={{ top: '50%' }} />
      <div className="node-header">
        <Monitor size={13} color="#06b6d4" />
        <span style={{ color: '#06b6d4' }}>Platform Presets</span>
        <span style={{ marginLeft: 'auto' }} className={`status-badge status-${status}`}>
          {status === 'loading' && <><div className="spinner" />{currentPlatform || 'Processing'}</>}
          {status !== 'loading' && status}
        </span>
        <NodeMenu id={id} />
      </div>
      <div className="node-body">

        <div>
          <div className="field-label">Select Platforms</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {PLATFORMS.map(p => (
              <label key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', padding: '4px 8px', borderRadius: 5, background: selectedPlatforms.includes(p.id) ? 'var(--accent-bg)' : 'var(--s3)', border: `1px solid ${selectedPlatforms.includes(p.id) ? 'var(--accent)' : 'var(--border2)'}`, transition: 'all 0.1s' }}>
                <input
                  type="checkbox"
                  checked={selectedPlatforms.includes(p.id)}
                  onChange={() => togglePlatform(p.id)}
                  style={{ accentColor: 'var(--accent)', flexShrink: 0 }}
                />
                <span style={{ flex: 1, fontSize: 11, color: 'var(--t1)' }}>{p.label}</span>
                <span style={{ fontSize: 9, color: 'var(--t3)', fontFamily: 'monospace' }}>{p.dims}</span>
              </label>
            ))}
          </div>
        </div>

        <div>
          <div className="field-label">Provider</div>
          <select value={provider} onChange={e => updateNodeData(id, { provider: e.target.value })}>
            <option value="gemini">Gemini API</option>
            <option value="fal">fal.ai</option>
          </select>
        </div>

        {error && <div style={{ color: 'var(--red)', fontSize: 11 }}>{error}</div>}

        <button className="btn-run" onClick={run} disabled={status === 'loading'}>
          {status === 'loading'
            ? <><div className="spinner" /> Generating for {currentPlatform}...</>
            : <><Monitor size={13} /> Recompose for {selectedPlatforms.length} Platform{selectedPlatforms.length !== 1 ? 's' : ''}</>}
        </button>

        {/* Before/After + results */}
        {results.length > 0 && (
          <div>
            <div className="field-label">Results — click to preview</div>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {results.map(r => {
                const plat = PLATFORMS.find(p => p.id === r.platformId)!
                return (
                  <button
                    key={r.platformId}
                    onClick={() => updateNodeData(id, { activePlatformId: r.platformId, imageUrl: r.imageUrl })}
                    style={{
                      padding: '3px 8px', borderRadius: 5, fontSize: 10, cursor: 'pointer',
                      background: activePlatformId === r.platformId ? 'var(--accent-bg)' : 'var(--s3)',
                      border: `1px solid ${activePlatformId === r.platformId ? 'var(--accent)' : 'var(--border2)'}`,
                      color: activePlatformId === r.platformId ? 'var(--accent)' : 'var(--t2)',
                    }}
                  >
                    {plat?.label ?? r.platformId}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {(activeResult || upstream) && (
          <div style={{ display: 'grid', gridTemplateColumns: upstream && activeResult ? '1fr 1fr' : '1fr', gap: 8 }}>
            {upstream && (
              <div>
                <div className="field-label">Original</div>
                <img src={upstream} alt="original" style={{ width: '100%', borderRadius: 6, border: '1px solid var(--border2)', display: 'block' }} />
              </div>
            )}
            {activeResult && (
              <div>
                <div className="field-label">{PLATFORMS.find(p => p.id === activeResult.platformId)?.label ?? 'Output'}</div>
                <img src={activeResult.imageUrl} alt="recomposed" style={{ width: '100%', borderRadius: 6, border: '1px solid var(--accent)', display: 'block' }} />
              </div>
            )}
          </div>
        )}
      </div>
      <Handle type="source" position={Position.Right} style={{ top: '50%' }} />
    </div>
  )
}
