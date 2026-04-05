# Card System

A browser-based Rock-Paper-Scissors card combat prototype built with plain HTML/CSS/JS and [GSAP](https://gsap.com/). No build step, no framework.

This is no longer just a drag-and-drop card sandbox. The current branch contains a playable combat loop with enemy rows, card placement, combat resolution, persistent HP, support buffs, and combat-readability UI.

## Current Prototype

Each round works like this:

1. Draw up to 3 player cards.
2. Place all 3 cards into the player row.
3. Click `Resolve` to start combat.
4. Combat plays one ranked column at a time.
5. The same button becomes `Continue` for the next fight.
6. Each fight shows which card stays, how its HP changed, and which card was destroyed.
7. Destroyed cards tilt to show the loss before cleanup.
8. Surviving player cards return to hand, missing cards are drawn, enemy refills, next round begins.
9. If a `Persistent Buffer` dies, it can leave behind a one-round ghost aura in its slot.
10. Clearing the enemy encounter opens a 3-card reward draft before the next fight starts.

## Card Readability

Cards now display explicit `ATK/HP`.

- `ATK` is the current attack value used to calculate outgoing damage.
- `HP` is the current life total used to determine survival.
- Attack buffs do not increase HP.

When a card is placed:

- the card shows a compact per-side projected result badge
- if the player card dies, the `ME` line gets a skull marker
- `Trade` preview switches to the red loss styling when the player card also dies
- hover shows the full combat breakdown
- the center marker between rows shows the real `Resolve` order for that column

When a round is resolved:

- only one fight is shown at a time
- the active column gets a dedicated highlight
- each resolved card gets a short result note
- already-resolved columns stop showing projected combat badges
- the hand is locked until the staged resolve is finished

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
- `Persistent Buffer` ghost aura after death
- Persistent HP between rounds
- Enemy refill after each round
- Reward draft into the next encounter
- Column reordering by enemy strength
- Resolve-order markers (`⚔️`, `1st/2nd/3rd`)
- Staged `Resolve -> Continue` combat flow
- Per-fight survival / destruction notes
- End-of-round return-to-hand and refill animations
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
- projected combat badges render for placed cards
- player-death previews show a skull on the `ME` line
- both true `Lose` and lethal `Trade` previews use the red loss badge styling
- `Resolve` becomes `Continue` after the first fight
- first-fight staged resolve UI appears
- hover UI renders
- enemy tooltip opens below the enemy card
- post-combat rerender succeeds only after all fights finish

Artifacts are written to:

```text
output/browser-smoke/
```

Key visual checkpoints include:

- `before-placement.png`
- `after-placement.png`
- `after-first-fight.png`
- `after-resolve.png`

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

- possible lighter treatment for the per-fight result note if it feels too heavy on card art
