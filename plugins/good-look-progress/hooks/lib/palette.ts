import type { Look, LookSetting, Tier } from '../../types'

type Ink = {
  text: string
  sub: string
  muted: string
  track: string
  line: string
  tile: string
  tick: string
  accent: string
  done: string
  ok: string
  fail: string
  idle: string
  tiers: Readonly<Record<Tier, string>>
}

export type Palette = { id: Look; name: string; light: Ink; dark: Ink }

const CLAUDE_TIERS = {
  fable: '#7f77dd',
  heavy: '#d85a30',
  careful: '#ba7517',
  medium: '#378add',
  light: '#1d9e75',
  other: '#888780',
} as const

const CLAUDE: Palette = {
  id: 'claude',
  name: 'Claude',
  light: {
    text: '#1f1f1f',
    sub: '#6b6b68',
    muted: '#9a9a96',
    track: '#ecebe8',
    line: '#e4e4e1',
    tile: '#f4f3f0',
    tick: '#b4b4b0',
    accent: '#8f8cf4',
    done: '#5fbf8f',
    ok: '#3b9c5f',
    fail: '#d0453f',
    idle: '#9a9a96',
    tiers: CLAUDE_TIERS,
  },
  dark: {
    text: '#ececec',
    sub: '#a8a8a4',
    muted: '#7d7d79',
    track: '#2c2c2b',
    line: '#333331',
    tile: '#262625',
    tick: '#5a5a5a',
    accent: '#8f8cf4',
    done: '#5fbf8f',
    ok: '#3b9c5f',
    fail: '#d0453f',
    idle: '#9a9a96',
    tiers: CLAUDE_TIERS,
  },
}

const CHATGPT: Palette = {
  id: 'chatgpt',
  name: 'ChatGPT Dark',
  light: {
    text: '#0d0d0d',
    sub: '#5d5d5d',
    muted: '#8f8f8f',
    track: '#e3e3e3',
    line: '#ececec',
    tile: '#f9f9f9',
    tick: '#b4b4b4',
    accent: '#0d0d0d',
    done: '#10a37f',
    ok: '#10a37f',
    fail: '#e02e2a',
    idle: '#8f8f8f',
    tiers: {
      fable: '#8a3ffc',
      heavy: '#d9582b',
      careful: '#b58200',
      medium: '#0285ff',
      light: '#0f8a6b',
      other: '#8f8f8f',
    },
  },
  dark: {
    text: '#ececec',
    sub: '#b4b4b4',
    muted: '#8f8f8f',
    track: '#424242',
    line: '#303030',
    tile: '#2f2f2f',
    tick: '#676767',
    accent: '#ececec',
    done: '#10a37f',
    ok: '#10a37f',
    fail: '#f87171',
    idle: '#8f8f8f',
    tiers: {
      fable: '#ab68ff',
      heavy: '#ff9e6c',
      careful: '#f5c542',
      medium: '#339cff',
      light: '#10a37f',
      other: '#8f8f8f',
    },
  },
}

const WEBSTORM: Palette = {
  id: 'webstorm',
  name: 'WebStorm Islands Dark',
  light: {
    text: '#1e1f22',
    sub: '#6c707e',
    muted: '#8c8f9a',
    track: '#ebecf0',
    line: '#dfe1e5',
    tile: '#f7f8fa',
    tick: '#c9ccd6',
    accent: '#3574f0',
    done: '#208a3c',
    ok: '#208a3c',
    fail: '#db3b4b',
    idle: '#8c8f9a',
    tiers: {
      fable: '#871094',
      heavy: '#b0532c',
      careful: '#9e880d',
      medium: '#00627a',
      light: '#067d17',
      other: '#8c8c8c',
    },
  },
  dark: {
    text: '#d1d3d9',
    sub: '#8c8f97',
    muted: '#73767c',
    track: '#26282c',
    line: '#33353b',
    tile: '#26282c',
    tick: '#4b5059',
    accent: '#3871e1',
    done: '#6aab73',
    ok: '#6aab73',
    fail: '#f75464',
    idle: '#73767c',
    tiers: {
      fable: '#c77dbb',
      heavy: '#cf8e6d',
      careful: '#d5b778',
      medium: '#56a8f5',
      light: '#6aab73',
      other: '#7a7e85',
    },
  },
}

const PALETTES: Readonly<Record<Look, Palette>> = { claude: CLAUDE, chatgpt: CHATGPT, webstorm: WEBSTORM }

const LOOK_SETTINGS: readonly LookSetting[] = ['auto', 'claude', 'chatgpt', 'webstorm']

export const THEME_PREFIX = 'custom:good-look-themes:'

export const THEME_OF: Readonly<Record<'chatgpt' | 'webstorm', string>> = {
  chatgpt: `${THEME_PREFIX}chatgpt-dark`,
  webstorm: `${THEME_PREFIX}webstorm-islands-dark`,
}

export const isLookSetting = (v: string): v is LookSetting => (LOOK_SETTINGS as readonly string[]).includes(v)

export const paletteOf = (id: Look): Palette => PALETTES[id]

export const lookOfTheme = (theme: unknown): Look => {
  if (typeof theme !== 'string') return 'claude'
  if (/chatgpt/i.test(theme)) return 'chatgpt'
  if (/webstorm|islands/i.test(theme)) return 'webstorm'
  return 'claude'
}

const TIER_CLASS: Readonly<Record<Tier, string>> = {
  fable: 'tf',
  heavy: 'th',
  careful: 'tc',
  medium: 'tm',
  light: 'tl',
  other: 'to',
}

export const tierClass = (tier: Tier): string => TIER_CLASS[tier]

const channel = (v: number): number => {
  const c = v / 255
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}

const luminance = (hex: string): number => {
  const n = parseInt(hex.slice(1, 7), 16)
  return 0.2126 * channel(n >> 16) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255)
}

export const onColor = (hex: string): string => {
  const l = luminance(hex)
  const onWhite = 1.05 / (l + 0.05)
  return onWhite >= 4.5 || onWhite >= (l + 0.05) / 0.05 ? '#ffffff' : '#141413'
}

const INK_RULES = {
  t: (i: Ink) => `.t{fill:${i.text}}`,
  s: (i: Ink) => `.s{fill:${i.sub}}`,
  m: (i: Ink) => `.m{fill:${i.muted}}`,
  k: (i: Ink) => `.k{fill:${i.track}}`,
  ln: (i: Ink) => `.ln{stroke:${i.line}}`,
  tile: (i: Ink) => `.tile{fill:${i.tile}}`,
  tk: (i: Ink) => `.tk{fill:${i.tick}}`,
  ac: (i: Ink) => `.ac{fill:${i.accent}}`,
  dn: (i: Ink) => `.dn{fill:${i.done}}`,
  pa: (i: Ink) => `.pa{fill:${onColor(i.accent)}}`,
  pd: (i: Ink) => `.pd{fill:${onColor(i.done)}}`,
  ok: (i: Ink) => `.ok{stroke:${i.ok}}`,
  no: (i: Ink) => `.no{stroke:${i.fail}}`,
  id: (i: Ink) => `.id{stroke:${i.idle}}`,
} as const

export type InkClass = keyof typeof INK_RULES

const rules = (ink: Ink, classes: readonly InkClass[], tiers: readonly Tier[]): string =>
  classes.map(c => INK_RULES[c](ink)).join('') + tiers.map(t => `.${TIER_CLASS[t]}{fill:${ink.tiers[t]}}`).join('')

const cssCache = new Map<string, string>()

export const paletteCss = (p: Palette, classes: readonly InkClass[], tiers: readonly Tier[] = []): string => {
  const used = [...new Set(tiers)].sort()
  const key = `${p.id}|${classes.join(',')}|${used.join(',')}`
  const hit = cssCache.get(key)
  if (hit !== undefined) return hit
  const css = rules(p.light, classes, used) + `@media (prefers-color-scheme: dark){${rules(p.dark, classes, used)}}`
  cssCache.set(key, css)
  return css
}

export const tierHex = (p: Palette, tier: Tier): string => p.dark.tiers[tier]
