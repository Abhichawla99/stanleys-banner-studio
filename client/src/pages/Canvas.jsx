import React, { useState, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  Handle,
  Position,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'

// ============================================================
// CUSTOM NODE COMPONENTS
// ============================================================

function SourceArtNode({ data }) {
  return (
    <div className="canvas-node source-art">
      <div className="node-header">
        <span className="node-icon">🎨</span>
        <span className="node-title">Source Art</span>
      </div>
      <div className="node-body">
        <div className="node-desc">Upload key art / poster</div>
        {data.fileName && <div className="node-file">{data.fileName}</div>}
      </div>
      <Handle type="source" position={Position.Right} />
    </div>
  )
}

function AIGenerateNode({ data }) {
  return (
    <div className="canvas-node ai-generate">
      <Handle type="target" position={Position.Left} />
      <div className="node-header">
        <span className="node-icon">⚡</span>
        <span className="node-title">AI Generate</span>
      </div>
      <div className="node-body">
        <div className="node-desc">Gemini image generation</div>
        <div className="node-tag">{data.model || 'Nano Banana 2'}</div>
      </div>
      <Handle type="source" position={Position.Right} />
    </div>
  )
}

function TemplateNode({ data }) {
  return (
    <div className="canvas-node template">
      <Handle type="target" position={Position.Left} />
      <div className="node-header">
        <span className="node-icon">📐</span>
        <span className="node-title">Template Frame</span>
      </div>
      <div className="node-body">
        <div className="node-desc">Banner frame overlay</div>
        <div className="node-tag">{data.format || '8 formats'}</div>
      </div>
      <Handle type="source" position={Position.Right} />
    </div>
  )
}

function CompositeNode({ data }) {
  return (
    <div className="canvas-node composite">
      <Handle type="target" position={Position.Left} id="art" style={{ top: '35%' }} />
      <Handle type="target" position={Position.Left} id="frame" style={{ top: '65%' }} />
      <div className="node-header">
        <span className="node-icon">🔲</span>
        <span className="node-title">Composite</span>
      </div>
      <div className="node-body">
        <div className="node-desc">Art + Frame layering</div>
      </div>
      <Handle type="source" position={Position.Right} />
    </div>
  )
}

function ReviewNode({ data }) {
  return (
    <div className="canvas-node review">
      <Handle type="target" position={Position.Left} />
      <div className="node-header">
        <span className="node-icon">👁</span>
        <span className="node-title">Review</span>
      </div>
      <div className="node-body">
        <div className="node-desc">Manual approval gate</div>
        <div className="node-tag">Approval</div>
      </div>
      <Handle type="source" position={Position.Right} />
    </div>
  )
}

function ExportNode({ data }) {
  return (
    <div className="canvas-node export">
      <Handle type="target" position={Position.Left} />
      <div className="node-header">
        <span className="node-icon">📦</span>
        <span className="node-title">Export</span>
      </div>
      <div className="node-body">
        <div className="node-desc">{data.target || 'Download / Smartsheet'}</div>
      </div>
    </div>
  )
}

function SmartsheetNode({ data }) {
  return (
    <div className="canvas-node smartsheet">
      <Handle type="target" position={Position.Left} />
      <div className="node-header">
        <span className="node-icon">📊</span>
        <span className="node-title">Smartsheet</span>
        <span className="node-soon">Soon</span>
      </div>
      <div className="node-body">
        <div className="node-desc">Sync to Smartsheet rows</div>
      </div>
    </div>
  )
}

function StickyNote({ data }) {
  return (
    <div className="canvas-node sticky">
      <div className="sticky-text">{data.text || 'Note...'}</div>
    </div>
  )
}

const nodeTypes = {
  sourceArt: SourceArtNode,
  aiGenerate: AIGenerateNode,
  template: TemplateNode,
  composite: CompositeNode,
  review: ReviewNode,
  export: ExportNode,
  smartsheet: SmartsheetNode,
  sticky: StickyNote,
}

// ============================================================
// DEFAULT WORKFLOW
// ============================================================

const defaultNodes = [
  {
    id: 'note1', type: 'sticky', position: { x: 50, y: -60 },
    data: { text: 'Banner Generation Pipeline — Drag nodes to rearrange. This is a visual representation of the automation flow.' },
  },
  {
    id: 'source', type: 'sourceArt', position: { x: 80, y: 120 },
    data: { fileName: null },
  },
  {
    id: 'generate', type: 'aiGenerate', position: { x: 380, y: 80 },
    data: { model: 'Nano Banana 2' },
  },
  {
    id: 'template', type: 'template', position: { x: 380, y: 240 },
    data: { format: '8 formats' },
  },
  {
    id: 'composite', type: 'composite', position: { x: 680, y: 140 },
    data: {},
  },
  {
    id: 'review', type: 'review', position: { x: 950, y: 140 },
    data: {},
  },
  {
    id: 'export', type: 'export', position: { x: 1220, y: 80 },
    data: { target: 'Download Pack' },
  },
  {
    id: 'smartsheet', type: 'smartsheet', position: { x: 1220, y: 240 },
    data: {},
  },
]

const defaultEdges = [
  { id: 'e1', source: 'source', target: 'generate', animated: true, style: { stroke: '#ff6b2b' } },
  { id: 'e2', source: 'generate', target: 'composite', targetHandle: 'art', animated: true, style: { stroke: '#ff6b2b' } },
  { id: 'e3', source: 'template', target: 'composite', targetHandle: 'frame', style: { stroke: '#4da6ff' } },
  { id: 'e4', source: 'composite', target: 'review', animated: true, style: { stroke: '#ff6b2b' } },
  { id: 'e5', source: 'review', target: 'export', style: { stroke: '#2de88a' } },
  { id: 'e6', source: 'review', target: 'smartsheet', style: { stroke: '#9090a0', strokeDasharray: '5,5' } },
]

// ============================================================
// NODE PALETTE
// ============================================================

const PALETTE = [
  { type: 'sourceArt', label: 'Source Art', icon: '🎨', category: 'Input' },
  { type: 'aiGenerate', label: 'AI Generate', icon: '⚡', category: 'Processing' },
  { type: 'template', label: 'Template Frame', icon: '📐', category: 'Processing' },
  { type: 'composite', label: 'Composite', icon: '🔲', category: 'Processing' },
  { type: 'review', label: 'Review Gate', icon: '👁', category: 'Control' },
  { type: 'export', label: 'Export', icon: '📦', category: 'Output' },
  { type: 'smartsheet', label: 'Smartsheet', icon: '📊', category: 'Output' },
  { type: 'sticky', label: 'Sticky Note', icon: '📝', category: 'Utility' },
]

// ============================================================
// MAIN CANVAS COMPONENT
// ============================================================

function CanvasInner() {
  const { instanceId } = useParams()
  const navigate = useNavigate()
  const [nodes, setNodes, onNodesChange] = useNodesState(defaultNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(defaultEdges)
  const [showPalette, setShowPalette] = useState(false)
  const reactFlowWrapper = useRef(null)
  const [reactFlowInstance, setReactFlowInstance] = useState(null)

  const onConnect = useCallback((params) => {
    setEdges(eds => addEdge({ ...params, animated: true, style: { stroke: '#ff6b2b' } }, eds))
  }, [setEdges])

  const addNode = (type) => {
    const id = `${type}_${Date.now()}`
    const paletteItem = PALETTE.find(p => p.type === type)
    const pos = reactFlowInstance
      ? reactFlowInstance.screenToFlowPosition({ x: 400, y: 300 })
      : { x: 400, y: 300 }
    setNodes(nds => [...nds, {
      id, type, position: pos,
      data: { label: paletteItem?.label || type },
    }])
    setShowPalette(false)
  }

  // Load instance name from localStorage
  const instances = JSON.parse(localStorage.getItem('stanleys_instances') || '[]')
  const instance = instances.find(i => i.id === instanceId)
  const instanceName = instance?.name || instanceId

  return (
    <div className="canvas-page">
      {/* Header */}
      <header className="canvas-header">
        <div className="canvas-header-left">
          <button className="cv-back" onClick={() => navigate('/')}>←</button>
          <div className="cv-brand">
            <div className="cv-logo">S</div>
            <div>
              <div className="cv-title">{instanceName}</div>
              <div className="cv-sub">Workflow Canvas</div>
            </div>
          </div>
        </div>
        <div className="canvas-header-center">
          <button className={`cv-tab ${true ? 'active' : ''}`}>Canvas</button>
          <button className="cv-tab" onClick={() => navigate(`/${instanceId}/studio`)}>Banner Studio</button>
        </div>
        <div className="canvas-header-right">
          <button className="cv-add-btn" onClick={() => setShowPalette(!showPalette)}>
            + Add Node
          </button>
        </div>
      </header>

      {/* Canvas */}
      <div className="canvas-body" ref={reactFlowWrapper}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onInit={setReactFlowInstance}
          nodeTypes={nodeTypes}
          fitView
          deleteKeyCode={['Backspace', 'Delete']}
          style={{ background: '#0b0b0e' }}
        >
          <Background color="#1a1a24" gap={20} size={1} />
          <Controls
            showInteractive={false}
            style={{ background: '#111116', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 6 }}
          />
          <MiniMap
            nodeColor={() => '#ff6b2b'}
            maskColor="rgba(0,0,0,0.7)"
            style={{ background: '#111116', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 6 }}
          />
        </ReactFlow>

        {/* Node Palette */}
        {showPalette && (
          <div className="palette">
            <div className="palette-header">
              <span className="palette-title">Add Node</span>
              <button className="palette-close" onClick={() => setShowPalette(false)}>×</button>
            </div>
            {['Input', 'Processing', 'Control', 'Output', 'Utility'].map(cat => (
              <div key={cat}>
                <div className="palette-cat">{cat}</div>
                {PALETTE.filter(p => p.category === cat).map(p => (
                  <button key={p.type} className="palette-item" onClick={() => addNode(p.type)}>
                    <span className="palette-icon">{p.icon}</span>
                    <span className="palette-label">{p.label}</span>
                  </button>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>

      <style>{`
        .canvas-page {
          font-family: 'Space Grotesk', -apple-system, sans-serif;
          background: #0b0b0e; color: #f0f0f5;
          height: 100vh; display: flex; flex-direction: column;
        }

        /* Header */
        .canvas-header {
          display: flex; align-items: center; justify-content: space-between;
          padding: 0 20px; height: 52px; background: #111116;
          border-bottom: 1px solid rgba(255,255,255,0.08); flex-shrink: 0;
          z-index: 10;
        }
        .canvas-header-left, .canvas-header-right { display: flex; align-items: center; gap: 12px; }
        .canvas-header-center { display: flex; gap: 2px; }

        .cv-back {
          width: 32px; height: 32px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.08);
          background: transparent; color: #9090a0; font-size: 16px;
          display: flex; align-items: center; justify-content: center;
          cursor: pointer; transition: all 0.15s;
        }
        .cv-back:hover { color: #f0f0f5; border-color: rgba(255,255,255,0.15); background: #18181f; }

        .cv-brand { display: flex; align-items: center; gap: 10px; }
        .cv-logo {
          width: 30px; height: 30px; border-radius: 6px; background: #ff6b2b;
          display: flex; align-items: center; justify-content: center;
          font-weight: 700; font-size: 14px; color: #fff;
          box-shadow: 0 0 12px rgba(255,107,43,0.25);
        }
        .cv-title { font-weight: 600; font-size: 13px; }
        .cv-sub { font-size: 10px; color: #50505e; font-family: 'JetBrains Mono', monospace; }

        .cv-tab {
          padding: 6px 16px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.08);
          background: transparent; color: #50505e; font-size: 11px; font-weight: 500;
          cursor: pointer; transition: all 0.15s; font-family: 'JetBrains Mono', monospace;
        }
        .cv-tab:first-child { border-radius: 6px 0 0 6px; }
        .cv-tab:last-child { border-radius: 0 6px 6px 0; border-left: none; }
        .cv-tab.active { background: #18181f; color: #ff6b2b; }
        .cv-tab:hover:not(.active) { color: #9090a0; }

        .cv-add-btn {
          padding: 7px 16px; border-radius: 6px; border: 1px solid #ff6b2b;
          background: rgba(255,107,43,0.14); color: #ff6b2b; font-size: 11px;
          font-weight: 600; cursor: pointer; transition: all 0.15s;
          font-family: 'JetBrains Mono', monospace;
        }
        .cv-add-btn:hover { background: rgba(255,107,43,0.22); }

        /* Canvas body */
        .canvas-body { flex: 1; position: relative; }

        /* Node styles */
        .canvas-node {
          background: #111116; border: 1px solid rgba(255,255,255,0.1);
          border-radius: 8px; min-width: 180px; font-family: 'Space Grotesk', sans-serif;
          box-shadow: 0 4px 20px rgba(0,0,0,0.4);
          transition: border-color 0.15s, box-shadow 0.15s;
        }
        .canvas-node:hover { border-color: rgba(255,255,255,0.2); box-shadow: 0 6px 30px rgba(0,0,0,0.5); }
        .canvas-node.sticky {
          background: rgba(255,184,46,0.08); border-color: rgba(255,184,46,0.2);
          min-width: 200px; max-width: 280px; border-radius: 4px;
        }
        .sticky-text {
          padding: 12px; font-size: 11px; color: #ffb82e; line-height: 1.6;
          font-family: 'JetBrains Mono', monospace;
        }

        .node-header {
          padding: 10px 14px 0; display: flex; align-items: center; gap: 8px;
        }
        .node-icon { font-size: 14px; }
        .node-title {
          font-size: 11px; font-weight: 600; letter-spacing: -0.2px;
        }
        .node-soon {
          font-size: 8px; background: #18181f; color: #50505e; padding: 1px 5px;
          border-radius: 3px; font-family: 'JetBrains Mono', monospace;
          text-transform: uppercase; letter-spacing: 0.5px; margin-left: auto;
        }
        .node-body { padding: 8px 14px 12px; }
        .node-desc { font-size: 10px; color: #50505e; }
        .node-file {
          font-size: 9px; color: #ff6b2b; margin-top: 4px;
          font-family: 'JetBrains Mono', monospace;
        }
        .node-tag {
          display: inline-block; margin-top: 6px; padding: 2px 8px; border-radius: 3px;
          background: rgba(255,255,255,0.04); font-size: 9px; color: #9090a0;
          font-family: 'JetBrains Mono', monospace;
        }

        /* Color accents per node type */
        .canvas-node.source-art { border-left: 3px solid #ff6b2b; }
        .canvas-node.ai-generate { border-left: 3px solid #b47aff; }
        .canvas-node.template { border-left: 3px solid #4da6ff; }
        .canvas-node.composite { border-left: 3px solid #ffb82e; }
        .canvas-node.review { border-left: 3px solid #2de88a; }
        .canvas-node.export { border-left: 3px solid #2dd4bf; }
        .canvas-node.smartsheet { border-left: 3px solid #9090a0; }

        /* Handles */
        .react-flow__handle {
          width: 8px; height: 8px; border-radius: 50%;
          background: #ff6b2b; border: 2px solid #111116;
        }

        /* Palette */
        .palette {
          position: absolute; top: 12px; right: 12px; width: 220px;
          background: #111116; border: 1px solid rgba(255,255,255,0.1);
          border-radius: 10px; padding: 12px; z-index: 20;
          box-shadow: 0 8px 30px rgba(0,0,0,0.5);
          animation: fadeIn 0.15s ease;
        }
        .palette-header {
          display: flex; justify-content: space-between; align-items: center;
          margin-bottom: 12px;
        }
        .palette-title {
          font-size: 12px; font-weight: 600;
        }
        .palette-close {
          background: none; border: none; color: #50505e; font-size: 16px;
          cursor: pointer; font-family: 'JetBrains Mono', monospace;
        }
        .palette-close:hover { color: #f0f0f5; }
        .palette-cat {
          font-size: 9px; color: #50505e; text-transform: uppercase;
          letter-spacing: 1.5px; padding: 8px 0 4px;
          font-family: 'JetBrains Mono', monospace;
        }
        .palette-item {
          display: flex; align-items: center; gap: 10px; width: 100%;
          padding: 7px 10px; border-radius: 5px; border: none;
          background: transparent; color: #9090a0; font-size: 11px;
          cursor: pointer; transition: all 0.1s; text-align: left;
          font-family: 'Space Grotesk', sans-serif;
        }
        .palette-item:hover { background: rgba(255,255,255,0.04); color: #f0f0f5; }
        .palette-icon { font-size: 14px; }
        .palette-label { font-weight: 500; }

        /* ReactFlow overrides */
        .react-flow__controls button {
          background: #111116 !important; color: #9090a0 !important;
          border-color: rgba(255,255,255,0.08) !important;
          fill: #9090a0 !important;
        }
        .react-flow__controls button:hover {
          background: #18181f !important; color: #f0f0f5 !important;
        }
        .react-flow__minimap { border-radius: 6px !important; }
        .react-flow__edge-path { stroke-width: 2; }

        @keyframes fadeIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  )
}

export default function Canvas() {
  return (
    <ReactFlowProvider>
      <CanvasInner />
    </ReactFlowProvider>
  )
}
