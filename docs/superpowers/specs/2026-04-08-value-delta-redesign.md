# Value Delta Redesign

**Date:** 2026-04-08

## Overview

Redesign the card value change indicators from a single generic pill (`card__value-delta`) into three distinct visual types: positive value circles, negative value circles, and a score delta indicator.

## Current State

- `.card__value-delta` — a single green pill showing `R+N` (support bonus to roll range)
- `supportBonus` — a number passed to `updateCardPresentation`, rendered as one pill

## New Visual Design

Three indicator types, all attached to the stats cluster (top-right of card):

### 1. Value bonus circles (green)
Circular badges that stack below the main value circle, each slightly overlapping the one above. Represent positive modifiers to the card's value (e.g., support bonus from adjacent allies, future positive mechanics). Each source is a separate circle.

- Size: ~24×24px (smaller than main value circle at ~32px)
- Color: green (`oklch(88% 0.10 152)` background, dark green text)
- Overlap: `margin-top: -9px` so each circle tucks under the one above
- z-index decreasing downward (main value = highest, each circle lower)

### 2. Value penalty circles (red)
Same stacking mechanics as bonus circles but red. Represent negative modifiers (obstacle cards, debuffs — not yet implemented in game logic, placeholders for future mechanics). Rendered after bonus circles in the stack.

- Color: red (`oklch(88% 0.10 28)` background, dark red text)

### 3. Score delta pill (below everything)
A small rectangular pill that appears below the entire circle stack. Represents the final combat score change (e.g., Attack role adds +1 after rolling). Visually separated from the circles — not overlapping.

- Styled as a small label: `ATK +1`, `−1`, etc.
- Only shown when `scoreDelta` is non-null

## Data API

Replace `supportBonus: number` with three new fields in the context object passed to `updateCardPresentation`:

```js
updateCardPresentation(cardEl, card, {
  valueBonuses:   number[],   // green circles — one entry per bonus source
  valuePenalties: number[],   // red circles — one entry per penalty source
  scoreDelta:     number | null,  // score pill — null hides it
  effectiveRange: number,
  previousValue:  number | null,
  combatProjection: object | null,
})
```

**Migration:** All call sites that currently pass `supportBonus: N` change to `valueBonuses: [N]` (single circle). When multiple bonus sources exist, callers pass `[1, 1]` etc.

## Affected Files

- `css/style.css` — remove `.card__value-delta`, add `.card__value-bonus`, `.card__value-penalty`, `.card__score-delta`
- `js/card-renderer.js` — rewrite `updateStatsCluster`, add `updateScoreDelta`, update `updateCardPresentation` signature
- `js/main.js` — update all call sites from `supportBonus` to `valueBonuses`

## Out of Scope

- Game logic changes (what triggers bonuses/penalties)
- Tooltip changes
- Actual implementation of `valuePenalties` sources — circles will render if data is provided, but no game mechanic produces penalties yet
