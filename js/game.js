import { GAME } from '../config/game.config.js'
import { createPlayerDeck } from './cards-data.js'
import { getCombatPreview, resolvePair } from './combat.js'
import { createEnemyDeck, enemyRefillBoard, shuffleDeck } from './enemy.js'

export const gameState = {
  phase: 'draw',
  round: 1,

  playerDeck: [],
  playerHand: [],
  playerCemetery: [],
  playerBoard: [],

  enemyDeck: [],
  enemyCemetery: [],
  enemyBoard: [],

  placementOrder: [],
  rewardChoices: [],
}

function moveCardToPlayerCemetery(card) {
  if (!card) return
  gameState.playerCemetery.push(card)
}

function moveCardToEnemyCemetery(card) {
  if (!card) return
  gameState.enemyCemetery.push(card)
}

function countOpenPlayerSlots() {
  return gameState.playerBoard.filter((card) => card === null).length
}

function createRewardChoices(count = GAME.SLOT_COUNT) {
  return shuffleDeck(createPlayerDeck()).slice(0, count)
}

export function getResolutionOrder() {
  const order = []

  for (const card of gameState.placementOrder) {
    const slotIndex = gameState.playerBoard.findIndex((entry) => entry === card)
    if (slotIndex !== -1 && gameState.enemyBoard[slotIndex] !== null) {
      order.push(slotIndex)
    }
  }

  for (let i = 0; i < GAME.SLOT_COUNT; i += 1) {
    if (!order.includes(i) && gameState.playerBoard[i] && gameState.enemyBoard[i]) {
      order.push(i)
    }
  }

  return order
}

function buildCombatStep(slotIndex) {
  const player = gameState.playerBoard[slotIndex]
  const enemy = gameState.enemyBoard[slotIndex]

  if (!player || !enemy) {
    return { slot: slotIndex, skipped: true }
  }

  const preview = getCombatPreview(
    player,
    enemy,
    gameState.playerBoard,
    gameState.enemyBoard,
    slotIndex,
    slotIndex
  )

  return {
    slot: slotIndex,
    skipped: false,
    rps: preview.rps,
    label: preview.label,
    player: {
      id: player.id,
      name: player.name,
      valueBefore: player.value,
      range: preview.player.range,
      supportBonus: preview.player.supportBonus,
      rollMode: preview.player.rollMode,
      dealtRange: preview.player.damageRange,
    },
    enemy: {
      id: enemy.id,
      name: enemy.name,
      valueBefore: enemy.value,
      range: preview.enemy.range,
      supportBonus: preview.enemy.supportBonus,
      rollMode: preview.enemy.rollMode,
      dealtRange: preview.enemy.damageRange,
    },
  }
}

export function initRun() {
  gameState.playerDeck = shuffleDeck(createPlayerDeck())
  gameState.playerHand = []
  gameState.playerCemetery = []
  gameState.playerBoard = Array(GAME.SLOT_COUNT).fill(null)
  gameState.enemyDeck = createEnemyDeck()
  gameState.enemyCemetery = []
  gameState.enemyBoard = Array(GAME.SLOT_COUNT).fill(null)
  gameState.placementOrder = []
  gameState.rewardChoices = []
  gameState.round = 1
  gameState.phase = 'draw'

  enemyRefillBoard(gameState.enemyBoard, gameState.enemyDeck)
}

export function resetRun() {
  initRun()
}

export function drawCards() {
  const drawnCards = []
  const targetHandSize = countOpenPlayerSlots()

  while (gameState.playerHand.length < targetHandSize && gameState.playerDeck.length > 0) {
    const drawnCard = gameState.playerDeck.shift()
    gameState.playerHand.push(drawnCard)
    drawnCards.push(drawnCard)
  }

  gameState.phase = 'placement'
  gameState.placementOrder = []
  return drawnCards
}

export function placeCard(cardId, slotIndex) {
  if (gameState.phase !== 'placement') return false
  if (gameState.playerBoard[slotIndex] !== null) return false

  const cardIdx = gameState.playerHand.findIndex((card) => card.id === cardId)
  if (cardIdx === -1) return false

  const card = gameState.playerHand.splice(cardIdx, 1)[0]
  gameState.playerBoard[slotIndex] = card
  gameState.placementOrder.push(card)
  return true
}

export function unplaceCard(slotIndex) {
  if (gameState.phase !== 'placement') return false
  const card = gameState.playerBoard[slotIndex]
  if (!card) return false

  gameState.playerBoard[slotIndex] = null
  gameState.playerHand.push(card)
  gameState.placementOrder = gameState.placementOrder.filter((entry) => entry !== card)
  return true
}

export function canResolve() {
  if (gameState.phase !== 'placement') return false

  const allSlotsFilled = gameState.playerBoard.every((slot) => slot !== null)
  const handIsEmpty = gameState.playerHand.length === 0

  return allSlotsFilled || handIsEmpty
}

export function prepareResolveRound() {
  if (!canResolve()) return null

  gameState.phase = 'combat'
  const resolutionOrder = getResolutionOrder()

  return {
    resolutionOrder,
    steps: resolutionOrder.map((slotIndex) => buildCombatStep(slotIndex)),
  }
}

export function resolveCombatStep(slotIndex) {
  const preview = buildCombatStep(slotIndex)
  if (preview.skipped) return preview

  const player = gameState.playerBoard[slotIndex]
  const enemy = gameState.enemyBoard[slotIndex]

  const result = resolvePair(
    player,
    enemy,
    gameState.playerBoard,
    gameState.enemyBoard,
    slotIndex,
    slotIndex
  )

  return {
    slot: slotIndex,
    rps: result.rps,
    label: result.label,
    player: {
      id: player.id,
      name: player.name,
      rolls: result.player.rolls,
      chosenRoll: result.player.chosenRoll,
      chosenRollIndex: result.player.chosenRollIndex,
      range: result.player.range,
      supportBonus: result.player.supportBonus,
      rollMode: result.player.rollMode,
      dealt: result.player.dealt,
      valueBefore: result.player.valueBefore,
      valueAfter: result.player.valueAfter,
      died: result.player.died,
    },
    enemy: {
      id: enemy.id,
      name: enemy.name,
      rolls: result.enemy.rolls,
      chosenRoll: result.enemy.chosenRoll,
      chosenRollIndex: result.enemy.chosenRollIndex,
      range: result.enemy.range,
      supportBonus: result.enemy.supportBonus,
      rollMode: result.enemy.rollMode,
      dealt: result.enemy.dealt,
      valueBefore: result.enemy.valueBefore,
      valueAfter: result.enemy.valueAfter,
      died: result.enemy.died,
    },
  }
}

export function finalizeResolveRound(log = []) {
  if (gameState.phase !== 'combat') return null

  for (let i = 0; i < GAME.SLOT_COUNT; i += 1) {
    const playerCard = gameState.playerBoard[i]
    if (playerCard?.value <= 0) {
      moveCardToPlayerCemetery(playerCard)
      gameState.playerBoard[i] = null
    }

    const enemyCard = gameState.enemyBoard[i]
    if (enemyCard?.value <= 0) {
      moveCardToEnemyCemetery(enemyCard)
      gameState.enemyBoard[i] = null
    }
  }

  for (let i = 0; i < GAME.SLOT_COUNT; i += 1) {
    const card = gameState.playerBoard[i]
    if (card) {
      gameState.playerHand.push(card)
      gameState.playerBoard[i] = null
    }
  }

  enemyRefillBoard(gameState.enemyBoard, gameState.enemyDeck)

  gameState.round += 1
  gameState.rewardChoices = []

  const playerHasCards = gameState.playerHand.length > 0 || gameState.playerDeck.length > 0
  const enemyHasCards = gameState.enemyBoard.some((card) => card !== null) || gameState.enemyDeck.length > 0

  if (!playerHasCards) {
    gameState.phase = 'end'
    return { log, outcome: 'loss' }
  }

  if (!enemyHasCards) {
    gameState.phase = 'reward'
    gameState.rewardChoices = createRewardChoices()
    return { log, outcome: 'win', rewardChoices: [...gameState.rewardChoices] }
  }

  gameState.phase = 'draw'
  return { log, outcome: 'continue' }
}

export function resolveRound() {
  const prepared = prepareResolveRound()
  if (!prepared) return null

  const log = prepared.steps.map((step) => (
    step.skipped ? step : resolveCombatStep(step.slot)
  ))

  console.log('[Round', gameState.round, 'results]', log)
  return finalizeResolveRound(log)
}

export function syncDerivedState() {
  return null
}

export function getGhostPlayerBoardCards() {
  return []
}

export function claimReward(cardId) {
  if (gameState.phase !== 'reward') return null

  const rewardIndex = gameState.rewardChoices.findIndex((card) => card.id === cardId)
  if (rewardIndex === -1) return null

  const [rewardCard] = gameState.rewardChoices.splice(rewardIndex, 1)
  gameState.playerDeck.push(rewardCard)
  gameState.rewardChoices = []
  gameState.playerBoard = Array(GAME.SLOT_COUNT).fill(null)
  gameState.enemyDeck = createEnemyDeck()
  gameState.enemyBoard = Array(GAME.SLOT_COUNT).fill(null)
  gameState.enemyCemetery = []
  gameState.placementOrder = []
  gameState.round = 1
  gameState.phase = 'draw'

  enemyRefillBoard(gameState.enemyBoard, gameState.enemyDeck)
  return rewardCard
}
