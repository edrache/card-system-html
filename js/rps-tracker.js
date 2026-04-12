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
  render()
}

export function clearProjection() {
  state.projected = makeCounts()
  render()
}

export function resolveCard(rpsType) {
  state.resolved[rpsType] += 1
  if (state.projected[rpsType] > 0) {
    state.projected[rpsType] -= 1
  }
  render()
}

export function resetTracker() {
  state.resolved = makeCounts()
  state.projected = makeCounts()
  render()
}

// ── DOM ─────────────────────────────────────────────────────

const RPS_TYPES = ['pressure', 'appeal', 'positioning']
const RPS_ICONS = { pressure: '🔥', appeal: '✨', positioning: '🎯' }

let barEls = null // { pressure: { pct, fill, ghost }, appeal: {...}, positioning: {...} }

function createBarEl(type) {
  const bar = document.createElement('div')
  bar.className = `rps-bar rps-bar--${type}`

  const pct = document.createElement('span')
  pct.className = 'rps-bar__pct'
  pct.textContent = '0'

  const track = document.createElement('div')
  track.className = 'rps-bar__track'

  const fill = document.createElement('div')
  fill.className = 'rps-bar__fill'

  const ghost = document.createElement('div')
  ghost.className = 'rps-bar__ghost'

  track.appendChild(fill)
  track.appendChild(ghost)

  const icon = document.createElement('span')
  icon.className = 'rps-bar__icon'
  icon.textContent = RPS_ICONS[type]

  bar.appendChild(pct)
  bar.appendChild(track)
  bar.appendChild(icon)

  return { bar, pct, fill, ghost }
}

export function initRpsTracker() {
  resetTracker()

  const existing = document.getElementById('rps-tracker')
  if (existing) existing.remove()

  const panel = document.createElement('aside')
  panel.id = 'rps-tracker'
  panel.className = 'rps-tracker'

  const title = document.createElement('span')
  title.className = 'rps-tracker__title'
  title.textContent = 'Approach'
  panel.appendChild(title)

  barEls = {}
  for (const type of RPS_TYPES) {
    const { bar, pct, fill, ghost } = createBarEl(type)
    barEls[type] = { pct, fill, ghost }
    panel.appendChild(bar)
  }

  document.getElementById('board').appendChild(panel)
  render()
}

function render() {
  if (!barEls) return

  const { resolved, projected, resolvedTotal, projectedTotal } = getTrackerState()
  const total = resolvedTotal + projectedTotal
  const hasProjection = projectedTotal > 0

  for (const type of RPS_TYPES) {
    const els = barEls[type]

    // Fill height: resolved proportion
    const fillPct = resolvedTotal > 0
      ? Math.round((resolved[type] / resolvedTotal) * 100)
      : 0
    els.fill.style.height = fillPct + '%'

    // Ghost height: projected proportion (resolved + projected combined)
    if (hasProjection) {
      const ghostPct = total > 0
        ? Math.round(((resolved[type] + projected[type]) / total) * 100)
        : 0
      els.ghost.style.height = ghostPct + '%'
      els.ghost.classList.add('rps-bar__ghost--visible')
      els.pct.textContent = ghostPct > 0 ? ghostPct + '%' : '0'
    } else {
      els.ghost.style.height = '0'
      els.ghost.classList.remove('rps-bar__ghost--visible')
      els.pct.textContent = fillPct > 0 ? fillPct + '%' : '0'
    }
  }
}
