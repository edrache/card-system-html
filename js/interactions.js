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
