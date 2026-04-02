import { Handle, Position, type NodeProps, useEdges } from '@xyflow/react'
import { Send, Plus, Trash2, Loader2, CheckCircle, AlertCircle } from 'lucide-react'
import { useState, useEffect, useRef } from 'react'
import { useNodeStore } from '../store'
import { registerNodeRunner, unregisterNodeRunner } from '../nodeRunner'
import { NodeMenu } from '../components/NodeMenu'

interface HeaderPair { key: string; value: string }

export function WebhookOutputNode({ id, selected }: NodeProps) {
  const { nodes, updateNodeData } = useNodeStore()
  const edges = useEdges()
  const node = nodes.find(n => n.id === id)
  const data = (node?.data as Record<string, unknown>) ?? {}

  const url = (data.url as string) ?? ''
  const method = (data.method as string) ?? 'POST'
  const headers: HeaderPair[] = (data.headers as HeaderPair[]) ?? []
  const status = (data.status as string) ?? 'idle'
  const lastResult = (data.lastResult as string) ?? ''
  const error = (data.error as string) ?? ''

  const runRef = useRef<() => Promise<void>>(() => Promise.resolve())

  function getUpstreamOutput(): unknown {
    const incoming = edges.filter(e => e.target === id)
    if (incoming.length === 0) return null
    const sourceNode = nodes.find(n => n.id === incoming[0].source)
    if (!sourceNode) return null
    const d = sourceNode.data as Record<string, unknown>
    // Prefer imageUrl, then text, then the whole data object
    return d.imageUrl ?? d.videoUrl ?? d.text ?? d.output ?? d
  }

  async function run() {
    if (!url.trim()) throw new Error('Webhook Output: no URL configured')

    updateNodeData(id, { status: 'loading', error: '', lastResult: '' })

    const payload = getUpstreamOutput()
    const extraHeaders: Record<string, string> = {}
    for (const h of headers) {
      if (h.key.trim()) extraHeaders[h.key.trim()] = h.value
    }

    const res = await fetch(url.trim(), {
      method,
      headers: { 'Content-Type': 'application/json', ...extraHeaders },
      body: JSON.stringify({ output: payload, timestamp: new Date().toISOString() }),
    })

    const text = await res.text().catch(() => '')
    if (!res.ok) {
      updateNodeData(id, { status: 'error', error: `HTTP ${res.status}: ${text.slice(0, 200)}` })
      throw new Error(`Webhook Output failed: HTTP ${res.status}`)
    }

    updateNodeData(id, { status: 'done', lastResult: text.slice(0, 500) })
  }

  runRef.current = run

  useEffect(() => {
    registerNodeRunner(id, () => runRef.current())
    return () => unregisterNodeRunner(id)
  }, [id])

  function addHeader() {
    updateNodeData(id, { headers: [...headers, { key: '', value: '' }] })
  }

  function updateHeader(i: number, field: 'key' | 'value', val: string) {
    const updated = headers.map((h, idx) => idx === i ? { ...h, [field]: val } : h)
    updateNodeData(id, { headers: updated })
  }

  function removeHeader(i: number) {
    updateNodeData(id, { headers: headers.filter((_, idx) => idx !== i) })
  }

  return (
    <div className={`node-wrapper ${selected ? 'selected' : ''}`} data-node-type="webhookOutput" style={{ minWidth: 300 }}>
      <Handle type="target" position={Position.Left} style={{ top: '50%' }} />

      <div className="node-header">
        <Send size={13} color="#22d3ee" />
        <span style={{ color: '#22d3ee' }}>Webhook Output</span>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
          {status === 'loading' && <Loader2 size={11} color="#a78bfa" style={{ animation: 'spin 1s linear infinite' }} />}
          {status === 'done' && <CheckCircle size={11} color="#4ade80" />}
          {status === 'error' && <AlertCircle size={11} color="#f87171" />}
          <NodeMenu id={id} />
        </div>
      </div>

      <div className="node-body">
        <div>
          <div className="field-label">Target URL</div>
          <input
            type="text"
            placeholder="https://example.com/webhook"
            value={url}
            onChange={e => updateNodeData(id, { url: e.target.value })}
          />
        </div>

        <div>
          <div className="field-label">Method</div>
          <select value={method} onChange={e => updateNodeData(id, { method: e.target.value })}>
            <option>POST</option>
            <option>PUT</option>
          </select>
        </div>

        {/* Headers */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <div className="field-label" style={{ marginBottom: 0 }}>Headers</div>
            <button
              onClick={addHeader}
              style={{ background: 'none', border: 'none', color: '#8888a0', cursor: 'pointer', padding: 2 }}
              title="Add header"
            >
              <Plus size={12} />
            </button>
          </div>
          {headers.map((h, i) => (
            <div key={i} style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
              <input
                placeholder="Key"
                value={h.key}
                onChange={e => updateHeader(i, 'key', e.target.value)}
                style={{ flex: '0 0 38%', fontSize: 11 }}
              />
              <input
                placeholder="Value"
                value={h.value}
                onChange={e => updateHeader(i, 'value', e.target.value)}
                style={{ flex: 1, fontSize: 11 }}
              />
              <button
                onClick={() => removeHeader(i)}
                style={{ background: 'none', border: 'none', color: '#44445a', cursor: 'pointer', padding: 2 }}
              >
                <Trash2 size={11} />
              </button>
            </div>
          ))}
        </div>

        {error && (
          <div style={{ fontSize: 10, color: '#f87171', background: '#f8717110', padding: '4px 8px', borderRadius: 4 }}>
            {error}
          </div>
        )}
        {lastResult && !error && (
          <div>
            <div className="field-label">Response</div>
            <textarea rows={2} value={lastResult} readOnly style={{ fontSize: 10, color: '#a0a0c0' }} />
          </div>
        )}

        <button
          className="node-run-btn"
          onClick={() => run().catch(e => updateNodeData(id, { status: 'error', error: e.message }))}
          disabled={status === 'loading'}
        >
          <Send size={11} /> Send Now
        </button>
      </div>
    </div>
  )
}
