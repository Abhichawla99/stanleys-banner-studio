import { Handle, Position, type NodeProps } from '@xyflow/react'
import { Webhook, Copy, Check } from 'lucide-react'
import { useState, useEffect } from 'react'
import { useNodeStore } from '../store'
import { NodeMenu } from '../components/NodeMenu'

export function WebhookNode({ id, selected }: NodeProps) {
  const { nodes, updateNodeData } = useNodeStore()
  const node = nodes.find(n => n.id === id)
  const data = (node?.data as Record<string, unknown>) ?? {}
  const [copied, setCopied] = useState(false)
  const [lastPayload, setLastPayload] = useState<string>('')

  const path = (data.path as string) ?? `webhook-${id.slice(-4)}`
  const method = (data.method as string) ?? 'POST'
  const webhookUrl = `http://localhost:3001/webhook/${path}`

  useEffect(() => {
    // Register this webhook path in global registry
    const registry = (window as any).__aiflow_webhooks ?? {}
    registry[path] = (payload: unknown) => {
      const text = typeof payload === 'string' ? payload : JSON.stringify(payload, null, 2)
      updateNodeData(id, { lastPayload: text, text: extractText(payload) })
      setLastPayload(text)
    }
    ;(window as any).__aiflow_webhooks = registry
    return () => {
      delete (window as any).__aiflow_webhooks[path]
    }
  }, [path, id])

  function extractText(payload: unknown): string {
    if (typeof payload === 'string') return payload
    if (typeof payload === 'object' && payload !== null) {
      const p = payload as Record<string, unknown>
      return (p.prompt ?? p.text ?? p.message ?? p.content ?? JSON.stringify(payload)) as string
    }
    return String(payload)
  }

  function copy() {
    navigator.clipboard.writeText(webhookUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className={`node-wrapper ${selected ? 'selected' : ''}`} data-node-type="webhook" style={{ minWidth: 280 }}>
      <div className="node-header">
        <Webhook size={13} color="#e879f9" />
        <span style={{ color: '#e879f9' }}>Webhook Trigger</span>
        <span style={{ marginLeft: 'auto', fontSize: 10, color: '#4ade80' }}>● listening</span>
              <NodeMenu id={id} />
      </div>
      <div className="node-body">
        <div>
          <div className="field-label">Webhook URL</div>
          <div style={{ display: 'flex', gap: 6 }}>
            <input
              type="text"
              value={webhookUrl}
              readOnly
              style={{ fontSize: 11, flex: 1 }}
            />
            <button
              onClick={copy}
              style={{ background: '#252530', border: '1px solid #2a2a35', borderRadius: 6, color: '#8888a0', cursor: 'pointer', padding: '0 8px' }}
            >
              {copied ? <Check size={12} color="#4ade80" /> : <Copy size={12} />}
            </button>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <div>
            <div className="field-label">Path</div>
            <input
              type="text"
              value={path}
              onChange={e => updateNodeData(id, { path: e.target.value.replace(/[^a-z0-9-]/gi, '-') })}
            />
          </div>
          <div>
            <div className="field-label">Method</div>
            <select value={method} onChange={e => updateNodeData(id, { method: e.target.value })}>
              <option>POST</option>
              <option>GET</option>
              <option>PUT</option>
            </select>
          </div>
        </div>
        {lastPayload && (
          <div>
            <div className="field-label">Last Payload</div>
            <textarea rows={3} value={lastPayload} readOnly style={{ fontSize: 11, color: '#a0a0c0' }} />
          </div>
        )}
        <div style={{ fontSize: 10, color: '#44445a', lineHeight: 1.5 }}>
          Send a POST with JSON body including "prompt" or "text" key. Output connects to generation nodes.
        </div>
      </div>
      <Handle type="source" position={Position.Right} style={{ top: '50%' }} />
    </div>
  )
}
