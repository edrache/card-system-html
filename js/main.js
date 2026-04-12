import { CARD } from '../config/card.config.js'
import { LAYOUT } from '../config/layout.config.js'
import { ANIM } from '../config/anim.config.js'
import { initDrag } from './interactions.js'
import { createCardEl, updateCardPresentation } from './card-renderer.js'
import {
  claimReward,
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
import { getCombatPreview, getRpsResult } from './combat.js'
import {
  hideOverlay,
  syncResolveButton,
  updateRoundCounter,
  logRoundResult,
  showOverlay,
  setResolveButtonDisabled,
  setResolveButtonLabel,
} from './ui.js'
import {
  initRpsTracker,
  projectCard,
  clearProjection,
  resolveCard,
  resetTracker,
} from './rps-tracker.js'

const RPS_ICON = {
  pressure: '🔥',
  appeal: '🎭',
  positioning: '🧭',
}

const ROLE_TEXT = {
  attack: 'Attack adds +1 to the rolled value.',
  defense: 'Defense reduces incoming damage by 1.',
  support: 'Support widens adjacent allies by +1.',
}

// ── DOM refs tracked by slot index ───────────────────────────────────────────

const playerSlotEls = []  // playerSlotEls[i] = player slot element at index i
const enemySlotEls = []  // enemySlotEls[i]  = enemy slot element at index i
const enemyCardEls = []  // enemyCardEls[i]  = enemy card element at index i (null if empty)
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

function getRpsProjection(owner, slotIndex) {
  const playerCard = gameState.playerBoard[slotIndex]
  const enemyCard = gameState.enemyBoard[slotIndex]
  if (!playerCard || !enemyCard) return null

  if (owner === 'enemy') {
    const preview = getCombatPreview(
      enemyCard,
      playerCard,
      gameState.enemyBoard,
      gameState.playerBoard,
      slotIndex,
      slotIndex
    )

    return {
      label: preview.label,
      rps: preview.rps,
      self: preview.player,
      opponent: preview.enemy,
      valueBonuses: preview.player.supportBonus > 0 ? [preview.player.supportBonus] : [],
      effectiveRange: preview.player.range,
    }
  }

  const preview = getCombatPreview(
    playerCard,
    enemyCard,
    gameState.playerBoard,
    gameState.enemyBoard,
    slotIndex,
    slotIndex
  )

  return {
    label: preview.label,
    rps: preview.rps,
    self: preview.player,
    opponent: preview.enemy,
    valueBonuses: preview.player.supportBonus > 0 ? [preview.player.supportBonus] : [],
    effectiveRange: preview.player.range,
  }
}

function getSlotMatchupClass(card, slotIndex) {
  const enemyCard = gameState.enemyBoard[slotIndex]
  if (!card || !enemyCard) return ''

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
  el.innerHTML = '<span class="column-fight-marker__emoji">⚔️</span><span class="column-marker--order"></span>'
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

function showPlacementOrderMarkers(resolutionOrder) {
  columnMarkerEls.forEach((markerEl) => {
    if (!markerEl) return
    markerEl.querySelector('.column-marker--order').textContent = ''
  })

  resolutionOrder.forEach((slotIndex, index) => {
    const markerEl = columnMarkerEls[slotIndex]
    if (!markerEl) return
    markerEl.querySelector('.column-marker--order').textContent = formatOrdinal(index + 1)
  })
}

function clearPlacementOrderMarkers() {
  columnMarkerEls.forEach((markerEl) => {
    if (!markerEl) return
    markerEl.querySelector('.column-marker--order').textContent = ''
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
        ? getRpsProjection(owner, slotIndex)
        : null
    updateCardPresentation(cardEl, card, {
      combatProjection,
      valueBonuses: combatProjection?.valueBonuses ?? [],
      effectiveRange: combatProjection?.effectiveRange ?? card.value,
    })
  })

  refreshSlotMatchups()
  if (gameState.phase === 'placement' || gameState.phase === 'combat') {
    showPlacementOrderMarkers(getResolutionOrder())
  } else {
    clearPlacementOrderMarkers()
  }
}

// ── Slot flavor text ─────────────────────────────────────────────────────────

function showSlotFlavor(slotEl, flavor) {
  hideSlotFlavor(slotEl)
  if (!flavor) return

  const board = document.getElementById('board')
  const slotLeft = parseFloat(slotEl.style.left)
  const slotTop = parseFloat(slotEl.style.top)

  const el = document.createElement('div')
  el.className = 'slot-flavor'
  el.dataset.slotId = slotEl.dataset.id

  const rotation = Math.round(Math.random() * 20 - 10)
  el.style.left = (slotLeft + CARD.width / 2) + 'px'
  el.style.top = (slotTop + CARD.height + Math.round(Math.random() * 100) + 10) + 'px'
  el.style.transform = `translateX(-50%) rotate(${rotation}deg)`

  board.appendChild(el)

  let i = 0
  const timer = setInterval(() => {
    el.textContent = flavor.slice(0, i + 1)
    i++
    if (i >= flavor.length) clearInterval(timer)
  }, ANIM.flavorTypeSpeed)
}

function hideSlotFlavor(slotEl) {
  const board = document.getElementById('board')
  board.querySelectorAll(`.slot-flavor[data-slot-id="${slotEl.dataset.id}"]`)
    .forEach(el => el.remove())
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

// ── Hand rendering ────────────────────────────────────────────────────────────

function renderHand() {
  const container = document.getElementById('cards')
  container.innerHTML = ''

  const handY = window.innerHeight - CARD.height - 50
  const positions = calcSlotRow(gameState.playerHand.length, handY)

  gameState.playerHand.forEach((card, i) => {
    const el = createCardEl(card)
    el.style.left = positions[i].x + 'px'
    el.style.top = positions[i].y + 'px'

    initDrag(el, {
      onSnap(slotEl, cardEl) {
        const slotIndex = slotIdToIndex(slotEl.dataset.id)
        placeCard(cardEl.dataset.id, slotIndex)
        refreshVisibleCards()
        syncResolveButton()
        const card = findPlayerCardById(cardEl.dataset.id)
        if (card) projectCard(card.rps)
        showSlotFlavor(slotEl, card?.flavor ?? null)
      },
      onUnsnap(slotEl, cardEl) {
        const slotIndex = slotIdToIndex(slotEl.dataset.id)
        unplaceCard(slotIndex)
        clearProjection()
        refreshVisibleCards()
        syncResolveButton()
        hideSlotFlavor(slotEl)
      },
      getSlotHighlightClass(slotEl, cardEl) {
        const slotIndex = slotIdToIndex(slotEl.dataset.id)
        const card = findPlayerCardById(cardEl.dataset.id)
        return getSlotMatchupClass(card, slotIndex)
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

  const count = LAYOUT.enemySlots.length
  const enemyRowY = Math.round(window.innerHeight * LAYOUT.enemySlotRowY)
  const positions = calcSlotRow(count, enemyRowY)

  gameState.enemyBoard.forEach((card, i) => {
    if (!card) {
      enemyCardEls[i] = null
      return
    }
    const el = createCardEl(card, true /* isEnemy */)
    el.dataset.slotId = `enemy-slot-${i}`
    el.style.left = positions[i].x + 'px'
    el.style.top = positions[i].y + 'px'
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
  meta.textContent = `${card.role} · Value ${card.value}`

  const effect = document.createElement('div')
  effect.className = 'deck-list-item__effect'
  effect.textContent = ROLE_TEXT[card.role] ?? 'No special role effect'

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
  document.querySelectorAll('.card__roll-frame').forEach((el) => el.remove())
  document.querySelectorAll('.card__value-previous').forEach((el) => el.remove())
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

  const value = document.createElement('div')
  value.className = 'card__resolution-line'
  value.textContent = `Value ${sideResult.valueBefore} -> ${sideResult.valueAfter}`

  const dealt = document.createElement('div')
  dealt.className = 'card__resolution-line'
  dealt.textContent = `Deals ${sideResult.dealt}`

  const rolls = document.createElement('div')
  rolls.className = 'card__resolution-line'
  rolls.textContent = `Rolls ${sideResult.rolls.join(', ')}`

  note.appendChild(title)
  note.appendChild(value)
  note.appendChild(dealt)
  note.appendChild(rolls)
  return note
}

function getChosenRoll(rolls = []) {
  if (!Array.isArray(rolls) || rolls.length === 0) return null
  return Math.max(...rolls)
}

function getChosenRollIndex(sideResult) {
  if (!sideResult || !Array.isArray(sideResult.rolls) || sideResult.rolls.length === 0) {
    return -1
  }

  if (
    Number.isInteger(sideResult.chosenRollIndex) &&
    sideResult.chosenRollIndex >= 0 &&
    sideResult.chosenRollIndex < sideResult.rolls.length
  ) {
    return sideResult.chosenRollIndex
  }

  const chosenRoll = sideResult.chosenRoll ?? getChosenRoll(sideResult.rolls)
  return sideResult.rolls.findIndex((value) => value === chosenRoll)
}

function createRollFrame(sideResult) {
  const chosenRoll = sideResult.chosenRoll ?? getChosenRoll(sideResult.rolls)
  if (chosenRoll === null) return null

  const frame = document.createElement('div')
  frame.className = 'card__roll-frame'

  const label = document.createElement('div')
  label.className = 'card__roll-label'
  label.textContent = sideResult.rolls.length > 1 ? 'Rolls' : 'Roll'

  frame.appendChild(label)

  const values = document.createElement('div')
  values.className = 'card__roll-values'
  const chosenRollIndex = getChosenRollIndex(sideResult)

  sideResult.rolls.forEach((rollValue, index) => {
    const rollChip = document.createElement('div')
    const isChosen = index === chosenRollIndex
    rollChip.className = isChosen
      ? 'card__roll-chip card__roll-chip--chosen'
      : 'card__roll-chip'
    rollChip.textContent = String(rollValue)
    values.appendChild(rollChip)
  })

  frame.appendChild(values)

  if (sideResult.rolls.length > 1) {
    const detail = document.createElement('div')
    detail.className = 'card__roll-detail'
    detail.textContent = `Chosen ${chosenRoll}`
    frame.appendChild(detail)
  }

  return frame
}

function showResolutionState(cardEl, sideResult, card) {
  if (!cardEl || !card) return Promise.resolve()

  cardEl.classList.add('card--resolving')
  cardEl.classList.toggle('card--destroyed', sideResult.died)
  updateCardPresentation(cardEl, card, { previousValue: sideResult.valueBefore })
  cardEl.querySelector('.card__resolution-note')?.remove()
  cardEl.querySelector('.card__roll-frame')?.remove()
  const rollFrame = createRollFrame(sideResult)
  if (rollFrame) {
    cardEl.appendChild(rollFrame)
  }
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
    .map((card) => {
      if (!card || card.value <= 0) return null
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
      resetTracker()

      hideOverlay()
      drawCards()
      updateRoundCounter()
      renderEnemyBoard()
      renderHand()
      renderDeckButtons()
      refreshVisibleCards()
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
      .filter((card) => card && card.value > 0)
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
  logRoundResult(result)

  clearCombatHighlights()
  clearPlacementOrderMarkers()
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
  const trackedCard = gameState.playerBoard[step.slot]
  if (trackedCard) resolveCard(trackedCard.rps)
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

  showPlacementOrderMarkers(prepared.resolutionOrder)
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

  const count = LAYOUT.slots.length
  const enemyRowY = Math.round(window.innerHeight * LAYOUT.enemySlotRowY)
  const playerRowY = Math.round(window.innerHeight * LAYOUT.playerSlotRowY)

  const enemyPositions = calcSlotRow(count, enemyRowY)
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
  initRpsTracker()
  drawCards()
  updateRoundCounter()
  renderEnemyBoard()
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
