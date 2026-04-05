import { CARD } from '../config/card.config.js'
import { ANIM } from '../config/anim.config.js'
import { LAYOUT } from '../config/layout.config.js'

let _zCounter = 10

export function getTopZIndex() {
  return _zCounter
}

export function bumpZIndex() {
  _zCounter += 1
  return _zCounter
}

export function calcTilt(dx, tiltMax) {
  const normalized = Math.max(-1, Math.min(1, dx / ANIM.tiltVelocityScale))
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

function clearCardHighlights() {
  document.querySelectorAll('.card--snap-target').forEach(el => el.classList.remove('card--snap-target'))
}

function findNearestFreeSlot(cardCenter) {
  let nearest = null
  let nearestDist = Infinity

  document.querySelectorAll('.slot:not(.enemy-slot):not(.slot--occupied)').forEach(slotEl => {
    const dist = getDistance(cardCenter, getSlotCenter(slotEl))
    if (dist < ANIM.slotSnapRadius && dist < nearestDist) {
      nearest = slotEl
      nearestDist = dist
    }
  })

  return nearest
}

function findNearestCard(selfEl, cardCenter) {
  let nearest = null
  let nearestDist = Infinity

  document.querySelectorAll('.card').forEach(cardEl => {
    if (cardEl === selfEl) return
    const dist = getDistance(cardCenter, getCardCenter(cardEl))
    if (dist < ANIM.cardSnapRadius && dist < nearestDist) {
      nearest = cardEl
      nearestDist = dist
    }
  })

  return nearest
}

function playWiggle(cardEl) {
  const tl = gsap.timeline()
  for (let i = 0; i < ANIM.wiggleCount; i++) {
    tl.to(cardEl, { rotateZ: ANIM.wiggleAngle, duration: ANIM.wiggleDuration, ease: ANIM.wiggleEase })
    tl.to(cardEl, { rotateZ: -ANIM.wiggleAngle, duration: ANIM.wiggleDuration, ease: ANIM.wiggleEase })
  }
  tl.to(cardEl, { rotateZ: 0, duration: ANIM.wiggleDuration, ease: ANIM.wiggleEase })
  return tl
}

function snapCardToCard(cardEl, targetCardEl) {
  const targetRect = targetCardEl.getBoundingClientRect()
  const boardRect = document.getElementById('board').getBoundingClientRect()

  const targetX = targetRect.left - boardRect.left + LAYOUT.cardSnapOffset.x
  const targetY = targetRect.top - boardRect.top + LAYOUT.cardSnapOffset.y

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
      const draggable = Draggable.get(cardEl)
      if (draggable) draggable.update()
    },
  })
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
      const draggable = Draggable.get(cardEl)
      if (draggable) draggable.update()
      callbacks.onSnap?.(slotEl, cardEl)
    },
  })
}

/**
 * @param {HTMLElement} cardEl
 * @param {Object}      [callbacks]
 * @param {function(slotEl: HTMLElement, cardEl: HTMLElement): void} [callbacks.onSnap]
 *   Called when a card successfully snaps into a player slot.
 * @param {function(slotEl: HTMLElement, cardEl: HTMLElement): void} [callbacks.onUnsnap]
 *   Called when a card is picked up from a slot it was occupying.
 */
export function initDrag(cardEl, callbacks = {}) {
  let isDragging = false
  let wiggleTween = null

  cardEl.addEventListener('mouseenter', () => {
    if (isDragging) return
    cardEl.style.outlineColor = CARD.hoverOutlineColor
    wiggleTween = playWiggle(cardEl)
  })

  cardEl.addEventListener('mouseleave', () => {
    cardEl.style.outlineColor = CARD.outlineColor
    if (wiggleTween) { wiggleTween.kill(); wiggleTween = null }
    gsap.to(cardEl, { rotateZ: 0, duration: ANIM.wiggleDuration, ease: ANIM.wiggleEase })
  })

  Draggable.create(cardEl, {
    type: 'x,y',
    onPress() {
      isDragging = true
      if (wiggleTween) { wiggleTween.kill(); wiggleTween = null }
      gsap.set(cardEl, { rotateZ: 0 })
      // If card was in a slot, free it
      if (cardEl.dataset.slotId) {
        const prevSlot = document.querySelector(`.slot[data-id="${cardEl.dataset.slotId}"]`)
        if (prevSlot) {
          prevSlot.classList.remove('slot--occupied')
          callbacks.onUnsnap?.(prevSlot, cardEl)
        }
        delete cardEl.dataset.slotId
      }

      gsap.to(cardEl, {
        scale: ANIM.liftScale,
        boxShadow: CARD.shadowLifted,
        duration: ANIM.liftDuration,
        ease: ANIM.liftEase,
      })
      cardEl.style.zIndex = bumpZIndex()
    },
    onDrag() {
      const dx = this.x - (this.vars._prevDragX ?? this.x)
      this.vars._prevDragX = this.x
      gsap.set(cardEl, { rotateZ: calcTilt(dx, ANIM.tiltMax) })

      const cardCenter = getCardCenter(cardEl)
      clearSlotHighlights()
      clearCardHighlights()
      const nearest = findNearestFreeSlot(cardCenter)
      if (nearest) {
        nearest.classList.add('slot--active')
      } else {
        const nearestCard = findNearestCard(cardEl, cardCenter)
        if (nearestCard) nearestCard.classList.add('card--snap-target')
      }
    },
    onClick() {
      isDragging = false
      gsap.to(cardEl, {
        scale: 1,
        boxShadow: CARD.shadow,
        duration: ANIM.liftDuration,
        ease: ANIM.dropEase,
      })
    },
    onDragEnd() {
      isDragging = false
      clearSlotHighlights()
      clearCardHighlights()
      const cardCenter = getCardCenter(cardEl)
      const nearestSlot = findNearestFreeSlot(cardCenter)
      const nearestCard = findNearestCard(cardEl, cardCenter)

      if (nearestSlot) {
        snapCardToSlot(cardEl, nearestSlot)
      } else if (nearestCard) {
        snapCardToCard(cardEl, nearestCard)
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
