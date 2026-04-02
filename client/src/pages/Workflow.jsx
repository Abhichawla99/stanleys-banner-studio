import React from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import '../workflow/workflow.css'
import WorkflowApp from '../workflow/WorkflowApp'

export default function Workflow() {
  const { instanceId } = useParams()
  const navigate = useNavigate()

  return (
    <div className="wf-root" style={{ position: 'relative' }}>
      {/* Back button overlay */}
      <button
        onClick={() => navigate('/')}
        style={{
          position: 'fixed',
          top: 12,
          left: 62,
          zIndex: 9999,
          background: '#17171f',
          border: '1px solid #222230',
          color: '#8a8aaa',
          borderRadius: 8,
          padding: '6px 14px',
          fontSize: 13,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          fontFamily: 'inherit',
        }}
        onMouseOver={e => e.currentTarget.style.color = '#e4e4f2'}
        onMouseOut={e => e.currentTarget.style.color = '#8a8aaa'}
      >
        <span style={{ fontSize: 16 }}>&larr;</span> Dashboard
      </button>
      <WorkflowApp />
    </div>
  )
}
