import { expect, mock, test } from 'claude-code/testing'

const PLUGIN = 'aura-hud'
const TOOL = 'mcp__aura-hud__progress'
const PANE = 'aura-agents'
const CHATGPT = 'custom:aura-themes:chatgpt-dark'
const SURFACES = ['terminal', 'desktop'] as const

const PROVIDER = { plugin: 'test', tier: 'user' } as const
const SPAWN = { prompt: 'x', provider: PROVIDER, parentModel: 'claude-opus-5-5', background: true, fork: false } as const
const COMMAND = { origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 120 } } as const
const SCROLL = { offset: 0, bodyRows: 40 }
const PANE_PROPS = { title: 'Agents', isFocused: false, bodyColumns: 80, placement: 'dock', scroll: SCROLL, view: {} } as const
const TURN = { answer: 'done', durationMs: 1200, isAborted: false, turnId: 'turn-1' }
const PLACED = { value: { isPlaced: true } } as const

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

test('/look chatgpt repaints and switches the terminal theme; /look claude puts it back', async ($, on) => {
  let theme = 'light'
  mock.clock(on, { now: 1_000 })
  mock.store(on)
  on('ui.open', () => PLACED)
  on('config.list', () => ({
    value: [
      {
        key: 'theme',
        label: 'Theme',
        kind: 'choice',
        value: theme,
        options: ['dark', 'light', CHATGPT, 'custom:aura-themes:webstorm-islands-dark'],
        provider: { plugin: 'core', tier: 'core' },
        isLocked: false,
      },
    ],
  }))
  on('config.set', (_engine, e) => {
    if (e.key === 'theme') theme = String(e.value)
    return { value: e.value }
  })
  const look = (args: string) => $.command.run({ ...COMMAND, command: 'look', args })
  const set = await look('chatgpt')
  expect(set.text).toContain('ChatGPT Dark')
  expect(theme).toBe(CHATGPT)
  const ui = await $.ui.mount({ plugin: PLUGIN, surface: 'desktop', component: 'Pane', requestId: PANE, props: PANE_PROPS })
  expect(JSON.stringify(await ui.drawn())).toContain('#2f2f2f')
  await ui.unmount()
  expect((await look('claude')).text).toContain('back to light')
  expect(theme).toBe('light')
  expect((await look('neon')).text).toContain('Unknown look')
})

test('/look shows the palette in the panel and points to /theme when the session lists no aura theme', async ($, on) => {
  const opened: string[] = []
  let theme = 'dark'
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
        value: theme,
        options: ['auto', 'dark', 'light', 'light-daltonized', 'dark-daltonized', 'light-ansi', 'dark-ansi'],
        provider: { plugin: 'engine', tier: 'core' },
        isLocked: false,
      },
    ],
  }))
  on('config.set', (_engine, e) => {
    theme = String(e.value)
    return { value: e.value }
  })
  const answer = await $.command.run({ ...COMMAND, command: 'look', args: 'chatgpt' })
  expect(answer.text).toContain('Panel palette: ChatGPT Dark')
  expect(answer.text).toContain('pick ChatGPT Dark in /theme')
  expect(answer.text).not.toContain('Install')
  expect(theme).toBe('dark')
  expect(opened).toEqual([PANE])
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
