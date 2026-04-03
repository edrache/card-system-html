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
