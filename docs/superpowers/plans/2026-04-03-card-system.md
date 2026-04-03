# Card System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a browser-based card interaction system with smooth drag, tilt, and slot-snap using plain HTML/CSS/JS + GSAP.

**Architecture:** Vanilla ES modules loaded via `<script type="module">`. Config files export plain objects consumed by `main.js` (rendering) and `interactions.js` (GSAP logic). No build step — run with any local HTTP server (`npx serve .` or VS Code Live Server).

**Tech Stack:** HTML5, CSS3, vanilla JS (ES modules), GSAP 3 + Draggable plugin (CDN)

---

## File Map

| File | Responsibility |
|------|---------------|
| `index.html` | DOM shell: board, card container, slot container |
| `css/style.css` | Card, slot, board visual styles; `slot--active`, `card--lifted` classes |
| `config/card.config.js` | Card dimensions, colors, shadows, typography |
| `config/anim.config.js` | GSAP timing, easing, tilt degrees, snap radius |
| `config/layout.config.js` | Board background, slot positions |
| `js/main.js` | State object, `renderCards()`, `renderSlots()`, boot |
| `js/interactions.js` | `initDrag(cardEl)`, slot proximity check, z-index counter |
| `tests/test.html` | In-browser unit tests via `console.assert()` for pure logic |

---

## Task 1: Config files

**Files:**
- Create: `config/card.config.js`
- Create: `config/anim.config.js`
- Create: `config/layout.config.js`

- [ ] **Step 1: Create `config/card.config.js`**

```js
export const CARD = {
  width: 120,
  height: 168,
  borderRadius: 8,
  bgColor: '#f5f0e8',
  outlineColor: '#333',
  outlineWidth: 1,
  slotOutlineColor: '#f0c040',
  fontSize: 14,
  padding: 8,
  shadow: '4px 8px 16px rgba(0,0,0,0.25)',
  shadowLifted: '8px 16px 32px rgba(0,0,0,0.4)',
}
```

- [ ] **Step 2: Create `config/anim.config.js`**

```js
export const ANIM = {
  liftScale: 1.05,
  tiltMax: 6,
  snapDuration: 0.3,
  snapEase: 'back.out(1.4)',
  liftDuration: 0.15,
  slotSnapRadius: 60,
}
```

- [ ] **Step 3: Create `config/layout.config.js`**

```js
export const LAYOUT = {
  boardBg: '#2d5a27',
  slots: [
    { id: 'slot-1', x: 300, y: 200 },
    { id: 'slot-2', x: 500, y: 200 },
    { id: 'slot-3', x: 700, y: 200 },
  ],
}
```

- [ ] **Step 4: Commit**

```bash
git add config/
git commit -m "feat: add config files for card, animation, and layout parameters"
```

---

## Task 2: HTML shell

**Files:**
- Create: `index.html`

- [ ] **Step 1: Create `index.html`**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Card System</title>
  <link rel="stylesheet" href="css/style.css" />
</head>
<body>
  <div id="board">
    <div id="slots"></div>
    <div id="cards"></div>
  </div>

  <!-- GSAP from CDN -->
  <script src="https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/gsap.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/Draggable.min.js"></script>

  <script type="module" src="js/main.js"></script>
</body>
</html>
```

- [ ] **Step 2: Verify** — open with local server (`npx serve .` then visit `http://localhost:3000`). Page loads without console errors.

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "feat: add HTML shell with board, cards, and slots containers"
```

---

## Task 3: CSS — board, cards, slots

**Files:**
- Create: `css/style.css`

- [ ] **Step 1: Create `css/style.css`**

```css
*, *::before, *::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  overflow: hidden;
  background: #1a1a1a;
}

#board {
  position: relative;
  width: 100vw;
  height: 100vh;
  /* background set by JS from layout.config.js */
}

/* Cards */
.card {
  position: absolute;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: grab;
  user-select: none;
  /* width, height, borderRadius, bgColor, shadow set by JS from card.config.js */
  will-change: transform;
  transition: box-shadow 0.15s ease;
}

.card:active {
  cursor: grabbing;
}

.card__face {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background-size: cover;
  background-position: center;
  border-radius: inherit;
  overflow: hidden;
}

/* Slots */
.slot {
  position: absolute;
  border-style: dashed;
  border-radius: inherit;
  /* width, height, borderRadius, outlineColor, outlineWidth set by JS */
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.slot--active {
  /* slotOutlineColor applied by JS */
  box-shadow: 0 0 12px 2px var(--slot-highlight-color, #f0c040);
}

.slot--occupied {
  border-style: solid;
  opacity: 0.5;
}
```

- [ ] **Step 2: Verify** — page still loads without errors. Board fills viewport (dark background visible).

- [ ] **Step 3: Commit**

```bash
git add css/style.css
git commit -m "feat: add base CSS for board, cards, and slot states"
```

---

## Task 4: Render cards and slots (main.js)

**Files:**
- Create: `js/main.js`

- [ ] **Step 1: Write the test first** — create `tests/test.html`

```html
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8" /><title>Tests</title></head>
<body>
<script type="module">
import { createCardEl, createSlotEl } from '../js/main.js'
import { CARD } from '../config/card.config.js'
import { LAYOUT } from '../config/layout.config.js'

// Test: createCardEl returns a div with correct data-id
const card = { id: 'card-test', face: 'A', back: '#ccc', flipped: false }
const el = createCardEl(card)
console.assert(el.tagName === 'DIV', 'card element is a div')
console.assert(el.dataset.id === 'card-test', 'card data-id matches')
console.assert(el.classList.contains('card'), 'card has .card class')
console.assert(el.style.width === CARD.width + 'px', 'card width matches config')

// Test: createSlotEl returns a div with correct data-id and position
const slot = LAYOUT.slots[0]
const slotEl = createSlotEl(slot)
console.assert(slotEl.tagName === 'DIV', 'slot element is a div')
console.assert(slotEl.dataset.id === slot.id, 'slot data-id matches')
console.assert(slotEl.classList.contains('slot'), 'slot has .slot class')
console.assert(slotEl.style.left === slot.x + 'px', 'slot x position correct')
console.assert(slotEl.style.top === slot.y + 'px', 'slot y position correct')

console.log('All tests passed ✓')
</script>
</body>
</html>
```

- [ ] **Step 2: Run test** — open `tests/test.html` in browser. Expected: import error (main.js does not exist yet). This confirms the test is running and will fail correctly.

- [ ] **Step 3: Create `js/main.js`**

```js
import { CARD } from '../config/card.config.js'
import { LAYOUT } from '../config/layout.config.js'
import { initDrag } from './interactions.js'

export const state = {
  deck: [],
  hand: [
    { id: 'card-1', face: '♠ A', back: '#8b0000', flipped: false },
    { id: 'card-2', face: '♥ K', back: '#8b0000', flipped: false },
    { id: 'card-3', face: '♣ Q', back: '#8b0000', flipped: false },
    { id: 'card-4', face: '♦ J', back: '#8b0000', flipped: false },
  ],
  table: [],
}

export function createCardEl(card) {
  const el = document.createElement('div')
  el.className = 'card'
  el.dataset.id = card.id

  el.style.width = CARD.width + 'px'
  el.style.height = CARD.height + 'px'
  el.style.borderRadius = CARD.borderRadius + 'px'
  el.style.backgroundColor = CARD.bgColor
  el.style.outline = `${CARD.outlineWidth}px solid ${CARD.outlineColor}`
  el.style.fontSize = CARD.fontSize + 'px'
  el.style.padding = CARD.padding + 'px'
  el.style.boxShadow = CARD.shadow
  el.style.zIndex = 1

  const face = document.createElement('div')
  face.className = 'card__face'
  if (card.face && card.face.startsWith('http')) {
    face.style.backgroundImage = `url(${card.face})`
  } else {
    face.textContent = card.face
  }
  el.appendChild(face)

  return el
}

export function createSlotEl(slot) {
  const el = document.createElement('div')
  el.className = 'slot'
  el.dataset.id = slot.id

  el.style.width = CARD.width + 'px'
  el.style.height = CARD.height + 'px'
  el.style.borderRadius = CARD.borderRadius + 'px'
  el.style.left = slot.x + 'px'
  el.style.top = slot.y + 'px'
  el.style.borderColor = CARD.outlineColor
  el.style.borderWidth = '2px'
  el.style.setProperty('--slot-highlight-color', CARD.slotOutlineColor)

  return el
}

function init() {
  const board = document.getElementById('board')
  board.style.background = LAYOUT.boardBg

  // Render slots
  const slotsContainer = document.getElementById('slots')
  LAYOUT.slots.forEach(slot => {
    slotsContainer.appendChild(createSlotEl(slot))
  })

  // Render hand cards — spread horizontally at bottom
  const cardsContainer = document.getElementById('cards')
  const startX = 80
  const startY = window.innerHeight - CARD.height - 60
  state.hand.forEach((card, i) => {
    const el = createCardEl(card)
    el.style.left = (startX + i * (CARD.width + 16)) + 'px'
    el.style.top = startY + 'px'
    cardsContainer.appendChild(el)
    initDrag(el)
  })
}

init()
```

- [ ] **Step 4: Run test** — open `tests/test.html`. Expected in console: `All tests passed ✓`

- [ ] **Step 5: Verify in browser** — open `index.html`. Cards visible at bottom of board, slots visible on board.

- [ ] **Step 6: Commit**

```bash
git add js/main.js tests/test.html
git commit -m "feat: render cards and slots from state and config"
```

---

## Task 5: Lift interaction (pointerdown / pointerup)

**Files:**
- Create: `js/interactions.js`

- [ ] **Step 1: Write the test** — add to `tests/test.html`, inside the `<script type="module">` block, after existing tests:

```js
import { getTopZIndex, bumpZIndex } from '../js/interactions.js'

// Test: bumpZIndex increments and returns new top value
const z1 = bumpZIndex()
const z2 = bumpZIndex()
console.assert(z2 > z1, 'bumpZIndex increments z-index counter')
console.assert(typeof z1 === 'number', 'bumpZIndex returns a number')
console.log('Z-index tests passed ✓')
```

- [ ] **Step 2: Run test** — open `tests/test.html`. Expected: import error for `interactions.js`. Confirms test will fail correctly.

- [ ] **Step 3: Create `js/interactions.js`** with lift, z-index, and stub for drag

```js
import { CARD } from '../config/card.config.js'
import { ANIM } from '../config/anim.config.js'

let _zCounter = 10

export function getTopZIndex() {
  return _zCounter
}

export function bumpZIndex() {
  _zCounter += 1
  return _zCounter
}

export function initDrag(cardEl) {
  cardEl.addEventListener('pointerdown', () => {
    gsap.to(cardEl, {
      scale: ANIM.liftScale,
      boxShadow: CARD.shadowLifted,
      duration: ANIM.liftDuration,
      ease: 'power2.out',
    })
    cardEl.style.zIndex = bumpZIndex()
  })

  cardEl.addEventListener('pointerup', () => {
    gsap.to(cardEl, {
      scale: 1,
      boxShadow: CARD.shadow,
      duration: ANIM.liftDuration,
      ease: 'power2.out',
    })
  })
}
```

- [ ] **Step 4: Run test** — open `tests/test.html`. Expected: `All tests passed ✓` and `Z-index tests passed ✓`

- [ ] **Step 5: Verify in browser** — open `index.html`. Click a card: it scales up and shadow deepens. Release: returns to normal.

- [ ] **Step 6: Commit**

```bash
git add js/interactions.js
git commit -m "feat: add card lift effect on pointerdown with z-index management"
```

---

## Task 6: Drag + tilt

**Files:**
- Modify: `js/interactions.js`

- [ ] **Step 1: Write the test** — add to `tests/test.html` inside the script block:

```js
import { calcTilt } from '../js/interactions.js'

// calcTilt(dx, tiltMax) → clamped rotation degrees
console.assert(calcTilt(100, 6) === 6, 'clamps positive tilt to tiltMax')
console.assert(calcTilt(-100, 6) === -6, 'clamps negative tilt to -tiltMax')
console.assert(calcTilt(0, 6) === 0, 'no movement = no tilt')
// dx=30 → tilt proportional, capped at ±6
const mid = calcTilt(30, 6)
console.assert(mid > 0 && mid <= 6, 'positive dx gives positive tilt within range')
console.log('Tilt tests passed ✓')
```

- [ ] **Step 2: Run test** — open `tests/test.html`. Expected: import error for `calcTilt` (not exported yet).

- [ ] **Step 3: Update `js/interactions.js`** — replace full file content with drag + tilt added:

```js
import { CARD } from '../config/card.config.js'
import { ANIM } from '../config/anim.config.js'

let _zCounter = 10

export function getTopZIndex() {
  return _zCounter
}

export function bumpZIndex() {
  _zCounter += 1
  return _zCounter
}

/**
 * Returns tilt angle in degrees based on horizontal drag velocity.
 * Clamped to ±tiltMax.
 */
export function calcTilt(dx, tiltMax) {
  const normalized = Math.max(-1, Math.min(1, dx / 80))
  return normalized * tiltMax
}

export function initDrag(cardEl) {
  let prevX = 0

  cardEl.addEventListener('pointerdown', (e) => {
    prevX = e.clientX
    gsap.to(cardEl, {
      scale: ANIM.liftScale,
      boxShadow: CARD.shadowLifted,
      duration: ANIM.liftDuration,
      ease: 'power2.out',
    })
    cardEl.style.zIndex = bumpZIndex()
  })

  Draggable.create(cardEl, {
    type: 'x,y',
    onDrag() {
      const dx = this.x - (this.vars._prevDragX ?? this.x)
      this.vars._prevDragX = this.x
      gsap.set(cardEl, { rotateZ: calcTilt(dx, ANIM.tiltMax) })
    },
    onDragEnd() {
      gsap.to(cardEl, {
        rotateZ: 0,
        scale: 1,
        boxShadow: CARD.shadow,
        duration: ANIM.snapDuration,
        ease: ANIM.snapEase,
      })
      checkSlotProximity(cardEl)
    },
  })
}

function checkSlotProximity(cardEl) {
  // stub — implemented in Task 7
}
```

- [ ] **Step 4: Run test** — open `tests/test.html`. Expected: `All tests passed ✓`, `Z-index tests passed ✓`, `Tilt tests passed ✓`

- [ ] **Step 5: Verify in browser** — drag a card: it tilts left/right during movement, snaps back to upright on release.

- [ ] **Step 6: Commit**

```bash
git add js/interactions.js
git commit -m "feat: add GSAP Draggable with directional tilt during drag"
```

---

## Task 7: Slot proximity highlight + snap

**Files:**
- Modify: `js/interactions.js`

- [ ] **Step 1: Write the test** — add to `tests/test.html` inside the script block:

```js
import { getDistance } from '../js/interactions.js'

// getDistance({x,y}, {x,y}) → Euclidean distance
console.assert(getDistance({ x: 0, y: 0 }, { x: 3, y: 4 }) === 5, '3-4-5 triangle')
console.assert(getDistance({ x: 0, y: 0 }, { x: 0, y: 0 }) === 0, 'same point = 0')
console.log('Distance tests passed ✓')
```

- [ ] **Step 2: Run test** — open `tests/test.html`. Expected: import error for `getDistance`.

- [ ] **Step 3: Update `js/interactions.js`** — replace full file content with slot logic added:

```js
import { CARD } from '../config/card.config.js'
import { ANIM } from '../config/anim.config.js'

let _zCounter = 10

export function getTopZIndex() {
  return _zCounter
}

export function bumpZIndex() {
  _zCounter += 1
  return _zCounter
}

export function calcTilt(dx, tiltMax) {
  const normalized = Math.max(-1, Math.min(1, dx / 80))
  return normalized * tiltMax
}

export function getDistance(a, b) {
  return Math.sqrt(Math.pow(b.x - a.x, 2) + Math.pow(b.y - a.y, 2))
}

function getCardCenter(cardEl) {
  const rect = cardEl.getBoundingClientRect()
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
}

function getSlotCenter(slotEl) {
  const rect = slotEl.getBoundingClientRect()
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
}

function clearSlotHighlights() {
  document.querySelectorAll('.slot--active').forEach(el => el.classList.remove('slot--active'))
}

function findNearestFreeSlot(cardCenter) {
  let nearest = null
  let nearestDist = Infinity

  document.querySelectorAll('.slot:not(.slot--occupied)').forEach(slotEl => {
    const dist = getDistance(cardCenter, getSlotCenter(slotEl))
    if (dist < ANIM.slotSnapRadius && dist < nearestDist) {
      nearest = slotEl
      nearestDist = dist
    }
  })

  return nearest
}

function snapCardToSlot(cardEl, slotEl) {
  const slotRect = slotEl.getBoundingClientRect()
  const boardRect = document.getElementById('board').getBoundingClientRect()

  const targetX = slotRect.left - boardRect.left
  const targetY = slotRect.top - boardRect.top

  gsap.to(cardEl, {
    x: 0,
    y: 0,
    left: targetX,
    top: targetY,
    rotateZ: 0,
    scale: 1,
    boxShadow: CARD.shadow,
    duration: ANIM.snapDuration,
    ease: ANIM.snapEase,
    onComplete() {
      slotEl.classList.add('slot--occupied')
      cardEl.dataset.slotId = slotEl.dataset.id
    },
  })
}

export function initDrag(cardEl) {
  cardEl.addEventListener('pointerdown', () => {
    // If card was in a slot, free it
    if (cardEl.dataset.slotId) {
      const prevSlot = document.querySelector(`.slot[data-id="${cardEl.dataset.slotId}"]`)
      if (prevSlot) prevSlot.classList.remove('slot--occupied')
      delete cardEl.dataset.slotId
    }

    gsap.to(cardEl, {
      scale: ANIM.liftScale,
      boxShadow: CARD.shadowLifted,
      duration: ANIM.liftDuration,
      ease: 'power2.out',
    })
    cardEl.style.zIndex = bumpZIndex()
  })

  Draggable.create(cardEl, {
    type: 'x,y',
    onDrag() {
      const dx = this.x - (this.vars._prevDragX ?? this.x)
      this.vars._prevDragX = this.x
      gsap.set(cardEl, { rotateZ: calcTilt(dx, ANIM.tiltMax) })

      // Highlight nearest free slot during drag
      const cardCenter = getCardCenter(cardEl)
      clearSlotHighlights()
      const nearest = findNearestFreeSlot(cardCenter)
      if (nearest) nearest.classList.add('slot--active')
    },
    onDragEnd() {
      clearSlotHighlights()
      const cardCenter = getCardCenter(cardEl)
      const nearest = findNearestFreeSlot(cardCenter)

      if (nearest) {
        snapCardToSlot(cardEl, nearest)
      } else {
        gsap.to(cardEl, {
          rotateZ: 0,
          scale: 1,
          boxShadow: CARD.shadow,
          duration: ANIM.snapDuration,
          ease: ANIM.snapEase,
        })
      }
    },
  })
}
```

- [ ] **Step 4: Run test** — open `tests/test.html`. Expected: all previous tests pass + `Distance tests passed ✓`

- [ ] **Step 5: Verify in browser:**
  - Drag a card near a slot: slot highlights in gold
  - Drop on slot: card snaps with spring animation
  - Pick card back up: slot becomes free again
  - Drop away from slot: card stays in place

- [ ] **Step 6: Commit**

```bash
git add js/interactions.js
git commit -m "feat: add slot proximity highlight and spring snap on drop"
```

---

## Task 8: Final polish pass

**Files:**
- Modify: `css/style.css`
- Modify: `index.html` (meta, title, favicon optional)

- [ ] **Step 1: Add font and cursor polish to `css/style.css`** — append at end of file:

```css
/* Polish */
.card {
  font-family: Georgia, 'Times New Roman', serif;
  font-weight: bold;
  color: #1a1a1a;
}

.slot {
  pointer-events: none;
}

/* Prevent text selection during drag */
#board {
  user-select: none;
}

/* Smooth slot highlight transition */
.slot--active {
  border-color: var(--slot-highlight-color, #f0c040);
  border-style: solid;
}
```

- [ ] **Step 2: Verify in browser** — full interaction flow works cleanly. No visual glitches.

- [ ] **Step 3: Commit**

```bash
git add css/style.css
git commit -m "feat: polish card typography and slot interaction styles"
```

---

## Self-Review Checklist

**Spec coverage:**
- [x] Each card is a separate DOM entity — Task 4
- [x] Pick up, move, place in any location — Tasks 5, 6
- [x] Last placed card on top — z-index bump in Task 5
- [x] Lifted card: scale up + shadow — Task 5
- [x] 2D tilt trick during drag — Task 6
- [x] Slot with snap — Task 7
- [x] Slot highlight on proximity — Task 7
- [x] One card per slot — Task 7 (`slot--occupied`)
- [x] All parameters in config files — Task 1
- [x] Card background-image support — Task 4 (`card__face` with `backgroundImage`)
- [x] Board background configurable — Task 4 (`LAYOUT.boardBg`)
- [x] Simple shapes with room for graphics — Tasks 3, 4

**Out of scope confirmed excluded:** deck draw pile, card flip, multi-select, game rules.
