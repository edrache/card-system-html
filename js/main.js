import { CARD } from '../config/card.config.js'
import { LAYOUT } from '../config/layout.config.js'
import { GAME } from '../config/game.config.js'
import { ANIM } from '../config/anim.config.js'
import { initDrag } from './interactions.js'
import { createCardEl, updateCardPresentation } from './card-renderer.js'
import {
  claimReward,
  gameState,
  getGhostPlayerBoardCards,
  getResolutionOrder,
  initRun,
  drawCards,
  placeCard,
  unplaceCard,
  prepareResolveRound,
  resolveCombatStep,
  finalizeResolveRound,
  syncDerivedState,
} from './game.js'
import { getDamageBreakdown, getRpsResult } from './combat.js'
import {
  hideOverlay,
  syncResolveButton,
  updateRoundCounter,
  logRoundResult,
  showOverlay,
  setResolveButtonDisabled,
  setResolveButtonLabel,
} from './ui.js'

const COLUMN_SPREAD = 55   // px — max Y offset for column reordering
const COLUMN_FIGHT_EMOJI = '⚔️'
const RPS_ICON = {
  rock: '✊',
  paper: '✋',
  scissors: '✌️',
}

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

const SLOT_MATCHUP_CLASSES = ['slot--advantage', 'slot--neutral', 'slot--disadvantage']

// ── Element factories ─────────────────────────────────────────────────────────

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

function getSlotMatchupClass(card, slotIndex) {
  const enemyCard = gameState.enemyBoard[slotIndex]
  if (!card || !enemyCard || card.ghostBuffer || enemyCard.ghostBuffer) return ''

  const rps = getRpsResult(card, enemyCard)
  if (rps === 'advantage') return 'slot--advantage'
  if (rps === 'neutral') return 'slot--neutral'
  return 'slot--disadvantage'
}

function setSlotMatchupClass(slotEl, matchupClass = '') {
  if (!slotEl) return
  SLOT_MATCHUP_CLASSES.forEach((className) => slotEl.classList.remove(className))
  if (matchupClass) {
    slotEl.classList.add(matchupClass)
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

function findPlayerCardById(cardId) {
  const playerCards = [
    ...gameState.playerHand,
    ...gameState.playerBoard,
    ...gameState.playerDeck,
    ...gameState.playerCemetery,
  ]

  return playerCards.find((card) => card?.id === cardId) ?? null
}

function findEnemyCardById(cardId) {
  const enemyCards = [
    ...gameState.enemyBoard,
    ...gameState.enemyDeck,
    ...gameState.enemyCemetery,
  ]

  return enemyCards.find((card) => card?.id === cardId) ?? null
}

function findCardByOwner(cardId, owner = 'player') {
  return owner === 'enemy' ? findEnemyCardById(cardId) : findPlayerCardById(cardId)
}

function shouldShowCombatProjection(slotIndex) {
  return !combatFlowState.active || !combatFlowState.resolvedSlots.has(slotIndex)
}

function refreshSlotMatchups() {
  playerSlotEls.forEach((slotEl, slotIndex) => {
    if (!slotEl) return
    if (gameState.phase !== 'placement') {
      setSlotMatchupClass(slotEl)
      return
    }

    const card = gameState.playerBoard[slotIndex]
    setSlotMatchupClass(slotEl, getSlotMatchupClass(card, slotIndex))
  })
}

function refreshVisibleCards() {
  document.querySelectorAll('#cards .card, #enemy-cards .card').forEach((cardEl) => {
    const owner = cardEl.classList.contains('card--enemy') ? 'enemy' : 'player'
    const card = findCardByOwner(cardEl.dataset.id, owner)
    if (!card) return

    const slotIndex = cardEl.dataset.slotId ? slotIdToIndex(cardEl.dataset.slotId) : -1
    const combatProjection =
      slotIndex >= 0 && shouldShowCombatProjection(slotIndex)
        ? getCombatProjection(card, slotIndex)
        : null
    updateCardPresentation(cardEl, card, combatProjection)
  })

  refreshSlotMatchups()
  refreshColumnMarkers()
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
  syncDerivedState()
  const container = document.getElementById('cards')
  container.innerHTML = ''

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
      getSlotHighlightClass(slotEl, cardEl) {
        const slotIndex = slotIdToIndex(slotEl.dataset.id)
        const card = findPlayerCardById(cardEl.dataset.id)
        return getSlotMatchupClass(card, slotIndex)
      },
    })

    container.appendChild(el)
  })

  renderGhostPlayerBoard(container)
}

function renderGhostPlayerBoard(container) {
  const count = LAYOUT.slots.length
  const playerRowY = Math.round(window.innerHeight * LAYOUT.playerSlotRowY)
  const positions = calcSlotRow(count, playerRowY)

  getGhostPlayerBoardCards().forEach(({ card, slotIndex }) => {
    const el = createCardEl(card)
    el.classList.add('card--ghost')
    el.style.left = `${positions[slotIndex].x}px`
    el.style.top = `${positions[slotIndex].y}px`
    el.style.cursor = 'default'
    container.appendChild(el)
  })
}

// ── Enemy board rendering ─────────────────────────────────────────────────────

function renderEnemyBoard() {
  syncDerivedState()
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
    if (card.ghostBuffer) {
      el.classList.add('card--ghost')
    }
    el.style.left   = positions[i].x + 'px'
    el.style.top    = positions[i].y + 'px'
    el.style.cursor = 'default'
    container.appendChild(el)
    enemyCardEls[i] = el
  })
}

function formatDeckCount(deckSize) {
  return `${deckSize} ${deckSize === 1 ? 'card' : 'cards'}`
}

function updateDeckButton(buttonId, countId, deckSize) {
  const button = document.getElementById(buttonId)
  const countEl = document.getElementById(countId)
  if (!button || !countEl) return

  button.dataset.deckSize = String(deckSize)
  button.classList.toggle('deck-button--empty', deckSize === 0)
  countEl.textContent = formatDeckCount(deckSize)
}

function renderDeckButtons() {
  updateDeckButton('enemy-deck-button', 'enemy-deck-count', gameState.enemyDeck.length)
  updateDeckButton('enemy-cemetery-button', 'enemy-cemetery-count', gameState.enemyCemetery.length)
  updateDeckButton('player-deck-button', 'player-deck-count', gameState.playerDeck.length)
  updateDeckButton('player-cemetery-button', 'player-cemetery-count', gameState.playerCemetery.length)
}

function createDeckListItem(card, index) {
  const item = document.createElement('article')
  item.className = 'deck-list-item'

  const order = document.createElement('div')
  order.className = 'deck-list-item__order'
  order.textContent = `#${index + 1}`

  const main = document.createElement('div')
  main.className = 'deck-list-item__main'

  const titleRow = document.createElement('div')
  titleRow.className = 'deck-list-item__title-row'

  const name = document.createElement('div')
  name.className = 'deck-list-item__name'
  name.textContent = card.name

  const rps = document.createElement('div')
  rps.className = 'deck-list-item__rps'
  rps.textContent = `${RPS_ICON[card.rps] ?? '?'} ${card.rps}`

  titleRow.appendChild(name)
  titleRow.appendChild(rps)

  const meta = document.createElement('div')
  meta.className = 'deck-list-item__meta'
  meta.textContent = `${card.role} · ATK ${card.value} · HP ${card.hp}`

  const effect = document.createElement('div')
  effect.className = 'deck-list-item__effect'
  effect.textContent = card.effectText ?? 'No special effect'

  main.appendChild(titleRow)
  main.appendChild(meta)
  main.appendChild(effect)

  item.appendChild(order)
  item.appendChild(main)
  return item
}

function showDeckOverlay(ownerLabel, deck, options = {}) {
  const {
    collectionLabel = 'Deck',
    description = `${formatDeckCount(deck.length)} remaining in draw order.`,
    emptyMessage = 'This deck is empty.',
    note = '',
  } = options

  const noteMarkup = note
    ? `<div class="deck-overlay__note">${note}</div>`
    : ''

  showOverlay(
    '<div class="overlay-content overlay-content--deck" role="dialog" aria-modal="true" aria-labelledby="deck-overlay-title">' +
    '<div class="deck-overlay__header">' +
    '<div>' +
    `<div class="deck-overlay__eyebrow">${ownerLabel}</div>` +
    `<h2 id="deck-overlay-title">${ownerLabel} ${collectionLabel}</h2>` +
    `<p>${description}</p>` +
    '</div>' +
    '<button id="deck-overlay-close" class="deck-overlay__close" type="button" aria-label="Close deck view">Close</button>' +
    '</div>' +
    noteMarkup +
    '<div id="deck-overlay-list" class="deck-overlay__list"></div>' +
    '</div>'
  )

  const list = document.getElementById('deck-overlay-list')
  if (!list) return

  if (deck.length === 0) {
    const empty = document.createElement('div')
    empty.className = 'deck-overlay__empty'
    empty.textContent = emptyMessage
    list.appendChild(empty)
  } else {
    deck.forEach((card, index) => {
      list.appendChild(createDeckListItem(card, index))
    })
  }

  document.getElementById('deck-overlay-close')?.addEventListener('click', hideOverlay)
}

function bindDeckButtons() {
  document.getElementById('enemy-deck-button')?.addEventListener('click', () => {
    showDeckOverlay('Opponent', gameState.enemyDeck)
  })

  document.getElementById('enemy-cemetery-button')?.addEventListener('click', () => {
    showDeckOverlay('Opponent', gameState.enemyCemetery, {
      collectionLabel: 'Cemetery',
      description: `${formatDeckCount(gameState.enemyCemetery.length)} lost so far.`,
      emptyMessage: 'No enemy cards have been lost yet.',
      note: 'Cards in the Cemetery are lost for this encounter set. Future mechanics may let you recover them.',
    })
  })

  document.getElementById('player-deck-button')?.addEventListener('click', () => {
    showDeckOverlay('Player', gameState.playerDeck)
  })

  document.getElementById('player-cemetery-button')?.addEventListener('click', () => {
    showDeckOverlay('Player', gameState.playerCemetery, {
      collectionLabel: 'Cemetery',
      description: `${formatDeckCount(gameState.playerCemetery.length)} lost so far.`,
      emptyMessage: 'No cards have been lost yet.',
      note: 'Cards in the Cemetery are lost for this run. Future mechanics may let you recover them.',
    })
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

function showRewardOverlay(rewardChoices) {
  showOverlay(
    '<div class="overlay-content overlay-content--reward">' +
    '<h2>Choose a Reward</h2>' +
    '<p>Add 1 card to your deck, then face a fresh encounter.</p>' +
    '<div id="reward-choices" class="reward-choices"></div>' +
    '</div>'
  )

  const rewardChoicesEl = document.getElementById('reward-choices')
  if (!rewardChoicesEl) return

  rewardChoices.forEach((card) => {
    const choiceButton = document.createElement('button')
    choiceButton.type = 'button'
    choiceButton.className = 'reward-choice'

    const label = document.createElement('span')
    label.className = 'reward-choice__label'
    label.textContent = 'Add to deck'

    const cardEl = createCardEl(card)
    cardEl.classList.add('reward-choice__card')
    cardEl.style.position = 'relative'
    cardEl.style.left = '0'
    cardEl.style.top = '0'
    cardEl.style.cursor = 'pointer'

    choiceButton.appendChild(cardEl)
    choiceButton.appendChild(label)
    choiceButton.addEventListener('click', () => {
      const reward = claimReward(card.id)
      if (!reward) return

      hideOverlay()
      drawCards()
      updateRoundCounter()
      renderEnemyBoard()
      renderHand()
      renderDeckButtons()
      refreshVisibleCards()
      reorderColumns()
      syncResolveButton()
    })

    rewardChoicesEl.appendChild(choiceButton)
  })
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

  document.querySelectorAll('.slot:not(.enemy-slot)').forEach((el) => el.classList.remove('slot--occupied'))

  const result = finalizeResolveRound(combatFlowState.log)
  const drawnCards = result.outcome === 'continue' ? drawCards() : []

  updateRoundCounter()
  renderEnemyBoard()
  renderHand()
  renderDeckButtons()
  refreshVisibleCards()
  await animateRoundCleanup(playerReturnStates, drawnCards, enemyAliveIds)
  reorderColumns()
  logRoundResult(result)

  clearCombatHighlights()
  resetCombatFlowState()
  setHandLocked(false)

  if (result.outcome === 'win') {
    syncResolveButton()
    showRewardOverlay(result.rewardChoices ?? [])
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

  const playerCard = findPlayerCardById(stepResult.player.id)
  const enemyCard = findEnemyCardById(stepResult.enemy.id)
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

function serializeCardForText(card) {
  if (!card) return null

  return {
    id: card.id,
    name: card.name,
    rps: card.rps,
    role: card.role,
    value: card.value,
    hp: card.hp,
    buffs: card.buffs,
    ghostBuffer: Boolean(card.ghostBuffer),
  }
}

function buildTextState() {
  return {
    coordinateSystem: 'origin at top-left, x right, y down',
    phase: gameState.phase,
    round: gameState.round,
    playerDeckCount: gameState.playerDeck.length,
    playerCemeteryCount: gameState.playerCemetery.length,
    enemyDeckCount: gameState.enemyDeck.length,
    enemyCemeteryCount: gameState.enemyCemetery.length,
    playerDeck: gameState.playerDeck.map(serializeCardForText),
    playerCemetery: gameState.playerCemetery.map(serializeCardForText),
    enemyDeck: gameState.enemyDeck.map(serializeCardForText),
    enemyCemetery: gameState.enemyCemetery.map(serializeCardForText),
    playerHand: gameState.playerHand.map(serializeCardForText),
    playerBoard: gameState.playerBoard.map(serializeCardForText),
    enemyBoard: gameState.enemyBoard.map(serializeCardForText),
    rewardChoices: gameState.rewardChoices.map(serializeCardForText),
    overlayOpen: !document.getElementById('overlay')?.classList.contains('hidden'),
    resolveButtonDisabled: document.getElementById('btn-resolve')?.disabled ?? true,
    resolveButtonLabel: document.getElementById('btn-resolve')?.textContent ?? '',
  }
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
  bindDeckButtons()

  initRun()
  drawCards()
  updateRoundCounter()
  renderEnemyBoard()
  reorderColumns()
  renderHand()
  renderDeckButtons()
  refreshVisibleCards()
  syncResolveButton()

  window.render_game_to_text = () => JSON.stringify(buildTextState())
  window.advanceTime = () => window.render_game_to_text()
}

if (document.getElementById('board')) {
  init()
}
