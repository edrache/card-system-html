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

if (document.getElementById('board')) {
  init()
}
