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
  { id: 'brawler',   name: 'Break Will',       rps: 'pressure',    value: 5, role: 'attack',  owner: 'player', emoji: '👊', flavor: 'Relentless force leaves no room for hesitation.' },
  { id: 'slasher',   name: 'Cut an Opening',   rps: 'positioning', value: 6, role: 'none',    owner: 'player', emoji: '⚔️', flavor: 'The right angle makes its own advantage.' },
  { id: 'crusher',   name: 'Crush Doubt',      rps: 'appeal',      value: 6, role: 'none',    owner: 'player', emoji: '💪', flavor: 'Certainty spreads faster than fear.' },
  { id: 'lunger',    name: 'All-In Strike',    rps: 'pressure',    value: 3, role: 'none',    owner: 'player', emoji: '🎯', flavor: 'Commit hard enough and the outcome has to move.' },

  { id: 'bulwark',   name: 'Hold Composure',   rps: 'appeal',      value: 6, role: 'defense', owner: 'player', emoji: '🛡️', flavor: 'Calm reshapes the choices around you.' },
  { id: 'ironclad',  name: 'Stand Unbroken',   rps: 'pressure',    value: 5, role: 'none',    owner: 'player', emoji: '🪨', flavor: 'Raw resolve turns resistance into a dead end.' },
  { id: 'buckler',   name: 'Slip the Blow',    rps: 'positioning', value: 4, role: 'none',    owner: 'player', emoji: '💨', flavor: 'A precise step changes danger into distance.' },

  { id: 'mentor',    name: 'Guide the Move',   rps: 'positioning', value: 3, role: 'none',    owner: 'player', emoji: '📖', flavor: 'Preparation makes the next decision obvious.' },
  { id: 'tactician', name: 'Shape Intent',     rps: 'appeal',      value: 5, role: 'support', owner: 'player', emoji: '♟️', flavor: 'A well-placed signal bends the room your way.' },
  { id: 'vanguard',  name: 'Lead the Charge',  rps: 'pressure',    value: 6, role: 'none',    owner: 'player', emoji: '⚡', flavor: 'Momentum favors the side that acts first and hardest.' },
  { id: 'scout',     name: 'Mark the Path',    rps: 'positioning', value: 4, role: 'none',    owner: 'player', emoji: '👁️', flavor: 'Control the route and you control the fight.' },
  { id: 'warden',    name: 'Steady Hearts',    rps: 'appeal',      value: 6, role: 'none',    owner: 'player', emoji: '🤝', flavor: 'Shared resolve keeps the line from breaking.' },
]

/* const PLAYER_CARD_DEFINITIONS = [
  { id: 'brawler',   name: 'Break Will',       rps: 'pressure',    value: 5, role: 'attack',  owner: 'player', flavor: 'Relentless force leaves no room for hesitation.' },
  { id: 'slasher',   name: 'Cut an Opening',   rps: 'positioning', value: 6, role: 'attack',  owner: 'player', flavor: 'The right angle makes its own advantage.' },
  { id: 'crusher',   name: 'Crush Doubt',      rps: 'appeal',      value: 6, role: 'attack',  owner: 'player', flavor: 'Certainty spreads faster than fear.' },
  { id: 'lunger',    name: 'All-In Strike',    rps: 'pressure',    value: 3, role: 'attack',  owner: 'player', flavor: 'Commit hard enough and the outcome has to move.' },

  { id: 'bulwark',   name: 'Hold Composure',   rps: 'appeal',      value: 6, role: 'defense', owner: 'player', flavor: 'Calm reshapes the choices around you.' },
  { id: 'ironclad',  name: 'Stand Unbroken',   rps: 'pressure',    value: 5, role: 'defense', owner: 'player', flavor: 'Raw resolve turns resistance into a dead end.' },
  { id: 'buckler',   name: 'Slip the Blow',    rps: 'positioning', value: 4, role: 'defense', owner: 'player', flavor: 'A precise step changes danger into distance.' },

  { id: 'mentor',    name: 'Guide the Move',   rps: 'positioning', value: 3, role: 'support', owner: 'player', flavor: 'Preparation makes the next decision obvious.' },
  { id: 'tactician', name: 'Shape Intent',     rps: 'appeal',      value: 5, role: 'support', owner: 'player', flavor: 'A well-placed signal bends the room your way.' },
  { id: 'vanguard',  name: 'Lead the Charge',  rps: 'pressure',    value: 6, role: 'support', owner: 'player', flavor: 'Momentum favors the side that acts first and hardest.' },
  { id: 'scout',     name: 'Mark the Path',    rps: 'positioning', value: 4, role: 'support', owner: 'player', flavor: 'Control the route and you control the fight.' },
  { id: 'warden',    name: 'Steady Hearts',    rps: 'appeal',      value: 6, role: 'support', owner: 'player', flavor: 'Shared resolve keeps the line from breaking.' },
] */

/**
 * 12 enemy cards. value range: 3–5.
 * rps: 'pressure' | 'appeal' | 'positioning'
 * role: 'attack' | 'defense' | 'support' | 'none'
 * owner: 'enemy'
 */
const ENEMY_CARD_DEFINITIONS = [
  { id: 'brawler',  name: 'Kick In the Door',    rps: 'pressure',    value: 5, role: 'none', owner: 'enemy', emoji: '🚪', flavor: 'Splinters fly first, threats follow right after.' },
  { id: 'slasher',  name: 'Cut Off Escape',      rps: 'positioning', value: 5, role: 'none', owner: 'enemy', emoji: '🗡️', flavor: 'No alley, window, or back gate left open.' },
  { id: 'crusher',  name: 'Demand Valuables',    rps: 'appeal',      value: 5, role: 'none', owner: 'enemy', emoji: '💰', flavor: 'They bark for coin while waving steel.' },

  { id: 'bulwark',  name: 'Call for Cover',      rps: 'appeal',      value: 5, role: 'none', owner: 'enemy', emoji: '🔔', flavor: 'One shout and the whole gang ducks low.' },
  { id: 'ironclad', name: 'Hold the Breach',     rps: 'pressure',    value: 5, role: 'none', owner: 'enemy', emoji: '🧱', flavor: 'A brute plants himself where the doorway narrows.' },
  { id: 'buckler',  name: 'Duck Behind Crates',  rps: 'positioning', value: 4, role: 'none', owner: 'enemy', emoji: '📦', flavor: 'They loot with one hand and hide with the other.' },
]

/* const ENEMY_CARD_DEFINITIONS = [
  { id: 'brawler',   name: 'Kick In the Door',    rps: 'pressure',    value: 5, role: 'attack',  owner: 'enemy', flavor: 'Splinters fly first, threats follow right after.' },
  { id: 'slasher',   name: 'Cut Off Escape',      rps: 'positioning', value: 5, role: 'attack',  owner: 'enemy', flavor: 'No alley, window, or back gate left open.' },
  { id: 'crusher',   name: 'Demand Valuables',    rps: 'appeal',      value: 5, role: 'attack',  owner: 'enemy', flavor: 'They bark for coin while waving steel.' },
  { id: 'lunger',    name: 'All-In Strike',       rps: 'pressure',    value: 3, role: 'attack',  owner: 'enemy', flavor: 'A reckless knifeman lunges for the nearest mark.' },

  { id: 'bulwark',   name: 'Call for Cover',      rps: 'appeal',      value: 5, role: 'defense', owner: 'enemy', flavor: 'One shout and the whole gang ducks low.' },
  { id: 'ironclad',  name: 'Hold the Breach',     rps: 'pressure',    value: 5, role: 'defense', owner: 'enemy', flavor: 'A brute plants himself where the doorway narrows.' },
  { id: 'buckler',   name: 'Duck Behind Crates',  rps: 'positioning', value: 4, role: 'defense', owner: 'enemy', flavor: 'They loot with one hand and hide with the other.' },

  { id: 'mentor',    name: 'Guide the Move',      rps: 'positioning', value: 3, role: 'support', owner: 'enemy', flavor: 'The spotter points out the weakest corner of the room.' },
  { id: 'tactician', name: 'Shape Intent',        rps: 'appeal',      value: 5, role: 'support', owner: 'enemy', flavor: 'Their leader keeps the panic working for him.' },
  { id: 'vanguard',  name: 'Lead the Charge',     rps: 'pressure',    value: 5, role: 'support', owner: 'enemy', flavor: 'The first wave hits hard to break the room.' },
  { id: 'scout',     name: 'Mark the Path',       rps: 'positioning', value: 4, role: 'support', owner: 'enemy', flavor: 'A runner circles wide to watch every exit.' },
  { id: 'warden',    name: 'Steady Hearts',       rps: 'appeal',      value: 5, role: 'support', owner: 'enemy', flavor: 'One bandit hangs back to keep the haul secure.' },
] */
