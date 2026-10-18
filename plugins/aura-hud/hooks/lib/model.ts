export type Usage = {
  input_tokens?: number
  output_tokens?: number
  cache_read_input_tokens?: number
  cache_creation_input_tokens?: number
}

type Rates = readonly [input: number, output: number, cacheRead: number, cacheWrite: number]

type Version = { family: string; major: number; minor: number }

const VERSION = /(fable|mythos|opus|sonnet|haiku)-(\d+)(?:-(\d{1,2})(?!\d))?/i

const versionOf = (model: string): Version | null => {
  const m = VERSION.exec(model)
  if (!m) return null
  return { family: (m[1] ?? '').toLowerCase(), major: Number(m[2]), minor: Number(m[3] ?? 0) }
}

const atLeast = (v: Version, major: number, minor = 0): boolean => v.major > major || (v.major === major && v.minor >= minor)

const DEFAULT_RATES: Rates = [4, 20, 0.2, 5]
const HAIKU_LONG_PROMPT = 100_000

export const ratesOf = (model: string, promptTokens = 0): Rates => {
  const v = versionOf(model)
  if (!v) return DEFAULT_RATES
  switch (v.family) {
    case 'fable':
    case 'mythos':
      return atLeast(v, 5, 1) ? [10, 50, 0.25, 12.5] : [10, 50, 1, 12.5]
    case 'opus':
      return atLeast(v, 5, 5) ? [4, 20, 0.2, 5] : [5, 25, 0.5, 6.25]
    case 'sonnet':
      return atLeast(v, 5) ? [2, 10, 0.2, 2.5] : [3, 15, 0.3, 3.75]
    case 'haiku':
      if (!atLeast(v, 5, 5)) return [1, 5, 0.1, 1.25]
      return promptTokens > HAIKU_LONG_PROMPT ? [0.5, 2.5, 0.05, 0.625] : [0.1, 0.5, 0.01, 0.125]
    default:
      return DEFAULT_RATES
  }
}

const promptOf = (u: Usage): number =>
  (u.input_tokens || 0) + (u.cache_read_input_tokens || 0) + (u.cache_creation_input_tokens || 0)

export const sumUsage = (u: Usage): number => promptOf(u) + (u.output_tokens || 0)

export const costOf = (model: string, u: Usage): number => {
  const [input, output, cacheRead, cacheWrite] = ratesOf(model, promptOf(u))
  return (
    ((u.input_tokens || 0) * input +
      (u.output_tokens || 0) * output +
      (u.cache_read_input_tokens || 0) * cacheRead +
      (u.cache_creation_input_tokens || 0) * cacheWrite) /
    1e6
  )
}

export const windowOf = (model: string): number => {
  if (/\[1m\]/i.test(model)) return 1_000_000
  const v = versionOf(model)
  if (!v) return 1_000_000
  if (v.family === 'haiku') return atLeast(v, 5) ? 1_000_000 : 200_000
  if (v.family === 'fable' || v.family === 'mythos') return 1_000_000
  return atLeast(v, 4, 6) ? 1_000_000 : 200_000
}

export type ContextFill = { percent?: number; window: number; breakdown?: { totalTokens: number } }

export const wholePercent = (n: number): number | null => (Number.isFinite(n) ? Math.max(0, Math.min(100, Math.round(n))) : null)

export const contextPercentOf = (c: ContextFill): number | null => {
  if (typeof c.percent === 'number') return wholePercent(c.percent)
  return c.breakdown && c.window > 0 ? wholePercent((c.breakdown.totalTokens / c.window) * 100) : null
}

export const modelName = (id: string): string => {
  const v = versionOf(id)
  if (!v) return id.replace(/^claude-/, '').replace(/\[.*\]$/, '') || '—'
  const family = v.family.charAt(0).toUpperCase() + v.family.slice(1)
  return `${family} ${v.major}${v.minor ? '.' + v.minor : ''}`
}
