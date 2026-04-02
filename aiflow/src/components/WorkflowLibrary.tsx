import { useState, useEffect, useCallback } from 'react'
import { X, Save, FolderOpen, Trash2, Clock, Download, Loader2 } from 'lucide-react'

const API = 'http://localhost:3001'

interface WorkflowMeta {
  id: string
  name: string
  updatedAt: string
  nodeCount: number
}

interface WorkflowFull extends WorkflowMeta {
  nodes: unknown[]
  edges: unknown[]
}

interface Props {
  currentName: string
  onSaved: (id: string, name: string) => void
  onLoad: (workflow: WorkflowFull) => void
  onClose: () => void
  getSnapshot: () => { name: string; nodes: unknown[]; edges: unknown[] }
  savedId?: string
}

export function WorkflowLibrary({ currentName, onSaved, onLoad, onClose, getSnapshot, savedId }: Props) {
  const [workflows, setWorkflows] = useState<WorkflowMeta[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const fetchList = useCallback(async () => {
    try {
      const res = await fetch(`${API}/workflows`)
      if (!res.ok) throw new Error(`Server error ${res.status}`)
      setWorkflows(await res.json())
    } catch (e: any) {
      setError(e.message.includes('fetch') ? 'Server not running (start with: node server.js)' : e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchList() }, [fetchList])

  async function saveToCloud() {
    setSaving(true)
    setError('')
    try {
      const snap = getSnapshot()
      let res: Response
      if (savedId) {
        res = await fetch(`${API}/workflows/${savedId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(snap),
        })
      } else {
        res = await fetch(`${API}/workflows`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(snap),
        })
      }
      if (!res.ok) throw new Error(`Save failed: ${res.status}`)
      const saved = await res.json()
      onSaved(saved.id, saved.name)
      await fetchList()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  async function loadWorkflow(id: string) {
    try {
      const res = await fetch(`${API}/workflows/${id}`)
      if (!res.ok) throw new Error(`Load failed: ${res.status}`)
      const wf: WorkflowFull = await res.json()
      onLoad(wf)
      onClose()
    } catch (e: any) {
      setError(e.message)
    }
  }

  async function deleteWorkflow(id: string, name: string) {
    if (!confirm(`Delete "${name}"?`)) return
    try {
      await fetch(`${API}/workflows/${id}`, { method: 'DELETE' })
      await fetchList()
    } catch (e: any) {
      setError(e.message)
    }
  }

  function exportJSON() {
    const snap = getSnapshot()
    const blob = new Blob([JSON.stringify(snap, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${snap.name.replace(/\s+/g, '-').toLowerCase()}.json`
    a.click()
  }

  function formatDate(iso: string) {
    const d = new Date(iso)
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) +
      ' ' + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{
        width: 480, maxHeight: '80vh', background: 'var(--s1)',
        border: '1px solid var(--border2)', borderRadius: 12,
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 16px', borderBottom: '1px solid var(--border)',
        }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--t1)' }}>Workflow Library</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              className="top-btn"
              style={{ fontSize: 11 }}
              onClick={exportJSON}
              title="Export as JSON file"
            >
              <Download size={11} /> Export JSON
            </button>
            <button
              className="top-btn"
              style={{ background: '#7c3aed18', border: '1px solid #7c3aed60', color: '#a78bfa', fontSize: 11 }}
              onClick={saveToCloud}
              disabled={saving}
            >
              {saving ? <Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} /> : <Save size={11} />}
              {savedId ? 'Update' : 'Save to Cloud'}
            </button>
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--t3)', cursor: 'pointer' }}>
              <X size={14} />
            </button>
          </div>
        </div>

        {/* Current workflow hint */}
        <div style={{ padding: '10px 16px', background: 'var(--bg)', borderBottom: '1px solid var(--border)', fontSize: 11, color: 'var(--t3)' }}>
          Current: <span style={{ color: 'var(--t2)' }}>{currentName}</span>
          {savedId && <span style={{ color: '#4ade80', marginLeft: 8 }}>● saved</span>}
        </div>

        {/* Error */}
        {error && (
          <div style={{ padding: '8px 16px', background: '#f8717118', color: '#f87171', fontSize: 11 }}>
            {error}
          </div>
        )}

        {/* Workflow list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
          {loading ? (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--t3)', fontSize: 12 }}>
              <Loader2 size={16} style={{ animation: 'spin 1s linear infinite', display: 'inline-block' }} />
            </div>
          ) : workflows.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--t3)', fontSize: 12 }}>
              No saved workflows yet. Click "Save to Cloud" to get started.
            </div>
          ) : (
            workflows.map(wf => (
              <div
                key={wf.id}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 16px', borderBottom: '1px solid var(--border)',
                  background: wf.id === savedId ? 'var(--s2)' : 'transparent',
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--t1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {wf.name}
                    {wf.id === savedId && <span style={{ color: '#a78bfa', fontSize: 10, marginLeft: 6 }}>● current</span>}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--t3)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Clock size={9} />
                    {formatDate(wf.updatedAt)} · {wf.nodeCount} node{wf.nodeCount !== 1 ? 's' : ''}
                  </div>
                </div>
                <button
                  className="top-btn"
                  style={{ fontSize: 10, padding: '3px 8px' }}
                  onClick={() => loadWorkflow(wf.id)}
                >
                  <FolderOpen size={10} /> Load
                </button>
                <button
                  style={{ background: 'none', border: 'none', color: 'var(--t3)', cursor: 'pointer', padding: 4 }}
                  onClick={() => deleteWorkflow(wf.id, wf.name)}
                  title="Delete"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
