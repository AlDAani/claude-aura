import { expect, mock, test } from 'claude-code/testing'

const PLUGIN = 'good-look-progress'
const TOOL = 'mcp__good-look-progress__progress'
const PANE = 'good-look-agents'
const CHATGPT = 'custom:good-look-themes:chatgpt-dark'
const SURFACES = ['terminal', 'desktop'] as const

const PROVIDER = { plugin: 'test', tier: 'user' } as const
const SPAWN = { prompt: 'x', provider: PROVIDER, parentModel: 'claude-opus-5-5', background: true, fork: false } as const
const COMMAND = { origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 120 } } as const
const SCROLL = { offset: 0, bodyRows: 40 }
const BAND_PROPS = { hasSurvey: false, isWorking: false, maxRows: 4, bodyColumns: 120, scroll: SCROLL, view: {} }
const PANE_PROPS = { title: 'Agents', isFocused: false, bodyColumns: 80, placement: 'dock', scroll: SCROLL, view: {} } as const
const TURN = { answer: 'done', durationMs: 1200, isAborted: false, turnId: 'turn-1' }
const PLACED = { value: { isPlaced: true } } as const

test('a worker launch brings up the band with the crew count', async ($, on) => {
  mock.clock(on, { now: 1_000 })
  on('agent.spawn', () => ({ agentId: 'a1', model: 'claude-opus-5-5' }))
  on('ui.open', () => PLACED)
  await $.agent.spawn({ ...SPAWN, description: 'Fix it', subagentType: 'good-look-flow:good-look-careful', tool_use_id: 't1' })
  for (const surface of SURFACES) {
    const ui = await $.ui.mount({ plugin: PLUGIN, surface, component: 'AbovePrompt', props: BAND_PROPS })
    expect(await ui.find({ key: 'good-look-dismiss' })).toBeDefined()
    expect((await ui.find({ key: 'good-look-agents' }))?.text).toContain('×1')
    expect(JSON.stringify(await ui.drawn())).toContain(surface === 'desktop' ? '"type":"Svg"' : 'Tasks 1 running')
    await ui.unmount()
  }
})

test('the progress tool clamps a runaway total and answers the model', async ($, on) => {
  mock.clock(on, { now: 1_000 })
  on('ui.open', () => PLACED)
  const answer = await $.tool.call({ tool: TOOL, tool_use_id: 'p1', title: 'Big', total: 1e9, done: 3, phase: 'delegate' })
  expect(JSON.stringify(answer)).toContain('Tasks 3/50')
  const ui = await $.ui.mount({ plugin: PLUGIN, surface: 'desktop', component: 'AbovePrompt', props: BAND_PROPS })
  expect(JSON.stringify(await ui.drawn()).length).toBeLessThan(131072)
  await ui.unmount()
})

test('/agents-info opens the pane, and closes it only while it is shown', async ($, on) => {
  const open = new Map<string, boolean>()
  mock.clock(on, { now: 1_000 })
  on('ui.panes', () => ({
    value: [...open].map(([id, isPlaced]) => ({ id, title: id, isShown: isPlaced, isFocused: false, isPlaced })),
  }))
  on('ui.open', (_engine, e) => {
    open.set(e.id, true)
    return PLACED
  })
  on('ui.close', (_engine, e) => {
    open.delete(e.id)
    return { value: undefined }
  })
  const run = () => $.command.run({ ...COMMAND, command: 'agents-info', args: '' })
  expect((await run()).text).toBe('Agents panel opened.')
  expect((await run()).text).toBe('Agents panel closed.')
  open.set(PANE, false)
  expect((await run()).text).toBe('Agents panel opened.')
})

test('/look chatgpt repaints and switches the terminal theme; /look claude puts it back', async ($, on) => {
  let theme = 'light'
  mock.clock(on, { now: 1_000 })
  mock.store(on)
  on('config.list', () => ({
    value: [
      {
        key: 'theme',
        label: 'Theme',
        kind: 'choice',
        value: theme,
        options: ['dark', 'light', CHATGPT, 'custom:good-look-themes:webstorm-islands-dark'],
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

test('a finished worker stops counting as running', async ($, on) => {
  mock.clock(on, { now: 1_000 })
  on('agent.spawn', () => ({ agentId: 'a1', model: 'claude-haiku-5-5' }))
  on('ui.open', () => PLACED)
  on('turn.complete', () => ({ text: 'done' }))
  await $.agent.spawn({ ...SPAWN, description: 'Run tests', subagentType: 'good-look-light', tool_use_id: 't1' })
  const before = await $.ui.mount({ plugin: PLUGIN, surface: 'terminal', component: 'AbovePrompt', props: BAND_PROPS })
  expect(JSON.stringify(await before.drawn())).toContain('1 running')
  await before.unmount()
  await $.turn.complete({
    ...TURN,
    agentId: 'a1',
    reason: 'answer',
    usage: { model: 'claude-haiku-5-5', input_tokens: 1000, output_tokens: 200, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 },
  })
  const after = await $.ui.mount({ plugin: PLUGIN, surface: 'terminal', component: 'AbovePrompt', props: BAND_PROPS })
  expect(JSON.stringify(await after.drawn())).toContain('0 running')
  await after.unmount()
})
