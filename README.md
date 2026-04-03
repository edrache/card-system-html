# Card System

A browser-based card interaction prototype built with plain HTML/CSS/JS and [GSAP](https://gsap.com/). No build step, no framework.

## Features

- Pick up, drag, and drop cards anywhere on the board
- Directional tilt during drag (2D visual trick)
- Cards snap to **slots** with a spring animation
- Cards snap to **other cards** with a configurable offset
- Slot and card targets highlight when a dragged card is nearby
- Last dropped card always appears on top
- All visual and animation parameters are editable in config files

## Getting Started

Requires a local HTTP server (ES modules don't work over `file://`).

```bash
npx serve .
```

Then open [http://localhost:3000](http://localhost:3000).

## Configuration

All parameters live in `config/` — no need to touch JS or CSS to tune the feel.

| File | Controls |
|------|----------|
| `config/card.config.js` | Card size, colors, border, shadows, font |
| `config/anim.config.js` | Lift/drop/snap durations, easing, tilt, snap radii |
| `config/layout.config.js` | Board background, slot positions, card-to-card snap offset |

### GSAP Easing Reference

Easing strings follow the [GSAP easing syntax](https://gsap.com/docs/v3/Eases/):
- `'power2.out'` — smooth deceleration
- `'back.out(1.4)'` — slight overshoot (springy)
- `'elastic.out(1, 0.3)'` — bouncy
- `'sine.in'` — gentle acceleration

## Project Structure

```
index.html              — page shell, loads GSAP from CDN
css/
  style.css             — card, slot, and board styles
js/
  main.js               — state, card and slot rendering
  interactions.js       — drag, tilt, snap, highlight logic
config/
  card.config.js        — card visual parameters
  anim.config.js        — animation parameters
  layout.config.js      — board layout and slot positions
tests/
  test.html             — in-browser unit tests (open in browser, check console)
```

## Tests

Open `tests/test.html` via the local server. All assertions log to the browser console.
