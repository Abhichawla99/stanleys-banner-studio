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
          background: '#ffffff',
          border: '1px solid #e0e0e0',
          color: '#555555',
          borderRadius: 8,
          padding: '6px 14px',
          fontSize: 13,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          fontFamily: "'Inter', -apple-system, sans-serif",
          fontWeight: 500,
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
          transition: 'all 0.12s',
        }}
        onMouseOver={e => { e.currentTarget.style.color = '#1a1a1a'; e.currentTarget.style.borderColor = '#d0d0d0'; }}
        onMouseOut={e => { e.currentTarget.style.color = '#555555'; e.currentTarget.style.borderColor = '#e0e0e0'; }}
      >
        <span style={{ fontSize: 16 }}>&larr;</span> Dashboard
      </button>
      <WorkflowApp />
    </div>
  )
}
