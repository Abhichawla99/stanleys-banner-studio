import { type EdgeProps, getBezierPath, useReactFlow } from '@xyflow/react'
import { useState } from 'react'

export function AnimatedEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  selected,
}: EdgeProps) {
  const { deleteElements } = useReactFlow()
  const [hovered, setHovered] = useState(false)

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
        className={`edge-glow ${selected ? 'edge-selected' : ''}`}
      />

      {/* Main wire */}
      <path
        id={id}
        d={edgePath}
        fill="none"
        className={`edge-wire ${selected ? 'edge-selected' : ''}`}
      />

      {/* Animated flow dots */}
      <circle r="2.5" className="edge-dot">
        <animateMotion dur="2.5s" repeatCount="indefinite" path={edgePath} />
      </circle>
      <circle r="2.5" className="edge-dot edge-dot-delayed">
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
