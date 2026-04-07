/**
 * Returns a fresh deep copy of all player card definitions.
 * Call every time you need a new player deck.
 */
export function createPlayerDeck() {
  return PLAYER_CARD_DEFINITIONS.map(cloneCard)
}

/**
 * Returns a fresh deep copy of all enemy card definitions.
 * Call every time you need a new enemy deck.
 */
export function createEnemyCardDeck() {
  return ENEMY_CARD_DEFINITIONS.map(cloneCard)
}

function cloneCard(def) {
  return { ...def }
}

/**
 * 12 player cards. value range: 3–6.
 * rps: 'pressure' | 'appeal' | 'positioning'
 * role: 'attack' | 'defense' | 'support' | 'none'
 * owner: 'player'
 */
const PLAYER_CARD_DEFINITIONS = [
  { id: 'brawler', name: 'Break Will', rps: 'pressure', value: 5, role: 'attack', owner: 'player' },
  { id: 'slasher', name: 'Cut an Opening', rps: 'positioning', value: 6, role: 'none', owner: 'player' },
  { id: 'crusher', name: 'Crush Doubt', rps: 'appeal', value: 6, role: 'none', owner: 'player' },
  { id: 'lunger', name: 'All-In Strike', rps: 'pressure', value: 3, role: 'none', owner: 'player' },

  { id: 'bulwark', name: 'Hold Composure', rps: 'appeal', value: 6, role: 'defense', owner: 'player' },
  { id: 'ironclad', name: 'Stand Unbroken', rps: 'pressure', value: 5, role: 'none', owner: 'player' },
  { id: 'buckler', name: 'Slip the Blow', rps: 'positioning', value: 4, role: 'none', owner: 'player' },

  { id: 'mentor', name: 'Guide the Move', rps: 'positioning', value: 3, role: 'none', owner: 'player' },
  { id: 'tactician', name: 'Shape Intent', rps: 'appeal', value: 5, role: 'support', owner: 'player' },
  { id: 'vanguard', name: 'Lead the Charge', rps: 'pressure', value: 6, role: 'none', owner: 'player' },
  { id: 'scout', name: 'Mark the Path', rps: 'positioning', value: 4, role: 'none', owner: 'player' },
  { id: 'warden', name: 'Steady Hearts', rps: 'appeal', value: 6, role: 'none', owner: 'player' },
]

/* const PLAYER_CARD_DEFINITIONS = [
  { id: 'brawler',   name: 'Break Will',       rps: 'pressure',    value: 5, role: 'attack',  owner: 'player' },
  { id: 'slasher',   name: 'Cut an Opening',   rps: 'positioning', value: 6, role: 'attack',  owner: 'player' },
  { id: 'crusher',   name: 'Crush Doubt',      rps: 'appeal',      value: 6, role: 'attack',  owner: 'player' },
  { id: 'lunger',    name: 'All-In Strike',    rps: 'pressure',    value: 3, role: 'attack',  owner: 'player' },

  { id: 'bulwark',   name: 'Hold Composure',   rps: 'appeal',      value: 6, role: 'defense', owner: 'player' },
  { id: 'ironclad',  name: 'Stand Unbroken',   rps: 'pressure',    value: 5, role: 'defense', owner: 'player' },
  { id: 'buckler',   name: 'Slip the Blow',    rps: 'positioning', value: 4, role: 'defense', owner: 'player' },

  { id: 'mentor',    name: 'Guide the Move',   rps: 'positioning', value: 3, role: 'support', owner: 'player' },
  { id: 'tactician', name: 'Shape Intent',     rps: 'appeal',      value: 5, role: 'support', owner: 'player' },
  { id: 'vanguard',  name: 'Lead the Charge',  rps: 'pressure',    value: 6, role: 'support', owner: 'player' },
  { id: 'scout',     name: 'Mark the Path',    rps: 'positioning', value: 4, role: 'support', owner: 'player' },
  { id: 'warden',    name: 'Steady Hearts',    rps: 'appeal',      value: 6, role: 'support', owner: 'player' },
] */

/**
 * 12 enemy cards. value range: 3–5.
 * rps: 'pressure' | 'appeal' | 'positioning'
 * role: 'attack' | 'defense' | 'support' | 'none'
 * owner: 'enemy'
 */
const ENEMY_CARD_DEFINITIONS = [
  { id: 'brawler', name: 'Break Will', rps: 'pressure', value: 5, role: 'none', owner: 'enemy' },
  { id: 'slasher', name: 'Cut an Opening', rps: 'positioning', value: 5, role: 'none', owner: 'enemy' },
  { id: 'crusher', name: 'Crush Doubt', rps: 'appeal', value: 5, role: 'none', owner: 'enemy' },

  { id: 'bulwark', name: 'Hold Composure', rps: 'appeal', value: 5, role: 'none', owner: 'enemy' },
  { id: 'ironclad', name: 'Stand Unbroken', rps: 'pressure', value: 5, role: 'none', owner: 'enemy' },
  { id: 'buckler', name: 'Slip the Blow', rps: 'positioning', value: 4, role: 'none', owner: 'enemy' },
]

/* const ENEMY_CARD_DEFINITIONS = [
  { id: 'brawler',   name: 'Break Will',       rps: 'pressure',    value: 5, role: 'attack',  owner: 'enemy' },
  { id: 'slasher',   name: 'Cut an Opening',   rps: 'positioning', value: 5, role: 'attack',  owner: 'enemy' },
  { id: 'crusher',   name: 'Crush Doubt',      rps: 'appeal',      value: 5, role: 'attack',  owner: 'enemy' },
  { id: 'lunger',    name: 'All-In Strike',    rps: 'pressure',    value: 3, role: 'attack',  owner: 'enemy' },

  { id: 'bulwark',   name: 'Hold Composure',   rps: 'appeal',      value: 5, role: 'defense', owner: 'enemy' },
  { id: 'ironclad',  name: 'Stand Unbroken',   rps: 'pressure',    value: 5, role: 'defense', owner: 'enemy' },
  { id: 'buckler',   name: 'Slip the Blow',    rps: 'positioning', value: 4, role: 'defense', owner: 'enemy' },

  { id: 'mentor',    name: 'Guide the Move',   rps: 'positioning', value: 3, role: 'support', owner: 'enemy' },
  { id: 'tactician', name: 'Shape Intent',     rps: 'appeal',      value: 5, role: 'support', owner: 'enemy' },
  { id: 'vanguard',  name: 'Lead the Charge',  rps: 'pressure',    value: 5, role: 'support', owner: 'enemy' },
  { id: 'scout',     name: 'Mark the Path',    rps: 'positioning', value: 4, role: 'support', owner: 'enemy' },
  { id: 'warden',    name: 'Steady Hearts',    rps: 'appeal',      value: 5, role: 'support', owner: 'enemy' },
] */