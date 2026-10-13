import { describe, expect, test } from 'claude-code/testing'

import type { AgentRun } from '../types'

import { agentSvg } from '../hooks/lib/draw-pane'
import { blank, label, merge, readProgress, readStep } from '../hooks/lib/flow'
import { fitText, textWidth } from '../hooks/lib/format'
import { ratesOf, windowOf } from '../hooks/lib/model'
import { lookOfTheme, paletteCss, paletteOf } from '../hooks/lib/palette'
import { costumeOf, crewOf, tierOf } from '../hooks/lib/runs'
import { plural } from '../hooks/lib/strings'

const run = (over: Partial<AgentRun>): AgentRun => ({
  id: 'a1',
  agentId: 'a1',
  type: 'aura-flow:aura-careful',
  description: 'Fix the thing',
  model: 'claude-opus-5-5',
  status: 'running',
  startedAt: 0,
  contextTokens: 12_000,
  contextMax: 1_000_000,
  tokens: 50_000,
  costUsd: 0.42,
  steps: 3,
  round: 1,
  ...over,
})

describe('prices and context windows', () => {
  test('current models carry the current rates', () => {
    expect(ratesOf('claude-opus-5-5')).toEqual([4, 20, 0.2, 5])
    expect(ratesOf('claude-fable-5-1')).toEqual([10, 50, 0.25, 12.5])
    expect(ratesOf('claude-sonnet-5-5')).toEqual([2, 10, 0.2, 2.5])
    expect(ratesOf('claude-sonnet-4-6')).toEqual([3, 15, 0.3, 3.75])
    expect(ratesOf('claude-haiku-4-5-20251001')).toEqual([1, 5, 0.1, 1.25])
  })

  test('Haiku 5.5 bills long prompts at the higher tier', () => {
    expect(ratesOf('claude-haiku-5-5', 20_000)[0]).toBe(0.1)
    expect(ratesOf('claude-haiku-5-5', 150_000)[0]).toBe(0.5)
  })

  test('windows follow the model generation', () => {
    expect(windowOf('claude-haiku-5-5')).toBe(1_000_000)
    expect(windowOf('claude-haiku-4-5')).toBe(200_000)
    expect(windowOf('claude-sonnet-4-5')).toBe(200_000)
    expect(windowOf('claude-sonnet-4-5[1m]')).toBe(1_000_000)
    expect(windowOf('claude-opus-4-6')).toBe(1_000_000)
    expect(windowOf('claude-fable-5-1')).toBe(1_000_000)
  })
})

describe('model input is checked', () => {
  test('totals, tasks and titles are capped', () => {
    const input = readProgress({
      title: '  Big job  ',
      total: 1e9,
      done: -4,
      tasks: Array.from({ length: 80 }, (_, i) => ({ title: `Task ${i}`, tier: 'light' })),
    })
    expect(input.title).toBe('Big job')
    expect(input.total).toBe(50)
    expect(input.done).toBe(0)
    expect(input.tasks).toHaveLength(50)
  })

  test('malformed fields are dropped instead of throwing', () => {
    const input = readProgress({
      title: 42,
      phase: 'nope',
      tasks: [{ title: 7 }, { title: 'Real', tier: '__proto__', after: 'x' }, null, { title: 'Next', tier: 'constructor', after: [1, 1.4, -3, 99] }],
    })
    expect(input.title).toBeUndefined()
    expect(input.phase).toBeUndefined()
    expect(input.tasks).toEqual([
      { title: 'Real', tier: 'other', after: [] },
      { title: 'Next', tier: 'other', after: [1, 50] },
    ])
    expect(readStep({ done: 'two', total: 0, note: 5 })).toEqual({ total: 1 })
  })

  test('a non-object event reads as empty', () => {
    expect(readProgress(undefined)).toEqual({})
    expect(readStep(null)).toEqual({})
  })

  test('merge keeps done within total and a new title starts over', () => {
    const first = merge(null, { title: 'One', total: 3, done: 9 })
    expect(first.done).toBe(3)
    const second = merge(first, { title: 'Two' })
    expect(second.total).toBe(0)
    expect(second.title).toBe('Two')
  })
})

describe('labels and crew', () => {
  test('workers in flight show when no total is known', () => {
    expect(label({ ...blank(), phase: 'delegate' }, 2)).toBe('Tasks 2 running')
    expect(label({ ...blank(), phase: 'delegate', total: 4, done: 1 }, 2)).toBe('Tasks 1/4')
  })

  test('only aura workers count as workers', () => {
    const list = [run({}), run({ id: 'b', agentId: 'b', type: 'Explore' }), run({ id: 'c', agentId: 'c', status: 'done' })]
    expect(crewOf(list)).toEqual({ running: 2, workers: 1 })
  })

  test('tiers resolve without trusting prototype keys', () => {
    expect(tierOf('aura-flow:aura-careful')).toBe('careful')
    expect(tierOf('aura-fable')).toBe('fable')
    expect(tierOf('aura-__proto__')).toBe('other')
    expect(tierOf('constructor')).toBe('other')
    expect(costumeOf('Explore')).toBe('explore')
  })

  test('English plurals', () => {
    expect(plural(1, 'agent', 'agents')).toBe('agent')
    expect(plural(2, 'agent', 'agents')).toBe('agents')
  })
})

describe('drawing', () => {
  test('agent rows are small and cached', () => {
    const a = run({ status: 'done', endedAt: 5_000 })
    const first = agentSvg(600, a, 9_000, 'chatgpt')
    expect(first.length).toBeLessThan(6_000)
    expect(agentSvg(600, a, 12_000, 'chatgpt')).toBe(first)
  })

  test('a finished run drops its last step report, a failed one keeps it', () => {
    const reported = { stepDone: 4, stepTotal: 6, stepNote: 'Run verify', endedAt: 5_000 }
    expect(agentSvg(600, run({ ...reported, status: 'done' }), 9_000, 'claude')).not.toContain('4/6')
    expect(agentSvg(600, run({ ...reported, status: 'failed' }), 9_000, 'claude')).toContain('4/6 · Run verify')
    expect(agentSvg(600, run({ ...reported, status: 'running', endedAt: undefined }), 9_000, 'claude')).toContain('4/6 · Run verify')
  })

  test('a still crab carries no animation css', () => {
    expect(agentSvg(600, run({ status: 'done', endedAt: 5_000 }), 9_000, 'claude')).not.toContain('@keyframes st')
    expect(agentSvg(600, run({}), 9_000, 'claude')).toContain('@keyframes st')
  })

  test('fitText cuts to the width with an ellipsis', () => {
    expect(fitText('short', 13, 400)).toBe('short')
    const cut = fitText('a'.repeat(200), 13, 120)
    expect(cut.endsWith('…')).toBe(true)
    expect(textWidth(cut, 13)).toBeLessThanOrEqual(120)
  })
})

describe('palettes', () => {
  test('css holds both modes and only the tiers asked for', () => {
    const css = paletteCss(paletteOf('webstorm'), ['t'], ['medium'])
    expect(css).toContain('@media (prefers-color-scheme: dark)')
    expect(css).toContain('.tm{fill:#56a8f5}')
    expect(css).not.toContain('.tf{')
  })

  test('the Claude Code theme picks the look', () => {
    expect(lookOfTheme('custom:aura-themes:chatgpt-dark')).toBe('chatgpt')
    expect(lookOfTheme('custom:aura-themes:webstorm-islands-dark')).toBe('webstorm')
    expect(lookOfTheme('dark')).toBe('claude')
    expect(lookOfTheme(undefined)).toBe('claude')
  })
})
