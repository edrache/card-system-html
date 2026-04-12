# RPS Tracker — Approach Slider Panel

## Overview

Add a vertical bar chart panel to the game screen that tracks the proportion of each card approach type (Pressure 🔥, Appeal ✨, Positioning 🎯) played during the current encounter. The panel provides at-a-glance feedback on the player's approach mix across rounds.

## Motivation

Players currently have no visibility into how their card type choices accumulate over an encounter. The tracker gives strategic feedback — helping players notice if they're leaning too heavily on one approach type, which opponents could exploit.

## Design Decisions

| Decision | Choice | Alternatives Considered |
|----------|--------|------------------------|
| Placement | Right side panel (mirroring rules-panel on left) | Under HUD, between card rows |
| Slider orientation | Vertical bars | Horizontal bars |
| Scale | Proportional (relative %) | Fixed range (0-10), cumulative count |
| Initial state | Empty (all 0%) | Equal thirds (33% each), hidden |
| Preview mechanic | Ghost marker (dashed outline at projected position) | Segmented fill, numeric "3→4" |
| Ghost on unplace | Ghost disappears (returns to resolved-only state) | Ghost recalculates |
| Resolve animation | Incremental (updates per slot as each resolves) | Batch (single update after all slots) |
| Implementation | Dedicated `rps-tracker.js` module | Inline in main.js/ui.js, Web Component |

## Architecture

### New file: `js/rps-tracker.js`

Single module responsible for state management and DOM rendering.

**State:**

```javascript
// Internal state — not exposed directly
{
  resolved: { pressure: 0, appeal: 0, positioning: 0 },  // cards resolved so far in encounter
  projected: { pressure: 0, appeal: 0, positioning: 0 },  // cards currently on slots (pre-resolve)
}
```

**Exported API:**

```javascript
// Called once at game init — creates DOM, appends panel to #board
initRpsTracker()

// Called when a card is placed on a slot — adds to projected count
projectCard(rpsType)   // rpsType: 'pressure' | 'appeal' | 'positioning'

// Called when a card is removed from a slot — clears all projections
// (ghost disappears, returns to resolved-only view)
clearProjection()

// Called after each slot resolves during combat — moves one card from projected to resolved
resolveCard(rpsType)

// Called at the start of a new encounter — resets all counters to 0
resetTracker()
```

### DOM Structure

```html
<aside id="rps-tracker" class="rps-tracker">
  <span class="rps-tracker__title">Approach</span>

  <div class="rps-bar rps-bar--pressure">
    <span class="rps-bar__pct">0</span>
    <div class="rps-bar__track">
      <div class="rps-bar__fill"></div>
      <div class="rps-bar__ghost"></div>
    </div>
    <span class="rps-bar__icon">🔥</span>
  </div>

  <div class="rps-bar rps-bar--appeal">
    <span class="rps-bar__pct">0</span>
    <div class="rps-bar__track">
      <div class="rps-bar__fill"></div>
      <div class="rps-bar__ghost"></div>
    </div>
    <span class="rps-bar__icon">✨</span>
  </div>

  <div class="rps-bar rps-bar--positioning">
    <span class="rps-bar__pct">0</span>
    <div class="rps-bar__track">
      <div class="rps-bar__fill"></div>
      <div class="rps-bar__ghost"></div>
    </div>
    <span class="rps-bar__icon">🎯</span>
  </div>
</aside>
```

### CSS (added to `css/style.css`)

Panel positioned with `position: absolute; right: 16px; top: 50%; transform: translateY(-50%)` inside `#board`.

Visual style:
- Semi-transparent dark background matching the board aesthetic (`oklch(10% 0.02 152 / 0.5)`)
- Subtle gold border (`oklch(66% 0.08 85 / 0.15)`) consistent with rules-panel typography
- Title uses `IM Fell English SC` (same as board-emblem, rules-title)
- Bar track: `oklch(20% 0.02 152 / 0.6)`, 10px wide, 140px tall, rounded
- Bar fill colors: Pressure `oklch(45% 0.15 25)`, Appeal `oklch(60% 0.13 95)`, Positioning `oklch(45% 0.12 240)`
- Ghost marker: same color at 50% opacity, `border: 2px dashed`
- Percentage labels: `Barlow Condensed` 600 weight
- Emoji icons below each bar

Transitions: `height 0.4s ease` on both fill and ghost for smooth animation.

### Integration Points in `main.js`

| Hook Location | Call |
|--------------|------|
| `initRun()` | `initRpsTracker()` (first game) or `resetTracker()` (new encounter) |
| `placeCard(cardId, slotIndex)` | `projectCard(card.rps)` |
| `unplaceCard(slotIndex)` | `clearProjection()` then re-project remaining slotted cards |
| Inside `resolveCombatStep()` loop | `resolveCard(playerCard.rps)` after each slot pair resolves |
| `claimReward()` / new encounter start | `resetTracker()` |

### Rendering Logic

The `render()` function (internal, called by all public API methods):

1. Calculate `total resolved` = sum of resolved counts
2. Calculate `total projected` = total resolved + sum of projected counts
3. For each type:
   - `fillHeight` = resolved[type] / totalResolved * 100 (or 0 if totalResolved = 0)
   - `ghostHeight` = (resolved[type] + projected[type]) / totalProjected * 100 (or 0 if totalProjected = 0)
   - If projected counts are all 0: hide ghost markers
   - Percentage label shows the projected value when ghost is visible, otherwise the resolved value
4. Apply heights to DOM elements via inline styles
5. CSS `transition` handles the animation

### Edge Cases

- **No cards resolved yet, cards on slots**: Fill is 0 for all. Ghost shows projected proportions.
- **Ghost lower than fill**: Happens when adding cards of other types dilutes a type's proportion. Ghost renders below fill — this is correct and intentional (shows the type's share will decrease).
- **All 3 cards same type on slots**: That type's ghost = 100%, others = 0%.
- **Unplace triggers full recalculation**: `clearProjection()` zeros all projected, then each remaining slotted card calls `projectCard()` again. If no cards remain on slots, ghost disappears entirely.
- **Support cards count too**: Every card placed counts toward its RPS type regardless of role.

## Files Modified

| File | Change |
|------|--------|
| `js/rps-tracker.js` | New file — state, DOM creation, rendering |
| `js/main.js` | Import and call tracker API at hook points |
| `css/style.css` | New section: RPS tracker panel styles |
| `index.html` | No change needed (DOM created by JS) |

## Out of Scope

- Enemy card tracking (only player cards are tracked)
- Persistent stats across encounters (resets each encounter)
- Clickable/interactive sliders (display only)
- Tutorial mode integration (only `index.html` game)
