// Build-from-prompt: the user describes a workflow in plain text,
// an LLM generates the node/edge JSON, and it loads onto the canvas.

import { useState } from 'react'
import { Wand2, X, Loader2, Sparkles } from 'lucide-react'
import { callLLM } from '../api/llm'

interface WorkflowSpec {
  nodes: { id: string; type: string; position: { x: number; y: number }; data: Record<string, unknown> }[]
  edges: { id: string; source: string; target: string; sourceHandle?: string; targetHandle?: string }[]
}

const SYSTEM_PROMPT = `You are an expert AIFlow workflow designer. AIFlow is a visual node-based tool for creative AI pipelines.

When given a description of what the user wants to build, you output a JSON object with:
- nodes: array of node objects
- edges: array of edge objects

## Available Node Types and their data properties:

**Text & Triggers:**
- textInput: { text: "..." } — Manual prompt or text input. Source only (no input handle).
- llm: { provider: "gemini"|"openai", model: "gemini-2.0-flash"|"gpt-4o-mini", systemPrompt: "...", userPromptTpl: "{{input}}", temperature: 0.8 } — LLM text generation
- promptEnhancer: { mode: "cinematic"|"editorial"|"artistic"|"commercial"|"anime"|"detailed"|"custom" } — AI prompt enhancement
- promptBuilder: { template: "...", style: "..." } — Template-based prompt assembly
- textSplit: { delimiter: "newline"|"double_newline"|"comma"|"numbered"|"custom" } — Split text into list
- promptConcatenator: {} — Merge up to 4 text inputs (handles: a, b, c, d)
- iterator: {} — Step through list of prompts
- storyboard: { provider: "gemini"|"openai", sceneCount: 6 } — Break concept into 4-8 scenes with LLM
- filter: { condition: "contains"|"equals"|"starts_with"|"not_empty", value: "..." } — Conditional routing

**Image Generation:**
- nanoBanana: { prompt: "", aspectRatio: "1:1"|"16:9"|"9:16"|"4:3"|"3:4", provider: "gemini"|"fal" } — Gemini Flash image gen
- imagen4: { prompt: "", aspectRatio: "1:1"|"16:9"|"9:16"|"4:3"|"3:4" } — Google Imagen 4
- gptImage: { prompt: "", size: "1024x1024"|"1536x1024"|"1024x1536", quality: "high"|"medium"|"low" } — OpenAI GPT Image 1
- flux: { modelId: "fal-ai/flux-pro/v1.1-ultra"|"fal-ai/flux/dev"|"fal-ai/recraft-v3", imageSize: "landscape_16_9"|"square_hd"|"portrait_9_16" } — Flux via fal.ai
- fileUpload: { url: "" } — Reference image upload/link
- imageTransform: { mode: "fill"|"contain"|"cover", width: 1024, height: 1024 } — Resize/crop

**Video Generation:**
- kling: { prompt: "", model: "v2-master", duration: 5, aspectRatio: "16:9"|"9:16"|"1:1" } — Kling AI video
- veo: { prompt: "", aspectRatio: "16:9"|"9:16", durationSeconds: 5, generateAudio: false } — Google Veo 3.1

**Vision & Analysis:**
- imageDescriber: { mode: "prompt"|"caption"|"detailed"|"style" } — Describe image with Gemini Vision
- compare: {} — Side-by-side image comparison (handles: a, b)

**Output:**
- imageDisplay: {} — Display generated images
- videoDisplay: {} — Play generated videos

**Utilities:**
- seed: { locked: false } — Random seed value
- note: { text: "..." } — Sticky annotation note

## Output format:
{
  "nodes": [
    { "id": "n1", "type": "textInput", "position": { "x": 100, "y": 200 }, "data": { "text": "A futuristic city" } }
  ],
  "edges": [
    { "id": "e1", "source": "n1", "target": "n2" }
  ]
}

## Layout rules:
- Place nodes left-to-right following the data flow
- Horizontal spacing: 350px between columns
- Vertical spacing: 200px between nodes in same column
- Start x at 100, y at 200
- Spread parallel nodes vertically (e.g. multiple image gen nodes at y: 100, 300, 500)

## Connection rules:
- Edges go from source (right handle) to target (left handle)
- Text nodes feed into image/video/LLM nodes
- Image nodes can feed into imageDisplay, compare, imageDescriber, video gen
- LLM output feeds into image gen nodes
- PromptConcatenator has special handles: a, b, c, d (set targetHandle)
- Compare node has handles: a, b (set targetHandle)
- StoryboardNode output can feed into multiple image gen nodes

Return ONLY the JSON object, no markdown fences, no explanation.`

interface Props {
  onGenerate: (spec: WorkflowSpec) => void
  geminiApiKey: string
  openAiApiKey: string
}

export function BuildFromPrompt({ onGenerate, geminiApiKey, openAiApiKey }: Props) {
  const [open, setOpen] = useState(false)
  const [description, setDescription] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [error, setError] = useState('')

  async function generate() {
    if (!description.trim()) return
    const apiKey = geminiApiKey || openAiApiKey
    if (!apiKey) { setError('Add a Gemini or OpenAI API key in settings first'); return }

    setStatus('loading')
    setError('')

    try {
      const provider = geminiApiKey ? 'gemini' : 'openai'
      const model = provider === 'gemini' ? 'gemini-2.5-flash-preview-05-20' : 'gpt-4o'

      const result = await callLLM({
        provider,
        model,
        systemPrompt: SYSTEM_PROMPT,
        userPrompt: `Build a workflow for: ${description}`,
        apiKey,
        temperature: 0.4,
      })

      // Strip markdown fences if present
      const cleaned = result
        .replace(/^```json\s*/i, '')
        .replace(/^```\s*/i, '')
        .replace(/```\s*$/i, '')
        .trim()

      const spec = JSON.parse(cleaned) as WorkflowSpec

      if (!Array.isArray(spec.nodes) || !Array.isArray(spec.edges)) {
        throw new Error('Invalid workflow format from LLM')
      }

      setStatus('done')
      setOpen(false)
      setDescription('')
      setStatus('idle')
      onGenerate(spec)
    } catch (e: any) {
      setError(e.message)
      setStatus('error')
    }
  }

  const EXAMPLES = [
    'Product photo → 3 different social media image ads',
    'Blog post title → illustrated header image + styled caption',
    'Brand brief → storyboard → Kling video ad',
    'Reference image → describe → enhance prompt → Flux image',
  ]

  return (
    <>
      <button
        className="sb-btn"
        onClick={() => setOpen(true)}
        title="Build workflow from prompt (AI)"
        style={{ color: '#a78bfa' }}
      >
        <Wand2 size={15} />
      </button>

      {open && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
          onClick={e => { if (e.target === e.currentTarget) setOpen(false) }}
        >
          <div style={{
            background: 'var(--s1)', border: '1px solid var(--border2)', borderRadius: 14,
            padding: 24, width: 520, maxWidth: '90vw',
            boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
          }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Sparkles size={16} color="#a78bfa" />
                <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--t1)' }}>Build Workflow from Prompt</span>
              </div>
              <button onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--t3)', cursor: 'pointer' }}>
                <X size={15} />
              </button>
            </div>

            <div style={{ fontSize: 12, color: 'var(--t3)', marginBottom: 16, lineHeight: 1.6 }}>
              Describe what you want to build. The AI will generate and place the right nodes with connections.
            </div>

            {/* Main input */}
            <textarea
              autoFocus
              rows={4}
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="I want to take a product photo and generate 5 on-brand social media ads in different styles..."
              style={{ width: '100%', marginBottom: 12, fontSize: 13, resize: 'vertical' }}
              onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) generate() }}
            />

            {/* Example prompts */}
            <div style={{ marginBottom: 14 }}>
              <div className="field-label" style={{ marginBottom: 6 }}>Examples</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {EXAMPLES.map((ex, i) => (
                  <button
                    key={i}
                    onMouseDown={e => e.preventDefault()}
                    onClick={() => setDescription(ex)}
                    style={{
                      textAlign: 'left', background: 'var(--s2)', border: '1px solid var(--border)',
                      borderRadius: 6, padding: '6px 10px', fontSize: 11, color: 'var(--t2)',
                      cursor: 'pointer', lineHeight: 1.4,
                    }}
                  >
                    {ex}
                  </button>
                ))}
              </div>
            </div>

            {error && (
              <div style={{ color: '#f87171', fontSize: 11, marginBottom: 10, padding: '6px 9px', background: '#f871711a', borderRadius: 6 }}>
                {error}
              </div>
            )}

            {/* Actions */}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                className="top-btn"
                onClick={() => setOpen(false)}
                style={{ fontSize: 12, padding: '6px 14px' }}
              >
                Cancel
              </button>
              <button
                className="btn-run"
                onClick={generate}
                disabled={status === 'loading' || !description.trim()}
                style={{ fontSize: 12, padding: '6px 16px', margin: 0 }}
              >
                {status === 'loading'
                  ? <><Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> Generating...</>
                  : <><Sparkles size={12} /> Generate Workflow</>}
              </button>
            </div>

            <div style={{ marginTop: 10, fontSize: 10, color: 'var(--t3)', textAlign: 'center' }}>
              ⌘+Enter to generate · Uses {geminiApiKey ? 'Gemini 2.5 Flash' : 'GPT-4o'}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
