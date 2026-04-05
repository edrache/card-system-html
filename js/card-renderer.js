import { CARD } from '../config/card.config.js'
import { GAME } from '../config/game.config.js'
import { getBuffSummary } from './buffs.js'
import { getDamageBreakdown } from './combat.js'

const RPS_ICON = { rock: '✊', paper: '✋', scissors: '✌️' }

function createTooltipRow(text, extraClass = '') {
  const item = document.createElement('li')
  item.className = extraClass ? `card__tooltip-item ${extraClass}` : 'card__tooltip-item'
  item.textContent = text
  return item
}

function createTooltipDelta(text) {
  const delta = document.createElement('span')
  delta.className = 'card__tooltip-delta'
  delta.textContent = text
  return delta
}

function appendTooltipPart(parent, part) {
  if (typeof part === 'string') {
    parent.appendChild(document.createTextNode(part))
    return
  }

  if (part.type === 'delta') {
    parent.appendChild(createTooltipDelta(part.text))
    return
  }

  if (part.type === 'label') {
    const label = document.createElement('span')
    label.className = 'card__tooltip-label'
    label.textContent = part.text
    parent.appendChild(label)
  }
}

function createTooltipRichRow(parts, extraClass = '') {
  const item = document.createElement('li')
  item.className = extraClass ? `card__tooltip-item ${extraClass}` : 'card__tooltip-item'
  parts.forEach((part) => appendTooltipPart(item, part))
  return item
}

function createTooltipSectionRow(label, parts, extraClass = '') {
  return createTooltipRichRow(
    [{ type: 'label', text: `${label}:` }, ' ', ...parts],
    extraClass
  )
}

function appendModifierRow(list, source) {
  list.appendChild(
    createTooltipRichRow([
      { type: 'delta', text: formatStatDelta(source.amount, 0) },
      ' ',
      `${source.label}: ${source.description}`,
    ])
  )
}

function formatSignedAmount(amount) {
  return `${amount >= 0 ? '+' : ''}${amount}`
}

function formatStatDelta(atkDelta = 0, hpDelta = 0) {
  return `${formatSignedAmount(atkDelta)}/${formatSignedAmount(hpDelta)}`
}

function formatReductionDelta(amount) {
  return `${formatSignedAmount(-amount)}/0`
}

function appendReductionSourceParts(parts, source, index) {
  if (index > 0) parts.push(', ')
  parts.push({ type: 'delta', text: formatReductionDelta(source.amount) }, ` ${source.label}`)
  if (source.detail) {
    parts.push(` (${source.detail})`)
  }
}

function formatAttackLine(label, breakdown) {
  const parts = [
    { type: 'delta', text: `${breakdown.baseAttack}/${breakdown.baseAttack}` },
    ' base',
  ]

  if (breakdown.buffAttack > 0) {
    parts.push(', ', { type: 'delta', text: formatStatDelta(breakdown.buffAttack, 0) }, ' buffs')
  }

  breakdown.attackModifiers.forEach((modifier) => {
    parts.push(', ', { type: 'delta', text: formatStatDelta(modifier.amount, 0) }, ` ${modifier.label}`)
  })

  parts.push(' => ', { type: 'delta', text: `${breakdown.rawAttack}/0` }, ' applied')
  if (breakdown.reduction > 0) {
    parts.push(', blocked by ')
    breakdown.reductionSources.forEach((source, index) => appendReductionSourceParts(parts, source, index))
    if (breakdown.reductionSources.length > 1) {
      parts.push(', ', { type: 'delta', text: formatReductionDelta(breakdown.reduction) }, ' total block')
    }
  }
  parts.push(', hit ', { type: 'delta', text: formatStatDelta(0, -breakdown.finalDamage) })
  return createTooltipSectionRow(label, parts, 'card__tooltip-item--combat')
}

function formatDefenseLine(label, breakdown) {
  if (breakdown.reduction <= 0) {
    return createTooltipSectionRow(label, ['no active reduction'], 'card__tooltip-item--combat')
  }

  const parts = [{ type: 'delta', text: formatReductionDelta(breakdown.reduction) }, ' total block']
  if (breakdown.reductionSources.length > 0) {
    parts.push(': ')
    breakdown.reductionSources.forEach((source, index) => appendReductionSourceParts(parts, source, index))
  }
  return createTooltipSectionRow(label, parts, 'card__tooltip-item--combat')
}

function createCardTooltip(card, summary, effectiveValue, combatProjection = null, isEnemy = false) {
  const tooltip = document.createElement('div')
  tooltip.className = 'card__tooltip'

  const title = document.createElement('div')
  title.className = 'card__tooltip-title'
  title.textContent = `ATK ${effectiveValue} / HP ${card.hp}`

  const list = document.createElement('ul')
  list.className = 'card__tooltip-list'
  list.appendChild(createTooltipSectionRow('Base', [{ type: 'delta', text: `${card.value}/${card.value}` }]))
  list.appendChild(createTooltipSectionRow('Current', [{ type: 'delta', text: `${effectiveValue}/${card.hp}` }]))

  const supportSources = summary.sources.filter((source) => source.kind === 'support')
  const genericSources = isEnemy
    ? summary.sources.filter((source) => source.kind !== 'support')
    : summary.sources

  if (isEnemy && supportSources.length > 0) {
    supportSources.forEach((source) => {
      list.appendChild(
        createTooltipSectionRow('Support', [
          { type: 'delta', text: formatStatDelta(source.amount, 0) },
          ' ',
          `${source.label}: ${source.description}`,
        ])
      )
    })
  }

  if (genericSources.length === 0 && (!isEnemy || supportSources.length === 0)) {
    list.appendChild(createTooltipRow('No active modifiers'))
  } else {
    genericSources.forEach((source) => appendModifierRow(list, source))
  }

  if (summary.cappedBy > 0) {
    list.appendChild(
      createTooltipRichRow([
        { type: 'delta', text: formatStatDelta(-summary.cappedBy, 0) },
        ' ',
        `Buff cap: maximum bonus is ${GAME.BUFF_CAP}`,
      ], 'card__tooltip-item--cap')
    )
  }

  if (combatProjection) {
    list.appendChild(
      createTooltipSectionRow('Combat', [combatProjection.label, ` (${combatProjection.rps})`], 'card__tooltip-item--combat')
    )
    list.appendChild(formatAttackLine('Your attack', combatProjection.playerBreakdown))
    list.appendChild(formatDefenseLine('Your defense', combatProjection.enemyBreakdown))
    list.appendChild(formatAttackLine(`${combatProjection.enemyCard.name} attack`, combatProjection.enemyBreakdown))
    list.appendChild(
      createTooltipSectionRow(
        'Outcome',
        [
          'you ',
          { type: 'delta', text: formatStatDelta(0, combatProjection.playerAfterHp - card.hp) },
          ', enemy ',
          { type: 'delta', text: formatStatDelta(0, combatProjection.enemyAfterHp - combatProjection.enemyCard.hp) },
        ],
        'card__tooltip-item--combat'
      )
    )
  }

  const footer = document.createElement('div')
  footer.className = 'card__tooltip-footer'
  footer.textContent = 'Notation: ATK/HP'

  tooltip.appendChild(title)
  tooltip.appendChild(list)
  tooltip.appendChild(footer)
  return tooltip
}

function updateStatsCluster(cardEl, card, summary, effectiveValue) {
  const statsCluster = cardEl.querySelector('.card__stats-cluster')
  const attackEl = cardEl.querySelector('.card__attack')
  const hpEl = cardEl.querySelector('.card__hp')
  if (!statsCluster || !attackEl || !hpEl) return

  attackEl.textContent = `${effectiveValue}`
  attackEl.classList.toggle('card__stat--modified', summary.total > 0 || summary.cappedBy > 0)
  hpEl.textContent = `${card.hp}`
  hpEl.classList.toggle('card__stat--damaged', card.hp < card.value)

  const existingDelta = statsCluster.querySelector('.card__value-delta')
  if (summary.total > 0) {
    if (existingDelta) {
      existingDelta.textContent = `+${summary.total}`
    } else {
      const delta = document.createElement('div')
      delta.className = 'card__value-delta'
      delta.textContent = `+${summary.total}`
      statsCluster.appendChild(delta)
    }
  } else {
    existingDelta?.remove()
  }
}

function updateCombatBadge(cardEl, combatProjection = null) {
  const existing = cardEl.querySelector('.card__combat-badge')
  if (!combatProjection) {
    existing?.remove()
    return
  }

  const playerDies = combatProjection.playerAfterHp <= 0
  const badgeOutcome = playerDies && combatProjection.outcome === 'trade' ? 'lose' : combatProjection.outcome
  const meSkull = playerDies ? ' 💀' : ''
  const badgeLines = []

  if (combatProjection.enemyBreakdown.reduction > 0) {
    badgeLines.push(`ME DEF ${formatReductionDelta(combatProjection.enemyBreakdown.reduction)}`)
  }

  if (combatProjection.playerBreakdown.reduction > 0) {
    badgeLines.push(`EN DEF ${formatReductionDelta(combatProjection.playerBreakdown.reduction)}`)
  }

  badgeLines.push(`ME ${formatStatDelta(0, combatProjection.playerHpDelta)}${meSkull}`)
  badgeLines.push(`EN ${formatStatDelta(0, combatProjection.enemyHpDelta)}`)

  const badge = existing ?? document.createElement('div')
  badge.className = `card__combat-badge card__combat-badge--${badgeOutcome}`
  badge.innerHTML = badgeLines
    .map((line) => `<span class="card__combat-badge-line">${line}</span>`)
    .join('')

  if (!existing) {
    cardEl.querySelector('.card__top')?.appendChild(badge)
  }
}

export function updateCardPresentation(cardEl, card, combatProjection = null) {
  const summary = getBuffSummary(card)
  const effectiveValue = card.value + summary.total
  const isEnemy = cardEl.classList.contains('card--enemy')

  updateStatsCluster(cardEl, card, summary, effectiveValue)

  const oldTooltip = cardEl.querySelector('.card__tooltip')
  const newTooltip = createCardTooltip(card, summary, effectiveValue, combatProjection, isEnemy)
  if (oldTooltip) {
    oldTooltip.replaceWith(newTooltip)
  } else {
    cardEl.appendChild(newTooltip)
  }

  updateCombatBadge(cardEl, combatProjection)
}

export function createCardEl(card, isEnemy = false) {
  const el = document.createElement('div')
  el.className = isEnemy ? 'card card--enemy' : 'card'
  el.dataset.id = card.id

  el.addEventListener('mouseenter', () => {
    el.classList.add('card--tooltip-active')
  })

  el.addEventListener('mouseleave', () => {
    el.classList.remove('card--tooltip-active')
  })

  el.style.width = `${CARD.width}px`
  el.style.height = `${CARD.height}px`
  el.style.borderRadius = `${CARD.borderRadius}px`
  if (!isEnemy) el.style.backgroundColor = CARD.bgColor
  el.style.outline = `${CARD.outlineWidth}px solid ${CARD.outlineColor}`
  el.style.padding = `${CARD.padding}px`
  el.style.boxShadow = CARD.shadow
  el.style.zIndex = 1

  const top = document.createElement('div')
  top.className = 'card__top'

  const header = document.createElement('div')
  header.className = 'card__header'

  const name = document.createElement('div')
  name.className = 'card__name'
  name.textContent = card.name ?? ''

  const statsCluster = document.createElement('div')
  statsCluster.className = 'card__stats-cluster'

  const stats = document.createElement('div')
  stats.className = 'card__stats'

  const attack = document.createElement('div')
  attack.className = 'card__stat card__attack'

  const separator = document.createElement('div')
  separator.className = 'card__stat-separator'
  separator.textContent = '/'

  const hp = document.createElement('div')
  hp.className = 'card__stat card__hp'

  stats.appendChild(attack)
  stats.appendChild(separator)
  stats.appendChild(hp)
  statsCluster.appendChild(stats)

  const role = document.createElement('div')
  role.className = `card__role card__role--${card.role ?? ''}`
  role.textContent = card.role ?? ''

  header.appendChild(name)
  header.appendChild(statsCluster)
  top.appendChild(header)
  top.appendChild(role)

  const mid = document.createElement('div')
  mid.className = 'card__mid'

  const rpsIcon = document.createElement('div')
  rpsIcon.className = 'card__rps-icon'
  rpsIcon.textContent = RPS_ICON[card.rps] ?? '?'
  mid.appendChild(rpsIcon)

  const bot = document.createElement('div')
  bot.className = 'card__bot'

  const effect = document.createElement('div')
  effect.className = 'card__effect'
  effect.textContent = card.effectText ?? ''
  bot.appendChild(effect)

  el.appendChild(top)
  el.appendChild(mid)
  el.appendChild(bot)
  updateCardPresentation(el, card)

  return el
}
