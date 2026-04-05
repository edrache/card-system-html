export const GAME = {
  SLOT_COUNT: 3,

  // RPS combat
  RPS_MODIFIER: 3,            // flat damage bonus/penalty for advantage/disadvantage

  // Role modifiers
  ATTACK_BONUS: 2,            // extra damage dealt by attack-role cards
  DEFENSE_REDUCTION: 0.5,     // fraction of value subtracted from incoming damage for defense-role cards

  // First-card placement bonus (buffs added based on RPS match vs enemy in same slot)
  FIRST_CARD_BONUS_ADVANTAGE: 3,
  FIRST_CARD_BONUS_NEUTRAL: 1,
  FIRST_CARD_BONUS_DISADVANTAGE: 0,

  // Support buffs
  SUPPORT_BUFF_AMOUNT: 1,     // default buff given to adjacent allies on placement
  SUPPORT_BUFF_ON_SURVIVE: 1, // additional buff given after surviving combat
  BUFF_CAP: 3,                // maximum buffs a card can accumulate

  // Special card overrides
  FRAGILE_BUFFER_AMOUNT: 2,   // Fragile Buffer gives this instead of SUPPORT_BUFF_AMOUNT
}
