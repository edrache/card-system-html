import { CARD } from '../config/card.config.js'
import { GAME } from '../config/game.config.js'
import { LAYOUT } from '../config/layout.config.js'
import { addBuffSource, ensureBuffState, getBuffSummary } from './buffs.js'
import { createCardEl as createSharedCardEl, updateCardPresentation } from './card-renderer.js'
import {
  gameState,
  initRun,
  drawCards,
  placeCard,
  unplaceCard,
  canResolve,
  prepareResolveRound,
  resolveCombatStep,
  getResolutionOrder,
} from './game.js'
import { createDeck } from './cards-data.js'
import { initDrag } from './interactions.js'

const TOTAL_STEPS = 25

const CHAPTER_TITLES = {
  1: 'Chapter 1\nThe Board and Cards',
  2: 'Chapter 2\nPhases and Combat',
  3: 'Chapter 3\nModifiers',
  4: 'Chapter 4\nAdvanced',
}

const CARD_LIBRARY = new Map(createDeck().map((card) => [card.id, card]))

let currentStepIndex = 0
let placementObserver = null
let resolveHandler = null
let readyToLaunch = false
let tutorialInitialized = false

export function getChapterForStep(stepIndex) {
  const step = TUTORIAL_STEPS[stepIndex]
  return step ? step.chapter : null
}

export function isNewChapter(stepIndex) {
  if (stepIndex === 0) return true
  const step = TUTORIAL_STEPS[stepIndex]
  const prev = TUTORIAL_STEPS[stepIndex - 1]
  if (!step || !prev) return false
  return step.chapter !== prev.chapter
}

function hasTutorialDom() {
  return Boolean(document.getElementById('board'))
}

function cloneCard(cardId, overrides = {}) {
  const template = CARD_LIBRARY.get(cardId)
  if (!template) {
    throw new Error(`Unknown tutorial card id: ${cardId}`)
  }

  return {
    ...template,
    effect: template.effect ? { ...template.effect } : null,
    buffSources: [],
    buffs: 0,
    buffMeta: undefined,
    ...overrides,
  }
}

function addBuff(card, amount, label, description, scope = 'persistent') {
  addBuffSource(card, {
    id: `${label.toLowerCase().replace(/\s+/g, '-')}:${card.id}:${card.buffSources?.length ?? 0}`,
    amount,
    label,
    description,
    scope,
  })
}

function resetGameState() {
  gameState.phase = 'draw'
  gameState.round = 1
  gameState.playerDeck = []
  gameState.playerHand = []
  gameState.playerBoard = Array(GAME.SLOT_COUNT).fill(null)
  gameState.enemyDeck = []
  gameState.enemyBoard = Array(GAME.SLOT_COUNT).fill(null)
  gameState.placementOrder = []
}

function prepareBoardChrome() {
  const board = document.getElementById('board')
  const resolveButton = document.getElementById('btn-resolve')
  const nextButton = document.getElementById('tutorial-next-btn')

  if (board) {
    board.style.backgroundColor = LAYOUT.boardBg
  }

  readyToLaunch = false
  if (nextButton) nextButton.textContent = 'Next ->'
  if (resolveButton) {
    resolveButton.disabled = true
    resolveButton.textContent = 'Resolve'
  }
}

function getSlotPositions() {
  const board = document.getElementById('board')
  const boardW = board?.clientWidth ?? window.innerWidth
  const boardH = board?.clientHeight ?? window.innerHeight
  const gap = LAYOUT.cardGap
  const totalW = GAME.SLOT_COUNT * CARD.width + (GAME.SLOT_COUNT - 1) * gap
  const startX = (boardW - totalW) / 2
  const y = boardH * LAYOUT.playerSlotRowY - CARD.height / 2

  return Array.from({ length: GAME.SLOT_COUNT }, (_, index) => ({
    id: `slot-${index}`,
    x: startX + index * (CARD.width + gap),
    y,
  }))
}

function getEnemyPositions() {
  const board = document.getElementById('board')
  const boardW = board?.clientWidth ?? window.innerWidth
  const boardH = board?.clientHeight ?? window.innerHeight
  const gap = LAYOUT.cardGap
  const totalW = GAME.SLOT_COUNT * CARD.width + (GAME.SLOT_COUNT - 1) * gap
  const startX = (boardW - totalW) / 2
  const y = boardH * LAYOUT.enemySlotRowY - CARD.height / 2 + 16

  return Array.from({ length: GAME.SLOT_COUNT }, (_, index) => ({
    id: `enemy-slot-${index}`,
    x: startX + index * (CARD.width + gap),
    y,
  }))
}

function getHandPositions(count) {
  const board = document.getElementById('board')
  const boardW = board?.clientWidth ?? window.innerWidth
  const boardH = board?.clientHeight ?? window.innerHeight
  const gap = Math.min(20, LAYOUT.cardGap / 2)
  const totalW = count * CARD.width + Math.max(0, count - 1) * gap
  const startX = (boardW - totalW) / 2
  const y = boardH - CARD.height - 54

  return Array.from({ length: count }, (_, index) => ({
    x: startX + index * (CARD.width + gap),
    y,
  }))
}

function createSlotEl(id, x, y, enemy = false) {
  const el = document.createElement('div')
  el.className = enemy ? 'slot enemy-slot' : 'slot'
  el.dataset.id = id
  el.style.width = `${CARD.width}px`
  el.style.height = `${CARD.height}px`
  el.style.borderRadius = `${CARD.borderRadius}px`
  el.style.left = `${x}px`
  el.style.top = `${y}px`
  el.style.borderColor = CARD.slotBorderColor
  el.style.borderWidth = '2px'
  el.style.borderStyle = enemy ? 'solid' : 'dashed'
  return el
}

function createCardEl(card, options = {}) {
  ensureBuffState(card)
  const summary = getBuffSummary(card)

  const el = createSharedCardEl(card, options.enemy)
  el.classList.toggle('card--tutorial-dead', card.hp <= 0)
  el.style.position = 'absolute'
  el.style.left = `${options.left ?? 0}px`
  el.style.top = `${options.top ?? 0}px`
  el.style.zIndex = options.zIndex ?? 1

  if (summary.total > 0) {
    const buffs = document.createElement('div')
    buffs.className = 'card__buffs'
    buffs.textContent = `+${summary.total}`
    el.appendChild(buffs)
  }

  if (typeof options.order === 'number') {
    const order = document.createElement('div')
    order.className = 'card__order-badge'
    order.textContent = `#${options.order}`
    el.appendChild(order)
  }

  if (options.note) {
    const note = document.createElement('div')
    note.className = `card__note${card.hp <= 0 ? ' card__note--dead' : ''}`
    note.textContent = options.note
    el.appendChild(note)
  }

  return el
}

export function clearAll() {
  for (const selector of ['#cards', '#slots', '#enemy-slots', '#enemy-cards']) {
    const el = document.querySelector(selector)
    if (el) el.innerHTML = ''
  }
}

function syncRoundCounter() {
  const round = document.getElementById('round-counter')
  if (round) round.textContent = `Round ${gameState.round}`
}

function renderPlayerSlots() {
  const container = document.getElementById('slots')
  if (!container) return
  container.innerHTML = ''
  getSlotPositions().forEach((slot) => {
    container.appendChild(createSlotEl(slot.id, slot.x, slot.y))
  })
}

function renderEnemySlots() {
  const container = document.getElementById('enemy-slots')
  if (!container) return
  container.innerHTML = ''
  getEnemyPositions().forEach((slot) => {
    container.appendChild(createSlotEl(slot.id, slot.x, slot.y, true))
  })
}

function syncCardDecoration(cardEl, card) {
  const summary = getBuffSummary(card)
  updateCardPresentation(cardEl, card)

  const existingBuff = cardEl.querySelector('.card__buffs')
  if (summary.total > 0) {
    if (existingBuff) {
      existingBuff.textContent = `+${summary.total}`
    } else {
      const buffs = document.createElement('div')
      buffs.className = 'card__buffs'
      buffs.textContent = `+${summary.total}`
      cardEl.appendChild(buffs)
    }
  } else if (existingBuff) {
    existingBuff.remove()
  }
}

function renderHand(cards, draggable = false) {
  const container = document.getElementById('cards')
  if (!container) return
  const positions = getHandPositions(cards.length)

  cards.forEach((card, index) => {
    const el = createCardEl(card, {
      left: positions[index].x,
      top: positions[index].y,
    })
    container.appendChild(el)

    if (!draggable) return

    initDrag(el, {
      onSnap(slotEl, cardEl) {
        const slotIndex = Number(slotEl.dataset.id.replace('slot-', ''))
        if (Number.isNaN(slotIndex)) return
        if (!placeCard(card.id, slotIndex)) return
        cardEl.dataset.slotId = slotEl.dataset.id
        syncCardDecoration(cardEl, card)
        syncResolveButton()
      },
      onUnsnap(slotEl) {
        const slotIndex = Number(slotEl.dataset.id.replace('slot-', ''))
        if (Number.isNaN(slotIndex)) return
        if (!unplaceCard(slotIndex)) return
        syncResolveButton()
      },
    })
  })
}

function renderCardsOnSlots(board, options = {}) {
  const container = document.getElementById('cards')
  if (!container) return

  const positions = getSlotPositions()
  board.forEach((card, index) => {
    if (!card) return
    const el = createCardEl(card, {
      left: positions[index].x,
      top: positions[index].y,
      zIndex: 2,
      note: options.notes?.[index],
    })
    el.dataset.slotId = `slot-${index}`
    container.appendChild(el)
    const slotEl = document.querySelector(`#slots .slot[data-id="slot-${index}"]`)
    if (slotEl) slotEl.classList.add('slot--occupied')
  })
}

function renderEnemyBoard(cards, options = {}) {
  const slotsContainer = document.getElementById('enemy-slots')
  const cardsContainer = document.getElementById('enemy-cards')
  if (!slotsContainer || !cardsContainer) return

  renderEnemySlots()
  cardsContainer.innerHTML = ''
  const positions = getEnemyPositions()

  const orderMap = new Map()
  if (options.showOrder) {
    getResolutionOrder(cards).forEach((slotIndex, orderIndex) => {
      orderMap.set(slotIndex, orderIndex + 1)
    })
  }

  positions.forEach((pos, index) => {
    const card = cards[index]
    if (!card) return
    const el = createCardEl(card, {
      enemy: true,
      left: pos.x,
      top: pos.y,
      order: orderMap.get(index),
      note: options.notes?.[index],
    })
    cardsContainer.appendChild(el)
  })
}

function renderScene({ draggable = false, enemyOrder = false, playerNotes = null, enemyNotes = null } = {}) {
  clearAll()
  renderPlayerSlots()
  renderEnemyBoard(gameState.enemyBoard, { showOrder: enemyOrder, notes: enemyNotes })
  renderCardsOnSlots(gameState.playerBoard, { notes: playerNotes })
  renderHand(gameState.playerHand, draggable)
  syncRoundCounter()
  syncResolveButton()
}

function syncResolveButton() {
  const btn = document.getElementById('btn-resolve')
  if (!btn) return
  btn.disabled = !canResolve()
  btn.textContent = 'Resolve'
}

function clearHighlights() {
  document.querySelectorAll('.tutorial-highlight').forEach((el) => el.classList.remove('tutorial-highlight'))
}

function clearDimmed() {
  document.querySelectorAll('.tutorial-dimmed').forEach((el) => el.classList.remove('tutorial-dimmed'))
}

function applyHighlight(selector) {
  clearHighlights()
  if (!selector) return
  document.querySelectorAll(selector).forEach((el) => el.classList.add('tutorial-highlight'))
}

function applyLock(lock, highlightSelector) {
  clearDimmed()
  if (!lock) return

  const interactiveEls = document.querySelectorAll('.card, .slot, #btn-resolve')
  if (lock === 'all') {
    interactiveEls.forEach((el) => {
      if (!highlightSelector || !el.matches(highlightSelector)) {
        el.classList.add('tutorial-dimmed')
      }
    })
    return
  }

  if (Array.isArray(lock)) {
    lock.forEach((selector) => {
      document.querySelectorAll(selector).forEach((el) => el.classList.add('tutorial-dimmed'))
    })
  }
}

function showTooltip(text, showNext) {
  const tooltip = document.getElementById('tutorial-tooltip')
  const textEl = document.getElementById('tutorial-tooltip-text')
  const nextBtn = document.getElementById('tutorial-next-btn')
  if (!tooltip || !textEl || !nextBtn) return

  textEl.textContent = text
  nextBtn.classList.toggle('hidden', !showNext)
  tooltip.classList.remove('hidden')
}

function updateProgress() {
  const fill = document.getElementById('tutorial-progress-fill')
  const label = document.getElementById('tutorial-progress-label')
  if (!fill || !label) return

  const pct = ((currentStepIndex + 1) / TOTAL_STEPS) * 100
  fill.style.width = `${pct}%`
  label.textContent = `Step ${currentStepIndex + 1} / ${TOTAL_STEPS}`
}

function showChapterBanner(chapterNum) {
  return new Promise((resolve) => {
    const banner = document.getElementById('tutorial-chapter-banner')
    const text = document.getElementById('tutorial-chapter-text')
    if (!banner || !text) {
      resolve()
      return
    }

    text.textContent = CHAPTER_TITLES[chapterNum]
    banner.classList.remove('hidden')
    window.setTimeout(() => {
      banner.classList.add('hidden')
      resolve()
    }, 1800)
  })
}

function clearStepWatchers() {
  if (placementObserver) {
    placementObserver.disconnect()
    placementObserver = null
  }

  if (resolveHandler) {
    const button = document.getElementById('btn-resolve')
    if (button) button.removeEventListener('click', resolveHandler)
    resolveHandler = null
  }
}

function watchPlacement(targetCount) {
  const slotsContainer = document.getElementById('slots')
  if (!slotsContainer) return

  placementObserver = new MutationObserver(() => {
    const occupied = slotsContainer.querySelectorAll('.slot--occupied').length
    if (occupied >= targetCount) {
      clearStepWatchers()
      nextStep()
    }
  })

  placementObserver.observe(slotsContainer, {
    subtree: true,
    attributes: true,
    attributeFilter: ['class'],
  })
}

function renderResolvedCombatScene() {
  const playerNotes = {}
  const enemyNotes = {}
  gameState.playerBoard.forEach((card, index) => {
    if (!card) return
    playerNotes[index] = card.hp <= 0 ? 'Destroyed in combat' : `Survives at ${card.hp} HP`
  })
  gameState.enemyBoard.forEach((card, index) => {
    if (!card) return
    enemyNotes[index] = card.hp <= 0 ? 'Destroyed in combat' : `Survives at ${card.hp} HP`
  })
  renderScene({ playerNotes, enemyNotes })
}

function handleResolveAdvance() {
  const prepared = prepareResolveRound()
  if (!prepared) return

  prepared.resolutionOrder.forEach((slotIndex) => {
    resolveCombatStep(slotIndex)
  })

  clearStepWatchers()
  nextStep()
}

function applyStep(step) {
  prepareBoardChrome()
  clearStepWatchers()

  if (step.setup) step.setup()

  applyHighlight(step.highlight)
  applyLock(step.lock, step.highlight)
  showTooltip(step.tooltip, step.advance === 'click')
  updateProgress()

  if (step.advance === 'cardPlaced') {
    watchPlacement(1)
  }

  if (step.advance === 'allPlaced') {
    watchPlacement(GAME.SLOT_COUNT)
  }

  if (step.advance === 'resolved') {
    const btn = document.getElementById('btn-resolve')
    if (!btn) return
    btn.disabled = false
    btn.classList.remove('tutorial-dimmed')
    resolveHandler = () => handleResolveAdvance()
    btn.addEventListener('click', resolveHandler, { once: true })
  }
}

async function nextStep() {
  currentStepIndex += 1
  if (currentStepIndex >= TUTORIAL_STEPS.length) return

  const step = TUTORIAL_STEPS[currentStepIndex]
  if (isNewChapter(currentStepIndex)) {
    await showChapterBanner(step.chapter)
  }
  applyStep(step)
}

function onNextButtonClick() {
  const step = TUTORIAL_STEPS[currentStepIndex]
  if (!step || step.advance !== 'click') return
  if (readyToLaunch) {
    window.location.href = 'index.html'
    return
  }
  nextStep()
}

function initTutorial() {
  if (tutorialInitialized) return
  tutorialInitialized = true

  prepareBoardChrome()

  const nextBtn = document.getElementById('tutorial-next-btn')
  if (nextBtn) nextBtn.addEventListener('click', onNextButtonClick)

  const firstStep = TUTORIAL_STEPS[0]
  if (!firstStep) return

  showChapterBanner(firstStep.chapter).then(() => applyStep(firstStep))
}

function exposeTestState() {
  window.render_game_to_text = () => JSON.stringify({
    step: TUTORIAL_STEPS[currentStepIndex]?.id ?? null,
    stepIndex: currentStepIndex,
    round: gameState.round,
    phase: gameState.phase,
    playerHand: gameState.playerHand.map((card) => ({
      id: card.id,
      hp: card.hp,
      buffs: card.buffs,
    })),
    playerBoard: gameState.playerBoard.map((card) => (
      card ? { id: card.id, hp: card.hp, buffs: card.buffs } : null
    )),
    enemyBoard: gameState.enemyBoard.map((card) => (
      card ? { id: card.id, hp: card.hp, buffs: card.buffs } : null
    )),
  })

  window.advanceTime = () => window.render_game_to_text()
}

function welcomeScene() {
  resetGameState()
  initRun()
  drawCards()
  renderScene()
}

function anatomyScene() {
  welcomeScene()
}

function rpsScene() {
  resetGameState()
  gameState.playerHand = [cloneCard('aggressor-6')]
  gameState.enemyBoard = [cloneCard('aggressor-4'), null, null]
  renderScene()
}

function firstDragScene() {
  resetGameState()
  gameState.phase = 'placement'
  gameState.playerHand = [cloneCard('aggressor-6')]
  renderScene({ draggable: true })
}

function phasesScene() {
  welcomeScene()
}

function drawPhaseScene() {
  resetGameState()
  initRun()
  drawCards()
  renderScene()
}

function placementScene() {
  resetGameState()
  initRun()
  drawCards()
  gameState.phase = 'placement'
  renderScene({ draggable: true })
}

function combatResultScene() {
  renderResolvedCombatScene()
}

function attackRoleScene() {
  resetGameState()
  gameState.playerHand = [cloneCard('aggressor-6')]
  gameState.enemyBoard = [cloneCard('defender-6'), null, null]
  renderScene()
}

function defenseRoleScene() {
  resetGameState()
  gameState.playerHand = [cloneCard('aggressor-4')]
  gameState.enemyBoard = [cloneCard('defender-6'), null, null]
  renderScene()
}

function firstCardBonusScene() {
  resetGameState()
  gameState.phase = 'placement'
  gameState.playerHand = [cloneCard('aggressor-6')]
  gameState.enemyBoard = [cloneCard('aggressor-4'), null, null]
  renderScene({ draggable: true })
}

function supportPlacementScene() {
  resetGameState()
  gameState.phase = 'placement'
  gameState.playerHand = [
    cloneCard('aggressor-6'),
    cloneCard('buffer-3'),
    cloneCard('defender-6'),
  ]
  placeCard('aggressor-6', 0)
  placeCard('buffer-3', 1)
  placeCard('defender-6', 2)
  renderScene()
}

function supportSurviveScene() {
  resetGameState()
  const left = cloneCard('aggressor-6')
  const buffer = cloneCard('buffer-3', { hp: 2 })
  const right = cloneCard('defender-6', { hp: 4 })
  addBuff(left, GAME.SUPPORT_BUFF_AMOUNT, 'Buffer support', 'Adjacent Buffer on the right')
  addBuff(left, GAME.SUPPORT_BUFF_ON_SURVIVE, 'Buffer survived', 'Adjacent Buffer survived combat')
  addBuff(right, GAME.SUPPORT_BUFF_AMOUNT, 'Buffer support', 'Adjacent Buffer on the left')
  addBuff(right, GAME.SUPPORT_BUFF_ON_SURVIVE, 'Buffer survived', 'Adjacent Buffer survived combat')
  gameState.playerBoard = [left, buffer, right]
  renderScene()
}

function resolutionOrderScene() {
  resetGameState()
  gameState.enemyBoard = [
    cloneCard('aggressor-4'),
    cloneCard('defender-6'),
    cloneCard('glass-cannon-5'),
  ]
  renderScene({ enemyOrder: true })
}

function buffCapScene() {
  resetGameState()
  const card = cloneCard('aggressor-6')
  addBuff(card, 2, 'Support bonus', 'First nearby source')
  addBuff(card, 2, 'Survival bonus', 'Second nearby source')
  gameState.playerHand = [card]
  renderScene()
}

function singleCardScene(cardId) {
  resetGameState()
  gameState.playerHand = [cloneCard(cardId)]
  renderScene()
}

function roundLoopScene() {
  resetGameState()
  initRun()
  drawCards()
  renderScene()
}

function endConditionScene() {
  resetGameState()
  gameState.round = 4
  gameState.phase = 'placement'
  gameState.playerDeck = [cloneCard('shield-4')]
  gameState.playerHand = [cloneCard('opportunist-3')]
  gameState.enemyDeck = [cloneCard('glass-cannon-5')]
  gameState.enemyBoard = [cloneCard('defender-6'), null, null]
  renderScene()
}

function readyScene() {
  resetGameState()
  readyToLaunch = true
  renderScene()
  const nextBtn = document.getElementById('tutorial-next-btn')
  if (nextBtn) nextBtn.textContent = 'Start Playing ->'
}

const TUTORIAL_STEPS = [
  {
    id: 'welcome',
    chapter: 1,
    tooltip: 'Welcome to the tutorial.\n\nThis is the game board. Your side is at the bottom, and the enemy is at the top. Each round you place cards and resolve combat.',
    highlight: '#board',
    lock: 'all',
    advance: 'click',
    setup: welcomeScene,
  },
  {
    id: 'card-anatomy',
    chapter: 1,
    tooltip: 'This is a card.\n\nName is at the top. The center shows the RPS symbol and value. The bottom shows role and HP. Special effects appear as extra text.',
    highlight: '#cards .card',
    lock: 'all',
    advance: 'click',
    setup: anatomyScene,
  },
  {
    id: 'rps-intro',
    chapter: 1,
    tooltip: 'Rock ✊ beats Scissors ✌️.\nScissors ✌️ beats Paper ✋.\nPaper ✋ beats Rock ✊.\n\nWinning the RPS matchup gives +3 damage. Losing costs -3.',
    highlight: '#enemy-cards .card, #cards .card',
    lock: 'all',
    advance: 'click',
    setup: rpsScene,
  },
  {
    id: 'first-drag',
    chapter: 1,
    tooltip: 'Try it. Drag the card onto the slot to place it.',
    highlight: '#cards .card, #slots .slot',
    lock: ['#enemy-board', '#btn-resolve'],
    advance: 'cardPlaced',
    setup: firstDragScene,
  },
  {
    id: 'phases',
    chapter: 2,
    tooltip: 'Each round has three phases:\n\n1. Draw\n2. Place\n3. Resolve\n\nThen the cycle repeats.',
    highlight: '#hud',
    lock: 'all',
    advance: 'click',
    setup: phasesScene,
  },
  {
    id: 'draw-phase',
    chapter: 2,
    tooltip: 'At the start of each round you draw until your hand has 3 cards. Surviving cards return to your hand and count toward that total.',
    highlight: '#cards',
    lock: 'all',
    advance: 'click',
    setup: drawPhaseScene,
  },
  {
    id: 'placement',
    chapter: 2,
    tooltip: 'Place all three cards on the board. Drag each card to a slot.',
    highlight: '#cards, #slots',
    lock: ['#enemy-board', '#btn-resolve'],
    advance: 'allPlaced',
    setup: placementScene,
  },
  {
    id: 'resolve-btn',
    chapter: 2,
    tooltip: 'All slots are filled. Click Resolve to start combat.',
    highlight: '#btn-resolve',
    lock: 'all',
    advance: 'resolved',
    setup: null,
  },
  {
    id: 'combat-result',
    chapter: 2,
    tooltip: 'Each slot fights its opposite slot simultaneously.\n\nDamage comes from attack value plus modifiers, minus the defender reduction. Cards at 0 HP are destroyed.',
    highlight: '#player-board, #enemy-board',
    lock: 'all',
    advance: 'click',
    setup: combatResultScene,
  },
  {
    id: 'attack-role',
    chapter: 3,
    tooltip: 'Attack role cards deal +2 bonus damage on top of their value.\n\nAggressor shows that role clearly: its attack is stronger before any other modifiers.',
    highlight: '#cards .card[data-id="aggressor-6"]',
    lock: 'all',
    advance: 'click',
    setup: attackRoleScene,
  },
  {
    id: 'defense-role',
    chapter: 3,
    tooltip: 'Defense role cards block half their current HP from incoming damage.\n\nDefender is the baseline example: at 6 HP it blocks 3 damage, but that block shrinks as it gets hurt.',
    highlight: '#enemy-cards .card[data-id="defender-6"]',
    lock: 'all',
    advance: 'click',
    setup: defenseRoleScene,
  },
  {
    id: 'first-card-bonus',
    chapter: 3,
    tooltip: 'The first card you place gets a bonus based on its RPS matchup in that slot.\n\nWin -> +3\nTie -> +1\nLoss -> +0\n\nPlace the rock card against scissors.',
    highlight: '#cards .card, #enemy-cards .card',
    lock: ['#btn-resolve'],
    advance: 'cardPlaced',
    setup: firstCardBonusScene,
  },
  {
    id: 'support-placement',
    chapter: 3,
    tooltip: 'Support cards buff adjacent allies when placed.\n\nBuffer sits between two allies, so both neighbours gain +1.',
    highlight: '#cards .card[data-id="buffer-3"]',
    lock: 'all',
    advance: 'click',
    setup: supportPlacementScene,
  },
  {
    id: 'support-survive',
    chapter: 3,
    tooltip: 'If a support card survives combat, surviving neighbours gain another +1.\n\nThat extra buff carries into the next round.',
    highlight: '#cards .card[data-id="buffer-3"]',
    lock: 'all',
    advance: 'click',
    setup: supportSurviveScene,
  },
  {
    id: 'resolution-order',
    chapter: 3,
    tooltip: 'Combat resolves strongest enemy first.\n\nThe numbers on enemy cards show the order for this board state.',
    highlight: '#enemy-cards',
    lock: 'all',
    advance: 'click',
    setup: resolutionOrderScene,
  },
  {
    id: 'buff-cap',
    chapter: 4,
    tooltip: 'Buffs can stack from multiple sources, but a card can never go above +3 total buffs.',
    highlight: '#cards .card',
    lock: 'all',
    advance: 'click',
    setup: buffCapScene,
  },
  {
    id: 'effect-glass-cannon',
    chapter: 4,
    tooltip: 'Glass Cannon takes +1 extra damage when hit.\n\nIt hits hard for its size, but it is easier to remove.',
    highlight: '#cards .card[data-id="glass-cannon-5"]',
    lock: 'all',
    advance: 'click',
    setup() {
      singleCardScene('glass-cannon-5')
    },
  },
  {
    id: 'effect-opportunist',
    chapter: 4,
    tooltip: 'Opportunist deals +2 bonus damage when it wins the RPS matchup.\n\nIt rewards precise positioning.',
    highlight: '#cards .card[data-id="opportunist-3"]',
    lock: 'all',
    advance: 'click',
    setup() {
      singleCardScene('opportunist-3')
    },
  },
  {
    id: 'effect-shield',
    chapter: 4,
    tooltip: 'Shield blocks +1 extra damage on top of normal defense reduction.\n\nIt is a very reliable front-line card.',
    highlight: '#cards .card[data-id="shield-4"]',
    lock: 'all',
    advance: 'click',
    setup() {
      singleCardScene('shield-4')
    },
  },
  {
    id: 'effect-reactive-guard',
    chapter: 4,
    tooltip: 'Reactive Guard blocks +2 extra damage when it loses the RPS matchup.\n\nA bad matchup makes it tougher, not weaker.',
    highlight: '#cards .card[data-id="reactive-guard-3"]',
    lock: 'all',
    advance: 'click',
    setup() {
      singleCardScene('reactive-guard-3')
    },
  },
  {
    id: 'effect-fragile-buffer',
    chapter: 4,
    tooltip: 'Fragile Buffer gives +2 to adjacent allies instead of the normal +1.\n\nThe buff is larger, but the card itself is easy to kill.',
    highlight: '#cards .card[data-id="fragile-buffer-2"]',
    lock: 'all',
    advance: 'click',
    setup() {
      singleCardScene('fragile-buffer-2')
    },
  },
  {
    id: 'effect-persistent-buffer',
    chapter: 4,
    tooltip: 'Persistent Buffer is the long-game support card.\n\nIts effect is designed to keep value flowing across rounds.',
    highlight: '#cards .card[data-id="persistent-buffer-4"]',
    lock: 'all',
    advance: 'click',
    setup() {
      singleCardScene('persistent-buffer-4')
    },
  },
  {
    id: 'round-loop',
    chapter: 4,
    tooltip: 'After combat, surviving player cards return to your hand, the enemy refills their board, and you draw back up to 3 cards.\n\nThat is the round loop.',
    highlight: '#board',
    lock: 'all',
    advance: 'click',
    setup: roundLoopScene,
  },
  {
    id: 'end-condition',
    chapter: 4,
    tooltip: 'You lose when both your hand and deck are empty.\n\nYou win when the enemy has no board cards and no deck left.\n\nEvery remaining card matters.',
    highlight: '#board',
    lock: 'all',
    advance: 'click',
    setup: endConditionScene,
  },
  {
    id: 'ready',
    chapter: 4,
    tooltip: 'You know the rules.\n\nStart the full game when you are ready.',
    highlight: null,
    lock: null,
    advance: 'click',
    setup: readyScene,
  },
]

if (typeof window !== 'undefined') {
  exposeTestState()
  window.addEventListener('DOMContentLoaded', () => {
    if (!hasTutorialDom()) return
    initTutorial()
  })
}
