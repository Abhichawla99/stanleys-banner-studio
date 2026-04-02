import { Handle, Position, type NodeProps, useEdges } from '@xyflow/react'
import { Eye } from 'lucide-react'
import { useState, useEffect, useRef } from 'react'
import { describeImage } from '../api/falImage'
import { useNodeStore } from '../store'
import { useSettings } from '../SettingsContext'
import { NodeMenu } from '../components/NodeMenu'
import { registerNodeRunner, unregisterNodeRunner } from '../nodeRunner'

const DESCRIBE_MODES = [
  { value: 'prompt',    label: 'For Prompting',  instruction: 'Describe this image in rich detail as a text-to-image AI prompt. Focus on: subject, style, lighting, colors, composition, mood, and technical camera details. Output a single detailed prompt paragraph.' },
  { value: 'caption',  label: 'Caption',         instruction: 'Write a concise, natural language caption describing what is in this image in 1-2 sentences.' },
  { value: 'detailed', label: 'Full Detail',      instruction: 'Provide a comprehensive, detailed description of everything you see in this image: subjects, colors, textures, lighting, atmosphere, background, and any notable artistic or technical elements.' },
  { value: 'style',    label: 'Style Analysis',   instruction: 'Analyze the visual style of this image: art style, photography style, color palette, lighting techniques, composition rules used, and overall aesthetic. Use technical terminology.' },
]

export function ImageDescriberNode({ id, selected }: NodeProps) {
  const { nodes, updateNodeData } = useNodeStore()
  const edges = useEdges()
  const node = nodes.find(n => n.id === id)
  const data = (node?.data as Record<string, unknown>) ?? {}
  const settings = useSettings()

  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [error, setError] = useState('')
  const runRef = useRef<() => Promise<void>>(async () => {})

  const mode = (data.mode as string) ?? 'prompt'
  const output = (data.output as string) ?? ''

  function getConnectedImage(): string {
    const incomingEdge = edges.find(e => e.target === id)
    if (!incomingEdge) return ''
    const src = nodes.find(n => n.id === incomingEdge.source)
    const d = (src?.data as Record<string, unknown>) ?? {}
    return (d.imageUrl as string) ?? ''
  }

  async function describe() {
    if (!settings.geminiApiKey) { setError('Gemini API key required (in settings)'); return }
    const imageUrl = getConnectedImage()
    if (!imageUrl) { setError('Connect an image node (Nano Banana, Flux, or File Upload)'); return }

    const instruction = DESCRIBE_MODES.find(m => m.value === mode)?.instruction ?? DESCRIBE_MODES[0].instruction

    setStatus('loading')
    setError('')
    try {
      const result = await describeImage(imageUrl, settings.geminiApiKey, instruction)
      updateNodeData(id, { output: result, text: result })
      setStatus('done')
    } catch (e: any) {
      setError(e.message)
      setStatus('error')
    }
  }

  runRef.current = describe
  useEffect(() => {
    registerNodeRunner(id, () => runRef.current())
    return () => unregisterNodeRunner(id)
  }, [id])

  const previewUrl = getConnectedImage()

  return (
    <div className={`node-wrapper ${selected ? 'selected' : ''}`} data-node-type="imageDescriber" style={{ minWidth: 280 }}>
      <Handle type="target" position={Position.Left} style={{ top: '50%' }} />
      <div className="node-header">
        <Eye size={13} color="#67e8f9" />
        <span style={{ color: '#67e8f9' }}>Image Describer</span>
        <span style={{ marginLeft: 'auto' }} className={`status-badge status-${status}`}>
          {status === 'loading' && <div className="spinner" />}
          {status}
        </span>
        <NodeMenu id={id} />
      </div>
      <div className="node-body">
        {/* Preview of connected image */}
        {previewUrl && (
          <img src={previewUrl} alt="Input" className="output-image" style={{ maxHeight: 120, objectFit: 'cover' }} />
        )}
        {!previewUrl && (
          <div style={{ height: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--t3)', fontSize: 11, border: '1px dashed var(--border2)', borderRadius: 6 }}>
            Connect an image node
          </div>
        )}

        {/* Mode */}
        <div>
          <div className="field-label">Output Type</div>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {DESCRIBE_MODES.map(m => (
              <button
                key={m.value}
                onMouseDown={e => e.stopPropagation()}
                onClick={() => updateNodeData(id, { mode: m.value })}
                style={{
                  padding: '3px 8px', borderRadius: 5,
                  border: `1px solid ${mode === m.value ? '#67e8f9' : 'var(--border2)'}`,
                  background: mode === m.value ? 'rgba(103,232,249,0.1)' : 'var(--s3)',
                  color: mode === m.value ? '#67e8f9' : 'var(--t2)',
                  fontSize: 11, cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {error && <div style={{ color: 'var(--red)', fontSize: 11 }}>{error}</div>}

        <button className="btn-run" onClick={describe} disabled={status === 'loading'} style={{ background: '#0e7490' }}>
          {status === 'loading' ? <><div className="spinner" /> Analysing...</> : <><Eye size={13} /> Describe Image</>}
        </button>

        {output && (
          <div>
            <div className="field-label">Description</div>
            <textarea rows={5} value={output} readOnly style={{ fontSize: 11, color: 'var(--t2)', lineHeight: 1.6 }} />
          </div>
        )}
      </div>
      <Handle type="source" position={Position.Right} style={{ top: '50%' }} />
    </div>
  )
}
