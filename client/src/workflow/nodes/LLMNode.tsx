import { Handle, Position, type NodeProps, useEdges } from '@xyflow/react'
import { Sparkles } from 'lucide-react'
import { useState, useEffect, useRef } from 'react'
import { callLLM } from '../api/llm'
import { useNodeStore } from '../store'
import { useSettings } from '../SettingsContext'
import { NodeMenu } from '../components/NodeMenu'
import { registerNodeRunner, unregisterNodeRunner } from '../nodeRunner'
import { getNodeText } from '../utils/nodeInputs'
import { trackApiCall } from '../apiCallTracker'

export function LLMNode({ id, selected }: NodeProps) {
  const { nodes, updateNodeData } = useNodeStore()
  const edges = useEdges()
  const node = nodes.find(n => n.id === id)
  const data = (node?.data as Record<string, unknown>) ?? {}
  const settings = useSettings()

  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [error, setError] = useState('')
  const runRef = useRef<() => Promise<void>>(async () => {})

  const provider = (data.provider as string) ?? 'gemini'
  const model = (data.model as string) ?? (provider === 'openai' ? 'gpt-4o-mini' : 'gemini-2.0-flash')
  const systemPrompt = (data.systemPrompt as string) ?? ''
  const userPromptTpl = (data.userPromptTpl as string) ?? '{{input}}'
  const temperature = (data.temperature as number) ?? 0.8
  const output = (data.output as string) ?? ''

  const GEMINI_MODELS = ['gemini-2.0-flash', 'gemini-2.5-flash-preview-05-20', 'gemini-1.5-pro']
  const OPENAI_MODELS = ['gpt-4o-mini', 'gpt-4o', 'gpt-4-turbo']

  function getConnectedText(): string {
    return getNodeText(edges, nodes, id)
  }

  async function run() {
    const apiKey = provider === 'openai' ? settings.openAiApiKey : settings.geminiApiKey
    if (!apiKey) { setError(`No ${provider === 'openai' ? 'OpenAI' : 'Gemini'} API key in settings`); return }

    const connectedText = getConnectedText()
    const userPrompt = userPromptTpl.replace('{{input}}', connectedText)

    setStatus('loading')
    setError('')
    try {
      const result = await callLLM({ provider: provider as any, model, systemPrompt, userPrompt, apiKey, temperature })
      updateNodeData(id, { output: result, text: result })
      trackApiCall('llm')
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

  return (
    <div className={`node-wrapper ${selected ? 'selected' : ''}`} data-node-type="llm" style={{ minWidth: 300 }}>
      <Handle type="target" position={Position.Left} style={{ top: '50%' }} />
      <div className="node-header">
        <Sparkles size={13} color="#c084fc" />
        <span style={{ color: '#c084fc' }}>LLM Prompt</span>
        <span style={{ marginLeft: 'auto' }} className={`status-badge status-${status}`}>
          {status === 'loading' && <div className="spinner" />}
          {status}
        </span>
        <NodeMenu id={id} />
      </div>
      <div className="node-body">
        {/* Provider + Model */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <div>
            <div className="field-label">Provider</div>
            <select value={provider} onChange={e => updateNodeData(id, { provider: e.target.value, model: e.target.value === 'openai' ? 'gpt-4o-mini' : 'gemini-2.0-flash' })}>
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
        </div>

        {/* Temperature */}
        <div>
          <div className="field-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Temperature</span>
            <span style={{ color: 'var(--accent)' }}>{temperature}</span>
          </div>
          <input
            type="range"
            min={0} max={1} step={0.05}
            value={temperature}
            onChange={e => updateNodeData(id, { temperature: parseFloat(e.target.value) })}
            style={{ width: '100%', accentColor: 'var(--accent)' }}
          />
        </div>

        {/* System Prompt */}
        <div>
          <div className="field-label">System Prompt</div>
          <textarea
            rows={3}
            value={systemPrompt}
            onChange={e => updateNodeData(id, { systemPrompt: e.target.value })}
            placeholder="You are a creative AI art director who writes vivid, cinematic image prompts..."
          />
        </div>

        {/* User Prompt Template */}
        <div>
          <div className="field-label">User Prompt (use {'{{input}}'} for connected text)</div>
          <textarea
            rows={3}
            value={userPromptTpl}
            onChange={e => updateNodeData(id, { userPromptTpl: e.target.value })}
            placeholder="Generate 5 detailed image prompts for: {{input}}"
          />
        </div>

        {error && <div style={{ color: 'var(--red)', fontSize: 11 }}>{error}</div>}

        <button className="btn-run" onClick={run} disabled={status === 'loading'}>
          {status === 'loading' ? <><div className="spinner" /> Generating...</> : <><Sparkles size={13} /> Run LLM</>}
        </button>

        {output && (
          <div>
            <div className="field-label">Output</div>
            <textarea rows={6} value={output} readOnly style={{ fontSize: 11, color: 'var(--t2)', fontFamily: 'inherit' }} />
          </div>
        )}
      </div>
      <Handle type="source" position={Position.Right} style={{ top: '50%' }} />
    </div>
  )
}
