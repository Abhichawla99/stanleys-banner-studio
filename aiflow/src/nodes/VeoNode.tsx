import { Handle, Position, type NodeProps, useEdges } from '@xyflow/react'
import { Film } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'
import { createVeoTask, pollVeoOperation } from '../api/veo'
import { useNodeStore } from '../store'
import { useSettings } from '../SettingsContext'
import { NodeMenu } from '../components/NodeMenu'
import { registerNodeRunner, unregisterNodeRunner } from '../nodeRunner'

export function VeoNode({ id, selected }: NodeProps) {
  const { nodes, updateNodeData } = useNodeStore()
  const edges = useEdges()
  const node = nodes.find(n => n.id === id)
  const data = (node?.data as Record<string, unknown>) ?? {}
  const settings = useSettings()
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const [status, setStatus] = useState<'idle' | 'loading' | 'polling' | 'done' | 'error'>('idle')
  const [error, setError] = useState('')
  const [pollMsg, setPollMsg] = useState('')

  const negPrompt = (data.negPrompt as string) ?? ''
  const model = (data.model as string) ?? 'veo-3.1-generate-preview'
  const duration = (data.duration as number) ?? 8
  const aspectRatio = (data.aspectRatio as string) ?? '16:9'
  const resolution = (data.resolution as string) ?? '1080p'
  const generateAudio = (data.generateAudio as boolean) ?? false
  const videoUrl = (data.videoUrl as string) ?? ''

  function getConnectedPrompt(): string {
    const incomingEdge = edges.find(e => e.target === id)
    if (!incomingEdge) return (data.prompt as string) ?? ''
    const sourceNode = nodes.find(n => n.id === incomingEdge.source)
    const srcData = (sourceNode?.data as Record<string, unknown>) ?? {}
    return (srcData.text as string) ?? (srcData.prompt as string) ?? (data.prompt as string) ?? ''
  }

  async function run() {
    const prompt = getConnectedPrompt()
    if (!prompt.trim()) { setError('No prompt connected or entered'); return }
    if (!settings.geminiApiKey) { setError('No Gemini API key in settings'); return }

    setStatus('loading')
    setError('')
    updateNodeData(id, { videoUrl: '' })

    try {
      const result = await createVeoTask({
        prompt,
        negativePrompt: negPrompt,
        model: model as any,
        durationSeconds: duration as any,
        aspectRatio: aspectRatio as any,
        resolution: resolution as any,
        generateAudio,
        apiKey: settings.geminiApiKey,
      })

      setStatus('polling')
      setPollMsg('Operation created, polling...')

      let attempts = 0
      pollRef.current = setInterval(async () => {
        attempts++
        if (attempts > 180) {
          clearInterval(pollRef.current!)
          setStatus('error')
          setError('Timed out after 15 minutes')
          return
        }
        try {
          const poll = await pollVeoOperation(result.operationName, settings.geminiApiKey)
          setPollMsg(`Polling... (${attempts * 5}s)`)
          if (poll.status === 'done') {
            clearInterval(pollRef.current!)
            if (poll.videoUrl) {
              updateNodeData(id, { videoUrl: poll.videoUrl })
              setStatus('done')
            } else {
              setStatus('error')
              setError('Generation complete but no video URL returned')
            }
          }
        } catch (e: any) {
          clearInterval(pollRef.current!)
          setStatus('error')
          setError(e.message)
        }
      }, 5000)

    } catch (e: any) {
      setError(e.message)
      setStatus('error')
    }
  }

  const runRef = useRef(run)
  runRef.current = run
  useEffect(() => {
    registerNodeRunner(id, () => runRef.current())
    return () => unregisterNodeRunner(id)
  }, [id])

  return (
    <div className={`node-wrapper ${selected ? 'selected' : ''}`} data-node-type="veo" style={{ minWidth: 300 }}>
      <Handle type="target" position={Position.Left} style={{ top: '50%' }} />
      <div className="node-header">
        <Film size={13} color="#60a5fa" />
        <span style={{ color: '#60a5fa' }}>Veo 3.1 Video</span>
        <span style={{ marginLeft: 'auto' }} className={`status-badge status-${status === 'polling' ? 'loading' : status}`}>
          {(status === 'loading' || status === 'polling') && <div className="spinner" />}
          {status}
        </span>
              <NodeMenu id={id} />
      </div>
      <div className="node-body">
        <div>
          <div className="field-label">Prompt (or connect Text Input)</div>
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
            placeholder="blurry, low quality..."
          />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <div>
            <div className="field-label">Model</div>
            <select value={model} onChange={e => updateNodeData(id, { model: e.target.value })}>
              <option value="veo-3.1-generate-preview">Veo 3.1</option>
              <option value="veo-3.0-generate-preview">Veo 3.0</option>
            </select>
          </div>
          <div>
            <div className="field-label">Duration</div>
            <select value={duration} onChange={e => updateNodeData(id, { duration: Number(e.target.value) })}>
              <option value={4}>4s</option>
              <option value={6}>6s</option>
              <option value={8}>8s</option>
            </select>
          </div>
          <div>
            <div className="field-label">Aspect Ratio</div>
            <select value={aspectRatio} onChange={e => updateNodeData(id, { aspectRatio: e.target.value })}>
              <option value="16:9">16:9</option>
              <option value="9:16">9:16</option>
            </select>
          </div>
          <div>
            <div className="field-label">Resolution</div>
            <select value={resolution} onChange={e => updateNodeData(id, { resolution: e.target.value })}>
              <option value="720p">720p</option>
              <option value="1080p">1080p</option>
            </select>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input
            type="checkbox"
            id={`audio-${id}`}
            checked={generateAudio}
            onChange={e => updateNodeData(id, { generateAudio: e.target.checked })}
            style={{ width: 14, height: 14 }}
          />
          <label htmlFor={`audio-${id}`} style={{ fontSize: 12, color: '#8888a0', cursor: 'pointer' }}>
            Generate audio
          </label>
        </div>

        {status === 'polling' && (
          <div className="poll-indicator"><div className="spinner" />{pollMsg}</div>
        )}
        {error && <div style={{ color: '#f87171', fontSize: 11 }}>{error}</div>}

        <button className="btn-run" onClick={run} disabled={status === 'loading' || status === 'polling'}>
          {(status === 'loading' || status === 'polling') ? <><div className="spinner" /> Processing...</> : <><Film size={13} /> Generate Video</>}
        </button>

        {videoUrl && (
          <div>
            <div className="field-label">Output</div>
            <video src={videoUrl} controls className="output-video" />
            <a
              href={videoUrl}
              download="veo-video.mp4"
              style={{ display: 'block', textAlign: 'center', marginTop: 6, fontSize: 11, color: '#6c63ff' }}
            >
              Download
            </a>
          </div>
        )}
      </div>
      <Handle type="source" position={Position.Right} style={{ top: '50%' }} />
    </div>
  )
}
