import type { Tier } from '../../types'

import { tierClass } from './palette'
import type { Costume } from './runs'

const CLAY = '#d97757'
const INK = '#1f1e1d'
const TIER = 'tier'

type Fill = (x: number, y: number, w: number, h: number, color: string, group?: string) => void
type Draw = (f: Fill) => void

const stamp = (
  f: Fill,
  x: number,
  y: number,
  rows: readonly string[],
  map: Readonly<Record<string, string>>,
  group?: string,
): void => {
  rows.forEach((row, dy) => {
    let start = 0
    while (start < row.length) {
      const ch = row[start] ?? ''
      let end = start + 1
      while (end < row.length && row[end] === ch) end += 1
      const color = map[ch]
      if (color) f(x + start, y + dy, end - start, 1, color, group)
      start = end
    }
  })
}

const crabBody = (f: Fill, armFront = 0, armGroup?: string): void => {
  f(7, 10, 16, 12, CLAY)
  f(3, 14, 4, 4, CLAY)
  f(23, 14 + armFront, 4, 4, CLAY, armGroup)
  f(9, 12, 2, 2, INK)
  f(19, 12, 2, 2, INK)
  f(7, 22, 2, 4, CLAY, 'la')
  f(17, 22, 2, 4, CLAY, 'la')
  f(11, 22, 2, 4, CLAY, 'lb')
  f(21, 22, 2, 4, CLAY, 'lb')
}

const COSTUMES = new Map<Costume, Draw>([
  [
    'fable',
    f => {
      crabBody(f)
      f(6, 7, 18, 1, '#e6e8ee')
      f(5, 8, 1, 14, '#e6e8ee')
      f(24, 8, 1, 14, '#e6e8ee')
      f(6, 22, 18, 1, '#c9ccd2')
      f(6, 8, 18, 14, 'rgba(169,214,245,.32)')
      f(8, 9, 2, 1, '#fff')
      f(8, 10, 1, 2, '#fff')
      f(14, 4, 2, 3, '#c9ccd2')
      f(14, 2, 2, 2, TIER, 'ant')
      f(13, 18, 4, 2, TIER)
      f(27, 3, 1, 3, '#f5c542', 'star')
      f(26, 4, 3, 1, '#f5c542', 'star')
    },
  ],
  [
    'heavy',
    f => {
      crabBody(f, -4, 'it')
      stamp(
        f,
        6,
        3,
        ['......bbbbbb......', '....bbcbbcbbbb....', '...bbbbbbbbbbbb...', '..bcbbcbbcbbcbbb..', '.bbbbbbbbbbbbbbbb.', 'dddddddddddddddddd'],
        { b: '#7a4a26', c: '#a0703f', d: '#5a3519' },
      )
      f(6, 9, 18, 1, TIER)
      stamp(f, 23, 1, ['.kkk.', 'k...k', 'k...k', 'k...k', '.kkk.'], { k: '#3a3a3c' }, 'it')
      f(24, 2, 3, 3, 'rgba(169,214,245,.7)', 'it')
      f(25, 6, 1, 4, '#7a4a26', 'it')
      f(24, 2, 1, 1, '#fff', 'gl')
    },
  ],
  [
    'careful',
    f => {
      crabBody(f)
      stamp(
        f,
        6,
        4,
        ['.....yyyyyyyy.....', '...yyyyyhhyyyyy...', '..yyyyyyhhyyyyyy..', '..yyyyyyhhyyyyyy..', '.yyyyyyyhhyyyyyyy.', 'dddddddddddddddddd'],
        { y: '#f5c542', h: '#fbe08a', d: '#c99a1e' },
      )
      f(13, 5, 4, 2, TIER)
      stamp(f, 0, 10, ['.s.s', 'sss.', '.s..', '.s..'], { s: '#8e929a' }, 'it')
    },
  ],
  [
    'medium',
    f => {
      crabBody(f, -4, 'pan')
      stamp(
        f,
        6,
        0,
        [
          '........lll.......',
          '.......lllll......',
          '.wwwwgwwwwwwgwwwww',
          'wwwwwwwwwwwwwwwwww',
          'wwwwwwwwwwwwwwwwww',
          'wwwwwgwwwwwggwwwww',
          '.wwwwgwwwwwggwwwww',
          '.dddbbbbbbbbbbbbb.',
          '.dddbbbbbbbbbbbbb.',
          '.dddbbbbbbbbbbbbb.',
        ],
        { w: '#f4f3ee', l: '#f7f6f2', g: '#d2d1c8', b: TIER, d: '#b45f43' },
      )
      f(22, 8, 7, 2, '#4a4a48', 'pan')
      f(26, 10, 1, 1, '#4a4a48', 'pan')
      f(24, 7, 3, 1, '#f5b731', 'egg')
    },
  ],
  [
    'light',
    f => {
      crabBody(f, -4)
      stamp(
        f,
        6,
        5,
        ['....rrrrrrrrrr....', '..rrrrrrwwrrrrrr..', '.rrrrrrrwwrrrrrrr.', '.rrrrrrrwwrrrrrrr.', '.rrrrrrrwwrrrrrrr.', '.kkkkkkkkkkkkkkkkr'],
        { r: TIER, w: '#f8f6f1', k: INK },
      )
      f(25, 1, 1, 9, '#8e929a')
      stamp(f, 26, 1, ['wkwk', 'kwkw', 'wkwk'], { w: '#f8f6f1', k: INK }, 'flag')
    },
  ],
  [
    'explore',
    f => {
      crabBody(f)
      stamp(
        f,
        5,
        3,
        ['.kk..............kk.', '.kkk....kkkk....kkk.', '..kkkkkkkwwkkkkkkk..', '..kkkkkkkkkkkkkkkk..', '.gggggggggggggggggg.'],
        { k: '#55514c', w: '#f8f6f1', g: '#f5c542' },
      )
      f(7, 11, 11, 1, INK)
      f(18, 11, 4, 3, INK)
      f(27, 6, 1, 9, '#c9ccd2', 'it')
      f(26, 15, 3, 1, '#7a4a26', 'it')
    },
  ],
])

const tierOfCostume = (costume: Costume): Tier => (costume === 'explore' ? 'other' : costume)

type Layer = Map<string, string[]>

const innerCache = new Map<Costume, string>()

const innerOf = (costume: Costume): string => {
  const hit = innerCache.get(costume)
  if (hit !== undefined) return hit
  const groups = new Map<string, Layer>([['bd', new Map()]])
  const f: Fill = (x, y, w, h, color, group = 'bd') => {
    const layer = groups.get(group) ?? new Map<string, string[]>()
    groups.set(group, layer)
    const segs = layer.get(color) ?? []
    layer.set(color, segs)
    segs.push(`M${x} ${y}h${w}v${h}h${-w}z`)
  }
  const draw = COSTUMES.get(costume) ?? crabBody
  draw(f)
  const tier = tierClass(tierOfCostume(costume))
  const paint = (name: string): string =>
    [...(groups.get(name) ?? new Map<string, string[]>())]
      .map(([color, segs]) => `<path ${color === TIER ? `class="${tier}"` : `fill="${color}"`} d="${segs.join('')}"/>`)
      .join('')
  const group = (name: string): string => `<g class="${name}">${paint(name)}</g>`
  const props = [...groups.keys()].filter(k => k !== 'bd' && k !== 'la' && k !== 'lb')
  const inner = `<g class="bd">${paint('bd')}${props.map(group).join('')}</g>${group('la')}${group('lb')}`
  innerCache.set(costume, inner)
  return inner
}

export const crab = (x: number, y: number, costume: Costume, isDim: boolean, isWalking: boolean, scale: number): string =>
  `<g transform="translate(${x},${y}) scale(${scale})"${isDim ? ' opacity="0.45"' : ''} shape-rendering="crispEdges">` +
  `<g class="c-${costume}${isWalking ? ' run' : ''}">${innerOf(costume)}</g></g>`

const WALK =
  '.run .la{animation:st .5s steps(1) infinite}.run .lb{animation:st .5s steps(1) infinite -.25s}' +
  '.run .bd{animation:bob .5s steps(1) infinite -.125s}.run g{transform-box:fill-box}' +
  '@keyframes st{50%{transform:translateY(-1px)}}@keyframes bob{50%{transform:translateY(1px)}}'

const BLINK = '@keyframes blink{50%{opacity:.15}}'

const REDUCED = '@media (prefers-reduced-motion: reduce){.run,.run g{animation:none!important}}'

const PROPS: Readonly<Record<Costume, string>> = {
  fable:
    '.c-fable.run{animation:float 1s ease-in-out infinite}' +
    '.c-fable.run .la,.c-fable.run .lb,.c-fable.run .bd{animation:none}' +
    '.c-fable.run .ant{animation:blink 1s steps(1) infinite}.c-fable.run .star{animation:blink .5s steps(1) infinite -.25s}' +
    '@keyframes float{50%{transform:translateY(-2px)}}',
  heavy:
    '.c-heavy.run .it{animation:scan 1s steps(1) infinite}.c-heavy.run .gl{animation:blink 1s steps(1) infinite -.5s}' +
    '@keyframes scan{25%{transform:translate(-1px,1px)}50%{transform:translate(-2px,2px)}75%{transform:translate(-1px,1px)}}',
  careful:
    '.c-careful.run .it{transform-origin:100% 100%;animation:twist .5s ease-in-out infinite}' +
    '@keyframes twist{50%{transform:rotate(-35deg)}}',
  medium:
    '.c-medium.run .pan{transform-origin:0 50%;animation:tilt 1s ease-in-out infinite}' +
    '.c-medium.run .egg{animation:flip 1s ease-in-out infinite}' +
    '@keyframes tilt{20%,40%{transform:rotate(-12deg)}}@keyframes flip{30%{transform:translateY(-5px) scaleY(-1)}60%{transform:translateY(0)}}',
  light:
    '.c-light.run .la{animation-duration:.25s}.c-light.run .lb{animation-duration:.25s;animation-delay:-.125s}' +
    '.c-light.run .flag{transform-origin:0 50%;animation:wave .25s steps(1) infinite}' +
    '@keyframes wave{50%{transform:skewY(-12deg) scaleX(.85)}}',
  explore:
    '.c-explore.run .it{transform-origin:50% 100%;animation:fence .5s ease-in-out infinite}' +
    '@keyframes fence{50%{transform:rotate(25deg)}}',
  other: '',
}

export const crabCss = (walking: Iterable<Costume>): string => {
  const kinds = new Set(walking)
  if (!kinds.size) return ''
  const blink = kinds.has('fable') || kinds.has('heavy') ? BLINK : ''
  return WALK + [...kinds].map(c => PROPS[c]).join('') + blink + REDUCED
}
