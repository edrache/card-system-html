import { gameState, canResolve } from './game.js'

// ── Round counter ─────────────────────────────────────────────────────────────

export function updateRoundCounter() {
  const el = document.getElementById('round-counter')
  if (el) el.textContent = `Round ${gameState.round}`
}

// ── Resolve button ────────────────────────────────────────────────────────────

export function syncResolveButton() {
  const btn = document.getElementById('btn-resolve')
  if (!btn) return
  btn.disabled = !canResolve()
  btn.textContent = 'Resolve'
}

export function setResolveButtonLabel(label) {
  const btn = document.getElementById('btn-resolve')
  if (!btn) return
  btn.textContent = label
}

export function setResolveButtonDisabled(disabled) {
  const btn = document.getElementById('btn-resolve')
  if (!btn) return
  btn.disabled = disabled
}

// ── HP labels on cards ────────────────────────────────────────────────────────

/**
 * Updates or creates the HP label on a card element.
 * @param {HTMLElement} cardEl
 * @param {number}      hp
 */
export function setCardHpLabel(cardEl, hp) {
  const label = cardEl.querySelector('.card__hp')
  if (label) label.textContent = `♥\u202F${hp}`
}

// ── Overlay screens ───────────────────────────────────────────────────────────

/**
 * Shows the overlay with given HTML content.
 */
export function showOverlay(html) {
  const overlay = document.getElementById('overlay')
  if (!overlay) return
  overlay.innerHTML = html
  overlay.classList.remove('hidden')
}

export function hideOverlay() {
  const overlay = document.getElementById('overlay')
  if (!overlay) return
  overlay.classList.add('hidden')
  overlay.innerHTML = ''
}

// ── Combat log (console-only for now) ────────────────────────────────────────

export function logRoundResult(result) {
  if (!result) return
  result.log.forEach(entry => {
    if (entry.skipped) {
      console.log(`Slot ${entry.slot}: empty — skipped`)
      return
    }
    const { player: p, enemy: e } = entry
    console.log(
      `Slot ${entry.slot}: ${p.name} dealt ${p.dealt} dmg (hp→${p.hp}${p.died ? ' DEAD' : ''}) ` +
      `vs ${e.name} dealt ${e.dealt} dmg (hp→${e.hp}${e.died ? ' DEAD' : ''})`
    )
  })
  console.log('Outcome:', result.outcome)
}
