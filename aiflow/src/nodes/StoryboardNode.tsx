import { Handle, Position, type NodeProps, useEdges } from '@xyflow/react'
import { Film, ChevronDown, ChevronUp } from 'lucide-react'
import { useState, useEffect, useRef } from 'react'
import { callLLM } from '../api/llm'
import { useNodeStore } from '../store'
import { useSettings } from '../SettingsContext'
import { NodeMenu } from '../components/NodeMenu'
import { registerNodeRunner, unregisterNodeRunner } from '../nodeRunner'

interface Scene {
  sceneNumber: number
  description: string
  visualDirection: string
  mood: string
}

const SYSTEM_PROMPT = `You are a professional storyboard director and visual storyteller. When given a concept or brief, you break it down into a structured series of scenes/shots for visual production.

Return ONLY a valid JSON array (no markdown, no explanation) with 4-8 scenes. Each scene must have:
- sceneNumber: integer starting at 1
- description: 1-2 sentences describing what happens in this scene
- visualDirection: specific visual/camera direction (angle, lighting, composition, color palette)
- mood: 2-4 words capturing the emotional tone

Example output format:
[
  {
    "sceneNumber": 1,
    "description": "A lone figure walks through a neon-lit alley in the rain.",
    "visualDirection": "Low angle shot, deep shadows, neon reflections on wet pavement, blue/magenta color grade",
    "mood": "mysterious, tense"
  }
]`

export function StoryboardNode({ id, selected }: NodeProps) {
  const { nodes, updateNodeData } = useNodeStore()
  const edges = useEdges()
  const node = nodes.find(n => n.id === id)
  const data = (node?.data as Record<string, unknown>) ?? {}
  const settings = useSettings()

  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [error, setError] = useState('')
  const [expandedScene, setExpandedScene] = useState<number | null>(null)
  const runRef = useRef<() => Promise<void>>(async () => {})

  const provider = (data.provider as string) ?? 'gemini'
  const model = (data.model as string) ?? (provider === 'openai' ? 'gpt-4o-mini' : 'gemini-2.0-flash')
  const sceneCount = (data.sceneCount as number) ?? 6
  const output = (data.output as string) ?? ''

  const GEMINI_MODELS = ['gemini-2.0-flash', 'gemini-2.5-flash-preview-05-20', 'gemini-1.5-pro']
  const OPENAI_MODELS = ['gpt-4o-mini', 'gpt-4o']

  let scenes: Scene[] = []
  try {
    if (output) scenes = JSON.parse(output)
  } catch {}

  function getConnectedConcept(): string {
    const edge = edges.find(e => e.target === id)
    if (!edge) return (data.concept as string) ?? ''
    const src = nodes.find(n => n.id === edge.source)
    const d = (src?.data as Record<string, unknown>) ?? {}
    return (d.text as string) ?? (d.output as string) ?? (data.concept as string) ?? ''
  }

  async function run() {
    const concept = getConnectedConcept()
    if (!concept.trim()) { setError('No concept connected or entered'); return }

    const apiKey = provider === 'openai' ? settings.openAiApiKey : settings.geminiApiKey
    if (!apiKey) { setError(`No ${provider === 'openai' ? 'OpenAI' : 'Gemini'} API key in settings`); return }

    setStatus('loading')
    setError('')

    try {
      const userPrompt = `Create a storyboard with exactly ${sceneCount} scenes for this concept:\n\n${concept}`
      const result = await callLLM({
        provider: provider as 'gemini' | 'openai',
        model,
        systemPrompt: SYSTEM_PROMPT,
        userPrompt,
        apiKey,
        temperature: 0.7,
      })

      // Strip markdown fences if present
      const cleaned = result.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim()
      // Validate JSON
      JSON.parse(cleaned)
      updateNodeData(id, { output: cleaned, text: cleaned })
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

  const MOOD_COLORS: Record<string, string> = {
    mysterious: '#a78bfa', tense: '#f87171', hopeful: '#4ade80',
    melancholy: '#60a5fa', dramatic: '#f59e0b', calm: '#67e8f9',
    dark: '#94a3b8', bright: '#fbbf24', romantic: '#f472b6',
  }

  function moodColor(mood: string): string {
    const key = mood.toLowerCase().split(/[\s,]/)[0]
    return MOOD_COLORS[key] ?? '#a3a3a3'
  }

  return (
    <div className={`node-wrapper ${selected ? 'selected' : ''}`} data-node-type="storyboard" style={{ minWidth: 320 }}>
      <Handle type="target" position={Position.Left} style={{ top: '50%' }} />
      <div className="node-header">
        <Film size={13} color="#e879f9" />
        <span style={{ color: '#e879f9' }}>Storyboard</span>
        <span style={{ marginLeft: 'auto' }} className={`status-badge status-${status}`}>
          {status === 'loading' && <div className="spinner" />}
          {status}
        </span>
        <NodeMenu id={id} />
      </div>
      <div className="node-body">
        {/* Concept input */}
        <div>
          <div className="field-label">Concept / Brief (or connect Text node)</div>
          <textarea
            rows={2}
            value={(data.concept as string) ?? ''}
            onChange={e => updateNodeData(id, { concept: e.target.value })}
            placeholder="A product launch video for a luxury watch brand..."
          />
        </div>

        {/* Provider + Model + Scene count */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 80px', gap: 8 }}>
          <div>
            <div className="field-label">Provider</div>
            <select
              value={provider}
              onChange={e => updateNodeData(id, {
                provider: e.target.value,
                model: e.target.value === 'openai' ? 'gpt-4o-mini' : 'gemini-2.0-flash',
              })}
            >
              <option value="gemini">Gemini</option>
              <option value="openai">OpenAI</option>
            </select>
          </div>
          <div>
            <div className="field-label">Model</div>
            <select value={model} onChange={e => updateNodeData(id, { model: e.target.value })}>
              {(provider === 'openai' ? OPENAI_MODELS : GEMINI_MODELS).map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
          <div>
            <div className="field-label">Scenes</div>
            <select value={sceneCount} onChange={e => updateNodeData(id, { sceneCount: parseInt(e.target.value) })}>
              {[4, 5, 6, 7, 8].map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
        </div>

        {error && <div style={{ color: '#f87171', fontSize: 11 }}>{error}</div>}

        <button className="btn-run" onClick={run} disabled={status === 'loading'}>
          {status === 'loading'
            ? <><div className="spinner" /> Generating storyboard...</>
            : <><Film size={13} /> Generate Storyboard</>}
        </button>

        {/* Scene cards */}
        {scenes.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div className="field-label">{scenes.length} Scenes</div>
            {scenes.map(scene => (
              <div
                key={scene.sceneNumber}
                style={{
                  background: 'var(--s2)',
                  border: '1px solid var(--border)',
                  borderRadius: 7,
                  overflow: 'hidden',
                }}
              >
                {/* Scene header - always visible */}
                <button
                  onMouseDown={e => e.stopPropagation()}
                  onClick={() => setExpandedScene(expandedScene === scene.sceneNumber ? null : scene.sceneNumber)}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                    padding: '7px 9px', background: 'none', border: 'none', cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <span style={{
                    minWidth: 22, height: 22, borderRadius: 4, background: '#e879f918',
                    border: '1px solid #e879f940', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 10, fontWeight: 700, color: '#e879f9', flexShrink: 0,
                  }}>
                    {scene.sceneNumber}
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--t1)', flex: 1, lineHeight: 1.4 }}>
                    {scene.description.slice(0, 60)}{scene.description.length > 60 ? '…' : ''}
                  </span>
                  <span style={{
                    fontSize: 9, color: moodColor(scene.mood), background: moodColor(scene.mood) + '18',
                    padding: '2px 6px', borderRadius: 3, flexShrink: 0,
                  }}>
                    {scene.mood}
                  </span>
                  {expandedScene === scene.sceneNumber
                    ? <ChevronUp size={12} color="var(--t3)" />
                    : <ChevronDown size={12} color="var(--t3)" />}
                </button>

                {/* Expanded detail */}
                {expandedScene === scene.sceneNumber && (
                  <div style={{ padding: '0 9px 9px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div style={{ fontSize: 11, color: 'var(--t2)', lineHeight: 1.5 }}>
                      {scene.description}
                    </div>
                    <div>
                      <div style={{ fontSize: 9, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 3 }}>
                        Visual Direction
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--t2)', lineHeight: 1.5, fontStyle: 'italic' }}>
                        {scene.visualDirection}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Raw JSON output preview */}
        {output && (
          <div>
            <div className="field-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>JSON Output</span>
              <span style={{ color: 'var(--t3)', fontSize: 9 }}>{output.length} chars</span>
            </div>
            <textarea
              rows={3}
              value={output}
              readOnly
              style={{ fontSize: 10, color: 'var(--t3)', fontFamily: 'monospace' }}
            />
          </div>
        )}
      </div>
      <Handle type="source" position={Position.Right} style={{ top: '50%' }} />
    </div>
  )
}
