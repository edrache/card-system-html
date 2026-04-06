import { createEnemyCardDeck } from './cards-data.js'
import { GAME } from '../config/game.config.js'

/**
 * Fisher-Yates shuffle — returns a new shuffled array, does not mutate input.
 */
export function shuffleDeck(deck) {
  const arr = [...deck]
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

/**
 * Builds the enemy's starting deck — a shuffled full deck.
 */
export function createEnemyDeck() {
  return shuffleDeck(createEnemyCardDeck())
}

/**
 * Fills empty enemy slots left-to-right by drawing from enemyDeck.
 * Mutates enemyBoard and enemyDeck in place.
 *
 * @param {(Card|null)[]} enemyBoard  — array of SLOT_COUNT slots
 * @param {Card[]}        enemyDeck   — remaining cards to draw from
 */
export function enemyRefillBoard(enemyBoard, enemyDeck) {
  for (let i = 0; i < GAME.SLOT_COUNT; i++) {
    if (enemyBoard[i] === null && enemyDeck.length > 0) {
      enemyBoard[i] = enemyDeck.shift()
    }
  }
}
