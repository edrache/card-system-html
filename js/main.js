import { CARD } from '../config/card.config.js'
import { LAYOUT } from '../config/layout.config.js'
import { GAME } from '../config/game.config.js'
import { ANIM } from '../config/anim.config.js'
import { getBuffSummary } from './buffs.js'
import { initDrag } from './interactions.js'
import {
  gameState,
  getResolutionOrder,
  initRun,
  drawCards,
  placeCard,
  unplaceCard,
  prepareResolveRound,
  resolveCombatStep,
  finalizeResolveRound,
} from './game.js'
import { getDamageBreakdown } from './combat.js'
import {
  syncResolveButton,
  updateRoundCounter,
  logRoundResult,
  showOverlay,
  setResolveButtonDisabled,
  setResolveButtonLabel,
} from './ui.js'

const RPS_ICON   = { rock: '✊', paper: '✋', scissors: '✌️' }
const COLUMN_SPREAD = 55   // px — max Y offset for column reordering
const COLUMN_FIGHT_EMOJI = '⚔️'

// ── DOM refs tracked by slot index ───────────────────────────────────────────

const playerSlotEls = []  // playerSlotEls[i] = player slot element at index i
const enemySlotEls  = []  // enemySlotEls[i]  = enemy slot element at index i
const enemyCardEls  = []  // enemyCardEls[i]  = enemy card element at index i (null if empty)
const columnMarkerEls = [] // columnMarkerEls[i] = fight marker between enemy and player slot
const combatFlowState = {
  active: false,
  finalizing: false,
  steps: [],
  currentStepIndex: 0,
  log: [],
  resolvedSlots: new Set(),
}

// ── Element factories ─────────────────────────────────────────────────────────

function createTooltipRow(text, extraClass = '') {
  const item = document.createElement('li')
  item.className = extraClass ? `card__tooltip-item ${extraClass}` : 'card__tooltip-item'
  item.textContent = text
  return item
}

function createTooltipDelta(text) {
  const delta = document.createElement('span')
  delta.className = 'card__tooltip-delta'
  delta.textContent = text
  return delta
}

function appendTooltipPart(parent, part) {
  if (typeof part === 'string') {
    parent.appendChild(document.createTextNode(part))
    return
  }

  if (part.type === 'delta') {
    parent.appendChild(createTooltipDelta(part.text))
    return
  }

  if (part.type === 'label') {
    const label = document.createElement('span')
    label.className = 'card__tooltip-label'
    label.textContent = part.text
    parent.appendChild(label)
  }
}

function createTooltipRichRow(parts, extraClass = '') {
  const item = document.createElement('li')
  item.className = extraClass ? `card__tooltip-item ${extraClass}` : 'card__tooltip-item'
  parts.forEach((part) => appendTooltipPart(item, part))
  return item
}

function createTooltipSectionRow(label, parts, extraClass = '') {
  return createTooltipRichRow(
    [{ type: 'label', text: `${label}:` }, ' ', ...parts],
    extraClass
  )
}

function formatSignedAmount(amount) {
  return `${amount >= 0 ? '+' : ''}${amount}`
}

function formatStatDelta(atkDelta = 0, hpDelta = 0) {
  return `${formatSignedAmount(atkDelta)}/${formatSignedAmount(hpDelta)}`
}

function getCombatProjection(playerCard, slotIndex) {
  const enemyCard = gameState.enemyBoard[slotIndex]
  if (!enemyCard) return null

  const playerBreakdown = getDamageBreakdown(playerCard, enemyCard)
  const enemyBreakdown = getDamageBreakdown(enemyCard, playerCard)
  const playerHpDelta = -enemyBreakdown.finalDamage
  const enemyHpDelta = -playerBreakdown.finalDamage
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
    playerHpDelta,
    enemyHpDelta,
    playerAfterHp,
    enemyAfterHp,
    outcome,
    label,
    rps: playerBreakdown.rps,
  }
}

function formatAttackLine(label, breakdown) {
  const parts = [
    { type: 'delta', text: `${breakdown.baseAttack}/${breakdown.baseAttack}` },
    ' base',
  ]

  if (breakdown.buffAttack > 0) {
    parts.push(', ', { type: 'delta', text: formatStatDelta(breakdown.buffAttack, 0) }, ' buffs')
  }

  breakdown.attackModifiers.forEach((modifier) => {
    parts.push(', ', { type: 'delta', text: formatStatDelta(modifier.amount, 0) }, ` ${modifier.label}`)
  })

  parts.push(' => ', { type: 'delta', text: `${breakdown.rawAttack}/0` }, ' applied')
  if (breakdown.reduction > 0) {
    parts.push(', ', { type: 'delta', text: `0/-${breakdown.reduction}` }, ' blocked')
  }
  parts.push(', hit ', { type: 'delta', text: formatStatDelta(0, -breakdown.finalDamage) })
  return createTooltipSectionRow(label, parts, 'card__tooltip-item--combat')
}

function formatDefenseLine(label, breakdown) {
  if (breakdown.reduction <= 0) {
    return createTooltipSectionRow(label, ['no active reduction'], 'card__tooltip-item--combat')
  }

  const parts = []
  breakdown.reductionSources.forEach((source, index) => {
    if (index > 0) parts.push(', ')
    parts.push({ type: 'delta', text: `0/-${source.amount}` }, ` ${source.label}`)
  })
  parts.push(' => ', { type: 'delta', text: `0/-${breakdown.reduction}` }, ' total block')
  return createTooltipSectionRow(label, parts, 'card__tooltip-item--combat')
}

function createCardTooltip(card, summary, effectiveValue, combatProjection = null) {
  const tooltip = document.createElement('div')
  tooltip.className = 'card__tooltip'

  const title = document.createElement('div')
  title.className = 'card__tooltip-title'
  title.textContent = `ATK ${effectiveValue} / HP ${card.hp}`

  const list = document.createElement('ul')
  list.className = 'card__tooltip-list'
  list.appendChild(createTooltipSectionRow('Base', [{ type: 'delta', text: `${card.value}/${card.value}` }]))
  list.appendChild(createTooltipSectionRow('Current', [{ type: 'delta', text: `${effectiveValue}/${card.hp}` }]))

  if (summary.sources.length === 0) {
    list.appendChild(createTooltipRow('No active modifiers'))
  } else {
    summary.sources.forEach((source) => {
      list.appendChild(
        createTooltipRichRow([
          { type: 'delta', text: formatStatDelta(source.amount, 0) },
          ' ',
          `${source.label}: ${source.description}`,
        ])
      )
    })
  }

  if (summary.cappedBy > 0) {
    list.appendChild(
      createTooltipRichRow([
        { type: 'delta', text: formatStatDelta(-summary.cappedBy, 0) },
        ' ',
        `Buff cap: maximum bonus is ${GAME.BUFF_CAP}`,
      ], 'card__tooltip-item--cap')
    )
  }

  if (combatProjection) {
    list.appendChild(
      createTooltipSectionRow('Combat', [combatProjection.label, ` (${combatProjection.rps})`], 'card__tooltip-item--combat')
    )
    list.appendChild(formatAttackLine('Your attack', combatProjection.playerBreakdown))
    list.appendChild(formatDefenseLine('Your defense', combatProjection.enemyBreakdown))
    list.appendChild(formatAttackLine(`${combatProjection.enemyCard.name} attack`, combatProjection.enemyBreakdown))
    list.appendChild(
      createTooltipSectionRow(
        'Outcome',
        [
          'you ',
          { type: 'delta', text: formatStatDelta(0, combatProjection.playerAfterHp - card.hp) },
          ', enemy ',
          { type: 'delta', text: formatStatDelta(0, combatProjection.enemyAfterHp - combatProjection.enemyCard.hp) },
        ],
        'card__tooltip-item--combat'
      )
    )
  }

  const footer = document.createElement('div')
  footer.className = 'card__tooltip-footer'
  footer.textContent = `Notation: ATK/HP`

  tooltip.appendChild(title)
  tooltip.appendChild(list)
  tooltip.appendChild(footer)
  return tooltip
}

function updateStatsCluster(cardEl, card, summary, effectiveValue) {
  const statsCluster = cardEl.querySelector('.card__stats-cluster')
  const attackEl = cardEl.querySelector('.card__attack')
  const hpEl = cardEl.querySelector('.card__hp')
  if (!statsCluster || !attackEl || !hpEl) return

  attackEl.textContent = `${effectiveValue}`
  attackEl.classList.toggle('card__stat--modified', summary.total > 0 || summary.cappedBy > 0)
  hpEl.textContent = `${card.hp}`
  hpEl.classList.toggle('card__stat--damaged', card.hp < card.value)

  const existingDelta = statsCluster.querySelector('.card__value-delta')
  if (summary.total > 0) {
    if (existingDelta) {
      existingDelta.textContent = `+${summary.total}`
    } else {
      const delta = document.createElement('div')
      delta.className = 'card__value-delta'
      delta.textContent = `+${summary.total}`
      statsCluster.appendChild(delta)
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
  badge.innerHTML =
    `<span class="card__combat-badge-line">ME ${formatStatDelta(0, combatProjection.playerHpDelta)}</span>` +
    `<span class="card__combat-badge-line">EN ${formatStatDelta(0, combatProjection.enemyHpDelta)}</span>`

  if (!existing) {
    cardEl.querySelector('.card__top')?.appendChild(badge)
  }
}

function createColumnMarkerEl(x, y) {
  const el = document.createElement('div')
  el.className = 'column-fight-marker'
  el.innerHTML =
    `<span class="column-fight-marker__emoji">${COLUMN_FIGHT_EMOJI}</span>` +
    '<span class="column-fight-marker__order"></span>'
  el.style.left = `${x}px`
  el.style.top = `${y}px`
  return el
}

function formatOrdinal(position) {
  if (position === 1) return '1st'
  if (position === 2) return '2nd'
  if (position === 3) return '3rd'
  return `${position}th`
}

function refreshColumnMarkers() {
  const resolutionOrder = getResolutionOrder()
  const orderBySlot = new Map(
    resolutionOrder.map((slotIndex, idx) => [slotIndex, formatOrdinal(idx + 1)])
  )

  columnMarkerEls.forEach((markerEl, slotIndex) => {
    if (!markerEl) return
    const orderLabel = orderBySlot.get(slotIndex) ?? ''
    markerEl.querySelector('.column-fight-marker__order').textContent = orderLabel
  })
}

function updateCardPresentation(cardEl, card, combatProjection = null) {
  const summary = getBuffSummary(card)
  const effectiveValue = card.value + summary.total

  updateStatsCluster(cardEl, card, summary, effectiveValue)

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

function shouldShowCombatProjection(slotIndex) {
  return !combatFlowState.active || !combatFlowState.resolvedSlots.has(slotIndex)
}

function refreshVisibleCards() {
  document.querySelectorAll('#cards .card, #enemy-cards .card').forEach((cardEl) => {
    const card = findCardById(cardEl.dataset.id)
    if (!card) return

    const slotIndex = cardEl.dataset.slotId ? slotIdToIndex(cardEl.dataset.slotId) : -1
    const combatProjection =
      slotIndex >= 0 && shouldShowCombatProjection(slotIndex)
        ? getCombatProjection(card, slotIndex)
        : null
    updateCardPresentation(cardEl, card, combatProjection)
  })

  refreshColumnMarkers()
}

export function createCardEl(card, isEnemy = false) {
  const el = document.createElement('div')
  el.className = isEnemy ? 'card card--enemy' : 'card'
  el.dataset.id = card.id

  el.addEventListener('mouseenter', () => {
    el.classList.add('card--tooltip-active')
  })

  el.addEventListener('mouseleave', () => {
    el.classList.remove('card--tooltip-active')
  })

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

  const statsCluster = document.createElement('div')
  statsCluster.className = 'card__stats-cluster'

  const stats = document.createElement('div')
  stats.className = 'card__stats'

  const attack = document.createElement('div')
  attack.className = 'card__stat card__attack'

  const separator = document.createElement('div')
  separator.className = 'card__stat-separator'
  separator.textContent = '/'

  const hp = document.createElement('div')
  hp.className = 'card__stat card__hp'

  stats.appendChild(attack)
  stats.appendChild(separator)
  stats.appendChild(hp)
  statsCluster.appendChild(stats)

  const role = document.createElement('div')
  role.className = `card__role card__role--${card.role ?? ''}`
  role.textContent = card.role ?? ''

  header.appendChild(name)
  header.appendChild(statsCluster)
  top.appendChild(header)
  top.appendChild(role)

  // Mid: large RPS symbol
  const mid = document.createElement('div')
  mid.className = 'card__mid'

  const rpsIcon = document.createElement('div')
  rpsIcon.className = 'card__rps-icon'
  rpsIcon.textContent = RPS_ICON[card.rps] ?? '?'
  mid.appendChild(rpsIcon)

  // Bottom: effect text
  const bot = document.createElement('div')
  bot.className = 'card__bot'

  const effect = document.createElement('div')
  effect.className = 'card__effect'
  effect.textContent = card.effectText ?? ''
  bot.appendChild(effect)

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

    if (columnMarkerEls[i]) {
      gsap.to(columnMarkerEls[i], { y: newY, duration: dur, ease })
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

function waitForMs(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}

function tweenTo(target, vars) {
  return new Promise((resolve) => {
    gsap.to(target, {
      ...vars,
      onComplete() {
        vars.onComplete?.()
        resolve()
      },
    })
  })
}

function getBoardRect() {
  return document.getElementById('board').getBoundingClientRect()
}

function getElementBoardRect(el) {
  const boardRect = getBoardRect()
  const rect = el.getBoundingClientRect()
  return {
    left: rect.left - boardRect.left,
    top: rect.top - boardRect.top,
    width: rect.width,
    height: rect.height,
  }
}

function findPlayerCardEl(cardId) {
  return document.querySelector(`#cards .card[data-id="${cardId}"]`)
}

function findEnemyCardEl(cardId) {
  return document.querySelector(`#enemy-cards .card[data-id="${cardId}"]`)
}

function setHandLocked(locked) {
  document.getElementById('cards')?.classList.toggle('cards--locked', locked)
}

function clearCombatHighlights() {
  document.querySelectorAll('.slot--resolving').forEach((el) => el.classList.remove('slot--resolving'))
  document.querySelectorAll('.column-fight-marker--active').forEach((el) => el.classList.remove('column-fight-marker--active'))
  document.querySelectorAll('.card--resolving').forEach((el) => el.classList.remove('card--resolving'))
  document.querySelectorAll('.card__resolution-note').forEach((el) => el.remove())
}

function highlightCombatPair(slotIndex) {
  playerSlotEls[slotIndex]?.classList.add('slot--resolving')
  enemySlotEls[slotIndex]?.classList.add('slot--resolving')
  columnMarkerEls[slotIndex]?.classList.add('column-fight-marker--active')
}

function createResolutionNote(sideResult) {
  const note = document.createElement('div')
  note.className = sideResult.died
    ? 'card__resolution-note card__resolution-note--destroyed'
    : 'card__resolution-note card__resolution-note--survived'

  const title = document.createElement('div')
  title.className = 'card__resolution-title'
  title.textContent = sideResult.died ? 'Destroyed' : 'Stays'

  const hp = document.createElement('div')
  hp.className = 'card__resolution-line'
  hp.textContent = `HP ${sideResult.hpBefore} -> ${sideResult.hpAfter}`

  const dealt = document.createElement('div')
  dealt.className = 'card__resolution-line'
  dealt.textContent = `Deals ${sideResult.dealt}`

  note.appendChild(title)
  note.appendChild(hp)
  note.appendChild(dealt)
  return note
}

function showResolutionState(cardEl, sideResult, card) {
  if (!cardEl || !card) return Promise.resolve()

  cardEl.classList.add('card--resolving')
  cardEl.classList.toggle('card--destroyed', sideResult.died)
  updateCardPresentation(cardEl, card, null)
  cardEl.querySelector('.card__resolution-note')?.remove()
  cardEl.appendChild(createResolutionNote(sideResult))

  const rotation = sideResult.died ? ANIM.resolveTiltAngle : 0
  const opacity = sideResult.died ? 0.78 : 1
  const scale = sideResult.died ? 0.96 : 1.04

  return tweenTo(cardEl, {
    rotateZ: rotation,
    opacity,
    scale,
    duration: ANIM.resolveFlashDuration,
    ease: 'power2.out',
    yoyo: !sideResult.died,
    repeat: sideResult.died ? 0 : 1,
  }).then(() => {
    if (!sideResult.died) {
      gsap.set(cardEl, { scale: 1 })
    }
  })
}

function capturePlayerReturnStates() {
  return gameState.playerBoard
    .map((card, slotIndex) => {
      if (!card || card.hp <= 0) return null
      const cardEl = findPlayerCardEl(card.id)
      if (!cardEl) return null

      return {
        cardId: card.id,
        left: getElementBoardRect(cardEl).left,
        top: getElementBoardRect(cardEl).top,
        rotateZ: Number(gsap.getProperty(cardEl, 'rotateZ')) || 0,
      }
    })
    .filter(Boolean)
}

function getHandDrawOrigin() {
  return {
    left: Math.round((window.innerWidth - CARD.width) / 2),
    top: window.innerHeight - CARD.height + 34,
  }
}

function getEnemyDrawOrigin() {
  return {
    left: Math.round((window.innerWidth - CARD.width) / 2),
    top: -CARD.height - 34,
  }
}

function animateCardFromState(cardEl, state, extra = {}) {
  const targetRect = getElementBoardRect(cardEl)
  gsap.set(cardEl, {
    x: state.left - targetRect.left,
    y: state.top - targetRect.top,
    rotateZ: state.rotateZ ?? 0,
    opacity: extra.opacity ?? 1,
    scale: extra.scale ?? 1,
    zIndex: 30,
  })

  return tweenTo(cardEl, {
    x: 0,
    y: 0,
    rotateZ: 0,
    opacity: 1,
    scale: 1,
    duration: ANIM.cleanupDuration,
    ease: 'power2.inOut',
    delay: extra.delay ?? 0,
  }).then(() => {
    gsap.set(cardEl, { clearProps: 'x,y,rotateZ,opacity,scale,zIndex' })
  })
}

async function animateRoundCleanup(playerReturnStates, drawnCards, enemyAliveIds) {
  const animations = []
  const drawOrigin = getHandDrawOrigin()
  const enemyOrigin = getEnemyDrawOrigin()
  const enemyNewIds = gameState.enemyBoard
    .filter((card) => card && !enemyAliveIds.has(card.id))
    .map((card) => card.id)

  playerReturnStates.forEach((state, index) => {
    const targetEl = findPlayerCardEl(state.cardId)
    if (!targetEl) return
    animations.push(animateCardFromState(targetEl, state, { delay: index * 0.05 }))
  })

  drawnCards.forEach((card, index) => {
    const targetEl = findPlayerCardEl(card.id)
    if (!targetEl) return
    animations.push(
      animateCardFromState(targetEl, drawOrigin, {
        delay: playerReturnStates.length * 0.04 + index * 0.06,
        opacity: 0,
        scale: 0.9,
      })
    )
  })

  enemyNewIds.forEach((cardId, index) => {
    const targetEl = findEnemyCardEl(cardId)
    if (!targetEl) return
    animations.push(
      animateCardFromState(targetEl, enemyOrigin, {
        delay: index * 0.05,
        opacity: 0,
        scale: 0.92,
      })
    )
  })

  if (animations.length === 0) {
    await waitForMs(160)
    return
  }

  await Promise.all(animations)
}

function resetCombatFlowState() {
  combatFlowState.active = false
  combatFlowState.finalizing = false
  combatFlowState.steps = []
  combatFlowState.currentStepIndex = 0
  combatFlowState.log = []
  combatFlowState.resolvedSlots.clear()
}

async function finalizeCombatFlow() {
  combatFlowState.finalizing = true
  setResolveButtonLabel('Resolving...')
  setResolveButtonDisabled(true)

  const playerReturnStates = capturePlayerReturnStates()
  const enemyAliveIds = new Set(
    gameState.enemyBoard
      .filter((card) => card && card.hp > 0)
      .map((card) => card.id)
  )

  await waitForMs(220)

  const result = finalizeResolveRound(combatFlowState.log)
  const drawnCards = result.outcome === 'continue' ? drawCards() : []

  updateRoundCounter()
  renderEnemyBoard()
  renderHand()
  refreshVisibleCards()
  await animateRoundCleanup(playerReturnStates, drawnCards, enemyAliveIds)
  reorderColumns()
  logRoundResult(result)

  clearCombatHighlights()
  resetCombatFlowState()
  setHandLocked(false)

  if (result.outcome === 'win') {
    syncResolveButton()
    showOverlay('<div class="overlay-content"><h2>Victory!</h2><p>Enemy defeated.</p></div>')
    return
  }

  if (result.outcome === 'loss') {
    syncResolveButton()
    showOverlay(
      '<div class="overlay-content"><h2>Defeated</h2>' +
      '<p>You have no cards left.</p>' +
      '<button id="btn-restart">Restart</button></div>'
    )
    document.getElementById('btn-restart')?.addEventListener('click', () => location.reload())
    return
  }

  refreshVisibleCards()
  syncResolveButton()
}

async function playCombatStep(stepResult) {
  clearCombatHighlights()
  highlightCombatPair(stepResult.slot)

  const playerCard = findCardById(stepResult.player.id)
  const enemyCard = findCardById(stepResult.enemy.id)
  const playerEl = findPlayerCardEl(stepResult.player.id)
  const enemyEl = findEnemyCardEl(stepResult.enemy.id)

  await Promise.all([
    showResolutionState(playerEl, stepResult.player, playerCard),
    showResolutionState(enemyEl, stepResult.enemy, enemyCard),
  ])
  await waitForMs(ANIM.resolvePauseDuration * 1000)
}

async function continueCombatFlow() {
  if (!combatFlowState.active || combatFlowState.finalizing) return

  const step = combatFlowState.steps[combatFlowState.currentStepIndex]
  if (!step) {
    await finalizeCombatFlow()
    return
  }

  setResolveButtonDisabled(true)
  const result = resolveCombatStep(step.slot)
  combatFlowState.log.push(result)
  combatFlowState.resolvedSlots.add(result.slot)
  await playCombatStep(result)

  combatFlowState.currentStepIndex += 1

  if (combatFlowState.currentStepIndex >= combatFlowState.steps.length) {
    await finalizeCombatFlow()
    return
  }

  setResolveButtonLabel('Continue')
  setResolveButtonDisabled(false)
}

async function startCombatFlow() {
  const prepared = prepareResolveRound()
  if (!prepared) return

  combatFlowState.active = true
  combatFlowState.finalizing = false
  combatFlowState.steps = prepared.steps.filter((step) => !step.skipped)
  combatFlowState.currentStepIndex = 0
  combatFlowState.log = []
  combatFlowState.resolvedSlots.clear()

  setHandLocked(true)
  setResolveButtonLabel('Continue')
  setResolveButtonDisabled(true)
  refreshVisibleCards()

  if (combatFlowState.steps.length === 0) {
    await finalizeCombatFlow()
    return
  }

  await continueCombatFlow()
}

async function onResolve() {
  if (combatFlowState.finalizing) return

  if (combatFlowState.active) {
    await continueCombatFlow()
    return
  }

  await startCombatFlow()
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
  const markersContainer = document.getElementById('board')
  LAYOUT.enemySlots.forEach((slot, i) => {
    const el = createSlotEl({ ...slot, ...enemyPositions[i] }, 'enemy-slot')
    enemySlotsContainer.appendChild(el)
    enemySlotEls[i] = el
    enemyCardEls[i] = null

    const markerX = enemyPositions[i].x + Math.round(CARD.width / 2)
    const markerY = Math.round((enemyRowY + playerRowY + CARD.height) / 2)
    const markerEl = createColumnMarkerEl(markerX, markerY)
    markersContainer.appendChild(markerEl)
    columnMarkerEls[i] = markerEl
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
