import type { Look, Tier } from '../../types'

import { LIVE, svg } from './draw-pane'
import { capText, fitMono, fitText, textWidth, xml } from './format'
import type { ToolItem } from './history'
import { inkCss, paletteOf, tierClass } from './palette'
import type { InkClass } from './palette'

const ROW = 24
const LINE = 16
const NAME_SIZE = 12.5
const TEXT_SIZE = 12.5
const CODE_SIZE = 12
const SMALL_SIZE = 11.5
const META_SIZE = 11
const MAX_NAME_W = 70
const WIDE_NAME_W = 160
const RAIL_X = 6
const EDGE = 6
const NAME_X = 18
const MONO = ".mono{font-family:ui-monospace,'SF Mono',SFMono-Regular,Menlo,monospace}"
const TOOL_INK: readonly InkClass[] = ['t', 's', 'm', 'ln', 'er', 'go']
const MAX_ALT = 600

const memo = new WeakMap<readonly ToolItem[], Map<string, string>>()

const extraLines = (it: ToolItem): number => (it.detail ? 1 : 0) + (it.outcome ? 1 : 0) + (it.error ? 1 : 0)

const rowHeight = (it: ToolItem): number => ROW + extraLines(it) * LINE

export const toolsHeight = (items: readonly ToolItem[]): number => items.reduce((h, it) => h + rowHeight(it), 0) + 4

const sizeOf = (it: ToolItem): string => (it.plus || it.minus ? `+${it.plus} −${it.minus}` : '')

export const toolsAlt = (items: readonly ToolItem[]): string =>
  capText(
    items
      .map(it =>
        [
          `${it.tool} ${it.title}`,
          it.detail,
          it.outcome ? `result ${it.outcome}` : '',
          sizeOf(it),
          it.meta,
          it.count > 1 ? `×${it.count}` : '',
          it.state === 'error' ? `error: ${it.error}` : '',
        ]
          .filter(Boolean)
          .join(', '),
      )
      .join('; '),
    MAX_ALT,
  )

const dotOf = (it: ToolItem, mid: number, tier: Tier): string => {
  if (it.state === 'running') return `<circle class="live ${tierClass(tier)}" cx="${RAIL_X}" cy="${mid}" r="3.5"/>`
  if (it.state === 'error') return `<circle class="er" cx="${RAIL_X}" cy="${mid}" r="3.5"/>`
  return `<circle class="m" cx="${RAIL_X}" cy="${mid}" r="2.5"/>`
}

const rightOf = (it: ToolItem, W: number, y: number): { svg: string; width: number } => {
  const parts: string[] = []
  const words: string[] = []
  if (it.plus || it.minus) {
    parts.push(`<tspan class="go">+${it.plus}</tspan> <tspan class="er">−${it.minus}</tspan>`)
    words.push(`+${it.plus} −${it.minus}`)
  }
  if (it.meta) {
    parts.push(`<tspan class="m">${xml(it.meta)}</tspan>`)
    words.push(it.meta)
  }
  if (it.count > 1) {
    parts.push(`<tspan class="m">×${it.count}</tspan>`)
    words.push(`×${it.count}`)
  }
  if (!parts.length) return { svg: '', width: 0 }
  const text = words.join('  ·  ')
  return {
    svg: `<text x="${W}" y="${y}" text-anchor="end" font-size="${META_SIZE}">${parts.join('<tspan class="m">  ·  </tspan>')}</text>`,
    width: textWidth(text, META_SIZE) + 10,
  }
}

const fitLine = (text: string, isCode: boolean, size: number, width: number): string =>
  isCode ? fitMono(text, size, width) : fitText(text, size, width)

export const toolsSvg = (W: number, items: readonly ToolItem[], tier: Tier, lookId: Look): string => {
  const key = [W, tier, lookId].join('|')
  const hit = memo.get(items)?.get(key)
  if (hit !== undefined) return hit

  const nameW = Math.min(MAX_NAME_W, Math.max(0, ...items.map(it => textWidth(it.tool, NAME_SIZE))))
  const columnX = NAME_X + nameW + 10
  const H = toolsHeight(items)
  let y = 2
  const rows = items.map(it => {
    const mid = y + ROW / 2
    const ownNameW = Math.min(WIDE_NAME_W, textWidth(it.tool, NAME_SIZE))
    const x = Math.max(columnX, NAME_X + ownNameW + 10)
    const right = rightOf(it, W, mid + 4)
    const titleW = W - x - right.width - EDGE
    const lines: string[] = []
    let lineY = y + ROW + 9
    const addLine = (text: string, cls: string, isCode: boolean) => {
      lines.push(
        `<text class="${cls}${isCode ? ' mono' : ''}" x="${x}" y="${lineY}" font-size="${SMALL_SIZE}">${xml(fitLine(text, isCode, SMALL_SIZE, W - x - EDGE))}</text>`,
      )
      lineY += LINE
    }
    if (it.detail) addLine(it.detail, 'm', true)
    if (it.outcome) addLine(`↳ ${it.outcome}`, 's', true)
    if (it.error) addLine(it.error, 'er', false)
    const titleClass = it.isCode ? 's mono' : 't'
    const titleSize = it.isCode ? CODE_SIZE : TEXT_SIZE
    const row =
      dotOf(it, mid, tier) +
      `<text class="${it.state === 'error' ? 'er' : 't'}" x="${NAME_X}" y="${mid + 4.5}" font-size="${NAME_SIZE}" font-weight="600">${xml(fitText(it.tool, NAME_SIZE, ownNameW))}</text>` +
      (it.title
        ? `<text class="${titleClass}" x="${x}" y="${mid + 4}" font-size="${titleSize}">${xml(fitLine(it.title, it.isCode, titleSize, titleW))}</text>`
        : '') +
      right.svg +
      lines.join('')
    y += rowHeight(it)
    return row
  })
  const body = `<line class="ln" x1="${RAIL_X}" y1="0" x2="${RAIL_X}" y2="${H}"/>` + rows.join('')
  const css = inkCss(paletteOf(lookId), body, TOOL_INK, [tier]) + (body.includes(' mono') ? MONO : '') + (items.some(it => it.state === 'running') ? LIVE : '')
  const out = svg(W, H, css, body)
  const byKey = memo.get(items) ?? new Map<string, string>()
  byKey.set(key, out)
  memo.set(items, byKey)
  return out
}
