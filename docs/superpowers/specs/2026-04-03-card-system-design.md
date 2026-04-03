# Card System — Design Spec

**Date:** 2026-04-03  
**Status:** Approved

---

## Overview

A browser-based card interaction system built with plain HTML/CSS/JS and GSAP. The goal is a smooth, physically convincing card UX — cards feel weighted and springy without heavy frameworks. The system is designed to be extended with new elements and config files over time.

---

## File Structure

```
index.html
css/
  style.css           — layout, selectors, slot highlight states
js/
  main.js             — initialization, card rendering
  interactions.js     — GSAP Draggable, snap logic, slot highlight
config/
  card.config.js      — card dimensions, colors, shadows, typography
  anim.config.js      — animation timing, easing, tilt degrees, snap radius
  layout.config.js    — board background, slot positions
```

GSAP and the Draggable plugin are loaded from CDN. No bundler required.

New game elements get their own config file in `config/`.

---

## Data Model

Each card is a plain JS object:

```js
{ id: 'card-1', face: 'url or text', back: 'url or color', flipped: false }
```

Game state is a plain JS object — no framework:

```js
{ deck: [...cards], hand: [...cards], table: [...cards] }
```

Each card maps 1:1 to a DOM element `<div class="card" data-id="card-1">`.

---

## Card Behaviour

Cards have four states:

| State      | Visual effect                                              |
|------------|------------------------------------------------------------|
| `idle`     | Normal size, resting shadow                                |
| `lifted`   | `scale(1.05)`, elevated shadow, `z-index` above others     |
| `dragging` | `rotateZ` ±N° in direction of movement (2D tilt trick)     |
| `snapping` | Animates to slot center (`back.out` easing, spring feel)   |

**Event flow:**
1. `pointerdown` → lift card (scale up, deepen shadow, raise z-index)
2. `pointermove` → GSAP Draggable tracks cursor; derive movement direction → apply `rotateZ`
3. `pointerup` → check proximity to slots → snap to nearest active slot OR drop in place
4. Last dropped card gets highest `z-index` in its group

---

## Slot Behaviour

A slot is a passive DOM element: `<div class="slot" data-id="slot-1">`.

- When a lifted card enters a radius of `ANIM.slotSnapRadius` px, the slot receives class `slot--active` (visual highlight — outline or glow)
- On `pointerup` within radius: card animates to slot center with snap animation
- One card per slot (slot becomes occupied; highlight disabled when full)

---

## Configuration Files

### `card.config.js`

All card visual parameters:

```js
export const CARD = {
  width: 120,
  height: 168,
  borderRadius: 8,
  bgColor: '#f5f0e8',
  outlineColor: '#333',
  outlineWidth: 1,
  slotOutlineColor: '#f0c040',  // highlight color when slot is active
  fontSize: 14,
  padding: 8,
  shadow: '4px 8px 16px rgba(0,0,0,0.25)',
  shadowLifted: '8px 16px 32px rgba(0,0,0,0.4)',
}
```

Cards support a `background-image` property for artwork — set via inline style or a per-card data attribute.

### `anim.config.js`

All animation parameters:

```js
export const ANIM = {
  liftScale: 1.05,
  tiltMax: 6,          // degrees of rotateZ during drag
  snapDuration: 0.3,   // seconds
  snapEase: 'back.out(1.4)',
  liftDuration: 0.15,
  slotSnapRadius: 60,  // px — activation radius for slot highlight
}
```

### `layout.config.js`

Board and slot layout:

```js
export const LAYOUT = {
  boardBg: '#2d5a27',  // color string or image URL
  slots: [
    { id: 'slot-1', x: 300, y: 200 },
    { id: 'slot-2', x: 500, y: 200 },
  ],
}
```

---

## Visual Design

- Simple geometric shapes (rectangle + border-radius)
- Each card has a reserved `background-image` layer for artwork
- Board background is configurable (color or image URL via `layout.config.js`)
- Slot highlight uses CSS outline/box-shadow on `slot--active` class — color defined in `card.config.js` (`outlineColor`)

---

## Out of Scope (for this prototype)

- Deck draw pile UI
- Card flip animation
- Multi-card selection
- Game rules or win conditions
