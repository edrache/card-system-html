export const LAYOUT = {
  boardBg: 'oklch(27% 0.075 152)',   // deep forest green felt
  cardSnapOffset: { x: 4, y: 4 },   // positional offset (px) when a card snaps onto another card
  cardGap: 40,                        // horizontal gap between adjacent slots in px

  // Vertical position of each row as a fraction of viewport height
  // Slots are centered horizontally at runtime in main.js
  enemySlotRowY: 0.12,   // enemy slots at ~12% from top
  playerSlotRowY: 0.44,  // player slots at ~44% from top (leaves ~40% for hand area below)
  handY: null,           // computed at runtime: window.innerHeight - CARD.height - 50

  // Slot IDs — positions computed dynamically
  slots: [
    { id: 'slot-0' },
    { id: 'slot-1' },
    { id: 'slot-2' },
  ],
  enemySlots: [
    { id: 'enemy-slot-0' },
    { id: 'enemy-slot-1' },
    { id: 'enemy-slot-2' },
  ],
}
