// ── RPS Tracker — approach type proportion tracking ─────────

const state = {
  resolved: { pressure: 0, appeal: 0, positioning: 0 },
  projected: { pressure: 0, appeal: 0, positioning: 0 },
}

function makeCounts() {
  return { pressure: 0, appeal: 0, positioning: 0 }
}

export function getTrackerState() {
  const resolvedTotal = state.resolved.pressure + state.resolved.appeal + state.resolved.positioning
  const projectedTotal = state.projected.pressure + state.projected.appeal + state.projected.positioning
  return {
    resolved: { ...state.resolved },
    projected: { ...state.projected },
    resolvedTotal,
    projectedTotal,
  }
}

export function projectCard(rpsType) {
  state.projected[rpsType] += 1
}

export function clearProjection() {
  state.projected = makeCounts()
}

export function resolveCard(rpsType) {
  state.resolved[rpsType] += 1
  if (state.projected[rpsType] > 0) {
    state.projected[rpsType] -= 1
  }
}

export function resetTracker() {
  state.resolved = makeCounts()
  state.projected = makeCounts()
}
