import type { AgentRun, AgentStatus, Look, Tier } from '../../types'

import { crab, crabCss, tierOfCostume } from './crab'
import type { SectionKey } from './panel'
import { fitText, fmtCost, fmtTokens, fmtUsd, textWidth, xml } from './format'
import { modelName } from './model'
import { inkCss, paletteOf, tierClass } from './palette'
import type { InkClass } from './palette'
import type { Costume, Planned, Totals } from './runs'
import { costumeOf, ctxOf, kindOf, progressOf, showsSteps, tierOf } from './runs'
import { S } from './strings'
import { failedPart, groupParts } from './workflows'
import type { Group } from './workflows'

const TEXT_CSS = "text{font-family:-apple-system,BlinkMacSystemFont,'SF Pro Text','Segoe UI',sans-serif;font-variant-numeric:tabular-nums}"

const MAX_PANE_W = 2400
export const ROW_H = 66
export const DONE_H = 56
export const CRAB_W = 42
const BODY_RUN_H = 44
const BODY_DONE_H = 34
const CRAB_SPRITE_H = 29
const PULSE_MS = 1600

export const paneWidth = (bodyColumns: number): number => Math.max(240, Math.min(MAX_PANE_W, (bodyColumns || 40) * 8 - 8))
export const PLANNED_H = 46
export const COMPACT_H = 32
const STRIP_ICON = 36
const STRIP_TEXT = 12
const STRIP_GAP = 16
const TEXT_ROOM = 1.15
export const GROUP_BODY_H = 34
export const GROUP_H = 56
export const RAIL_W = 24
const RAIL_X = 15
const BADGE = 24
const SEGMENT_H = 5
const SEGMENT_GAP = 2
const SEGMENT_MAX = 26
const SEGMENT_MIN = 3
const RAIL_OPACITY = '.45'
const FAN_OUT =
  '<circle cx="10.5" cy="12" r="2.6"/><rect x="12" y="11.2" width="4.4" height="1.6"/>' +
  '<rect x="15.6" y="6.2" width="1.6" height="11.6"/><rect x="16.4" y="6.2" width="3.6" height="1.6"/>' +
  '<rect x="16.4" y="16.2" width="3.6" height="1.6"/><circle cx="21.5" cy="7" r="2.6"/><circle cx="21.5" cy="17" r="2.6"/>'

const CRAB_SCALE = 1.1
const VALUE_SIZE = 15
const TILE_H = 40
const TILE_GAP = 6
const MIN_TILE = 86
const HOT_CONTEXT = 80
export const LIVE = '.live{animation:p 1.6s ease-in-out infinite}@keyframes p{50%{opacity:.3}}@media (prefers-reduced-motion: reduce){.live{animation:none}}'
const SEP = '\u0001'
const CACHE_LIMIT = 400
const HEADER_INK: readonly InkClass[] = ['t', 's', 'tile', 'er']
const ROW_INK: readonly InkClass[] = ['t', 's', 'm', 'k', 'ln', 'ok', 'no', 'er']
const PLANNED_INK: readonly InkClass[] = ['s', 'm', 'ln', 'id']
const COMPACT_INK: readonly InkClass[] = ['s']
const GROUP_INK: readonly InkClass[] = ['s', 'k', 'ok', 'no', 'er', 'go']
const SECTION_INK: readonly InkClass[] = ['ok', 'id']

export const SECTION_H = 22

const SECTION_ICON: Readonly<Record<SectionKey, string>> = {
  running: '<circle class="th" cx="16" cy="11" r="7" opacity=".22"/><circle class="th" cx="16" cy="11" r="3.6"/>',
  finished: '<path class="ok" d="M11.2 11.3l3.3 3.3 6.3-6.8" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
  planned:
    '<circle class="id" cx="16" cy="11" r="5.6" fill="none" stroke-width="1.5"/>' +
    '<path class="id" d="M16 8.2v3.1l2 1.3" fill="none" stroke-width="1.5" stroke-linecap="round"/>',
}

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

export const svg = (W: number, H: number, css: string, body: string): string => {
  const style = (body.includes('<text') ? TEXT_CSS : '') + css
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${style ? `<style>${style}</style>` : ''}${body}</svg>`
}

const ALL_TIERS: readonly Tier[] = ['fable', 'heavy', 'careful', 'medium', 'light', 'other']

const accentOf = (type: string, costume: Costume): Tier => {
  const tier = tierOf(type)
  return tier === 'other' ? tierOfCostume(costume) : tier
}

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

const tilesOf = (t: Totals, total: number | null, context: number | null): (readonly [string, string])[] => {
  const tiles: (readonly [string, string])[] = [
    [S.cost, '≈' + fmtUsd(t.cost)],
    [S.tokens, fmtTokens(t.tokens)],
  ]
  if (total !== null) tiles.push([S.session, fmtUsd(total)])
  if (context !== null) tiles.push([S.context, `${context}%`])
  return tiles
}

const columnsOf = (W: number, count: number): number => {
  const fits = Math.max(1, Math.floor((W + TILE_GAP) / (MIN_TILE + TILE_GAP)))
  return count <= fits ? count : Math.max(2, Math.min(fits, Math.ceil(count / 2)))
}

export const headerHeight = (W: number, title: string, total: number | null, context: number | null): number => {
  const count = 2 + (total === null ? 0 : 1) + (context === null ? 0 : 1)
  return (title ? 28 : 0) + Math.ceil(count / columnsOf(W, count)) * (TILE_H + TILE_GAP) - 2
}

const valueSize = (value: string, maxW: number): number =>
  Math.floor(Math.max(10, Math.min(VALUE_SIZE, (VALUE_SIZE * maxW) / Math.max(1, textWidth(value, VALUE_SIZE)))) * 2) / 2

const summariesOf = (t: Totals, total: number | null, context: number | null): string[] => {
  const cost = `≈${fmtUsd(t.cost)}`
  const session = total === null ? '' : `${S.sessionWord} ${fmtUsd(total)}`
  const ctx = context === null ? '' : `${S.contextWord} ${context}%`
  return [[cost, fmtTokens(t.tokens), session, ctx], [cost, session, ctx], [cost, ctx], [cost]].map(parts => parts.filter(Boolean).join(' · '))
}

const iconsFit = (room: number, count: number): number => {
  for (let fit = Math.min(count, Math.floor(room / STRIP_ICON)); fit > 0; fit -= 1) {
    const more = count - fit
    if (fit * STRIP_ICON + (more ? 4 + textWidth(`+${more}`, STRIP_TEXT) * TEXT_ROOM : 0) <= room) return fit
  }
  return 0
}

export const stripLayout = (W: number, count: number, summaries: readonly string[]): { summary: string; fit: number } => {
  let layout = { summary: '', fit: 0 }
  for (const summary of summaries) {
    layout = { summary, fit: iconsFit(W - textWidth(summary, STRIP_TEXT) * TEXT_ROOM - STRIP_GAP, count) }
    if (layout.fit >= Math.min(2, count)) return layout
  }
  return layout
}

export const headerSvg = (W: number, title: string, t: Totals, total: number | null, context: number | null, lookId: Look): string => {
  const tiles = tilesOf(t, total, context)
  const cols = columnsOf(W, tiles.length)
  const tw = (W - TILE_GAP * (cols - 1)) / cols
  const top = title ? 28 : 0
  const tile = ([name, value]: readonly [string, string], i: number): string => {
    const x = (i % cols) * (tw + TILE_GAP)
    const y = top + Math.floor(i / cols) * (TILE_H + TILE_GAP)
    return (
      `<rect class="tile" x="${x}" y="${y}" width="${tw}" height="${TILE_H}" rx="8"/>` +
      `<text class="s" x="${x + 9}" y="${y + 16}" font-size="11">${xml(fitText(name, 11, tw - 18))}</text>` +
      `<text class="${name === S.context && context !== null && context >= HOT_CONTEXT ? 'er' : 't'}" x="${x + 9}" y="${y + 33}" font-size="${valueSize(value, tw - 18)}" font-weight="600">${xml(value)}</text>`
    )
  }
  const head = title
    ? `<text class="t" x="0" y="15" font-size="14" font-weight="600">${xml(fitText(title, 14, W))}</text>`
    : ''
  const body = head + tiles.map(tile).join('')
  return svg(W, headerHeight(W, title, total, context), inkCss(paletteOf(lookId), body, HEADER_INK), body)
}

const hasBar = (a: AgentRun): boolean => a.status === 'running' && progressOf(a) !== null

export const rowHeightOf = (a: AgentRun): number => (hasBar(a) ? ROW_H : DONE_H)

export const bodyHeightOf = (a: AgentRun): number => (hasBar(a) ? BODY_RUN_H : BODY_DONE_H)

const phaseOf = (at: number, periodMs: number): string => ((at % periodMs) / 1000).toFixed(3)

const liveCss = (at: number): string =>
  `.live{animation:p ${PULSE_MS / 1000}s ease-in-out infinite;animation-delay:-${phaseOf(at, PULSE_MS)}s}@keyframes p{50%{opacity:.3}}` +
  '@media (prefers-reduced-motion: reduce){.live{animation:none}}'

type Part = { svg: string; css: string }

const detailsOf = (x0: number, y0: number, textW: number, a: AgentRun, at: number, tier: Tier): Part => {
  const tc = tierClass(tier)
  const isRunning = a.status === 'running'
  const meta = [modelName(a.model), a.effort ?? '', a.round > 1 ? `${S.round} ${a.round}` : ''].filter(Boolean)
  const progress = isRunning ? progressOf(a) : null
  const stats = `${S.ctx} ${ctxOf(a)}% · ≈${fmtCost(a.costUsd)}`
  const steps = showsSteps(a) ? `${a.stepDone ?? 0}/${a.stepTotal}${a.stepNote ? ' · ' + a.stepNote : ''}` : ''
  const stepsW = Math.max(0, textW - textWidth(stats, 11) - 12)
  const barY = y0 + 33
  const bar =
    progress === null
      ? ''
      : `<rect class="k" x="${x0}" y="${barY}" width="${textW}" height="4" rx="2"/>` +
        `<rect class="${tc}" x="${x0}" y="${barY}" width="${Math.round(textW * progress)}" height="4" rx="2"/>`
  const kind = kindOf(a)
  const lead = kind ? `<tspan class="${tc}">${xml(kind)}</tspan><tspan class="s"> · ` : '<tspan class="s">'
  const svgText =
    `<text x="${x0}" y="${y0 + 12}" font-size="11">${lead}${xml(meta.join(' · '))}</tspan>` +
    (a.status === 'failed' ? `<tspan class="er"> · ${S.failed}</tspan>` : '') +
    `</text>` +
    (steps && stepsW > 30 ? `<text class="t" x="${x0}" y="${y0 + 27}" font-size="11">${xml(fitText(steps, 11, stepsW))}</text>` : '') +
    `<text class="s" x="${x0 + textW}" y="${y0 + 27}" text-anchor="end" font-size="11">${xml(stats)}</text>` +
    bar
  const css = isRunning ? liveCss(at) : ''
  return { svg: svgText, css }
}

const runKey = (kind: string, W: number, a: AgentRun, lookId: Look): string =>
  [kind, lookId, W, a.id, a.status, a.type, a.description, a.model, a.costume, a.effort, a.round, a.stepDone, a.stepTotal, a.stepNote]
    .concat([ctxOf(a), fmtCost(a.costUsd), progressOf(a) ?? '', kindOf(a)])
    .join(SEP)

export const rowCrabSvg = (a: AgentRun, lookId: Look): string => {
  const isRunning = a.status === 'running'
  const costume = costumeOf(a.type, a.model, a.id, a.costume)
  const H = rowHeightOf(a)
  const accent = accentOf(a.type, costume)
  const key = ['crab', lookId, costume, accent, isRunning, H].join(SEP)
  const hit = cache.get(key)
  if (hit !== undefined) return hit
  const body = crab(0, Math.round((H - CRAB_SPRITE_H) / 2) - 2, costume, false, isRunning, CRAB_SCALE, accent)
  return remember(key, svg(CRAB_W, H, inkCss(paletteOf(lookId), body, [], ALL_TIERS) + (isRunning ? crabCss([costume]) : ''), body))
}

export const rowDetailsSvg = (W: number, a: AgentRun, at: number, lookId: Look): string => {
  const key = runKey('details', W, a, lookId)
  const hit = cache.get(key)
  if (hit !== undefined) return hit
  const tier = tierOf(a.type)
  const H = bodyHeightOf(a)
  const part = detailsOf(0, 0, W - 22, a, at, tier)
  const body = part.svg + statusMark(W - 8, 8, a.status, tier) + `<line class="ln" x1="0" y1="${H - 0.5}" x2="${W}" y2="${H - 0.5}"/>`
  return remember(key, svg(W, H, inkCss(paletteOf(lookId), body, ROW_INK, ALL_TIERS) + part.css, body))
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
  return remember(key, svg(W, PLANNED_H, inkCss(paletteOf(lookId), body, PLANNED_INK, ALL_TIERS), body))
}

type Icon = { costume: Costume; tier: Tier; accent: Tier; isRunning: boolean; isDim: boolean }

export const compactSvg = (
  W: number,
  list: readonly AgentRun[],
  planned: readonly Planned[],
  t: Totals,
  total: number | null,
  context: number | null,
  lookId: Look,
  at: number,
): string => {
  const runIcon = (a: AgentRun): Icon => {
    const costume = costumeOf(a.type, a.model, a.id, a.costume)
    return { costume, tier: tierOf(a.type), accent: accentOf(a.type, costume), isRunning: a.status === 'running', isDim: false }
  }
  const icons: Icon[] = [
    ...list.filter(a => a.status === 'running').map(runIcon),
    ...list.filter(a => a.status !== 'running').map(runIcon),
    ...planned.map(pl => ({ costume: pl.tier, tier: pl.tier, accent: pl.tier, isRunning: false, isDim: true })),
  ]
  const { summary, fit } = stripLayout(W, icons.length, summariesOf(t, total, context))
  const shown = icons.slice(0, fit)
  const more = icons.length - shown.length
  const walking = shown.filter(ic => ic.isRunning)
  const body = shown
    .map(
      (ic, i) =>
        crab(i * STRIP_ICON, 0, ic.costume, ic.isDim, ic.isRunning, CRAB_SCALE, ic.accent) +
        (ic.isRunning ? `<circle class="live ${liveClass(ic.tier)}" cx="${i * STRIP_ICON + 32}" cy="4" r="3"/>` : ''),
    )
    .join('')
  const x = shown.length * STRIP_ICON + 4
  const full =
    body +
    (more && fit ? `<text class="s" x="${x}" y="21" font-size="${STRIP_TEXT}">+${more}</text>` : '') +
    `<text class="s" x="${W}" y="21" text-anchor="end" font-size="${STRIP_TEXT}">${xml(summary)}</text>`
  const css = inkCss(paletteOf(lookId), full, COMPACT_INK, ALL_TIERS) + (walking.length ? liveCss(at) + crabCss(walking.map(ic => ic.costume)) : '')
  return svg(W, COMPACT_H, css, full)
}

const r1 = (n: number): number => Math.round(n * 10) / 10

const segmentClass = (status: AgentStatus, tc: string): string =>
  status === 'done' ? 'go' : status === 'failed' ? 'er' : `live ${tc}`

const STRIP_ORDER: readonly AgentStatus[] = ['done', 'failed', 'running']

const stripOf = (W: number, y: number, statuses: readonly AgentStatus[], tc: string): string => {
  const n = statuses.length
  if (!n || W < 12) return ''
  const each = Math.min(SEGMENT_MAX, (W - SEGMENT_GAP * (n - 1)) / n)
  if (each >= SEGMENT_MIN) {
    const rx = r1(Math.min(SEGMENT_H / 2, each / 2))
    return statuses
      .map((s, i) => `<rect class="${segmentClass(s, tc)}" x="${r1(i * (each + SEGMENT_GAP))}" y="${y}" width="${r1(each)}" height="${SEGMENT_H}" rx="${rx}"/>`)
      .join('')
  }
  let x = 0
  const parts = STRIP_ORDER.map(s => {
    const w = (W * statuses.filter(t => t === s).length) / n
    const part = w > 0 ? `<rect class="${segmentClass(s, tc)}" x="${r1(x)}" y="${y}" width="${r1(w)}" height="${SEGMENT_H}"/>` : ''
    x += w
    return part
  }).join('')
  return (
    `<clipPath id="strip"><rect x="0" y="${y}" width="${r1(W)}" height="${SEGMENT_H}" rx="${SEGMENT_H / 2}"/></clipPath>` +
    `<g clip-path="url(#strip)"><rect class="k" x="0" y="${y}" width="${r1(W)}" height="${SEGMENT_H}"/>${parts}</g>`
  )
}

export const sectionIconSvg = (key: SectionKey, lookId: Look): string => {
  const cacheKey = ['section', lookId, key].join(SEP)
  const hit = cache.get(cacheKey)
  if (hit !== undefined) return hit
  const body = SECTION_ICON[key]
  return remember(cacheKey, svg(CRAB_W, SECTION_H, inkCss(paletteOf(lookId), body, SECTION_INK, ALL_TIERS), body))
}

export const groupIconSvg = (tone: Tier, hasRail: boolean, lookId: Look): string => {
  const key = ['group-icon', lookId, tone, hasRail].join(SEP)
  const hit = cache.get(key)
  if (hit !== undefined) return hit
  const tc = tierClass(tone)
  const body =
    `<rect class="${tc}" x="4" y="0" width="${BADGE}" height="${BADGE}" rx="7" opacity=".16"/>` +
    `<g class="${tc}">${FAN_OUT}</g>` +
    (hasRail ? `<rect class="${tc}" x="${RAIL_X}" y="${BADGE + 5}" width="2" height="${GROUP_H - BADGE - 5}" opacity="${RAIL_OPACITY}"/>` : '')
  return remember(key, svg(CRAB_W, GROUP_H, inkCss(paletteOf(lookId), body, [], ALL_TIERS), body))
}

export const groupBodySvg = (W: number, g: Group, at: number, lookId: Look): string => {
  const statuses = g.runs.map(a => a.status)
  const cost = `≈${fmtCost(g.cost)}`
  const key = ['group', lookId, W, g.tone, g.status, cost, statuses.join(',')].join(SEP)
  const hit = cache.get(key)
  if (hit !== undefined) return hit
  const tc = tierClass(g.tone)
  const textW = W - 22
  const counts = groupParts(g).join(' · ')
  const failed = failedPart(g)
  const full = `${S.workflowWord} · ${counts}${failed ? ` · ${failed}` : ''}`
  const line =
    textWidth(full, 11) <= textW
      ? `<tspan class="${tc}">${S.workflowWord}</tspan><tspan class="s"> · ${xml(counts)}</tspan>` +
        (failed ? `<tspan class="er"> · ${xml(failed)}</tspan>` : '')
      : `<tspan class="s">${xml(fitText(full, 11, textW))}</tspan>`
  const body =
    `<text x="0" y="12" font-size="11">${line}</text>` +
    stripOf(Math.max(0, textW - textWidth(cost, 11) - 12), 22, statuses, tc) +
    `<text class="s" x="${textW}" y="27" text-anchor="end" font-size="11">${xml(cost)}</text>` +
    statusMark(W - 8, 8, g.status, g.tone)
  const css = inkCss(paletteOf(lookId), body, GROUP_INK, ALL_TIERS) + (g.status === 'running' ? liveCss(at) : '')
  return remember(key, svg(W, GROUP_BODY_H, css, body))
}

export const railOf = (rows: readonly AgentRun[]): { height: number; end: number } => {
  const height = rows.reduce((h, a) => h + rowHeightOf(a), 0)
  const last = rows.at(-1)
  return { height, end: last ? r1(height - rowHeightOf(last) / 2 - 1.5) : 0 }
}

export const railSvg = (height: number, end: number, tone: Tier, lookId: Look): string => {
  const key = ['rail', lookId, height, end, tone].join(SEP)
  const hit = cache.get(key)
  if (hit !== undefined) return hit
  const body = `<path class="${tierClass(tone)}" opacity="${RAIL_OPACITY}" d="M${RAIL_X} 0h2v${r1(end - 1)}a1 1 0 0 1-2 0z"/>`
  return remember(key, svg(RAIL_W, height, inkCss(paletteOf(lookId), body, [], ALL_TIERS), body))
}
