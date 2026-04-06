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
 * rps: 'rock' | 'paper' | 'scissors'
 * role: 'attack' | 'defense' | 'support'
 * owner: 'player'
 */
const PLAYER_CARD_DEFINITIONS = [
  { id: 'brawler',   name: 'Brawler',   rps: 'rock',     value: 5, role: 'attack',  owner: 'player' },
  { id: 'slasher',   name: 'Slasher',   rps: 'scissors', value: 6, role: 'attack',  owner: 'player' },
  { id: 'crusher',   name: 'Crusher',   rps: 'paper',    value: 6, role: 'attack',  owner: 'player' },
  { id: 'lunger',    name: 'Lunger',    rps: 'rock',     value: 3, role: 'attack',  owner: 'player' },

  { id: 'bulwark',   name: 'Bulwark',   rps: 'paper',    value: 6, role: 'defense', owner: 'player' },
  { id: 'ironclad',  name: 'Ironclad',  rps: 'rock',     value: 5, role: 'defense', owner: 'player' },
  { id: 'buckler',   name: 'Buckler',   rps: 'scissors', value: 4, role: 'defense', owner: 'player' },

  { id: 'mentor',    name: 'Mentor',    rps: 'scissors', value: 3, role: 'support', owner: 'player' },
  { id: 'tactician', name: 'Tactician', rps: 'paper',    value: 5, role: 'support', owner: 'player' },
  { id: 'vanguard',  name: 'Vanguard',  rps: 'rock',     value: 6, role: 'support', owner: 'player' },
  { id: 'scout',     name: 'Scout',     rps: 'scissors', value: 4, role: 'support', owner: 'player' },
  { id: 'warden',    name: 'Warden',    rps: 'paper',    value: 6, role: 'support', owner: 'player' },
]

/**
 * 12 enemy cards. value range: 3–5.
 * rps: 'rock' | 'paper' | 'scissors'
 * role: 'attack' | 'defense' | 'support'
 * owner: 'enemy'
 */
const ENEMY_CARD_DEFINITIONS = [
  { id: 'brawler',   name: 'Brawler',   rps: 'rock',     value: 5, role: 'attack',  owner: 'enemy' },
  { id: 'slasher',   name: 'Slasher',   rps: 'scissors', value: 5, role: 'attack',  owner: 'enemy' },
  { id: 'crusher',   name: 'Crusher',   rps: 'paper',    value: 5, role: 'attack',  owner: 'enemy' },
  { id: 'lunger',    name: 'Lunger',    rps: 'rock',     value: 3, role: 'attack',  owner: 'enemy' },

  { id: 'bulwark',   name: 'Bulwark',   rps: 'paper',    value: 5, role: 'defense', owner: 'enemy' },
  { id: 'ironclad',  name: 'Ironclad',  rps: 'rock',     value: 5, role: 'defense', owner: 'enemy' },
  { id: 'buckler',   name: 'Buckler',   rps: 'scissors', value: 4, role: 'defense', owner: 'enemy' },

  { id: 'mentor',    name: 'Mentor',    rps: 'scissors', value: 3, role: 'support', owner: 'enemy' },
  { id: 'tactician', name: 'Tactician', rps: 'paper',    value: 5, role: 'support', owner: 'enemy' },
  { id: 'vanguard',  name: 'Vanguard',  rps: 'rock',     value: 5, role: 'support', owner: 'enemy' },
  { id: 'scout',     name: 'Scout',     rps: 'scissors', value: 4, role: 'support', owner: 'enemy' },
  { id: 'warden',    name: 'Warden',    rps: 'paper',    value: 5, role: 'support', owner: 'enemy' },
]
