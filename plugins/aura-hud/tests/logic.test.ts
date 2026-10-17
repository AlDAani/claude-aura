import { describe, expect, test } from 'claude-code/testing'

import type { SessionMessage } from 'claude-code'

import type { AgentRun } from '../types'

import { importedCostumes } from '../hooks/lib/generated-costumes'
import { agentSvg, compactSvg, DONE_H, headerHeight, headerSvg, plannedSvg, ROW_H, rowCrabSvg, rowDetailsSvg, rowHeightOf } from '../hooks/lib/draw-pane'
import { blank, label, merge, readProgress, readStep } from '../hooks/lib/flow'
import { fitText, textWidth } from '../hooks/lib/format'
import { toolsHeight, toolsSvg } from '../hooks/lib/draw-history'
import { historyOf, toolName } from '../hooks/lib/history'
import type { ToolItem } from '../hooks/lib/history'
import { ratesOf, windowOf } from '../hooks/lib/model'
import { lookOfTheme, paletteCss, paletteOf } from '../hooks/lib/palette'
import { addRun, costumeOf, crewOf, newCostumeOf, tierOf } from '../hooks/lib/runs'
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

  test('a known model picks one costume once, while an unknown model stays plain', () => {
    expect(newCostumeOf('aura-heavy', 'claude-fable-5-1', () => 0)).toBe('fable-wizard')
    expect(newCostumeOf('aura-heavy', 'claude-haiku-5-5', () => 0.999)).toBe('haiku-pilot')
    expect(newCostumeOf('aura-heavy', 'gpt-6.1-sol', () => 0)).toBe('other')
    expect(costumeOf('aura-heavy', 'gpt-6.1-sol', 'a1')).toBe('other')
    const [spawned] = addRun([], { description: 'Draw icons', subagentType: 'aura-heavy', tool_use_id: 't1' }, { agentId: 'a1', model: 'claude-opus-5-5' }, 0)
    expect(spawned?.costume).toMatch(/^opus-/)
    expect(costumeOf(spawned?.type ?? '', spawned?.model, spawned?.id, spawned?.costume)).toBe(spawned?.costume)
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

  test('imported art uses safe runtime bounds and keeps the canonical crab plus its tier CSS', () => {
    expect(Object.keys(importedCostumes)).toHaveLength(26)
    for (const art of Object.values(importedCostumes)) {
      let accents = 0
      for (const [color, runs] of art) {
        for (const run of runs.split(' ')) {
          const [x = 0, y = 0, width = 0] = run.split(',').map(Number)
          expect(x).toBeGreaterThanOrEqual(0)
          expect(x + width).toBeLessThanOrEqual(31)
          expect(y).toBeGreaterThanOrEqual(0)
          expect(y).toBeLessThanOrEqual(21)
          if (color === '#00ffff') accents += width
        }
      }
      expect(accents).toBeGreaterThanOrEqual(2)
      expect(accents).toBeLessThanOrEqual(12)
    }
    const icon = rowCrabSvg(run({ model: 'claude-fable-5-1', costume: 'fable-wizard' }), 'claude')
    expect(icon).toContain('M7 10h16v12h-16z')
    expect(icon).toContain('.tf{fill:')
  })

  test('the header adds a session tile once the session total is known', () => {
    const totals = { cost: 5.16, tokens: 14_500_000 }
    const withTotal = headerSvg(600, 'Aura flow', totals, 250.47, null, 'claude')
    expect(withTotal).toContain('>Session cost<')
    expect(withTotal).toContain('>Agent cost<')
    expect(withTotal).toContain('>$250.47<')
    expect(withTotal).toContain('≈$5.16')
    expect(headerSvg(600, 'Aura flow', totals, null, null, 'claude')).not.toContain('Session')
  })

  test('the header shows the main session context, in red once it runs high', () => {
    const totals = { cost: 5.16, tokens: 14_500_000 }
    const calm = headerSvg(472, '', totals, 18.5, 34, 'claude')
    expect(calm).toContain('>Main context<')
    expect(calm).toContain('class="t" x="')
    expect(calm).toMatch(/class="t" x="[\d.]+" y="[\d.]+" font-size="[\d.]+" font-weight="600">34%</)
    expect((calm.match(/class="tile"/g) ?? []).length).toBe(4)
    expect(calm).not.toContain('>Time<')
    expect(new Set([...calm.matchAll(/class="tile" x="[\d.]+" y="([\d.]+)"/g)].map(m => m[1])).size).toBe(1)
    const hot = headerSvg(472, '', totals, 18.5, 91, 'claude')
    expect(hot).toMatch(/class="er" x="[\d.]+" y="[\d.]+" font-size="[\d.]+" font-weight="600">91%</)
    expect(new Set([...headerSvg(300, '', totals, 18.5, 34, 'claude').matchAll(/class="tile" x="[\d.]+" y="([\d.]+)"/g)].map(m => m[1])).size).toBe(2)
  })

  test('a narrow header wraps its tiles instead of squeezing the numbers', () => {
    const totals = { cost: 5.16, tokens: 14_500_000 }
    for (const W of [240, 359, 360, 600]) {
      const svg = headerSvg(W, 'Aura flow', totals, 12_345.67, null, 'claude')
      const widths = [...svg.matchAll(/class="tile" x="[\d.]+" y="[\d.]+" width="([\d.]+)"/g)].map(m => Number(m[1]))
      const values = [...svg.matchAll(/font-size="([\d.]+)" font-weight="600">([^<]+)</g)].slice(1)
      expect(widths.length).toBe(3)
      expect(values.length).toBe(3)
      values.forEach(([, size, value], i) => {
        expect(Number(size)).toBeGreaterThanOrEqual(12)
        expect(textWidth(value ?? '', Number(size))).toBeLessThanOrEqual((widths[i] ?? 0) - 18 + 0.01)
      })
      expect(svg).toContain(`height="${headerHeight(W, 'Aura flow', 12_345.67, null)}"`)
    }
    expect(headerHeight(240, 'Aura flow', 1, null)).toBeGreaterThan(headerHeight(600, 'Aura flow', 1, null))
    expect(headerHeight(600, 'Aura flow', null, null)).toBe(72)
  })

  test('the compact strip carries the session total and leaves room for it', () => {
    const totals = { cost: 1, tokens: 1_000 }
    const runs = Array.from({ length: 30 }, (_, i) => run({ id: `r${i}`, status: 'done', endedAt: 5_000 }))
    const strip = compactSvg(600, runs, [], totals, 250.47, 34, 'claude', 9_000)
    expect(strip).toContain('session $250.47 · main ctx 34%')
    const crabs = (svg: string): number => (svg.match(/transform="translate\(/g) ?? []).length
    expect(crabs(strip)).toBeLessThan(crabs(compactSvg(600, runs, [], totals, null, null, 'claude', 9_000)))
  })

  test('a bar shows real progress only', () => {
    const stepped = agentSvg(600, run({ stepDone: 2, stepTotal: 5 }), 9_000, 'claude')
    expect(stepped).toContain('class="tc" x="42" y="55" width="')
    expect(rowHeightOf(run({ stepDone: 2, stepTotal: 5 }))).toBe(ROW_H)
    const working = agentSvg(600, run({ type: 'general-purpose' }), 9_000, 'claude')
    expect(working).not.toContain('class="k"')
    expect(working).not.toContain('@keyframes sl')
    expect(working).toContain(`height="${DONE_H}"`)
    for (const status of ['done', 'failed'] as const) {
      const over = agentSvg(600, run({ status, endedAt: 5_000, stepDone: 4, stepTotal: 6 }), 9_000, 'claude')
      expect(over).not.toContain('class="k"')
      expect(over).toContain(`height="${DONE_H}"`)
      expect(rowHeightOf(run({ status }))).toBe(DONE_H)
    }
    expect(rowHeightOf(run({}))).toBe(DONE_H)
  })

  test('motion follows the clock, so a redraw every second never restarts it', () => {
    const working = run({ type: 'general-purpose' })
    const first = rowDetailsSvg(500, working, 10_000, 'claude')
    const later = rowDetailsSvg(500, working, 11_000, 'claude')
    expect(first).toContain('animation-delay:-0.400s')
    expect(later).toContain('animation-delay:-1.400s')
    expect(rowCrabSvg(working, 'claude')).toBe(rowCrabSvg({ ...working, costUsd: 9, steps: 99 }, 'claude'))
    expect(rowCrabSvg(working, 'claude')).toContain('.run .la{animation')
  })

  test('a working agent hops, a finished one stands still', () => {
    const working = rowCrabSvg(run({ type: 'general-purpose', model: 'claude-sonnet-5-5', costume: 'sonnet-poet' }), 'claude')
    expect(working).toContain('.run{animation:hop 1s')
    expect(working).toContain('@keyframes hop')
    expect(working).toContain('prefers-reduced-motion')
    expect(working).toContain('class="c-sonnet-poet run"')
    const resting = rowCrabSvg(run({ status: 'done', endedAt: 5_000, model: 'claude-sonnet-5-5', costume: 'sonnet-poet' }), 'claude')
    expect(resting).not.toContain('@keyframes hop')
    expect(resting).not.toContain(' run"')
  })

  test('a running agent of any type shows a live dot, a failed one says so in red', () => {
    expect(agentSvg(600, run({ type: 'general-purpose' }), 9_000, 'claude')).toContain('class="live s"')
    expect(agentSvg(600, run({ status: 'failed', endedAt: 5_000 }), 9_000, 'claude')).toContain('<tspan class="er"> · failed</tspan>')
  })

  test('row text uses one separator and no duplicate context figure', () => {
    const row = agentSvg(600, run({ effort: 'high', contextTokens: 120_000 }), 9_000, 'claude')
    expect(row).toContain('<tspan class="s"> · Opus 5.5 · high</tspan>')
    expect(row).toContain('ctx 12% · ≈$0.42<')
    expect(row).not.toContain('120k')
  })

  test('planned tasks name the effort, not a model the session may override', () => {
    const planned = plannedSvg(600, { n: 2, title: 'Wire the store', tier: 'heavy', after: [1] }, 'claude')
    expect(planned).toContain('xhigh effort · after 1')
    expect(planned).not.toContain('Opus')
  })

  test('fitText cuts to the width with an ellipsis', () => {
    expect(fitText('short', 13, 400)).toBe('short')
    const cut = fitText('a'.repeat(200), 13, 120)
    expect(cut.endsWith('…')).toBe(true)
    expect(textWidth(cut, 13)).toBeLessThanOrEqual(120)
  })
})

describe('agent history', () => {
  const messages: SessionMessage[] = [
    { role: 'user', text: 'Fix the login form\nKeep the API as is.', toolUses: [] },
    {
      role: 'assistant',
      text: 'Looking at the form first.',
      toolUses: [
        { tool_use_id: 'u1', tool: 'Read', input: { file_path: '/repo/src/app/login/form.tsx' }, text: 'export const Form = …' },
        { tool_use_id: 'u2', tool: 'Bash', input: { command: 'npm test\n--watch=false' }, text: 'FAIL login\nstack', isError: true },
      ],
    },
    { role: 'user', text: '', toolUses: [], toolResults: [{ tool_use_id: 'u1', text: 'x', isError: false }] },
    { role: 'assistant', text: '', toolUses: [{ tool_use_id: 'u3', tool: 'mcp__aura-hud__step', input: { done: 2, total: 5, note: 'Fix tests' } }] },
    { role: 'user', text: 'Also check the docs.', toolUses: [] },
    { role: 'assistant', text: 'Done: the form validates again.', toolUses: [] },
  ]

  test('the brief, the replies and each tool call read in order', () => {
    const h = historyOf(messages, 100)
    expect(h.brief).toBe('Fix the login form\nKeep the API as is.')
    expect(h.blocks.map(b => b.kind)).toEqual(['say', 'tools', 'ask', 'say'])
    const calls = h.blocks[1]
    expect(calls?.kind === 'tools' ? calls.items : []).toEqual([
      { kind: 'tool', tool: 'Read', what: '…/app/login/form.tsx', state: 'ok', error: '', count: 1 },
      { kind: 'tool', tool: 'Bash', what: 'npm test', state: 'error', error: 'FAIL login', count: 1 },
      { kind: 'tool', tool: 'Step', what: '2/5  Fix tests', state: 'running', error: '', count: 1 },
    ])
    expect(h.tools).toBe(3)
    expect(h.hidden).toBe(0)
  })

  test('the same call made again in a row folds into one line', () => {
    const read = { tool_use_id: 'r', tool: 'Read', input: { file_path: '/repo/a.ts' }, text: 'x' }
    const h = historyOf([{ role: 'user', text: 'Go', toolUses: [] }, { role: 'assistant', text: '', toolUses: [read, read, read] }], 100)
    const calls = h.blocks[0]
    expect(calls?.kind === 'tools' ? calls.items.map(it => it.count) : []).toEqual([3])
    expect(h.tools).toBe(3)
  })

  test('a long history keeps its newest entries', () => {
    const h = historyOf(messages, 2)
    expect(h.hidden).toBe(4)
    expect(h.blocks.map(b => b.kind)).toEqual(['ask', 'say'])
  })

  test('the timeline keeps every line inside the panel', () => {
    const items: ToolItem[] = [
      { kind: 'tool', tool: 'Bash', what: 'grep -rn "useCurrentWorkspaceId" web/src --include=*.ts --include=*.tsx | head -10; cat web/src/x.ts', state: 'ok', error: '', count: 1 },
      { kind: 'tool', tool: 'Read', what: '…/views/backlog/index.tsx', state: 'ok', error: '', count: 2 },
      { kind: 'tool', tool: 'Bash', what: 'npm test', state: 'error', error: 'FAIL src/login.test.ts > validates the form and shows the error under the field', count: 1 },
      { kind: 'tool', tool: 'Edit', what: '…/backlog/model/useBacklogHotkeys.ts', state: 'running', error: '', count: 1 },
    ]
    const W = 420
    const svg = toolsSvg(W, items, 'medium', 'claude')
    expect(svg).toContain(`height="${toolsHeight(items)}"`)
    expect(toolsHeight(items)).toBe(4 * 24 + 16 + 4)
    expect(svg).toContain('×2')
    expect(svg).toContain('class="live tm"')
    for (const [, x, size, text] of svg.matchAll(/class="s mono" x="([\d.]+)" y="[\d.]+" font-size="([\d.]+)">([^<]+)</g)) {
      const shown = (text ?? '').replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
      expect([...shown].length * Number(size) * 0.62).toBeLessThanOrEqual(W - Number(x) - 6 + 0.01)
    }
    expect(toolsSvg(W, items, 'medium', 'claude')).toBe(svg)
  })

  test('MCP tools read as tool and server', () => {
    expect(toolName('mcp__Claude_Browser__navigate')).toBe('navigate · Claude_Browser')
    expect(toolName('Grep')).toBe('Grep')
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
