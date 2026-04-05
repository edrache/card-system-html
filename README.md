# Card System

A browser-based Rock-Paper-Scissors card combat prototype built with plain HTML/CSS/JS and [GSAP](https://gsap.com/). No build step, no framework.

This is no longer just a drag-and-drop card sandbox. The current branch contains a playable combat loop with enemy rows, card placement, combat resolution, persistent HP, support buffs, and combat-readability UI.

## Current Prototype

Each round works like this:

1. Draw up to 3 player cards.
2. Place all 3 cards into the player row.
3. Compare each player card against the enemy card in the same column.
4. Resolve combat in ranked enemy order.
5. Surviving player cards return to hand, enemy refills, next round begins.

## Card Readability

Cards now display explicit `ATK/HP`.

- `ATK` is the current attack value used to calculate outgoing damage.
- `HP` is the current life total used to determine survival.
- Attack buffs do not increase HP.

When a card is placed:

- the card shows a compact per-side projected result badge
- hover shows the full combat breakdown
- the center marker between rows shows the real `Resolve` order for that column

The tooltip system is designed to answer:

- where did this attack value come from?
- what buffs are active?
- how much damage will each side take?
- what block/reduction applies?
- what will the final HP deltas be?

## Implemented Systems

- Drag-and-drop card placement with GSAP
- Snap-to-slot interaction
- Enemy row + player row board layout
- RPS matchup modifier
- Role-based combat:
  - `attack` adds flat attack
  - `defense` adds damage reduction
  - `support` buffs adjacent allies
- First-card placement bonus
- Support placement buffs
- Support post-combat survival buffs
- Persistent HP between rounds
- Enemy refill after each round
- Column reordering by enemy strength
- Resolve-order markers (`⚔️`, `1st/2nd/3rd`)
- Provenance-aware tooltips for buffs and combat

## Getting Started

Requires a local HTTP server because the project uses ES modules.

```bash
python3 -m http.server 4173
```

Then open:

```text
http://127.0.0.1:4173/index.html
```

## Tests

Fast logic smoke:

```bash
node tests/game-logic-smoke.mjs
```

Browser smoke:

```bash
python3 tests/rps_browser_smoke.py
```

The browser smoke verifies:

- page loads without runtime errors
- cards can be dragged into all 3 slots
- `Resolve` enables correctly
- hover UI renders
- enemy tooltip opens below the enemy card
- post-combat rerender succeeds

Artifacts are written to:

```text
output/browser-smoke/
```

## Configuration

Main tuning lives in `config/`.

| File | Controls |
|------|----------|
| `config/card.config.js` | Card size, colors, border, shadows, typography |
| `config/anim.config.js` | Lift/drop/snap timing, easing, tilt, snap radii |
| `config/layout.config.js` | Board spacing, row positions, slot layout |
| `config/game.config.js` | Combat constants, buffs, support values, caps |

If you want to change the distance between the enemy row and the player row, edit:

- `enemySlotRowY`
- `playerSlotRowY`

in `config/layout.config.js`.

## Project Structure

```text
index.html                  page shell, HUD, rules panel
css/
  style.css                 board, cards, tooltips, markers, overlays
config/
  anim.config.js            motion tuning
  card.config.js            card visual parameters
  game.config.js            combat and buff constants
  layout.config.js          row positions and board spacing
js/
  buffs.js                  buff provenance and aggregation
  cards-data.js             card definitions
  combat.js                 combat math and damage breakdown
  enemy.js                  enemy deck and refill
  game.js                   central game state and round resolution
  interactions.js           drag, snap, lift, highlight logic
  main.js                   DOM rendering and UI wiring
  ui.js                     button state, overlays, logging
tests/
  game-logic-smoke.mjs      module-level logic verification
  rps_browser_smoke.py      browser-level smoke coverage
```

## Open Work

Still incomplete:

- `Persistent Buffer` ghost behavior after death
- RPS slot highlight colors during drag
- reward screen / run progression beyond a single encounter
