/**
 * Lightweight API call tracker for cost estimation.
 * Image gen nodes call trackApiCall() when they complete.
 * ApprovalGateNode reads the state to show estimated cost.
 */
let _calls = 0
let _estimatedCentsCost = 0

// Approximate cost in cents per call
export const API_COSTS: Record<string, number> = {
  nanoBanana: 0.3,
  imagen4: 2.0,
  gptImage: 4.0,
  flux: 0.5,
  kling: 10.0,
  veo: 15.0,
  llm: 0.1,
}

export function trackApiCall(nodeType: string): void {
  _calls++
  _estimatedCentsCost += API_COSTS[nodeType] ?? 0.5
}

export function resetTracker(): void {
  _calls = 0
  _estimatedCentsCost = 0
}

export function getTrackerState(): { calls: number; estimatedCents: number } {
  return { calls: _calls, estimatedCents: _estimatedCentsCost }
}
