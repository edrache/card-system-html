import { GAME } from '../config/game.config.js'
import { createDeck } from './cards-data.js'
import { addBuffSource, clearBuffSourcesByScope, ensureBuffState, syncCardBuffs } from './buffs.js'
import { calcDamage, resolvePair, getAdjacentAllies, getRpsResult } from './combat.js'
import { createEnemyDeck, enemyRefillBoard, shuffleDeck } from './enemy.js'

/**
 * Central game state.
 * Do not mutate directly — use the functions below.
 */
export const gameState = {
  phase: 'draw',            // 'draw' | 'placement' | 'combat' | 'reward' | 'end'
  round: 1,

  playerDeck: [],           // Card[] — cards not yet in hand or on board
  playerHand: [],           // Card[] — cards in hand (available to place)
  playerCemetery: [],       // Card[] — permanently lost player cards
  playerBoard: [],          // (Card|null)[] — length = SLOT_COUNT

  enemyDeck: [],            // Card[] — enemy's remaining draw pile
  enemyCemetery: [],        // Card[] — permanently lost enemy cards
  enemyBoard: [],           // (Card|null)[] — length = SLOT_COUNT

  placementOrder: [],       // Card[] — tracks order cards were placed (for first-card bonus)
  rewardChoices: [],        // Card[] — current post-victory reward draft
}

function isGhostCard(card) {
  return Boolean(card?.ghostBuffer && card?.ghostBufferTurns > 0)
}

function canPersistAsGhost(card) {
  return Boolean(card?.role === 'support' && card?.effect?.persistBuffTurns)
}

function markCardAsGhost(card) {
  card.hp = 0
  card.ghostBuffer = true
  card.ghostBufferTurns = card.effect.persistBuffTurns
  clearBuffSourcesByScope(card, 'temporary')
  syncCardBuffs(card)
  return card
}

function moveCardToPlayerCemetery(card) {
  if (!card) return
  clearBuffSourcesByScope(card, 'temporary')
  syncCardBuffs(card)
  gameState.playerCemetery.push(card)
}

function moveCardToEnemyCemetery(card) {
  if (!card) return
  clearBuffSourcesByScope(card, 'temporary')
  syncCardBuffs(card)
  gameState.enemyCemetery.push(card)
}

function expireExistingGhosts(board, existingGhostIds) {
  for (let slotIndex = 0; slotIndex < board.length; slotIndex += 1) {
    const card = board[slotIndex]
    if (!card || !existingGhostIds.has(card.id)) continue

    card.ghostBufferTurns = Math.max(0, (card.ghostBufferTurns ?? 0) - 1)
    if (card.ghostBufferTurns <= 0) {
      if (board === gameState.playerBoard) {
        card.ghostBuffer = false
        card.ghostBufferTurns = 0
        moveCardToPlayerCemetery(card)
      } else if (board === gameState.enemyBoard) {
        card.ghostBuffer = false
        card.ghostBufferTurns = 0
        moveCardToEnemyCemetery(card)
      }
      board[slotIndex] = null
      continue
    }
    syncCardBuffs(card)
  }
}

function countOpenPlayerSlots() {
  return gameState.playerBoard.filter((card) => card === null).length
}

function getCardStrength(card) {
  if (isGhostCard(card)) return -Infinity
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
    gameState.enemyCemetery,
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
        kind: 'support',
        scope: 'temporary',
      })
    }

    if (rightAlly) {
      addBuffSource(rightAlly, {
        id: `support-placement:${ownerLabel}:${card.id}:${slotIndex}:right`,
        amount,
        label: `${card.name} support`,
        description: `Adjacent ${card.name} on the left`,
        kind: 'support',
        scope: 'temporary',
      })
    }
  })
}

function applySupportPostCombatBuffs(board, ownerLabel) {
  board.forEach((card, slotIndex) => {
    if (!card || isGhostCard(card) || card.role !== 'support' || card.hp <= 0) return

    const [leftAlly, rightAlly] = getAdjacentAllies(board, slotIndex)
    const amount = GAME.SUPPORT_BUFF_ON_SURVIVE

    if (leftAlly && leftAlly.hp > 0) {
      addBuffSource(leftAlly, {
        id: `support-survive:${ownerLabel}:${gameState.round}:${card.id}:${leftAlly.id}:left`,
        amount,
        label: `${card.name} survived`,
        description: `Adjacent ${card.name} survived combat on the right`,
        kind: 'support',
      })
    }

    if (rightAlly && rightAlly.hp > 0) {
      addBuffSource(rightAlly, {
        id: `support-survive:${ownerLabel}:${gameState.round}:${card.id}:${rightAlly.id}:right`,
        amount,
        label: `${card.name} survived`,
        description: `Adjacent ${card.name} survived combat on the left`,
        kind: 'support',
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

function createRewardChoices(count = GAME.SLOT_COUNT) {
  return shuffleDeck(createDeck()).slice(0, count)
}

/**
 * Recalculates derived buffs after the enemy board changes.
 */
function recalculateEnemyBuffs() {
  recalculateBoardBuffs()
}

export function syncDerivedState() {
  recalculateBoardBuffs()
}

// ── Initialisation ────────────────────────────────────────────────────────────

/**
 * Sets up a fresh run from scratch.
 * Call once on game start; call again via resetRun() after a loss.
 */
export function initRun() {
  gameState.playerDeck = shuffleDeck(createDeck())
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

  // Enemy fills board immediately at start
  enemyRefillBoard(gameState.enemyBoard, gameState.enemyDeck)
  recalculateEnemyBuffs()
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
  const drawnCards = []
  const targetHandSize = countOpenPlayerSlots()

  while (
    gameState.playerHand.length < targetHandSize &&
    gameState.playerDeck.length > 0
  ) {
    const drawnCard = gameState.playerDeck.shift()
    gameState.playerHand.push(drawnCard)
    drawnCards.push(drawnCard)
  }
  gameState.phase = 'placement'
  gameState.placementOrder = []
  recalculateBoardBuffs()
  return drawnCards
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
 * Returns true when placement is complete and the player has no more moves.
 * Combat can start either when all slots are filled or when the hand is empty.
 */
export function canResolve() {
  if (gameState.phase !== 'placement') return false

  const allSlotsFilled = gameState.playerBoard.every((slot) => slot !== null)
  const handIsEmpty = gameState.playerHand.length === 0

  return allSlotsFilled || handIsEmpty
}

// ── Combat phase ──────────────────────────────────────────────────────────────

/**
 * Builds a preview for one combat pair without mutating cards.
 */
function buildCombatStep(slotIndex) {
  const player = gameState.playerBoard[slotIndex]
  const enemy = gameState.enemyBoard[slotIndex]

  if (!player || !enemy || isGhostCard(player) || isGhostCard(enemy)) {
    return { slot: slotIndex, skipped: true }
  }

  const playerDealt = calcDamage(player, enemy)
  const enemyDealt = calcDamage(enemy, player)
  const playerHpAfter = Math.max(0, player.hp - enemyDealt)
  const enemyHpAfter = Math.max(0, enemy.hp - playerDealt)

  return {
    slot: slotIndex,
    player: {
      id: player.id,
      name: player.name,
      dealt: playerDealt,
      hpBefore: player.hp,
      hpAfter: playerHpAfter,
      died: playerHpAfter <= 0,
    },
    enemy: {
      id: enemy.id,
      name: enemy.name,
      dealt: enemyDealt,
      hpBefore: enemy.hp,
      hpAfter: enemyHpAfter,
      died: enemyHpAfter <= 0,
    },
  }
}

/**
 * Locks the round into combat mode and returns the fight order with previews.
 */
export function prepareResolveRound() {
  if (!canResolve()) return null

  gameState.phase = 'combat'
  recalculateBoardBuffs()
  const resolutionOrder = getResolutionOrder()

  return {
    resolutionOrder,
    steps: resolutionOrder.map((slotIndex) => buildCombatStep(slotIndex)),
  }
}

/**
 * Resolves exactly one slot pair and mutates the board state in place.
 */
export function resolveCombatStep(slotIndex) {
  const preview = buildCombatStep(slotIndex)
  if (preview.skipped) return preview

  const player = gameState.playerBoard[slotIndex]
  const enemy = gameState.enemyBoard[slotIndex]
  const result = resolvePair(player, enemy)

  return {
    slot: slotIndex,
    player: {
      id: player.id,
      name: player.name,
      dealt: result.aDealt,
      hpBefore: preview.player.hpBefore,
      hp: Math.max(0, player.hp),
      hpAfter: Math.max(0, player.hp),
      died: result.aDied,
    },
    enemy: {
      id: enemy.id,
      name: enemy.name,
      dealt: result.bDealt,
      hpBefore: preview.enemy.hpBefore,
      hp: Math.max(0, enemy.hp),
      hpAfter: Math.max(0, enemy.hp),
      died: result.bDied,
    },
  }
}

/**
 * Applies death cleanup, returns survivors, refills enemy board, and advances the round.
 */
export function finalizeResolveRound(log = []) {
  if (gameState.phase !== 'combat') return null

  const existingPlayerGhostIds = new Set(
    gameState.playerBoard.filter((card) => isGhostCard(card)).map((card) => card.id)
  )
  const existingEnemyGhostIds = new Set(
    gameState.enemyBoard.filter((card) => isGhostCard(card)).map((card) => card.id)
  )

  // Death check — remove dead cards
  for (let i = 0; i < GAME.SLOT_COUNT; i++) {
    const playerCard = gameState.playerBoard[i]
    if (playerCard?.hp <= 0 && !isGhostCard(playerCard)) {
      if (canPersistAsGhost(playerCard)) {
        gameState.playerBoard[i] = markCardAsGhost(playerCard)
      } else {
        moveCardToPlayerCemetery(playerCard)
        gameState.playerBoard[i] = null
      }
    }

    const enemyCard = gameState.enemyBoard[i]
    if (enemyCard?.hp <= 0 && !isGhostCard(enemyCard)) {
      if (canPersistAsGhost(enemyCard)) {
        gameState.enemyBoard[i] = markCardAsGhost(enemyCard)
      } else {
        moveCardToEnemyCemetery(enemyCard)
        gameState.enemyBoard[i] = null
      }
    }
  }

  applySupportPostCombatBuffs(gameState.playerBoard, 'player')
  applySupportPostCombatBuffs(gameState.enemyBoard, 'enemy')
  expireExistingGhosts(gameState.playerBoard, existingPlayerGhostIds)
  expireExistingGhosts(gameState.enemyBoard, existingEnemyGhostIds)

  // Surviving player cards return to hand
  for (let i = 0; i < GAME.SLOT_COUNT; i++) {
    const card = gameState.playerBoard[i]
    if (card && !isGhostCard(card)) {
      gameState.playerHand.push(card)
      gameState.playerBoard[i] = null
    }
  }

  // Enemy refills board
  enemyRefillBoard(gameState.enemyBoard, gameState.enemyDeck)
  recalculateEnemyBuffs()
  recalculateBoardBuffs()

  gameState.round += 1
  gameState.rewardChoices = []

  // Check end condition
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

/**
 * Resolves all slot pairs, applies damage, runs death check, refills boards.
 * Returns a log of what happened for UI display.
 */
export function resolveRound() {
  const prepared = prepareResolveRound()
  if (!prepared) return null

  const log = prepared.steps.map((step) => (
    step.skipped ? step : resolveCombatStep(step.slot)
  ))

  console.log('[Round', gameState.round, 'results]', log)
  return finalizeResolveRound(log)
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
  gameState.placementOrder = []
  gameState.round = 1
  gameState.phase = 'draw'

  enemyRefillBoard(gameState.enemyBoard, gameState.enemyDeck)
  recalculateEnemyBuffs()
  recalculateBoardBuffs()

  return rewardCard
}

export function getGhostPlayerBoardCards() {
  return gameState.playerBoard
    .map((card, slotIndex) => ({ card, slotIndex }))
    .filter(({ card }) => isGhostCard(card))
}
