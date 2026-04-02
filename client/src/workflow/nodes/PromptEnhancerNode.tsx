import { Handle, Position, type NodeProps, useEdges } from '@xyflow/react'
import { Wand, ArrowRight } from 'lucide-react'
import { useState, useEffect, useRef } from 'react'
import { callLLM } from '../api/llm'
import { useNodeStore } from '../store'
import { useSettings } from '../SettingsContext'
import { NodeMenu } from '../components/NodeMenu'
import { registerNodeRunner, unregisterNodeRunner } from '../nodeRunner'

const ENHANCE_MODES = [
  { value: 'cinematic',   label: '🎬 Cinematic',   desc: 'Film quality, dramatic lighting, depth of field' },
  { value: 'editorial',   label: '📸 Editorial',   desc: 'Magazine-quality, professional photography' },
  { value: 'artistic',    label: '🎨 Artistic',    desc: 'Fine art, painterly, expressive' },
  { value: 'commercial',  label: '💼 Commercial',  desc: 'Clean, product-ready, high contrast' },
  { value: 'anime',       label: '✨ Anime',       desc: 'Japanese animation style, vibrant' },
  { value: 'detailed',    label: '🔍 Detailed',    desc: 'Maximum detail, 8K, ultra realistic' },
  { value: 'custom',      label: '✏️ Custom',      desc: 'Write your own enhancement style' },
]

const SYSTEM_PROMPTS: Record<string, string> = {
  cinematic: `You are a cinematic prompt engineer. Take the user's input and transform it into a vivid, detailed image generation prompt with: dramatic lighting (golden hour, blue hour, or studio lighting), shallow depth of field, cinematic composition, film grain, anamorphic lens flare, specific camera angles, and atmospheric elements. Output ONLY the enhanced prompt, no explanation.`,
  editorial: `You are an editorial photography prompt engineer. Transform the user's input into a professional photography prompt with: specific lighting setup (softbox, natural window light, ring light), composition (rule of thirds, leading lines), medium format camera aesthetic, specific color palette, and magazine-quality finish. Output ONLY the enhanced prompt, no explanation.`,
  artistic: `You are a fine art prompt engineer. Transform the user's input into a rich artistic image generation prompt with: specific art movement (impressionism, surrealism, expressionism), medium (oil paint, watercolor, gouache), texture, brushstroke style, color theory, and emotional tone. Output ONLY the enhanced prompt, no explanation.`,
  commercial: `You are a commercial product photography prompt engineer. Transform the user's input into a clean, commercial-quality prompt with: perfect studio lighting, white or gradient background, product highlighting, shadow work, high contrast, and advertising-ready composition. Output ONLY the enhanced prompt, no explanation.`,
  anime: `You are an anime/manga art prompt engineer. Transform the user's input into a detailed anime-style prompt with: specific animation studio style (Studio Ghibli, KyoAni, Trigger), character detail, background art quality, lighting effects (rim light, God rays), and color vibrancy. Output ONLY the enhanced prompt, no explanation.`,
  detailed: `You are a hyper-detail prompt engineer. Transform the user's input into an ultra-detailed image generation prompt with: 8K resolution descriptors, micro-textures, subsurface scattering, ray-traced lighting, photorealistic details, and specific technical camera settings (f/2.8, ISO 100, 85mm). Output ONLY the enhanced prompt, no explanation.`,
  custom: `You are a creative prompt engineer. Enhance and expand the user's prompt to make it more vivid, specific, and effective for AI image generation. Add descriptive details, lighting, mood, composition, and style. Output ONLY the enhanced prompt, no explanation.`,
}

export function PromptEnhancerNode({ id, selected }: NodeProps) {
  const { nodes, updateNodeData } = useNodeStore()
  const edges = useEdges()
  const node = nodes.find(n => n.id === id)
  const data = (node?.data as Record<string, unknown>) ?? {}
  const settings = useSettings()

  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [error, setError] = useState('')
  const runRef = useRef<() => Promise<void>>(async () => {})

  const mode = (data.mode as string) ?? 'cinematic'
  const customInstruction = (data.customInstruction as string) ?? ''
  const outputText = (data.output as string) ?? ''

  function getConnectedText(): string {
    const incomingEdge = edges.find(e => e.target === id)
    if (!incomingEdge) return (data.inputText as string) ?? ''
    const src = nodes.find(n => n.id === incomingEdge.source)
    const d = (src?.data as Record<string, unknown>) ?? {}
    return (d.text as string) ?? (d.output as string) ?? ''
  }

  async function enhance() {
    const apiKey = settings.geminiApiKey || settings.openAiApiKey
    if (!apiKey) { setError('Add a Gemini or OpenAI API key in settings'); return }

    const input = getConnectedText() || ((data.inputText as string) ?? '')
    if (!input.trim()) { setError('No input text. Connect a node or type below.'); return }

    const systemPrompt = mode === 'custom' && customInstruction
      ? `You are a creative prompt engineer. ${customInstruction}. Output ONLY the enhanced prompt, no explanation.`
      : SYSTEM_PROMPTS[mode] ?? SYSTEM_PROMPTS.custom

    setStatus('loading')
    setError('')
    try {
      const provider = settings.geminiApiKey ? 'gemini' : 'openai'
      const model = provider === 'gemini' ? 'gemini-2.0-flash' : 'gpt-4o-mini'
      const result = await callLLM({ provider, model, systemPrompt, userPrompt: input, apiKey })
      updateNodeData(id, { output: result, text: result })
      setStatus('done')
    } catch (e: any) {
      setError(e.message)
      setStatus('error')
    }
  }

  runRef.current = enhance
  useEffect(() => {
    registerNodeRunner(id, () => runRef.current())
    return () => unregisterNodeRunner(id)
  }, [id])

  return (
    <div className={`node-wrapper ${selected ? 'selected' : ''}`} data-node-type="promptEnhancer" style={{ minWidth: 290 }}>
      <Handle type="target" position={Position.Left} style={{ top: '50%' }} />
      <div className="node-header">
        <Wand size={13} color="#f472b6" />
        <span style={{ color: '#f472b6' }}>Prompt Enhancer</span>
        <span style={{ marginLeft: 'auto' }} className={`status-badge status-${status}`}>
          {status === 'loading' && <div className="spinner" />}
          {status}
        </span>
        <NodeMenu id={id} />
      </div>
      <div className="node-body">
        {/* Mode picker */}
        <div>
          <div className="field-label">Enhancement Style</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {ENHANCE_MODES.map(m => (
              <button
                key={m.value}
                onMouseDown={e => e.stopPropagation()}
                onClick={() => updateNodeData(id, { mode: m.value })}
                title={m.desc}
                style={{
                  padding: '3px 8px',
                  borderRadius: 5,
                  border: `1px solid ${mode === m.value ? '#f472b6' : 'var(--border2)'}`,
                  background: mode === m.value ? 'rgba(244,114,182,0.12)' : 'var(--s3)',
                  color: mode === m.value ? '#f472b6' : 'var(--t2)',
                  fontSize: 11, cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {mode === 'custom' && (
          <div>
            <div className="field-label">Custom Instruction</div>
            <textarea
              rows={2}
              value={customInstruction}
              onChange={e => updateNodeData(id, { customInstruction: e.target.value })}
              placeholder="Enhance it with biopunk aesthetics, organic machinery..."
            />
          </div>
        )}

        {/* Manual input (if no connected node) */}
        <div>
          <div className="field-label">Input (or connect a text node)</div>
          <textarea
            rows={2}
            value={(data.inputText as string) ?? ''}
            onChange={e => updateNodeData(id, { inputText: e.target.value })}
            placeholder="a dog on a beach..."
          />
        </div>

        {error && <div style={{ color: 'var(--red)', fontSize: 11 }}>{error}</div>}

        <button className="btn-run" onClick={enhance} disabled={status === 'loading'} style={{ background: '#be185d' }}>
          {status === 'loading' ? <><div className="spinner" /> Enhancing...</> : <><ArrowRight size={13} /> Enhance Prompt</>}
        </button>

        {outputText && (
          <div>
            <div className="field-label">Enhanced Prompt</div>
            <textarea rows={4} value={outputText} readOnly style={{ fontSize: 11, color: 'var(--t2)', lineHeight: 1.6 }} />
          </div>
        )}
      </div>
      <Handle type="source" position={Position.Right} style={{ top: '50%' }} />
    </div>
  )
}
