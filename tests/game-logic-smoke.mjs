import assert from 'node:assert/strict'

import { GAME } from '../config/game.config.js'
import { createDeck } from '../js/cards-data.js'
import { getBuffSummary } from '../js/buffs.js'
import { calcDamage, getDamageBreakdown, getRpsResult, resolvePair } from '../js/combat.js'
import { shuffleDeck } from '../js/enemy.js'
import {
  claimReward,
  gameState,
  drawCards,
  finalizeResolveRound,
  initRun,
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

const originalMathRandom = Math.random
Math.random = () => 0
const expectedShuffledPlayerDeck = shuffleDeck(createDeck()).map((card) => card.id)
initRun()
Math.random = originalMathRandom

assert.deepEqual(gameState.playerDeck.map((card) => card.id), expectedShuffledPlayerDeck)
assert.notDeepEqual(gameState.playerDeck.map((card) => card.id), createDeck().map((card) => card.id))

const randomSequence = [
  0.01, 0.07, 0.13, 0.19, 0.23, 0.29, 0.31, 0.37, 0.41, 0.47,
  0.53, 0.59, 0.61, 0.67, 0.71, 0.79, 0.83, 0.89, 0.97,
]
let sequenceIndex = 0
Math.random = () => {
  const value = randomSequence[sequenceIndex % randomSequence.length]
  sequenceIndex += 1
  return value
}
initRun()
const firstResetDeckOrder = gameState.playerDeck.map((card) => card.id)
initRun()
const secondResetDeckOrder = gameState.playerDeck.map((card) => card.id)
Math.random = originalMathRandom

assert.notDeepEqual(firstResetDeckOrder, secondResetDeckOrder)

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

assert.equal(
  getDamageBreakdown(
    { rps: 'rock', value: 6, buffs: 0, role: 'support', effect: null },
    { rps: 'rock', value: 6, hp: 3, buffs: 0, role: 'defense', effect: null }
  ).reduction,
  2
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
gameState.playerCemetery = []
gameState.playerBoard = Array(GAME.SLOT_COUNT).fill(null)
gameState.enemyDeck = []
gameState.enemyCemetery = []
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
gameState.playerCemetery = []
gameState.playerBoard = Array(GAME.SLOT_COUNT).fill(null)
gameState.enemyDeck = []
gameState.enemyCemetery = []
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
gameState.playerCemetery = []
gameState.playerBoard = [
  makeCard({ id: 'front-left', name: 'Front Left', rps: 'rock', value: 4, role: 'attack', hp: 4 }),
  makeCard({ id: 'front-mid', name: 'Front Mid', rps: 'paper', value: 4, role: 'attack', hp: 4 }),
  makeCard({ id: 'front-right', name: 'Front Right', rps: 'scissors', value: 4, role: 'attack', hp: 4 }),
]
gameState.enemyDeck = []
gameState.enemyCemetery = []
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
gameState.playerCemetery = []
gameState.playerBoard = Array(GAME.SLOT_COUNT).fill(null)
gameState.enemyCemetery = []
drawCards()
assert.equal(gameState.playerHand.length, GAME.SLOT_COUNT)

gameState.phase = 'draw'
gameState.playerDeck = [makeCard({ id: 'short-1' }), makeCard({ id: 'short-2' })]
gameState.playerHand = []
gameState.playerCemetery = []
gameState.playerBoard = Array(GAME.SLOT_COUNT).fill(null)
gameState.enemyDeck = []
gameState.enemyCemetery = []
gameState.enemyBoard = [
  makeCard({ id: 'short-enemy-1' }),
  makeCard({ id: 'short-enemy-2' }),
  makeCard({ id: 'short-enemy-3' }),
]
gameState.placementOrder = []
drawCards()
assert.equal(gameState.phase, 'placement')
assert.equal(gameState.playerHand.length, 2)
assert.equal(canResolve(), false)
assert.equal(placeCard('short-1', 0), true)
assert.equal(placeCard('short-2', 1), true)
assert.equal(gameState.playerBoard[2], null)
assert.equal(gameState.playerHand.length, 0)
assert.equal(canResolve(), true)

gameState.phase = 'draw'
gameState.playerDeck = []
gameState.playerHand = []
gameState.playerCemetery = []
gameState.playerBoard = Array(GAME.SLOT_COUNT).fill(null)
gameState.enemyDeck = []
gameState.enemyBoard = [
  makeCard({ id: 'enemy-buffer-left', name: 'Enemy Buffer Left', rps: 'paper', value: 3, role: 'support', hp: 3 }),
  makeCard({ id: 'enemy-glass', name: 'Enemy Glass', rps: 'scissors', value: 5, role: 'attack', hp: 5 }),
  makeCard({
    id: 'enemy-buffer-right',
    name: 'Enemy Buffer Right',
    rps: 'rock',
    value: 2,
    role: 'support',
    hp: 2,
    effect: { buffAmount: 2 },
  }),
]
drawCards()
assert.equal(gameState.enemyBoard[1].buffs, 3)
assert.deepEqual(
  gameState.enemyBoard[1].buffSources.map((source) => ({ amount: source.amount, kind: source.kind })),
  [
    { amount: 1, kind: 'support' },
    { amount: 2, kind: 'support' },
  ]
)

gameState.phase = 'draw'
gameState.playerDeck = [makeCard({ id: 'd3' }), makeCard({ id: 'd4' }), makeCard({ id: 'd5' })]
gameState.playerHand = []
gameState.playerCemetery = []
gameState.playerBoard = [
  makeCard({
    id: 'ghost-slot',
    name: 'Ghost Slot',
    role: 'support',
    hp: 0,
    ghostBuffer: true,
    ghostBufferTurns: 1,
    effect: { persistBuffTurns: 1 },
  }),
  null,
  null,
]
gameState.enemyCemetery = []
drawCards()
assert.equal(gameState.playerHand.length, 2)

gameState.phase = 'placement'
gameState.round = 1
gameState.playerDeck = []
gameState.playerHand = []
gameState.playerCemetery = []
gameState.playerBoard = [
  makeCard({ id: 'survivor', name: 'Survivor', rps: 'rock', value: 6, role: 'attack', hp: 6 }),
  makeCard({ id: 'trader', name: 'Trader', rps: 'paper', value: 3, role: 'support', hp: 3 }),
  makeCard({ id: 'tank', name: 'Tank', rps: 'scissors', value: 6, role: 'defense', hp: 6 }),
]
gameState.enemyDeck = []
gameState.enemyCemetery = []
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
assert.equal(gameState.playerCemetery.length, 0)
assert.deepEqual(gameState.enemyCemetery.map((card) => card.id).sort(), ['weak1', 'weak2', 'weak3'])
assert.equal(gameState.enemyBoard.every((slot) => slot === null), true)
assert.equal(gameState.round, 2)
assert.equal(gameState.phase, 'reward')
assert.equal(gameState.rewardChoices.length, 3)

gameState.phase = 'placement'
gameState.round = 1
gameState.playerDeck = []
gameState.playerHand = []
gameState.playerCemetery = []
gameState.playerBoard = [
  makeCard({ id: 'bonus-card', name: 'Bonus Card', rps: 'rock', value: 6, role: 'attack', hp: 6 }),
  makeCard({ id: 'filler-1', name: 'Filler 1', rps: 'paper', value: 3, role: 'attack', hp: 3 }),
  makeCard({ id: 'filler-2', name: 'Filler 2', rps: 'scissors', value: 3, role: 'defense', hp: 3 }),
]
gameState.enemyDeck = []
gameState.enemyCemetery = []
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
gameState.playerCemetery = []
gameState.playerBoard = [
  makeCard({ id: 'ghost-left-anchor', name: 'Ghost Left Anchor', rps: 'rock', value: 6, role: 'attack', hp: 6 }),
  makeCard({
    id: 'ghost-persistent-buffer',
    name: 'Persistent Buffer',
    rps: 'scissors',
    value: 4,
    role: 'support',
    hp: 4,
    effect: { persistBuffTurns: 1 },
  }),
  makeCard({ id: 'ghost-right-anchor', name: 'Ghost Right Anchor', rps: 'scissors', value: 6, role: 'attack', hp: 6 }),
]
gameState.enemyDeck = []
gameState.enemyCemetery = []
gameState.enemyBoard = [
  makeCard({ id: 'ghost-weak-left', name: 'Ghost Weak Left', rps: 'scissors', value: 1, role: 'support', hp: 1 }),
  makeCard({ id: 'ghost-buffer-killer', name: 'Ghost Buffer Killer', rps: 'rock', value: 6, role: 'attack', hp: 6 }),
  makeCard({ id: 'ghost-weak-right', name: 'Ghost Weak Right', rps: 'paper', value: 1, role: 'support', hp: 1 }),
]
gameState.placementOrder = [...gameState.playerBoard]

const ghostRoundResult = resolveRound()
assert.equal(ghostRoundResult.outcome, 'continue')
assert.equal(gameState.playerBoard[1]?.ghostBuffer, true)
assert.equal(gameState.playerBoard[1]?.ghostBufferTurns, 1)
assert.equal(gameState.playerHand.length, 2)
assert.equal(gameState.playerCemetery.length, 0)
assert.deepEqual(gameState.enemyCemetery.map((card) => card.id).sort(), ['ghost-weak-left', 'ghost-weak-right'])

gameState.phase = 'placement'
gameState.round = 2
gameState.rewardChoices = []
gameState.playerDeck = []
gameState.playerHand = [
  makeCard({ id: 'ghost-next-left', name: 'Ghost Next Left', rps: 'rock', value: 4, role: 'attack', hp: 4 }),
  makeCard({ id: 'ghost-next-right', name: 'Ghost Next Right', rps: 'paper', value: 4, role: 'attack', hp: 4 }),
]
gameState.playerCemetery = []
gameState.enemyDeck = []
gameState.enemyCemetery = []
gameState.enemyBoard = [
  makeCard({ id: 'ghost-next-enemy-left', name: 'Ghost Next Enemy Left', rps: 'scissors', value: 2, role: 'support', hp: 2 }),
  makeCard({ id: 'ghost-next-enemy-mid', name: 'Ghost Next Enemy Mid', rps: 'rock', value: 2, role: 'support', hp: 2 }),
  makeCard({ id: 'ghost-next-enemy-right', name: 'Ghost Next Enemy Right', rps: 'rock', value: 2, role: 'support', hp: 2 }),
]

assert.equal(placeCard('ghost-next-left', 0), true)
assert.equal(placeCard('ghost-next-right', 2), true)
assert.equal(gameState.playerBoard[0].buffs, 1)
assert.equal(gameState.playerBoard[2].buffs, 1)
assert.equal(canResolve(), true)

gameState.phase = 'combat'
gameState.playerHand = [makeCard({ id: 'post-ghost-reserve', name: 'Reserve', hp: 3 })]
const postGhostResult = finalizeResolveRound([])
assert.equal(postGhostResult.outcome, 'continue')
assert.equal(gameState.playerBoard[1], null)
assert.deepEqual(gameState.playerCemetery.map((card) => card.id), ['ghost-persistent-buffer'])
assert.deepEqual(gameState.enemyCemetery, [])

gameState.phase = 'placement'
gameState.round = 1
gameState.playerDeck = []
gameState.playerHand = []
gameState.playerCemetery = []
gameState.playerBoard = [
  makeCard({ id: 'persist-left', name: 'Persist Left', rps: 'rock', value: 6, role: 'attack', hp: 6 }),
  makeCard({ id: 'persist-buffer', name: 'Buffer', rps: 'paper', value: 3, role: 'support', hp: 3 }),
  makeCard({ id: 'persist-right', name: 'Persist Right', rps: 'scissors', value: 6, role: 'attack', hp: 6 }),
]
gameState.enemyDeck = []
gameState.enemyCemetery = []
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

gameState.phase = 'placement'
gameState.round = 1
gameState.playerDeck = [makeCard({ id: 'carry-deck-card', name: 'Carry Deck', hp: 3 })]
gameState.playerHand = []
gameState.playerCemetery = []
gameState.playerBoard = [
  makeCard({ id: 'reward-left', name: 'Reward Left', rps: 'rock', value: 6, role: 'attack', hp: 6 }),
  makeCard({ id: 'reward-mid', name: 'Reward Mid', rps: 'paper', value: 6, role: 'attack', hp: 6 }),
  makeCard({ id: 'reward-right', name: 'Reward Right', rps: 'scissors', value: 6, role: 'attack', hp: 6 }),
]
gameState.enemyDeck = []
gameState.enemyCemetery = []
gameState.enemyBoard = [
  makeCard({ id: 'reward-enemy-left', name: 'Reward Enemy Left', rps: 'scissors', value: 1, role: 'support', hp: 1 }),
  makeCard({ id: 'reward-enemy-mid', name: 'Reward Enemy Mid', rps: 'rock', value: 1, role: 'support', hp: 1 }),
  makeCard({ id: 'reward-enemy-right', name: 'Reward Enemy Right', rps: 'paper', value: 1, role: 'support', hp: 1 }),
]
gameState.placementOrder = [...gameState.playerBoard]

const rewardRoundResult = resolveRound()
assert.equal(rewardRoundResult.outcome, 'win')
assert.equal(gameState.phase, 'reward')
assert.equal(gameState.rewardChoices.length, 3)

const chosenRewardId = gameState.rewardChoices[0].id
const deckCountBeforeReward = gameState.playerDeck.length
const claimedReward = claimReward(chosenRewardId)

assert.equal(claimedReward?.id, chosenRewardId)
assert.equal(gameState.phase, 'draw')
assert.equal(gameState.rewardChoices.length, 0)
assert.equal(gameState.playerDeck.length, deckCountBeforeReward + 1)
assert.equal(gameState.playerBoard.every((slot) => slot === null), true)
assert.equal(gameState.enemyBoard.filter(Boolean).length, GAME.SLOT_COUNT)
assert.deepEqual(gameState.enemyCemetery.map((card) => card.id).sort(), [
  'reward-enemy-left',
  'reward-enemy-mid',
  'reward-enemy-right',
])

gameState.phase = 'placement'
gameState.round = 1
gameState.playerDeck = []
gameState.playerHand = []
gameState.playerCemetery = []
gameState.playerBoard = [
  makeCard({ id: 'cemetery-survivor-left', name: 'Cemetery Survivor Left', rps: 'rock', value: 5, role: 'attack', hp: 5 }),
  makeCard({ id: 'cemetery-fallen', name: 'Cemetery Fallen', rps: 'paper', value: 2, role: 'support', hp: 2 }),
  makeCard({ id: 'cemetery-survivor-right', name: 'Cemetery Survivor Right', rps: 'scissors', value: 5, role: 'attack', hp: 5 }),
]
gameState.enemyDeck = []
gameState.enemyCemetery = []
gameState.enemyBoard = [
  makeCard({ id: 'cemetery-weak-left', name: 'Cemetery Weak Left', rps: 'scissors', value: 1, role: 'support', hp: 1 }),
  makeCard({ id: 'cemetery-killer', name: 'Cemetery Killer', rps: 'rock', value: 7, role: 'attack', hp: 7 }),
  makeCard({ id: 'cemetery-weak-right', name: 'Cemetery Weak Right', rps: 'paper', value: 1, role: 'support', hp: 1 }),
]
gameState.placementOrder = [...gameState.playerBoard]

const cemeteryRoundResult = resolveRound()
assert.equal(cemeteryRoundResult.outcome, 'continue')
assert.equal(gameState.playerHand.some((card) => card.id === 'cemetery-fallen'), false)
assert.deepEqual(gameState.playerCemetery.map((card) => card.id), ['cemetery-fallen'])
assert.deepEqual(gameState.enemyCemetery.map((card) => card.id).sort(), ['cemetery-weak-left', 'cemetery-weak-right'])

console.log('game logic smoke ok')
