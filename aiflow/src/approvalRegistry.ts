/**
 * Approval Gate registry.
 * The node runner awaits `waitForApproval(id)`. Clicking Approve/Reject
 * in the node UI calls `approveGate` / `rejectGate`. `cancelAllGates`
 * is called by the store when the user stops the workflow.
 */
type GateFns = { resolve: () => void; reject: (err: Error) => void }
const pending = new Map<string, GateFns>()

export function waitForApproval(id: string): Promise<void> {
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject })
  })
}

export function approveGate(id: string): void {
  pending.get(id)?.resolve()
  pending.delete(id)
}

export function rejectGate(id: string, msg = 'Rejected by reviewer'): void {
  pending.get(id)?.reject(new Error(msg))
  pending.delete(id)
}

export function cancelAllGates(): void {
  for (const [, fns] of pending) {
    fns.reject(new Error('Workflow stopped'))
  }
  pending.clear()
}

export function hasPendingGate(id: string): boolean {
  return pending.has(id)
}
