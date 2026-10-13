import type { Flow, Look } from '../../types'

import { MIN_TICK_GAP } from './consts'
import { crab, crabCss } from './crab'
import { label, ratio } from './flow'
import { fitText, textWidth, xml } from './format'
import { paletteCss, paletteOf } from './palette'
import type { InkClass } from './palette'

export const BAND_H = 22
export const TEXT_CSS = "text{font-family:-apple-system,BlinkMacSystemFont,'SF Pro Text','Segoe UI',sans-serif;font-variant-numeric:tabular-nums}"

const BAR_H = 16
const BAND_INK: readonly InkClass[] = ['t', 's', 'k', 'tk', 'ac', 'dn', 'pa', 'pd']
const CRAB_W = 26
const CELL = 3

const noise = (x: number, y: number): number => {
  const s = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453
  return s - Math.floor(s)
}

const twinkleCss = (isFinished: boolean): string =>
  `.w0,.w1,.w2,.w3{animation:tw ${isFinished ? 3.2 : 2.2}s ease-in-out infinite}` +
  `.w1{animation-duration:${isFinished ? 3.8 : 2.8}s;animation-delay:-.7s}` +
  `.w2{animation-duration:${isFinished ? 4.4 : 1.9}s;animation-delay:-1.3s}` +
  `.w3{animation-duration:${isFinished ? 3.5 : 3.3}s;animation-delay:-.4s}` +
  `@keyframes tw{0%,100%{opacity:1}50%{opacity:${isFinished ? 0.8 : 0.3}}}` +
  '@media (prefers-reduced-motion: reduce){.w0,.w1,.w2,.w3{animation:none}}'

const groups = (): string[][] => [[], [], [], []]

const paths = (sets: readonly string[][]): string =>
  sets.map((segs, i) => (segs.length ? `<path class="w${i}" d="${segs.join('')}"/>` : '')).join('')

let lastKey = ''
let lastSvg = ''

export const bandSvg = (f: Flow, workers: number, W: number, isWorking: boolean, lookId: Look): string => {
  const key = `${lookId}|${W}|${isWorking}|${workers}|${f.title}|${f.total}|${f.done}|${f.phase}|${f.isFinished}`
  if (key === lastKey) return lastSvg

  const title = fitText(f.title, 13, Math.max(60, W * 0.4))
  const barX = Math.round(16 + textWidth(title, 13) + 12)
  const barW = Math.max(60, W - barX - 46 - CRAB_W)
  const fill = f.isFinished ? 'dn' : 'ac'
  const onFill = f.isFinished ? 'pd' : 'pa'
  const y0 = (BAND_H - BAR_H) / 2
  const fillW = Math.round(barW * ratio(f))
  const runW = f.total ? Math.round((barW * Math.min(f.total, f.done + workers)) / f.total) : 0
  const rows = Math.floor(BAR_H / CELL)

  const dense = groups()
  const cols = Math.floor(fillW / CELL)
  for (let c = 0; c < cols; c += 1) {
    const density = 0.35 + 0.6 * Math.pow(c / Math.max(1, cols), 1.2)
    for (let r = 0; r < rows; r += 1) {
      if (noise(c, r) < density) dense[Math.floor(noise(r, c) * 4)]?.push(`M${c * CELL + 1} ${r * CELL + 1}h2v2h-2z`)
    }
  }

  const faint = groups()
  const faintCols = Math.floor(runW / CELL)
  for (let c = cols; c < faintCols; c += 1) {
    for (let r = 0; r < rows; r += 1) {
      if (noise(c + 7, r + 3) < 0.2) faint[Math.floor(noise(r + 5, c) * 4)]?.push(`M${c * CELL + 1} ${r * CELL + 1}h1.7v1.7h-1.7z`)
    }
  }

  const ticks: string[] = []
  if (f.total > 1 && barW / f.total >= MIN_TICK_GAP) {
    for (let i = 1; i < f.total; i += 1) {
      const x = Math.round((barW * i) / f.total)
      if (x > fillW + 4) ticks.push(`M${x} ${BAR_H / 2 - 4}h1.5v8h-1.5z`)
    }
  }

  const text = label(f, workers)
  const pillW = Math.round(18 + text.length * 6.6)
  const pillX = Math.max(0, Math.min(barW - pillW, fillW - pillW))
  const percent = `${Math.round(ratio(f) * 100)}%`
  const css = TEXT_CSS + paletteCss(paletteOf(lookId), BAND_INK) + twinkleCss(f.isFinished) + crabCss(isWorking ? ['other'] : [])

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${BAND_H}" viewBox="0 0 ${W} ${BAND_H}"><style>${css}</style>` +
    `<defs><clipPath id="c"><rect width="${barW}" height="${BAR_H}" rx="${BAR_H / 2}"/></clipPath></defs>` +
    `<circle class="${fill}" cx="5" cy="${BAND_H / 2}" r="4"/>` +
    `<text class="t" x="16" y="${BAND_H / 2 + 4.5}" font-size="13" font-weight="500">${xml(title)}</text>` +
    `<g transform="translate(${barX},${y0})"><rect class="k" width="${barW}" height="${BAR_H}" rx="${BAR_H / 2}"/>` +
    `<g clip-path="url(#c)"><g class="${fill}">${paths(dense)}</g><g class="${fill}" opacity="0.45">${paths(faint)}</g>` +
    (ticks.length ? `<path class="tk" d="${ticks.join('')}"/>` : '') +
    `</g><rect class="${fill}" x="${pillX}" width="${pillW}" height="${BAR_H}" rx="${BAR_H / 2}"/>` +
    `<text class="${onFill}" x="${pillX + pillW / 2}" y="${BAR_H / 2 + 4}" text-anchor="middle" font-size="11" font-weight="600">${xml(text)}</text></g>` +
    `<text class="s" x="${W - CRAB_W - 6}" y="${BAND_H / 2 + 4.5}" text-anchor="end" font-size="12.5">${percent}</text>` +
    crab(W - CRAB_W + 1, 0, 'other', false, isWorking, 0.8) +
    '</svg>'

  lastKey = key
  lastSvg = svg
  return svg
}
