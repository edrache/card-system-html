# RPS Tracker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a vertical bar chart panel showing the proportion of each card approach type (Pressure/Appeal/Positioning) played during the current encounter, with ghost markers for pre-resolve projection.

**Architecture:** New `js/rps-tracker.js` module owns state and DOM. CSS in `style.css`. Integration via function calls at existing hook points in `main.js`. No HTML changes — DOM created by JS.

**Tech Stack:** Vanilla JS (ES modules), CSS transitions for animation

**Spec:** `docs/superpowers/specs/2026-04-12-rps-tracker-design.md`

---

### File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `js/rps-tracker.js` | Create | State management, DOM creation, render logic |
| `css/style.css` | Modify (append) | RPS tracker panel styles |
| `js/main.js` | Modify (add imports + hook calls) | Wire tracker into game flow |
| `tests/game-logic-smoke.mjs` | Modify (append) | Unit tests for tracker state logic |

---

### Task 1: Core State Logic (`rps-tracker.js` — pure functions, no DOM)

**Files:**
- Create: `js/rps-tracker.js`
- Test: `tests/game-logic-smoke.mjs`

- [ ] **Step 1: Write failing tests for tracker state logic**

Append to `tests/game-logic-smoke.mjs`:

```javascript
// ── RPS Tracker ─────────────────────────────────────────────

import {
  getTrackerState,
  projectCard,
  clearProjection,
  resolveCard,
  resetTracker,
} from '../js/rps-tracker.js'

// Reset before tracker tests
resetTracker()

// Test: initial state is all zeros
{
  const s = getTrackerState()
  assert.deepStrictEqual(s.resolved, { pressure: 0, appeal: 0, positioning: 0 })
  assert.deepStrictEqual(s.projected, { pressure: 0, appeal: 0, positioning: 0 })
  console.log('  ✔ tracker: initial state is all zeros')
}

// Test: projectCard increments projected
{
  resetTracker()
  projectCard('pressure')
  projectCard('pressure')
  projectCard('appeal')
  const s = getTrackerState()
  assert.deepStrictEqual(s.projected, { pressure: 2, appeal: 1, positioning: 0 })
  assert.deepStrictEqual(s.resolved, { pressure: 0, appeal: 0, positioning: 0 })
  console.log('  ✔ tracker: projectCard increments projected counts')
}

// Test: clearProjection zeros projected, keeps resolved
{
  resetTracker()
  resolveCard('positioning')
  projectCard('appeal')
  clearProjection()
  const s = getTrackerState()
  assert.deepStrictEqual(s.projected, { pressure: 0, appeal: 0, positioning: 0 })
  assert.deepStrictEqual(s.resolved, { pressure: 0, appeal: 0, positioning: 1 })
  console.log('  ✔ tracker: clearProjection zeros projected, keeps resolved')
}

// Test: resolveCard moves from projected to resolved
{
  resetTracker()
  projectCard('pressure')
  projectCard('appeal')
  resolveCard('pressure')
  const s = getTrackerState()
  assert.equal(s.resolved.pressure, 1)
  assert.equal(s.projected.pressure, 0)
  assert.equal(s.projected.appeal, 1)
  console.log('  ✔ tracker: resolveCard moves projected to resolved')
}

// Test: resetTracker clears everything
{
  resetTracker()
  projectCard('pressure')
  resolveCard('pressure')
  projectCard('appeal')
  resetTracker()
  const s = getTrackerState()
  assert.deepStrictEqual(s.resolved, { pressure: 0, appeal: 0, positioning: 0 })
  assert.deepStrictEqual(s.projected, { pressure: 0, appeal: 0, positioning: 0 })
  console.log('  ✔ tracker: resetTracker clears everything')
}

// Test: percentage calculation — proportional
{
  resetTracker()
  resolveCard('pressure')
  resolveCard('pressure')
  resolveCard('appeal')
  const s = getTrackerState()
  // total resolved = 3, pressure = 2/3 ≈ 66.7%, appeal = 1/3 ≈ 33.3%
  assert.equal(s.resolvedTotal, 3)
  console.log('  ✔ tracker: resolvedTotal is correct')
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node tests/game-logic-smoke.mjs`
Expected: FAIL — cannot find module `../js/rps-tracker.js`

- [ ] **Step 3: Implement state logic in `rps-tracker.js`**

Create `js/rps-tracker.js` with only state logic (no DOM yet):

```javascript
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node tests/game-logic-smoke.mjs`
Expected: All tracker tests PASS

- [ ] **Step 5: Commit**

```bash
git add js/rps-tracker.js tests/game-logic-smoke.mjs
git commit -m "feat: add rps-tracker state logic with tests"
```

---

### Task 2: CSS Styles for RPS Tracker Panel

**Files:**
- Modify: `css/style.css` (append before the final `/* ── Global ──` section)

- [ ] **Step 1: Add RPS tracker styles to `style.css`**

Insert before the `/* ── Global ──` line (line 1374) in `css/style.css`:

```css
/* ── RPS Tracker panel ─────────────────────────────────────── */

.rps-tracker {
  position: absolute;
  right: 16px;
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  gap: 12px;
  align-items: flex-end;
  padding: 16px 12px 12px;
  background: oklch(10% 0.02 152 / 0.5);
  border: 1px solid oklch(66% 0.08 85 / 0.15);
  border-radius: 8px;
  z-index: 10;
  pointer-events: none;
}

.rps-tracker__title {
  position: absolute;
  top: -16px;
  left: 50%;
  transform: translateX(-50%);
  font-family: 'IM Fell English SC', serif;
  font-size: 0.5rem;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: oklch(66% 0.08 85 / 0.45);
  white-space: nowrap;
}

.rps-bar {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  width: 28px;
}

.rps-bar__pct {
  font-family: 'Barlow Condensed', sans-serif;
  font-size: 0.65rem;
  font-weight: 600;
  color: oklch(80% 0.03 265 / 0.7);
  min-height: 1em;
}

.rps-bar__track {
  width: 10px;
  height: 140px;
  background: oklch(20% 0.02 152 / 0.6);
  border-radius: 5px;
  position: relative;
}

.rps-bar__fill {
  position: absolute;
  bottom: 0;
  width: 100%;
  border-radius: 5px;
  height: 0;
  transition: height 0.4s ease;
}

.rps-bar__ghost {
  position: absolute;
  bottom: 0;
  width: 100%;
  border-radius: 5px;
  height: 0;
  box-sizing: border-box;
  transition: height 0.4s ease;
  display: none;
}

.rps-bar__ghost--visible {
  display: block;
}

.rps-bar__icon {
  font-size: 14px;
  user-select: none;
  line-height: 1;
}

/* ── RPS bar colors ── */

.rps-bar--pressure .rps-bar__fill  { background: oklch(45% 0.15 25); }
.rps-bar--pressure .rps-bar__ghost { border: 2px dashed oklch(45% 0.15 25 / 0.5); }

.rps-bar--appeal .rps-bar__fill    { background: oklch(60% 0.13 95); }
.rps-bar--appeal .rps-bar__ghost   { border: 2px dashed oklch(60% 0.13 95 / 0.5); }

.rps-bar--positioning .rps-bar__fill  { background: oklch(45% 0.12 240); }
.rps-bar--positioning .rps-bar__ghost { border: 2px dashed oklch(45% 0.12 240 / 0.5); }
```

- [ ] **Step 2: Commit**

```bash
git add css/style.css
git commit -m "feat: add RPS tracker panel CSS styles"
```

---

### Task 3: DOM Creation and Rendering (`rps-tracker.js` — DOM layer)

**Files:**
- Modify: `js/rps-tracker.js`

- [ ] **Step 1: Add DOM creation and render function to `rps-tracker.js`**

Add the following to `js/rps-tracker.js`, after the existing state logic:

```javascript
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
```

- [ ] **Step 2: Add `render()` calls to each public mutating function**

Update the existing functions in `rps-tracker.js` to call `render()` after state changes. Replace these functions:

```javascript
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
```

- [ ] **Step 3: Run existing tests to verify they still pass**

Run: `node tests/game-logic-smoke.mjs`
Expected: All PASS — `render()` is a no-op when `barEls` is null (no DOM in Node)

- [ ] **Step 4: Commit**

```bash
git add js/rps-tracker.js
git commit -m "feat: add RPS tracker DOM creation and render logic"
```

---

### Task 4: Integrate Tracker into Game Flow (`main.js`)

**Files:**
- Modify: `js/main.js` (lines 1-27 imports, lines 310-321 placeCard/unplaceCard, lines 812-822 claimReward, lines 916-921 resolveCombatStep, lines 1044 initRun)

- [ ] **Step 1: Add import to `main.js`**

Add after the existing imports (after line 27 in `main.js`):

```javascript
import {
  initRpsTracker,
  projectCard,
  clearProjection,
  resolveCard,
  resetTracker,
} from './rps-tracker.js'
```

- [ ] **Step 2: Call `initRpsTracker()` at game init**

In the `init()` function, after `initRun()` (line 1044), add:

```javascript
  initRpsTracker()
```

- [ ] **Step 3: Wire `projectCard` into `onSnap` callback**

In the `onSnap` callback (around line 310), after `placeCard(cardEl.dataset.id, slotIndex)`, add:

```javascript
        const placedCard = findPlayerCardById(cardEl.dataset.id)
        if (placedCard) projectCard(placedCard.rps)
```

Note: `findPlayerCardById` is already called a few lines later as `const card = findPlayerCardById(cardEl.dataset.id)` — reuse the variable name if you refactor, but the simplest change is to add the call before the existing code. Alternatively, use the existing `card` variable by moving `projectCard` after line 313:

```javascript
      onSnap(slotEl, cardEl) {
        const slotIndex = slotIdToIndex(slotEl.dataset.id)
        placeCard(cardEl.dataset.id, slotIndex)
        refreshVisibleCards()
        syncResolveButton()
        const card = findPlayerCardById(cardEl.dataset.id)
        if (card) projectCard(card.rps)
        showSlotFlavor(slotEl, card?.flavor ?? null)
      },
```

- [ ] **Step 4: Wire `clearProjection` into `onUnsnap` callback**

In the `onUnsnap` callback (around line 316), after `unplaceCard(slotIndex)`, add projection recalculation. Replace the entire `onUnsnap`:

```javascript
      onUnsnap(slotEl, cardEl) {
        const slotIndex = slotIdToIndex(slotEl.dataset.id)
        unplaceCard(slotIndex)
        clearProjection()
        refreshVisibleCards()
        syncResolveButton()
        hideSlotFlavor(slotEl)
      },
```

- [ ] **Step 5: Wire `resolveCard` into combat step resolution**

In `continueCombatFlow()` (around line 917), after `const result = resolveCombatStep(step.slot)`, add:

```javascript
  const playerCard = gameState.playerBoard[step.slot]
  if (playerCard) resolveCard(playerCard.rps)
```

This requires importing `gameState` — but it's already imported on line 8. The full block becomes:

```javascript
  const result = resolveCombatStep(step.slot)
  const trackedCard = gameState.playerBoard[step.slot]
  if (trackedCard) resolveCard(trackedCard.rps)
  combatFlowState.log.push(result)
```

Note: use `trackedCard` to avoid naming collision with the `playerCard` in `playCombatStep`.

- [ ] **Step 6: Wire `resetTracker` into new encounter**

In the `claimReward` click handler (around line 812), after `const reward = claimReward(card.id)`, add:

```javascript
      resetTracker()
```

So it becomes:

```javascript
    choiceButton.addEventListener('click', () => {
      const reward = claimReward(card.id)
      if (!reward) return
      resetTracker()

      hideOverlay()
      drawCards()
      ...
```

- [ ] **Step 7: Run tests to verify nothing is broken**

Run: `node tests/game-logic-smoke.mjs`
Expected: All PASS

- [ ] **Step 8: Commit**

```bash
git add js/main.js
git commit -m "feat: integrate RPS tracker into game flow"
```

---

### Task 5: Manual Smoke Test

- [ ] **Step 1: Start the game server and test in browser**

Run: `python3 -m http.server 8000` (or however the project is served)

Open `http://localhost:8000` in browser.

**Verify these scenarios:**

1. **Panel visible** — RPS tracker panel appears on right side of board with 3 vertical bars (🔥 ✨ 🎯) and "Approach" title
2. **Initial state** — all bars empty, all showing "0"
3. **Place one card** — ghost marker (dashed) appears on the bar matching the card's type, percentage updates
4. **Place two cards same type** — ghost for that type grows proportionally
5. **Place three cards, different types** — ghosts show correct proportions (e.g., 2 pressure + 1 appeal = 67%/33%/0%)
6. **Remove a card from slot** — ghost disappears entirely (returns to resolved-only view)
7. **Click Resolve** — after each slot resolves, fill (solid bar) grows step by step, ghost disappears
8. **Round 2** — place new cards, ghosts show projected proportions including resolved cards from round 1
9. **Win encounter, claim reward** — tracker resets to all zeros

- [ ] **Step 2: Commit any fixes if needed**

```bash
git add -A
git commit -m "fix: address issues found during RPS tracker smoke test"
```

(Skip this commit if no fixes were needed.)
