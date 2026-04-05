import { GAME } from '../config/game.config.js'

// RPS win table: key beats value
const RPS_BEATS = {
  rock: 'scissors',
  scissors: 'paper',
  paper: 'rock',
}

/**
 * Returns the RPS result from attacker's perspective.
 * @returns {'advantage' | 'neutral' | 'disadvantage'}
 */
export function getRpsResult(attacker, defender) {
  if (attacker.rps === defender.rps) return 'neutral'
  if (RPS_BEATS[attacker.rps] === defender.rps) return 'advantage'
  return 'disadvantage'
}

/**
 * Returns net damage dealt by attacker to defender (minimum 0).
 * Reads card.buffs from both sides.
 */
export function calcDamage(attacker, defender) {
  const rps = getRpsResult(attacker, defender)

  // Base damage: attacker value + buffs
  let damage = attacker.value + attacker.buffs

  // RPS modifier
  if (rps === 'advantage') damage += GAME.RPS_MODIFIER
  if (rps === 'disadvantage') damage -= GAME.RPS_MODIFIER

  // Attack role bonus
  if (attacker.role === 'attack') {
    damage += GAME.ATTACK_BONUS
  }

  // Opportunist effect: +2 on RPS advantage
  if (attacker.effect?.bonusDamageOnAdvantage && rps === 'advantage') {
    damage += attacker.effect.bonusDamageOnAdvantage
  }

  // Defense reduction (defender's own reduction)
  let reduction = 0
  if (defender.role === 'defense') {
    reduction = Math.floor(defender.value * GAME.DEFENSE_REDUCTION) + (defender.buffs ?? 0)
  }

  // Shield effect: extra -1 after standard reduction
  if (defender.effect?.extraReduction) {
    reduction += defender.effect.extraReduction
  }

  // Reactive Guard: +2 reduction when at RPS disadvantage (i.e. attacker has advantage)
  if (defender.effect?.bonusReductionOnDisadvantage && rps === 'advantage') {
    reduction += defender.effect.bonusReductionOnDisadvantage
  }

  damage -= reduction

  // Glass Cannon: takes +1 extra damage
  if (defender.effect?.extraDamageTaken) {
    damage += defender.effect.extraDamageTaken
  }

  return Math.max(0, damage)
}

/**
 * Applies damage to a card. Mutates card.hp.
 * @returns {boolean} true if the card died (hp <= 0)
 */
export function applyDamage(card, amount) {
  card.hp -= amount
  return card.hp <= 0
}

/**
 * Fully resolves a player card vs enemy card pair.
 * Mutates hp on both cards.
 * @returns {{ aDealt: number, bDealt: number, aDied: boolean, bDied: boolean }}
 */
export function resolvePair(playerCard, enemyCard) {
  const aDealt = calcDamage(playerCard, enemyCard)
  const bDealt = calcDamage(enemyCard, playerCard)

  const bDied = applyDamage(enemyCard, aDealt)
  const aDied = applyDamage(playerCard, bDealt)

  return { aDealt, bDealt, aDied, bDied }
}
