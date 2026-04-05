import { CARD } from '../config/card.config.js'
import { LAYOUT } from '../config/layout.config.js'
import { GAME } from '../config/game.config.js'
import { initDrag } from './interactions.js'
import { gameState, initRun, drawCards, placeCard, unplaceCard, resolveRound } from './game.js'
import { getRpsResult, calcDamage } from './combat.js'
import { syncResolveButton, updateRoundCounter, setCardHpLabel, logRoundResult, showOverlay } from './ui.js'

const RPS_ICON   = { rock: '✊', paper: '✋', scissors: '✌️' }
const COLUMN_SPREAD = 55   // px — max Y offset for column reordering

// ── DOM refs tracked by slot index ───────────────────────────────────────────

const playerSlotEls = []  // playerSlotEls[i] = player slot element at index i
const enemySlotEls  = []  // enemySlotEls[i]  = enemy slot element at index i
const enemyCardEls  = []  // enemyCardEls[i]  = enemy card element at index i (null if empty)

// ── Element factories ─────────────────────────────────────────────────────────

export function createCardEl(card, isEnemy = false) {
  const el = document.createElement('div')
  el.className = isEnemy ? 'card card--enemy' : 'card'
  el.dataset.id = card.id

  el.style.width = CARD.width + 'px'
  el.style.height = CARD.height + 'px'
  el.style.borderRadius = CARD.borderRadius + 'px'
  if (!isEnemy) el.style.backgroundColor = CARD.bgColor
  el.style.outline = `${CARD.outlineWidth}px solid ${CARD.outlineColor}`
  el.style.padding = CARD.padding + 'px'
  el.style.boxShadow = CARD.shadow
  el.style.zIndex = 1

  // Top: name + role
  const top = document.createElement('div')
  top.className = 'card__top'

  const name = document.createElement('div')
  name.className = 'card__name'
  name.textContent = card.name ?? ''

  const role = document.createElement('div')
  role.className = `card__role card__role--${card.role ?? ''}`
  role.textContent = card.role ?? ''

  top.appendChild(name)
  top.appendChild(role)

  // Mid: large RPS symbol
  const mid = document.createElement('div')
  mid.className = 'card__mid'

  const rpsIcon = document.createElement('div')
  rpsIcon.className = 'card__rps-icon'
  rpsIcon.textContent = RPS_ICON[card.rps] ?? '?'
  mid.appendChild(rpsIcon)

  // Bottom: effect text + HP
  const bot = document.createElement('div')
  bot.className = 'card__bot'

  const effect = document.createElement('div')
  effect.className = 'card__effect'
  effect.textContent = card.effectText ?? ''

  const hp = document.createElement('div')
  hp.className = 'card__hp'
  hp.textContent = `♥\u202F${card.hp}`

  bot.appendChild(effect)
  bot.appendChild(hp)

  el.appendChild(top)
  el.appendChild(mid)
  el.appendChild(bot)

  return el
}

export function createSlotEl(slot, extraClass) {
  const el = document.createElement('div')
  el.className = extraClass ? `slot ${extraClass}` : 'slot'
  el.dataset.id = slot.id

  el.style.width = CARD.width + 'px'
  el.style.height = CARD.height + 'px'
  el.style.borderRadius = CARD.borderRadius + 'px'
  el.style.left = slot.x + 'px'
  el.style.top = slot.y + 'px'
  el.style.borderColor = CARD.slotBorderColor
  el.style.borderWidth = '2px'

  return el
}

// ── Layout helpers ────────────────────────────────────────────────────────────

function calcSlotRow(count, rowY) {
  const totalWidth = count * CARD.width + (count - 1) * LAYOUT.cardGap
  const startX = Math.round((window.innerWidth - totalWidth) / 2)
  return Array.from({ length: count }, (_, i) => ({
    x: startX + i * (CARD.width + LAYOUT.cardGap),
    y: rowY,
  }))
}

function slotIdToIndex(slotId) {
  const match = slotId.match(/(\d+)$/)
  return match ? parseInt(match[1], 10) : -1
}

// ── Column Y reordering ───────────────────────────────────────────────────────

/**
 * Sorts columns vertically by enemy card strength (value + buffs).
 * Strongest enemy → top (most negative Y offset).
 * Empty slots → bottom.
 * Animates slots and their occupying cards.
 */
function reorderColumns() {
  const count = GAME.SLOT_COUNT

  // Strength per column (-Infinity for empty slots)
  const strengths = gameState.enemyBoard.map(card =>
    card ? card.value + card.buffs : -Infinity
  )

  // Unique non-empty strengths sorted descending
  const uniqueDesc = [...new Set(strengths.filter(s => s !== -Infinity))]
    .sort((a, b) => b - a)

  // Dense rank: 0 = strongest; empty slots ranked last
  const ranks = strengths.map(s =>
    s === -Infinity ? uniqueDesc.length : uniqueDesc.indexOf(s)
  )

  const maxRank = Math.max(...ranks, 0)

  // Y offsets: centered so rank 0 is at -COLUMN_SPREAD, rank maxRank at +COLUMN_SPREAD
  const offsets = ranks.map(rank =>
    maxRank === 0 ? 0 : (rank / maxRank) * COLUMN_SPREAD * 2 - COLUMN_SPREAD
  )

  const dur  = 0.65
  const ease = 'power2.inOut'

  for (let i = 0; i < count; i++) {
    const newY = offsets[i]

    // Enemy slot + card
    if (enemySlotEls[i])  gsap.to(enemySlotEls[i],  { y: newY, duration: dur, ease })
    if (enemyCardEls[i])  gsap.to(enemyCardEls[i],   { y: newY, duration: dur, ease })

    // Player slot: move by the delta so any snapped card follows
    if (playerSlotEls[i]) {
      const prevY = gsap.getProperty(playerSlotEls[i], 'y') ?? 0
      const delta = newY - prevY
      gsap.to(playerSlotEls[i], { y: newY, duration: dur, ease })

      const snappedCard = document.querySelector(
        `.card[data-slot-id="${playerSlotEls[i].dataset.id}"]`
      )
      if (snappedCard) {
        const cardY = gsap.getProperty(snappedCard, 'y') ?? 0
        gsap.to(snappedCard, { y: cardY + delta, duration: dur, ease })
      }
    }
  }
}

// ── Placement preview ─────────────────────────────────────────────────────────

/**
 * Shows a combat-preview overlay on a placed card.
 * Accounts for RPS modifier, role bonuses, card effects, and first-card buff.
 */
function showPlacementPreview(cardEl, playerCard, slotIndex) {
  clearPlacementPreview(cardEl)

  const enemyCard = gameState.enemyBoard[slotIndex]
  if (!enemyCard) return

  const rps     = getRpsResult(playerCard, enemyCard)
  const dealt   = calcDamage(playerCard, enemyCard)
  const taken   = calcDamage(enemyCard, playerCard)
  const afterHp = playerCard.hp - taken

  const isFirst      = gameState.placementOrder.length === 1
  const firstBonus   = isFirst ? playerCard.buffs : 0   // buffs already applied by placeCard

  const preview = document.createElement('div')
  preview.className = 'card__preview'

  // RPS line
  const rpsLine = document.createElement('div')
  rpsLine.className = `card__preview-rps card__preview-rps--${rps}`
  const rpsLabel = rps === 'advantage' ? '↑ WIN' : rps === 'disadvantage' ? '↓ LOSE' : '= TIE'
  rpsLine.textContent = rpsLabel

  // First-card bonus
  if (firstBonus > 0) {
    const bonusLine = document.createElement('div')
    bonusLine.className = 'card__preview-bonus'
    bonusLine.textContent = `+${firstBonus} buff`
    preview.appendChild(bonusLine)
  }

  // Damage line
  const dmgLine = document.createElement('div')
  dmgLine.className = 'card__preview-dmg'
  dmgLine.textContent = `${dealt} ↔ ${taken}`

  // HP projection
  const hpLine = document.createElement('div')
  const survives = afterHp > 0
  hpLine.className = `card__preview-hp card__preview-hp--${survives ? 'survive' : 'die'}`
  hpLine.textContent = `♥ ${playerCard.hp} → ${Math.max(0, afterHp)}`

  preview.appendChild(rpsLine)
  preview.appendChild(dmgLine)
  preview.appendChild(hpLine)

  cardEl.appendChild(preview)
}

function clearPlacementPreview(cardEl) {
  cardEl.querySelector('.card__preview')?.remove()
}

// ── Hand rendering ────────────────────────────────────────────────────────────

function renderHand() {
  const container = document.getElementById('cards')
  container.innerHTML = ''

  if (gameState.playerHand.length === 0) return

  const handY     = window.innerHeight - CARD.height - 50
  const positions = calcSlotRow(gameState.playerHand.length, handY)

  gameState.playerHand.forEach((card, i) => {
    const el = createCardEl(card)
    el.style.left = positions[i].x + 'px'
    el.style.top  = positions[i].y + 'px'

    initDrag(el, {
      onSnap(slotEl, cardEl) {
        const slotIndex  = slotIdToIndex(slotEl.dataset.id)
        placeCard(cardEl.dataset.id, slotIndex)
        const playerCard = gameState.playerBoard[slotIndex]
        if (playerCard) showPlacementPreview(cardEl, playerCard, slotIndex)
        syncResolveButton()
      },
      onUnsnap(slotEl, cardEl) {
        const slotIndex = slotIdToIndex(slotEl.dataset.id)
        unplaceCard(slotIndex)
        clearPlacementPreview(cardEl)
        syncResolveButton()
      },
    })

    container.appendChild(el)
  })
}

// ── Enemy board rendering ─────────────────────────────────────────────────────

function renderEnemyBoard() {
  const container = document.getElementById('enemy-cards')
  container.innerHTML = ''
  enemyCardEls.fill(null)

  const count    = LAYOUT.enemySlots.length
  const enemyRowY = Math.round(window.innerHeight * LAYOUT.enemySlotRowY)
  const positions = calcSlotRow(count, enemyRowY)

  gameState.enemyBoard.forEach((card, i) => {
    if (!card) {
      enemyCardEls[i] = null
      return
    }
    const el = createCardEl(card, true /* isEnemy */)
    el.style.left   = positions[i].x + 'px'
    el.style.top    = positions[i].y + 'px'
    el.style.cursor = 'default'
    container.appendChild(el)
    enemyCardEls[i] = el
  })
}

// ── Round result handling ─────────────────────────────────────────────────────

function onResolve() {
  const result = resolveRound()
  logRoundResult(result)

  if (result.outcome === 'win') {
    renderEnemyBoard()
    renderHand()
    showOverlay('<div class="overlay-content"><h2>Victory!</h2><p>Enemy defeated.</p></div>')
    return
  }

  if (result.outcome === 'loss') {
    showOverlay(
      '<div class="overlay-content"><h2>Defeated</h2>' +
      '<p>You have no cards left.</p>' +
      '<button id="btn-restart">Restart</button></div>'
    )
    document.getElementById('btn-restart')?.addEventListener('click', () => location.reload())
    return
  }

  drawCards()
  updateRoundCounter()
  renderEnemyBoard()
  reorderColumns()
  renderHand()
  syncResolveButton()
}

// ── Init ──────────────────────────────────────────────────────────────────────

function init() {
  const board = document.getElementById('board')
  board.style.background = LAYOUT.boardBg

  const count      = LAYOUT.slots.length
  const enemyRowY  = Math.round(window.innerHeight * LAYOUT.enemySlotRowY)
  const playerRowY = Math.round(window.innerHeight * LAYOUT.playerSlotRowY)

  const enemyPositions  = calcSlotRow(count, enemyRowY)
  const playerPositions = calcSlotRow(count, playerRowY)

  // Render enemy slots — store refs
  const enemySlotsContainer = document.getElementById('enemy-slots')
  LAYOUT.enemySlots.forEach((slot, i) => {
    const el = createSlotEl({ ...slot, ...enemyPositions[i] }, 'enemy-slot')
    enemySlotsContainer.appendChild(el)
    enemySlotEls[i] = el
    enemyCardEls[i] = null
  })

  // Render player slots — store refs
  const slotsContainer = document.getElementById('slots')
  LAYOUT.slots.forEach((slot, i) => {
    const el = createSlotEl({ ...slot, ...playerPositions[i] })
    slotsContainer.appendChild(el)
    playerSlotEls[i] = el
  })

  document.getElementById('btn-resolve').addEventListener('click', onResolve)

  initRun()
  drawCards()
  updateRoundCounter()
  renderEnemyBoard()
  reorderColumns()
  renderHand()
  syncResolveButton()
}

if (document.getElementById('board')) {
  init()
}
