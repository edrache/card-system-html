import { CARD } from '../config/card.config.js'
import { LAYOUT } from '../config/layout.config.js'
import { GAME } from '../config/game.config.js'
import { getBuffSummary } from './buffs.js'
import { initDrag } from './interactions.js'
import { gameState, initRun, drawCards, placeCard, unplaceCard, resolveRound } from './game.js'
import { getDamageBreakdown } from './combat.js'
import { syncResolveButton, updateRoundCounter, setCardHpLabel, logRoundResult, showOverlay } from './ui.js'

const RPS_ICON   = { rock: '✊', paper: '✋', scissors: '✌️' }
const COLUMN_SPREAD = 55   // px — max Y offset for column reordering

// ── DOM refs tracked by slot index ───────────────────────────────────────────

const playerSlotEls = []  // playerSlotEls[i] = player slot element at index i
const enemySlotEls  = []  // enemySlotEls[i]  = enemy slot element at index i
const enemyCardEls  = []  // enemyCardEls[i]  = enemy card element at index i (null if empty)

// ── Element factories ─────────────────────────────────────────────────────────

function createTooltipRow(text, extraClass = '') {
  const item = document.createElement('li')
  item.className = extraClass ? `card__tooltip-item ${extraClass}` : 'card__tooltip-item'
  item.textContent = text
  return item
}

function formatSignedAmount(amount) {
  return `${amount >= 0 ? '+' : ''}${amount}`
}

function getCombatProjection(playerCard, slotIndex) {
  const enemyCard = gameState.enemyBoard[slotIndex]
  if (!enemyCard) return null

  const playerBreakdown = getDamageBreakdown(playerCard, enemyCard)
  const enemyBreakdown = getDamageBreakdown(enemyCard, playerCard)
  const playerAfterHp = Math.max(0, playerCard.hp - enemyBreakdown.finalDamage)
  const enemyAfterHp = Math.max(0, enemyCard.hp - playerBreakdown.finalDamage)

  let outcome = 'clash'
  let label = 'CLASH'
  if (enemyAfterHp <= 0 && playerAfterHp > 0) {
    outcome = 'win'
    label = 'WIN'
  } else if (playerAfterHp <= 0 && enemyAfterHp > 0) {
    outcome = 'lose'
    label = 'LOSE'
  } else if (playerAfterHp <= 0 && enemyAfterHp <= 0) {
    outcome = 'trade'
    label = 'TRADE'
  }

  return {
    enemyCard,
    playerBreakdown,
    enemyBreakdown,
    playerAfterHp,
    enemyAfterHp,
    outcome,
    label,
    rps: playerBreakdown.rps,
  }
}

function formatAttackLine(label, breakdown) {
  const parts = [`${breakdown.baseAttack} base`]

  if (breakdown.buffAttack > 0) {
    parts.push(`${formatSignedAmount(breakdown.buffAttack)} buff`)
  }

  breakdown.attackModifiers.forEach((modifier) => {
    parts.push(`${formatSignedAmount(modifier.amount)} ${modifier.label}`)
  })

  let text = `${label}: ${parts.join(', ')} = ${breakdown.rawAttack}`
  if (breakdown.reduction > 0) {
    text += `, block ${breakdown.reduction}`
  }
  text += `, final ${breakdown.finalDamage}`
  return text
}

function formatDefenseLine(label, breakdown) {
  if (breakdown.reduction <= 0) {
    return `${label}: no active reduction`
  }

  const details = breakdown.reductionSources
    .map((source) => `${formatSignedAmount(source.amount)} ${source.label}`)
    .join(', ')

  return `${label}: ${details} = ${breakdown.reduction}`
}

function createCardTooltip(card, summary, effectiveValue, combatProjection = null) {
  const tooltip = document.createElement('div')
  tooltip.className = 'card__tooltip'

  const title = document.createElement('div')
  title.className = 'card__tooltip-title'
  title.textContent = `Value ${effectiveValue}`

  const list = document.createElement('ul')
  list.className = 'card__tooltip-list'
  list.appendChild(createTooltipRow(`Base value ${card.value}`))

  if (summary.sources.length === 0) {
    list.appendChild(createTooltipRow('No active modifiers'))
  } else {
    summary.sources.forEach((source) => {
      const sign = source.amount >= 0 ? '+' : ''
      list.appendChild(
        createTooltipRow(`${sign}${source.amount} ${source.label}: ${source.description}`)
      )
    })
  }

  if (summary.cappedBy > 0) {
    list.appendChild(
      createTooltipRow(`-${summary.cappedBy} Buff cap: maximum bonus is ${GAME.BUFF_CAP}`, 'card__tooltip-item--cap')
    )
  }

  if (combatProjection) {
    list.appendChild(createTooltipRow(`Combat ${combatProjection.label} (${combatProjection.rps})`, 'card__tooltip-item--combat'))
    list.appendChild(createTooltipRow(formatAttackLine('Your attack', combatProjection.playerBreakdown), 'card__tooltip-item--combat'))
    list.appendChild(createTooltipRow(formatDefenseLine('Your defense', combatProjection.enemyBreakdown), 'card__tooltip-item--combat'))
    list.appendChild(createTooltipRow(formatAttackLine(`${combatProjection.enemyCard.name} attack`, combatProjection.enemyBreakdown), 'card__tooltip-item--combat'))
    list.appendChild(
      createTooltipRow(
        `HP change: you ${card.hp} -> ${combatProjection.playerAfterHp}, enemy ${combatProjection.enemyCard.hp} -> ${combatProjection.enemyAfterHp}`,
        'card__tooltip-item--combat'
      )
    )
  }

  const footer = document.createElement('div')
  footer.className = 'card__tooltip-footer'
  footer.textContent = `HP ${card.hp}/${card.value}`

  tooltip.appendChild(title)
  tooltip.appendChild(list)
  tooltip.appendChild(footer)
  return tooltip
}

function updateValueCluster(cardEl, summary, effectiveValue) {
  const valueCluster = cardEl.querySelector('.card__value-cluster')
  const valueEl = cardEl.querySelector('.card__value')
  if (!valueCluster || !valueEl) return

  valueEl.textContent = `${effectiveValue}`
  valueEl.classList.toggle('card__value--modified', summary.total > 0 || summary.cappedBy > 0)

  const existingDelta = valueCluster.querySelector('.card__value-delta')
  if (summary.total > 0) {
    if (existingDelta) {
      existingDelta.textContent = `+${summary.total}`
    } else {
      const delta = document.createElement('div')
      delta.className = 'card__value-delta'
      delta.textContent = `+${summary.total}`
      valueCluster.appendChild(delta)
    }
  } else {
    existingDelta?.remove()
  }
}

function updateCombatBadge(cardEl, combatProjection = null) {
  const existing = cardEl.querySelector('.card__combat-badge')
  if (!combatProjection) {
    existing?.remove()
    return
  }

  const badge = existing ?? document.createElement('div')
  badge.className = `card__combat-badge card__combat-badge--${combatProjection.outcome}`
  badge.textContent = combatProjection.label

  if (!existing) {
    cardEl.querySelector('.card__top')?.appendChild(badge)
  }
}

function updateCardPresentation(cardEl, card, combatProjection = null) {
  const summary = getBuffSummary(card)
  const effectiveValue = card.value + summary.total

  updateValueCluster(cardEl, summary, effectiveValue)
  setCardHpLabel(cardEl, card.hp)

  const oldTooltip = cardEl.querySelector('.card__tooltip')
  const newTooltip = createCardTooltip(card, summary, effectiveValue, combatProjection)
  if (oldTooltip) {
    oldTooltip.replaceWith(newTooltip)
  } else {
    cardEl.appendChild(newTooltip)
  }

  updateCombatBadge(cardEl, combatProjection)
}

function findCardById(cardId) {
  const allCards = [
    ...gameState.playerHand,
    ...gameState.playerBoard,
    ...gameState.enemyBoard,
    ...gameState.playerDeck,
    ...gameState.enemyDeck,
  ]

  return allCards.find((card) => card?.id === cardId) ?? null
}

function refreshVisibleCards() {
  document.querySelectorAll('#cards .card, #enemy-cards .card').forEach((cardEl) => {
    const card = findCardById(cardEl.dataset.id)
    if (!card) return

    const slotIndex = cardEl.dataset.slotId ? slotIdToIndex(cardEl.dataset.slotId) : -1
    const combatProjection = slotIndex >= 0 ? getCombatProjection(card, slotIndex) : null
    updateCardPresentation(cardEl, card, combatProjection)
  })
}

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

  const header = document.createElement('div')
  header.className = 'card__header'

  const name = document.createElement('div')
  name.className = 'card__name'
  name.textContent = card.name ?? ''

  const valueCluster = document.createElement('div')
  valueCluster.className = 'card__value-cluster'

  const value = document.createElement('div')
  value.className = 'card__value'
  valueCluster.appendChild(value)

  const role = document.createElement('div')
  role.className = `card__role card__role--${card.role ?? ''}`
  role.textContent = card.role ?? ''

  header.appendChild(name)
  header.appendChild(valueCluster)
  top.appendChild(header)
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
  updateCardPresentation(el, card)

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
        refreshVisibleCards()
        syncResolveButton()
      },
      onUnsnap(slotEl, cardEl) {
        const slotIndex = slotIdToIndex(slotEl.dataset.id)
        unplaceCard(slotIndex)
        refreshVisibleCards()
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
  refreshVisibleCards()
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
  refreshVisibleCards()
  syncResolveButton()
}

if (document.getElementById('board')) {
  init()
}
