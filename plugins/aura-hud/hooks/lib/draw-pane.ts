import type { AgentRun, AgentStatus, Look, Tier } from '../../types'

import { crab, crabCss } from './crab'
import { fitText, fmtCost, fmtTime, fmtTokens, fmtUsd, textWidth, xml } from './format'
import { modelName } from './model'
import { paletteCss, paletteOf, tierClass } from './palette'
import type { InkClass } from './palette'
import type { Costume, Planned, Totals } from './runs'
import { costumeOf, ctxOf, elapsedOf, progressOf, showsSteps, tierOf } from './runs'
import { S } from './strings'

const TEXT_CSS = "text{font-family:-apple-system,BlinkMacSystemFont,'SF Pro Text','Segoe UI',sans-serif;font-variant-numeric:tabular-nums}"

export const ROW_H = 66
export const DONE_H = 56
export const CRAB_W = 42
const BODY_RUN_H = 44
const BODY_DONE_H = 34
const CRAB_SPRITE_H = 29
const SWEEP_MS = 2400
const PULSE_MS = 1600

export const paneWidth = (bodyColumns: number): number => Math.max(240, Math.min(900, (bodyColumns || 40) * 8 - 8))
export const PLANNED_H = 46
export const COMPACT_H = 32

const CRAB_SCALE = 1.1
const VALUE_SIZE = 15
const TILE_H = 40
const TILE_GAP = 6
const TWO_ROWS_BELOW = 360
export const LIVE = '.live{animation:p 1.6s ease-in-out infinite}@keyframes p{50%{opacity:.3}}@media (prefers-reduced-motion: reduce){.live{animation:none}}'
const SEP = '\u0001'
const CACHE_LIMIT = 400
const HEADER_INK: readonly InkClass[] = ['t', 's', 'tile']
const ROW_INK: readonly InkClass[] = ['t', 's', 'm', 'k', 'ln', 'ok', 'no', 'er']
const PLANNED_INK: readonly InkClass[] = ['s', 'm', 'ln', 'id']
const COMPACT_INK: readonly InkClass[] = ['s']

export const TIER_EFFORT: Readonly<Record<Tier, string>> = {
  fable: 'high',
  heavy: 'xhigh',
  careful: 'high',
  medium: 'medium',
  light: 'low',
  other: '',
}

const cache = new Map<string, string>()

const remember = (key: string, value: string): string => {
  if (cache.size >= CACHE_LIMIT) cache.clear()
  cache.set(key, value)
  return value
}

export const svg = (W: number, H: number, css: string, body: string): string =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><style>${TEXT_CSS}${css}</style>${body}</svg>`

const liveClass = (tier: Tier): string => (tier === 'other' ? 's' : tierClass(tier))

const statusMark = (x: number, y: number, status: AgentStatus | 'planned', tier: Tier): string => {
  if (status === 'running') return `<circle class="live ${liveClass(tier)}" cx="${x}" cy="${y}" r="3.5"/>`
  if (status === 'done')
    return `<path class="ok" d="M${x - 5} ${y}l3.5 3.5 6.5-7" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>`
  if (status === 'failed')
    return `<path class="no" d="M${x - 4} ${y - 4}l8 8M${x + 4} ${y - 4}l-8 8" fill="none" stroke-width="1.8" stroke-linecap="round"/>`
  return (
    `<circle class="id" cx="${x}" cy="${y}" r="5" fill="none" stroke-width="1.4"/>` +
    `<path class="id" d="M${x} ${y - 2.5}v2.8l1.8 1.2" fill="none" stroke-width="1.4" stroke-linecap="round"/>`
  )
}

const tilesOf = (t: Totals, total: number | null): (readonly [string, string])[] => {
  const tiles: (readonly [string, string])[] = [
    [S.cost, '≈' + fmtCost(t.cost)],
    [S.tokens, fmtTokens(t.tokens)],
    [S.time, fmtTime(t.time)],
  ]
  if (total !== null) tiles.push([S.session, fmtUsd(total)])
  return tiles
}

const columnsOf = (W: number, count: number): number => (count > 3 && W < TWO_ROWS_BELOW ? 2 : count)

export const headerHeight = (W: number, title: string, total: number | null): number => {
  const count = total === null ? 3 : 4
  return (title ? 28 : 0) + Math.ceil(count / columnsOf(W, count)) * (TILE_H + TILE_GAP) - 2
}

const valueSize = (value: string, maxW: number): number =>
  Math.floor(Math.max(10, Math.min(VALUE_SIZE, (VALUE_SIZE * maxW) / Math.max(1, textWidth(value, VALUE_SIZE)))) * 2) / 2

export const totalsText = (t: Totals, total: number | null): string =>
  `≈${fmtCost(t.cost)} · ${fmtTokens(t.tokens)} · ${fmtTime(t.time)}` + (total === null ? '' : ` · ${S.sessionWord} ${fmtUsd(total)}`)

export const headerSvg = (W: number, title: string, t: Totals, total: number | null, lookId: Look): string => {
  const tiles = tilesOf(t, total)
  const cols = columnsOf(W, tiles.length)
  const tw = (W - TILE_GAP * (cols - 1)) / cols
  const top = title ? 28 : 0
  const tile = ([name, value]: readonly [string, string], i: number): string => {
    const x = (i % cols) * (tw + TILE_GAP)
    const y = top + Math.floor(i / cols) * (TILE_H + TILE_GAP)
    return (
      `<rect class="tile" x="${x}" y="${y}" width="${tw}" height="${TILE_H}" rx="8"/>` +
      `<text class="s" x="${x + 9}" y="${y + 16}" font-size="11">${xml(fitText(name, 11, tw - 18))}</text>` +
      `<text class="t" x="${x + 9}" y="${y + 33}" font-size="${valueSize(value, tw - 18)}" font-weight="600">${xml(value)}</text>`
    )
  }
  const head = title
    ? `<text class="t" x="0" y="15" font-size="14" font-weight="600">${xml(fitText(title, 14, W))}</text>`
    : ''
  return svg(W, headerHeight(W, title, total), paletteCss(paletteOf(lookId), HEADER_INK), head + tiles.map(tile).join(''))
}

export const rowHeightOf = (a: AgentRun): number => (a.status === 'running' ? ROW_H : DONE_H)

export const bodyHeightOf = (a: AgentRun): number => (a.status === 'running' ? BODY_RUN_H : BODY_DONE_H)

const phaseOf = (at: number, periodMs: number): string => ((at % periodMs) / 1000).toFixed(3)

const liveCss = (at: number): string =>
  `.live{animation:p ${PULSE_MS / 1000}s ease-in-out infinite;animation-delay:-${phaseOf(at, PULSE_MS)}s}@keyframes p{50%{opacity:.3}}` +
  '@media (prefers-reduced-motion: reduce){.live{animation:none}}'

const sweepCss = (from: number, to: number, at: number): string =>
  `.sl{animation:sl ${SWEEP_MS / 1000}s cubic-bezier(.45,0,.55,1) infinite;animation-delay:-${phaseOf(at, SWEEP_MS)}s}` +
  `@keyframes sl{from{transform:translateX(${from}px)}to{transform:translateX(${to}px)}}` +
  '@media (prefers-reduced-motion: reduce){.sl{animation:none}}'

const costumeTier = (costume: Costume): Tier => (costume === 'explore' ? 'other' : costume)

type Part = { svg: string; css: string }

const detailsOf = (x0: number, y0: number, textW: number, a: AgentRun, at: number, tier: Tier): Part => {
  const tc = tierClass(tier)
  const isRunning = a.status === 'running'
  const meta = [modelName(a.model), a.effort ?? '', a.round > 1 ? `${S.round} ${a.round}` : ''].filter(Boolean)
  const progress = isRunning ? progressOf(a) : null
  const stats = `${S.ctx} ${ctxOf(a)}% · ≈${fmtCost(a.costUsd)} · ${fmtTime(elapsedOf(a, at))}`
  const steps = showsSteps(a) ? `${a.stepDone ?? 0}/${a.stepTotal}${a.stepNote ? ' · ' + a.stepNote : ''}` : ''
  const stepsW = Math.max(0, textW - textWidth(stats, 11) - 12)
  const barY = y0 + 33
  const segW = Math.max(28, Math.round(textW * 0.24))
  const track = `<rect class="k" x="${x0}" y="${barY}" width="${textW}" height="4" rx="2"/>`
  const bar = !isRunning
    ? ''
    : progress === null
      ? track +
        `<clipPath id="tk"><rect x="${x0}" y="${barY}" width="${textW}" height="4" rx="2"/></clipPath>` +
        `<g clip-path="url(#tk)"><rect class="${liveClass(tier)} sl" x="${x0}" y="${barY}" width="${segW}" height="4" rx="2"/></g>`
      : track + `<rect class="${tc}" x="${x0}" y="${barY}" width="${Math.round(textW * progress)}" height="4" rx="2"/>`
  const svgText =
    `<text x="${x0}" y="${y0 + 12}" font-size="11"><tspan class="${tc}">${xml(tier === 'other' ? a.type : tier)}</tspan>` +
    `<tspan class="s"> · ${xml(meta.join(' · '))}</tspan>` +
    (a.status === 'failed' ? `<tspan class="er"> · ${S.failed}</tspan>` : '') +
    `</text>` +
    (steps && stepsW > 30 ? `<text class="t" x="${x0}" y="${y0 + 27}" font-size="11">${xml(fitText(steps, 11, stepsW))}</text>` : '') +
    `<text class="s" x="${x0 + textW}" y="${y0 + 27}" text-anchor="end" font-size="11">${xml(stats)}</text>` +
    bar
  const css = isRunning ? liveCss(at) + (progress === null ? sweepCss(-segW, textW, at) : '') : ''
  return { svg: svgText, css }
}

const runKey = (kind: string, W: number, a: AgentRun, at: number, lookId: Look): string =>
  [kind, lookId, W, a.id, a.status, a.type, a.description, a.model, a.effort, a.round, a.stepDone, a.stepTotal, a.stepNote]
    .concat([ctxOf(a), fmtCost(a.costUsd), fmtTime(elapsedOf(a, at)), progressOf(a) ?? '', a.status === 'running' ? at : ''])
    .join(SEP)

export const agentSvg = (W: number, a: AgentRun, at: number, lookId: Look): string => {
  const key = runKey('row', W, a, at, lookId)
  const hit = cache.get(key)
  if (hit !== undefined) return hit
  const tier = tierOf(a.type)
  const textW = W - CRAB_W - 22
  const isRunning = a.status === 'running'
  const H = rowHeightOf(a)
  const costume = costumeOf(a.type)
  const part = detailsOf(CRAB_W, 22, textW, a, at, tier)
  const css = paletteCss(paletteOf(lookId), ROW_INK, [tier, costumeTier(costume)]) + (isRunning ? crabCss([costume]) : '') + part.css
  const body =
    crab(0, isRunning ? 14 : 10, costume, false, isRunning, CRAB_SCALE) +
    `<text class="t" x="${CRAB_W}" y="18" font-size="13" font-weight="600">${xml(fitText(a.description || a.type, 13, textW))}</text>` +
    part.svg +
    statusMark(W - 8, 16, a.status, tier) +
    `<line class="ln" x1="0" y1="${H - 0.5}" x2="${W}" y2="${H - 0.5}"/>`
  return remember(key, svg(W, H, css, body))
}

export const rowCrabSvg = (a: AgentRun, lookId: Look): string => {
  const isRunning = a.status === 'running'
  const costume = costumeOf(a.type)
  const H = rowHeightOf(a)
  const key = ['crab', lookId, costume, isRunning, H].join(SEP)
  const hit = cache.get(key)
  if (hit !== undefined) return hit
  const css = paletteCss(paletteOf(lookId), [], [costumeTier(costume)]) + (isRunning ? crabCss([costume]) : '')
  return remember(key, svg(CRAB_W, H, css, crab(0, Math.round((H - CRAB_SPRITE_H) / 2) - 2, costume, false, isRunning, CRAB_SCALE)))
}

export const rowDetailsSvg = (W: number, a: AgentRun, at: number, lookId: Look): string => {
  const key = runKey('details', W, a, at, lookId)
  const hit = cache.get(key)
  if (hit !== undefined) return hit
  const tier = tierOf(a.type)
  const H = bodyHeightOf(a)
  const part = detailsOf(0, 0, W - 22, a, at, tier)
  const body = part.svg + statusMark(W - 8, 8, a.status, tier) + `<line class="ln" x1="0" y1="${H - 0.5}" x2="${W}" y2="${H - 0.5}"/>`
  return remember(key, svg(W, H, paletteCss(paletteOf(lookId), ROW_INK, [tier]) + part.css, body))
}

export const plannedSvg = (W: number, pl: Planned, lookId: Look): string => {
  const textW = W - 42 - 22
  const meta = [TIER_EFFORT[pl.tier] ? `${TIER_EFFORT[pl.tier]} ${S.effort}` : '']
  if (pl.after.length) meta.push(`${S.after} ${pl.after.join(', ')}`)
  const key = ['plan', lookId, W, pl.n, pl.title, pl.tier, meta.join(' ')].join(SEP)
  const hit = cache.get(key)
  if (hit !== undefined) return hit

  const body =
    crab(0, 6, pl.tier, true, false, CRAB_SCALE) +
    `<text class="s" x="42" y="18" font-size="13" font-weight="600">${xml(fitText(`${pl.n}. ${pl.title}`, 13, textW))}</text>` +
    `<text x="42" y="34" font-size="11"><tspan class="${tierClass(pl.tier)}">${xml(pl.tier)}</tspan>` +
    `<tspan class="m"> · ${xml(meta.filter(Boolean).join(' · '))}</tspan></text>` +
    statusMark(W - 8, 16, 'planned', pl.tier) +
    `<line class="ln" x1="0" y1="45.5" x2="${W}" y2="45.5"/>`
  return remember(key, svg(W, PLANNED_H, paletteCss(paletteOf(lookId), PLANNED_INK, [pl.tier]), body))
}

type Icon = { costume: Costume; tier: Tier; isRunning: boolean; isDim: boolean }

export const compactSvg = (
  W: number,
  list: readonly AgentRun[],
  planned: readonly Planned[],
  t: Totals,
  total: number | null,
  lookId: Look,
  at: number,
): string => {
  const summary = totalsText(t, total)
  const runIcon = (a: AgentRun): Icon => ({
    costume: costumeOf(a.type),
    tier: tierOf(a.type),
    isRunning: a.status === 'running',
    isDim: false,
  })
  const icons: Icon[] = [
    ...list.filter(a => a.status === 'running').map(runIcon),
    ...list.filter(a => a.status !== 'running').map(runIcon),
    ...planned.map(pl => ({ costume: pl.tier, tier: pl.tier, isRunning: false, isDim: true })),
  ]
  const fit = Math.max(1, Math.floor((W - textWidth(summary, 12) - 24) / 36))
  const shown = icons.slice(0, fit)
  const more = icons.length - shown.length
  const walking = shown.filter(ic => ic.isRunning)
  const css =
    paletteCss(
      paletteOf(lookId),
      COMPACT_INK,
      shown.map(ic => ic.tier),
    ) + (walking.length ? liveCss(at) + crabCss(walking.map(ic => ic.costume)) : '')
  const body = shown
    .map(
      (ic, i) =>
        crab(i * 36, 0, ic.costume, ic.isDim, ic.isRunning, CRAB_SCALE) +
        (ic.isRunning ? `<circle class="live ${liveClass(ic.tier)}" cx="${i * 36 + 32}" cy="4" r="3"/>` : ''),
    )
    .join('')
  const x = shown.length * 36 + (more ? 4 : 0)
  return svg(
    W,
    COMPACT_H,
    css,
    body +
      (more ? `<text class="s" x="${x}" y="21" font-size="12">+${more}</text>` : '') +
      `<text class="s" x="${W}" y="21" text-anchor="end" font-size="12">${xml(summary)}</text>`,
  )
}
