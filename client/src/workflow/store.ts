import { create } from 'zustand'
import { type Node, type Edge, addEdge, applyNodeChanges, applyEdgeChanges } from '@xyflow/react'
import { runNode, hasRunner } from './nodeRunner'
import { cancelAllGates } from './approvalRegistry'
import { resetTracker } from './apiCallTracker'

type Snapshot = { nodes: Node[]; edges: Edge[] }

export interface FailedNode {
  id: string
  label: string
  error: string
}

export interface WorkflowProgress {
  running: boolean
  total: number
  completed: number
  succeeded: number
  failed: number
  currentId: string
  currentLabel: string
  error: string
  failedNodes: FailedNode[]
  done: boolean
}

interface NodeStore {
  nodes: Node[]
  edges: Edge[]
  past: Snapshot[]
  future: Snapshot[]

  workflowProgress: WorkflowProgress

  setNodes: (nodes: Node[]) => void
  setEdges: (edges: Edge[]) => void
  onNodesChange: (changes: any) => void
  onEdgesChange: (changes: any) => void
  onConnect: (connection: any) => void
  addNode: (node: Node) => void
  deleteNode: (id: string) => void
  duplicateNode: (id: string) => void
  updateNodeData: (id: string, data: Record<string, unknown>) => void

  snapshot: () => void
  undo: () => void
  redo: () => void

  runWorkflow: () => Promise<void>
  retryFromNode: (nodeId: string) => Promise<void>
  stopWorkflow: () => void
}

function topoSort(nodes: Node[], edges: Edge[]): string[] {
  const adj = new Map<string, string[]>()
  const inDegree = new Map<string, number>()

  for (const n of nodes) {
    adj.set(n.id, [])
    inDegree.set(n.id, 0)
  }
  for (const e of edges) {
    adj.get(e.source)?.push(e.target)
    inDegree.set(e.target, (inDegree.get(e.target) ?? 0) + 1)
  }

  const queue: string[] = []
  for (const [id, deg] of inDegree) {
    if (deg === 0) queue.push(id)
  }

  const order: string[] = []
  while (queue.length > 0) {
    const curr = queue.shift()!
    order.push(curr)
    for (const next of (adj.get(curr) ?? [])) {
      const newDeg = (inDegree.get(next) ?? 0) - 1
      inDegree.set(next, newDeg)
      if (newDeg === 0) queue.push(next)
    }
  }

  // Any nodes not reached (cycles) get appended at end
  for (const n of nodes) {
    if (!order.includes(n.id)) order.push(n.id)
  }
  return order
}

// Get all node IDs reachable from a starting node (including itself)
function getDownstreamNodes(fromId: string, nodes: Node[], edges: Edge[]): Set<string> {
  const adj = new Map<string, string[]>()
  for (const n of nodes) adj.set(n.id, [])
  for (const e of edges) adj.get(e.source)?.push(e.target)

  const visited = new Set<string>()
  const queue = [fromId]
  while (queue.length) {
    const id = queue.shift()!
    if (visited.has(id)) continue
    visited.add(id)
    for (const next of adj.get(id) ?? []) queue.push(next)
  }
  return visited
}

function isTransientError(e: Error): boolean {
  const msg = e.message.toLowerCase()
  return (
    msg.includes('429') ||
    msg.includes('rate limit') ||
    msg.includes('timeout') ||
    msg.includes('network') ||
    msg.includes('503') ||
    msg.includes('502') ||
    msg.includes('fetch failed')
  )
}

const MAX_RETRIES = 3

async function runWithRetry(nodeId: string): Promise<void> {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      await runNode(nodeId)
      return
    } catch (e: any) {
      const transient = isTransientError(e)
      if (attempt >= MAX_RETRIES || !transient) throw e
      // Exponential backoff: 1s, 2s, 4s
      await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 1000))
    }
  }
}

let stopFlag = false

const defaultProgress: WorkflowProgress = {
  running: false, total: 0, completed: 0, succeeded: 0, failed: 0,
  currentId: '', currentLabel: '', error: '', failedNodes: [], done: false,
}

export const useNodeStore = create<NodeStore>((set, get) => ({
  nodes: [],
  edges: [],
  past: [],
  future: [],
  workflowProgress: defaultProgress,

  snapshot: () => {
    const { nodes, edges, past } = get()
    set({ past: [...past.slice(-29), { nodes, edges }], future: [] })
  },

  undo: () => {
    const { past, nodes, edges, future } = get()
    if (past.length === 0) return
    const prev = past[past.length - 1]
    set({
      nodes: prev.nodes,
      edges: prev.edges,
      past: past.slice(0, -1),
      future: [{ nodes, edges }, ...future.slice(0, 29)],
    })
  },

  redo: () => {
    const { future, nodes, edges, past } = get()
    if (future.length === 0) return
    const next = future[0]
    set({
      nodes: next.nodes,
      edges: next.edges,
      future: future.slice(1),
      past: [...past.slice(-29), { nodes, edges }],
    })
  },

  setNodes: (nodes) => set({ nodes }),
  setEdges: (edges) => set({ edges }),

  onNodesChange: (changes) =>
    set({ nodes: applyNodeChanges(changes, get().nodes) }),

  onEdgesChange: (changes) =>
    set({ edges: applyEdgeChanges(changes, get().edges) }),

  onConnect: (connection) => {
    get().snapshot()
    set({ edges: addEdge({ ...connection, animated: false }, get().edges) })
  },

  addNode: (node) => {
    get().snapshot()
    set({ nodes: [...get().nodes, node] })
  },

  deleteNode: (id) => {
    get().snapshot()
    set({
      nodes: get().nodes.filter(n => n.id !== id),
      edges: get().edges.filter(e => e.source !== id && e.target !== id),
    })
  },

  duplicateNode: (id) => {
    get().snapshot()
    const node = get().nodes.find(n => n.id === id)
    if (!node) return
    const newId = `node-${Date.now()}`
    const newNode: Node = {
      ...node,
      id: newId,
      position: { x: node.position.x + 30, y: node.position.y + 30 },
      selected: false,
    }
    set({ nodes: [...get().nodes, newNode] })
  },

  updateNodeData: (id, data) =>
    set({
      nodes: get().nodes.map(n =>
        n.id === id ? { ...n, data: { ...(n.data as Record<string, unknown>), ...data } } : n
      ),
    }),

  stopWorkflow: () => {
    stopFlag = true
    cancelAllGates()
    set({ workflowProgress: { ...get().workflowProgress, running: false } })
  },

  runWorkflow: async () => {
    const { nodes, edges } = get()
    if (nodes.length === 0) return

    stopFlag = false
    resetTracker()
    const order = topoSort(nodes, edges)
    const runnable = order.filter(id => hasRunner(id))

    // Clear per-node workflow errors
    const clearedNodes = nodes.map(n => {
      const d = n.data as Record<string, unknown>
      if ('_workflowError' in d) {
        const { _workflowError: _, ...rest } = d
        return { ...n, data: rest }
      }
      return n
    })
    set({
      nodes: clearedNodes,
      workflowProgress: {
        running: true, total: runnable.length, completed: 0, succeeded: 0, failed: 0,
        currentId: '', currentLabel: '', error: '', failedNodes: [], done: false,
      },
    })

    let succeeded = 0
    let failed = 0
    const failedNodes: FailedNode[] = []

    for (const nodeId of runnable) {
      if (stopFlag) break

      const node = get().nodes.find(n => n.id === nodeId)
      const label = node?.type ?? nodeId

      set({
        workflowProgress: {
          running: true, total: runnable.length,
          completed: succeeded + failed, succeeded, failed,
          currentId: nodeId, currentLabel: label, error: '', failedNodes, done: false,
        },
      })

      try {
        await runWithRetry(nodeId)
        succeeded++
        get().updateNodeData(nodeId, { _workflowError: undefined })
      } catch (e: any) {
        failed++
        failedNodes.push({ id: nodeId, label, error: e.message })
        get().updateNodeData(nodeId, { _workflowError: e.message })
      }

      await new Promise(r => setTimeout(r, 100))
    }

    const stopped = stopFlag
    set({
      workflowProgress: {
        running: false, total: runnable.length,
        completed: succeeded + failed, succeeded, failed,
        currentId: '', currentLabel: '',
        error: stopped ? 'Stopped' : '',
        failedNodes,
        done: !stopped,
      },
    })
  },

  retryFromNode: async (fromNodeId: string) => {
    const { nodes, edges } = get()
    stopFlag = false

    const downstream = getDownstreamNodes(fromNodeId, nodes, edges)
    const order = topoSort(nodes, edges).filter(id => downstream.has(id) && hasRunner(id))

    const prev = get().workflowProgress
    const remainingFailed = prev.failedNodes.filter(n => !downstream.has(n.id))

    set({
      workflowProgress: {
        running: true, total: order.length,
        completed: 0, succeeded: 0, failed: remainingFailed.length,
        currentId: '', currentLabel: '', error: '',
        failedNodes: remainingFailed, done: false,
      },
    })

    // Clear errors on retried nodes
    for (const nodeId of downstream) {
      get().updateNodeData(nodeId, { _workflowError: undefined })
    }

    let succeeded = 0
    let failed = remainingFailed.length
    const failedNodes = [...remainingFailed]

    for (const nodeId of order) {
      if (stopFlag) break

      const node = get().nodes.find(n => n.id === nodeId)
      const label = node?.type ?? nodeId

      set({
        workflowProgress: {
          running: true, total: order.length,
          completed: succeeded + (failed - remainingFailed.length), succeeded, failed,
          currentId: nodeId, currentLabel: label, error: '', failedNodes, done: false,
        },
      })

      try {
        await runWithRetry(nodeId)
        succeeded++
      } catch (e: any) {
        failed++
        failedNodes.push({ id: nodeId, label, error: e.message })
        get().updateNodeData(nodeId, { _workflowError: e.message })
      }

      await new Promise(r => setTimeout(r, 100))
    }

    set({
      workflowProgress: {
        running: false, total: order.length,
        completed: succeeded + failed,
        succeeded: prev.succeeded + succeeded,
        failed,
        currentId: '', currentLabel: '',
        error: stopFlag ? 'Stopped' : '',
        failedNodes,
        done: !stopFlag,
      },
    })
  },
}))
