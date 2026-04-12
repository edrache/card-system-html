import assert from 'node:assert/strict'

import { GAME } from '../config/game.config.js'
import { getSupportBonus } from '../js/buffs.js'
import { createPlayerDeck } from '../js/cards-data.js'
import { getCombatPreview, getRpsResult, resolvePair } from '../js/combat.js'
import { shuffleDeck } from '../js/enemy.js'
import {
  canResolve,
  claimReward,
  drawCards,
  gameState,
  getResolutionOrder,
  initRun,
  placeCard,
  prepareResolveRound,
  resolveRound,
  unplaceCard,
} from '../js/game.js'

let cardCounter = 0

function makeCard(overrides = {}) {
  cardCounter += 1
  return {
    id: `test-card-${cardCounter}`,
    name: 'Test Card',
    rps: 'pressure',
    value: 5,
    role: 'support',
    ...overrides,
  }
}

function withRandomSequence(sequence, fn) {
  const originalMathRandom = Math.random
  let index = 0
  Math.random = () => {
    const value = sequence[index] ?? sequence[sequence.length - 1] ?? 0
    index += 1
    return value
  }

  try {
    return fn()
  } finally {
    Math.random = originalMathRandom
  }
}

assert.equal(createPlayerDeck().length, 12)
assert.equal(getRpsResult({ rps: 'pressure' }, { rps: 'positioning' }), 'advantage')
assert.equal(getRpsResult({ rps: 'pressure' }, { rps: 'appeal' }), 'disadvantage')
assert.equal(getRpsResult({ rps: 'appeal' }, { rps: 'appeal' }), 'neutral')

const previewBoard = [
  makeCard({ id: 'support-left', role: 'support', value: 3 }),
  makeCard({ id: 'frontliner', role: 'attack', rps: 'pressure', value: 5 }),
  null,
]
assert.equal(getSupportBonus(previewBoard, 1), 1)
assert.equal(getSupportBonus(previewBoard, 0), 0)

const combatPreview = getCombatPreview(
  previewBoard[1],
  makeCard({ id: 'enemy', role: 'defense', rps: 'positioning', value: 3 }),
  previewBoard,
  [null, makeCard({ id: 'enemy-board', role: 'defense', rps: 'positioning', value: 3 }), null],
  1,
  1
)
assert.equal(combatPreview.label, 'ADV')
assert.equal(combatPreview.player.range, 6)
assert.deepEqual(combatPreview.player.damageRange, { min: 1, max: 6 })
assert.deepEqual(combatPreview.enemy.damageRange, { min: 1, max: 3 })

withRandomSequence([0.7, 0.1, 0.3], () => {
  const player = makeCard({ id: 'player', role: 'attack', rps: 'pressure', value: 5 })
  const enemy = makeCard({ id: 'enemy', role: 'defense', rps: 'positioning', value: 3 })
  const result = resolvePair(player, enemy, [null, player, null], [null, enemy, null], 1, 1)

  assert.equal(result.rps, 'advantage')
  assert.deepEqual(result.player.rolls, [4, 1])
  assert.equal(result.player.chosenRoll, 4)
  assert.equal(result.player.chosenRollIndex, 0)
  assert.deepEqual(result.enemy.rolls, [1])
  assert.equal(result.enemy.chosenRoll, 1)
  assert.equal(result.enemy.chosenRollIndex, 0)
  assert.equal(result.player.dealt, 4)
  assert.equal(result.enemy.dealt, 1)
  assert.equal(player.value, 4)
  assert.equal(enemy.value, 0)
})

withRandomSequence([0.8, 0.3], () => {
  const player = makeCard({ id: 'player-neutral', role: 'defense', rps: 'pressure', value: 5 })
  const enemy = makeCard({ id: 'enemy-neutral', role: 'support', rps: 'pressure', value: 4 })
  const result = resolvePair(player, enemy, [null, player, null], [null, enemy, null], 1, 1)

  assert.equal(result.rps, 'neutral')
  assert.deepEqual(result.player.rolls, [5])
  assert.equal(result.player.chosenRoll, 5)
  assert.equal(result.player.chosenRollIndex, 0)
  assert.deepEqual(result.enemy.rolls, [2])
  assert.equal(result.enemy.chosenRoll, 2)
  assert.equal(result.enemy.chosenRollIndex, 0)
  assert.equal(result.player.dealt, 2)
  assert.equal(result.enemy.dealt, 1)
  assert.equal(player.value, 4)
  assert.equal(enemy.value, 2)
})

const originalMathRandom = Math.random
Math.random = () => 0
const expectedShuffledPlayerDeck = shuffleDeck(createPlayerDeck()).map((card) => card.id)
initRun()
Math.random = originalMathRandom

assert.deepEqual(gameState.playerDeck.map((card) => card.id), expectedShuffledPlayerDeck)
assert.equal(gameState.enemyBoard.filter(Boolean).length, GAME.SLOT_COUNT)

gameState.phase = 'placement'
gameState.playerHand = [
  makeCard({ id: 'first' }),
  makeCard({ id: 'second' }),
  makeCard({ id: 'third' }),
]
gameState.playerBoard = Array(GAME.SLOT_COUNT).fill(null)
gameState.enemyBoard = [
  makeCard({ id: 'enemy-a', value: 9 }),
  makeCard({ id: 'enemy-b', value: 3 }),
  makeCard({ id: 'enemy-c', value: 7 }),
]
gameState.placementOrder = []

assert.equal(placeCard('second', 1), true)
assert.equal(placeCard('first', 0), true)
assert.equal(placeCard('third', 2), true)
assert.deepEqual(getResolutionOrder(), [1, 0, 2])
assert.equal(unplaceCard(2), true)
assert.equal(canResolve(), false)
assert.equal(placeCard('third', 2), true)
assert.equal(canResolve(), true)

const prepared = prepareResolveRound()
assert.deepEqual(prepared.resolutionOrder, [1, 0, 2])
assert.equal(prepared.steps[0].slot, 1)
assert.equal(prepared.steps[0].player.range >= 1, true)

gameState.phase = 'draw'
gameState.playerDeck = [makeCard({ id: 'draw-1' }), makeCard({ id: 'draw-2' })]
gameState.playerHand = [makeCard({ id: 'kept-in-hand' })]
gameState.playerBoard = Array(GAME.SLOT_COUNT).fill(null)
drawCards()
assert.equal(gameState.phase, 'placement')
assert.equal(gameState.playerHand.length, GAME.SLOT_COUNT)

gameState.phase = 'placement'
gameState.round = 1
gameState.playerDeck = []
gameState.playerHand = []
gameState.playerCemetery = []
gameState.playerBoard = [
  makeCard({ id: 'alpha', name: 'Alpha', role: 'attack', rps: 'pressure', value: 9 }),
  makeCard({ id: 'beta', name: 'Beta', role: 'attack', rps: 'appeal', value: 8 }),
  makeCard({ id: 'gamma', name: 'Gamma', role: 'attack', rps: 'positioning', value: 7 }),
]
gameState.enemyDeck = []
gameState.enemyCemetery = []
gameState.enemyBoard = [
  makeCard({ id: 'weak-a', name: 'Weak A', role: 'support', rps: 'positioning', value: 3 }),
  makeCard({ id: 'weak-b', name: 'Weak B', role: 'support', rps: 'pressure', value: 3 }),
  makeCard({ id: 'weak-c', name: 'Weak C', role: 'support', rps: 'appeal', value: 3 }),
]
gameState.placementOrder = [...gameState.playerBoard]

const roundResult = withRandomSequence([0.9, 0.1, 0.2, 0.9, 0.1, 0.2, 0.9, 0.1, 0.2], () => resolveRound())
assert.equal(roundResult.outcome, 'win')
assert.equal(gameState.phase, 'reward')
assert.equal(gameState.playerBoard.every((slot) => slot === null), true)
assert.equal(gameState.playerHand.length, 3)
assert.deepEqual(gameState.enemyCemetery.map((card) => card.id).sort(), ['weak-a', 'weak-b', 'weak-c'])
assert.equal(gameState.rewardChoices.length, 3)

const chosenRewardId = gameState.rewardChoices[0].id
const deckCountBeforeReward = gameState.playerDeck.length
const claimedReward = claimReward(chosenRewardId)

assert.equal(claimedReward?.id, chosenRewardId)
assert.equal(gameState.phase, 'draw')
assert.equal(gameState.playerDeck.length, deckCountBeforeReward + 1)
assert.equal(gameState.enemyBoard.filter(Boolean).length, GAME.SLOT_COUNT)
assert.equal(gameState.rewardChoices.length, 0)

console.log('game logic smoke ok')

// ── RPS Tracker ─────────────────────────────────────────────

import {
  getTrackerState,
  projectCard,
  clearProjection,
  resolveCard,
  resetTracker,
} from '../js/rps-tracker.js'

// Reset before tracker tests
resetTracker()

// Test: initial state is all zeros
{
  const s = getTrackerState()
  assert.deepStrictEqual(s.resolved, { pressure: 0, appeal: 0, positioning: 0 })
  assert.deepStrictEqual(s.projected, { pressure: 0, appeal: 0, positioning: 0 })
  console.log('  ✔ tracker: initial state is all zeros')
}

// Test: projectCard increments projected
{
  resetTracker()
  projectCard('pressure')
  projectCard('pressure')
  projectCard('appeal')
  const s = getTrackerState()
  assert.deepStrictEqual(s.projected, { pressure: 2, appeal: 1, positioning: 0 })
  assert.deepStrictEqual(s.resolved, { pressure: 0, appeal: 0, positioning: 0 })
  console.log('  ✔ tracker: projectCard increments projected counts')
}

// Test: clearProjection zeros projected, keeps resolved
{
  resetTracker()
  resolveCard('positioning')
  projectCard('appeal')
  clearProjection()
  const s = getTrackerState()
  assert.deepStrictEqual(s.projected, { pressure: 0, appeal: 0, positioning: 0 })
  assert.deepStrictEqual(s.resolved, { pressure: 0, appeal: 0, positioning: 1 })
  console.log('  ✔ tracker: clearProjection zeros projected, keeps resolved')
}

// Test: resolveCard moves from projected to resolved
{
  resetTracker()
  projectCard('pressure')
  projectCard('appeal')
  resolveCard('pressure')
  const s = getTrackerState()
  assert.equal(s.resolved.pressure, 1)
  assert.equal(s.projected.pressure, 0)
  assert.equal(s.projected.appeal, 1)
  console.log('  ✔ tracker: resolveCard moves projected to resolved')
}

// Test: resetTracker clears everything
{
  resetTracker()
  projectCard('pressure')
  resolveCard('pressure')
  projectCard('appeal')
  resetTracker()
  const s = getTrackerState()
  assert.deepStrictEqual(s.resolved, { pressure: 0, appeal: 0, positioning: 0 })
  assert.deepStrictEqual(s.projected, { pressure: 0, appeal: 0, positioning: 0 })
  console.log('  ✔ tracker: resetTracker clears everything')
}

// Test: percentage calculation — proportional
{
  resetTracker()
  resolveCard('pressure')
  resolveCard('pressure')
  resolveCard('appeal')
  const s = getTrackerState()
  // total resolved = 3, pressure = 2/3 ≈ 66.7%, appeal = 1/3 ≈ 33.3%
  assert.equal(s.resolvedTotal, 3)
  console.log('  ✔ tracker: resolvedTotal is correct')
}
