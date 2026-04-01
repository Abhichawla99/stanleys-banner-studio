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

export default function Dashboard() {
  const navigate = useNavigate()
  const [instances, setInstances] = useState(loadInstances)
  const [showNew, setShowNew] = useState(false)
  const [newName, setNewName] = useState('')
  const [newDesc, setNewDesc] = useState('')

  useEffect(() => { saveInstances(instances) }, [instances])

  const create = () => {
    if (!newName.trim()) return
    const id = newName.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    if (instances.find(i => i.id === id)) return alert('Instance with this name already exists')
    const color = COLORS[instances.length % COLORS.length]
    setInstances([...instances, {
      id,
      name: newName.trim(),
      description: newDesc.trim() || 'Banner automation workspace',
      color,
      createdAt: new Date().toISOString(),
      formats: 0,
      runs: 0,
    }])
    setNewName('')
    setNewDesc('')
    setShowNew(false)
  }

  const deleteInstance = (id) => {
    if (!confirm('Delete this workspace?')) return
    setInstances(instances.filter(i => i.id !== id))
  }

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
            + New Workspace
          </button>
        </div>
      </header>

      {/* Main content */}
      <main className="dash-main">
        {/* Stats bar */}
        <div className="dash-stats">
          <div className="stat-card">
            <div className="stat-value">{instances.length}</div>
            <div className="stat-label">Workspaces</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{instances.reduce((s, i) => s + (i.formats || 0), 0)}</div>
            <div className="stat-label">Total Formats</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{instances.reduce((s, i) => s + (i.runs || 0), 0)}</div>
            <div className="stat-label">Total Runs</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">2</div>
            <div className="stat-label">AI Models</div>
          </div>
        </div>

        {/* Section header */}
        <div className="dash-section-header">
          <h2 className="dash-section-title">Workspaces</h2>
          <span className="dash-section-count">{instances.length} active</span>
        </div>

        {/* Instance grid */}
        <div className="dash-grid">
          {instances.map(inst => (
            <div key={inst.id} className="inst-card" onClick={() => navigate(`/${inst.id}`)}>
              <div className="inst-top">
                <div className="inst-icon" style={{ background: inst.color }}>
                  {inst.name.charAt(0).toUpperCase()}
                </div>
                <button className="inst-delete" onClick={e => { e.stopPropagation(); deleteInstance(inst.id) }}>×</button>
              </div>
              <div className="inst-name">{inst.name}</div>
              <div className="inst-desc">{inst.description}</div>
              <div className="inst-meta">
                <span className="inst-meta-item">
                  <span className="inst-dot" style={{ background: inst.color }} />
                  Active
                </span>
                <span className="inst-meta-item">
                  Created {new Date(inst.createdAt).toLocaleDateString()}
                </span>
              </div>
              <div className="inst-actions-row">
                <button className="inst-action" onClick={e => { e.stopPropagation(); navigate(`/${inst.id}/studio`) }}>
                  Banner Studio
                </button>
                <button className="inst-action primary" onClick={e => { e.stopPropagation(); navigate(`/${inst.id}`) }}>
                  Open
                </button>
              </div>
            </div>
          ))}

          {/* Empty state / Add card */}
          {instances.length === 0 && (
            <div className="inst-card empty" onClick={() => setShowNew(true)}>
              <div className="empty-plus">+</div>
              <div className="inst-name">Create your first workspace</div>
              <div className="inst-desc">Set up a client workspace to start generating banners</div>
            </div>
          )}
        </div>

        {/* Quick access */}
        <div className="dash-section-header" style={{ marginTop: 40 }}>
          <h2 className="dash-section-title">Quick Access</h2>
        </div>
        <div className="quick-grid">
          <div className="quick-card" onClick={() => {
            if (instances.length === 0) { setShowNew(true); return }
            navigate(`/${instances[0].id}/studio`)
          }}>
            <div className="quick-icon">⚡</div>
            <div className="quick-label">Banner Studio</div>
            <div className="quick-desc">Generate banners from key art</div>
          </div>
          <div className="quick-card" onClick={() => {
            if (instances.length === 0) { setShowNew(true); return }
            navigate(`/${instances[0].id}`)
          }}>
            <div className="quick-icon">◎</div>
            <div className="quick-label">Canvas</div>
            <div className="quick-desc">Visual workflow builder</div>
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

      {/* New Instance Modal */}
      {showNew && (
        <div className="modal-overlay" onClick={() => setShowNew(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">New Workspace</h3>
              <button className="modal-close" onClick={() => setShowNew(false)}>×</button>
            </div>
            <div className="modal-body">
              <label className="field-label">Workspace Name</label>
              <input
                className="field-input"
                placeholder="e.g. Amazon Prime Video, Samsung, Netflix..."
                value={newName}
                onChange={e => setNewName(e.target.value)}
                autoFocus
                onKeyDown={e => e.key === 'Enter' && create()}
              />
              <label className="field-label" style={{ marginTop: 16 }}>Description</label>
              <input
                className="field-input"
                placeholder="Optional — what is this workspace for?"
                value={newDesc}
                onChange={e => setNewDesc(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && create()}
              />
            </div>
            <div className="modal-footer">
              <button className="modal-cancel" onClick={() => setShowNew(false)}>Cancel</button>
              <button className="modal-create" disabled={!newName.trim()} onClick={create}>Create Workspace</button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        :root {
          --bg: #0b0b0e;
          --surface: #111116;
          --surface-2: #18181f;
          --surface-3: #1f1f28;
          --border: rgba(255,255,255,0.08);
          --border-hover: rgba(255,255,255,0.15);
          --text: #f0f0f5;
          --text-dim: #9090a0;
          --text-muted: #50505e;
          --accent: #ff6b2b;
          --accent-dim: rgba(255,107,43,0.14);
          --accent-hover: #ff7f45;
          --accent-glow: rgba(255,107,43,0.25);
          --mono: 'JetBrains Mono', 'SF Mono', 'Fira Code', monospace;
          --display: 'Space Grotesk', -apple-system, sans-serif;
        }

        .dash {
          font-family: var(--display);
          background: var(--bg);
          color: var(--text);
          min-height: 100vh;
        }

        .dash-header {
          display: flex; align-items: center; justify-content: space-between;
          padding: 16px 32px; border-bottom: 1px solid var(--border);
          background: var(--surface); position: sticky; top: 0; z-index: 50;
        }
        .dash-brand { display: flex; align-items: center; gap: 14px; }
        .dash-logo {
          width: 36px; height: 36px; border-radius: 8px; background: var(--accent);
          display: flex; align-items: center; justify-content: center;
          font-weight: 700; font-size: 16px; color: #fff;
          box-shadow: 0 0 20px var(--accent-glow);
        }
        .dash-title { font-weight: 700; font-size: 16px; letter-spacing: -0.5px; }
        .dash-subtitle { font-size: 11px; color: var(--text-dim); margin-top: -1px; font-family: var(--mono); }
        .dash-actions { display: flex; gap: 10px; }
        .dash-new-btn {
          padding: 9px 20px; border-radius: 6px; border: none;
          background: var(--accent); color: #fff; font-family: var(--display);
          font-size: 13px; font-weight: 600; cursor: pointer; transition: all 0.15s;
          box-shadow: 0 2px 12px var(--accent-glow);
        }
        .dash-new-btn:hover { background: var(--accent-hover); box-shadow: 0 4px 20px rgba(255,107,43,0.4); }

        .dash-main { max-width: 1200px; margin: 0 auto; padding: 32px; }

        /* Stats */
        .dash-stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 40px; }
        .stat-card {
          background: var(--surface); border: 1px solid var(--border); border-radius: 8px;
          padding: 20px; transition: border-color 0.15s;
        }
        .stat-card:hover { border-color: var(--border-hover); }
        .stat-value {
          font-family: var(--display); font-size: 32px; font-weight: 700;
          letter-spacing: -1px; color: var(--text);
        }
        .stat-label {
          font-family: var(--mono); font-size: 10px; text-transform: uppercase;
          letter-spacing: 1.5px; color: var(--text-muted); margin-top: 4px;
        }

        /* Section */
        .dash-section-header {
          display: flex; align-items: baseline; justify-content: space-between;
          margin-bottom: 20px;
        }
        .dash-section-title {
          font-size: 18px; font-weight: 600; letter-spacing: -0.5px; margin: 0;
        }
        .dash-section-count { font-family: var(--mono); font-size: 11px; color: var(--text-muted); }

        /* Instance Grid */
        .dash-grid {
          display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 16px;
        }
        .inst-card {
          background: var(--surface); border: 1px solid var(--border); border-radius: 10px;
          padding: 24px; cursor: pointer; transition: all 0.2s; position: relative;
        }
        .inst-card:hover { border-color: var(--border-hover); transform: translateY(-2px); box-shadow: 0 8px 30px rgba(0,0,0,0.3); }
        .inst-card.empty {
          border-style: dashed; display: flex; flex-direction: column;
          align-items: center; justify-content: center; text-align: center; min-height: 200px;
        }
        .inst-card.empty:hover { border-color: var(--accent); background: var(--accent-dim); }
        .empty-plus { font-size: 36px; color: var(--text-muted); font-weight: 300; margin-bottom: 8px; }

        .inst-top { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px; }
        .inst-icon {
          width: 44px; height: 44px; border-radius: 10px;
          display: flex; align-items: center; justify-content: center;
          font-weight: 700; font-size: 20px; color: #fff;
        }
        .inst-delete {
          background: none; border: none; color: var(--text-muted); font-size: 18px;
          cursor: pointer; opacity: 0; transition: all 0.15s; padding: 4px;
        }
        .inst-card:hover .inst-delete { opacity: 1; }
        .inst-delete:hover { color: #ff4d6a; }

        .inst-name { font-size: 16px; font-weight: 600; letter-spacing: -0.3px; margin-bottom: 6px; }
        .inst-desc { font-size: 12px; color: var(--text-dim); line-height: 1.5; margin-bottom: 16px; }
        .inst-meta { display: flex; gap: 16px; margin-bottom: 16px; }
        .inst-meta-item {
          font-family: var(--mono); font-size: 10px; color: var(--text-muted);
          display: flex; align-items: center; gap: 5px;
        }
        .inst-dot { width: 6px; height: 6px; border-radius: 50%; }

        .inst-actions-row { display: flex; gap: 8px; }
        .inst-action {
          flex: 1; padding: 8px 12px; border-radius: 5px; border: 1px solid var(--border);
          background: transparent; color: var(--text-dim); font-family: var(--mono);
          font-size: 10px; font-weight: 500; cursor: pointer; transition: all 0.15s;
        }
        .inst-action:hover { color: var(--text); border-color: var(--border-hover); background: var(--surface-2); }
        .inst-action.primary {
          background: var(--accent-dim); color: var(--accent); border-color: rgba(255,107,43,0.2);
        }
        .inst-action.primary:hover { background: rgba(255,107,43,0.22); }

        /* Quick Access */
        .quick-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
        .quick-card {
          background: var(--surface); border: 1px solid var(--border); border-radius: 8px;
          padding: 20px; cursor: pointer; transition: all 0.2s; position: relative;
        }
        .quick-card:hover:not(.disabled) { border-color: var(--accent); background: var(--accent-dim); }
        .quick-card.disabled { opacity: 0.5; cursor: default; }
        .quick-icon { font-size: 24px; margin-bottom: 10px; }
        .quick-label { font-size: 13px; font-weight: 600; margin-bottom: 4px; }
        .quick-desc { font-size: 11px; color: var(--text-dim); }
        .coming-soon-tag {
          position: absolute; top: 12px; right: 12px;
          font-family: var(--mono); font-size: 8px; text-transform: uppercase;
          letter-spacing: 1px; color: var(--text-muted); background: var(--surface-2);
          padding: 2px 6px; border-radius: 3px;
        }

        /* Modal */
        .modal-overlay {
          position: fixed; inset: 0; background: rgba(0,0,0,0.7); backdrop-filter: blur(4px);
          display: flex; align-items: center; justify-content: center; z-index: 100;
          animation: fadeIn 0.15s ease;
        }
        .modal {
          background: var(--surface); border: 1px solid var(--border); border-radius: 12px;
          width: 440px; max-width: 90vw; overflow: hidden;
        }
        .modal-header {
          display: flex; justify-content: space-between; align-items: center;
          padding: 20px 24px; border-bottom: 1px solid var(--border);
        }
        .modal-title { font-size: 16px; font-weight: 600; margin: 0; }
        .modal-close {
          background: none; border: none; color: var(--text-muted); font-size: 20px;
          cursor: pointer; font-family: var(--mono);
        }
        .modal-close:hover { color: var(--text); }
        .modal-body { padding: 24px; }
        .field-label {
          display: block; font-family: var(--mono); font-size: 10px; text-transform: uppercase;
          letter-spacing: 1.5px; color: var(--text-dim); margin-bottom: 8px;
        }
        .field-input {
          width: 100%; padding: 10px 14px; border-radius: 6px; border: 1px solid var(--border);
          background: var(--bg); color: var(--text); font-size: 13px; font-family: var(--display);
          outline: none; transition: border-color 0.15s;
        }
        .field-input:focus { border-color: rgba(255,107,43,0.3); }
        .field-input::placeholder { color: var(--text-muted); }
        .modal-footer {
          display: flex; justify-content: flex-end; gap: 10px;
          padding: 16px 24px; border-top: 1px solid var(--border);
        }
        .modal-cancel {
          padding: 8px 16px; border-radius: 6px; border: 1px solid var(--border);
          background: transparent; color: var(--text-dim); font-size: 12px;
          cursor: pointer; font-family: var(--display);
        }
        .modal-cancel:hover { color: var(--text); border-color: var(--border-hover); }
        .modal-create {
          padding: 8px 20px; border-radius: 6px; border: none;
          background: var(--accent); color: #fff; font-size: 12px; font-weight: 600;
          cursor: pointer; font-family: var(--display); transition: all 0.15s;
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
