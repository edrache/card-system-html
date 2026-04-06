import { getSupportBonus } from './buffs.js'

const RPS_BEATS = {
  rock: 'scissors',
  scissors: 'paper',
  paper: 'rock',
}

export function getRpsResult(attacker, defender) {
  if (attacker.rps === defender.rps) return 'neutral'
  if (RPS_BEATS[attacker.rps] === defender.rps) return 'advantage'
  return 'disadvantage'
}

export function getAdjacentAllies(board, slotIndex) {
  return [
    board[slotIndex - 1] ?? null,
    board[slotIndex + 1] ?? null,
  ]
}

function roll(n) {
  return Math.floor(Math.random() * Math.max(1, n)) + 1
}

function applyAttackerRole(card, rolledValue) {
  if (card.role === 'attack') return rolledValue + 1
  return rolledValue
}

function applyDefenderRole(card, incomingAttack) {
  if (card.role === 'defense') return Math.max(0, incomingAttack - 1)
  return incomingAttack
}

export function getEffectiveRange(card, board, slotIndex) {
  return card.value + getSupportBonus(board, slotIndex)
}

function buildRange(min, max) {
  return { min, max }
}

function buildRollMode(rpsResult, isPlayer) {
  if (rpsResult === 'neutral') return '1x shared'
  if (rpsResult === 'advantage') return isPlayer ? '2x keep best' : '1x'
  return isPlayer ? '1x' : '2x keep best'
}

function getRoleAdjustedRange(attacker, defender, minRoll, maxRoll) {
  const minAttack = applyAttackerRole(attacker, minRoll)
  const maxAttack = applyAttackerRole(attacker, maxRoll)
  return buildRange(
    applyDefenderRole(defender, minAttack),
    applyDefenderRole(defender, maxAttack)
  )
}

export function getCombatPreview(playerCard, enemyCard, playerBoard, enemyBoard, playerSlot, enemySlot) {
  const rps = getRpsResult(playerCard, enemyCard)
  const playerSupportBonus = getSupportBonus(playerBoard, playerSlot)
  const enemySupportBonus = getSupportBonus(enemyBoard, enemySlot)
  const playerRange = getEffectiveRange(playerCard, playerBoard, playerSlot)
  const enemyRange = getEffectiveRange(enemyCard, enemyBoard, enemySlot)

  let playerDamageRange
  let enemyDamageRange

  if (rps === 'neutral') {
    const sharedMax = Math.min(playerRange, enemyRange)
    playerDamageRange = buildRange(
      applyDefenderRole(enemyCard, 1),
      applyDefenderRole(enemyCard, sharedMax)
    )
    enemyDamageRange = buildRange(
      applyDefenderRole(playerCard, 1),
      applyDefenderRole(playerCard, sharedMax)
    )
  } else {
    playerDamageRange = getRoleAdjustedRange(playerCard, enemyCard, 1, playerRange)
    enemyDamageRange = getRoleAdjustedRange(enemyCard, playerCard, 1, enemyRange)
  }

  return {
    rps,
    label: rps === 'advantage' ? 'ADV' : rps === 'disadvantage' ? 'DIS' : 'EVEN',
    player: {
      range: playerRange,
      supportBonus: playerSupportBonus,
      rollMode: buildRollMode(rps, true),
      damageRange: playerDamageRange,
    },
    enemy: {
      range: enemyRange,
      supportBonus: enemySupportBonus,
      rollMode: buildRollMode(rps, false),
      damageRange: enemyDamageRange,
    },
  }
}

export function resolvePair(playerCard, enemyCard, playerBoard, enemyBoard, playerSlot, enemySlot) {
  const preview = getCombatPreview(
    playerCard,
    enemyCard,
    playerBoard,
    enemyBoard,
    playerSlot,
    enemySlot
  )

  const playerRange = preview.player.range
  const enemyRange = preview.enemy.range

  let playerDealt
  let enemyDealt
  let playerRolls
  let enemyRolls

  if (preview.rps === 'neutral') {
    const playerRoll = roll(playerRange)
    const enemyRoll = roll(enemyRange)
    const sharedDamage = Math.min(playerRoll, enemyRoll)

    playerRolls = [playerRoll]
    enemyRolls = [enemyRoll]
    playerDealt = applyDefenderRole(enemyCard, sharedDamage)
    enemyDealt = applyDefenderRole(playerCard, sharedDamage)
  } else {
    const playerWins = preview.rps === 'advantage'

    const playerRoll1 = roll(playerRange)
    const playerRoll2 = playerWins ? roll(playerRange) : null
    const playerRollResult = playerWins ? Math.max(playerRoll1, playerRoll2) : playerRoll1
    playerRolls = playerWins ? [playerRoll1, playerRoll2] : [playerRoll1]

    const enemyRoll1 = roll(enemyRange)
    const enemyRoll2 = playerWins ? null : roll(enemyRange)
    const enemyRollResult = playerWins ? enemyRoll1 : Math.max(enemyRoll1, enemyRoll2)
    enemyRolls = playerWins ? [enemyRoll1] : [enemyRoll1, enemyRoll2]

    playerDealt = applyDefenderRole(enemyCard, applyAttackerRole(playerCard, playerRollResult))
    enemyDealt = applyDefenderRole(playerCard, applyAttackerRole(enemyCard, enemyRollResult))
  }

  const playerValueBefore = playerCard.value
  const enemyValueBefore = enemyCard.value

  playerCard.value = Math.max(0, playerCard.value - enemyDealt)
  enemyCard.value = Math.max(0, enemyCard.value - playerDealt)

  return {
    rps: preview.rps,
    label: preview.label,
    player: {
      rolls: playerRolls,
      range: playerRange,
      supportBonus: preview.player.supportBonus,
      rollMode: preview.player.rollMode,
      dealt: playerDealt,
      valueBefore: playerValueBefore,
      valueAfter: playerCard.value,
      died: playerCard.value <= 0,
    },
    enemy: {
      rolls: enemyRolls,
      range: enemyRange,
      supportBonus: preview.enemy.supportBonus,
      rollMode: preview.enemy.rollMode,
      dealt: enemyDealt,
      valueBefore: enemyValueBefore,
      valueAfter: enemyCard.value,
      died: enemyCard.value <= 0,
    },
  }
}
