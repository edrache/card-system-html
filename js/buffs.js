/**
 * Returns the total support bonus added to a card's effective roll range.
 * Support neighbors add +1 each (before rolling).
 *
 * @param {(object|null)[]} board
 * @param {number} slotIndex
 * @returns {number}
 */
export function getSupportBonus(board, slotIndex) {
  let bonus = 0
  const left = board[slotIndex - 1] ?? null
  const right = board[slotIndex + 1] ?? null
  if (left?.role === 'support') bonus += 1
  if (right?.role === 'support') bonus += 1
  return bonus
}
