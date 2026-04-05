import { GAME } from '../config/game.config.js'

export function ensureBuffState(card) {
  if (!card) return card

  if (!Array.isArray(card.buffSources)) {
    card.buffSources = []
  }

  if (!card.buffMeta) {
    card.buffMeta = {
      rawTotal: 0,
      appliedTotal: 0,
      cappedBy: 0,
    }
  }

  if (typeof card.buffs !== 'number') {
    card.buffs = 0
  }

  return card
}

export function syncCardBuffs(card) {
  ensureBuffState(card)

  const rawTotal = card.buffSources.reduce((sum, source) => sum + source.amount, 0)
  const appliedTotal = Math.max(0, Math.min(rawTotal, GAME.BUFF_CAP))

  card.buffs = appliedTotal
  card.buffMeta = {
    rawTotal,
    appliedTotal,
    cappedBy: Math.max(0, rawTotal - appliedTotal),
  }

  return card.buffs
}

export function addBuffSource(card, source) {
  ensureBuffState(card)

  const normalized = {
    id: source.id,
    amount: source.amount,
    label: source.label,
    description: source.description,
    kind: source.kind ?? 'generic',
    scope: source.scope ?? 'persistent',
  }

  const existingIndex = card.buffSources.findIndex((entry) => entry.id === normalized.id)
  if (existingIndex === -1) {
    card.buffSources.push(normalized)
  } else {
    card.buffSources[existingIndex] = normalized
  }

  syncCardBuffs(card)
  return normalized
}

export function clearBuffSourcesByScope(card, scope) {
  ensureBuffState(card)
  card.buffSources = card.buffSources.filter((source) => source.scope !== scope)
  syncCardBuffs(card)
}

export function getBuffSummary(card) {
  ensureBuffState(card)
  syncCardBuffs(card)

  return {
    total: card.buffs,
    rawTotal: card.buffMeta.rawTotal,
    cappedBy: card.buffMeta.cappedBy,
    sources: [...card.buffSources],
  }
}
