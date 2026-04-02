import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

const STORAGE_KEY = 'stanleys_instances'

function loadInstances() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}

function saveInstances(list) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list))
}

const COLORS = ['#ff6b2b', '#4da6ff', '#2de88a', '#ff4d6a', '#b47aff', '#ffb82e', '#2dd4bf', '#f472b6']

const WORKFLOW_TYPES = [
  { id: 'banner-studio', label: 'Banner Studio', icon: '⚡', desc: 'Generate banners from key art using AI + templates' },
  { id: 'workflow-builder', label: 'Workflow Builder', icon: '◎', desc: 'Drag & drop AI pipeline with nodes' },
]

export default function Dashboard() {
  const navigate = useNavigate()
  const [instances, setInstances] = useState(loadInstances)
  const [showNew, setShowNew] = useState(false)
  const [newName, setNewName] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [newType, setNewType] = useState('banner-studio')

  useEffect(() => { saveInstances(instances) }, [instances])

  const create = () => {
    if (!newName.trim()) return
    const id = Date.now().toString(36) + '-' + newName.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    const color = COLORS[instances.length % COLORS.length]
    setInstances([...instances, {
      id,
      name: newName.trim(),
      description: newDesc.trim() || WORKFLOW_TYPES.find(t => t.id === newType)?.desc || '',
      type: newType,
      color,
      createdAt: new Date().toISOString(),
    }])
    setNewName('')
    setNewDesc('')
    setNewType('banner-studio')
    setShowNew(false)
  }

  const deleteInstance = (id) => {
    if (!confirm('Delete this workflow?')) return
    setInstances(instances.filter(i => i.id !== id))
  }

  const openWorkflow = (inst) => {
    if (inst.type === 'banner-studio') {
      navigate('/studio')
    } else {
      navigate(`/canvas/${inst.id}`)
    }
  }

  const bannerCount = instances.filter(i => i.type === 'banner-studio').length
  const builderCount = instances.filter(i => i.type === 'workflow-builder').length

  return (
    <div className="dash">
      {/* Top bar */}
      <header className="dash-header">
        <div className="dash-brand">
          <div className="dash-logo">S</div>
          <div>
            <div className="dash-title">Stanley's Post</div>
            <div className="dash-subtitle">Creative Automation Platform</div>
          </div>
        </div>
        <div className="dash-actions">
          <button className="dash-new-btn" onClick={() => setShowNew(true)}>
            + New Workflow
          </button>
        </div>
      </header>

      {/* Main content */}
      <main className="dash-main">
        {/* Stats bar */}
        <div className="dash-stats">
          <div className="stat-card">
            <div className="stat-value">{instances.length}</div>
            <div className="stat-label">Workflows</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{bannerCount}</div>
            <div className="stat-label">Banner Studios</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{builderCount}</div>
            <div className="stat-label">Pipelines</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">2</div>
            <div className="stat-label">AI Models</div>
          </div>
        </div>

        {/* Section header */}
        <div className="dash-section-header">
          <h2 className="dash-section-title">Workflows</h2>
          <span className="dash-section-count">{instances.length} active</span>
        </div>

        {/* Instance grid */}
        <div className="dash-grid">
          {instances.map(inst => {
            const typeMeta = WORKFLOW_TYPES.find(t => t.id === inst.type) || WORKFLOW_TYPES[0]
            return (
              <div key={inst.id} className="inst-card" onClick={() => openWorkflow(inst)}>
                <div className="inst-top">
                  <div className="inst-icon" style={{ background: inst.color }}>
                    {inst.name.charAt(0).toUpperCase()}
                  </div>
                  <button className="inst-delete" onClick={e => { e.stopPropagation(); deleteInstance(inst.id) }}>×</button>
                </div>
                <div className="inst-name">{inst.name}</div>
                <div className="inst-desc">{inst.description}</div>
                <div className="inst-meta">
                  <span className="inst-type-badge" data-type={inst.type}>
                    {typeMeta.icon} {typeMeta.label}
                  </span>
                  <span className="inst-meta-item">
                    Created {new Date(inst.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <div className="inst-actions-row">
                  <button className="inst-action primary" onClick={e => { e.stopPropagation(); openWorkflow(inst) }}>
                    Open
                  </button>
                </div>
              </div>
            )
          })}

          {/* Empty state / Add card */}
          {instances.length === 0 && (
            <div className="inst-card empty" onClick={() => setShowNew(true)}>
              <div className="empty-plus">+</div>
              <div className="inst-name">Create your first workflow</div>
              <div className="inst-desc">Set up a Banner Studio or Workflow Builder pipeline</div>
            </div>
          )}
        </div>

        {/* Quick access */}
        <div className="dash-section-header" style={{ marginTop: 40 }}>
          <h2 className="dash-section-title">Quick Access</h2>
        </div>
        <div className="quick-grid">
          <div className="quick-card" onClick={() => navigate('/studio')}>
            <div className="quick-icon">⚡</div>
            <div className="quick-label">Banner Studio</div>
            <div className="quick-desc">Generate banners from key art</div>
          </div>
          <div className="quick-card" onClick={() => {
            const builderInst = instances.find(i => i.type === 'workflow-builder')
            if (!builderInst) { setNewType('workflow-builder'); setShowNew(true); return }
            navigate(`/canvas/${builderInst.id}`)
          }}>
            <div className="quick-icon">◎</div>
            <div className="quick-label">Workflow Builder</div>
            <div className="quick-desc">Drag & drop AI pipelines</div>
          </div>
          <div className="quick-card disabled">
            <div className="quick-icon">📊</div>
            <div className="quick-label">Smartsheet</div>
            <div className="quick-desc">Coming soon</div>
            <span className="coming-soon-tag">Soon</span>
          </div>
          <div className="quick-card disabled">
            <div className="quick-icon">📦</div>
            <div className="quick-label">Asset Library</div>
            <div className="quick-desc">Coming soon</div>
            <span className="coming-soon-tag">Soon</span>
          </div>
        </div>
      </main>

      {/* New Workflow Modal */}
      {showNew && (
        <div className="modal-overlay" onClick={() => setShowNew(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">New Workflow</h3>
              <button className="modal-close" onClick={() => setShowNew(false)}>×</button>
            </div>
            <div className="modal-body">
              <label className="field-label">Workflow Type</label>
              <div className="type-selector">
                {WORKFLOW_TYPES.map(t => (
                  <div
                    key={t.id}
                    className={`type-option${newType === t.id ? ' selected' : ''}`}
                    onClick={() => setNewType(t.id)}
                  >
                    <div className="type-option-icon">{t.icon}</div>
                    <div>
                      <div className="type-option-label">{t.label}</div>
                      <div className="type-option-desc">{t.desc}</div>
                    </div>
                  </div>
                ))}
              </div>

              <label className="field-label" style={{ marginTop: 20 }}>Workflow Name</label>
              <input
                className="field-input"
                placeholder="e.g. Amazon Prime Video, Samsung Campaign..."
                value={newName}
                onChange={e => setNewName(e.target.value)}
                autoFocus
                onKeyDown={e => e.key === 'Enter' && create()}
              />
              <label className="field-label" style={{ marginTop: 16 }}>Description</label>
              <input
                className="field-input"
                placeholder="Optional — what is this workflow for?"
                value={newDesc}
                onChange={e => setNewDesc(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && create()}
              />
            </div>
            <div className="modal-footer">
              <button className="modal-cancel" onClick={() => setShowNew(false)}>Cancel</button>
              <button className="modal-create" disabled={!newName.trim()} onClick={create}>Create Workflow</button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=DM+Sans:wght@400;500;600;700&display=swap');

        .dash {
          --bg: #fafafa;
          --surface: #ffffff;
          --surface-2: #f5f5f5;
          --border: #e8e8e8;
          --border-hover: #d0d0d0;
          --text: #1a1a1a;
          --text-dim: #6b6b6b;
          --text-muted: #a0a0a0;
          --accent: #1a1a1a;
          --accent-hover: #333;
          --font: 'Inter', -apple-system, sans-serif;
          --display: 'DM Sans', 'Inter', -apple-system, sans-serif;

          font-family: var(--font);
          background: var(--bg);
          color: var(--text);
          min-height: 100vh;
          -webkit-font-smoothing: antialiased;
        }

        .dash-header {
          display: flex; align-items: center; justify-content: space-between;
          padding: 16px 32px; border-bottom: 1px solid var(--border);
          background: var(--surface); position: sticky; top: 0; z-index: 50;
        }
        .dash-brand { display: flex; align-items: center; gap: 14px; }
        .dash-logo {
          width: 38px; height: 38px; border-radius: 50%; background: var(--accent);
          display: flex; align-items: center; justify-content: center;
          font-weight: 700; font-size: 16px; color: #fff;
          font-family: 'DM Sans', serif; font-style: italic;
        }
        .dash-title { font-family: var(--display); font-weight: 700; font-size: 17px; letter-spacing: -0.5px; }
        .dash-subtitle { font-size: 11px; color: var(--text-muted); margin-top: 1px; letter-spacing: 0.02em; }
        .dash-actions { display: flex; gap: 10px; }
        .dash-new-btn {
          padding: 9px 22px; border-radius: 8px; border: none;
          background: var(--accent); color: #fff; font-family: var(--font);
          font-size: 13px; font-weight: 600; cursor: pointer; transition: all 0.15s;
        }
        .dash-new-btn:hover { background: var(--accent-hover); }

        .dash-main { max-width: 1200px; margin: 0 auto; padding: 32px; }

        /* Stats */
        .dash-stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; margin-bottom: 44px; }
        .stat-card {
          background: var(--surface); border: 1px solid var(--border); border-radius: 12px;
          padding: 22px 24px; transition: all 0.2s;
          box-shadow: 0 1px 3px rgba(0,0,0,0.04);
        }
        .stat-card:hover { border-color: var(--border-hover); box-shadow: 0 4px 12px rgba(0,0,0,0.06); }
        .stat-value {
          font-family: var(--display); font-size: 34px; font-weight: 700;
          letter-spacing: -1.5px; color: var(--text);
        }
        .stat-label {
          font-size: 11px; text-transform: uppercase;
          letter-spacing: 1.5px; color: var(--text-muted); margin-top: 4px; font-weight: 500;
        }

        /* Section */
        .dash-section-header {
          display: flex; align-items: baseline; justify-content: space-between;
          margin-bottom: 20px;
        }
        .dash-section-title {
          font-family: var(--display); font-size: 20px; font-weight: 700; letter-spacing: -0.5px; margin: 0;
        }
        .dash-section-count { font-size: 12px; color: var(--text-muted); }

        /* Instance Grid */
        .dash-grid {
          display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 16px;
        }
        .inst-card {
          background: var(--surface); border: 1px solid var(--border); border-radius: 12px;
          padding: 24px; cursor: pointer; transition: all 0.2s; position: relative;
          box-shadow: 0 1px 3px rgba(0,0,0,0.04);
        }
        .inst-card:hover { border-color: var(--border-hover); transform: translateY(-1px); box-shadow: 0 8px 24px rgba(0,0,0,0.08); }
        .inst-card.empty {
          border-style: dashed; display: flex; flex-direction: column;
          align-items: center; justify-content: center; text-align: center; min-height: 200px;
          border-color: var(--border-hover);
        }
        .inst-card.empty:hover { border-color: var(--accent); background: #f8f8f8; }
        .empty-plus { font-size: 36px; color: var(--text-muted); font-weight: 300; margin-bottom: 8px; }

        .inst-top { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px; }
        .inst-icon {
          width: 44px; height: 44px; border-radius: 12px;
          display: flex; align-items: center; justify-content: center;
          font-weight: 700; font-size: 20px; color: #fff;
        }
        .inst-delete {
          background: none; border: none; color: var(--text-muted); font-size: 18px;
          cursor: pointer; opacity: 0; transition: all 0.15s; padding: 4px;
        }
        .inst-card:hover .inst-delete { opacity: 1; }
        .inst-delete:hover { color: #e53e3e; }

        .inst-name { font-family: var(--display); font-size: 16px; font-weight: 600; letter-spacing: -0.3px; margin-bottom: 6px; }
        .inst-desc { font-size: 13px; color: var(--text-dim); line-height: 1.5; margin-bottom: 16px; }
        .inst-meta { display: flex; gap: 16px; margin-bottom: 16px; align-items: center; }
        .inst-meta-item {
          font-size: 11px; color: var(--text-muted);
          display: flex; align-items: center; gap: 5px;
        }

        .inst-type-badge {
          font-size: 11px; padding: 3px 10px; font-weight: 500;
          border-radius: 6px; display: inline-flex; align-items: center; gap: 5px;
        }
        .inst-type-badge[data-type="banner-studio"] {
          background: #fef3e2; color: #b45309;
        }
        .inst-type-badge[data-type="workflow-builder"] {
          background: #ede9fe; color: #6d28d9;
        }

        .inst-actions-row { display: flex; gap: 8px; }
        .inst-action {
          flex: 1; padding: 8px 12px; border-radius: 8px; border: 1px solid var(--border);
          background: transparent; color: var(--text-dim);
          font-size: 12px; font-weight: 500; cursor: pointer; transition: all 0.15s;
          font-family: var(--font);
        }
        .inst-action:hover { color: var(--text); border-color: var(--border-hover); background: var(--surface-2); }
        .inst-action.primary {
          background: var(--accent); color: #fff; border-color: var(--accent);
        }
        .inst-action.primary:hover { background: var(--accent-hover); }

        /* Quick Access */
        .quick-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; }
        .quick-card {
          background: var(--surface); border: 1px solid var(--border); border-radius: 12px;
          padding: 22px; cursor: pointer; transition: all 0.2s; position: relative;
          box-shadow: 0 1px 3px rgba(0,0,0,0.04);
        }
        .quick-card:hover:not(.disabled) { border-color: var(--accent); transform: translateY(-1px); box-shadow: 0 8px 24px rgba(0,0,0,0.08); }
        .quick-card.disabled { opacity: 0.5; cursor: default; }
        .quick-icon { font-size: 24px; margin-bottom: 12px; }
        .quick-label { font-family: var(--display); font-size: 14px; font-weight: 600; margin-bottom: 4px; }
        .quick-desc { font-size: 12px; color: var(--text-dim); }
        .coming-soon-tag {
          position: absolute; top: 14px; right: 14px;
          font-size: 9px; text-transform: uppercase; font-weight: 600;
          letter-spacing: 0.8px; color: var(--text-muted); background: var(--surface-2);
          padding: 3px 8px; border-radius: 4px;
        }

        /* Type selector in modal */
        .type-selector { display: flex; gap: 10px; margin-bottom: 4px; }
        .type-option {
          flex: 1; padding: 16px; border-radius: 10px; border: 1px solid var(--border);
          background: var(--bg); cursor: pointer; transition: all 0.15s;
          display: flex; gap: 12px; align-items: flex-start;
        }
        .type-option:hover { border-color: var(--border-hover); }
        .type-option.selected { border-color: var(--accent); background: #f5f5f5; }
        .type-option-icon { font-size: 20px; margin-top: 2px; }
        .type-option-label { font-family: var(--display); font-size: 14px; font-weight: 600; margin-bottom: 4px; }
        .type-option-desc { font-size: 11px; color: var(--text-dim); line-height: 1.4; }

        /* Modal */
        .modal-overlay {
          position: fixed; inset: 0; background: rgba(0,0,0,0.3); backdrop-filter: blur(8px);
          display: flex; align-items: center; justify-content: center; z-index: 100;
          animation: fadeIn 0.15s ease;
        }
        .modal {
          background: var(--surface); border: 1px solid var(--border); border-radius: 16px;
          width: 520px; max-width: 90vw; overflow: hidden;
          box-shadow: 0 24px 80px rgba(0,0,0,0.12);
        }
        .modal-header {
          display: flex; justify-content: space-between; align-items: center;
          padding: 22px 24px; border-bottom: 1px solid var(--border);
        }
        .modal-title { font-family: var(--display); font-size: 18px; font-weight: 700; margin: 0; }
        .modal-close {
          background: none; border: none; color: var(--text-muted); font-size: 20px;
          cursor: pointer; width: 32px; height: 32px; border-radius: 8px;
          display: flex; align-items: center; justify-content: center;
          transition: all 0.12s;
        }
        .modal-close:hover { color: var(--text); background: var(--surface-2); }
        .modal-body { padding: 24px; }
        .field-label {
          display: block; font-size: 11px; text-transform: uppercase;
          letter-spacing: 1.2px; color: var(--text-dim); margin-bottom: 8px; font-weight: 600;
        }
        .field-input {
          width: 100%; padding: 11px 14px; border-radius: 8px; border: 1px solid var(--border);
          background: var(--bg); color: var(--text); font-size: 14px; font-family: var(--font);
          outline: none; transition: border-color 0.15s;
        }
        .field-input:focus { border-color: var(--accent); }
        .field-input::placeholder { color: var(--text-muted); }
        .modal-footer {
          display: flex; justify-content: flex-end; gap: 10px;
          padding: 18px 24px; border-top: 1px solid var(--border);
        }
        .modal-cancel {
          padding: 9px 18px; border-radius: 8px; border: 1px solid var(--border);
          background: transparent; color: var(--text-dim); font-size: 13px;
          cursor: pointer; font-family: var(--font); font-weight: 500; transition: all 0.15s;
        }
        .modal-cancel:hover { color: var(--text); border-color: var(--border-hover); }
        .modal-create {
          padding: 9px 22px; border-radius: 8px; border: none;
          background: var(--accent); color: #fff; font-size: 13px; font-weight: 600;
          cursor: pointer; font-family: var(--font); transition: all 0.15s;
        }
        .modal-create:hover { background: var(--accent-hover); }
        .modal-create:disabled { opacity: 0.3; cursor: not-allowed; }

        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }

        @media (max-width: 800px) {
          .dash-stats { grid-template-columns: repeat(2, 1fr); }
          .quick-grid { grid-template-columns: repeat(2, 1fr); }
        }
      `}</style>
    </div>
  )
}
