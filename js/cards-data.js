/**
 * Returns a fresh deep copy of all card definitions.
 * Call every time you need a new deck.
 */
export function createDeck() {
  return CARD_DEFINITIONS.map(cloneCard)
}

function cloneCard(def) {
  return { ...def }
}

/**
 * 12 prototype cards. value = HP and attack range ceiling.
 * rps: 'rock' | 'paper' | 'scissors'
 * role: 'attack' | 'defense' | 'support'
 */
const CARD_DEFINITIONS = [
  { id: 'brawler', name: 'Brawler', rps: 'rock', value: 5, role: 'attack' },
  { id: 'slasher', name: 'Slasher', rps: 'scissors', value: 7, role: 'attack' },
  { id: 'crusher', name: 'Crusher', rps: 'paper', value: 9, role: 'attack' },
  { id: 'lunger', name: 'Lunger', rps: 'rock', value: 3, role: 'attack' },

  { id: 'bulwark', name: 'Bulwark', rps: 'paper', value: 6, role: 'defense' },
  { id: 'ironclad', name: 'Ironclad', rps: 'rock', value: 8, role: 'defense' },
  { id: 'buckler', name: 'Buckler', rps: 'scissors', value: 4, role: 'defense' },

  { id: 'mentor', name: 'Mentor', rps: 'scissors', value: 3, role: 'support' },
  { id: 'tactician', name: 'Tactician', rps: 'paper', value: 5, role: 'support' },
  { id: 'vanguard', name: 'Vanguard', rps: 'rock', value: 7, role: 'support' },
  { id: 'scout', name: 'Scout', rps: 'scissors', value: 4, role: 'support' },
  { id: 'warden', name: 'Warden', rps: 'paper', value: 6, role: 'support' },
]
