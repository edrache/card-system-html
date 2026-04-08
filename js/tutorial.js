import { CARD } from '../config/card.config.js'
import { GAME } from '../config/game.config.js'
import { LAYOUT } from '../config/layout.config.js'
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
import { initDrag } from './interactions.js'

const TOTAL_STEPS = 25

const CHAPTER_TITLES = {
  1: 'Chapter 1\nRead the Table',
  2: 'Chapter 2\nRound Flow',
  3: 'Chapter 3\nCombat Math',
  4: 'Chapter 4\nFinish the Run',
}

const CARD_LIBRARY = new Map([
  ['brawler',   { id: 'brawler',   name: 'Break Will',      rps: 'pressure',    value: 5, role: 'attack',  flavor: 'Relentless force leaves no room for hesitation.' }],
  ['slasher',   { id: 'slasher',   name: 'Cut an Opening',  rps: 'positioning', value: 7, role: 'attack',  flavor: 'The right angle makes its own advantage.' }],
  ['crusher',   { id: 'crusher',   name: 'Crush Doubt',     rps: 'appeal',      value: 9, role: 'attack',  flavor: 'Certainty spreads faster than fear.' }],
  ['lunger',    { id: 'lunger',    name: 'All-In Strike',   rps: 'pressure',    value: 3, role: 'attack',  flavor: 'Commit hard enough and the outcome has to move.' }],
  ['bulwark',   { id: 'bulwark',   name: 'Hold Composure',  rps: 'appeal',      value: 6, role: 'defense', flavor: 'Calm reshapes the choices around you.' }],
  ['ironclad',  { id: 'ironclad',  name: 'Stand Unbroken',  rps: 'pressure',    value: 8, role: 'defense', flavor: 'Raw resolve turns resistance into a dead end.' }],
  ['buckler',   { id: 'buckler',   name: 'Slip the Blow',   rps: 'positioning', value: 4, role: 'defense', flavor: 'A precise step changes danger into distance.' }],
  ['mentor',    { id: 'mentor',    name: 'Guide the Move',  rps: 'positioning', value: 3, role: 'support', flavor: 'Preparation makes the next decision obvious.' }],
  ['tactician', { id: 'tactician', name: 'Shape Intent',    rps: 'appeal',      value: 5, role: 'support', flavor: 'A well-placed signal bends the room your way.' }],
  ['vanguard',  { id: 'vanguard',  name: 'Lead the Charge', rps: 'pressure',    value: 7, role: 'support', flavor: 'Momentum favors the side that acts first and hardest.' }],
  ['scout',     { id: 'scout',     name: 'Mark the Path',   rps: 'positioning', value: 4, role: 'support', flavor: 'Control the route and you control the fight.' }],
  ['warden',    { id: 'warden',    name: 'Steady Hearts',   rps: 'appeal',      value: 6, role: 'support', flavor: 'Shared resolve keeps the line from breaking.' }],
])

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
    tutorialBuffSources: [],
    ...overrides,
  }
}

function addBuff(card, amount, label, description, scope = 'persistent') {
  if (!card.tutorialBuffSources) card.tutorialBuffSources = []
  const source = {
    id: `${label.toLowerCase().replace(/\s+/g, '-')}:${card.id}:${card.tutorialBuffSources.length}`,
    amount,
    label,
    description,
    scope,
  }
  const existingIndex = card.tutorialBuffSources.findIndex((entry) => entry.id === source.id)
  if (existingIndex === -1) {
    card.tutorialBuffSources.push(source)
  } else {
    card.tutorialBuffSources[existingIndex] = source
  }
  return source
}

function getBuffSummary(card) {
  const sources = card.tutorialBuffSources ?? []
  const total = sources.reduce((sum, source) => sum + source.amount, 0)
  return { total, sources }
}

function resetGameState() {
  gameState.phase = 'draw'
  gameState.round = 1
  gameState.playerDeck = []
  gameState.playerHand = []
  gameState.playerCemetery = []
  gameState.playerBoard = Array(GAME.SLOT_COUNT).fill(null)
  gameState.enemyDeck = []
  gameState.enemyCemetery = []
  gameState.enemyBoard = Array(GAME.SLOT_COUNT).fill(null)
  gameState.placementOrder = []
  gameState.rewardChoices = []
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
  const summary = getBuffSummary(card)

  const el = createSharedCardEl(card, options.enemy)
  el.classList.toggle('card--tutorial-dead', card.value <= 0)
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
    note.className = `card__note${card.value <= 0 ? ' card__note--dead' : ''}`
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
    getResolutionOrder().forEach((slotIndex, orderIndex) => {
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
  syncCollectionCounts()
}

function syncResolveButton() {
  const btn = document.getElementById('btn-resolve')
  if (!btn) return
  btn.disabled = !canResolve()
  btn.textContent = 'Resolve'
}

function formatCardCount(count) {
  return `${count} ${count === 1 ? 'card' : 'cards'}`
}

function syncCollectionCount(id, count) {
  const label = document.getElementById(id)
  if (!label) return
  label.textContent = formatCardCount(count)
  label.closest('.deck-button')?.classList.toggle('deck-button--empty', count === 0)
}

function syncCollectionCounts() {
  syncCollectionCount('player-deck-count', gameState.playerDeck.length)
  syncCollectionCount('player-cemetery-count', gameState.playerCemetery.length)
  syncCollectionCount('enemy-deck-count', gameState.enemyDeck.length)
  syncCollectionCount('enemy-cemetery-count', gameState.enemyCemetery.length)
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
    playerNotes[index] = card.value <= 0 ? 'Destroyed -> Cemetery' : `Value ${card.value} remains`
  })
  gameState.enemyBoard.forEach((card, index) => {
    if (!card) return
    enemyNotes[index] = card.value <= 0 ? 'Destroyed -> Cemetery' : `Value ${card.value} remains`
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
    playerDeckCount: gameState.playerDeck.length,
    playerCemeteryCount: gameState.playerCemetery.length,
    enemyDeckCount: gameState.enemyDeck.length,
    enemyCemeteryCount: gameState.enemyCemetery.length,
    playerHand: gameState.playerHand.map((card) => ({
      id: card.id,
      value: card.value,
      buffs: getBuffSummary(card).total,
    })),
    playerBoard: gameState.playerBoard.map((card) => (
      card ? { id: card.id, value: card.value, buffs: getBuffSummary(card).total } : null
    )),
    enemyBoard: gameState.enemyBoard.map((card) => (
      card ? { id: card.id, value: card.value, buffs: getBuffSummary(card).total } : null
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

function valueRangeScene() {
  resetGameState()
  gameState.playerHand = [cloneCard('crusher'), cloneCard('lunger')]
  gameState.enemyBoard = [cloneCard('buckler'), null, null]
  renderScene()
}

function rpsScene() {
  resetGameState()
  gameState.playerHand = [cloneCard('brawler')]
  gameState.enemyBoard = [cloneCard('slasher'), cloneCard('warden'), null]
  renderScene()
}

function firstDragScene() {
  resetGameState()
  gameState.phase = 'placement'
  gameState.playerHand = [cloneCard('brawler')]
  gameState.enemyBoard = [cloneCard('slasher'), null, null]
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
  resetGameState()
  gameState.playerBoard = [
    cloneCard('brawler', { value: 2 }),
    cloneCard('buckler', { value: 0 }),
    null,
  ]
  gameState.enemyBoard = [
    cloneCard('slasher', { value: 0 }),
    cloneCard('ironclad', { value: 5 }),
    null,
  ]
  renderResolvedCombatScene()
}

function combatOrderScene() {
  resetGameState()
  const first = cloneCard('crusher')
  const second = cloneCard('bulwark')
  const third = cloneCard('scout')
  gameState.playerBoard = [third, first, second]
  gameState.enemyBoard = [
    cloneCard('ironclad'),
    cloneCard('buckler'),
    cloneCard('warden'),
  ]
  gameState.placementOrder = [first, second, third]
  renderScene({ enemyOrder: true })
}

function attackRoleScene() {
  resetGameState()
  gameState.playerBoard = [cloneCard('brawler'), null, null]
  gameState.enemyBoard = [cloneCard('buckler'), null, null]
  renderScene({
    playerNotes: {
      0: 'Attack role adds +1 after rolling',
    },
  })
}

function defenseRoleScene() {
  resetGameState()
  gameState.playerBoard = [cloneCard('slasher'), null, null]
  gameState.enemyBoard = [cloneCard('bulwark'), null, null]
  renderScene({
    enemyNotes: {
      0: 'Defense role reduces damage by 1',
    },
  })
}

function supportRoleScene() {
  resetGameState()
  const left = cloneCard('brawler')
  const center = cloneCard('mentor')
  const right = cloneCard('buckler')
  addBuff(left, 1, 'Support range', 'Mentor buffs the ally on the left')
  addBuff(right, 1, 'Support range', 'Mentor buffs the ally on the right')
  gameState.playerBoard = [left, center, right]
  renderScene()
}

function rpsAdvantageScene() {
  resetGameState()
  gameState.playerBoard = [cloneCard('brawler'), null, null]
  gameState.enemyBoard = [cloneCard('slasher'), null, null]
  renderScene({
    playerNotes: {
      0: 'Advantage: roll 2x and keep the higher result',
    },
  })
}

function rpsDisadvantageScene() {
  resetGameState()
  gameState.playerBoard = [cloneCard('brawler'), null, null]
  gameState.enemyBoard = [cloneCard('warden'), null, null]
  renderScene({
    playerNotes: {
      0: 'Disadvantage: this side rolls once',
    },
  })
}

function rpsNeutralScene() {
  resetGameState()
  gameState.playerBoard = [cloneCard('scout'), null, null]
  gameState.enemyBoard = [cloneCard('buckler'), null, null]
  renderScene({
    playerNotes: {
      0: 'Tie: the lower roll damages both cards',
    },
    enemyNotes: {
      0: 'Tie: shared damage hits both sides',
    },
  })
}

function cemeteryScene() {
  resetGameState()
  gameState.round = 2
  gameState.phase = 'placement'
  gameState.playerDeck = [cloneCard('vanguard'), cloneCard('warden')]
  gameState.playerHand = [cloneCard('slasher')]
  gameState.playerCemetery = [cloneCard('lunger')]
  gameState.enemyDeck = [cloneCard('crusher')]
  gameState.enemyCemetery = [cloneCard('buckler'), cloneCard('mentor')]
  gameState.enemyBoard = [cloneCard('ironclad'), null, null]
  renderScene()
}

function biggerValuesScene() {
  resetGameState()
  gameState.playerHand = [cloneCard('crusher'), cloneCard('lunger')]
  renderScene()
}

function supportNeighborsScene() {
  resetGameState()
  const left = cloneCard('brawler')
  const center = cloneCard('mentor')
  const right = cloneCard('buckler')
  addBuff(left, 1, 'Adjacent support', 'Mentor increases the left ally range')
  addBuff(right, 1, 'Adjacent support', 'Mentor increases the right ally range')
  gameState.playerBoard = [left, center, right]
  renderScene()
}

function tooltipScene() {
  combatOrderScene()
}

function summaryScene() {
  welcomeScene()
}

function roundLoopScene() {
  resetGameState()
  gameState.round = 3
  gameState.phase = 'placement'
  gameState.playerDeck = [cloneCard('warden'), cloneCard('vanguard'), cloneCard('bulwark')]
  gameState.playerHand = [cloneCard('brawler'), cloneCard('scout')]
  gameState.playerCemetery = [cloneCard('lunger')]
  gameState.enemyDeck = [cloneCard('crusher'), cloneCard('mentor')]
  gameState.enemyCemetery = [cloneCard('slasher')]
  gameState.enemyBoard = [cloneCard('ironclad'), cloneCard('buckler'), null]
  renderScene()
}

function endConditionScene() {
  resetGameState()
  gameState.round = 4
  gameState.phase = 'placement'
  gameState.playerDeck = []
  gameState.playerHand = [cloneCard('scout')]
  gameState.playerCemetery = [cloneCard('lunger'), cloneCard('mentor')]
  gameState.enemyDeck = [cloneCard('warden')]
  gameState.enemyCemetery = [cloneCard('buckler'), cloneCard('slasher')]
  gameState.enemyBoard = [cloneCard('ironclad'), null, null]
  renderScene()
}

function readyScene() {
  resetGameState()
  readyToLaunch = true
  initRun()
  drawCards()
  renderScene()
  const nextBtn = document.getElementById('tutorial-next-btn')
  if (nextBtn) nextBtn.textContent = 'Start Playing ->'
}

const TUTORIAL_STEPS = [
  {
    id: 'welcome',
    chapter: 1,
    tooltip: 'Welcome to the field manual.\n\nYour row is at the bottom. The enemy row is at the top. The right panel tracks each deck and Cemetery.',
    highlight: '#board',
    lock: 'all',
    advance: 'click',
    setup: welcomeScene,
  },
  {
    id: 'card-anatomy',
    chapter: 1,
    tooltip: 'This is a card.\n\nTop: name and role.\nCenter: Approach symbol.\nBadge: current value.\nBottom: role reminder text.',
    highlight: '#cards .card',
    lock: 'all',
    advance: 'click',
    setup: anatomyScene,
  },
  {
    id: 'value-range',
    chapter: 1,
    tooltip: 'Value does two jobs at once.\n\nIt is the card HP, and it is the roll ceiling.\nA value 9 card rolls from 1 to 9. A value 3 card rolls from 1 to 3.',
    highlight: '#cards .card',
    lock: 'all',
    advance: 'click',
    setup: valueRangeScene,
  },
  {
    id: 'rps-intro',
    chapter: 1,
    tooltip: 'Pressure 🔥 beats Positioning 🧭.\nPositioning 🧭 beats Appeal 🎭.\nAppeal 🎭 beats Pressure 🔥.\n\nThe approach does not add flat damage. It changes how you roll.',
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
    tooltip: 'Each round follows the same loop:\n\n1. Draw\n2. Place\n3. Resolve\n\nThen the next round begins.',
    highlight: '#hud, #rules-panel',
    lock: 'all',
    advance: 'click',
    setup: phasesScene,
  },
  {
    id: 'draw-phase',
    chapter: 2,
    tooltip: 'You draw until the open slots in your row can be filled.\n\nSurviving cards come back to your hand before the next draw, so they reduce how many fresh cards you need.',
    highlight: '#deck-panel, #cards',
    lock: 'all',
    advance: 'click',
    setup: drawPhaseScene,
  },
  {
    id: 'placement',
    chapter: 2,
    tooltip: 'Place all three cards on the board.\n\nThe order you place them matters, so do not think only in columns.',
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
    id: 'combat-order',
    chapter: 2,
    tooltip: 'Combat resolves in your placement order.\n\nThe 1st, 2nd, and 3rd markers show which enemy columns fight first, second, and third.',
    highlight: '#enemy-cards',
    lock: 'all',
    advance: 'click',
    setup: combatOrderScene,
  },
  {
    id: 'attack-role',
    chapter: 3,
    tooltip: 'Attack cards add +1 to the rolled value.\n\nThey do not get free HP. They only push their damage slightly higher.',
    highlight: '#cards .card[data-id="brawler"]',
    lock: 'all',
    advance: 'click',
    setup: attackRoleScene,
  },
  {
    id: 'defense-role',
    chapter: 3,
    tooltip: 'Defense cards reduce incoming damage by 1.\n\nThat happens after the opposing roll is set, so it trims the final hit.',
    highlight: '#enemy-cards .card[data-id="bulwark"]',
    lock: 'all',
    advance: 'click',
    setup: defenseRoleScene,
  },
  {
    id: 'support-role',
    chapter: 3,
    tooltip: 'Support cards add +1 range to adjacent allies.\n\nThey do not hit harder themselves. They widen the rolls of neighbors on both sides.',
    highlight: '#cards .card[data-id="mentor"], #cards .card[data-id="brawler"], #cards .card[data-id="buckler"]',
    lock: 'all',
    advance: 'click',
    setup: supportRoleScene,
  },
  {
    id: 'rps-advantage',
    chapter: 3,
    tooltip: 'If your card wins the approach matchup, it rolls twice and keeps the higher result.\n\nThat is the advantage rule.',
    highlight: '#cards .card[data-id="brawler"], #enemy-cards .card[data-id="slasher"]',
    lock: 'all',
    advance: 'click',
    setup: rpsAdvantageScene,
  },
  {
    id: 'rps-disadvantage',
    chapter: 3,
    tooltip: 'If your card loses the approach matchup, it rolls once while the winner gets the stronger roll mode.\n\nBad matchups still matter even on high-value cards.',
    highlight: '#cards .card[data-id="brawler"], #enemy-cards .card[data-id="warden"]',
    lock: 'all',
    advance: 'click',
    setup: rpsDisadvantageScene,
  },
  {
    id: 'rps-neutral',
    chapter: 3,
    tooltip: 'On an approach tie, both sides roll once.\n\nThe lower of those two rolls becomes shared damage dealt to both cards.',
    highlight: '#cards .card[data-id="scout"], #enemy-cards .card[data-id="buckler"]',
    lock: 'all',
    advance: 'click',
    setup: rpsNeutralScene,
  },
  {
    id: 'combat-result',
    chapter: 4,
    tooltip: 'After both attacks land, each card loses value.\n\nCards at 0 are destroyed. Cards above 0 stay in the run with their remaining value.',
    highlight: '#player-board, #enemy-board',
    lock: 'all',
    advance: 'click',
    setup: combatResultScene,
  },
  {
    id: 'cemetery',
    chapter: 4,
    tooltip: 'Destroyed cards leave the board and move to the Cemetery.\n\nCards in the Cemetery are gone for the rest of the run.',
    highlight: '#player-cemetery-button, #enemy-cemetery-button',
    lock: 'all',
    advance: 'click',
    setup: cemeteryScene,
  },
  {
    id: 'bigger-values',
    chapter: 4,
    tooltip: 'Higher value means a wider roll range and more life.\n\nIt does not remove randomness. A small card can still spike high.',
    highlight: '#cards .card',
    lock: 'all',
    advance: 'click',
    setup: biggerValuesScene,
  },
  {
    id: 'support-neighbors',
    chapter: 4,
    tooltip: 'Support only affects immediate neighbors.\n\nIf there is a gap, the effect does not jump across the empty slot.',
    highlight: '#cards .card[data-id="mentor"], #cards .card[data-id="brawler"], #cards .card[data-id="buckler"]',
    lock: 'all',
    advance: 'click',
    setup: supportNeighborsScene,
  },
  {
    id: 'round-loop',
    chapter: 4,
    tooltip: 'After combat, surviving player cards return to your hand.\n\nThe enemy refills open board slots, then the next draw starts the next round.',
    highlight: '#board',
    lock: 'all',
    advance: 'click',
    setup: roundLoopScene,
  },
  {
    id: 'end-condition',
    chapter: 4,
    tooltip: 'You lose when your hand and deck are both empty.\n\nYou win when the enemy has no deck left and no cards left on the board.',
    highlight: '#deck-panel',
    lock: 'all',
    advance: 'click',
    setup: endConditionScene,
  },
  {
    id: 'tooltip-read',
    chapter: 4,
    tooltip: 'Hover cards to inspect roll ranges and matchup hints.\n\nThat read is how you decide whether a risky placement is worth it.',
    highlight: '#cards .card',
    lock: 'all',
    advance: 'click',
    setup: tooltipScene,
  },
  {
    id: 'summary',
    chapter: 4,
    tooltip: 'Remember the whole system:\n\nValue = HP and roll ceiling.\nApproach changes roll mode.\nRoles bend the math.\nPlacement order decides fight order.',
    highlight: '#rules-panel',
    lock: 'all',
    advance: 'click',
    setup: summaryScene,
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
