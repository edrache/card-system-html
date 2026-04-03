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
  cardEl.addEventListener('pointerdown', (e) => {
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
