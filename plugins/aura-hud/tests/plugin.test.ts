import { expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'

const PLUGIN = 'aura-hud'
const TOOL = 'mcp__aura-hud__progress'
const PANE = 'aura-agents'
const SURFACES = ['terminal', 'desktop'] as const

const PROVIDER = { plugin: 'test', tier: 'user' } as const
const SPAWN = { prompt: 'x', provider: PROVIDER, parentModel: 'claude-opus-5-5', background: true, fork: false } as const
const COMMAND = { origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 120 } } as const
const SCROLL = { offset: 0, bodyRows: 40 }
const PANE_PROPS = { title: 'Agents', isFocused: false, bodyColumns: 80, placement: 'dock', scroll: SCROLL, view: {} } as const
const TURN = { answer: 'done', durationMs: 1200, isAborted: false, turnId: 'turn-1' }
const PLACED = { value: { isPlaced: true } } as const
const WINDOW = 1_000_000
const SUMMARY = [{ role: 'user' as const, text: 'Summary of the work so far', toolUses: [] }]
const OPUS_STEP = { model: 'claude-opus-5-5', input_tokens: 1_000, output_tokens: 200, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 }

const launched = (workflowName: string, runId: string) => ({ result: { status: 'async_launched' as const, taskId: `task-${runId}`, workflowName, runId } })

const breakdown = (totalTokens: number) => ({
  categories: [],
  totalTokens,
  maxTokens: WINDOW,
  rawMaxTokens: WINDOW,
  autocompactSource: 'model-default' as const,
  percentage: Math.round((totalTokens / WINDOW) * 100),
  gridRows: [],
  model: 'claude-opus-5-5',
  memoryFiles: [],
  mcpTools: [],
  agents: [],
  isAutoCompactEnabled: true,
  apiUsage: null,
})

const drawn = async ($: Engine, surface: 'terminal' | 'desktop') => {
  const ui = await $.ui.mount({ plugin: PLUGIN, surface, component: 'Pane', requestId: PANE, props: PANE_PROPS })
  const tree = JSON.stringify(await ui.drawn())
  await ui.unmount()
  return tree
}

const drain = async <C, R>(stream: AsyncGenerator<C, R>): Promise<R> => {
  for (;;) {
    const read = await stream.next()
    if (read.done) return read.value
  }
}

test('a worker launch opens the agents panel and lists the run', async ($, on) => {
  const opened: string[] = []
  mock.clock(on, { now: 1_000 })
  on('agent.spawn', () => ({ agentId: 'a1', model: 'claude-opus-5-5' }))
  on('ui.open', (_engine, e) => {
    opened.push(e.id)
    return PLACED
  })
  await $.agent.spawn({ ...SPAWN, description: 'Fix it', subagentType: 'aura-flow:aura-careful', tool_use_id: 't1' })
  expect(opened).toEqual([PANE])
  for (const surface of SURFACES) {
    const ui = await $.ui.mount({ plugin: PLUGIN, surface, component: 'Pane', requestId: PANE, props: PANE_PROPS })
    expect(JSON.stringify(await ui.drawn())).toContain('Fix it')
    await ui.unmount()
  }
})

test('the progress tool clamps a runaway total and answers the model', async ($, on) => {
  mock.clock(on, { now: 1_000 })
  on('ui.open', () => PLACED)
  const answer = await $.tool.call({ tool: TOOL, tool_use_id: 'p1', title: 'Big', total: 1e9, done: 3, phase: 'delegate' })
  expect(JSON.stringify(answer)).toContain('Tasks 3/50')
})

test('the panel opens by itself when agents start working, once per batch', async ($, on) => {
  const opened: string[] = []
  const clock = mock.clock(on, { now: 1_000 })
  let id = ''
  on('agent.spawn', () => ({ agentId: id, model: 'claude-opus-5-5' }))
  on('ui.open', (_engine, e) => {
    opened.push(e.id)
    return PLACED
  })
  on('turn.complete', () => ({ text: 'done' }))
  const spawn = async (n: number) => {
    id = `a${n}`
    await $.agent.spawn({ ...SPAWN, description: `Look around ${n}`, subagentType: 'Explore', tool_use_id: `t${n}` })
    await clock.settle()
  }
  await spawn(1)
  await spawn(2)
  expect(opened).toEqual([PANE])
  for (const agentId of ['a1', 'a2']) await $.turn.complete({ ...TURN, agentId, reason: 'answer' })
  await clock.advance(5_000)
  await spawn(3)
  expect(opened).toEqual([PANE, PANE])
})

test('/look repaints the panel, opens it to show the palette, and leaves the Claude Code theme alone', async ($, on) => {
  const opened: string[] = []
  const written: unknown[] = []
  mock.clock(on, { now: 1_000 })
  mock.store(on)
  on('ui.open', (_engine, e) => {
    opened.push(e.id)
    return PLACED
  })
  on('config.list', () => ({
    value: [
      {
        key: 'theme',
        label: 'Theme',
        kind: 'choice',
        value: 'dark',
        options: ['auto', 'dark', 'light'],
        provider: { plugin: 'engine', tier: 'core' },
        isLocked: false,
      },
    ],
  }))
  on('config.set', (_engine, e) => {
    written.push(e)
    return { value: e.value }
  })
  const look = (args: string) => $.command.run({ ...COMMAND, command: 'look', args })
  expect((await look('chatgpt')).text).toBe('Panel palette: ChatGPT Dark, shown in the agents panel.')
  expect(opened).toEqual([PANE])
  const ui = await $.ui.mount({ plugin: PLUGIN, surface: 'desktop', component: 'Pane', requestId: PANE, props: PANE_PROPS })
  expect(JSON.stringify(await ui.drawn())).toContain('#2f2f2f')
  await ui.unmount()
  expect((await look('claude')).text).toBe('Panel palette: Claude, shown in the agents panel.')
  expect((await look('neon')).text).toContain('Unknown look')
  expect(written).toEqual([])
})

test('a finished worker stops counting as running', async ($, on) => {
  mock.clock(on, { now: 1_000 })
  on('agent.spawn', () => ({ agentId: 'a1', model: 'claude-haiku-5-5' }))
  on('ui.open', () => PLACED)
  on('turn.complete', () => ({ text: 'done' }))
  const report = async () => JSON.stringify(await $.tool.call({ tool: TOOL, tool_use_id: 'p', phase: 'delegate' }))
  await $.agent.spawn({ ...SPAWN, description: 'Run tests', subagentType: 'aura-light', tool_use_id: 't1' })
  expect(await report()).toContain('Tasks 1 running')
  await $.turn.complete({
    ...TURN,
    agentId: 'a1',
    reason: 'answer',
    usage: { model: 'claude-haiku-5-5', input_tokens: 1000, output_tokens: 200, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 },
  })
  expect(await report()).toContain('Tasks 0 running')
})

test('the panel shows the whole session total and follows it', async ($, on) => {
  mock.clock(on, { now: 1_000 })
  mock.store(on)
  on('ui.open', () => PLACED)
  on('session.start', (_engine, e) => ({ cwd: e.cwd }))
  on('session.measure', (_engine, e) => ({ changed: e.changed }))
  on('tool.register', (_engine, e) => ({ value: { tool: e.name } }))
  on('command.register', (_engine, e) => ({ value: { command: e.name } }))
  on('session.usage', () => ({ value: { startedAt: 0, context: { window: 1_000_000 }, rateLimits: [], cost: { usd: 250.4712 } } }))
  await $.session.start({ cwd: '/work', surface: 'desktop', isInteractive: true })
  const drawn = async (surface: (typeof SURFACES)[number]) => {
    const ui = await $.ui.mount({ plugin: PLUGIN, surface, component: 'Pane', requestId: PANE, props: PANE_PROPS })
    const tree = JSON.stringify(await ui.drawn())
    await ui.unmount()
    return tree
  }
  for (const surface of SURFACES) expect(await drawn(surface)).toContain('$250.47')
  await $.session.measure({ context: { window: 1_000_000 }, rateLimits: [], cost: { usd: 251.1 }, changed: ['cost'] })
  for (const surface of SURFACES) expect(await drawn(surface)).toContain('$251.10')
  await $.session.measure({ context: { window: 1_000_000, tokens: 412_000, percent: 41 }, rateLimits: [], cost: { usd: 251.1 }, changed: ['context'] })
  expect(await drawn('desktop')).toContain('Main context')
  expect(await drawn('desktop')).toContain('41%')
  expect(await drawn('terminal')).toContain('main ctx 41%')
})

test('a row opens the agent history, and back returns to the list', async ($, on) => {
  const asked: unknown[] = []
  const clock = mock.clock(on, { now: 1_000 })
  on('ui.open', () => PLACED)
  on('agent.spawn', () => ({ agentId: 'a1', model: 'claude-sonnet-5-5' }))
  on('session.messages', (_engine, e) => {
    asked.push(e)
    return {
      value: [
        { role: 'user', text: 'Fix the login form', toolUses: [] },
        {
          role: 'assistant',
          text: 'Checking the form.',
          toolUses: [{ tool_use_id: 'u1', tool: 'Read', input: { file_path: '/repo/src/login.tsx' }, text: 'x' }],
        },
      ],
    }
  })
  await $.agent.spawn({ ...SPAWN, description: 'Fix login', subagentType: 'aura-flow:aura-medium', tool_use_id: 't1' })
  for (const surface of SURFACES) {
    const ui = await $.ui.mount({ plugin: PLUGIN, surface, component: 'Pane', requestId: PANE, props: PANE_PROPS })
    const title = await ui.find({ key: 'open-a1' })
    expect(JSON.stringify(title)).toContain('Fix login')
    await ui.press({ key: 'open-a1' })
    await clock.advance(100)
    const opened = JSON.stringify(await ui.drawn())
    expect(opened).toContain('Checking the form.')
    expect(opened).toContain('/repo/src/login.tsx')
    expect(opened).toContain('Fix the login form')
    await ui.press({ key: 'back' })
    await clock.advance(100)
    const back = JSON.stringify(await ui.drawn())
    expect(back).not.toContain('Checking the form.')
    expect(back).toContain('Fix login')
    await ui.unmount()
  }
  expect(asked).toContainEqual(expect.objectContaining({ agentId: 'a1' }))
})

test('the commands run beside a turn instead of waiting for it or ending it', async ($, on) => {
  const registered: { name: string; immediate?: true }[] = []
  mock.clock(on, { now: 1_000 })
  mock.store(on)
  on('session.start', (_engine, e) => ({ cwd: e.cwd }))
  on('tool.register', (_engine, e) => ({ value: { tool: e.name } }))
  on('command.register', (_engine, e) => {
    registered.push({ name: e.name, immediate: e.immediate })
    return { value: { command: e.name } }
  })
  on('session.usage', () => ({ value: { startedAt: 0, context: { window: 1_000_000 }, rateLimits: [] } }))
  await $.session.start({ cwd: '/work', surface: 'desktop', isInteractive: true })
  expect(registered).toEqual([
    { name: 'look', immediate: true },
    { name: 'hud', immediate: true },
  ])
})

test('/hud opens the agents panel again after it was closed, on the agent list', async ($, on) => {
  const opened: string[] = []
  mock.clock(on, { now: 1_000 })
  on('ui.open', (_engine, e) => {
    opened.push(e.id)
    return PLACED
  })
  on('agent.spawn', () => ({ agentId: 'a1', model: 'claude-sonnet-5-5' }))
  on('session.messages', () => ({ value: [{ role: 'user', text: 'Brief', toolUses: [] }] }))
  await $.agent.spawn({ ...SPAWN, description: 'Fix login', subagentType: 'general-purpose', tool_use_id: 't1' })
  const ui = await $.ui.mount({ plugin: PLUGIN, surface: 'desktop', component: 'Pane', requestId: PANE, props: PANE_PROPS })
  await ui.press({ key: 'open-a1' })
  const answer = await $.command.run({ ...COMMAND, command: 'hud', args: '' })
  expect(answer.text).toBeUndefined()
  expect(opened.at(-1)).toBe(PANE)
  expect(JSON.stringify(await ui.drawn())).not.toContain('Brief')
  await ui.unmount()
})

test('agents a workflow starts sit under its name, apart from other agents', async ($, on) => {
  let id = ''
  mock.clock(on, { now: 1_000 })
  on('ui.open', () => PLACED)
  on('tool.call', () => launched('figma-exports', 'wf_figma'))
  on('agent.spawn', () => ({ agentId: id, model: 'claude-opus-5-5' }))
  await $.tool.call({ tool: 'Workflow', script: "export const meta = { name: 'figma-exports', description: 'Read the export' }" })
  const spawn = async (agentId: string, description: string, agentIndex = 0) => {
    id = agentId
    const workflow = agentIndex ? { workflow: { runId: 'wf_figma', agentIndex } } : {}
    await $.agent.spawn({ ...SPAWN, ...workflow, description, subagentType: agentIndex ? 'workflow-subagent' : 'Explore', tool_use_id: `t-${agentId}` })
  }
  await spawn('a1', 'view:a', 1)
  await spawn('a2', 'Look around')
  await spawn('a3', 'view:b', 2)
  for (const surface of SURFACES) {
    const ui = await $.ui.mount({ plugin: PLUGIN, surface, component: 'Pane', requestId: PANE, props: PANE_PROPS })
    const fold = await ui.find({ type: 'Button', text: /figma-exports/ })
    const group = JSON.stringify(await ui.find({ key: String(fold?.key).replace('fold-', 'wf-') }))
    expect(group).toContain('view:a')
    expect(group).toContain('view:b')
    expect(group).not.toContain('Look around')
    expect(group).not.toContain('workflow-subagent')
    expect(JSON.stringify(await ui.drawn())).toContain('Look around')
    await ui.unmount()
  }
})

test('a finished workflow folds to its header, and its title opens and closes it', async ($, on) => {
  mock.clock(on, { now: 1_000 })
  on('ui.open', () => PLACED)
  on('tool.call', () => launched('review-changes', 'wf_review'))
  on('agent.spawn', () => ({ agentId: 'a1', model: 'claude-sonnet-5-5' }))
  on('turn.complete', () => ({ text: 'done' }))
  await $.tool.call({ tool: 'Workflow', name: 'review-changes' })
  await $.agent.spawn({ ...SPAWN, description: 'review:bugs', subagentType: 'workflow-subagent', tool_use_id: 'w1', workflow: { runId: 'wf_review', agentIndex: 1 } })
  for (const surface of SURFACES) expect(await drawn($, surface)).toContain('review:bugs')
  await $.turn.complete({ ...TURN, agentId: 'a1', reason: 'answer' })
  for (const surface of SURFACES) {
    const ui = await $.ui.mount({ plugin: PLUGIN, surface, component: 'Pane', requestId: PANE, props: PANE_PROPS })
    const fold = String((await ui.find({ type: 'Button', text: /review-changes/ }))?.key)
    expect(JSON.stringify(await ui.drawn())).not.toContain('review:bugs')
    await ui.press({ key: fold })
    expect(JSON.stringify(await ui.drawn())).toContain('review:bugs')
    await ui.press({ key: fold })
    expect(JSON.stringify(await ui.drawn())).not.toContain('review:bugs')
    await ui.unmount()
  }
})

test('after a compaction the main context shows the new size instead of the old figure', async ($, on) => {
  let isCompacted = false
  const clock = mock.clock(on, { now: 1_000 })
  on('ui.open', () => PLACED)
  on('session.measure', (_engine, e) => ({ changed: e.changed }))
  on('session.usage', (_engine, e) => ({
    value: {
      startedAt: 0,
      context: isCompacted ? { window: WINDOW, ...(e?.breakdown ? { breakdown: breakdown(90_000) } : {}) } : { window: WINDOW, tokens: 880_000, percent: 88 },
      rateLimits: [],
    },
  }))
  on('session.compact', () => {
    isCompacted = true
    return { messages: SUMMARY }
  })
  await $.session.measure({ context: { window: WINDOW, tokens: 880_000, percent: 88 }, rateLimits: [], changed: ['context'] })
  expect(await drawn($, 'desktop')).toContain('88%')
  await $.session.compact({ trigger: 'manual', messages: [...SUMMARY, ...SUMMARY] })
  await clock.advance(3_000)
  expect(await drawn($, 'desktop')).not.toContain('88%')
  expect(await drawn($, 'desktop')).toContain('9%')
  expect(await drawn($, 'terminal')).toContain('main ctx 9%')
})

test('an agent step re-estimates the main context once the engine stops reporting it', async ($, on) => {
  let percent: number | undefined = 88
  const clock = mock.clock(on, { now: 1_000 })
  on('ui.open', () => PLACED)
  on('agent.spawn', () => ({ agentId: 'a1', model: 'claude-opus-5-5' }))
  on('session.usage', (_engine, e) => ({
    value: {
      startedAt: 0,
      context: { window: WINDOW, ...(percent === undefined ? {} : { tokens: 880_000, percent }), ...(e?.breakdown ? { breakdown: breakdown(90_000) } : {}) },
      rateLimits: [],
    },
  }))
  on('turn.step', async function* (_engine, e) {
    return { turnId: e.turnId, index: e.index, answer: '', toolUses: [], stopReason: 'end_turn' as const, usage: OPUS_STEP }
  })
  await $.agent.spawn({ ...SPAWN, description: 'Read the export', subagentType: 'Explore', tool_use_id: 't1' })
  const step = async () => {
    await drain($.turn.step({ turnId: 'turn-1', index: 0, model: 'claude-opus-5-5', messageCount: 2, agentId: 'a1' }))
    await clock.advance(6_000)
  }
  await step()
  expect(await drawn($, 'desktop')).toContain('88%')
  percent = undefined
  await step()
  expect(await drawn($, 'desktop')).not.toContain('88%')
  expect(await drawn($, 'desktop')).toContain('9%')
})

test('each section header folds its own section and says what it hides', async ($, on) => {
  let id = ''
  mock.clock(on, { now: 1_000 })
  on('ui.open', () => PLACED)
  on('agent.spawn', () => ({ agentId: id, model: 'claude-opus-5-5' }))
  on('turn.complete', () => ({ text: 'done' }))
  for (const [agentId, description] of [['a1', 'Map the code'], ['a2', 'Check the links'], ['a3', 'Write the plan']] as const) {
    id = agentId
    await $.agent.spawn({ ...SPAWN, description, subagentType: 'Explore', tool_use_id: `t-${agentId}` })
  }
  await $.turn.complete({ ...TURN, agentId: 'a1', reason: 'answer', usage: { ...OPUS_STEP } })
  await $.turn.complete({ ...TURN, agentId: 'a2', reason: 'error' })
  for (const surface of SURFACES) {
    const ui = await $.ui.mount({ plugin: PLUGIN, surface, component: 'Pane', requestId: PANE, props: PANE_PROPS })
    const head = async () => JSON.stringify(await ui.find({ key: 'h-finished' }))
    expect(await head()).toContain('Finished')
    expect(await head()).not.toContain('failed')
    await ui.press({ key: 'section-finished' })
    let tree = JSON.stringify(await ui.drawn())
    expect(tree).not.toContain('Map the code')
    expect(tree).toContain('Write the plan')
    expect(await head()).toContain('1 failed')
    expect(await head()).toContain('≈$')
    await ui.press({ key: 'section-running' })
    tree = JSON.stringify(await ui.drawn())
    expect(tree).not.toContain('Write the plan')
    await ui.press({ key: 'section-finished' })
    await ui.press({ key: 'section-running' })
    tree = JSON.stringify(await ui.drawn())
    expect(tree).toContain('Map the code')
    expect(tree).toContain('Write the plan')
    await ui.unmount()
  }
})

test('the view switch says what it does and sits at the end of the first row under the totals', async ($, on) => {
  mock.clock(on, { now: 1_000 })
  on('ui.open', () => PLACED)
  on('agent.spawn', () => ({ agentId: 'a1', model: 'claude-opus-5-5' }))
  await $.agent.spawn({ ...SPAWN, description: 'Map the code', subagentType: 'Explore', tool_use_id: 't1' })
  const desktop = await $.ui.mount({ plugin: PLUGIN, surface: 'desktop', component: 'Pane', requestId: PANE, props: PANE_PROPS })
  expect((await desktop.find({ key: 'compact' }))?.props.label).toBe('⊟ Compact')
  expect(JSON.stringify(await desktop.find({ key: 'h-running' }))).toContain('⊟ Compact')
  await desktop.press({ key: 'compact' })
  expect((await desktop.find({ key: 'compact' }))?.props.label).toBe('⊞ Expand')
  expect(JSON.stringify(await desktop.drawn())).not.toContain('Map the code')
  await desktop.press({ key: 'compact' })
  await desktop.unmount()
  const terminal = await $.ui.mount({ plugin: PLUGIN, surface: 'terminal', component: 'Pane', requestId: PANE, props: PANE_PROPS })
  expect((await terminal.find({ key: 'compact' }))?.props.label).toBe('Compact')
  await terminal.press({ key: 'compact' })
  expect((await terminal.find({ key: 'compact' }))?.props.label).toBe('Expand')
  await terminal.unmount()
})

test('controls highlight on hover without underlines, and section headers carry an icon and a ▾ or ▸', async ($, on) => {
  mock.clock(on, { now: 1_000 })
  on('ui.open', () => PLACED)
  on('agent.spawn', () => ({ agentId: 'a1', model: 'claude-opus-5-5' }))
  await $.agent.spawn({ ...SPAWN, description: 'Map the code', subagentType: 'Explore', tool_use_id: 't1' })
  for (const surface of SURFACES) {
    const ui = await $.ui.mount({ plugin: PLUGIN, surface, component: 'Pane', requestId: PANE, props: PANE_PROPS })
    expect(JSON.stringify(await ui.drawn())).not.toContain('underline')
    expect(JSON.stringify(await ui.find({ key: 'h-running' }))).toContain(surface === 'desktop' ? 'class=\\"th\\"' : '●')
    expect((await ui.find({ key: 'section-running' }))?.text).toContain('Running · 1 ▾')
    await ui.press({ key: 'section-running' })
    expect((await ui.find({ key: 'section-running' }))?.text).toContain('Running · 1 ▸')
    await ui.press({ key: 'section-running' })
    await ui.unmount()
  }
})
