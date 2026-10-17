import type { Look, Tier } from '../../types'

import { LIVE, svg } from './draw-pane'
import { capText, fitMono, fitText, textWidth, xml } from './format'
import type { ToolItem } from './history'
import { paletteCss, paletteOf, tierClass } from './palette'
import type { InkClass } from './palette'

const ROW = 24
const ERROR_ROW = 16
const NAME_SIZE = 12.5
const WHAT_SIZE = 12
const COUNT_SIZE = 11
const MAX_NAME_W = 110
const RAIL_X = 6
const EDGE = 6
const NAME_X = 18
const MONO = ".mono{font-family:ui-monospace,'SF Mono',SFMono-Regular,Menlo,monospace}"
const TOOL_INK: readonly InkClass[] = ['t', 's', 'm', 'ln', 'er']
const MAX_ALT = 600

const memo = new WeakMap<readonly ToolItem[], Map<string, string>>()

const rowHeight = (it: ToolItem): number => ROW + (it.error ? ERROR_ROW : 0)

export const toolsHeight = (items: readonly ToolItem[]): number => items.reduce((h, it) => h + rowHeight(it), 0) + 4

export const toolsAlt = (items: readonly ToolItem[]): string =>
  capText(
    items
      .map(it => `${it.tool} ${it.what}${it.count > 1 ? ` ×${it.count}` : ''}${it.state === 'error' ? `, error: ${it.error}` : ''}`)
      .join('; '),
    MAX_ALT,
  )

const dotOf = (it: ToolItem, mid: number, tier: Tier): string => {
  if (it.state === 'running') return `<circle class="live ${tierClass(tier)}" cx="${RAIL_X}" cy="${mid}" r="3.5"/>`
  if (it.state === 'error') return `<circle class="er" cx="${RAIL_X}" cy="${mid}" r="3.5"/>`
  return `<circle class="m" cx="${RAIL_X}" cy="${mid}" r="2.5"/>`
}

export const toolsSvg = (W: number, items: readonly ToolItem[], tier: Tier, lookId: Look): string => {
  const key = [W, tier, lookId].join('|')
  const hit = memo.get(items)?.get(key)
  if (hit !== undefined) return hit

  const nameW = Math.min(MAX_NAME_W, Math.max(0, ...items.map(it => textWidth(it.tool, NAME_SIZE))))
  const whatX = NAME_X + nameW + 10
  const H = toolsHeight(items)
  let y = 2
  const rows = items.map(it => {
    const mid = y + ROW / 2
    const count = it.count > 1 ? `×${it.count}` : ''
    const countW = count ? textWidth(count, COUNT_SIZE) + 8 : 0
    const row =
      dotOf(it, mid, tier) +
      `<text class="${it.state === 'error' ? 'er' : 't'}" x="${NAME_X}" y="${mid + 4.5}" font-size="${NAME_SIZE}" font-weight="600">${xml(fitText(it.tool, NAME_SIZE, nameW))}</text>` +
      (it.what
        ? `<text class="s mono" x="${whatX}" y="${mid + 4}" font-size="${WHAT_SIZE}">${xml(fitMono(it.what, WHAT_SIZE, W - whatX - countW - EDGE))}</text>`
        : '') +
      (count ? `<text class="m" x="${W}" y="${mid + 4}" text-anchor="end" font-size="${COUNT_SIZE}">${count}</text>` : '') +
      (it.error
        ? `<text class="er" x="${whatX}" y="${y + ROW + 9}" font-size="11.5">${xml(fitText(it.error, 11.5, W - whatX))}</text>`
        : '')
    y += rowHeight(it)
    return row
  })
  const css = paletteCss(paletteOf(lookId), TOOL_INK, [tier]) + MONO + (items.some(it => it.state === 'running') ? LIVE : '')
  const rail = `<line class="ln" x1="${RAIL_X}" y1="0" x2="${RAIL_X}" y2="${H}"/>`
  const out = svg(W, H, css, rail + rows.join(''))
  const byKey = memo.get(items) ?? new Map<string, string>()
  byKey.set(key, out)
  memo.set(items, byKey)
  return out
}
