/**
 * Returns a fresh deep copy of all prototype card definitions.
 * Call this every time you need a new deck to avoid shared mutable state.
 */
export function createDeck() {
  return CARD_DEFINITIONS.map(def => ({ ...def }))
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
    effectText: 'Takes +1 damage',
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
    effectText: '+2 dmg on RPS win',
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
    effectText: '−1 extra dmg taken',
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
    effectText: '+2 block on RPS loss',
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
    effectText: 'Buffs adjacent allies',
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
    effectText: 'Gives +2 buff (not +1)',
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
    effectText: 'Buff survives 1 turn',
    hp: 4,
    buffs: 0,
    buffSources: [],
  },
]
