/**
 * Returns a fresh deep copy of all prototype card definitions.
 * Call this every time you need a new deck to avoid shared mutable state.
 */
export function createDeck() {
  return CARD_DEFINITIONS.map((def) => cloneCardDefinition(def))
}

function cloneCardDefinition(definition) {
  return {
    ...definition,
    effect: definition.effect ? { ...definition.effect } : null,
    buffSources: [],
    buffMeta: {
      rawTotal: 0,
      appliedTotal: 0,
      cappedBy: 0,
    },
    ghostBuffer: false,
    ghostBufferTurns: 0,
  }
}

/**
 * All 10 prototype cards.
 * hp and buffs are runtime fields — starts equal to value / 0 respectively.
 */
const CARD_DEFINITIONS = [
  // ── Attack cards ──────────────────────────────────────────────
  {
    id: 'aggressor-6',
    name: 'Aggressor',
    rps: 'rock',
    value: 6,
    role: 'attack',
    effect: null,
    effectText: null,
    hp: 6,
    buffs: 0,
    buffSources: [],
  },
  {
    id: 'aggressor-4',
    name: 'Aggressor',
    rps: 'scissors',
    value: 4,
    role: 'attack',
    effect: null,
    effectText: null,
    hp: 4,
    buffs: 0,
    buffSources: [],
  },
  {
    id: 'glass-cannon-5',
    name: 'Glass Cannon',
    rps: 'scissors',
    value: 5,
    role: 'attack',
    effect: { extraDamageTaken: 1 },
    effectText: 'On hit 0/-1',
    hp: 5,
    buffs: 0,
    buffSources: [],
  },
  {
    id: 'opportunist-3',
    name: 'Opportunist',
    rps: 'paper',
    value: 3,
    role: 'attack',
    effect: { bonusDamageOnAdvantage: 2 },
    effectText: 'RPS win +2/0',
    hp: 3,
    buffs: 0,
    buffSources: [],
  },

  // ── Defense cards ─────────────────────────────────────────────
  {
    id: 'defender-6',
    name: 'Defender',
    rps: 'rock',
    value: 6,
    role: 'defense',
    effect: null,
    effectText: null,
    hp: 6,
    buffs: 0,
    buffSources: [],
  },
  {
    id: 'shield-4',
    name: 'Shield',
    rps: 'paper',
    value: 4,
    role: 'defense',
    effect: { extraReduction: 1 },
    effectText: 'On hit block +1',
    hp: 4,
    buffs: 0,
    buffSources: [],
  },
  {
    id: 'reactive-guard-3',
    name: 'Reactive Guard',
    rps: 'scissors',
    value: 3,
    role: 'defense',
    effect: { bonusReductionOnDisadvantage: 2 },
    effectText: 'RPS loss block +2',
    hp: 3,
    buffs: 0,
    buffSources: [],
  },

  // ── Support cards ─────────────────────────────────────────────
  {
    id: 'buffer-3',
    name: 'Buffer',
    rps: 'paper',
    value: 3,
    role: 'support',
    effect: null,
    effectText: 'Adjacent allies +1/0',
    hp: 3,
    buffs: 0,
    buffSources: [],
  },
  {
    id: 'fragile-buffer-2',
    name: 'Fragile Buffer',
    rps: 'rock',
    value: 2,
    role: 'support',
    effect: { buffAmount: 2 },
    effectText: 'Adjacent allies +2/0',
    hp: 2,
    buffs: 0,
    buffSources: [],
  },
  {
    id: 'persistent-buffer-4',
    name: 'Persistent Buffer',
    rps: 'scissors',
    value: 4,
    role: 'support',
    effect: { persistBuffTurns: 1 },
    effectText: 'Adjacent +1/0 persists',
    hp: 4,
    buffs: 0,
    buffSources: [],
  },
]
