# Game Prototype — Implementation Plan

**Based on:** Game Design Document v0.1  
**Target:** Rock-Paper-Scissors positioning prototype  
**Codebase baseline:** card-system-html — GSAP drag/drop, slot snapping, config-driven layout

---

## Current System Inventory

| Asset | What it gives us |
|---|---|
| `js/main.js` | Card element factory, slot element factory, hand rendering, basic state object |
| `js/interactions.js` | Draggable cards (GSAP), slot snapping, card-to-card snapping, hover/tilt FX |
| `config/card.config.js` | Card visual constants (size, colors, font, shadow) |
| `config/layout.config.js` | Board color, slot positions (3 slots already defined), snap offset |
| `config/anim.config.js` | All animation timing/easing constants |
| `css/style.css` | Board, card, slot base styles; `.slot--active`, `.slot--occupied`, `.card--snap-target` |

The existing system already solves slot snapping, drag UX, and a 3-slot board.  
The prototype builds game logic on top — the visual layer stays almost unchanged.

---

## Architecture Overview

New files to create (no deletions from existing code):

```
js/
  game.js          — central game state machine (round phases, win check)
  combat.js        — damage calculation, RPS resolution, death check
  enemy.js         — enemy deck, random draw, slot refill
  cards-data.js    — card definitions for all 9 prototype cards
  ui.js            — DOM updates driven by game state (HP labels, highlights, buttons)
config/
  game.config.js   — tunable constants (slot count, RPS modifier, buff cap, etc.)
```

`main.js` becomes the entry point that wires `game.js` to the existing DOM.  
`interactions.js` keeps working as-is; placement confirmation hooks into its `onDragEnd`.

---

## Phase 1 — Core System

**Goal:** Validate combat logic in the browser console (no gameplay UI yet).

### 1.1 Card data structure — `js/cards-data.js`

```js
// Each card object
{
  id: string,         // unique, e.g. 'aggressor-6'
  name: string,
  rps: 'rock' | 'paper' | 'scissors',
  value: number,      // base HP and base damage (1–6)
  role: 'attack' | 'defense' | 'support',
  effect: object | null,   // optional — see section 9 of GDD
  hp: number,         // runtime — starts equal to value, mutated across rounds
  buffs: number,      // runtime — accumulated support buff, capped
}
```

Define all 9 cards from GDD section 9:

| Name | RPS | Value | Role | Effect |
|---|---|---|---|---|
| Aggressor 6 | rock | 6 | attack | — |
| Aggressor 4 | scissors | 4 | attack | — |
| Glass Cannon 5 | scissors | 5 | attack | takes +1 damage |
| Opportunist 3 | paper | 3 | attack | +2 dmg on RPS advantage |
| Defender 6 | rock | 6 | defense | — |
| Shield 4 | paper | 4 | defense | additional -1 dmg after reduction |
| Reactive Guard 3 | scissors | 3 | defense | +2 reduction on RPS disadvantage |
| Buffer 3 | paper | 3 | support | — |
| Fragile Buffer 2 | rock | 2 | support | gives +2 instead of +1 |
| Persistent Buffer 4 | scissors | 4 | support | buff persists 1 turn after death |

> RPS types assigned above for balance testing — adjust freely in `cards-data.js`.

### 1.2 RPS resolution — `js/combat.js`

```js
// Returns: 'advantage' | 'neutral' | 'disadvantage'
function getRpsResult(attacker, defender)

// Returns net damage dealt by attacker to defender
function calcDamage(attacker, defender)

// Mutates card.hp; returns true if card died
function applyDamage(card, amount)

// Full pair resolution — mutates both cards, returns { aDealt, bDealt }
function resolvePair(playerCard, enemyCard)
```

RPS modifier constant lives in `config/game.config.js` (`RPS_MODIFIER: 3`).

### 1.3 Basic board — `config/game.config.js`

```js
export const GAME = {
  SLOT_COUNT: 3,
  RPS_MODIFIER: 3,        // advantage/disadvantage swing
  ATTACK_BONUS: 2,        // bonus damage for Attack role
  DEFENSE_REDUCTION: 0.5, // fraction of value used as damage reduction
  FIRST_CARD_BONUS_ADVANTAGE: 3,
  FIRST_CARD_BONUS_NEUTRAL: 1,
  FIRST_CARD_BONUS_DISADVANTAGE: 0,
  SUPPORT_BUFF_AMOUNT: 1,
  SUPPORT_BUFF_ON_SURVIVE: 1,
  BUFF_CAP: 3,
  FRAGILE_BUFFER_AMOUNT: 2,
}
```

### 1.4 Manual placement for testing

Use the existing drag-to-slot system. Add a **"Resolve Combat"** button that calls `game.resolveRound()`. Log results to `console.log` at this stage.

**Test questions:**
- Does RPS advantage/disadvantage change outcomes visibly?
- Does combat resolve correctly for all role combinations?

---

## Phase 2 — Player Loop

**Goal:** Make the game playable end-to-end for one encounter.

### 2.1 Game state — `js/game.js`

```js
const gameState = {
  phase: 'draw' | 'placement' | 'combat' | 'end',
  round: number,
  playerDeck: Card[],
  playerHand: Card[],
  playerBoard: (Card | null)[],  // index = slot index
  enemyDeck: Card[],
  enemyBoard: (Card | null)[],
  placementOrder: Card[],        // tracks first-card bonus
}
```

Phase transitions:
```
draw → placement → combat → (loop or end)
```

### 2.2 Hand system

- `drawCards()` — fills `playerHand` to `SLOT_COUNT` cards from `playerDeck`
- Player must place **all** cards before "Resolve" becomes available
- `main.js` renders hand cards using existing `createCardEl()` at the bottom of the board (already in place)

### 2.3 Placement confirmation

Extend `interactions.js` `onDragEnd` (or hook via callback) to:
1. Record slot assignment: `gameState.playerBoard[slotIndex] = card`
2. Track placement order in `gameState.placementOrder`
3. Enable the Resolve button once all slots are filled

### 2.4 First-card placement bonus

Computed at placement time (not combat time):

```js
function applyPlacementBonus(card, slotIndex, placementOrder) {
  if (placementOrder.length !== 0) return  // only first card gets bonus
  const enemyInSlot = gameState.enemyBoard[slotIndex]
  if (!enemyInSlot) return
  const result = getRpsResult(card, enemyInSlot)
  card.buffs += GAME[`FIRST_CARD_BONUS_${result.toUpperCase()}`]
}
```

**Test questions:**
- Are decisions readable? Can player understand what they're choosing?
- Is placement order meaningful?

---

## Phase 3 — Enemy System

**Goal:** Create actual gameplay with unpredictability.

### 3.1 Enemy deck — `js/enemy.js`

```js
const enemyDeck = [/* subset of cards-data entries */]

// Fisher-Yates shuffle, returns new array
function shuffleDeck(deck)

// Fill empty enemy slots left-to-right from shuffled deck
function enemyRefillBoard(enemyBoard, enemyDeck)
```

Enemy board is visible in full before placement (deck list shown in a sidebar or tooltip).  
Draw order is hidden — revealed one by one as slots fill.

### 3.2 Slot refill logic

After each round's death check:
1. Remove dead cards from both boards.
2. Enemy calls `enemyRefillBoard()` — random draw from remaining deck.
3. Player draws to refill hand (not placed yet — draw phase starts).

**Test questions:**
- Is the randomness level appropriate (not too chaotic, not too predictable)?
- Can the player plan ahead using the visible deck?

---

## Phase 4 — Support & Buff System

**Goal:** Make adjacency matter.

### 4.1 Adjacency detection — `js/combat.js`

```js
// Returns [leftCard | null, rightCard | null]
function getAdjacentAllies(board, slotIndex)
```

### 4.2 Buff application

**On placement** (support card placed):
```js
function activateSupportOnPlacement(supportCard, board, slotIndex)
// +SUPPORT_BUFF_AMOUNT to left and right allies
```

**After combat survival**:
```js
function activateSupportPostCombat(supportCard, board, slotIndex)
// +SUPPORT_BUFF_ON_SURVIVE again (capped at BUFF_CAP)
```

`card.buffs` is added to damage and subtracted from incoming damage in `calcDamage`.

### 4.3 Fragile Buffer edge case

`effect: { buffAmount: 2 }` — `activateSupportOnPlacement` reads this instead of the default constant.

### 4.4 Persistent Buffer edge case

`effect: { persistBuffTurns: 1 }` — on death, mark card as `ghostBuffer: true` and keep it in the slot for one more end-phase, then remove.

**Test questions:**
- Is placing a support card in the middle clearly stronger than placing it at the edge?
- Is the buff overpowered with a 3-card row?

---

## Phase 5 — Persistence

**Goal:** Decisions carry weight across rounds.

### 5.1 HP persistence

`card.hp` is **not** reset between rounds. Cards that survive keep their current HP.

### 5.2 Card survival handling

After death check:
- Dead cards: remove from `playerBoard` / `enemyBoard`, remove DOM element.
- Surviving player cards: stay in slot (slot remains occupied) OR return to hand — configurable per slot type (future feature; for now, all return to hand).
- `main.js` re-renders surviving cards with updated HP label.

**Test questions:**
- Does a weakened card feel risky to replay?
- Is there tension when a valuable high-HP card is damaged?

---

## Phase 6 — UX Readability

**Goal:** Player can predict outcomes before committing.

### 6.1 Combat preview

On hover over a slot during placement phase:
- Show a small overlay: `[card HP] vs [enemy HP] → projected damage`
- Use `calcDamage()` read-only (no mutation) to compute preview

### 6.2 RPS highlight

When a card is dragged near a slot:
- Slot border color: green = advantage, yellow = neutral, red = disadvantage
- Extend `CARD` config: `slotAdvantageColor`, `slotNeutralColor`, `slotDisadvantageColor`

Modify `findNearestFreeSlot` in `interactions.js` to pass RPS result to the highlight function.

### 6.3 Resolution order display

Before resolving, show numbered labels on enemy cards indicating order of resolution  
(strongest enemy first — sorted by `card.value + card.buffs` descending).

**Test questions:**
- Can the player confidently predict who will die before clicking Resolve?

---

## Phase 7 — Run Structure

**Goal:** Replayability.

### 7.1 Reward screen

After winning an encounter:
- Draw 3 random cards from a reward pool (all 9 prototype cards eligible).
- Player clicks 1 to add to their deck.
- Simple modal overlay — no new framework needed, plain DOM.

### 7.2 Loss / restart

If player loses (no cards in play + cannot draw):
- Show "You lose" overlay with "Restart" button.
- `game.js` `resetRun()` — re-initialize all state from scratch, re-render.

**Test questions:**
- Does adding a card feel meaningful given the small deck size?
- Is the loop engaging after 3+ encounters?

---

## UI Structure (DOM additions to `index.html`)

```html
<div id="board">
  <div id="enemy-board">
    <div id="enemy-slots"></div>
    <div id="enemy-cards"></div>
  </div>
  <div id="player-board">
    <div id="slots"></div>      <!-- existing -->
    <div id="cards"></div>      <!-- existing -->
  </div>
  <div id="hud">
    <button id="btn-resolve" disabled>Resolve</button>
    <div id="round-counter">Round 1</div>
  </div>
  <div id="overlay" class="hidden"></div>   <!-- reward / loss screens -->
</div>
```

Enemy slots mirror player slots — same config, positioned above center.  
`layout.config.js` gains `enemySlots` array.

---

## Implementation Order (recommended)

1. `config/game.config.js` — all constants in one place
2. `js/cards-data.js` — all card definitions
3. `js/combat.js` — pure functions, testable without DOM
4. `js/enemy.js` — deck and refill
5. `js/game.js` — state machine, wires combat + enemy
6. Update `index.html` — add enemy area, HUD, overlay
7. Update `js/main.js` — connect game.js to DOM, hook placement into interactions.js
8. Update `config/layout.config.js` — add enemy slot positions
9. `js/ui.js` — all DOM sync driven by game state
10. Phases 4–7 built on top of this foundation

---

## What We Do NOT Build in This Prototype

- Deck builder / collection screen
- Multiple encounter types
- Card artwork / visual polish
- Sound
- Mobile touch (GSAP Draggable handles touch automatically, but layout is desktop-first)
- Persistence (localStorage / server)

The prototype answers exactly one question:

> **Is positioning + RPS enough to create meaningful decisions?**

If not — fix the core. Do not add systems.
