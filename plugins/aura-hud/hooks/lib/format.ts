const XML: Readonly<Record<string, string>> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }

export const xml = (s: string): string => s.replace(/[&<>"]/g, c => XML[c] ?? c)

export const fmtTokens = (n: number): string =>
  n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${Math.round(n / 1e3)}k` : `${Math.round(n)}`

export const fmtCost = (usd: number): string => `$${usd < 10 ? usd.toFixed(2) : usd.toFixed(1)}`

export const fmtUsd = (usd: number): string => `$${usd.toFixed(2)}`

export const fmtTime = (ms: number): string => {
  const s = Math.max(0, Math.round(ms / 1000))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const ss = String(s % 60).padStart(2, '0')
  return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`
}

const NARROW = /[\s.,:;'|!il1()[\]]/
const WIDE = /[A-ZА-ЯЁmwшщжюМШЩЖЮ@%]/
const ELLIPSIS_EM = 0.56

const charEm = (ch: string): number => (NARROW.test(ch) ? 0.3 : WIDE.test(ch) ? 0.72 : 0.56)

export const textWidth = (s: string, size: number): number => {
  let em = 0
  for (const ch of s) em += charEm(ch)
  return em * size
}

export const fitText = (s: string, size: number, maxW: number): string => {
  const limit = maxW / size
  let em = 0
  let cut = 0
  let at = 0
  for (const ch of s) {
    const next = em + charEm(ch)
    if (next > limit) return s.slice(0, cut) + '…'
    if (next + ELLIPSIS_EM <= limit) cut = at + ch.length
    em = next
    at += ch.length
  }
  return s
}

const MONO_EM = 0.62

export const fitMono = (s: string, size: number, maxW: number): string => {
  const fits = Math.floor(maxW / (size * MONO_EM))
  const chars = [...s]
  if (chars.length <= fits) return s
  return fits < 2 ? '…' : chars.slice(0, fits - 1).join('') + '…'
}

export const textBar = (ratio: number, width: number): string => {
  const filled = Math.max(0, Math.min(width, Math.round(width * ratio)))
  return '█'.repeat(filled) + '░'.repeat(width - filled)
}

export const capText = (v: unknown, max: number): string => {
  if (typeof v !== 'string') return ''
  const s = v.trim()
  return s.length <= max ? s : [...s].slice(0, max).join('').trim()
}

export const intIn = (v: unknown, lo: number, hi: number): number | undefined =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, Math.round(v))) : undefined

export const norm = (s: string): string => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim()
