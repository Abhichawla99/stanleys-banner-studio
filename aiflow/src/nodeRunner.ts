// Node runner registry — each node registers its async run() function on mount.
// The workflow executor uses this to trigger nodes in topological order.

type RunnerFn = () => Promise<void>

const registry = new Map<string, RunnerFn>()

export function registerNodeRunner(id: string, fn: RunnerFn): void {
  registry.set(id, fn)
}

export function unregisterNodeRunner(id: string): void {
  registry.delete(id)
}

export async function runNode(id: string): Promise<void> {
  const fn = registry.get(id)
  if (fn) await fn()
  // Nodes with no runner (display nodes, notes, seeds) are silently skipped
}

export function hasRunner(id: string): boolean {
  return registry.has(id)
}
