import { CARD } from '../config/card.config.js'

const RPS_TYPE_META = {
  pressure:    { label: 'Pressure',    color: '#792929' },
  appeal:      { label: 'Appeal',      color: '#797929' },
  positioning: { label: 'Positioning', color: '#295679' },
}

const RPS_BEATS = {
  pressure:    'positioning',
  positioning: 'appeal',
  appeal:      'pressure',
}

const RPS_LOSES_TO = {
  pressure:    'appeal',
  positioning: 'pressure',
  appeal:      'positioning',
}

function titleCase(value = '') {
  return value ? `${value[0].toUpperCase()}${value.slice(1)}` : ''
}

function getRpsTypeMeta(rps = '') {
  return RPS_TYPE_META[rps] ?? { label: titleCase(rps), color: '#3f3f3f' }
}

function createCardHeader(card) {
  const typeMeta = getRpsTypeMeta(card.rps)
  const beatenMeta = RPS_BEATS[card.rps] ? getRpsTypeMeta(RPS_BEATS[card.rps]) : null

  const titleBar = document.createElement('div')
  titleBar.className = 'card__title-bar'
  titleBar.textContent = card.name ?? ''

  const typeRow = document.createElement('div')
  typeRow.className = 'card__type-row'

  const typeBadge = document.createElement('div')
  typeBadge.className = 'card__type-badge'
  typeBadge.textContent = typeMeta.label

  const beatsEl = document.createElement('div')
  beatsEl.className = 'card__type-beats'
  if (beatenMeta) {
    beatsEl.textContent = beatenMeta.label
    beatsEl.style.setProperty('--beaten-rps-color', beatenMeta.color)
  }

  typeRow.appendChild(typeBadge)
  typeRow.appendChild(beatsEl)

  const fragment = document.createDocumentFragment()
  fragment.appendChild(titleBar)
  fragment.appendChild(typeRow)
  return fragment
}

function getRoleDescription(role) {
  if (role === 'attack') return '+1 damage after rolling'
  if (role === 'defense') return '-1 incoming damage'
  if (role === 'support') return 'adjacent allies gain +1 range'
  return ''
}

function createTooltipRow(text, extraClass = '') {
  const item = document.createElement('li')
  item.className = extraClass ? `card__tooltip-item ${extraClass}` : 'card__tooltip-item'
  item.textContent = text
  return item
}

function getProjectionSides(combatProjection = null) {
  if (!combatProjection) {
    return { self: null, opponent: null }
  }

  return {
    self: combatProjection.self ?? combatProjection.player ?? null,
    opponent: combatProjection.opponent ?? combatProjection.enemy ?? null,
  }
}

function createCardTooltip(card, supportBonus, effectiveRange, combatProjection = null) {
  const tooltip = document.createElement('div')
  tooltip.className = 'card__tooltip'

  const title = document.createElement('div')
  title.className = 'card__tooltip-title'
  title.textContent = `Value ${card.value}`

  const list = document.createElement('ul')
  list.className = 'card__tooltip-list'
  if (card.role && card.role !== 'none') {
    list.appendChild(createTooltipRow(`Role: ${titleCase(card.role)} · ${getRoleDescription(card.role)}`))
  }
  list.appendChild(createTooltipRow(`Roll range: 1-${effectiveRange}`))

  if (supportBonus > 0) {
    list.appendChild(createTooltipRow(`Support bonus: +${supportBonus} to roll ceiling`))
  }

  if (combatProjection) {
    const { self, opponent } = getProjectionSides(combatProjection)
    list.appendChild(createTooltipRow(`Matchup: ${combatProjection.label} (${combatProjection.rps})`, 'card__tooltip-item--combat'))
    if (self) {
      list.appendChild(
        createTooltipRow(
          `This side rolls ${self.rollMode} from 1-${self.range}`,
          'card__tooltip-item--combat'
        )
      )
    }
    if (opponent) {
      list.appendChild(
        createTooltipRow(
          `Other side rolls ${opponent.rollMode} from 1-${opponent.range}`,
          'card__tooltip-item--combat'
        )
      )
    }
  }

  const footer = document.createElement('div')
  footer.className = 'card__tooltip-footer'
  footer.textContent = 'Value = HP and roll ceiling'

  tooltip.appendChild(title)
  tooltip.appendChild(list)
  tooltip.appendChild(footer)
  return tooltip
}

function updateStatsCluster(cardEl, card, supportBonus) {
  const valueEl = cardEl.querySelector('.card__value')
  const bonusEl = cardEl.querySelector('.card__value-delta')
  if (!valueEl) return

  valueEl.textContent = `${card.value}`

  if (supportBonus > 0) {
    if (bonusEl) {
      bonusEl.textContent = `R+${supportBonus}`
    } else {
      const delta = document.createElement('div')
      delta.className = 'card__value-delta'
      delta.textContent = `R+${supportBonus}`
      cardEl.querySelector('.card__stats-cluster')?.appendChild(delta)
    }
  } else {
    bonusEl?.remove()
  }
}

function updatePreviousValueBadge(cardEl, previousValue = null) {
  const existing = cardEl.querySelector('.card__value-previous')

  if (previousValue === null || previousValue === undefined) {
    existing?.remove()
    return
  }

  const badge = existing ?? document.createElement('div')
  badge.className = 'card__value-previous'
  badge.textContent = `Prev ${previousValue}`

  if (!existing) {
    cardEl.querySelector('.card__stats-cluster')?.prepend(badge)
  }
}

function updateCombatBadge(cardEl, combatProjection = null) {
  const existing = cardEl.querySelector('.card__combat-badge')
  if (!combatProjection) {
    existing?.remove()
    return
  }

  const { self, opponent } = getProjectionSides(combatProjection)
  const badge = existing ?? document.createElement('div')
  badge.className = `card__combat-badge card__combat-badge--${combatProjection.rps}`
  const badgeLines = [`<span class="card__combat-badge-line">${combatProjection.label}</span>`]
  if (self) {
    badgeLines.push(`<span class="card__combat-badge-line">THIS 1-${self.range}</span>`)
  }
  if (opponent) {
    badgeLines.push(`<span class="card__combat-badge-line">OPP 1-${opponent.range}</span>`)
  }
  badge.innerHTML = badgeLines.join('')

  if (!existing) {
    cardEl.querySelector('.card__top')?.appendChild(badge)
  }
}

export function updateCardPresentation(cardEl, card, context = null) {
  let normalizedContext = { combatProjection: null, previousValue: null }
  if (
    context &&
    ('combatProjection' in context || 'supportBonus' in context || 'effectiveRange' in context || 'previousValue' in context)
  ) {
    normalizedContext = context
  } else if (context && ('label' in context || 'rps' in context)) {
    normalizedContext = { combatProjection: context }
  }
  const combatProjection = normalizedContext.combatProjection ?? null
  const supportBonus = normalizedContext.supportBonus ?? combatProjection?.supportBonus ?? 0
  const effectiveRange = normalizedContext.effectiveRange ?? combatProjection?.effectiveRange ?? (card.value + supportBonus)
  const previousValue = normalizedContext.previousValue ?? null

  updateStatsCluster(cardEl, card, supportBonus)
  updatePreviousValueBadge(cardEl, previousValue)

  const oldTooltip = cardEl.querySelector('.card__tooltip')
  const newTooltip = createCardTooltip(card, supportBonus, effectiveRange, combatProjection)
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

  let tooltipTimer = null
  let tooltipSuppressed = false

  const showTooltip = () => {
    if (el.classList.contains('card--dragging')) return
    el.classList.add('card--tooltip-visible')
  }
  const hideTooltip = () => {
    clearTimeout(tooltipTimer)
    tooltipTimer = null
    el.classList.remove('card--tooltip-visible')
  }

  el.addEventListener('mouseenter', () => {
    el.classList.add('card--tooltip-active')
    if (!tooltipSuppressed) {
      tooltipTimer = setTimeout(showTooltip, CARD.tooltipDelay)
    }
  })

  el.addEventListener('mouseleave', () => {
    el.classList.remove('card--tooltip-active')
    hideTooltip()
    tooltipSuppressed = false
  })

  el.addEventListener('card:pressed', () => {
    hideTooltip()
    tooltipSuppressed = true
  })

  el.addEventListener('card:dropped', () => {
    hideTooltip()
    tooltipSuppressed = true
  })

  el.style.width = `${CARD.width}px`
  el.style.height = `${CARD.height}px`
  el.style.borderRadius = `${CARD.borderRadius}px`
  if (!isEnemy) el.style.backgroundColor = CARD.bgColor
  el.style.outline = `${CARD.outlineWidth}px solid ${CARD.outlineColor}`
  el.style.padding = `${CARD.padding}px`
  el.style.boxShadow = CARD.shadow
  el.style.zIndex = 1
  el.style.setProperty('--card-rps-color', getRpsTypeMeta(card.rps).color)

  const cardHeader = createCardHeader(card)

  const top = document.createElement('div')
  top.className = 'card__top'

  const role = document.createElement('div')
  role.className = `card__role card__role--${card.role ?? ''}`
  role.textContent = card.role && card.role !== 'none' ? card.role : ''

  top.appendChild(role)

  const statsCluster = document.createElement('div')
  statsCluster.className = 'card__stats-cluster'

  const stats = document.createElement('div')
  stats.className = 'card__stats'

  const value = document.createElement('div')
  value.className = 'card__stat card__value'

  stats.appendChild(value)
  statsCluster.appendChild(stats)

  const mid = document.createElement('div')
  mid.className = 'card__mid'
  mid.appendChild(statsCluster)

  const bot = document.createElement('div')
  bot.className = 'card__bot'

  const effect = document.createElement('div')
  effect.className = 'card__effect'
  effect.textContent = getRoleDescription(card.role)
  bot.appendChild(effect)

  const flavor = document.createElement('div')
  flavor.className = 'card__flavor'
  flavor.textContent = card.flavor ?? ''
  bot.appendChild(flavor)

  const loserType = RPS_LOSES_TO[card.rps]
  const bottomBar = document.createElement('div')
  bottomBar.className = 'card__bottom-bar'
  if (loserType) bottomBar.style.backgroundColor = getRpsTypeMeta(loserType).color

  el.appendChild(cardHeader)
  el.appendChild(top)
  el.appendChild(mid)
  el.appendChild(bot)
  el.appendChild(bottomBar)
  updateCardPresentation(el, card)

  return el
}
