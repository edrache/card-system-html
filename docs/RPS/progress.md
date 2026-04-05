# Game Prototype — Implementation Progress

Branch: `feature/game-RPS`  
Plan source: `docs/prototype-implementation-plan.md`

---

## Block A — Pure Logic ✅

**Goal:** Pure functions that can be tested in the console, without DOM dependencies.

| File | Status | Notes |
|---|---|---|
| `config/game.config.js` | ✅ done | All game constants (RPS_MODIFIER, ATTACK_BONUS, etc.) |
| `js/cards-data.js` | ✅ done | 10 prototype cards with full definitions (id, rps, value, role, effect, hp, buffs) |
| `js/combat.js` | ✅ done | getRpsResult, calcDamage, applyDamage, resolvePair — pure functions |

**Decisions:**
- There are 10 cards, not 9 as incorrectly stated in the original plan — the full list is in `cards-data.js`
- `calcDamage` accounts for: RPS modifier, attack/defense roles, and card effects (Opportunist, Shield, Reactive Guard, Glass Cannon)
- Minimum damage = 0 (combat cannot heal)

---

## Block B — DOM And Layout ✅

**Goal:** New HTML structure and visual layout verified in the browser before wiring in game logic.

| File | Status | Notes |
|---|---|---|
| `index.html` | ✅ done | New structure: `#enemy-board`, `#player-board`, `#hud`, `#overlay` |
| `config/layout.config.js` | ✅ done | Removed hardcoded x/y, added `cardGap` + `enemySlotRowY` / `playerSlotRowY` |
| `css/style.css` | ✅ done | New styles: `enemy-slot`, `#hud`, `#btn-resolve`, `#overlay`, RPS slot highlights |
| `js/main.js` | ✅ done (partial) | `calcSlotRow()` — dynamic viewport-based slot centering |
| `js/interactions.js` | ✅ done (patch) | `findNearestFreeSlot` filters `.enemy-slot` — player cards cannot snap into enemy slots |

**Decisions:**
- `#enemy-board` / `#player-board` containers use `inset: 0` — they are z-index groups, not literal 50/50 screen splits
- Slot positions are calculated dynamically in `main.js` from `window.innerWidth` / `window.innerHeight`
- Enemy slots: `enemySlotRowY: 0.12` (~12% from the top)
- Player slots: `playerSlotRowY: 0.44` (~44% from the top)
- Player hand: `window.innerHeight - CARD.height - 50`

---

## Block C — Game State + Enemy ✅

**Goal:** Central game-state logic and enemy deck behavior.

| File | Status | Notes |
|---|---|---|
| `js/enemy.js` | ✅ done | `shuffleDeck` (Fisher-Yates), `createEnemyDeck`, `enemyRefillBoard` |
| `js/game.js` | ✅ done | `gameState`, `initRun`, `drawCards`, `placeCard`, `unplaceCard`, `canResolve`, `resolveRound` |

**Decisions:**
- `placeCard()` checks the first-card bonus on placement — if a card is taken back, the bonus is cleared
- After `resolveRound()`: surviving player cards return to hand, enemy board refills
- End conditions: no player cards = loss, no enemy cards = win
- Round results are logged to `console.log` (UI was added later in Block D)

---

## Block D — Wiring ✅

**Goal:** Connect game logic to the DOM.

| File | Status | Notes |
|---|---|---|
| `js/interactions.js` | ✅ done | Added callbacks: `onSnap(slotEl, cardEl)` and `onUnsnap(slotEl, cardEl)` to `initDrag()` |
| `js/main.js` | ✅ done | Wired in `game.js` — `initRun`, `drawCards`, `placeCard`, `resolveRound`; `renderHand`, `renderEnemyBoard` |
| `js/ui.js` | ✅ done | `syncResolveButton`, `updateRoundCounter`, `setCardHpLabel`, `showOverlay`, `logRoundResult` |

**Decisions:**
- `onSnap` → `placeCard()`, `onUnsnap` → `unplaceCard()` — game state and DOM are always kept in sync
- Enemy cards render without drag behavior (`cursor: default`, no `initDrag`)
- At this stage round results were only visible in `console.log`
- Win/loss uses the overlay; loss → full page reload (full restart)

**Checkpoint:** ✅ Game starts, cards are draggable, Resolve is enabled when 3 slots are filled, results appear in the console

---

## Outside The Original Plan — Visual Polish ✅

Visual changes requested outside the original block order.

### New card look
| File | Change |
|---|---|
| `index.html` | New fonts: Bricolage Grotesque + Barlow Condensed |
| `js/cards-data.js` | Added `effectText` to all 10 cards |
| `js/main.js` | Rewrote `createCardEl` — new layout: name on top, RPS icon in the center, effect on the bottom |
| `css/style.css` | New classes: `.card__top`, `.card__name`, `.card__role`, `.card__mid`, `.card__rps-icon`, `.card__bot`, `.card__effect`, `.card__hp` |

**Fonts:**
- `Bricolage Grotesque` 700 — card name (top)
- `Barlow Condensed` italic — effect text (bottom), role tag, preview overlay
- `IM Fell English SC` — HUD, round counter, rules panel

### Enemy card red tint
- `.card--enemy` — background `oklch(91% 0.025 15)` (a light rose-cream tint)
- Name and HP use a warmer reddish palette
- Passed through `createCardEl(card, isEnemy = true)`

### Placement preview overlay
Appears on a player card after it snaps into a slot (disappears when picked up again):
- `↑ WIN` / `= TIE` / `↓ LOSE` — RPS outcome (green / gold / red)
- `+X buff` — first-card bonus if applicable
- `11 ↔ 5` — damage dealt ↔ damage taken
- `♥ 6 → 1` — HP after combat (green = survives, red = dies)

**Implementation:** `showPlacementPreview(cardEl, playerCard, slotIndex)` and `clearPlacementPreview(cardEl)` in `main.js`. Uses read-only `calcDamage` against the current game state (after first-card bonus has been applied).

### Column Y reordering
Columns (enemy slot + player slot pair) are sorted by enemy strength each round:
- Strongest enemy → highest on screen (negative y offset)
- Weakest / empty slot → lowest (positive y offset)
- Ties = same Y position
- Animated with GSAP (`power2.inOut`, `0.65s`)
- Spread: `±55px` from the base position (`110px` max between columns)

**Implementation:** `reorderColumns()` in `main.js`. Called after `initRun()` and after each `resolveRound()`. Tracks `playerSlotEls[]`, `enemySlotEls[]`, `enemyCardEls[]` as ref arrays indexed by slot number.

**Ranking formula:** dense rank by strength (`value + buffs`), empty slots always last. Offset = `(rank / maxRank) * 2 * SPREAD - SPREAD`.

### Rules panel
`<aside id="rules-panel">` — fixed panel on the left side of the board (`160px` wide):
- Sections: Flow, Combat, First Card, Column Order, RPS
- Font: `IM Fell English SC` (titles) + `Barlow Condensed` (body text)
- Color: subtle and matched to the board (`oklch(70% 0.03 265 / 0.45)`)
- `pointer-events: none` — does not block gameplay

---

## Block E — Player Loop (Phase 2) 🔲

| Task | Status |
|---|---|
| `drawCards()` — draw cards into hand | ✅ (implemented in `game.js` in Block C) |
| Hand rendering (`createCardEl` with game cards) | ✅ (implemented in `main.js` in Block D) |
| Placement confirmation (`gameState.playerBoard[slotIndex] = card`) | ✅ (implemented in `game.js` in Block C) |
| Tracking `placementOrder` (first-card bonus) | ✅ (implemented in `game.js` in Block C) |
| `applyPlacementBonus()` | ✅ (implemented in `game.js` in Block C) |
| Resolve button active when all slots are filled | ✅ (`syncResolveButton` in `ui.js`) |

> Block E was effectively completed during Blocks C and D. The game is playable end-to-end.

**Checkpoint:** ✅ Game is playable from start to finish for a single encounter

---

## Block F — Support And Buff System (Phase 4) 🔲

| Task | Status |
|---|---|
| `getAdjacentAllies()` in `combat.js` | ✅ |
| `activateSupportOnPlacement()` | ✅ |
| `activateSupportPostCombat()` | ✅ |
| Edge case: Fragile Buffer (`buffAmount: 2`) | ✅ |
| Edge case: Persistent Buffer (ghostBuffer after death) | 🔲 |

---

## Block G — HP Persistence (Phase 5) 🔲

| Task | Status |
|---|---|
| `card.hp` does not reset between rounds | ✅ (`game.js` keeps hp in-place — cards are mutated in place) |
| Death check — remove dead cards from board + DOM | ✅ (`resolveRound` in `game.js`) |
| Surviving cards return to the player's hand | ✅ (`resolveRound` in `game.js`) |
| Re-render cards with updated HP | ✅ (after resolve both hand and board render explicit `ATK/HP`) |

---

## Block H — UX Readability (Phase 6) 🔲

| Task | Status |
|---|---|
| Combat preview on placement (projected damage overlay) | ✅ (replaced by a card badge + full hover breakdown) |
| Slot coloring by RPS: green/yellow/red | 🔲 (CSS classes already exist: `.slot--advantage`, `.slot--neutral`, `.slot--disadvantage`) |
| Resolution-order numbering on enemy cards | ✅ (marker `⚔️` + `1st/2nd/3rd`, tied to resolve order) |
| Visible provenance of card modifiers | ✅ |

---

## Block I — Run Structure (Phase 7) 🔲

| Task | Status |
|---|---|
| Reward screen (choose 1 of 3 cards) | 🔲 |
| Defeat screen with Restart | ✅ (loss overlay with `btn-restart` in `main.js`) |
| `game.js resetRun()` | ✅ (`resetRun` implemented, uses `location.reload()`) |

---

## 2026-04-05 Verification + Bugfix

- Fixed a real drag-and-drop regression in `js/interactions.js`: `snapCardToSlot()` called `callbacks.onSnap` without receiving `callbacks`, which caused `ReferenceError: callbacks is not defined` after placing a card.
- Added `tests/game-logic-smoke.mjs` for fast module-level verification of combat, placement bonus, draw flow, round resolution, and win state.
- Added `tests/rps_browser_smoke.py` for Playwright browser smoke coverage of the live prototype: load page, drag 3 cards into slots, assert no page/runtime errors, and confirm `Resolve` becomes enabled.
- Extended `tests/rps_browser_smoke.py` to click `Resolve` and verify post-combat rerender (`Round 2`, new hand, refreshed enemy board, no slotted cards left, no runtime errors).
- Browser smoke passed with artifacts written to `output/browser-smoke/`:
  - `after-placement.png`
  - `after-resolve.png`
  - `state.json` (`slotted_cards: 3`, `resolve_enabled: true`, no console/page errors)

---

## 2026-04-05 Buff Provenance + Support Readability

- Added runtime `buffSources` tracking in `js/buffs.js` so card modifiers are no longer opaque integer mutations; each buff now carries `amount`, `label`, `description`, and `scope`.
- Reworked `game.js` to recalculate temporary placement buffs deterministically after each place/unplace/refill:
  - first-card bonus is now temporary and no longer leaks permanently into later rounds
  - support cards now buff adjacent allies on placement
  - surviving support cards now grant persistent post-combat buffs to adjacent survivors
  - Fragile Buffer now uses `effect.buffAmount` for its stronger adjacency buff
- Added visible value badges to cards in `main.js` / `css/style.css`:
  - base value + active buffs shown as the current value
  - modified values get a highlighted circular badge and `+N` delta chip
  - hover tooltip lists base value, every active modifier source, buff-cap reduction (if any), and current HP
- Browser smoke extended to assert the new value badge + tooltip DOM is present after card placement.
- Module smoke extended to verify:
  - support adjacency buffs are applied
  - first-card bonus is cleared after round resolution
  - post-combat support buffs persist onto surviving cards

**Open follow-up:** `Persistent Buffer` ghost behavior (`persistBuffTurns`) is still not implemented; the current provenance system is ready for it, but death-phase board retention logic still needs to be added.

---

## 2026-04-05 Combat Preview UX Pass

- Removed the old on-card `card__preview` combat overlay from placement; it obscured the card face too much.
- Added a compact persistent combat badge on slotted player cards (`WIN` / `LOSE` / `TRADE` / `CLASH`) so the expected fight result is visible without hover.
- Moved the detailed fight preview into the hover tooltip:
  - player attack breakdown
  - player defense / reduction breakdown
  - enemy attack breakdown
  - HP change for both sides after the projected combat
- Added `getDamageBreakdown()` in `js/combat.js` as the shared source for tooltip combat explanations and future combat-debug UX.

---

## 2026-04-05 Slow Resolve Flow

- Reworked round resolution into a staged flow in `js/game.js`:
  - `prepareResolveRound()` locks the board and captures fight order
  - `resolveCombatStep(slotIndex)` resolves exactly one pair
  - `finalizeResolveRound()` applies cleanup / return-to-hand / enemy refill
  - `resolveRound()` still exists as a compatibility wrapper for logic tests
- Rebuilt the `Resolve` UX in `js/main.js`:
  - the first click starts combat and immediately resolves only the first fight
  - the same button becomes `Continue` for the next fight
  - already resolved slots stop showing projected combat badges
  - the player's hand is interaction-locked during the staged combat flow
- Added step-readability feedback in `css/style.css` + `js/main.js`:
  - the active slot pair gets a dedicated resolve highlight
  - each resolved card shows a short note (`Stays` / `Destroyed`, HP delta, dealt damage)
  - destroyed cards tilt to `30deg` and stay visibly "broken" until cleanup
- Added an end-of-round transition animation:
  - surviving player cards animate from the board back into the hand
  - newly drawn player cards animate in from the bottom-center draw origin
  - newly spawned enemy cards animate in from the top-center draw origin
  - column reordering still runs after the cleanup animation settles
- Extended browser smoke coverage in `tests/rps_browser_smoke.py`:
  - asserts `Resolve -> Continue`
  - verifies first-fight UI state before cleanup
  - clicks through all three fights and confirms that only then the game advances to `Round 2`
- New visual smoke artifact:
  - `output/browser-smoke/after-first-fight.png`

**Verified on 2026-04-05**
- `node tests/game-logic-smoke.mjs`
- `python3 tests/rps_browser_smoke.py`

**Potential follow-up**
- The per-fight note currently overlaps the lower part of the card art by design. If we want a lighter combat readout later, this is the first place to simplify.

## 2026-04-05 Documentation Sync

- Updated `README.md` so the public repo description now matches the staged combat flow shipped in this branch.
- `Current Prototype` now explicitly describes `Resolve -> Continue -> cleanup`.
- README test notes now mention the first-fight staged UI and the new visual artifact `after-first-fight.png`.
- README open work now also includes the possible follow-up to reduce the visual weight of the per-fight result note.

---

## 2026-04-05 ATK / HP Split Branch

- Created branch `feature/rps-atk-hp-split` for the stat-clarity pass.
- Card faces now show explicit `ATK/HP` instead of a single ambiguous number:
  - first number = current attack value used for damage calculation
  - second number = current HP used for survival
- Hover tooltip text updated from generic `Value` wording to explicit `Base ATK` / `Current HP`.
- Tooltip footer now explicitly states that attack buffs do not increase HP.

---

## 2026-04-05 ATK / HP Notation Polish + Board Spacing

- Unified effect text, tooltip copy, and rules panel wording around `ATK/HP` delta notation:
  - attack bonuses shown as `+X/+0`
  - incoming HP loss shown as `+0/-Y`
  - block kept as separate wording instead of forcing it into fake HP text
- Replaced the old `WIN / LOSE / TRADE / CLASH` on-card marker with concrete per-side result text:
  - `ME +0/-X`
  - `EN +0/-Y`
- Improved tooltip formatting:
  - section labels are underlined
  - stat changes render inside thin `1px` framed chips
- Moved the enemy and player rows closer together in `config/layout.config.js`.
- Added per-column fight markers between rows:
  - `⚔️`
  - resolve order label (`1st`, `2nd`, `3rd`)
  - order is now sourced from the same ranking used by `resolveRound()`
- Lowered fight markers below enemy cards and their tooltips in z-order.
- Enemy card tooltips now open below the enemy card; player card tooltips remain above the player card.
- Raised hovered cards above other cards so enemy tooltips are no longer obscured by player cards.

**Current readability state:**
- Card face: quick `ATK/HP`
- Slotted card badge: immediate projected HP deltas for both sides
- Hover: full provenance + combat breakdown
- Column center: fight marker + true resolve order
