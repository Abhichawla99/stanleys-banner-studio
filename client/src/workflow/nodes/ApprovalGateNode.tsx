import { Handle, Position, type NodeProps, useEdges } from '@xyflow/react'
import { ShieldCheck, Check, X, RefreshCw, DollarSign } from 'lucide-react'
import { useState, useEffect, useRef } from 'react'
import { useNodeStore } from '../store'
import { NodeMenu } from '../components/NodeMenu'
import { registerNodeRunner, unregisterNodeRunner } from '../nodeRunner'
import { waitForApproval, approveGate, rejectGate, hasPendingGate } from '../approvalRegistry'
import { getTrackerState } from '../apiCallTracker'

export function ApprovalGateNode({ id, selected }: NodeProps) {
  const { nodes, updateNodeData } = useNodeStore()
  const edges = useEdges()
  const node = nodes.find(n => n.id === id)
  const data = (node?.data as Record<string, unknown>) ?? {}
  const runRef = useRef<() => Promise<void>>(async () => {})

  const [waiting, setWaiting] = useState(false)
  const [status, setStatus] = useState<'idle' | 'waiting' | 'approved' | 'rejected'>('idle')

  // Cost state — updated when we start waiting
  const [costInfo, setCostInfo] = useState({ calls: 0, estimatedCents: 0 })

  function getUpstreamOutput(): { imageUrl?: string; videoUrl?: string; text?: string; nodeLabel?: string } {
    for (const edge of edges.filter(e => e.target === id)) {
      const src = nodes.find(n => n.id === edge.source)
      const d = (src?.data as Record<string, unknown>) ?? {}
      return {
        imageUrl: d.imageUrl as string | undefined,
        videoUrl: d.videoUrl as string | undefined,
        text: (d.text as string | undefined) ?? (d.output as string | undefined),
        nodeLabel: src?.type ?? 'node',
      }
    }
    return {}
  }

  async function run() {
    const output = getUpstreamOutput()
    const cost = getTrackerState()
    setCostInfo(cost)

    // Snapshot output into node data so the preview shows it
    updateNodeData(id, {
      previewImageUrl: output.imageUrl,
      previewVideoUrl: output.videoUrl,
      previewText: output.text,
    })

    setStatus('waiting')
    setWaiting(true)

    try {
      await waitForApproval(id)
      setStatus('approved')
    } catch (e: any) {
      setStatus('rejected')
      throw e // propagate to stop workflow
    } finally {
      setWaiting(false)
    }
  }

  runRef.current = run
  useEffect(() => {
    registerNodeRunner(id, () => runRef.current())
    return () => {
      unregisterNodeRunner(id)
      if (hasPendingGate(id)) rejectGate(id, 'Node unmounted')
    }
  }, [id])

  function handleApprove() {
    approveGate(id)
    setStatus('approved')
    setWaiting(false)
  }

  function handleReject() {
    rejectGate(id, 'Rejected by reviewer')
    setStatus('rejected')
    setWaiting(false)
  }

  async function handleRegenerate() {
    // Re-run this node (the upstream will re-execute when workflow runs again from this point)
    setStatus('idle')
    setWaiting(false)
    if (hasPendingGate(id)) rejectGate(id, 'Regenerating')
    // Re-run the runner to get fresh output from upstream
    await run()
  }

  const previewImageUrl = (data.previewImageUrl as string) ?? ''
  const previewVideoUrl = (data.previewVideoUrl as string) ?? ''
  const previewText = (data.previewText as string) ?? ''

  const statusColor = {
    idle: 'var(--t3)',
    waiting: 'var(--accent)',
    approved: 'var(--green)',
    rejected: 'var(--red)',
  }[status]

  return (
    <div className={`node-wrapper ${selected ? 'selected' : ''}`} data-node-type="approvalGate" style={{ minWidth: 320 }}>
      <Handle type="target" position={Position.Left} style={{ top: '50%' }} />
      <div className="node-header">
        <ShieldCheck size={13} color="#e879f9" />
        <span style={{ color: '#e879f9' }}>Approval Gate</span>
        <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 6px', borderRadius: 4, fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', background: 'var(--s3)', color: statusColor }}>
          {status === 'waiting' && <div className="spinner" style={{ width: 9, height: 9 }} />}
          {status}
        </span>
        <NodeMenu id={id} />
      </div>
      <div className="node-body">

        {/* Preview */}
        {(previewImageUrl || previewVideoUrl || previewText) && (
          <div>
            <div className="field-label">Preview</div>
            {previewImageUrl && (
              <div className="checker-bg" style={{ borderRadius: 7, overflow: 'hidden', border: `2px solid ${status === 'waiting' ? '#e879f9' : 'var(--border2)'}` }}>
                <img src={previewImageUrl} alt="preview" style={{ width: '100%', display: 'block', maxHeight: 280, objectFit: 'contain' }} />
              </div>
            )}
            {previewVideoUrl && !previewImageUrl && (
              <video src={previewVideoUrl} controls style={{ width: '100%', borderRadius: 7, border: '1px solid var(--border2)' }} />
            )}
            {previewText && !previewImageUrl && !previewVideoUrl && (
              <div style={{ background: 'var(--s3)', borderRadius: 7, padding: '10px 12px', fontSize: 12, color: 'var(--t1)', lineHeight: 1.6, maxHeight: 200, overflow: 'auto', border: '1px solid var(--border2)' }}>
                {previewText}
              </div>
            )}
          </div>
        )}

        {/* Cost info */}
        {(waiting || status === 'approved' || status === 'rejected') && costInfo.calls > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 8px', background: 'var(--s3)', borderRadius: 6, border: '1px solid var(--border2)' }}>
            <DollarSign size={11} color="var(--t3)" />
            <span style={{ fontSize: 10, color: 'var(--t2)' }}>
              {costInfo.calls} API call{costInfo.calls !== 1 ? 's' : ''} — est. ~${(costInfo.estimatedCents / 100).toFixed(3)}
            </span>
          </div>
        )}

        {/* Waiting message */}
        {!waiting && !previewImageUrl && !previewVideoUrl && !previewText && (
          <div style={{ textAlign: 'center', padding: '12px 0', fontSize: 11, color: 'var(--t3)' }}>
            {status === 'idle' ? 'Workflow will pause here for review' : status === 'approved' ? 'Approved — workflow continued' : 'Rejected — workflow stopped'}
          </div>
        )}

        {/* Action buttons */}
        {waiting && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 7 }}>
            <button
              onClick={handleApprove}
              style={{ padding: '7px', borderRadius: 7, border: 'none', background: 'rgba(74,222,128,0.15)', color: '#4ade80', fontSize: 11, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}
            >
              <Check size={12} /> Approve
            </button>
            <button
              onClick={handleRegenerate}
              style={{ padding: '7px', borderRadius: 7, border: '1px solid var(--border2)', background: 'var(--s3)', color: 'var(--t2)', fontSize: 11, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}
            >
              <RefreshCw size={11} /> Regen
            </button>
            <button
              onClick={handleReject}
              style={{ padding: '7px', borderRadius: 7, border: 'none', background: 'rgba(248,113,113,0.15)', color: 'var(--red)', fontSize: 11, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}
            >
              <X size={12} /> Reject
            </button>
          </div>
        )}

        {!waiting && (status === 'approved' || status === 'rejected') && (
          <div style={{ textAlign: 'center' }}>
            <button
              onClick={() => { setStatus('idle'); updateNodeData(id, { previewImageUrl: '', previewVideoUrl: '', previewText: '' }) }}
              style={{ fontSize: 10, color: 'var(--t3)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
            >
              Reset
            </button>
          </div>
        )}
      </div>
      <Handle type="source" position={Position.Right} style={{ top: '50%' }} />
    </div>
  )
}
