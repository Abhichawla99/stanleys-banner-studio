import { Handle, Position, type NodeProps } from '@xyflow/react'
import { Clock } from 'lucide-react'
import { useState, useEffect, useRef } from 'react'
import { useNodeStore } from '../store'
import { NodeMenu } from '../components/NodeMenu'

export function ScheduleNode({ id, selected }: NodeProps) {
  const { nodes, updateNodeData } = useNodeStore()
  const node = nodes.find(n => n.id === id)
  const data = (node?.data as Record<string, unknown>) ?? {}
  const [active, setActive] = useState(false)
  const [lastRun, setLastRun] = useState<string>('')
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const intervalSec = (data.intervalSec as number) ?? 60
  const triggerText = (data.triggerText as string) ?? 'scheduled trigger'

  function start() {
    if (intervalRef.current) return
    setActive(true)
    intervalRef.current = setInterval(() => {
      const now = new Date().toLocaleTimeString()
      setLastRun(now)
      updateNodeData(id, { text: triggerText, lastRun: now })
    }, intervalSec * 1000)
  }

  function stop() {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    setActive(false)
  }

  useEffect(() => () => stop(), [])

  return (
    <div className={`node-wrapper ${selected ? 'selected' : ''}`} data-node-type="schedule" style={{ minWidth: 260 }}>
      <div className="node-header">
        <Clock size={13} color="#fde68a" />
        <span style={{ color: '#fde68a' }}>Schedule Trigger</span>
        <span style={{ marginLeft: 'auto', fontSize: 10, color: active ? '#4ade80' : '#8888a0' }}>
          {active ? '● running' : '○ stopped'}
        </span>
              <NodeMenu id={id} />
      </div>
      <div className="node-body">
        <div>
          <div className="field-label">Interval (seconds)</div>
          <input type="text" value={intervalSec} onChange={e => updateNodeData(id, { intervalSec: Number(e.target.value) })} />
        </div>
        <div>
          <div className="field-label">Output Text</div>
          <input type="text" value={triggerText} onChange={e => updateNodeData(id, { triggerText: e.target.value })} placeholder="scheduled trigger" />
        </div>
        {lastRun && <div style={{ fontSize: 11, color: '#8888a0' }}>Last run: {lastRun}</div>}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <button className="btn-run" onClick={start} disabled={active} style={{ background: active ? '#333' : undefined }}>
            Start
          </button>
          <button className="btn-run" onClick={stop} disabled={!active} style={{ background: '#2e1a1a' }}>
            Stop
          </button>
        </div>
      </div>
      <Handle type="source" position={Position.Right} style={{ top: '50%' }} />
    </div>
  )
}
