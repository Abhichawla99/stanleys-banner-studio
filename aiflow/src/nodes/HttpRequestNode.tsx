import { Handle, Position, type NodeProps, useEdges } from '@xyflow/react'
import { Globe } from 'lucide-react'
import { useState } from 'react'
import { useNodeStore } from '../store'
import { NodeMenu } from '../components/NodeMenu'

export function HttpRequestNode({ id, selected }: NodeProps) {
  const { nodes, updateNodeData } = useNodeStore()
  const edges = useEdges()
  const node = nodes.find(n => n.id === id)
  const data = (node?.data as Record<string, unknown>) ?? {}
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [error, setError] = useState('')

  const url = (data.url as string) ?? ''
  const method = (data.method as string) ?? 'GET'
  const headers = (data.headers as string) ?? ''
  const bodyTpl = (data.bodyTemplate as string) ?? ''
  const responseText = (data.responseText as string) ?? ''

  function getConnectedData(): Record<string, unknown> {
    const incomingEdge = edges.find(e => e.target === id)
    if (!incomingEdge) return {}
    const sourceNode = nodes.find(n => n.id === incomingEdge.source)
    return (sourceNode?.data as Record<string, unknown>) ?? {}
  }

  function interpolate(template: string, ctx: Record<string, unknown>): string {
    return template.replace(/\{\{(\w+)\}\}/g, (_, k) => String(ctx[k] ?? ''))
  }

  async function run() {
    if (!url) { setError('No URL set'); return }
    setStatus('loading')
    setError('')
    try {
      const ctx = getConnectedData()
      const interpolatedUrl = interpolate(url, ctx)
      const interpolatedBody = bodyTpl ? interpolate(bodyTpl, ctx) : undefined

      let parsedHeaders: Record<string, string> = { 'Content-Type': 'application/json' }
      if (headers) {
        try { parsedHeaders = { ...parsedHeaders, ...JSON.parse(headers) } } catch {}
      }

      const res = await fetch(interpolatedUrl, {
        method,
        headers: parsedHeaders,
        body: method !== 'GET' && interpolatedBody ? interpolatedBody : undefined,
      })

      const text = await res.text()
      updateNodeData(id, { responseText: text, responseJson: (() => { try { return JSON.parse(text) } catch { return null } })() })
      setStatus('done')
    } catch (e: any) {
      setError(e.message)
      setStatus('error')
    }
  }

  return (
    <div className={`node-wrapper ${selected ? 'selected' : ''}`} data-node-type="httpRequest" style={{ minWidth: 280 }}>
      <Handle type="target" position={Position.Left} style={{ top: '50%' }} />
      <div className="node-header">
        <Globe size={13} color="#38bdf8" />
        <span style={{ color: '#38bdf8' }}>HTTP Request</span>
        <span style={{ marginLeft: 'auto' }} className={`status-badge status-${status}`}>{status}</span>
              <NodeMenu id={id} />
      </div>
      <div className="node-body">
        <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr', gap: 8 }}>
          <div>
            <div className="field-label">Method</div>
            <select value={method} onChange={e => updateNodeData(id, { method: e.target.value })}>
              <option>GET</option>
              <option>POST</option>
              <option>PUT</option>
              <option>DELETE</option>
              <option>PATCH</option>
            </select>
          </div>
          <div>
            <div className="field-label">URL</div>
            <input type="text" value={url} onChange={e => updateNodeData(id, { url: e.target.value })} placeholder="https://..." />
          </div>
        </div>
        <div>
          <div className="field-label">Headers (JSON)</div>
          <textarea rows={2} value={headers} onChange={e => updateNodeData(id, { headers: e.target.value })} placeholder={'{"Authorization": "Bearer ..."}'} />
        </div>
        {method !== 'GET' && (
          <div>
            <div className="field-label">Body Template (use {'{{variable}}'})</div>
            <textarea rows={3} value={bodyTpl} onChange={e => updateNodeData(id, { bodyTemplate: e.target.value })} placeholder={'{"prompt": "{{text}}"}'} />
          </div>
        )}
        {error && <div style={{ color: '#f87171', fontSize: 11 }}>{error}</div>}
        <button className="btn-run" onClick={run} disabled={status === 'loading'}>
          {status === 'loading' ? <><div className="spinner" /> Requesting...</> : <><Globe size={13} /> Send Request</>}
        </button>
        {responseText && (
          <div>
            <div className="field-label">Response</div>
            <textarea rows={3} value={responseText} readOnly style={{ fontSize: 11, color: '#a0a0c0' }} />
          </div>
        )}
      </div>
      <Handle type="source" position={Position.Right} style={{ top: '50%' }} />
    </div>
  )
}
