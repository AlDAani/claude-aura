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
export const OPEN_W = 26

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
const ROW_INK: readonly InkClass[] = ['t', 's', 'm', 'k', 'ln', 'ok', 'no']
const PLANNED_INK: readonly InkClass[] = ['s', 'm', 'ln', 'id']
const COMPACT_INK: readonly InkClass[] = ['s']

export const TIER_MODEL: Readonly<Record<Tier, string>> = {
  fable: 'Fable · high',
  heavy: 'Opus · xhigh',
  careful: 'Opus · high',
  medium: 'Opus · medium',
  light: 'Opus · low',
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

const statusMark = (x: number, y: number, status: AgentStatus | 'planned', tier: Tier): string => {
  if (status === 'running') return `<circle class="live ${tierClass(tier)}" cx="${x}" cy="${y}" r="3.5"/>`
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

export const agentSvg = (W: number, a: AgentRun, at: number, lookId: Look): string => {
  const tier = tierOf(a.type)
  const ctx = ctxOf(a)
  const textW = W - 42 - 22
  const meta = [a.effort ? `${modelName(a.model)} · ${a.effort}` : modelName(a.model)]
  if (a.round > 1) meta.push(`${S.round} ${a.round}`)
  if (a.status === 'failed') meta.push(S.failed)
  const progress = progressOf(a)
  const stats = `${S.ctx} ${ctx}% · ${fmtTokens(a.contextTokens)}  ≈${fmtCost(a.costUsd)}  ${fmtTime(elapsedOf(a, at))}`
  const steps = showsSteps(a) ? `${a.stepDone ?? 0}/${a.stepTotal}${a.stepNote ? ' · ' + a.stepNote : ''}` : ''
  const fillW = Math.round(textW * (progress ?? ctx / 100))
  const key = ['row', lookId, W, a.id, a.status, a.type, a.description, meta.join(' '), stats, steps, fillW, progress === null].join(SEP)
  const hit = cache.get(key)
  if (hit !== undefined) return hit

  const tc = tierClass(tier)
  const costume = costumeOf(a.type)
  const isRunning = a.status === 'running'
  const stepsW = Math.max(0, textW - textWidth(stats, 11) - 12)
  const css = paletteCss(paletteOf(lookId), ROW_INK, [tier]) + (isRunning ? LIVE + crabCss([costume]) : '')
  const body =
    crab(0, 14, costume, false, isRunning, CRAB_SCALE) +
    `<text class="t" x="42" y="18" font-size="13" font-weight="600">${xml(fitText(a.description || a.type, 13, textW))}</text>` +
    `<text x="42" y="34" font-size="11"><tspan class="${tc}">${xml(tier === 'other' ? a.type : tier)}</tspan>` +
    `<tspan class="s">  ${xml(meta.join('  ·  '))}</tspan></text>` +
    (steps && stepsW > 30
      ? `<text class="t" x="42" y="49" font-size="11">${xml(fitText(steps, 11, stepsW))}</text>`
      : '') +
    `<text class="s" x="${42 + textW}" y="49" text-anchor="end" font-size="11">${xml(stats)}</text>` +
    `<rect class="k" x="42" y="55" width="${textW}" height="4" rx="2"/>` +
    `<rect class="${progress === null ? 'm' : tc}" x="42" y="55" width="${fillW}" height="4" rx="2"/>` +
    statusMark(W - 8, 16, a.status, tier) +
    `<line class="ln" x1="0" y1="65.5" x2="${W}" y2="65.5"/>`
  return remember(key, svg(W, ROW_H, css, body))
}

export const plannedSvg = (W: number, pl: Planned, lookId: Look): string => {
  const textW = W - 42 - 22
  const meta = [TIER_MODEL[pl.tier]]
  if (pl.after.length) meta.push(`${S.after} ${pl.after.join(', ')}`)
  const key = ['plan', lookId, W, pl.n, pl.title, pl.tier, meta.join(' ')].join(SEP)
  const hit = cache.get(key)
  if (hit !== undefined) return hit

  const body =
    crab(0, 6, pl.tier, true, false, CRAB_SCALE) +
    `<text class="s" x="42" y="18" font-size="13" font-weight="600">${xml(fitText(`${pl.n}. ${pl.title}`, 13, textW))}</text>` +
    `<text x="42" y="34" font-size="11"><tspan class="${tierClass(pl.tier)}">${xml(pl.tier)}</tspan>` +
    `<tspan class="m">  ${xml(meta.filter(Boolean).join('  ·  '))}</tspan></text>` +
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
    ) + (walking.length ? LIVE + crabCss(walking.map(ic => ic.costume)) : '')
  const body = shown
    .map(
      (ic, i) =>
        crab(i * 36, 0, ic.costume, ic.isDim, ic.isRunning, CRAB_SCALE) +
        (ic.isRunning ? `<circle class="live ${tierClass(ic.tier)}" cx="${i * 36 + 32}" cy="4" r="3"/>` : ''),
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
