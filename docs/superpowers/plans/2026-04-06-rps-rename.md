# RPS Rename — Pressure / Appeal / Positioning Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace all "rock / paper / scissors" terminology with "pressure / appeal / positioning" throughout the codebase, keeping game mechanics identical.

**Architecture:** Pure rename — no logic changes. The win triangle is preserved: pressure beats positioning, positioning beats appeal, appeal beats pressure (direct mapping from rock→pressure, scissors→positioning, paper→appeal). Card `name` fields get new flavour text from the design spec. Three agents work in parallel on non-overlapping file sets.

**Tech Stack:** Vanilla JS (ES modules), HTML, CSS

---

## Naming Reference (all agents must use this)

### Axis mapping

| Old value | New value    | Icon |
|-----------|-------------|------|
| `rock`    | `pressure`  | 🔥   |
| `paper`   | `appeal`    | 🎭   |
| `scissors`| `positioning` | 🧭  |

### Win triangle (unchanged logic, new names)

```js
const RPS_BEATS = {
  pressure:   'positioning',  // was rock beats scissors
  positioning: 'appeal',      // was scissors beats paper
  appeal:      'pressure',    // was paper beats rock
}
```

### Player card new names (by id)

| id          | new name          | rps value   |
|-------------|-------------------|-------------|
| `brawler`   | Break Will        | pressure    |
| `slasher`   | Cut an Opening    | positioning |
| `crusher`   | Crush Doubt       | appeal      |
| `lunger`    | All-In Strike     | pressure    |
| `bulwark`   | Hold Composure    | appeal      |
| `ironclad`  | Stand Unbroken    | pressure    |
| `buckler`   | Slip the Blow     | positioning |
| `mentor`    | Guide the Move    | positioning |
| `tactician` | Shape Intent      | appeal      |
| `vanguard`  | Lead the Charge   | pressure    |
| `scout`     | Mark the Path     | positioning |
| `warden`    | Steady Hearts     | appeal      |

Enemy deck uses the same `id` → same name.

---

## Task A — Core game logic

**Files:**
- Modify: `js/cards-data.js`
- Modify: `js/combat.js`
- Modify: `js/card-renderer.js`
- Modify: `js/main.js`

---

### A1 — Update `js/cards-data.js`

- [ ] **Step 1: Open the file and replace `rps` values and `name` fields in PLAYER_CARD_DEFINITIONS**

Replace the entire `PLAYER_CARD_DEFINITIONS` array:

```js
const PLAYER_CARD_DEFINITIONS = [
  { id: 'brawler',   name: 'Break Will',       rps: 'pressure',    value: 5, role: 'attack',  owner: 'player' },
  { id: 'slasher',   name: 'Cut an Opening',   rps: 'positioning', value: 6, role: 'attack',  owner: 'player' },
  { id: 'crusher',   name: 'Crush Doubt',      rps: 'appeal',      value: 6, role: 'attack',  owner: 'player' },
  { id: 'lunger',    name: 'All-In Strike',    rps: 'pressure',    value: 3, role: 'attack',  owner: 'player' },

  { id: 'bulwark',   name: 'Hold Composure',   rps: 'appeal',      value: 6, role: 'defense', owner: 'player' },
  { id: 'ironclad',  name: 'Stand Unbroken',   rps: 'pressure',    value: 5, role: 'defense', owner: 'player' },
  { id: 'buckler',   name: 'Slip the Blow',    rps: 'positioning', value: 4, role: 'defense', owner: 'player' },

  { id: 'mentor',    name: 'Guide the Move',   rps: 'positioning', value: 3, role: 'support', owner: 'player' },
  { id: 'tactician', name: 'Shape Intent',     rps: 'appeal',      value: 5, role: 'support', owner: 'player' },
  { id: 'vanguard',  name: 'Lead the Charge',  rps: 'pressure',    value: 6, role: 'support', owner: 'player' },
  { id: 'scout',     name: 'Mark the Path',    rps: 'positioning', value: 4, role: 'support', owner: 'player' },
  { id: 'warden',    name: 'Steady Hearts',    rps: 'appeal',      value: 6, role: 'support', owner: 'player' },
]
```

- [ ] **Step 2: Replace `rps` values and `name` fields in ENEMY_CARD_DEFINITIONS**

Replace the entire `ENEMY_CARD_DEFINITIONS` array:

```js
const ENEMY_CARD_DEFINITIONS = [
  { id: 'brawler',   name: 'Break Will',       rps: 'pressure',    value: 5, role: 'attack',  owner: 'enemy' },
  { id: 'slasher',   name: 'Cut an Opening',   rps: 'positioning', value: 5, role: 'attack',  owner: 'enemy' },
  { id: 'crusher',   name: 'Crush Doubt',      rps: 'appeal',      value: 5, role: 'attack',  owner: 'enemy' },
  { id: 'lunger',    name: 'All-In Strike',    rps: 'pressure',    value: 3, role: 'attack',  owner: 'enemy' },

  { id: 'bulwark',   name: 'Hold Composure',   rps: 'appeal',      value: 5, role: 'defense', owner: 'enemy' },
  { id: 'ironclad',  name: 'Stand Unbroken',   rps: 'pressure',    value: 5, role: 'defense', owner: 'enemy' },
  { id: 'buckler',   name: 'Slip the Blow',    rps: 'positioning', value: 4, role: 'defense', owner: 'enemy' },

  { id: 'mentor',    name: 'Guide the Move',   rps: 'positioning', value: 3, role: 'support', owner: 'enemy' },
  { id: 'tactician', name: 'Shape Intent',     rps: 'appeal',      value: 5, role: 'support', owner: 'enemy' },
  { id: 'vanguard',  name: 'Lead the Charge',  rps: 'pressure',    value: 5, role: 'support', owner: 'enemy' },
  { id: 'scout',     name: 'Mark the Path',    rps: 'positioning', value: 4, role: 'support', owner: 'enemy' },
  { id: 'warden',    name: 'Steady Hearts',    rps: 'appeal',      value: 5, role: 'support', owner: 'enemy' },
]
```

- [ ] **Step 3: Update the JSDoc comment above PLAYER_CARD_DEFINITIONS**

Replace:
```js
 * rps: 'rock' | 'paper' | 'scissors'
```
With:
```js
 * rps: 'pressure' | 'appeal' | 'positioning'
```

Do the same for the JSDoc comment above ENEMY_CARD_DEFINITIONS.

- [ ] **Step 4: Commit**

```bash
git add js/cards-data.js
git commit -m "rename: update card rps values and names to pressure/appeal/positioning"
```

---

### A2 — Update `js/combat.js`

- [ ] **Step 1: Replace RPS_BEATS**

Find (lines 3–7):
```js
const RPS_BEATS = {
  rock: 'scissors',
  scissors: 'paper',
  paper: 'rock',
}
```

Replace with:
```js
const RPS_BEATS = {
  pressure:    'positioning',
  positioning: 'appeal',
  appeal:      'pressure',
}
```

- [ ] **Step 2: Commit**

```bash
git add js/combat.js
git commit -m "rename: update RPS_BEATS keys to pressure/appeal/positioning"
```

---

### A3 — Update `js/card-renderer.js`

- [ ] **Step 1: Replace RPS_ICON**

Find (line 3):
```js
const RPS_ICON = { rock: '✊', paper: '✋', scissors: '✌️' }
```

Replace with:
```js
const RPS_ICON = { pressure: '🔥', appeal: '🎭', positioning: '🧭' }
```

- [ ] **Step 2: Commit**

```bash
git add js/card-renderer.js
git commit -m "rename: update card-renderer RPS_ICON to pressure/appeal/positioning"
```

---

### A4 — Update `js/main.js`

- [ ] **Step 1: Replace RPS_ICON**

Find (lines 29–32):
```js
const RPS_ICON = {
  rock: '✊',
  paper: '✋',
  scissors: '✌️',
}
```

Replace with:
```js
const RPS_ICON = {
  pressure:    '🔥',
  appeal:      '🎭',
  positioning: '🧭',
}
```

- [ ] **Step 2: Commit**

```bash
git add js/main.js
git commit -m "rename: update main.js RPS_ICON to pressure/appeal/positioning"
```

---

## Task B — Tutorial JS

**Files:**
- Modify: `js/tutorial.js`

### B1 — Update CARD_LIBRARY in `js/tutorial.js`

- [ ] **Step 1: Replace CARD_LIBRARY entries**

Find (lines 27–40):
```js
const CARD_LIBRARY = new Map([
  ['brawler', { id: 'brawler', name: 'Brawler', rps: 'rock', value: 5, role: 'attack' }],
  ['slasher', { id: 'slasher', name: 'Slasher', rps: 'scissors', value: 7, role: 'attack' }],
  ['crusher', { id: 'crusher', name: 'Crusher', rps: 'paper', value: 9, role: 'attack' }],
  ['lunger', { id: 'lunger', name: 'Lunger', rps: 'rock', value: 3, role: 'attack' }],
  ['bulwark', { id: 'bulwark', name: 'Bulwark', rps: 'paper', value: 6, role: 'defense' }],
  ['ironclad', { id: 'ironclad', name: 'Ironclad', rps: 'rock', value: 8, role: 'defense' }],
  ['buckler', { id: 'buckler', name: 'Buckler', rps: 'scissors', value: 4, role: 'defense' }],
  ['mentor', { id: 'mentor', name: 'Mentor', rps: 'scissors', value: 3, role: 'support' }],
  ['tactician', { id: 'tactician', name: 'Tactician', rps: 'paper', value: 5, role: 'support' }],
  ['vanguard', { id: 'vanguard', name: 'Vanguard', rps: 'rock', value: 7, role: 'support' }],
  ['scout', { id: 'scout', name: 'Scout', rps: 'scissors', value: 4, role: 'support' }],
  ['warden', { id: 'warden', name: 'Warden', rps: 'paper', value: 6, role: 'support' }],
])
```

Replace with:
```js
const CARD_LIBRARY = new Map([
  ['brawler',   { id: 'brawler',   name: 'Break Will',      rps: 'pressure',    value: 5, role: 'attack'  }],
  ['slasher',   { id: 'slasher',   name: 'Cut an Opening',  rps: 'positioning', value: 7, role: 'attack'  }],
  ['crusher',   { id: 'crusher',   name: 'Crush Doubt',     rps: 'appeal',      value: 9, role: 'attack'  }],
  ['lunger',    { id: 'lunger',    name: 'All-In Strike',   rps: 'pressure',    value: 3, role: 'attack'  }],
  ['bulwark',   { id: 'bulwark',   name: 'Hold Composure',  rps: 'appeal',      value: 6, role: 'defense' }],
  ['ironclad',  { id: 'ironclad',  name: 'Stand Unbroken',  rps: 'pressure',    value: 8, role: 'defense' }],
  ['buckler',   { id: 'buckler',   name: 'Slip the Blow',   rps: 'positioning', value: 4, role: 'defense' }],
  ['mentor',    { id: 'mentor',    name: 'Guide the Move',  rps: 'positioning', value: 3, role: 'support' }],
  ['tactician', { id: 'tactician', name: 'Shape Intent',    rps: 'appeal',      value: 5, role: 'support' }],
  ['vanguard',  { id: 'vanguard',  name: 'Lead the Charge', rps: 'pressure',    value: 7, role: 'support' }],
  ['scout',     { id: 'scout',     name: 'Mark the Path',   rps: 'positioning', value: 4, role: 'support' }],
  ['warden',    { id: 'warden',    name: 'Steady Hearts',   rps: 'appeal',      value: 6, role: 'support' }],
])
```

- [ ] **Step 2: Commit**

```bash
git add js/tutorial.js
git commit -m "rename: update tutorial CARD_LIBRARY rps values and card names"
```

---

### B2 — Update tutorial tooltip text in `js/tutorial.js`

There are 6 tooltip strings to update. Make all changes then commit once.

- [ ] **Step 1: Update `card-anatomy` tooltip**

Find:
```js
    tooltip: 'This is a card.\n\nTop: name and role.\nCenter: RPS symbol.\nBadge: current value.\nBottom: role reminder text.',
```

Replace with:
```js
    tooltip: 'This is a card.\n\nTop: name and role.\nCenter: Approach symbol.\nBadge: current value.\nBottom: role reminder text.',
```

- [ ] **Step 2: Update `rps-intro` tooltip**

Find:
```js
    tooltip: 'Rock ✊ beats Scissors ✌️.\nScissors ✌️ beats Paper ✋.\nPaper ✋ beats Rock ✊.\n\nRPS does not add flat damage now. It changes how you roll.',
```

Replace with:
```js
    tooltip: 'Pressure 🔥 beats Positioning 🧭.\nPositioning 🧭 beats Appeal 🎭.\nAppeal 🎭 beats Pressure 🔥.\n\nThe approach does not add flat damage. It changes how you roll.',
```

- [ ] **Step 3: Update `rps-advantage` tooltip**

Find:
```js
    tooltip: 'If your card wins the RPS matchup, it rolls twice and keeps the higher result.\n\nThat is the new advantage rule.',
```

Replace with:
```js
    tooltip: 'If your card wins the approach matchup, it rolls twice and keeps the higher result.\n\nThat is the advantage rule.',
```

- [ ] **Step 4: Update `rps-disadvantage` tooltip**

Find:
```js
    tooltip: 'If your card loses the RPS matchup, it rolls once while the winner gets the stronger roll mode.\n\nBad matchups still matter even on high-value cards.',
```

Replace with:
```js
    tooltip: 'If your card loses the approach matchup, it rolls once while the winner gets the stronger roll mode.\n\nBad matchups still matter even on high-value cards.',
```

- [ ] **Step 5: Update `rps-neutral` tooltip**

Find:
```js
    tooltip: 'On an RPS tie, both sides roll once.\n\nThe lower of those two rolls becomes shared damage dealt to both cards.',
```

Replace with:
```js
    tooltip: 'On an approach tie, both sides roll once.\n\nThe lower of those two rolls becomes shared damage dealt to both cards.',
```

- [ ] **Step 6: Update `summary` tooltip**

Find:
```js
    tooltip: 'Remember the whole system:\n\nValue = HP and roll ceiling.\nRPS changes roll mode.\nRoles bend the math.\nPlacement order decides fight order.',
```

Replace with:
```js
    tooltip: 'Remember the whole system:\n\nValue = HP and roll ceiling.\nApproach changes roll mode.\nRoles bend the math.\nPlacement order decides fight order.',
```

- [ ] **Step 7: Commit**

```bash
git add js/tutorial.js
git commit -m "rename: update tutorial tooltip text from RPS to Approach/Pressure/Appeal/Positioning"
```

---

## Task C — HTML files

**Files:**
- Modify: `index.html`
- Modify: `tutorial.html`

### C1 — Update `index.html`

- [ ] **Step 1: Update Combat rules list (lines 75–77)**

Find:
```html
          <li>RPS winner rolls twice and keeps the higher roll</li>
          <li>RPS loser rolls once</li>
          <li>RPS tie: both roll once, lower roll deals shared damage</li>
```

Replace with:
```html
          <li>Approach winner rolls twice and keeps the higher roll</li>
          <li>Approach loser rolls once</li>
          <li>Approach tie: both roll once, lower roll deals shared damage</li>
```

- [ ] **Step 2: Replace the RPS rules section (lines 98–105)**

Find:
```html
      <section class="rules-section">
        <h3 class="rules-title">RPS</h3>
        <ul class="rules-list">
          <li>✊ beats ✌️</li>
          <li>✌️ beats ✋</li>
          <li>✋ beats ✊</li>
        </ul>
      </section>
```

Replace with:
```html
      <section class="rules-section">
        <h3 class="rules-title">Approach</h3>
        <ul class="rules-list">
          <li>🔥 Pressure beats 🧭 Positioning</li>
          <li>🧭 Positioning beats 🎭 Appeal</li>
          <li>🎭 Appeal beats 🔥 Pressure</li>
        </ul>
      </section>
```

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "rename: update index.html RPS rules section to Approach/Pressure/Appeal/Positioning"
```

---

### C2 — Update `tutorial.html`

- [ ] **Step 1: Replace the RPS rules section (lines 79–88)**

Find:
```html
      <section class="rules-section">
        <h3 class="rules-title">RPS</h3>
        <ul class="rules-list">
          <li>✊ beats ✌️</li>
          <li>✌️ beats ✋</li>
          <li>✋ beats ✊</li>
          <li>Winner rolls twice and keeps the higher result</li>
          <li>Tie: lower roll hits both cards</li>
        </ul>
      </section>
```

Replace with:
```html
      <section class="rules-section">
        <h3 class="rules-title">Approach</h3>
        <ul class="rules-list">
          <li>🔥 Pressure beats 🧭 Positioning</li>
          <li>🧭 Positioning beats 🎭 Appeal</li>
          <li>🎭 Appeal beats 🔥 Pressure</li>
          <li>Winner rolls twice and keeps the higher result</li>
          <li>Tie: lower roll hits both cards</li>
        </ul>
      </section>
```

- [ ] **Step 2: Commit**

```bash
git add tutorial.html
git commit -m "rename: update tutorial.html RPS rules section to Approach/Pressure/Appeal/Positioning"
```

---

## Parallel execution

Tasks A, B, and C touch completely different files and can be dispatched as three independent agents simultaneously.

After all three complete, do a final check:

```bash
grep -r "rock\|paper\|scissors\|✊\|✌️\|✋" js/ index.html tutorial.html
```

Expected output: no matches (except inside CSS comments which don't affect gameplay).
