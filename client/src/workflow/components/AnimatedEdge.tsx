import { type EdgeProps, getBezierPath, useReactFlow } from '@xyflow/react'
import { useState } from 'react'

// Map node types to wire colours by category
const WIRE_COLORS: Record<string, string> = {
  // Inputs
  textInput: '#8b5cf6',
  fileUpload: '#7c3aed',
  brandKit: '#f43f5e',
  campaignContext: '#fb7185',
  // Triggers
  webhook: '#a78bfa',
  schedule: '#c4b5fd',
  // AI & Text
  llm: '#6366f1',
  promptEnhancer: '#818cf8',
  promptBuilder: '#a5b4fc',
  storyboard: '#4f46e5',
  // Image Gen
  nanoBanana: '#f59e0b',
  imagen4: '#fbbf24',
  gptImage: '#f97316',
  flux: '#fb923c',
  // Video Gen
  kling: '#10b981',
  veo: '#34d399',
  // Vision
  imageDescriber: '#06b6d4',
  compare: '#22d3ee',
  // Tools
  textSplit: '#3b82f6',
  promptConcatenator: '#60a5fa',
  iterator: '#93c5fd',
  filter: '#2563eb',
  imageTransform: '#d97706',
  httpRequest: '#0ea5e9',
  seed: '#94a3b8',
  // Creative
  batchVariants: '#d946ef',
  platformPresets: '#e879f9',
  approvalGate: '#c026d3',
  // Output
  imageDisplay: '#84cc16',
  videoDisplay: '#a3e635',
  webhookOutput: '#65a30d',
  exportPack: '#4ade80',
  // Utilities
  note: '#cbd5e1',
}

export function AnimatedEdge({
  id,
  source,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  selected,
}: EdgeProps) {
  const { deleteElements, getNode } = useReactFlow()
  const [hovered, setHovered] = useState(false)

  const sourceNode = getNode(source)
  const wireColor = WIRE_COLORS[sourceNode?.type ?? ''] ?? '#888'

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    curvature: 0.4,
  })

  return (
    <g
      className="react-flow__edge-interaction"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Invisible fat path for easier click/hover targeting */}
      <path d={edgePath} fill="none" stroke="transparent" strokeWidth={20} />

      {/* Glow layer */}
      <path
        d={edgePath}
        fill="none"
        stroke={wireColor}
        strokeWidth={6}
        strokeLinecap="round"
        opacity={selected ? 0.2 : hovered ? 0.15 : 0.06}
      />

      {/* Main wire */}
      <path
        id={id}
        d={edgePath}
        fill="none"
        stroke={wireColor}
        strokeWidth={selected ? 2.5 : 2}
        strokeLinecap="round"
        opacity={selected ? 1 : hovered ? 0.85 : 0.55}
      />

      {/* Animated flow dots */}
      <circle r="2.5" fill={wireColor} opacity={0.7}>
        <animateMotion dur="2.5s" repeatCount="indefinite" path={edgePath} />
      </circle>
      <circle r="2.5" fill={wireColor} opacity={0.4}>
        <animateMotion dur="2.5s" repeatCount="indefinite" path={edgePath} begin="1.25s" />
      </circle>

      {/* Delete button at midpoint */}
      {hovered && (
        <g
          className="edge-delete-btn"
          transform={`translate(${labelX}, ${labelY})`}
          onClick={(e) => { e.stopPropagation(); deleteElements({ edges: [{ id }] }) }}
        >
          <circle r="10" />
          <path d="M-4,-4 L4,4 M4,-4 L-4,4" strokeWidth="1.5" strokeLinecap="round" />
        </g>
      )}
    </g>
  )
}
