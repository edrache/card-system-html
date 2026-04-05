# Tutorial Page — Design Spec

**Date:** 2026-04-05
**Status:** Approved

---

## Overview

A standalone `tutorial.html` page that teaches all game mechanics from scratch via a strictly-guided, step-by-step interactive experience. The tutorial reuses existing game logic (`game.js`, `combat.js`, `buffs.js`, `cards-data.js`, `config/*`) and adds a thin engine layer that controls what the player can interact with at each step.

All tutorial UI copy is written in **English**.

---

## File Structure

```
tutorial.html              — standalone page, own layout
js/tutorial.js             — step engine + all step definitions (TUTORIAL_STEPS array)
css/tutorial.css           — tooltip styles, highlight ring, progress bar, chapter banner
```

No changes to any existing files.

---

## Architecture

### Step Engine (`tutorial.js`)

A linear array of step objects drives the entire tutorial:

```js
const TUTORIAL_STEPS = [
  { id: 'welcome', ... },
  { id: 'card-anatomy', ... },
  // ...20 steps total
]
```

**Step object fields:**

| Field       | Type                  | Description |
|-------------|-----------------------|-------------|
| `id`        | string                | Unique step identifier |
| `chapter`   | 1–4                   | Used to show chapter banner on chapter start |
| `tooltip`   | `{ text, anchor }`    | Text shown in the tooltip; `anchor` is a CSS selector or `'center'` |
| `highlight` | string \| null        | CSS selector of the element to highlight (ring effect); null = none |
| `lock`      | `'all'` \| string[]   | Elements disabled during this step. `'all'` = everything except highlighted |
| `advance`   | AdvanceCondition      | When to allow moving to the next step (see below) |
| `setup`     | function \| null      | Called before the step renders — sets up game state, card positions, enemy board |

**AdvanceCondition values:**

- `'click'` — player clicks the "Next" button in the tooltip
- `'cardPlaced'` — any card is placed in a slot
- `'allPlaced'` — all 3 player slots are filled
- `'resolved'` — player clicks the Resolve button and combat runs

**Engine functions:**

- `initTutorial()` — sets up the board, binds event listeners, starts step 0
- `applyStep(step)` — applies highlight, lock, tooltip, calls `step.setup()`
- `nextStep()` — checks advance condition, increments step index, calls `applyStep`
- `showChapterBanner(chapter)` — briefly shows chapter title overlay before first step of each chapter

**Progress bar:** fixed at the top of the screen — "Step N / 20".

---

## Tutorial Sequence

### Chapter 1 — The Board and Cards (Steps 1–4)

| # | ID | Tooltip text | Highlight | Advance |
|---|----|-------------|-----------|---------|
| 1 | `welcome` | "Welcome. This is the board. Your side is at the bottom, the enemy is at the top." | Both board zones | `'click'` |
| 2 | `card-anatomy` | Sequential dymki pointing to: value, HP, role (Attack), RPS symbol (✊) on one player card | One player card | `'click'` |
| 3 | `rps-intro` | "Rock beats Scissors. Scissors beats Paper. Paper beats Rock. RPS win = +3 damage, loss = −3 damage." Enemy card (✌️) is revealed. | RPS table + enemy card | `'click'` |
| 4 | `first-drag` | "Drag the card to the slot." | Single card + single slot | `'cardPlaced'` |

### Chapter 2 — Phases and Basic Combat (Steps 5–9)

| # | ID | Tooltip text | Highlight | Advance |
|---|----|-------------|-----------|---------|
| 5 | `phases` | "Each turn has three phases: Draw → Place → Combat. Then repeat." | HUD phase indicator | `'click'` |
| 6 | `draw-phase` | "At the start of each round you draw cards until you have 3." | Hand area | `'click'` |
| 7 | `placement` | "Place all your cards in the slots." | All hand cards + all slots | `'allPlaced'` |
| 8 | `resolve-btn` | "All slots filled. Click Resolve to fight." | Resolve button | `'resolved'` |
| 9 | `combat-result` | "Each slot fights its opposite slot simultaneously. Damage = attacker value − defender reduction." | Combat log / card HP labels | `'click'` |

### Chapter 3 — Modifiers (Steps 10–15)

| # | ID | Tooltip text | Highlight | Advance |
|---|----|-------------|-----------|---------|
| 10 | `attack-role` | "Attack role cards deal +2 bonus damage." Prepared scene: Aggressor vs Defender. | Player attack card | `'click'` |
| 11 | `defense-role` | "Defense role cards block half their value in incoming damage." | Enemy/player defense card | `'click'` |
| 12 | `first-card-bonus` | "The first card you place gets a bonus based on RPS vs the enemy in that slot: win +3, tie +1, loss +0." Player places first card, bonus highlights on HP. | First placed card | `'cardPlaced'` |
| 13 | `support-placement` | "Support cards give +1 to adjacent allies when placed on the board." Buffer placed between two cards. | Buffer card + neighbours | `'click'` |
| 14 | `support-survive` | "If a support card survives combat, it gives another +1 to surviving neighbours." Post-combat scene. | Buffer card + neighbours | `'click'` |
| 15 | `resolution-order` | "Slots are resolved strongest-enemy-first. A stronger enemy fights before a weaker one." Slot numbers highlighted in order. | Slot order indicators | `'click'` |

### Chapter 4 — Advanced (Steps 16–20)

| # | ID | Tooltip text | Highlight | Advance |
|---|----|-------------|-----------|---------|
| 16 | `buff-cap` | "Buffs stack, but a card can never have more than 3." Card with 3 buffs shown. | Buff counter on card | `'click'` |
| 17a | `effect-glass-cannon` | "Glass Cannon: takes +1 extra damage when hit." | Glass Cannon card | `'click'` |
| 17b | `effect-opportunist` | "Opportunist: deals +2 bonus damage when it wins the RPS matchup." | Opportunist card | `'click'` |
| 17c | `effect-shield` | "Shield: blocks +1 extra damage on top of the standard defense reduction." | Shield card | `'click'` |
| 17d | `effect-reactive-guard` | "Reactive Guard: blocks +2 extra damage when it loses the RPS matchup." | Reactive Guard card | `'click'` |
| 17e | `effect-fragile-buffer` | "Fragile Buffer: gives +2 to adjacent allies instead of the usual +1." | Fragile Buffer card | `'click'` |
| 17f | `effect-persistent-buffer` | "Persistent Buffer: its placement buff persists into the next round." | Persistent Buffer card | `'click'` |
| 18 | `round-loop` | "Surviving cards return to your hand. The enemy refills their board." Animation of cards moving. | Both boards | `'click'` |
| 19 | `end-condition` | "You lose when you run out of cards. You win when the enemy runs out of cards." | Deck indicators | `'click'` |
| 20 | `ready` | "You're ready. Good luck." Button: "Start Playing" → `index.html`. | Start button | — |

---

## Visual Design

- **Tooltip:** floating card-shaped panel, positioned via `anchor`. Arrow points to highlighted element. White background, same font as game.
- **Highlight ring:** CSS `outline` + pulsing `box-shadow` animation on the highlighted element. All other elements have `pointer-events: none` and `opacity: 0.4`.
- **Progress bar:** thin bar at the very top, fills left-to-right as steps advance. "Step N / 20" label beside it.
- **Chapter banner:** full-width overlay that fades in/out for ~1.5s at the start of each chapter (e.g. "Chapter 1 — The Board and Cards").
- **"Next" button:** inside tooltip, bottom-right. Only visible when `advance === 'click'`.
- Reuses existing `css/style.css` for the board; `tutorial.css` adds only the tutorial chrome.

---

## Out of Scope

- Sound effects
- Ability to go back to previous steps
- Tutorial progress saved across sessions
- Mobile/touch optimization (separate task)
