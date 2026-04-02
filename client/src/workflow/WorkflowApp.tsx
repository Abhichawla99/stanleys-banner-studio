import {
  ReactFlow, Background, BackgroundVariant, type NodeTypes,
  MiniMap, Panel, useReactFlow, useViewport, ReactFlowProvider,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useState, useEffect } from 'react'
import {
  Plus, Search, MousePointer2, Hand, Undo2, Redo2,
  ZoomIn, ZoomOut, Settings, Image, Video, Film, Type,
  Webhook, Globe, Wand2, Clock, Filter, LayoutTemplate,
  PlayCircle, Save, Upload, Trash2, X, Maximize2,
  Sparkles, ImagePlus, ListFilter, StickyNote, Zap,
  Eye, SplitSquareHorizontal, Hash, Combine, Crop, Repeat2,
  Play, Square, Loader2, RotateCcw, CheckCircle, AlertCircle,
  Library, Send, Palette, Target, Layers, Monitor,
  ShieldCheck, Package,
} from 'lucide-react'

import { useNodeStore } from './store'
import { SettingsProvider, useSettings } from './SettingsContext'
import { BuildFromPrompt } from './components/BuildFromPrompt'
import { WorkflowLibrary } from './components/WorkflowLibrary'
import { TextInputNode }     from './nodes/TextInputNode'
import { NanoBananaNode }    from './nodes/NanoBananaNode'
import { KlingNode }         from './nodes/KlingNode'
import { VeoNode }           from './nodes/VeoNode'
import { WebhookNode }       from './nodes/WebhookNode'
import { HttpRequestNode }   from './nodes/HttpRequestNode'
import { PromptBuilderNode } from './nodes/PromptBuilderNode'
import { ScheduleNode }      from './nodes/ScheduleNode'
import { FilterNode }        from './nodes/FilterNode'
import { ImageDisplayNode }  from './nodes/ImageDisplayNode'
import { VideoDisplayNode }  from './nodes/VideoDisplayNode'
import { LLMNode }              from './nodes/LLMNode'
import { FileUploadNode }       from './nodes/FileUploadNode'
import { TextSplitNode }        from './nodes/TextSplitNode'
import { NoteNode }             from './nodes/NoteNode'
import { FluxNode }             from './nodes/FluxNode'
import { PromptEnhancerNode }   from './nodes/PromptEnhancerNode'
import { ImageDescriberNode }   from './nodes/ImageDescriberNode'
import { SeedNode }             from './nodes/SeedNode'
import { CompareNode }          from './nodes/CompareNode'
import { PromptConcatenatorNode } from './nodes/PromptConcatenatorNode'
import { GPTImageNode }           from './nodes/GPTImageNode'
import { Imagen4Node }            from './nodes/Imagen4Node'
import { ImageTransformNode }     from './nodes/ImageTransformNode'
import { IteratorNode }           from './nodes/IteratorNode'
import { StoryboardNode }         from './nodes/StoryboardNode'
import { WebhookOutputNode }      from './nodes/WebhookOutputNode'
import { BrandKitNode }          from './nodes/BrandKitNode'
import { CampaignContextNode }   from './nodes/CampaignContextNode'
import { BatchVariantsNode }     from './nodes/BatchVariantsNode'
import { PlatformPresetsNode }   from './nodes/PlatformPresetsNode'
import { ApprovalGateNode }      from './nodes/ApprovalGateNode'
import { ExportPackNode }        from './nodes/ExportPackNode'
import { TemplateModeButtons }   from './components/TemplateMode'

const nodeTypes: NodeTypes = {
  textInput: TextInputNode,
  nanoBanana: NanoBananaNode,
  kling: KlingNode,
  veo: VeoNode,
  webhook: WebhookNode,
  httpRequest: HttpRequestNode,
  promptBuilder: PromptBuilderNode,
  schedule: ScheduleNode,
  filter: FilterNode,
  imageDisplay: ImageDisplayNode,
  videoDisplay: VideoDisplayNode,
  llm: LLMNode,
  fileUpload: FileUploadNode,
  textSplit: TextSplitNode,
  note: NoteNode,
  flux: FluxNode,
  promptEnhancer: PromptEnhancerNode,
  imageDescriber: ImageDescriberNode,
  seed: SeedNode,
  compare: CompareNode,
  promptConcatenator: PromptConcatenatorNode,
  gptImage: GPTImageNode,
  imagen4: Imagen4Node,
  imageTransform: ImageTransformNode,
  iterator: IteratorNode,
  storyboard: StoryboardNode,
  webhookOutput: WebhookOutputNode,
  brandKit: BrandKitNode,
  campaignContext: CampaignContextNode,
  batchVariants: BatchVariantsNode,
  platformPresets: PlatformPresetsNode,
  approvalGate: ApprovalGateNode,
  exportPack: ExportPackNode,
}

let nodeIdCounter = 1

interface NodeDef { type: string; label: string; icon: React.ReactNode; color: string; description: string }

const PALETTE: { category: string; nodes: NodeDef[] }[] = [
  {
    category: 'Brand & Campaign',
    nodes: [
      { type: 'brandKit',       label: 'Brand Kit',         icon: <Palette size={13} />,    color: '#f43f5e', description: 'Logo, colors, fonts, tone of voice' },
      { type: 'campaignContext', label: 'Campaign Context', icon: <Target size={13} />,     color: '#d97706', description: 'Objective, audience, key message' },
    ],
  },
  {
    category: 'Triggers',
    nodes: [
      { type: 'textInput',   label: 'Text Input',   icon: <Type size={13} />,    color: '#a78bfa', description: 'Manual prompt input' },
      { type: 'webhook',     label: 'Webhook',      icon: <Webhook size={13} />, color: '#e879f9', description: 'HTTP webhook trigger' },
      { type: 'schedule',    label: 'Schedule',     icon: <Clock size={13} />,   color: '#fbbf24', description: 'Time-based trigger' },
    ],
  },
  {
    category: 'AI & Text',
    nodes: [
      { type: 'llm',            label: 'LLM Prompt',      icon: <Sparkles size={13} />,   color: '#c084fc', description: 'Gemini / GPT-4 text gen' },
      { type: 'promptEnhancer', label: 'Prompt Enhancer', icon: <Wand2 size={13} />,      color: '#f472b6', description: 'AI-powered prompt upgrade' },
      { type: 'promptBuilder',  label: 'Prompt Builder',  icon: <Wand2 size={13} />,      color: 'var(--green)', description: 'Template + style modifier' },
      { type: 'textSplit',           label: 'Text Split',          icon: <ListFilter size={13} />, color: '#d97706', description: 'Split text into a list' },
      { type: 'promptConcatenator', label: 'Prompt Concatenator', icon: <Combine size={13} />,    color: '#a3e635', description: 'Merge A/B/C/D text inputs into one' },
      { type: 'iterator',           label: 'Text Iterator',       icon: <Repeat2 size={13} />,    color: '#38bdf8', description: 'Step through a list of prompts' },
      { type: 'filter',             label: 'Filter / Router',     icon: <Filter size={13} />,     color: '#f97316', description: 'Route on conditions' },
      { type: 'httpRequest',        label: 'HTTP Request',        icon: <Globe size={13} />,      color: '#38bdf8', description: 'Call any external API' },
      { type: 'storyboard',         label: 'Storyboard',          icon: <Film size={13} />,       color: '#e879f9', description: 'Break concept into scenes with LLM' },
    ],
  },
  {
    category: 'Image Generation',
    nodes: [
      { type: 'nanoBanana',    label: 'Nano Banana 2',  icon: <Image size={13} />,     color: '#f59e0b', description: 'Gemini Flash image gen' },
      { type: 'imagen4',       label: 'Imagen 4',       icon: <Sparkles size={13} />,  color: 'var(--green)', description: 'Google Imagen 4 via Gemini API' },
      { type: 'gptImage',      label: 'GPT Image 1',    icon: <Image size={13} />,     color: '#22d3ee', description: "OpenAI's gpt-image-1 model" },
      { type: 'flux',          label: 'Flux / Recraft', icon: <Zap size={13} />,       color: '#f59e0b', description: 'Flux Pro, Recraft, Ideogram via fal.ai' },
      { type: 'imageTransform', label: 'Resize / Crop', icon: <Crop size={13} />,      color: '#d97706', description: 'Resize or crop any image' },
      { type: 'fileUpload',    label: 'Reference Image', icon: <ImagePlus size={13} />, color: '#e879f9', description: 'Upload or link reference image' },
    ],
  },
  {
    category: 'Video Generation',
    nodes: [
      { type: 'kling', label: 'Kling AI', icon: <Video size={13} />, color: '#34d399', description: 'Kling v2-master video' },
      { type: 'veo',   label: 'Veo 3.1',  icon: <Film size={13} />,  color: '#60a5fa', description: 'Google Veo 3.1 video' },
    ],
  },
  {
    category: 'Vision & Analysis',
    nodes: [
      { type: 'imageDescriber', label: 'Image Describer', icon: <Eye size={13} />,                   color: '#67e8f9', description: 'Describe image with Gemini Vision' },
      { type: 'compare',        label: 'Compare',         icon: <SplitSquareHorizontal size={13} />,  color: '#a78bfa', description: 'Side-by-side image comparison' },
    ],
  },
  {
    category: 'Creative Tools',
    nodes: [
      { type: 'batchVariants',   label: 'Batch Variants',   icon: <Layers size={13} />,     color: '#a78bfa', description: 'Generate N variations of any prompt/image' },
      { type: 'platformPresets', label: 'Platform Presets', icon: <Monitor size={13} />,    color: '#06b6d4', description: 'Recompose image for Instagram, YouTube, etc.' },
      { type: 'approvalGate',    label: 'Approval Gate',    icon: <ShieldCheck size={13} />, color: '#e879f9', description: 'Pause workflow for human review' },
    ],
  },
  {
    category: 'Output',
    nodes: [
      { type: 'imageDisplay',   label: 'Image Viewer',    icon: <LayoutTemplate size={13} />, color: '#f97316', description: 'Display generated images' },
      { type: 'videoDisplay',   label: 'Video Viewer',    icon: <PlayCircle size={13} />,     color: '#a3e635', description: 'Play generated videos' },
      { type: 'webhookOutput',  label: 'Webhook Output',  icon: <Send size={13} />,           color: '#22d3ee', description: 'POST results to an external URL' },
      { type: 'exportPack',     label: 'Export Pack',     icon: <Package size={13} />,        color: '#a3e635', description: 'Download all outputs as a ZIP file' },
    ],
  },
  {
    category: 'Utilities',
    nodes: [
      { type: 'seed', label: 'Seed',        icon: <Hash size={13} />,     color: '#94a3b8', description: 'Fixed or random seed value' },
      { type: 'note', label: 'Sticky Note', icon: <StickyNote size={13} />, color: '#c4b5fd', description: 'Annotate your workflow' },
    ],
  },
]

/* ─── SETTINGS PANEL ─── */
function SettingsPanel({ onClose }: { onClose: () => void }) {
  const s = useSettings()
  return (
    <div className="settings-panel">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div className="settings-title">API Keys</div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--t3)', cursor: 'pointer' }}>
          <X size={14} />
        </button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
        {/* Gemini */}
        <div>
          <div className="field-label">Gemini API Key</div>
          <div style={{ fontSize: 10, color: 'var(--t3)', marginBottom: 4 }}>Nano Banana 2 · Veo 3.1 · LLM (Gemini)</div>
          <input type="text" value={s.geminiApiKey} onChange={e => s.update('geminiApiKey', e.target.value)} placeholder="AIza..." />
        </div>
        {/* OpenAI */}
        <div>
          <div className="field-label">OpenAI API Key</div>
          <div style={{ fontSize: 10, color: 'var(--t3)', marginBottom: 4 }}>LLM (GPT-4o, GPT-4o-mini)</div>
          <input type="text" value={s.openAiApiKey} onChange={e => s.update('openAiApiKey', e.target.value)} placeholder="sk-..." />
        </div>
        {/* fal.ai */}
        <div>
          <div className="field-label">fal.ai API Key</div>
          <div style={{ fontSize: 10, color: 'var(--t3)', marginBottom: 4 }}>Alternative for Nano Banana 2</div>
          <input type="text" value={s.falApiKey} onChange={e => s.update('falApiKey', e.target.value)} placeholder="fal-..." />
        </div>
        {/* Kling */}
        <div>
          <div className="field-label">Kling Access Key</div>
          <input type="text" value={s.klingApiKey} onChange={e => s.update('klingApiKey', e.target.value)} placeholder="From klingai.com/global/dev" />
        </div>
        <div>
          <div className="field-label">Kling Secret Key</div>
          <input type="text" value={s.klingApiSecret} onChange={e => s.update('klingApiSecret', e.target.value)} placeholder="Secret key..." />
        </div>
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 10 }}>
          <div style={{ fontSize: 10, color: 'var(--t3)', lineHeight: 2 }}>
            • Gemini: ai.google.dev/aistudio<br />
            • OpenAI: platform.openai.com/api-keys<br />
            • fal.ai: fal.ai/dashboard<br />
            • Kling: klingai.com/global/dev
          </div>
        </div>
      </div>
    </div>
  )
}

/* ─── NODE PALETTE ─── */
function NodePalette({ open, onAdd }: { open: boolean; onAdd: (type: string) => void }) {
  const [query, setQuery] = useState('')
  const allNodes = PALETTE.flatMap(c => c.nodes)
  const filtered = query
    ? allNodes.filter(n =>
        n.label.toLowerCase().includes(query.toLowerCase()) ||
        n.description.toLowerCase().includes(query.toLowerCase()))
    : null
  const display = filtered ? [{ category: 'Results', nodes: filtered }] : PALETTE

  return (
    <div className={`node-palette${open ? ' open' : ''}`}>
      <div className="pal-top">
        <div className="pal-search">
          <Search size={12} color="var(--t3)" />
          <input
            placeholder="Search nodes..."
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
        </div>
      </div>
      <div className="pal-body">
        {display.map(({ category, nodes }) => (
          <div key={category}>
            <div className="pal-cat">{category}</div>
            {nodes.map(n => (
              <button
                key={n.type}
                className="pal-item"
                onClick={() => onAdd(n.type)}
                draggable
                onDragStart={e => e.dataTransfer.setData('nodeType', n.type)}
              >
                <div className="pal-icon" style={{ background: n.color + '18' }}>
                  <span style={{ color: n.color }}>{n.icon}</span>
                </div>
                <div>
                  <div className="pal-label">{n.label}</div>
                  <div className="pal-desc">{n.description}</div>
                </div>
              </button>
            ))}
          </div>
        ))}
        {filtered && filtered.length === 0 && (
          <div style={{ padding: '20px 14px', textAlign: 'center', fontSize: 12, color: 'var(--t3)' }}>
            No nodes found
          </div>
        )}
      </div>
    </div>
  )
}

/* ─── BOTTOM TOOLBAR ─── */
function BottomToolbar({ tool, setTool }: { tool: 'select' | 'pan'; setTool: (t: 'select' | 'pan') => void }) {
  const { zoomIn, zoomOut, fitView, zoomTo } = useReactFlow()
  const { zoom } = useViewport()
  const { undo, redo, past, future } = useNodeStore()

  return (
    <div className="bottom-toolbar">
      <button className={`tl-btn${tool === 'select' ? ' on' : ''}`} onClick={() => setTool('select')} title="Select (V)">
        <MousePointer2 size={14} />
      </button>
      <button className={`tl-btn${tool === 'pan' ? ' on' : ''}`} onClick={() => setTool('pan')} title="Pan (H)">
        <Hand size={14} />
      </button>
      <div className="tl-sep" />
      <button className="tl-btn" onClick={undo} disabled={past.length === 0} title="Undo (⌘Z)">
        <Undo2 size={14} />
      </button>
      <button className="tl-btn" onClick={redo} disabled={future.length === 0} title="Redo (⌘⇧Z)">
        <Redo2 size={14} />
      </button>
      <div className="tl-sep" />
      <button className="tl-btn" onClick={() => zoomOut()} title="Zoom out">
        <ZoomOut size={14} />
      </button>
      <button className="zoom-pct" onClick={() => zoomTo(1)} title="Reset zoom">
        {Math.round(zoom * 100)}%
      </button>
      <button className="tl-btn" onClick={() => zoomIn()} title="Zoom in">
        <ZoomIn size={14} />
      </button>
      <div className="tl-sep" />
      <button className="tl-btn" onClick={() => fitView({ padding: 0.15, duration: 400 })} title="Fit view (F)">
        <Maximize2 size={13} />
      </button>
    </div>
  )
}

/* ─── MAIN APP CONTENT ─── */
function AppContent() {
  const { nodes, edges, onNodesChange, onEdgesChange, onConnect, addNode, setNodes, setEdges, runWorkflow, retryFromNode, stopWorkflow, workflowProgress } = useNodeStore()
  const settings = useSettings()
  const [tool, setTool] = useState<'select' | 'pan'>('select')
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [libraryOpen, setLibraryOpen] = useState(false)
  const [workflowName, setWorkflowName] = useState('Untitled')
  const [savedWorkflowId, setSavedWorkflowId] = useState<string | undefined>()

  function spawn(type: string, pos?: { x: number; y: number }) {
    const id = `node-${nodeIdCounter++}`
    const position = pos ?? { x: 280 + Math.random() * 320, y: 100 + Math.random() * 220 }
    addNode({ id, type, position, data: {} })
  }

  function clearAll() {
    if (nodes.length === 0) return
    if (confirm('Clear all nodes?')) { setNodes([]); setEdges([]) }
  }

  function saveFlow() {
    const json = JSON.stringify({ name: workflowName, nodes, edges }, null, 2)
    const blob = new Blob([json], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${workflowName.replace(/\s+/g, '-').toLowerCase()}.json`
    a.click()
  }

  function loadFlow() {
    const input = document.createElement('input')
    input.type = 'file'; input.accept = '.json'
    input.onchange = e => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return
      const reader = new FileReader()
      reader.onload = ev => {
        try {
          const data = JSON.parse(ev.target?.result as string)
          if (data.name) setWorkflowName(data.name)
          if (data.nodes) setNodes(data.nodes)
          if (data.edges) setEdges(data.edges)
          setSavedWorkflowId(undefined)
        } catch { alert('Invalid workflow file') }
      }
      reader.readAsText(file)
    }
    input.click()
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    const type = e.dataTransfer.getData('nodeType')
    if (!type) return
    const bounds = e.currentTarget.getBoundingClientRect()
    spawn(type, { x: e.clientX - bounds.left - 140, y: e.clientY - bounds.top - 40 })
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement).tagName
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(tag)) return
      if (e.key === 'v' && !e.metaKey && !e.ctrlKey) setTool('select')
      if (e.key === 'h' && !e.metaKey && !e.ctrlKey) setTool('pan')
      if (e.key === 'n' && !e.metaKey && !e.ctrlKey) setPaletteOpen(o => !o)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    let es: EventSource | null = null
    try {
      es = new EventSource('http://localhost:3001/sse')
      es.onmessage = (e) => {
        try {
          const { path, payload } = JSON.parse(e.data)
          const reg = (window as any).__aiflow_webhooks ?? {}
          if (reg[path]) reg[path](payload)
        } catch {}
      }
    } catch {}
    return () => es?.close()
  }, [])

  return (
    <div style={{ width: '100vw', height: '100vh', background: 'var(--bg)' }}>

      {/* Icon sidebar */}
      <div className="icon-sidebar">
        <div className="sb-logo">S</div>
        <button className={`sb-btn${paletteOpen ? ' active' : ''}`} onClick={() => setPaletteOpen(o => !o)} title="Nodes (N)">
          <Plus size={16} />
        </button>
        <BuildFromPrompt
          geminiApiKey={settings.geminiApiKey}
          openAiApiKey={settings.openAiApiKey}
          onGenerate={spec => {
            if (confirm('Load generated workflow? This will replace the current canvas.')) {
              setNodes(spec.nodes as any)
              setEdges(spec.edges as any)
            }
          }}
        />
        <button className="sb-btn" onClick={() => setLibraryOpen(true)} title="Workflow Library">
          <Library size={15} />
        </button>
        <button className="sb-btn" onClick={loadFlow} title="Import JSON">
          <Upload size={15} />
        </button>
        <div className="sb-spacer" />
        <button className={`sb-btn${settingsOpen ? ' active' : ''}`} onClick={() => setSettingsOpen(o => !o)} title="API Keys">
          <Settings size={15} />
        </button>
        <button className="sb-btn" onClick={clearAll} title="Clear canvas">
          <Trash2 size={15} />
        </button>
      </div>

      {/* Top bar */}
      <div className="top-bar">
        <input
          className="wf-name"
          value={workflowName}
          onChange={e => setWorkflowName(e.target.value)}
          spellCheck={false}
        />
        <div className="tb-spacer" />

        {/* Run Workflow */}
        {workflowProgress.running ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ fontSize: 11, color: 'var(--t2)', display: 'flex', alignItems: 'center', gap: 5 }}>
              <Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} />
              <span>{workflowProgress.currentLabel} ({workflowProgress.completed}/{workflowProgress.total})</span>
            </div>
            <button className="top-btn danger" onClick={stopWorkflow}><Square size={10} /> Stop</button>
          </div>
        ) : workflowProgress.done ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {workflowProgress.failed === 0 ? (
              <span style={{ fontSize: 10, color: 'var(--green)', display: 'flex', alignItems: 'center', gap: 4 }}>
                <CheckCircle size={11} /> {workflowProgress.succeeded}/{workflowProgress.total} nodes succeeded
              </span>
            ) : (
              <span style={{ fontSize: 10, color: '#d97706', display: 'flex', alignItems: 'center', gap: 4 }}>
                <AlertCircle size={11} />
                {workflowProgress.succeeded}/{workflowProgress.total} succeeded · {workflowProgress.failed} failed
              </span>
            )}
            {workflowProgress.failedNodes.map(fn => (
              <button
                key={fn.id}
                className="top-btn"
                style={{ fontSize: 9, padding: '2px 6px', color: 'var(--red)', border: '1px solid rgba(229,62,62,0.25)' }}
                onClick={() => retryFromNode(fn.id)}
                title={`Error: ${fn.error}`}
              >
                <RotateCcw size={9} /> Retry {fn.label}
              </button>
            ))}
            <button
              className="top-btn"
              style={{ background: 'var(--accent)', border: '1px solid var(--accent)', color: '#fff' }}
              onClick={() => runWorkflow()}
            >
              <Play size={11} /> Run Again
            </button>
          </div>
        ) : (
          <button
            className="top-btn"
            style={{ background: 'var(--accent)', border: '1px solid var(--accent)', color: '#fff' }}
            onClick={() => runWorkflow()}
            disabled={nodes.length === 0}
          >
            <Play size={11} /> Run Workflow
          </button>
        )}

        {workflowProgress.error && workflowProgress.error !== 'Stopped' && (
          <span style={{ fontSize: 10, color: 'var(--red)', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {workflowProgress.error}
          </span>
        )}

        <button className="top-btn" onClick={() => setLibraryOpen(true)}><Library size={11} /> Library</button>
        <TemplateModeButtons />
        <button className="top-btn" onClick={saveFlow}><Save size={11} /> Save</button>
        <button className="top-btn" onClick={loadFlow}><Upload size={11} /> Import</button>
        <button className="top-btn danger" onClick={clearAll}><Trash2 size={11} /> Clear</button>
      </div>

      {/* Node palette */}
      <NodePalette open={paletteOpen} onAdd={spawn} />

      {/* Settings panel */}
      {settingsOpen && <SettingsPanel onClose={() => setSettingsOpen(false)} />}

      {/* Workflow library */}
      {libraryOpen && (
        <WorkflowLibrary
          currentName={workflowName}
          savedId={savedWorkflowId}
          getSnapshot={() => ({ name: workflowName, nodes, edges })}
          onSaved={(id, name) => { setSavedWorkflowId(id); setWorkflowName(name) }}
          onLoad={wf => {
            if (nodes.length > 0 && !confirm('Load workflow? This will replace the current canvas.')) return
            if (wf.name) setWorkflowName(wf.name)
            setNodes(wf.nodes as any)
            setEdges(wf.edges as any)
            setSavedWorkflowId(wf.id)
          }}
          onClose={() => setLibraryOpen(false)}
        />
      )}

      {/* Canvas */}
      <div className="canvas-area" onDrop={onDrop} onDragOver={e => e.preventDefault()}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          panOnDrag={tool === 'pan' ? [0, 1, 2] : [1, 2]}
          selectionOnDrag={tool === 'select'}
          defaultEdgeOptions={{
            animated: false,
            style: { stroke: 'rgba(255,255,255,0.16)', strokeWidth: 1.5 },
          }}
          deleteKeyCode={['Delete', 'Backspace']}
          multiSelectionKeyCode="Shift"
          style={{ background: 'var(--canvas-bg)' }}
        >
          <Background variant={BackgroundVariant.Dots} gap={22} size={1.2} color="var(--canvas-dot)" />
          <MiniMap
            style={{ background: 'var(--s1)', border: '1px solid var(--border2)' }}
            nodeColor={() => '#666666'}
            maskColor="rgba(0,0,0,0.45)"
            position="bottom-right"
          />
          <Panel position="bottom-center" style={{ marginBottom: 18 }}>
            <BottomToolbar tool={tool} setTool={setTool} />
          </Panel>
        </ReactFlow>

        {nodes.length === 0 && (
          <div className="canvas-empty">
            <div style={{ fontSize: 52, marginBottom: 16, opacity: 0.06 }}>✦</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'rgba(255,255,255,0.07)', marginBottom: 8 }}>
              Build your AI workflow
            </div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.04)', lineHeight: 1.9 }}>
              Click + or press N to open the node palette<br />
              Drag nodes onto the canvas<br />
              <span style={{ opacity: 0.6, fontSize: 10 }}>
                Text Input → LLM → Text Split → Nano Banana 2 → Kling
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default function App() {
  return (
    <SettingsProvider>
      <ReactFlowProvider>
        <AppContent />
      </ReactFlowProvider>
    </SettingsProvider>
  )
}
