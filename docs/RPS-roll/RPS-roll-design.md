# RPS-Roll Design

## Overview

Each card has a single **value** stat that serves simultaneously as its **hit points** and its **attack range**. When a card takes damage, its value decreases. When value drops to 0 or below, the card is removed from the board and sent to the Cemetery.

---

## Card Stats

| Field | Description |
|-------|-------------|
| `value` | Current HP and attack range ceiling (e.g. value 7 → rolls 1–7) |
| `rps` | Rock / Paper / Scissors symbol |
| `role` | Attack / Defense / Support |

Cards have values ranging from **3 to 10**. There is no separate ATK or HP field.

---

## Turn Structure

1. **Draw** — player draws cards to fill empty hand slots.
2. **Placement** — player drags cards onto the 3 board slots. The order in which cards are placed is recorded.
3. **Resolve** — player clicks Resolve once all cards are placed. Battles begin.
4. **Combat** — each slot pair fights in the order the player placed their cards (1st placed → fights first).
5. **Cleanup** — dead cards go to Cemetery; surviving player cards return to hand; enemy refills its board.

---

## Combat: Dice Rolls

When two cards in the same slot fight, each card **rolls a random integer from 1 to its current value**. The rolled number is the card's attack strength for this fight.

### RPS Determines Roll Strategy

| RPS outcome | Roll rule |
|-------------|-----------|
| **Winner** (RPS advantage) | Rolls **2 numbers** from its range, uses the **higher** one |
| **Loser** (RPS disadvantage) | Rolls **1 number** from its range, uses that number |
| **Draw** (RPS neutral) | Both roll **1 number** each; the **smaller** of the two becomes the damage dealt to **both** cards |

### Applying Damage

- In an advantage/disadvantage fight: each card's attack strength is subtracted from the **opponent's value**.
- In a neutral fight: the shared minimum roll is subtracted from **both cards' values**.
- A card whose value reaches **0 or below** dies and goes to the Cemetery.

---

## Role Abilities

| Role | Effect | Timing |
|------|--------|--------|
| **Attack** | +1 added to the card's rolled attack value | After rolling, before applying |
| **Defense** | −1 subtracted from the incoming attack value | After opponent rolls, before applying |
| **Support** | Adjacent allies gain +1 to their roll range ceiling | Before rolling (widens the range) |

Support's bonus is temporary — it applies only during the combat resolution of the current round.

---

## Battle Order Indicators

When Resolve is clicked, the slots display **1st**, **2nd**, **3rd** labels between the enemy row and the player row, indicating the fight order based on the player's placement sequence.

---

## Card Types (MVP)

Three roles exist in the current MVP:

- **Attack** — offensive role; boosts own rolled damage.
- **Defense** — protective role; reduces incoming damage.
- **Support** — utility role; buffs adjacent cards' attack range.

---

## Example Fight

**Setup:** Player places a value-7 Attack card (rock) in slot 1 first, then fills the other slots.

- Slot 1 fights first (1st placed).
- Enemy in slot 1 has a value-5 Defense card (scissors).
- RPS: rock beats scissors → **player has advantage**.

**Resolution:**
1. Player rolls 2 numbers from range 7, e.g. 4 and 6 → uses **6**. Attack role: +1 → **7 attack**.
2. Enemy Defense role: −1 to incoming → player deals **6** to enemy's value.
3. Enemy rolls 1 number from range 5, e.g. 3 → **3 attack**. No modifiers.
4. Player takes **3** damage.
5. Enemy value: 5 − 6 = **−1 → dies → Cemetery**.
6. Player value: 7 − 3 = **4** (survives, returns to hand next round).

---

## Deck

The starting deck contains **12 cards** with values from 3 to 10:

| Name | RPS | Value | Role |
|------|-----|-------|------|
| Brawler | Rock | 5 | Attack |
| Slasher | Scissors | 7 | Attack |
| Crusher | Paper | 9 | Attack |
| Lunger | Rock | 3 | Attack |
| Bulwark | Paper | 6 | Defense |
| Ironclad | Rock | 8 | Defense |
| Buckler | Scissors | 4 | Defense |
| Mentor | Scissors | 3 | Support |
| Tactician | Paper | 5 | Support |
| Vanguard | Rock | 7 | Support |
| Scout | Scissors | 4 | Support |
| Warden | Paper | 6 | Support |
