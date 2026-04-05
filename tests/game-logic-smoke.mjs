import assert from 'node:assert/strict'

import { GAME } from '../config/game.config.js'
import { createDeck } from '../js/cards-data.js'
import { getBuffSummary } from '../js/buffs.js'
import { calcDamage, getDamageBreakdown, getRpsResult, resolvePair } from '../js/combat.js'
import {
  gameState,
  drawCards,
  placeCard,
  unplaceCard,
  canResolve,
  prepareResolveRound,
  resolveRound,
} from '../js/game.js'

const makeCard = (overrides = {}) => ({
  id: Math.random().toString(36).slice(2),
  name: 'Test Card',
  rps: 'rock',
  value: 3,
  role: 'support',
  effect: null,
  hp: 3,
  buffs: 0,
  buffSources: [],
  ...overrides,
})

assert.equal(createDeck().length, 10)
assert.equal(getRpsResult({ rps: 'rock' }, { rps: 'scissors' }), 'advantage')
assert.equal(getRpsResult({ rps: 'rock' }, { rps: 'paper' }), 'disadvantage')

assert.equal(
  calcDamage(
    { rps: 'rock', value: 6, buffs: 0, role: 'attack', effect: null },
    { rps: 'scissors', value: 3, buffs: 0, role: 'support', effect: null }
  ),
  11
)

assert.equal(
  getDamageBreakdown(
    { rps: 'rock', value: 6, buffs: 1, role: 'attack', effect: null },
    { rps: 'scissors', value: 4, buffs: 1, role: 'defense', effect: null }
  ).finalDamage,
  9
)

assert.equal(
  getDamageBreakdown(
    { rps: 'rock', value: 6, buffs: 0, role: 'support', effect: null },
    { rps: 'rock', value: 6, hp: 2, buffs: 0, role: 'defense', effect: null }
  ).reduction,
  1
)

assert.deepEqual(
  resolvePair(
    { rps: 'rock', value: 6, buffs: 0, role: 'attack', effect: null, hp: 6 },
    { rps: 'scissors', value: 3, buffs: 0, role: 'support', effect: null, hp: 3 }
  ),
  { aDealt: 11, bDealt: 0, aDied: false, bDied: true }
)

gameState.phase = 'placement'
gameState.round = 1
gameState.playerDeck = []
gameState.playerHand = [
  makeCard({ id: 'p1', rps: 'rock' }),
  makeCard({ id: 'p2', rps: 'paper' }),
  makeCard({ id: 'p3', rps: 'scissors' }),
]
gameState.playerBoard = Array(GAME.SLOT_COUNT).fill(null)
gameState.enemyDeck = []
gameState.enemyBoard = [
  makeCard({ id: 'e1', rps: 'scissors' }),
  makeCard({ id: 'e2', rps: 'paper' }),
  makeCard({ id: 'e3', rps: 'rock' }),
]
gameState.placementOrder = []

assert.equal(placeCard('p1', 0), true)
assert.equal(gameState.playerBoard[0].buffs, GAME.FIRST_CARD_BONUS_ADVANTAGE)
assert.equal(unplaceCard(0), true)
assert.equal(gameState.playerHand.find((card) => card.id === 'p1').buffs, 0)
assert.equal(canResolve(), false)

gameState.phase = 'placement'
gameState.round = 1
gameState.playerDeck = []
gameState.playerHand = [
  makeCard({ id: 'left', name: 'Left', rps: 'rock', value: 4, role: 'attack', hp: 4 }),
  makeCard({ id: 'buffer', name: 'Buffer', rps: 'paper', value: 3, role: 'support', hp: 3 }),
  makeCard({ id: 'right', name: 'Right', rps: 'scissors', value: 4, role: 'attack', hp: 4 }),
]
gameState.playerBoard = Array(GAME.SLOT_COUNT).fill(null)
gameState.enemyDeck = []
gameState.enemyBoard = [
  makeCard({ id: 'enemy-left', rps: 'paper', value: 4, hp: 4 }),
  makeCard({ id: 'enemy-mid', rps: 'rock', value: 4, hp: 4 }),
  makeCard({ id: 'enemy-right', rps: 'rock', value: 4, hp: 4 }),
]
gameState.placementOrder = []

assert.equal(placeCard('left', 0), true)
assert.equal(placeCard('buffer', 1), true)
assert.equal(placeCard('right', 2), true)
assert.equal(gameState.playerBoard[0].buffs, 1)
assert.equal(gameState.playerBoard[2].buffs, 1)
assert.equal(
  getBuffSummary(gameState.playerBoard[0]).sources.some((source) => source.label === 'Buffer support'),
  true
)

gameState.phase = 'placement'
gameState.round = 1
gameState.playerDeck = []
gameState.playerHand = []
gameState.playerBoard = [
  makeCard({ id: 'front-left', name: 'Front Left', rps: 'rock', value: 4, role: 'attack', hp: 4 }),
  makeCard({ id: 'front-mid', name: 'Front Mid', rps: 'paper', value: 4, role: 'attack', hp: 4 }),
  makeCard({ id: 'front-right', name: 'Front Right', rps: 'scissors', value: 4, role: 'attack', hp: 4 }),
]
gameState.enemyDeck = []
gameState.enemyBoard = [
  makeCard({ id: 'enemy-front-left', name: 'Enemy Front Left', rps: 'paper', value: 4, role: 'attack', hp: 4 }),
  makeCard({ id: 'enemy-buffer', name: 'Enemy Buffer', rps: 'rock', value: 3, role: 'support', hp: 3 }),
  makeCard({ id: 'enemy-front-right', name: 'Enemy Front Right', rps: 'scissors', value: 4, role: 'attack', hp: 4 }),
]
gameState.placementOrder = [...gameState.playerBoard]

prepareResolveRound()
assert.equal(gameState.enemyBoard[0].buffs, 1)
assert.equal(gameState.enemyBoard[2].buffs, 1)
assert.equal(
  getBuffSummary(gameState.enemyBoard[0]).sources.some((source) => source.label === 'Enemy Buffer support'),
  true
)

gameState.phase = 'draw'
gameState.playerDeck = [makeCard({ id: 'd1' }), makeCard({ id: 'd2' })]
gameState.playerHand = [makeCard({ id: 'h1' })]
drawCards()
assert.equal(gameState.playerHand.length, GAME.SLOT_COUNT)

gameState.phase = 'placement'
gameState.round = 1
gameState.playerDeck = []
gameState.playerHand = []
gameState.playerBoard = [
  makeCard({ id: 'survivor', name: 'Survivor', rps: 'rock', value: 6, role: 'attack', hp: 6 }),
  makeCard({ id: 'trader', name: 'Trader', rps: 'paper', value: 3, role: 'support', hp: 3 }),
  makeCard({ id: 'tank', name: 'Tank', rps: 'scissors', value: 6, role: 'defense', hp: 6 }),
]
gameState.enemyDeck = []
gameState.enemyBoard = [
  makeCard({ id: 'weak1', name: 'Weak1', rps: 'scissors', value: 1, role: 'support', hp: 1 }),
  makeCard({ id: 'weak2', name: 'Weak2', rps: 'rock', value: 1, role: 'support', hp: 1 }),
  makeCard({ id: 'weak3', name: 'Weak3', rps: 'paper', value: 1, role: 'support', hp: 1 }),
]
gameState.placementOrder = [...gameState.playerBoard]

assert.equal(canResolve(), true)

const roundResult = resolveRound()

assert.equal(roundResult.outcome, 'win')
assert.equal(gameState.playerBoard.every((slot) => slot === null), true)
assert.equal(gameState.playerHand.length, 3)
assert.equal(gameState.enemyBoard.every((slot) => slot === null), true)
assert.equal(gameState.round, 2)
assert.equal(gameState.phase, 'end')

gameState.phase = 'placement'
gameState.round = 1
gameState.playerDeck = []
gameState.playerHand = []
gameState.playerBoard = [
  makeCard({ id: 'bonus-card', name: 'Bonus Card', rps: 'rock', value: 6, role: 'attack', hp: 6 }),
  makeCard({ id: 'filler-1', name: 'Filler 1', rps: 'paper', value: 3, role: 'attack', hp: 3 }),
  makeCard({ id: 'filler-2', name: 'Filler 2', rps: 'scissors', value: 3, role: 'defense', hp: 3 }),
]
gameState.enemyDeck = []
gameState.enemyBoard = [
  makeCard({ id: 'bonus-target', name: 'Bonus Target', rps: 'scissors', value: 1, role: 'support', hp: 1 }),
  makeCard({ id: 'bonus-target-2', name: 'Bonus Target 2', rps: 'rock', value: 1, role: 'support', hp: 1 }),
  makeCard({ id: 'bonus-target-3', name: 'Bonus Target 3', rps: 'paper', value: 1, role: 'support', hp: 1 }),
]
gameState.placementOrder = [...gameState.playerBoard]

const bonusRoundResult = resolveRound()
const bonusCardAfterRound = gameState.playerHand.find((card) => card.id === 'bonus-card')

assert.equal(bonusRoundResult.outcome, 'win')
assert.equal(bonusCardAfterRound.buffs, 0)
assert.deepEqual(getBuffSummary(bonusCardAfterRound).sources, [])

gameState.phase = 'placement'
gameState.round = 1
gameState.playerDeck = []
gameState.playerHand = []
gameState.playerBoard = [
  makeCard({ id: 'persist-left', name: 'Persist Left', rps: 'rock', value: 6, role: 'attack', hp: 6 }),
  makeCard({ id: 'persist-buffer', name: 'Buffer', rps: 'paper', value: 3, role: 'support', hp: 3 }),
  makeCard({ id: 'persist-right', name: 'Persist Right', rps: 'scissors', value: 6, role: 'attack', hp: 6 }),
]
gameState.enemyDeck = []
gameState.enemyBoard = [
  makeCard({ id: 'persist-weak-1', name: 'Weak 1', rps: 'scissors', value: 1, role: 'support', hp: 1 }),
  makeCard({ id: 'persist-weak-2', name: 'Weak 2', rps: 'rock', value: 1, role: 'support', hp: 1 }),
  makeCard({ id: 'persist-weak-3', name: 'Weak 3', rps: 'paper', value: 1, role: 'support', hp: 1 }),
]
gameState.placementOrder = [...gameState.playerBoard]

const persistRoundResult = resolveRound()
const leftPersistent = gameState.playerHand.find((card) => card.id === 'persist-left')

assert.equal(persistRoundResult.outcome, 'win')
assert.equal(leftPersistent.buffs, 1)
assert.equal(
  getBuffSummary(leftPersistent).sources.some((source) => source.label === 'Buffer survived'),
  true
)

console.log('game logic smoke ok')
