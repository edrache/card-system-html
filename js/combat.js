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
 * Returns adjacent allies in a 3-slot row.
 * @returns {[object|null, object|null]} [leftCard, rightCard]
 */
export function getAdjacentAllies(board, slotIndex) {
  return [
    board[slotIndex - 1] ?? null,
    board[slotIndex + 1] ?? null,
  ]
}

/**
 * Returns net damage dealt by attacker to defender (minimum 0).
 * Reads card.buffs from both sides.
 */
export function getDamageBreakdown(attacker, defender) {
  const rps = getRpsResult(attacker, defender)

  // Base damage: attacker value + buffs
  let rawAttack = attacker.value + attacker.buffs
  const attackModifiers = []

  // RPS modifier
  if (rps === 'advantage') {
    rawAttack += GAME.RPS_MODIFIER
    attackModifiers.push({ label: 'RPS advantage', amount: GAME.RPS_MODIFIER })
  }
  if (rps === 'disadvantage') {
    rawAttack -= GAME.RPS_MODIFIER
    attackModifiers.push({ label: 'RPS disadvantage', amount: -GAME.RPS_MODIFIER })
  }

  // Attack role bonus
  if (attacker.role === 'attack') {
    rawAttack += GAME.ATTACK_BONUS
    attackModifiers.push({ label: 'Attack role', amount: GAME.ATTACK_BONUS })
  }

  // Opportunist effect: +2 on RPS advantage
  if (attacker.effect?.bonusDamageOnAdvantage && rps === 'advantage') {
    rawAttack += attacker.effect.bonusDamageOnAdvantage
    attackModifiers.push({
      label: 'Opportunist effect',
      amount: attacker.effect.bonusDamageOnAdvantage,
    })
  }

  // Defense reduction (defender's own reduction)
  let reduction = 0
  const reductionSources = []
  if (defender.role === 'defense') {
    reduction = Math.floor(defender.value * GAME.DEFENSE_REDUCTION) + (defender.buffs ?? 0)
    reductionSources.push({
      label: 'Defense role',
      amount: Math.floor(defender.value * GAME.DEFENSE_REDUCTION),
    })
    if ((defender.buffs ?? 0) > 0) {
      reductionSources.push({ label: 'Buffs to defense', amount: defender.buffs ?? 0 })
    }
  }

  // Shield effect: extra -1 after standard reduction
  if (defender.effect?.extraReduction) {
    reduction += defender.effect.extraReduction
    reductionSources.push({ label: 'Shield effect', amount: defender.effect.extraReduction })
  }

  // Reactive Guard: +2 reduction when at RPS disadvantage (i.e. attacker has advantage)
  if (defender.effect?.bonusReductionOnDisadvantage && rps === 'advantage') {
    reduction += defender.effect.bonusReductionOnDisadvantage
    reductionSources.push({
      label: 'Reactive Guard effect',
      amount: defender.effect.bonusReductionOnDisadvantage,
    })
  }

  let damage = rawAttack - reduction

  // Glass Cannon: takes +1 extra damage
  if (defender.effect?.extraDamageTaken) {
    damage += defender.effect.extraDamageTaken
    attackModifiers.push({ label: 'Glass Cannon penalty', amount: defender.effect.extraDamageTaken })
  }

  return {
    rps,
    baseAttack: attacker.value,
    buffAttack: attacker.buffs ?? 0,
    rawAttack,
    attackModifiers,
    reduction,
    reductionSources,
    finalDamage: Math.max(0, damage),
  }
}

export function calcDamage(attacker, defender) {
  return getDamageBreakdown(attacker, defender).finalDamage
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
