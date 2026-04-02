import { Handle, Position, type NodeProps, useEdges } from '@xyflow/react'
import { Video } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'
import { createKlingTask, pollKlingTask } from '../api/kling'
import { useNodeStore } from '../store'
import { useSettings } from '../SettingsContext'
import { NodeMenu } from '../components/NodeMenu'
import { registerNodeRunner, unregisterNodeRunner } from '../nodeRunner'

export function KlingNode({ id, selected }: NodeProps) {
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
  const model = (data.model as string) ?? 'kling-v2-master'
  const duration = (data.duration as number) ?? 5
  const aspectRatio = (data.aspectRatio as string) ?? '16:9'
  const videoUrl = (data.videoUrl as string) ?? ''

  function getConnectedPrompt(): string {
    const incomingEdge = edges.find(e => e.target === id)
    if (!incomingEdge) return (data.prompt as string) ?? ''
    const sourceNode = nodes.find(n => n.id === incomingEdge.source)
    // Could come from text node or image node
    const srcData = (sourceNode?.data as Record<string, unknown>) ?? {}
    return (srcData.text as string) ?? (srcData.prompt as string) ?? (data.prompt as string) ?? ''
  }

  function getConnectedImage(): string | undefined {
    const incomingEdge = edges.find(e => e.target === id)
    if (!incomingEdge) return undefined
    const sourceNode = nodes.find(n => n.id === incomingEdge.source)
    return ((sourceNode?.data as Record<string, unknown>)?.imageUrl as string) ?? undefined
  }

  async function run() {
    const prompt = getConnectedPrompt()
    if (!prompt.trim()) { setError('No prompt connected or entered'); return }
    if (!settings.klingApiKey || !settings.klingApiSecret) {
      setError('Missing Kling AccessKey or SecretKey in settings')
      return
    }

    setStatus('loading')
    setError('')
    updateNodeData(id, { videoUrl: '' })

    try {
      const connectedImage = getConnectedImage()
      const result = await createKlingTask({
        prompt,
        negativePrompt: negPrompt,
        model,
        duration: duration as 5 | 10,
        aspectRatio: aspectRatio as any,
        imageUrl: connectedImage,
        apiKey: settings.klingApiKey,
        apiSecret: settings.klingApiSecret,
      })

      setStatus('polling')
      setPollMsg('Task submitted, polling...')

      let attempts = 0
      pollRef.current = setInterval(async () => {
        attempts++
        if (attempts > 120) {
          clearInterval(pollRef.current!)
          setStatus('error')
          setError('Timed out after 10 minutes')
          return
        }
        try {
          const poll = await pollKlingTask(result.taskId, settings.klingApiKey, settings.klingApiSecret)
          setPollMsg(`Status: ${poll.status} (${attempts * 5}s)`)
          if (poll.status === 'succeed' && poll.videoUrl) {
            clearInterval(pollRef.current!)
            updateNodeData(id, { videoUrl: poll.videoUrl })
            setStatus('done')
          } else if (poll.status === 'failed') {
            clearInterval(pollRef.current!)
            setStatus('error')
            setError('Kling generation failed')
          }
        } catch (e: any) {
          // Don't stop on transient errors
          setPollMsg(`Poll error: ${e.message}`)
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
    <div className={`node-wrapper ${selected ? 'selected' : ''}`} data-node-type="kling" style={{ minWidth: 300 }}>
      <Handle type="target" position={Position.Left} style={{ top: '50%' }} />
      <div className="node-header">
        <Video size={13} color="#34d399" />
        <span style={{ color: '#34d399' }}>Kling AI Video</span>
        <span style={{ marginLeft: 'auto' }} className={`status-badge status-${status === 'polling' ? 'loading' : status}`}>
          {(status === 'loading' || status === 'polling') && <div className="spinner" />}
          {status}
        </span>
              <NodeMenu id={id} />
      </div>
      <div className="node-body">
        <div>
          <div className="field-label">Prompt (or connect Text/Image node)</div>
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
            placeholder="blurry, distorted..."
          />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
          <div>
            <div className="field-label">Model</div>
            <select value={model} onChange={e => updateNodeData(id, { model: e.target.value })}>
              <option value="kling-v2-master">v2-master</option>
              <option value="kling-v1-6">v1.6</option>
              <option value="kling-v1-5">v1.5</option>
            </select>
          </div>
          <div>
            <div className="field-label">Duration</div>
            <select value={duration} onChange={e => updateNodeData(id, { duration: Number(e.target.value) })}>
              <option value={5}>5s</option>
              <option value={10}>10s</option>
            </select>
          </div>
          <div>
            <div className="field-label">Ratio</div>
            <select value={aspectRatio} onChange={e => updateNodeData(id, { aspectRatio: e.target.value })}>
              <option value="16:9">16:9</option>
              <option value="9:16">9:16</option>
              <option value="1:1">1:1</option>
            </select>
          </div>
        </div>

        {status === 'polling' && (
          <div className="poll-indicator"><div className="spinner" />{pollMsg}</div>
        )}
        {error && <div style={{ color: '#f87171', fontSize: 11 }}>{error}</div>}

        <button className="btn-run" onClick={run} disabled={status === 'loading' || status === 'polling'}>
          {(status === 'loading' || status === 'polling') ? <><div className="spinner" /> Processing...</> : <><Video size={13} /> Generate Video</>}
        </button>

        {videoUrl && (
          <div style={{ margin: '0 -12px -12px', borderTop: '1px solid var(--border)' }}>
            <video src={videoUrl} controls style={{ width: '100%', display: 'block', maxHeight: 320, background: '#000' }} />
            <a
              href={videoUrl}
              download="kling-video.mp4"
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, padding: '7px 12px', fontSize: 11, color: 'var(--t3)', textDecoration: 'none', borderTop: '1px solid var(--border)' }}
            >
              ↓ Save Video
            </a>
          </div>
        )}
      </div>
      <Handle type="source" position={Position.Right} style={{ top: '50%' }} />
    </div>
  )
}
