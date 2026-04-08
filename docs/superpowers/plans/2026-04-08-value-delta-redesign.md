# Value Delta Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the single `card__value-delta` pill with stacking circles (green for value bonuses, red for penalties) and a separate score delta pill below.

**Architecture:** Three new CSS classes replace `card__value-delta`. `updateStatsCluster` is rewritten to iterate over `valueBonuses[]` and `valuePenalties[]` arrays. A new `updateScoreDelta` function handles the score pill. All call sites in `main.js` migrate from `supportBonus: N` to `valueBonuses: [N]`.

**Tech Stack:** Vanilla JS (ES modules), CSS (oklch colors), no build step — open `index.html` in browser to verify.

---

### Task 1: Replace CSS — remove old pill, add stacking circle classes

**Files:**
- Modify: `css/style.css` (around line 519 — `.card__value-delta` block)

- [ ] **Step 1: Remove `.card__value-delta` and add the three new classes**

In `css/style.css`, replace the `.card__value-delta` block (lines ~519–534):

```css
/* Remove this entire block: */
.card__value-delta {
  display: inline-flex;
  ...
}
```

Replace with:

```css
.card__value-bonus,
.card__value-penalty {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: 'Barlow Condensed', sans-serif;
  font-weight: 700;
  font-size: 8px;
  letter-spacing: 0.03em;
  margin-top: -9px;
}

.card__value-bonus {
  background: oklch(88% 0.10 152 / 0.97);
  border: 1.5px solid oklch(58% 0.14 152 / 0.45);
  color: oklch(22% 0.14 152);
}

.card__value-penalty {
  background: oklch(88% 0.10 28 / 0.97);
  border: 1.5px solid oklch(58% 0.14 28 / 0.45);
  color: oklch(24% 0.14 22);
}

.card__score-delta {
  font-family: 'Barlow Condensed', sans-serif;
  font-weight: 700;
  font-size: 7.5px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  padding: 2px 6px;
  border-radius: 3px;
  margin-top: 6px;
}

.card__score-delta--pos {
  background: oklch(32% 0.10 152 / 0.85);
  color: oklch(84% 0.12 152);
}

.card__score-delta--neg {
  background: oklch(32% 0.10 22 / 0.85);
  color: oklch(86% 0.10 28);
}
```

- [ ] **Step 2: Add z-index stacking to `.card__stats-cluster` children**

The `.card__stats` (main value circle) needs `position: relative; z-index: 3` so circles stack under it. Add to `css/style.css` in the `.card__stats` block (around line 474):

```css
.card__stats {
  /* existing properties... */
  position: relative;
  z-index: 3;
}
```

Also add a stacking rule for the bonus/penalty circles — each one needs decreasing z-index. Since we can't do this in CSS alone without nth-child magic, we'll set it inline from JS (Task 2). For now just ensure the base `position` is set on the circles:

```css
.card__value-bonus,
.card__value-penalty {
  /* add to existing block above */
  position: relative;
}
```

- [ ] **Step 3: Commit**

```bash
git add css/style.css
git commit -m "style: replace value-delta pill with stacking circle classes"
```

---

### Task 2: Rewrite `updateStatsCluster` in card-renderer.js

**Files:**
- Modify: `js/card-renderer.js` (lines 145–164)

- [ ] **Step 1: Rewrite `updateStatsCluster` to use arrays**

Replace the entire `updateStatsCluster` function (lines 145–164) with:

```js
function updateStatsCluster(cardEl, valueBonuses, valuePenalties) {
  const cluster = cardEl.querySelector('.card__stats-cluster')
  if (!cluster) return

  // Remove existing bonus/penalty circles
  cluster.querySelectorAll('.card__value-bonus, .card__value-penalty').forEach(el => el.remove())

  let zIndex = 2
  const allDeltas = [
    ...valueBonuses.map(amount => ({ amount, cls: 'card__value-bonus' })),
    ...valuePenalties.map(amount => ({ amount, cls: 'card__value-penalty' })),
  ]

  allDeltas.forEach(({ amount, cls }) => {
    const circle = document.createElement('div')
    circle.className = cls
    circle.textContent = cls === 'card__value-bonus' ? `+${amount}` : `−${amount}`
    circle.style.zIndex = zIndex--
    cluster.appendChild(circle)
  })
}
```

- [ ] **Step 2: Add `updateScoreDelta` function**

Add this new function directly after `updateStatsCluster`:

```js
function updateScoreDelta(cardEl, scoreDelta) {
  const cluster = cardEl.querySelector('.card__stats-cluster')
  if (!cluster) return

  const existing = cluster.querySelector('.card__score-delta')
  existing?.remove()

  if (scoreDelta === null || scoreDelta === undefined) return

  const pill = document.createElement('div')
  pill.className = scoreDelta >= 0
    ? 'card__score-delta card__score-delta--pos'
    : 'card__score-delta card__score-delta--neg'
  pill.textContent = scoreDelta >= 0 ? `+${scoreDelta}` : `${scoreDelta}`
  cluster.appendChild(pill)
}
```

- [ ] **Step 3: Commit**

```bash
git add js/card-renderer.js
git commit -m "feat: rewrite updateStatsCluster to use bonus/penalty arrays, add updateScoreDelta"
```

---

### Task 3: Update `updateCardPresentation` signature in card-renderer.js

**Files:**
- Modify: `js/card-renderer.js` (lines 207–234)

- [ ] **Step 1: Update context extraction and calls**

Replace the `updateCardPresentation` function body to extract `valueBonuses`, `valuePenalties`, `scoreDelta` instead of `supportBonus`:

```js
export function updateCardPresentation(cardEl, card, context = null) {
  let normalizedContext = {
    combatProjection: null,
    previousValue: null,
    valueBonuses: [],
    valuePenalties: [],
    scoreDelta: null,
  }

  if (
    context &&
    ('combatProjection' in context || 'valueBonuses' in context || 'effectiveRange' in context || 'previousValue' in context || 'scoreDelta' in context)
  ) {
    normalizedContext = { ...normalizedContext, ...context }
  } else if (context && ('label' in context || 'rps' in context)) {
    normalizedContext = { ...normalizedContext, combatProjection: context }
  }

  const combatProjection = normalizedContext.combatProjection ?? null
  const valueBonuses = normalizedContext.valueBonuses ?? []
  const valuePenalties = normalizedContext.valuePenalties ?? []
  const scoreDelta = normalizedContext.scoreDelta ?? null
  const effectiveRange = normalizedContext.effectiveRange ?? combatProjection?.effectiveRange ?? (card.value + valueBonuses.reduce((a, b) => a + b, 0))
  const previousValue = normalizedContext.previousValue ?? null

  const valueEl = cardEl.querySelector('.card__value')
  if (valueEl) valueEl.textContent = `${card.value}`

  updateStatsCluster(cardEl, valueBonuses, valuePenalties)
  updateScoreDelta(cardEl, scoreDelta)
  updatePreviousValueBadge(cardEl, previousValue)

  const oldTooltip = cardEl.querySelector('.card__tooltip')
  const newTooltip = createCardTooltip(card, valueBonuses.reduce((a, b) => a + b, 0), effectiveRange, combatProjection)
  if (oldTooltip) {
    oldTooltip.replaceWith(newTooltip)
  } else {
    cardEl.appendChild(newTooltip)
  }

  updateCombatBadge(cardEl, combatProjection)
}
```

Note: `createCardTooltip` still receives a single summed bonus value for its tooltip text — that's fine, it's just display text inside the tooltip.

- [ ] **Step 2: Remove the old `valueEl.textContent` line from `updateStatsCluster`**

The value update (`valueEl.textContent`) was previously in `updateStatsCluster`. It's now moved into `updateCardPresentation` directly (step above). Confirm `updateStatsCluster` no longer touches `.card__value` — it only handles the circle elements.

- [ ] **Step 3: Commit**

```bash
git add js/card-renderer.js
git commit -m "feat: update updateCardPresentation to use valueBonuses/valuePenalties/scoreDelta API"
```

---

### Task 4: Update call sites in main.js

**Files:**
- Modify: `js/main.js` (lines ~80, ~99, ~211–215, ~651)

- [ ] **Step 1: Update `getRpsProjection` — two locations (~lines 75–101)**

Change both return objects in `getRpsProjection`:

```js
// Around line 75–82 (enemy branch):
return {
  label: preview.label,
  rps: preview.rps,
  self: preview.player,
  opponent: preview.enemy,
  valueBonuses: preview.player.supportBonus > 0 ? [preview.player.supportBonus] : [],
  effectiveRange: preview.player.range,
}

// Around line 94–101 (player branch):
return {
  label: preview.label,
  rps: preview.rps,
  self: preview.player,
  opponent: preview.enemy,
  valueBonuses: preview.player.supportBonus > 0 ? [preview.player.supportBonus] : [],
  effectiveRange: preview.player.range,
}
```

- [ ] **Step 2: Update the `updateCardPresentation` call site (~lines 211–215)**

```js
updateCardPresentation(cardEl, card, {
  combatProjection,
  valueBonuses: combatProjection?.valueBonuses ?? [],
  effectiveRange: combatProjection?.effectiveRange ?? card.value,
})
```

- [ ] **Step 3: Verify the resolution call site (~line 651)**

The call at line 651 already passes `{ previousValue: sideResult.valueBefore }` — no `supportBonus`. With the new `normalizedContext` defaults (`valueBonuses: []`), this will continue to work correctly. No change needed.

- [ ] **Step 4: Commit**

```bash
git add js/main.js
git commit -m "feat: migrate supportBonus call sites to valueBonuses array API"
```

---

### Task 5: Visual verification

**Files:** None — open the browser.

- [ ] **Step 1: Open `index.html` in browser and verify the base state**

Cards without any support bonus should show only the main value circle — no extra circles, no pills below.

- [ ] **Step 2: Trigger a combat preview with support bonus**

Place a support card adjacent to a player card and hover/enter combat. The card with support bonus should show one green circle below the main value circle, overlapping it slightly from below.

- [ ] **Step 3: Verify z-index layering**

The green circle should appear *behind* the main value circle (tucked under it), not on top.

- [ ] **Step 4: Verify tooltip still works**

Hover the card to show tooltip — it should still mention the support bonus in the tooltip text (summed value).

- [ ] **Step 5: Verify resolution state**

After combat resolves, the card in `card--resolving` state should show `previousValue` badge as before, with no leftover bonus circles.

- [ ] **Step 6: Commit if any fixes were needed**

```bash
git add -p
git commit -m "fix: visual verification corrections"
```
