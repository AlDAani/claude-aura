import { describe, expect, test } from 'claude-code/testing'

import type { SessionMessage } from 'claude-code'

import type { AgentRun } from '../types'

import { importedCostumes } from '../hooks/lib/generated-costumes'
import {
  bodyHeightOf,
  compactSvg,
  DONE_H,
  groupBodySvg,
  headerHeight,
  headerSvg,
  paneWidth,
  plannedSvg,
  railOf,
  ROW_H,
  rowCrabSvg,
  rowDetailsSvg,
  rowHeightOf,
} from '../hooks/lib/draw-pane'
import { blank, label, merge, readProgress, readStep } from '../hooks/lib/flow'
import { fitText, textWidth } from '../hooks/lib/format'
import { toolsHeight, toolsSvg } from '../hooks/lib/draw-history'
import { historyOf, toolName } from '../hooks/lib/history'
import type { ToolItem } from '../hooks/lib/history'
import { contextPercentOf, ratesOf, windowOf } from '../hooks/lib/model'
import { lookOfTheme, paletteCss, paletteOf } from '../hooks/lib/palette'
import { addRun, costumeOf, crewOf, newCostumeOf, tierOf } from '../hooks/lib/runs'
import { plural } from '../hooks/lib/strings'
import { groupsOf, isGroupOpen, noteWorkflow, readWorkflowCall, readWorkflowResult, sectionsOf, withOpen, workflowIdOf } from '../hooks/lib/workflows'
import type { Item } from '../hooks/lib/workflows'

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
    const first = rowDetailsSvg(558, a, 9_000, 'chatgpt')
    expect(first.length).toBeLessThan(6_000)
    expect(rowDetailsSvg(558, a, 12_000, 'chatgpt')).toBe(first)
  })

  test('a finished run drops its last step report, a failed one keeps it', () => {
    const reported = { stepDone: 4, stepTotal: 6, stepNote: 'Run verify', endedAt: 5_000 }
    expect(rowDetailsSvg(558, run({ ...reported, status: 'done' }), 9_000, 'claude')).not.toContain('4/6')
    expect(rowDetailsSvg(558, run({ ...reported, status: 'failed' }), 9_000, 'claude')).toContain('4/6 · Run verify')
    expect(rowDetailsSvg(558, run({ ...reported, status: 'running', endedAt: undefined }), 9_000, 'claude')).toContain('4/6 · Run verify')
  })

  test('a still crab carries no animation css', () => {
    expect(rowCrabSvg(run({ status: 'done', endedAt: 5_000 }), 'claude')).not.toContain('@keyframes st')
    expect(rowCrabSvg(run({}), 'claude')).toContain('@keyframes st')
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
    const icon = rowCrabSvg(run({ type: 'general-purpose', model: 'claude-fable-5-1', costume: 'fable-wizard' }), 'claude')
    expect(icon).toContain('M7 10h16v12h-16z')
    expect(icon).toContain('.tf{fill:')
  })

  test('the costume accent of a worker wears its own tier colour', () => {
    const worker = rowCrabSvg(run({ type: 'aura-flow:aura-careful', model: 'claude-fable-5-1', costume: 'fable-wizard' }), 'claude')
    expect(worker).toContain('<path class="tc"')
    expect(worker).toContain('.tc{fill:')
    expect(worker).not.toContain('.tf{fill:')
  })

  test('each drawing carries only the colour rules it uses', () => {
    const finished = rowDetailsSvg(500, run({ status: 'done', endedAt: 5_000 }), 9_000, 'claude')
    expect(finished).not.toContain('.k{')
    expect(finished).not.toContain('.no{')
    expect(finished).not.toContain('.er{')
    expect(finished).toContain('.ok{')
    expect(rowCrabSvg(run({ status: 'done', endedAt: 5_000 }), 'claude')).not.toContain('font-family')
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

  test('the compact strip drops the least needed totals before its crabs run into them', () => {
    const totals = { cost: 17.74, tokens: 4_400_000 }
    const runs = Array.from({ length: 11 }, (_, i) => run({ id: `r${i}`, agentId: `r${i}` }))
    const crabs = (svg: string): number => (svg.match(/transform="translate\(/g) ?? []).length
    const narrow = compactSvg(300, runs, [], totals, 17.07, 22, 'claude', 0)
    expect(narrow).not.toContain('4.4M')
    expect(narrow).toContain('main ctx 22%')
    expect(crabs(narrow)).toBeGreaterThanOrEqual(2)
    expect(compactSvg(600, runs, [], totals, 17.07, 22, 'claude', 0)).toContain('≈$17.74 · 4.4M · session $17.07 · main ctx 22%')
  })

  test('a bar shows real progress only', () => {
    const stepped = rowDetailsSvg(558, run({ stepDone: 2, stepTotal: 5 }), 9_000, 'claude')
    expect(stepped).toContain('class="tc" x="0" y="33" width="')
    expect(rowHeightOf(run({ stepDone: 2, stepTotal: 5 }))).toBe(ROW_H)
    const working = rowDetailsSvg(558, run({ type: 'general-purpose' }), 9_000, 'claude')
    expect(working).not.toContain('class="k"')
    expect(working).not.toContain('@keyframes sl')
    expect(working).toContain(`height="${bodyHeightOf(run({ type: 'general-purpose' }))}"`)
    for (const status of ['done', 'failed'] as const) {
      const over = rowDetailsSvg(558, run({ status, endedAt: 5_000, stepDone: 4, stepTotal: 6 }), 9_000, 'claude')
      expect(over).not.toContain('class="k"')
      expect(over).toContain(`height="${bodyHeightOf(run({ status }))}"`)
      expect(rowHeightOf(run({ status }))).toBe(DONE_H)
    }
    expect(rowHeightOf(run({}))).toBe(DONE_H)
  })

  test('a redraw with the same numbers keeps the drawing, and a new one picks up the pulse where the clock is', () => {
    const working = run({ id: 'pulse', agentId: 'pulse', type: 'general-purpose' })
    const first = rowDetailsSvg(500, working, 10_000, 'claude')
    expect(first).toContain('animation-delay:-0.400s')
    expect(rowDetailsSvg(500, working, 11_000, 'claude')).toBe(first)
    expect(rowDetailsSvg(500, { ...working, costUsd: 5 }, 11_000, 'claude')).toContain('animation-delay:-1.400s')
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
    expect(rowDetailsSvg(558, run({ type: 'general-purpose' }), 9_000, 'claude')).toContain('class="live s"')
    expect(rowDetailsSvg(558, run({ status: 'failed', endedAt: 5_000 }), 9_000, 'claude')).toContain('<tspan class="er"> · failed</tspan>')
  })

  test('row text uses one separator and no duplicate context figure', () => {
    const row = rowDetailsSvg(558, run({ effort: 'high', contextTokens: 120_000 }), 9_000, 'claude')
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
        { tool_use_id: 'u1', tool: 'Read', input: { file_path: '/repo/src/app/login/form.tsx' }, text: '1\texport const Form = 1\n2\t\n3\t}' },
        { tool_use_id: 'u2', tool: 'Bash', input: { command: 'npm test\n--watch=false' }, text: 'FAIL login\nstack', isError: true },
      ],
    },
    { role: 'user', text: '', toolUses: [], toolResults: [{ tool_use_id: 'u1', text: 'x', isError: false }] },
    { role: 'assistant', text: '', toolUses: [{ tool_use_id: 'u3', tool: 'mcp__aura-hud__step', input: { done: 2, total: 5, note: 'Fix tests' } }] },
    { role: 'user', text: 'Also check the docs.', toolUses: [] },
    { role: 'assistant', text: 'Done: the form validates again.', toolUses: [] },
  ]

  const tool = (over: Partial<ToolItem>): ToolItem => ({
    kind: 'tool',
    tool: 'Read',
    title: '',
    isCode: true,
    detail: '',
    outcome: '',
    meta: '',
    plus: 0,
    minus: 0,
    state: 'ok',
    error: '',
    count: 1,
    ...over,
  })

  test('the brief, the replies and each tool call read in order', () => {
    const h = historyOf(messages, 100)
    expect(h.brief).toBe('Fix the login form\nKeep the API as is.')
    expect(h.blocks.map(b => b.kind)).toEqual(['say', 'tools', 'ask', 'say'])
    const calls = h.blocks[1]
    expect(calls?.kind === 'tools' ? calls.items : []).toEqual([
      tool({ tool: 'Read', title: '…/app/login/form.tsx', meta: '3 lines' }),
      tool({ tool: 'Bash', title: 'npm test', state: 'error', error: 'FAIL login' }),
      tool({ tool: 'Step', title: '2/5  Fix tests', isCode: false, state: 'running' }),
    ])
    expect(h.tools).toBe(3)
    expect(h.hidden).toBe(0)
  })

  test('a command reads as the agent described it, with the command and its outcome under it', () => {
    const run = {
      tool_use_id: 'b',
      tool: 'Bash',
      input: { command: 'cd /repo && npm run test -w web 2>&1 | grep -E "Test Files|Tests "', description: 'Run web unit tests' },
      text: '\u001b[32m Test Files  302 passed (302)\u001b[0m\n      Tests  5486 passed (5486)\n',
    }
    const h = historyOf([{ role: 'user', text: 'Go', toolUses: [] }, { role: 'assistant', text: '', toolUses: [run] }], 100)
    const calls = h.blocks[0]
    expect(calls?.kind === 'tools' ? calls.items[0] : null).toEqual(
      tool({
        tool: 'Bash',
        title: 'Run web unit tests',
        isCode: false,
        detail: 'cd /repo && npm run test -w web 2>&1 | grep -E "Test Files|Tests "',
        outcome: 'Test Files  302 passed (302) · Tests  5486 passed (5486)',
      }),
    )
  })

  test('edits say how much they changed, and repeated edits add up', () => {
    const edit = (n: number) => ({ tool_use_id: `e${n}`, tool: 'Edit', input: { file_path: '/repo/a.ts', old_string: 'a\nb', new_string: 'a\nb\nc' }, text: 'ok' })
    const h = historyOf([{ role: 'user', text: 'Go', toolUses: [] }, { role: 'assistant', text: '', toolUses: [edit(1), edit(2), edit(3)] }], 100)
    const calls = h.blocks[0]
    const item = calls?.kind === 'tools' ? calls.items[0] : undefined
    expect(item?.count).toBe(3)
    expect([item?.plus, item?.minus]).toEqual([9, 6])
    expect(h.tools).toBe(3)
  })

  test('the handback becomes the report instead of a tool line', () => {
    const handback = { tool_use_id: 'h', tool: 'SubagentHandback', input: { message: 'All three files are done.\n\nEvery check passed.' }, text: '{"success":true}' }
    const h = historyOf([{ role: 'user', text: 'Go', toolUses: [] }, { role: 'assistant', text: '', toolUses: [handback] }], 100)
    expect(h.blocks).toEqual([{ kind: 'say', text: 'All three files are done.\n\nEvery check passed.', isReport: true }])
    expect(h.tools).toBe(0)
  })

  test('system reminders never show up as messages', () => {
    const h = historyOf(
      [
        { role: 'user', text: 'Fix it.\n<system-reminder>Report through SubagentHandback.</system-reminder>', toolUses: [] },
        { role: 'assistant', text: '', toolUses: [] },
        { role: 'user', text: '<system-reminder>Context is filling up.</system-reminder>', toolUses: [] },
      ],
      100,
    )
    expect(h.brief).toBe('Fix it.')
    expect(h.blocks).toEqual([])
  })

  test('a long history keeps its newest entries', () => {
    const h = historyOf(messages, 2)
    expect(h.hidden).toBe(4)
    expect(h.blocks.map(b => b.kind)).toEqual(['ask', 'say'])
  })

  test('the timeline keeps every line inside the panel', () => {
    const items: ToolItem[] = [
      tool({ tool: 'Bash', title: 'Typecheck, filtering known error', isCode: false, detail: 'cd /Users/dan/weDo && npm run typecheck 2>&1 | grep "error TS" | grep -v "task-command"; echo TC_DONE', outcome: 'TC_DONE' }),
      tool({ tool: 'Read', title: '…/views/backlog/index.tsx', meta: '412 lines', count: 2 }),
      tool({ tool: 'Edit', title: '…/shared/ui/Breadcrumbs.tsx', plus: 17, minus: 11, count: 4 }),
      tool({ tool: 'Bash', title: 'npm test', state: 'error', error: 'FAIL src/login.test.ts > validates the form and shows the error under the field' }),
      tool({ tool: 'navigate · Claude_Browser', title: 'http://localhost:3000/backlog?view=board&filter=mine', state: 'running' }),
    ]
    const W = 420
    const svg = toolsSvg(W, items, 'medium', 'claude')
    expect(svg).toContain(`height="${toolsHeight(items)}"`)
    expect(toolsHeight(items)).toBe(5 * 24 + 3 * 16 + 4)
    expect(svg).toContain('×2')
    expect(svg).toContain('<tspan class="go">+17</tspan> <tspan class="er">−11</tspan>')
    expect(svg).toContain('↳ TC_DONE')
    expect(svg).toContain('class="live tm"')
    const decode = (text: string) => text.replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
    for (const [, x, size, text] of svg.matchAll(/class="(?:s|m) mono" x="([\d.]+)" y="[\d.]+" font-size="([\d.]+)">([^<]+)</g)) {
      expect([...decode(text ?? '')].length * Number(size) * 0.62).toBeLessThanOrEqual(W - Number(x) - 6 + 0.01)
    }
    for (const [, x, size, text] of svg.matchAll(/class="t" x="([\d.]+)" y="[\d.]+" font-size="([\d.]+)">([^<]+)</g)) {
      expect(textWidth(decode(text ?? ''), Number(size))).toBeLessThanOrEqual(W - Number(x) + 0.01)
    }
    expect(toolsSvg(W, items, 'medium', 'claude')).toBe(svg)
  })

  test('drawings use the whole width of a wide pane', () => {
    expect(paneWidth(160)).toBe(1272)
    expect(paneWidth(20)).toBe(240)
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

const only = <T>(v: T | undefined): T => {
  if (v === undefined) throw new Error('missing')
  return v
}

const keysOf = (items: readonly Item[]): string[] => items.map(it => (it.kind === 'group' ? it.group.id : it.run.id))

describe('workflows', () => {
  test('a Workflow call names its run from the script, a saved name or the script file', () => {
    const script = "export const meta = {\n  name: 'review-changes',\n  description: 'Review the diff',\n}\nawait agent('x')"
    expect(readWorkflowCall({ tool_use_id: 'c1', script })).toEqual({ runId: '', callId: 'c1', name: 'review-changes' })
    expect(readWorkflowCall({ tool_use_id: 'c2', name: 'deploy-check' }).name).toBe('deploy-check')
    expect(readWorkflowCall({ tool_use_id: 'c3', scriptPath: '/s/workflows/fix-flaky.js', resumeFromRunId: 'wf_9' })).toEqual({
      runId: 'wf_9',
      callId: 'c3',
      name: 'fix-flaky',
    })
    expect(readWorkflowResult({ result: { runId: 'wf_1', workflowName: 'review-changes' } }, 'c1')).toEqual({
      runId: 'wf_1',
      callId: 'c1',
      name: 'review-changes',
    })
    expect(readWorkflowResult({ deny: 'no' }, 'c1')).toEqual({ runId: '', callId: 'c1', name: '' })
  })

  test('a call, its result, its agents and a resume land on one record; each run gets its own tone', () => {
    let list = noteWorkflow([], { runId: '', callId: 'c1', name: 'review-changes' }, 1)
    list = noteWorkflow(list, { runId: '', callId: 'c1', name: '' }, 2)
    list = noteWorkflow(list, { runId: 'wf_1', callId: 'c1', name: 'review-changes' }, 3)
    list = noteWorkflow(list, { runId: 'wf_1', callId: '', name: '' }, 4)
    expect(list).toHaveLength(1)
    expect(list[0]).toMatchObject({ id: 'c1', runId: 'wf_1', name: 'review-changes', startedAt: 1 })
    const resumed = noteWorkflow(list, { runId: 'wf_1', callId: 'c9', name: '' }, 5)
    expect(resumed).toHaveLength(1)
    expect(workflowIdOf(resumed, { runId: '', callId: 'c9', name: '' })).toBe('c1')
    const two = noteWorkflow(resumed, { runId: 'wf_2', callId: 'c2', name: 'other' }, 6)
    expect(two[1]?.tone).not.toBe(two[0]?.tone)
    expect(noteWorkflow(two, { runId: 'wf_2', callId: 'c2', name: 'other' }, 7)).toBe(two)
    expect(noteWorkflow([], { runId: '', callId: '', name: 'x' }, 1)).toEqual([])
  })

  test('a running workflow keeps its finished agents with it, and a finished one moves to Finished', () => {
    const records = noteWorkflow(noteWorkflow([], { runId: 'wf_a', callId: 'ca', name: 'figma-exports' }, 1), { runId: 'wf_b', callId: 'cb', name: 'reconcile' }, 2)
    const list = [
      run({ id: 'b1', agentId: 'b1', workflow: 'wf_b', status: 'done', startedAt: 10 }),
      run({ id: 'a1', agentId: 'a1', workflow: 'wf_a', status: 'done', startedAt: 20 }),
      run({ id: 's1', agentId: 's1', type: 'Explore', startedAt: 25 }),
      run({ id: 'a2', agentId: 'a2', workflow: 'wf_a', startedAt: 30 }),
      run({ id: 'b2', agentId: 'b2', workflow: 'wf_b', status: 'failed', startedAt: 40 }),
      run({ id: 's2', agentId: 's2', type: 'Explore', status: 'done', startedAt: 50 }),
    ]
    const groups = groupsOf(list, records)
    expect(groups.get('wf_a')).toMatchObject({ name: 'figma-exports', running: 1, done: 1, status: 'running' })
    expect(groups.get('wf_b')).toMatchObject({ name: 'reconcile', done: 1, failed: 1, status: 'done' })
    const sections = sectionsOf(list, groups)
    expect(keysOf(sections.running)).toEqual(['s1', 'wf_a'])
    expect(keysOf(sections.finished)).toEqual(['s2', 'wf_b'])
    expect(sections.finishedAgents).toBe(3)
  })

  test('running workflows start open and finished ones closed, until the person picks', () => {
    const groups = groupsOf([run({ workflow: 'w1' }), run({ id: 'b', agentId: 'b', workflow: 'w2', status: 'done' })], [])
    const live = only(groups.get('w1'))
    const over = only(groups.get('w2'))
    expect(isGroupOpen(live, undefined)).toBe(true)
    expect(isGroupOpen(over, {})).toBe(false)
    expect(isGroupOpen(over, withOpen({}, 'w2', true))).toBe(true)
    expect(isGroupOpen(live, withOpen({}, 'w1', false))).toBe(false)
    let open: Record<string, boolean> = {}
    for (let n = 0; n < 100; n += 1) open = withOpen(open, `w${n}`, true)
    expect(Object.keys(open)).toHaveLength(60)
    expect(open.w99).toBe(true)
  })

  test('rounds count within one workflow only', () => {
    const spawn = (n: number) => ({ description: 'review:bugs', subagentType: 'workflow-subagent', tool_use_id: `c${n}`, workflow: { agentIndex: 1 } })
    const first = addRun([], spawn(1), { agentId: 'a1', model: 'claude-opus-5-5' }, 0, 'w1')
    const other = addRun(first, spawn(2), { agentId: 'a2', model: 'claude-opus-5-5' }, 0, 'w2')
    const again = addRun(other, spawn(3), { agentId: 'a3', model: 'claude-opus-5-5' }, 0, 'w1')
    expect(again.map(a => a.round)).toEqual([1, 1, 2])
    expect(again.map(a => a.workflow)).toEqual(['w1', 'w2', 'w1'])
  })

  test('a workflow agent drops the generic type, and the header draws one segment per agent', () => {
    expect(rowDetailsSvg(400, run({ type: 'workflow-subagent', workflow: 'w1' }), 0, 'claude')).not.toContain('workflow-subagent')
    expect(rowDetailsSvg(400, run({ type: 'workflow-subagent' }), 0, 'claude')).toContain('workflow-subagent')
    const three = [run({ workflow: 'w1', status: 'done' }), run({ id: 'b', agentId: 'b', workflow: 'w1', status: 'failed' }), run({ id: 'c', agentId: 'c', workflow: 'w1' })]
    const head = groupBodySvg(340, only(groupsOf(three, []).get('w1')), 0, 'claude')
    expect(head).toContain('3 agents · 1 running')
    expect(head).toContain('1 failed')
    expect(head.match(/<rect class="(go|er|live [a-z]+)"/g)).toHaveLength(3)
    const crowd = Array.from({ length: 80 }, (_, n) => run({ id: `r${n}`, agentId: `r${n}`, workflow: 'w2', status: n < 60 ? 'done' : 'running' }))
    expect(groupBodySvg(200, only(groupsOf(crowd, []).get('w2')), 0, 'claude')).toContain('clip-path')
  })

  test('the rail runs down to the middle of the last agent', () => {
    expect(railOf([run({ status: 'done' }), run({ id: 'b', agentId: 'b' })])).toEqual({ height: 2 * DONE_H, end: 1.5 * DONE_H - 1.5 })
    expect(railOf([])).toEqual({ height: 0, end: 0 })
  })

  test('the main context is the measured fill, else an estimate over the window', () => {
    expect(contextPercentOf({ window: 1_000_000, percent: 87.6 })).toBe(88)
    expect(contextPercentOf({ window: 1_000_000, breakdown: { totalTokens: 92_000 } })).toBe(9)
    expect(contextPercentOf({ window: 1_000_000 })).toBeNull()
    expect(contextPercentOf({ window: 200_000, breakdown: { totalTokens: 500_000 } })).toBe(100)
  })
})
