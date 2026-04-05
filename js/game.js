import { GAME } from '../config/game.config.js'
import { createDeck } from './cards-data.js'
import { addBuffSource, clearBuffSourcesByScope, ensureBuffState, syncCardBuffs } from './buffs.js'
import { resolvePair, getAdjacentAllies, getRpsResult } from './combat.js'
import { createEnemyDeck, enemyRefillBoard } from './enemy.js'

/**
 * Central game state.
 * Do not mutate directly — use the functions below.
 */
export const gameState = {
  phase: 'draw',            // 'draw' | 'placement' | 'combat' | 'end'
  round: 1,

  playerDeck: [],           // Card[] — cards not yet in hand or on board
  playerHand: [],           // Card[] — cards in hand (available to place)
  playerBoard: [],          // (Card|null)[] — length = SLOT_COUNT

  enemyDeck: [],            // Card[] — enemy's remaining draw pile
  enemyBoard: [],           // (Card|null)[] — length = SLOT_COUNT

  placementOrder: [],       // Card[] — tracks order cards were placed (for first-card bonus)
}

function getCardStrength(card) {
  return card ? card.value + card.buffs : -Infinity
}

export function getResolutionOrder(board = gameState.enemyBoard) {
  return board
    .map((card, slotIndex) => ({
      slotIndex,
      strength: getCardStrength(card),
    }))
    .sort((a, b) => {
      if (b.strength !== a.strength) return b.strength - a.strength
      return a.slotIndex - b.slotIndex
    })
    .map((entry) => entry.slotIndex)
}

function getAllCardsInState() {
  const uniqueCards = new Set()
  const cards = []
  const collections = [
    gameState.playerDeck,
    gameState.playerHand,
    gameState.playerBoard,
    gameState.enemyDeck,
    gameState.enemyBoard,
  ]

  collections.forEach((group) => {
    group.forEach((card) => {
      if (!card || uniqueCards.has(card)) return
      ensureBuffState(card)
      uniqueCards.add(card)
      cards.push(card)
    })
  })

  return cards
}

function clearTemporaryBuffs() {
  getAllCardsInState().forEach((card) => clearBuffSourcesByScope(card, 'temporary'))
}

function getSupportPlacementAmount(card) {
  return card.effect?.buffAmount ?? GAME.SUPPORT_BUFF_AMOUNT
}

function applyFirstCardBonus() {
  const firstPlacedCard = gameState.placementOrder.find((card) => gameState.playerBoard.includes(card))
  if (!firstPlacedCard) return

  const slotIndex = gameState.playerBoard.findIndex((card) => card === firstPlacedCard)
  const enemyInSlot = gameState.enemyBoard[slotIndex]
  if (!enemyInSlot) return

  const result = getRpsResult(firstPlacedCard, enemyInSlot)
  const bonusKey = `FIRST_CARD_BONUS_${result.toUpperCase()}`
  const amount = GAME[bonusKey]
  if (amount <= 0) return

  addBuffSource(firstPlacedCard, {
    id: `first-card:${gameState.round}:${firstPlacedCard.id}`,
    amount,
    label: 'First card bonus',
    description: `RPS ${result} vs ${enemyInSlot.name} in this slot`,
    scope: 'temporary',
  })
}

function applySupportPlacementBuffs(board, ownerLabel) {
  board.forEach((card, slotIndex) => {
    if (!card || card.role !== 'support') return

    const amount = getSupportPlacementAmount(card)
    if (amount <= 0) return

    const [leftAlly, rightAlly] = getAdjacentAllies(board, slotIndex)

    if (leftAlly) {
      addBuffSource(leftAlly, {
        id: `support-placement:${ownerLabel}:${card.id}:${slotIndex}:left`,
        amount,
        label: `${card.name} support`,
        description: `Adjacent ${card.name} on the right`,
        scope: 'temporary',
      })
    }

    if (rightAlly) {
      addBuffSource(rightAlly, {
        id: `support-placement:${ownerLabel}:${card.id}:${slotIndex}:right`,
        amount,
        label: `${card.name} support`,
        description: `Adjacent ${card.name} on the left`,
        scope: 'temporary',
      })
    }
  })
}

function applySupportPostCombatBuffs(board, ownerLabel) {
  board.forEach((card, slotIndex) => {
    if (!card || card.role !== 'support' || card.hp <= 0) return

    const [leftAlly, rightAlly] = getAdjacentAllies(board, slotIndex)
    const amount = GAME.SUPPORT_BUFF_ON_SURVIVE

    if (leftAlly && leftAlly.hp > 0) {
      addBuffSource(leftAlly, {
        id: `support-survive:${ownerLabel}:${gameState.round}:${card.id}:${leftAlly.id}:left`,
        amount,
        label: `${card.name} survived`,
        description: `Adjacent ${card.name} survived combat on the right`,
      })
    }

    if (rightAlly && rightAlly.hp > 0) {
      addBuffSource(rightAlly, {
        id: `support-survive:${ownerLabel}:${gameState.round}:${card.id}:${rightAlly.id}:right`,
        amount,
        label: `${card.name} survived`,
        description: `Adjacent ${card.name} survived combat on the left`,
      })
    }
  })
}

function recalculateBoardBuffs() {
  clearTemporaryBuffs()
  applyFirstCardBonus()
  applySupportPlacementBuffs(gameState.playerBoard, 'player')
  applySupportPlacementBuffs(gameState.enemyBoard, 'enemy')
  getAllCardsInState().forEach((card) => syncCardBuffs(card))
}

// ── Initialisation ────────────────────────────────────────────────────────────

/**
 * Sets up a fresh run from scratch.
 * Call once on game start; call again via resetRun() after a loss.
 */
export function initRun() {
  gameState.playerDeck = createDeck()
  gameState.playerHand = []
  gameState.playerBoard = Array(GAME.SLOT_COUNT).fill(null)
  gameState.enemyDeck = createEnemyDeck()
  gameState.enemyBoard = Array(GAME.SLOT_COUNT).fill(null)
  gameState.placementOrder = []
  gameState.round = 1
  gameState.phase = 'draw'

  // Enemy fills board immediately at start
  enemyRefillBoard(gameState.enemyBoard, gameState.enemyDeck)
  recalculateBoardBuffs()
}

export function resetRun() {
  initRun()
}

// ── Draw phase ────────────────────────────────────────────────────────────────

/**
 * Fills playerHand up to SLOT_COUNT cards from playerDeck.
 * Surviving cards from previous round should already be in playerHand before calling.
 */
export function drawCards() {
  while (
    gameState.playerHand.length < GAME.SLOT_COUNT &&
    gameState.playerDeck.length > 0
  ) {
    gameState.playerHand.push(gameState.playerDeck.shift())
  }
  gameState.phase = 'placement'
  gameState.placementOrder = []
  recalculateBoardBuffs()
}

// ── Placement phase ───────────────────────────────────────────────────────────

/**
 * Places a card from hand into a board slot.
 * Tracks placement order and applies first-card bonus.
 *
 * @param {string} cardId     — id of the card being placed
 * @param {number} slotIndex  — 0-based slot index
 * @returns {boolean} false if placement was invalid
 */
export function placeCard(cardId, slotIndex) {
  if (gameState.phase !== 'placement') return false
  if (gameState.playerBoard[slotIndex] !== null) return false

  const cardIdx = gameState.playerHand.findIndex(c => c.id === cardId)
  if (cardIdx === -1) return false

  const card = gameState.playerHand.splice(cardIdx, 1)[0]
  ensureBuffState(card)
  gameState.playerBoard[slotIndex] = card

  gameState.placementOrder.push(card)
  recalculateBoardBuffs()
  return true
}

/**
 * Removes a card from the board and returns it to hand.
 */
export function unplaceCard(slotIndex) {
  if (gameState.phase !== 'placement') return false
  const card = gameState.playerBoard[slotIndex]
  if (!card) return false

  gameState.playerBoard[slotIndex] = null
  gameState.playerHand.push(card)
  gameState.placementOrder = gameState.placementOrder.filter(c => c.id !== card.id)
  recalculateBoardBuffs()

  return true
}

/**
 * Returns true when all player slots are filled and combat can be triggered.
 */
export function canResolve() {
  return (
    gameState.phase === 'placement' &&
    gameState.playerBoard.every(slot => slot !== null)
  )
}

// ── Combat phase ──────────────────────────────────────────────────────────────

/**
 * Resolves all slot pairs, applies damage, runs death check, refills boards.
 * Returns a log of what happened for UI display.
 */
export function resolveRound() {
  if (!canResolve()) return null

  gameState.phase = 'combat'
  recalculateBoardBuffs()
  const log = []
  const resolutionOrder = getResolutionOrder()

  // Resolve each slot pair
  for (const i of resolutionOrder) {
    const player = gameState.playerBoard[i]
    const enemy = gameState.enemyBoard[i]

    if (!player || !enemy) {
      log.push({ slot: i, skipped: true })
      continue
    }

    const result = resolvePair(player, enemy)
    log.push({
      slot: i,
      player: { id: player.id, name: player.name, dealt: result.aDealt, died: result.aDied, hp: player.hp },
      enemy: { id: enemy.id, name: enemy.name, dealt: result.bDealt, died: result.bDied, hp: enemy.hp },
    })
  }

  console.log('[Round', gameState.round, 'results]', log)

  // Death check — remove dead cards
  for (let i = 0; i < GAME.SLOT_COUNT; i++) {
    if (gameState.playerBoard[i]?.hp <= 0) gameState.playerBoard[i] = null
    if (gameState.enemyBoard[i]?.hp <= 0) gameState.enemyBoard[i] = null
  }

  applySupportPostCombatBuffs(gameState.playerBoard, 'player')
  applySupportPostCombatBuffs(gameState.enemyBoard, 'enemy')

  // Surviving player cards return to hand
  for (let i = 0; i < GAME.SLOT_COUNT; i++) {
    const card = gameState.playerBoard[i]
    if (card) {
      gameState.playerHand.push(card)
      gameState.playerBoard[i] = null
    }
  }

  // Enemy refills board
  enemyRefillBoard(gameState.enemyBoard, gameState.enemyDeck)
  recalculateBoardBuffs()

  gameState.round += 1

  // Check end condition
  const playerHasCards = gameState.playerHand.length > 0 || gameState.playerDeck.length > 0
  const enemyHasCards = gameState.enemyBoard.some(c => c !== null) || gameState.enemyDeck.length > 0

  if (!playerHasCards) {
    gameState.phase = 'end'
    return { log, outcome: 'loss' }
  }
  if (!enemyHasCards) {
    gameState.phase = 'end'
    return { log, outcome: 'win' }
  }

  gameState.phase = 'draw'
  return { log, outcome: 'continue' }
}
