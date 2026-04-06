zmienmy nazwy Rock Scissors Paper na nowe nazwy, ktore beda dzialac podobnie, ale beda odzwierciedlac rozne podejscie do dzialań.
Core Concept

Design a card-based system for resolving encounters (combat, social, etc.) using a tri-axis interaction model inspired by Rock–Paper–Scissors:
	•	Pressure
	•	Appeal
	•	Positioning
Each axis represents an approach, not a role.
⸻
Core Mechanics

Each card has two independent dimensions:
Approach (RPS axis):
	•	pressure > appeal
	•	appeal > positioning
	•	positioning > pressure
Function (Role):
	•	attack
	•	defense
	•	support
⸻
emoji:
	•	Pressure (Pr) → 🔥
	•	Appeal (Ap) → 🎭
	•	Positioning (Po) → 🧭

    RPS → PrApPo
⸻
new card names fo player:
[
  { "id": "brawler",   "name": "Break Will",      "rps": "pressure",    "value": 5, "role": "attack",  "owner": "player" },
  { "id": "slasher",   "name": "Cut an Opening",  "rps": "positioning", "value": 6, "role": "attack",  "owner": "player" },
  { "id": "crusher",   "name": "Crush Doubt",     "rps": "appeal",      "value": 6, "role": "attack",  "owner": "player" },
  { "id": "lunger",    "name": "All-In Strike",   "rps": "pressure",    "value": 3, "role": "attack",  "owner": "player" },

  { "id": "bulwark",   "name": "Hold Composure",  "rps": "appeal",      "value": 6, "role": "defense", "owner": "player" },
  { "id": "ironclad",  "name": "Stand Unbroken",  "rps": "pressure",    "value": 5, "role": "defense", "owner": "player" },
  { "id": "buckler",   "name": "Slip the Blow",   "rps": "positioning", "value": 4, "role": "defense", "owner": "player" },

  { "id": "mentor",    "name": "Guide the Move",  "rps": "positioning", "value": 3, "role": "support", "owner": "player" },
  { "id": "tactician", "name": "Shape Intent",    "rps": "appeal",      "value": 5, "role": "support", "owner": "player" },
  { "id": "vanguard",  "name": "Lead the Charge", "rps": "pressure",    "value": 6, "role": "support", "owner": "player" },
  { "id": "scout",     "name": "Mark the Path",   "rps": "positioning", "value": 4, "role": "support", "owner": "player" },
  { "id": "warden",    "name": "Steady Hearts",   "rps": "appeal",      "value": 6, "role": "support", "owner": "player" }
]
