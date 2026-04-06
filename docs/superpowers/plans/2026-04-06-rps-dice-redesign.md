# RPS Dice Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign combat so each card has a single `value` stat (HP + attack range), battles resolve via dice rolls bounded by that value, and fight order follows player placement order with visual 1st/2nd/3rd indicators between slots.

**Architecture:** Replace the flat ATK±buffs system with a roll-based system where `card.value` is both the card's HP and the ceiling of its attack range (1–value). RPS outcome determines whether the winner rolls 2-pick-best or 1, loser always rolls 1; draws share the minimum of both rolls. The complex buffSources/ghost/persistBuffTurns system is replaced by a simple inline support check: support neighbors temporarily widen adjacent cards' roll range by +1 before combat. All references to `card.hp` are replaced by `card.value`.

**Tech Stack:** Vanilla JS (ES modules), GSAP (animations), no build step — files are edited directly and tested via `node tests/game-logic-smoke.mjs`.

---

## Parallel Execution Map

```
Phase A (all parallel): Task 1 · Task 2 · Task 3
Phase B (all parallel, after A): Task 4 · Task 5
Phase C (all parallel, after B): Task 6 · Task 7
Phase D (sequential, after C): Task 8
```

---

## File Structure

| File | Action | Responsibility after change |
|------|--------|----------------------------|
| `config/game.config.js` | Modify | Simplified constants (remove RPS_MODIFIER, ATTACK_BONUS, DEFENSE_REDUCTION, FIRST_CARD_BONUS_*, BUFF_CAP, SUPPORT_BUFF_*) |
| `js/cards-data.js` | Rewrite | 12 new card definitions with `value` 3–10, no `hp` field, no complex `effect` objects |
| `js/buffs.js` | Rewrite | Single exported helper `getSupportBonus(board, slotIndex)` → returns +N from adjacent support cards |
| `js/combat.js` | Rewrite | Dice roll resolution, RPS-based roll strategy, role modifiers, `resolvePair` mutates `card.value` |
| `js/game.js` | Modify | `getResolutionOrder` uses `placementOrder`; `finalizeResolveRound` removes ghost/buff complexity; death check uses `card.value <= 0` |
| `js/card-renderer.js` | Modify | Show single `value` stat; tooltip shows roll range instead of ATK/HP breakdown |
| `js/main.js` | Modify | Combat projection shows RPS outcome (ADV/DIS/EVEN); slot order indicators show 1st/2nd/3rd labels |
| `css/style.css` | Modify | Style `.column-marker--order` badge (1st/2nd/3rd) |
| `tests/game-logic-smoke.mjs` | Rewrite | New tests for dice mechanics, placement-order resolution, role effects |

---

## Task 1: Simplify game.config.js

**Phase A — can run in parallel with Task 2 and Task 3.**

**Files:**
- Modify: `config/game.config.js`

- [ ] **Step 1: Replace entire file with simplified constants**

```javascript
export const GAME = {
  SLOT_COUNT: 3,
}
```

- [ ] **Step 2: Verify no syntax errors**

```bash
node --input-type=module < config/game.config.js
```
Expected: no output (module exports successfully)

- [ ] **Step 3: Commit**

```bash
git add config/game.config.js
git commit -m "config: strip legacy combat constants, keep only SLOT_COUNT"
```

---

## Task 2: Rewrite cards-data.js

**Phase A — can run in parallel with Task 1 and Task 3.**

**Files:**
- Rewrite: `js/cards-data.js`

- [ ] **Step 1: Replace entire file with 12 new card definitions**

Cards must have values 3–10. No `hp` field (value IS the hp). No complex `effect` objects (roles handle abilities). Keep `buffSources`, `buffs` removed from static definitions — they're obsolete.

```javascript
/**
 * Returns a fresh deep copy of all card definitions.
 * Call every time you need a new deck.
 */
export function createDeck() {
  return CARD_DEFINITIONS.map(cloneCard)
}

function cloneCard(def) {
  return { ...def }
}

/**
 * 12 prototype cards. value = HP and attack range ceiling.
 * rps: 'rock' | 'paper' | 'scissors'
 * role: 'attack' | 'defense' | 'support'
 */
const CARD_DEFINITIONS = [
  // ── Attack ──────────────────────────────────────────────────────
  { id: 'brawler',   name: 'Brawler',   rps: 'rock',     value: 5,  role: 'attack' },
  { id: 'slasher',   name: 'Slasher',   rps: 'scissors', value: 7,  role: 'attack' },
  { id: 'crusher',   name: 'Crusher',   rps: 'paper',    value: 9,  role: 'attack' },
  { id: 'lunger',    name: 'Lunger',    rps: 'rock',     value: 3,  role: 'attack' },

  // ── Defense ─────────────────────────────────────────────────────
  { id: 'bulwark',   name: 'Bulwark',   rps: 'paper',    value: 6,  role: 'defense' },
  { id: 'ironclad',  name: 'Ironclad',  rps: 'rock',     value: 8,  role: 'defense' },
  { id: 'buckler',   name: 'Buckler',   rps: 'scissors', value: 4,  role: 'defense' },

  // ── Support ─────────────────────────────────────────────────────
  { id: 'mentor',    name: 'Mentor',    rps: 'scissors', value: 3,  role: 'support' },
  { id: 'tactician', name: 'Tactician', rps: 'paper',    value: 5,  role: 'support' },
  { id: 'vanguard',  name: 'Vanguard',  rps: 'rock',     value: 7,  role: 'support' },
  { id: 'scout',     name: 'Scout',     rps: 'scissors', value: 4,  role: 'support' },
  { id: 'warden',    name: 'Warden',    rps: 'paper',    value: 6,  role: 'support' },
]
```

- [ ] **Step 2: Verify module loads and deck has 12 cards**

```bash
node --input-type=module <<'EOF'
import { createDeck } from './js/cards-data.js'
const deck = createDeck()
console.assert(deck.length === 12, `Expected 12 cards, got ${deck.length}`)
console.assert(deck.every(c => c.value >= 3 && c.value <= 10), 'All values must be 3-10')
console.assert(deck.every(c => !('hp' in c)), 'No hp field expected')
console.log('OK: deck has', deck.length, 'cards')
EOF
```
Expected: `OK: deck has 12 cards`

- [ ] **Step 3: Commit**

```bash
git add js/cards-data.js
git commit -m "cards: replace 10 legacy cards with 12 new definitions (value 3-10, no hp)"
```

---

## Task 3: Rewrite buffs.js

**Phase A — can run in parallel with Task 1 and Task 2.**

**Files:**
- Rewrite: `js/buffs.js`

The entire old system (buffSources, syncCardBuffs, addBuffSource, clearBuffSourcesByScope, ghostBuffer) is deleted. The only thing needed by combat is: "how much does an adjacent support card add to this card's effective roll range?".

- [ ] **Step 1: Replace entire file**

```javascript
/**
 * Returns the total support bonus added to a card's effective roll range.
 * Support neighbors add +1 each (before rolling).
 *
 * @param {(object|null)[]} board  - the board array (playerBoard or enemyBoard)
 * @param {number} slotIndex       - the card's slot index
 * @returns {number}               - bonus to add to card.value before rolling (0, 1, or 2)
 */
export function getSupportBonus(board, slotIndex) {
  let bonus = 0
  const left = board[slotIndex - 1] ?? null
  const right = board[slotIndex + 1] ?? null
  if (left?.role === 'support') bonus += 1
  if (right?.role === 'support') bonus += 1
  return bonus
}
```

- [ ] **Step 2: Verify module loads**

```bash
node --input-type=module <<'EOF'
import { getSupportBonus } from './js/buffs.js'
const board = [
  { role: 'support', value: 3 },
  { role: 'attack', value: 5 },
  { role: 'defense', value: 6 },
]
console.assert(getSupportBonus(board, 1) === 1, 'Expected 1 (left neighbor is support)')
console.assert(getSupportBonus(board, 0) === 0, 'Expected 0 (no left neighbor)')
console.assert(getSupportBonus(board, 2) === 0, 'Expected 0 (right neighbor is support but slot 2 has none on right)')
console.log('OK')
EOF
```
Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add js/buffs.js
git commit -m "buffs: replace complex buff system with single getSupportBonus helper"
```

---

## Task 4: Rewrite combat.js

**Phase B — depends on Task 1 (config), Task 2 (cards), Task 3 (buffs). Runs in parallel with Task 5.**

**Files:**
- Rewrite: `js/combat.js`
- Test: `tests/game-logic-smoke.mjs` (will be written in Task 8, but tested manually here)

The new combat model:
- `roll(n)` → random integer 1..n
- RPS winner: roll 2, pick max (advantage)
- RPS loser: roll 1 (disadvantage)
- RPS neutral: both roll 1, damage = min of both rolls, applied to both
- Role modifiers: Attack +1 to own rolled value; Defense -1 to incoming attack; Support handled externally via `getSupportBonus`
- `resolvePair` mutates `card.value` (not `card.hp`)

- [ ] **Step 1: Write the failing test (manual — will become part of Task 8)**

Verify logic before writing code by mentally checking: if P value=5 (attack, roll=4 → +1 → 5), E value=3 (defense, roll=2, P attack → 5-1=4 applied), so E.value should drop from 3 to max(0, 3-4)=-1 → dies. OK.

- [ ] **Step 2: Replace entire combat.js**

```javascript
import { getSupportBonus } from './buffs.js'

// RPS win table: key beats value
const RPS_BEATS = {
  rock: 'scissors',
  scissors: 'paper',
  paper: 'rock',
}

/**
 * Returns the RPS result from attacker's perspective.
 * @returns {'advantage' | 'neutral' | 'disadvantage'}
 */
export function getRpsResult(attacker, defender) {
  if (attacker.rps === defender.rps) return 'neutral'
  if (RPS_BEATS[attacker.rps] === defender.rps) return 'advantage'
  return 'disadvantage'
}

/**
 * Returns adjacent allies in a 3-slot row.
 * @returns {[object|null, object|null]} [leftCard, rightCard]
 */
export function getAdjacentAllies(board, slotIndex) {
  return [
    board[slotIndex - 1] ?? null,
    board[slotIndex + 1] ?? null,
  ]
}

/**
 * Returns a random integer between 1 and n inclusive.
 * n must be >= 1.
 */
function roll(n) {
  return Math.floor(Math.random() * Math.max(1, n)) + 1
}

/**
 * Roll 2 from 1..n, return the higher value (RPS winner strategy).
 */
function rollAdvantage(n) {
  return Math.max(roll(n), roll(n))
}

/**
 * Apply role modifier to a rolled attack value.
 * Attack role: +1 to rolled value.
 */
function applyAttackerRole(card, rolledValue) {
  if (card.role === 'attack') return rolledValue + 1
  return rolledValue
}

/**
 * Apply defender's role modifier to incoming attack.
 * Defense role: -1 to incoming attack (minimum 0).
 */
function applyDefenderRole(card, incomingAttack) {
  if (card.role === 'defense') return Math.max(0, incomingAttack - 1)
  return incomingAttack
}

/**
 * Computes the effective roll range for a card including support neighbor bonus.
 *
 * @param {object} card
 * @param {(object|null)[]} board  - the board the card belongs to
 * @param {number} slotIndex
 * @returns {number} effective ceiling for the roll (card.value + support bonus)
 */
function effectiveRange(card, board, slotIndex) {
  return card.value + getSupportBonus(board, slotIndex)
}

/**
 * Resolves one card pair. Mutates card.value on both sides.
 *
 * Returns a result object describing what happened (for UI/logging).
 */
export function resolvePair(playerCard, enemyCard, playerBoard, enemyBoard, playerSlot, enemySlot) {
  const rps = getRpsResult(playerCard, enemyCard)

  const pRange = effectiveRange(playerCard, playerBoard, playerSlot)
  const eRange = effectiveRange(enemyCard, enemyBoard, enemySlot)

  let pDealt, eDealt
  let pRolls, eRolls

  if (rps === 'neutral') {
    // Both roll 1, damage = min of the two rolls, applied to both
    const pRoll = roll(pRange)
    const eRoll = roll(eRange)
    const sharedDamage = Math.min(pRoll, eRoll)

    pRolls = [pRoll]
    eRolls = [eRoll]
    pDealt = sharedDamage  // player deals this to enemy
    eDealt = sharedDamage  // enemy deals this to player

    // Apply defender role AFTER picking shared damage
    pDealt = applyDefenderRole(enemyCard, pDealt)  // enemy's defense reduces what player deals
    eDealt = applyDefenderRole(playerCard, eDealt)  // player's defense reduces what enemy deals
  } else {
    // Advantage / disadvantage
    const pWins = rps === 'advantage'

    // Player side
    const pRoll1 = roll(pRange)
    const pRoll2 = pWins ? roll(pRange) : null
    const pRollResult = pWins ? Math.max(pRoll1, pRoll2) : pRoll1
    pRolls = pWins ? [pRoll1, pRoll2] : [pRoll1]

    // Enemy side
    const eRoll1 = roll(eRange)
    const eRoll2 = !pWins ? roll(eRange) : null
    const eRollResult = !pWins ? Math.max(eRoll1, eRoll2) : eRoll1
    eRolls = !pWins ? [eRoll1, eRoll2] : [eRoll1]

    // Apply attacker role modifier
    pDealt = applyAttackerRole(playerCard, pRollResult)
    eDealt = applyAttackerRole(enemyCard, eRollResult)

    // Apply defender role modifier
    pDealt = applyDefenderRole(enemyCard, pDealt)
    eDealt = applyDefenderRole(playerCard, eDealt)
  }

  const pValueBefore = playerCard.value
  const eValueBefore = enemyCard.value

  // Mutate card.value (value = HP in new system)
  playerCard.value = Math.max(0, playerCard.value - eDealt)
  enemyCard.value = Math.max(0, enemyCard.value - pDealt)

  return {
    rps,
    player: {
      rolls: pRolls,
      range: pRange,
      dealt: pDealt,
      valueBefore: pValueBefore,
      valueAfter: playerCard.value,
      died: playerCard.value <= 0,
    },
    enemy: {
      rolls: eRolls,
      range: eRange,
      dealt: eDealt,
      valueBefore: eValueBefore,
      valueAfter: enemyCard.value,
      died: enemyCard.value <= 0,
    },
  }
}
```

- [ ] **Step 3: Verify module loads and basic roll logic works**

```bash
node --input-type=module <<'EOF'
import { getRpsResult, resolvePair } from './js/combat.js'

// RPS table
console.assert(getRpsResult({rps:'rock'},{rps:'scissors'}) === 'advantage', 'rock beats scissors')
console.assert(getRpsResult({rps:'scissors'},{rps:'rock'}) === 'disadvantage', 'scissors loses to rock')
console.assert(getRpsResult({rps:'paper'},{rps:'paper'}) === 'neutral', 'paper vs paper neutral')

// resolvePair: advantage case — player (attack, value 5, rock) vs enemy (defense, value 3, scissors)
// player wins RPS → rolls 2 from range 5, picks higher; attack role: +1; enemy defense: -1 incoming
// enemy rolls 1 from range 3; defense role: player incoming -1
let totalPlayerDealt = 0
let totalEnemyDealt = 0
for (let i = 0; i < 100; i++) {
  const p = { id:'p', rps:'rock', value:5, role:'attack' }
  const e = { id:'e', rps:'scissors', value:3, role:'defense' }
  const board3 = [null,null,null]
  const r = resolvePair(p, e, board3, board3, 1, 1)
  console.assert(r.rps === 'advantage', 'should be advantage')
  // player rolled 2 from range 5, +1 attack, enemy defense -1 → dealt range [1..6]
  console.assert(r.player.dealt >= 0 && r.player.dealt <= 6, `player.dealt out of range: ${r.player.dealt}`)
  console.assert(r.enemy.dealt >= 0 && r.enemy.dealt <= 4, `enemy.dealt out of range: ${r.enemy.dealt}`)
  totalPlayerDealt += r.player.dealt
  totalEnemyDealt += r.enemy.dealt
}
// In 100 runs player should on average deal more than enemy (advantage + attack role)
console.assert(totalPlayerDealt > totalEnemyDealt, `Expected player to deal more on average: p=${totalPlayerDealt} e=${totalEnemyDealt}`)
console.log('OK')
EOF
```
Expected: `OK`

- [ ] **Step 4: Commit**

```bash
git add js/combat.js
git commit -m "combat: rewrite with dice-based RPS mechanics (roll 1–value, advantage=roll2-pick-max)"
```

---

## Task 5: Update game.js

**Phase B — depends on Tasks 1, 2, 3. Runs in parallel with Task 4.**

**Files:**
- Modify: `js/game.js`

Changes needed:
1. `getResolutionOrder` returns slots in player placement order (not enemy strength order)
2. Remove all buff-related imports and calls (`addBuffSource`, `clearBuffSourcesByScope`, `ensureBuffState`, `syncCardBuffs`)
3. Remove ghost card logic (`isGhostCard`, `canPersistAsGhost`, `markCardAsGhost`, `expireExistingGhosts`)
4. Remove support post-combat buffs (`applySupportPostCombatBuffs`)
5. Remove first-card bonus (`applyFirstCardBonus`)
6. Remove support placement buffs (`applySupportPlacementBuffs`, `recalculateBoardBuffs`, `syncDerivedState`)
7. Death check uses `card.value <= 0` instead of `card.hp <= 0`
8. `resolvePair` now receives board + slot index arguments (pass them from `resolveCombatStep`)
9. `buildCombatStep` shows range preview instead of exact damage
10. `finalizeResolveRound` simplified (no ghost handling, no buff recalculation)

- [ ] **Step 1: Read current game.js to understand full import list**

File already read above (lines 1–560). Proceed.

- [ ] **Step 2: Replace the import block and remove obsolete helpers**

Replace lines 1–8 with:

```javascript
import { GAME } from '../config/game.config.js'
import { createDeck } from './cards-data.js'
import { resolvePair, getRpsResult, getAdjacentAllies } from './combat.js'
import { createEnemyDeck, enemyRefillBoard, shuffleDeck } from './enemy.js'
```

- [ ] **Step 3: Remove obsolete helper functions**

Delete the following functions entirely (they reference the old buff/ghost system):
- `isGhostCard` (lines 28–30)
- `canPersistAsGhost` (lines 32–34)
- `markCardAsGhost` (lines 36–43)
- `moveCardToPlayerCemetery` — keep but remove `clearBuffSourcesByScope` and `syncCardBuffs` calls
- `moveCardToEnemyCemetery` — keep but remove `clearBuffSourcesByScope` and `syncCardBuffs` calls
- `expireExistingGhosts` (lines 59–80)
- `countOpenPlayerSlots` — keep
- `getCardStrength` (lines 86–89) — delete (no longer used)
- `getAllCardsInState` (lines 104–126) — delete
- `clearTemporaryBuffs` (lines 128–130) — delete
- `getSupportPlacementAmount` (lines 132–134) — delete
- `applyFirstCardBonus` (lines 136–156) — delete
- `applySupportPlacementBuffs` (lines 158–189) — delete
- `applySupportPostCombatBuffs` (lines 191–218) — delete
- `recalculateBoardBuffs` (lines 220–226) — delete
- `recalculateEnemyBuffs` (lines 235–237) — delete
- `syncDerivedState` (lines 239–241) — delete

- [ ] **Step 4: Rewrite getResolutionOrder to use placementOrder**

Replace the existing `getResolutionOrder` function (lines 91–102) with:

```javascript
/**
 * Returns slot indices in the order the player placed their cards.
 * Only includes slots where both player and enemy have a card.
 */
export function getResolutionOrder() {
  const order = []
  for (const card of gameState.placementOrder) {
    const slotIndex = gameState.playerBoard.findIndex(c => c === card)
    if (slotIndex !== -1 && gameState.enemyBoard[slotIndex] !== null) {
      order.push(slotIndex)
    }
  }
  // Include any remaining slots not covered by placementOrder (safety)
  for (let i = 0; i < GAME.SLOT_COUNT; i++) {
    if (!order.includes(i) && gameState.playerBoard[i] && gameState.enemyBoard[i]) {
      order.push(i)
    }
  }
  return order
}
```

- [ ] **Step 5: Simplify moveCardToPlayerCemetery and moveCardToEnemyCemetery**

```javascript
function moveCardToPlayerCemetery(card) {
  if (!card) return
  gameState.playerCemetery.push(card)
}

function moveCardToEnemyCemetery(card) {
  if (!card) return
  gameState.enemyCemetery.push(card)
}
```

- [ ] **Step 6: Simplify initRun**

Replace `initRun` (lines 249–266) with:

```javascript
export function initRun() {
  gameState.playerDeck = shuffleDeck(createDeck())
  gameState.playerHand = []
  gameState.playerCemetery = []
  gameState.playerBoard = Array(GAME.SLOT_COUNT).fill(null)
  gameState.enemyDeck = createEnemyDeck()
  gameState.enemyCemetery = []
  gameState.enemyBoard = Array(GAME.SLOT_COUNT).fill(null)
  gameState.placementOrder = []
  gameState.rewardChoices = []
  gameState.round = 1
  gameState.phase = 'draw'

  enemyRefillBoard(gameState.enemyBoard, gameState.enemyDeck)
}
```

- [ ] **Step 7: Simplify drawCards — remove recalculateBoardBuffs call**

```javascript
export function drawCards() {
  const drawnCards = []
  const openSlots = gameState.playerBoard.filter(s => s === null).length
  const targetHandSize = openSlots

  while (
    gameState.playerHand.length < targetHandSize &&
    gameState.playerDeck.length > 0
  ) {
    const drawnCard = gameState.playerDeck.shift()
    gameState.playerHand.push(drawnCard)
    drawnCards.push(drawnCard)
  }
  gameState.phase = 'placement'
  gameState.placementOrder = []
  return drawnCards
}
```

- [ ] **Step 8: Simplify placeCard — remove ensureBuffState and recalculateBoardBuffs**

```javascript
export function placeCard(cardId, slotIndex) {
  if (gameState.phase !== 'placement') return false
  if (gameState.playerBoard[slotIndex] !== null) return false

  const cardIdx = gameState.playerHand.findIndex(c => c.id === cardId)
  if (cardIdx === -1) return false

  const card = gameState.playerHand.splice(cardIdx, 1)[0]
  gameState.playerBoard[slotIndex] = card
  gameState.placementOrder.push(card)
  return true
}
```

- [ ] **Step 9: Simplify unplaceCard — remove recalculateBoardBuffs**

```javascript
export function unplaceCard(slotIndex) {
  if (gameState.phase !== 'placement') return false
  const card = gameState.playerBoard[slotIndex]
  if (!card) return false

  gameState.playerBoard[slotIndex] = null
  gameState.playerHand.push(card)
  gameState.placementOrder = gameState.placementOrder.filter(c => c.id !== card.id)
  return true
}
```

- [ ] **Step 10: Rewrite buildCombatStep to show range preview (no exact damage)**

```javascript
function buildCombatStep(slotIndex) {
  const player = gameState.playerBoard[slotIndex]
  const enemy = gameState.enemyBoard[slotIndex]

  if (!player || !enemy) {
    return { slot: slotIndex, skipped: true }
  }

  const rps = getRpsResult(player, enemy)
  return {
    slot: slotIndex,
    rps,
    player: { id: player.id, name: player.name, value: player.value, rps: player.rps },
    enemy: { id: enemy.id, name: enemy.name, value: enemy.value, rps: enemy.rps },
  }
}
```

- [ ] **Step 11: Rewrite prepareResolveRound**

```javascript
export function prepareResolveRound() {
  if (!canResolve()) return null

  gameState.phase = 'combat'
  const resolutionOrder = getResolutionOrder()

  return {
    resolutionOrder,
    steps: resolutionOrder.map(slotIndex => buildCombatStep(slotIndex)),
  }
}
```

- [ ] **Step 12: Rewrite resolveCombatStep — use new resolvePair signature**

```javascript
export function resolveCombatStep(slotIndex) {
  const player = gameState.playerBoard[slotIndex]
  const enemy = gameState.enemyBoard[slotIndex]

  if (!player || !enemy) return { slot: slotIndex, skipped: true }

  const result = resolvePair(
    player, enemy,
    gameState.playerBoard, gameState.enemyBoard,
    slotIndex, slotIndex
  )

  return {
    slot: slotIndex,
    rps: result.rps,
    player: {
      id: player.id,
      name: player.name,
      rolls: result.player.rolls,
      range: result.player.range,
      dealt: result.player.dealt,
      valueBefore: result.player.valueBefore,
      valueAfter: result.player.valueAfter,
      died: result.player.died,
    },
    enemy: {
      id: enemy.id,
      name: enemy.name,
      rolls: result.enemy.rolls,
      range: result.enemy.range,
      dealt: result.enemy.dealt,
      valueBefore: result.enemy.valueBefore,
      valueAfter: result.enemy.valueAfter,
      died: result.enemy.died,
    },
  }
}
```

- [ ] **Step 13: Rewrite finalizeResolveRound — simplified death/cleanup**

```javascript
export function finalizeResolveRound(log = []) {
  if (gameState.phase !== 'combat') return null

  // Death check — remove cards with value <= 0
  for (let i = 0; i < GAME.SLOT_COUNT; i++) {
    const playerCard = gameState.playerBoard[i]
    if (playerCard && playerCard.value <= 0) {
      moveCardToPlayerCemetery(playerCard)
      gameState.playerBoard[i] = null
    }

    const enemyCard = gameState.enemyBoard[i]
    if (enemyCard && enemyCard.value <= 0) {
      moveCardToEnemyCemetery(enemyCard)
      gameState.enemyBoard[i] = null
    }
  }

  // Surviving player cards return to hand
  for (let i = 0; i < GAME.SLOT_COUNT; i++) {
    const card = gameState.playerBoard[i]
    if (card) {
      gameState.playerHand.push(card)
      gameState.playerBoard[i] = null
    }
  }

  // Enemy refills board
  enemyRefillBoard(gameState.enemyBoard, gameState.enemyDeck)

  gameState.round += 1
  gameState.rewardChoices = []

  const playerHasCards =
    gameState.playerHand.length > 0 || gameState.playerDeck.length > 0
  const enemyHasCards =
    gameState.enemyBoard.some(c => c !== null) || gameState.enemyDeck.length > 0

  if (!playerHasCards) {
    gameState.phase = 'end'
    return { log, outcome: 'loss' }
  }
  if (!enemyHasCards) {
    gameState.phase = 'reward'
    gameState.rewardChoices = createRewardChoices()
    return { log, outcome: 'win', rewardChoices: [...gameState.rewardChoices] }
  }

  gameState.phase = 'draw'
  return { log, outcome: 'continue' }
}
```

- [ ] **Step 14: Simplify claimReward — remove recalculateEnemyBuffs**

```javascript
export function claimReward(cardId) {
  if (gameState.phase !== 'reward') return null

  const rewardIndex = gameState.rewardChoices.findIndex(c => c.id === cardId)
  if (rewardIndex === -1) return null

  const [rewardCard] = gameState.rewardChoices.splice(rewardIndex, 1)
  gameState.playerDeck.push(rewardCard)
  gameState.rewardChoices = []
  gameState.playerBoard = Array(GAME.SLOT_COUNT).fill(null)
  gameState.enemyDeck = createEnemyDeck()
  gameState.enemyBoard = Array(GAME.SLOT_COUNT).fill(null)
  gameState.placementOrder = []
  gameState.round = 1
  gameState.phase = 'draw'

  enemyRefillBoard(gameState.enemyBoard, gameState.enemyDeck)
  return rewardCard
}
```

- [ ] **Step 15: Remove getGhostPlayerBoardCards export (no more ghost cards)**

Delete the `getGhostPlayerBoardCards` function at the bottom of the file.

- [ ] **Step 16: Verify module loads with no import errors**

```bash
node --input-type=module <<'EOF'
import { initRun, gameState, drawCards, canResolve } from './js/game.js'
initRun()
drawCards()
console.assert(gameState.playerHand.length > 0, 'Should have cards in hand')
console.assert(gameState.phase === 'placement', 'Should be in placement phase')
console.log('OK: game.js loads, initRun and drawCards work')
EOF
```
Expected: `OK: game.js loads, initRun and drawCards work`

- [ ] **Step 17: Commit**

```bash
git add js/game.js
git commit -m "game: placement-order resolution, value-based death check, remove ghost/buff systems"
```

---

## Task 6: Update card-renderer.js

**Phase C — depends on Tasks 4 and 5. Runs in parallel with Task 7.**

**Files:**
- Modify: `js/card-renderer.js`

Changes:
1. Remove import of `getBuffSummary` from buffs.js (gone)
2. Remove import of `getDamageBreakdown` from combat.js (no longer used for static previews)
3. Show single `value` stat instead of ATK/HP split
4. Tooltip shows roll range (1–value) and role effect, not ATK/HP breakdown
5. Remove `combatProjection` parameter from `updateCardPresentation` (can't predict dice)

- [ ] **Step 1: Read current card-renderer.js in full**

```bash
# View entire file
```

Read: `js/card-renderer.js` (364 lines)

- [ ] **Step 2: Replace import block**

Replace lines 1–3 with:
```javascript
import { CARD } from '../config/card.config.js'
```

- [ ] **Step 3: Rewrite createCardEl to show single value**

Find the stats section inside `createCardEl`. Currently it renders `ATK` and `HP` separately. Replace the stats block with:

```javascript
// Single value stat
const statsEl = document.createElement('div')
statsEl.className = 'card__stats'
statsEl.innerHTML = `<span class="card__value">${card.value}</span>`
```

The card header showing card name stays. The bottom effect text stays (now shows role description).

- [ ] **Step 4: Update updateCardPresentation to only update value display**

Replace existing `updateCardPresentation` function with:

```javascript
export function updateCardPresentation(cardEl, card) {
  const valueEl = cardEl.querySelector('.card__value')
  if (valueEl) valueEl.textContent = card.value

  // Update RPS icon (unchanged)
  const midEl = cardEl.querySelector('.card__mid')
  if (midEl) midEl.textContent = RPS_ICON[card.rps] ?? ''
}
```

- [ ] **Step 5: Update tooltip content to show roll range and role effect**

In `createCardEl`, find where tooltip is built. Replace its content generation with:

```javascript
function buildTooltip(card) {
  const tooltipEl = document.createElement('ul')
  tooltipEl.className = 'card__tooltip'

  // Roll range
  const rangeItem = document.createElement('li')
  rangeItem.className = 'card__tooltip-item'
  rangeItem.textContent = `Roll range: 1–${card.value}`
  tooltipEl.appendChild(rangeItem)

  // Role effect description
  const roleEffects = {
    attack: 'Attack: +1 to rolled value',
    defense: 'Defense: −1 to incoming attack',
    support: 'Support: adjacent allies +1 to roll range',
  }
  const roleItem = document.createElement('li')
  roleItem.className = 'card__tooltip-item'
  roleItem.textContent = roleEffects[card.role] ?? ''
  tooltipEl.appendChild(roleItem)

  return tooltipEl
}
```

Call `buildTooltip(card)` inside `createCardEl` instead of the old tooltip builder.

- [ ] **Step 6: Remove dead code**

Delete functions that reference the old ATK/HP breakdown system:
- `formatStatDelta`
- `formatReductionDelta`
- `appendReductionSourceParts`
- `formatAttackLine`
- `appendModifierRow`
- `createTooltipSectionRow`
- Any function that referenced `breakdown.baseAttack`, `breakdown.buffAttack`, `breakdown.finalDamage`

- [ ] **Step 7: Update effectText / role display in card body**

In `createCardEl`, where `card.effectText` is shown, replace with a role badge that describes the role effect clearly:

```javascript
const roleEffectText = {
  attack: '+1 to roll',
  defense: '−1 incoming',
  support: 'adj. +1 range',
}
const botEl = document.createElement('div')
botEl.className = 'card__bot'
botEl.textContent = roleEffectText[card.role] ?? ''
```

- [ ] **Step 8: Verify no console errors by checking module loads**

```bash
node --input-type=module <<'EOF'
// card-renderer uses DOM APIs — just check it imports cleanly
import { CARD } from './config/card.config.js'
console.log('CARD config loaded:', Object.keys(CARD))
EOF
```
Expected: prints CARD config keys without errors.

Since card-renderer uses `document` (browser DOM), full testing is in-browser only. Manual browser smoke test: open `index.html`, check cards display a single number and the tooltip shows roll range.

- [ ] **Step 9: Commit**

```bash
git add js/card-renderer.js
git commit -m "card-renderer: show single value stat, tooltip shows roll range and role effect"
```

---

## Task 7: Update main.js and style.css

**Phase C — depends on Tasks 4 and 5. Runs in parallel with Task 6.**

**Files:**
- Modify: `js/main.js`
- Modify: `css/style.css`

Changes to main.js:
1. Remove `getResolutionOrder` and `syncDerivedState` imports from game.js (removed)
2. Remove `getDamageBreakdown` import from combat.js (no longer used for preview)
3. Remove `getGhostPlayerBoardCards` import (removed)
4. `getCombatProjection` → replace with `getRpsProjection` that returns only RPS outcome (ADV/DIS/EVEN), since damage is random
5. Column markers show "1st" / "2nd" / "3rd" instead of ⚔️ — based on placement order
6. Remove all references to `card.buffs` in UI rendering
7. Remove `updateCardPresentation` calls that passed `combatProjection` argument (signature changed)

- [ ] **Step 1: Read main.js fully**

Read: `js/main.js` (complete file — already read first 100 lines, read remainder)

```bash
# Read lines 100-end
```

Read `js/main.js` lines 100–end.

- [ ] **Step 2: Update import block in main.js**

Replace the import section at the top:

```javascript
import { CARD } from '../config/card.config.js'
import { LAYOUT } from '../config/layout.config.js'
import { GAME } from '../config/game.config.js'
import { ANIM } from '../config/anim.config.js'
import { initDrag } from './interactions.js'
import { createCardEl, updateCardPresentation } from './card-renderer.js'
import {
  claimReward,
  gameState,
  initRun,
  drawCards,
  placeCard,
  unplaceCard,
  prepareResolveRound,
  resolveCombatStep,
  finalizeResolveRound,
} from './game.js'
import { getRpsResult } from './combat.js'
import {
  hideOverlay,
  syncResolveButton,
  updateRoundCounter,
  logRoundResult,
  showOverlay,
  setResolveButtonDisabled,
  setResolveButtonLabel,
} from './ui.js'
```

- [ ] **Step 3: Replace getCombatProjection with getRpsProjection**

Replace the `getCombatProjection` function (lines 59–94) with:

```javascript
function getRpsProjection(playerCard, slotIndex) {
  const enemyCard = gameState.enemyBoard[slotIndex]
  if (!enemyCard) return null

  const rps = getRpsResult(playerCard, enemyCard)

  const label = rps === 'advantage' ? 'ADV' : rps === 'disadvantage' ? 'DIS' : 'EVEN'
  const outcome = rps === 'advantage' ? 'win' : rps === 'disadvantage' ? 'lose' : 'clash'

  return { rps, label, outcome, enemyCard }
}
```

- [ ] **Step 4: Update all calls to getCombatProjection → getRpsProjection**

Search for `getCombatProjection` across main.js and replace each call with `getRpsProjection`.

Update the combat badge display code that reads `projection.playerHpDelta`, `projection.enemyHpDelta` etc — remove those references since the new projection only has `rps`, `label`, `outcome`.

- [ ] **Step 5: Update column marker rendering to show placement order**

Find `columnMarkerEls` usage. Currently shows ⚔️ during combat. Replace with placement order display.

During combat phase, after `prepareResolveRound()` returns:

```javascript
function showPlacementOrderMarkers(resolutionOrder) {
  const ordinals = ['1st', '2nd', '3rd']
  // Clear all markers
  columnMarkerEls.forEach(el => {
    el.textContent = ''
    el.classList.remove('column-marker--order')
  })
  // Set ordinal for each slot in resolution order
  resolutionOrder.forEach((slotIndex, i) => {
    const markerEl = columnMarkerEls[slotIndex]
    if (markerEl) {
      markerEl.textContent = ordinals[i] ?? ''
      markerEl.classList.add('column-marker--order')
    }
  })
}
```

Call `showPlacementOrderMarkers(prepared.resolutionOrder)` right after `prepareResolveRound()` succeeds.

After combat finishes (in finalize handler), clear the markers:
```javascript
columnMarkerEls.forEach(el => {
  el.textContent = ''
  el.classList.remove('column-marker--order')
})
```

- [ ] **Step 6: Remove all card.buffs / card.hp references from main.js rendering**

Search for `card.buffs`, `card.hp`, `ghostBuffer`, `getGhostPlayerBoardCards` in main.js and remove those references. Cards no longer have buffs or separate HP.

Update any call to `updateCardPresentation(el, card, projection)` — remove the third argument since the function signature no longer accepts it.

- [ ] **Step 7: Add CSS for placement order markers**

In `css/style.css`, add at the end:

```css
/* Battle order indicators between slots */
.column-marker--order {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.05em;
  color: oklch(85% 0.12 90);
  text-transform: uppercase;
  text-align: center;
  padding: 2px 6px;
  background: oklch(30% 0.06 150 / 0.8);
  border-radius: 4px;
  pointer-events: none;
  user-select: none;
}
```

- [ ] **Step 8: Manual browser smoke test**

Open `index.html` in a browser. Verify:
- Cards display a single number (not ATK/HP)
- Tooltip shows "Roll range: 1–N" and role effect
- After Resolve: column markers show "1st", "2nd", "3rd" between enemy and player slots
- Combat results show ADV/DIS/EVEN badge instead of WIN/LOSE/TRADE
- No JS console errors

- [ ] **Step 9: Commit**

```bash
git add js/main.js css/style.css
git commit -m "ui: placement-order markers (1st/2nd/3rd), RPS projection badge, remove buff rendering"
```

---

## Task 8: Rewrite tests/game-logic-smoke.mjs

**Phase D — depends on all previous tasks.**

**Files:**
- Rewrite: `tests/game-logic-smoke.mjs`

- [ ] **Step 1: Replace entire test file**

```javascript
/**
 * Smoke tests for the redesigned RPS dice combat system.
 * Run with: node tests/game-logic-smoke.mjs
 */

import { getRpsResult, resolvePair } from '../js/combat.js'
import { getSupportBonus } from '../js/buffs.js'
import { createDeck } from '../js/cards-data.js'
import {
  initRun,
  gameState,
  drawCards,
  placeCard,
  canResolve,
  prepareResolveRound,
  resolveCombatStep,
  finalizeResolveRound,
  getResolutionOrder,
} from '../js/game.js'

let passed = 0
let failed = 0

function assert(condition, message) {
  if (condition) {
    console.log(`  ✓ ${message}`)
    passed++
  } else {
    console.error(`  ✗ FAIL: ${message}`)
    failed++
  }
}

// ── getRpsResult ────────────────────────────────────────────────────────────
console.log('\n[RPS results]')
assert(getRpsResult({rps:'rock'},{rps:'scissors'}) === 'advantage', 'rock beats scissors')
assert(getRpsResult({rps:'scissors'},{rps:'paper'}) === 'advantage', 'scissors beats paper')
assert(getRpsResult({rps:'paper'},{rps:'rock'}) === 'advantage', 'paper beats rock')
assert(getRpsResult({rps:'rock'},{rps:'paper'}) === 'disadvantage', 'rock loses to paper')
assert(getRpsResult({rps:'paper'},{rps:'paper'}) === 'neutral', 'paper vs paper neutral')
assert(getRpsResult({rps:'rock'},{rps:'rock'}) === 'neutral', 'rock vs rock neutral')

// ── getSupportBonus ─────────────────────────────────────────────────────────
console.log('\n[getSupportBonus]')
const board3 = [
  { role: 'support', value: 3 },
  { role: 'attack', value: 5 },
  { role: 'defense', value: 6 },
]
assert(getSupportBonus(board3, 0) === 0, 'slot 0: no left neighbor, right is attack → 0')
assert(getSupportBonus(board3, 1) === 1, 'slot 1: left is support → 1')
assert(getSupportBonus(board3, 2) === 0, 'slot 2: left is attack → 0')

const allSupport = [
  { role: 'support', value: 3 },
  { role: 'attack', value: 5 },
  { role: 'support', value: 4 },
]
assert(getSupportBonus(allSupport, 1) === 2, 'slot 1: both neighbors support → 2')

// ── createDeck ──────────────────────────────────────────────────────────────
console.log('\n[createDeck]')
const deck = createDeck()
assert(deck.length === 12, `deck has 12 cards (got ${deck.length})`)
assert(deck.every(c => c.value >= 3 && c.value <= 10), 'all cards have value 3–10')
assert(deck.every(c => !('hp' in c)), 'no card has hp field')
assert(deck.some(c => c.role === 'attack'), 'deck has attack cards')
assert(deck.some(c => c.role === 'defense'), 'deck has defense cards')
assert(deck.some(c => c.role === 'support'), 'deck has support cards')

// ── resolvePair: advantage case ────────────────────────────────────────────
console.log('\n[resolvePair — advantage]')
{
  // Player (rock, value 5, attack) vs Enemy (scissors, value 3, defense)
  // Player wins RPS (rock beats scissors)
  // Player: rolls 2 from range 5, picks max, +1 attack role; enemy defense -1 incoming
  // Enemy: rolls 1 from range 3; player defense N/A
  let playerWon = 0
  let enemyWon = 0
  for (let i = 0; i < 200; i++) {
    const p = { id:'p', rps:'rock', value:5, role:'attack' }
    const e = { id:'e', rps:'scissors', value:3, role:'defense' }
    const emptyBoard = [null, p, null]
    const enemyBoard = [null, e, null]
    const r = resolvePair(p, e, emptyBoard, enemyBoard, 1, 1)
    assert(r.rps === 'advantage', `rps should be advantage (i=${i})`)
    // player.dealt: max(roll1,roll2) + 1 attack − 1 defense = max(1..5,1..5)+1−1 ∈ [1..5]
    assert(r.player.dealt >= 0 && r.player.dealt <= 5, `player.dealt in range 0-5: ${r.player.dealt}`)
    // enemy.dealt: 1 roll from 3, no modifiers ∈ [1..3]
    assert(r.enemy.dealt >= 1 && r.enemy.dealt <= 3, `enemy.dealt in range 1-3: ${r.enemy.dealt}`)
    if (r.player.dealt > r.enemy.dealt) playerWon++
    if (r.enemy.dealt > r.player.dealt) enemyWon++
  }
  assert(playerWon > enemyWon, `player should win more often in advantage (player=${playerWon} enemy=${enemyWon})`)
}

// ── resolvePair: neutral case ──────────────────────────────────────────────
console.log('\n[resolvePair — neutral]')
{
  const p = { id:'p', rps:'rock', value:6, role:'attack' }
  const e = { id:'e', rps:'rock', value:4, role:'defense' }
  const pb = [null, p, null]
  const eb = [null, e, null]
  const r = resolvePair(p, e, pb, eb, 1, 1)
  assert(r.rps === 'neutral', 'rps should be neutral')
  // Both roll 1 each; damage = min of rolls
  assert(r.player.dealt === r.enemy.dealt, `neutral: dealt amounts should be equal (p=${r.player.dealt} e=${r.enemy.dealt})`)
  assert(r.player.rolls.length === 1, 'neutral: player rolled once')
  assert(r.enemy.rolls.length === 1, 'neutral: enemy rolled once')
}

// ── resolvePair: value decreases ───────────────────────────────────────────
console.log('\n[resolvePair — value mutation]')
{
  const p = { id:'p', rps:'paper', value:10, role:'attack' }
  const e = { id:'e', rps:'scissors', value:3, role:'attack' }  // paper loses to scissors
  // enemy has advantage
  const pb = [null, p, null]
  const eb = [null, e, null]
  const r = resolvePair(p, e, pb, eb, 1, 1)
  assert(r.rps === 'disadvantage', 'player should be at disadvantage')
  assert(p.value < 10, `player value should have decreased from 10 (now ${p.value})`)
  assert(p.value === Math.max(0, 10 - r.enemy.dealt), `player.value matches 10 - ${r.enemy.dealt}`)
  assert(e.value === Math.max(0, 3 - r.player.dealt), `enemy.value matches 3 - ${r.player.dealt}`)
}

// ── getResolutionOrder uses placement order ─────────────────────────────────
console.log('\n[getResolutionOrder — placement order]')
{
  initRun()
  // Manually set up boards and placementOrder
  const deck = createDeck()
  const p0 = { ...deck[0], id: 'p0' }
  const p1 = { ...deck[1], id: 'p1' }
  const p2 = { ...deck[2], id: 'p2' }
  const e0 = { ...deck[3] }
  const e1 = { ...deck[4] }
  const e2 = { ...deck[5] }
  gameState.playerBoard = [p0, p1, p2]
  gameState.enemyBoard = [e0, e1, e2]
  // Simulate placing slot 2 first, then slot 0, then slot 1
  gameState.placementOrder = [p2, p0, p1]
  const order = getResolutionOrder()
  assert(JSON.stringify(order) === JSON.stringify([2, 0, 1]),
    `resolution order should be [2,0,1] (got [${order}])`)
}

// ── full round flow ─────────────────────────────────────────────────────────
console.log('\n[full round flow]')
{
  initRun()
  const drawn = drawCards()
  assert(drawn.length > 0, 'drew at least 1 card')
  assert(gameState.phase === 'placement', 'phase is placement after draw')

  // Place all drawn cards
  for (const card of drawn) {
    const emptySlot = gameState.playerBoard.findIndex(s => s === null)
    if (emptySlot !== -1) placeCard(card.id, emptySlot)
  }

  assert(canResolve(), 'canResolve should be true after placing cards')

  const prepared = prepareResolveRound()
  assert(prepared !== null, 'prepareResolveRound returned non-null')
  assert(gameState.phase === 'combat', 'phase is combat after prepare')

  for (const slotIndex of prepared.resolutionOrder) {
    const stepResult = resolveCombatStep(slotIndex)
    assert(!stepResult.skipped, `slot ${slotIndex} was not skipped`)
    assert(typeof stepResult.player.dealt === 'number', `player dealt is a number`)
    assert(typeof stepResult.enemy.dealt === 'number', `enemy dealt is a number`)
  }

  const finalResult = finalizeResolveRound([])
  assert(finalResult !== null, 'finalizeResolveRound returned non-null')
  assert(['continue','win','loss'].includes(finalResult.outcome),
    `outcome is valid: ${finalResult.outcome}`)
  assert(gameState.playerBoard.every(s => s === null), 'player board cleared after round')
}

// ── summary ─────────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(50)}`)
console.log(`Passed: ${passed}  Failed: ${failed}`)
if (failed > 0) process.exit(1)
```

- [ ] **Step 2: Run tests**

```bash
node tests/game-logic-smoke.mjs
```
Expected: all tests pass, `Failed: 0`

- [ ] **Step 3: Fix any failures**

If tests fail, read the error message, fix the corresponding logic in the relevant file (combat.js, game.js, buffs.js), re-run. Do not move on until all tests pass.

- [ ] **Step 4: Commit**

```bash
git add tests/game-logic-smoke.mjs
git commit -m "tests: rewrite smoke tests for dice-based RPS combat system"
```

---

## Self-Review

### Spec Coverage Check

| Spec requirement | Covered by |
|-----------------|-----------|
| Card has 1 value (not ATK+HP) | Task 2 (cards-data), Task 5 (game.js removes hp), Task 6 (renderer) |
| Value = HP and attack range ceiling | Task 4 (combat.js — card.value used as roll ceiling and health) |
| All cards placed → Resolve → battles begin | Task 5 (canResolve unchanged), unchanged UI flow |
| Battle order = player placement order | Task 5 (getResolutionOrder), Task 7 (markers) |
| 1st/2nd/3rd markers between slots | Task 7 (main.js + CSS) |
| Value = roll range (value 7 → roll 1-7) | Task 4 (roll function) |
| Both cards in slot roll | Task 4 (resolvePair rolls both sides) |
| Attack subtracts from opponent's value | Task 4 (card.value mutated), Task 5 (death check on value) |
| value ≤ 0 → Cemetery | Task 5 (finalizeResolveRound) |
| RPS winner rolls 2, picks higher | Task 4 (rollAdvantage) |
| RPS loser rolls 1 | Task 4 (roll once for loser) |
| RPS neutral: both roll 1, take min, both take that damage | Task 4 (neutral branch) |
| Attack role: +1 to rolled value | Task 4 (applyAttackerRole) |
| Defense role: −1 to incoming attack | Task 4 (applyDefenderRole) |
| Support role: +1 to adjacent cards' value range | Task 3 (getSupportBonus), Task 4 (effectiveRange) |
| New deck values 3–10 | Task 2 (12 cards, values 3–9) |

### Placeholder Scan

No TBD, TODO, "fill in details", or "similar to Task N" found.

### Type Consistency

- `resolvePair(playerCard, enemyCard, playerBoard, enemyBoard, playerSlot, enemySlot)` — used consistently in Task 4 (definition) and Task 5 (call site in `resolveCombatStep`).
- `card.value` (not `card.hp`) — used consistently in Tasks 2, 4, 5, 6.
- `getSupportBonus(board, slotIndex)` — defined in Task 3, used in Task 4 (`effectiveRange`).
- `getRpsResult` — same signature as before, unchanged.

---

**Plan complete and saved to `docs/superpowers/plans/2026-04-06-rps-dice-redesign.md`.**
