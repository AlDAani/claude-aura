import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Crew, Look, LookSetting } from '../types'

import { MAX_NOTE, MAX_STEPS, MAX_TASK_TITLE, MAX_TASKS, MAX_TITLE, PHASES, WORKER_TIERS } from './lib/consts'
import { blank, isNewFlow, label, merge, readProgress, readStep, workerFlow } from './lib/flow'
import { isLookSetting, lookOfTheme, paletteOf, THEME_OF, THEME_PREFIX } from './lib/palette'
import { addRun, applyStep, applyStepReport, crewOf, finishRun, isWorkerType, patchRun, sameCrew } from './lib/runs'
import { S } from './lib/strings'
import { bandTree } from './views/band'
import { paneTree } from './views/pane'

const flow = atom({ plugin: 'aura-hud', key: 'flow' } as const, null)
const agents = atom({ plugin: 'aura-hud', key: 'agents' } as const, [])
const crew = atom({ plugin: 'aura-hud', key: 'crew' } as const, { size: 0, running: 0, workers: 0 })
const panel = atom({ plugin: 'aura-hud', key: 'panel' } as const, {
  isCompact: false,
  isDoneCollapsed: false,
  autoOpenedFor: '',
})
const now = atom({ plugin: 'aura-hud', key: 'now' } as const, 0)
const look = atom({ plugin: 'aura-hud', key: 'look' } as const, 'claude')

const TOOL = 'mcp__aura-hud__progress'
const STEP_TOOL = 'mcp__aura-hud__step'
const PANE = 'aura-agents'
const LOOK_KEY = 'look'
const PREVIOUS_THEME_KEY = 'themeBeforeLook'

const quietly = async (work: () => Promise<unknown>): Promise<void> => {
  try {
    await work()
  } catch {
    return
  }
}

async function syncCrew($: EngineInterface): Promise<Crew> {
  const next = crewOf(await read($, flow), await read($, agents))
  await update($, crew, prev => (sameCrew(prev, next) ? prev : next))
  return next
}

async function togglePane($: EngineInterface): Promise<boolean> {
  const pane = (await $.ui.panes()).find(p => p.id === PANE)
  if (pane?.isPlaced && pane.isShown) {
    await $.ui.close({ id: PANE })
    return false
  }
  const at = await $.clock.now()
  await update($, now, () => at)
  await $.ui.open({ id: PANE, title: S.pane })
  return true
}

async function autoOpen($: EngineInterface, key: string): Promise<void> {
  if ((await read($, panel)).autoOpenedFor === key) return
  await update($, panel, prev => ({ ...prev, autoOpenedFor: key }))
  void $.ui.open({ id: PANE, title: S.pane }).catch(() => undefined)
}

async function dismissFlow($: EngineInterface): Promise<void> {
  await update($, flow, () => null)
  await syncCrew($)
}

async function tick($: EngineInterface): Promise<void> {
  if (!(await read($, crew)).running) return
  const pane = (await $.ui.panes()).find(p => p.id === PANE)
  if (!pane?.isShown || !pane.isPlaced) return
  const at = await $.clock.now()
  await update($, now, () => at)
}

async function storedLook($: EngineInterface): Promise<LookSetting> {
  try {
    const value = await $.store.get(LOOK_KEY)
    return typeof value === 'string' && isLookSetting(value) ? value : 'auto'
  } catch {
    return 'auto'
  }
}

async function themeRow($: EngineInterface) {
  try {
    return (await $.config.list()).find(row => row.key === 'theme')
  } catch {
    return undefined
  }
}

async function refreshLook($: EngineInterface): Promise<Look> {
  const setting = await storedLook($)
  const id: Look = setting === 'auto' ? lookOfTheme((await themeRow($))?.value) : setting
  await update($, look, prev => (prev === id ? prev : id))
  return id
}

async function syncTheme($: EngineInterface, setting: LookSetting): Promise<string> {
  const row = await themeRow($)
  if (!row) return ''
  const current = typeof row.value === 'string' ? row.value : ''
  const isOurs = current.startsWith(THEME_PREFIX)
  if (setting === 'chatgpt' || setting === 'webstorm') {
    const target = THEME_OF[setting]
    if (current === target) return ''
    if (!row.options?.includes(target)) return S.themePick(paletteOf(setting).name)
    if (!isOurs) await $.store.set(PREVIOUS_THEME_KEY, current)
    const { deny } = await $.config.set({ key: 'theme', value: target })
    return deny ? S.themeKept(deny) : S.themeSet(paletteOf(setting).name)
  }
  if (setting === 'claude' && isOurs) {
    const previous = await $.store.get(PREVIOUS_THEME_KEY)
    const back = typeof previous === 'string' && previous && !previous.startsWith(THEME_PREFIX) ? previous : 'dark'
    const { deny } = await $.config.set({ key: 'theme', value: back })
    return deny ? S.themeKept(deny) : S.themeBack(back)
  }
  return ''
}

async function setLook($: EngineInterface, args: string): Promise<string> {
  const arg = args.trim().toLowerCase()
  if (!arg) return S.lookIs(await storedLook($), paletteOf(await refreshLook($)).name)
  if (!isLookSetting(arg)) return S.lookUnknown(arg)
  await $.store.set(LOOK_KEY, arg)
  const note = await syncTheme($, arg).catch(() => '')
  const name = paletteOf(await refreshLook($)).name
  const at = await $.clock.now()
  await update($, now, () => at)
  await $.ui.open({ id: PANE, title: S.pane }).catch(() => undefined)
  return S.lookSet(name) + note
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const started = await next(e)
    await $.tool.register({
      name: 'progress',
      description:
        'Report /flow progress to the progress bar above the prompt and the agents panel. ' +
        'Call it after presenting the plan (title, total, tasks, phase "delegate"), each time a task is accepted (done), ' +
        'when switching phase or re-planning (tasks), and once at the end with finished: true. Fields left out keep their previous value.',
      inputSchema: {
        type: 'object',
        properties: {
          title: { type: 'string', maxLength: MAX_TITLE, description: 'Short name of the overall task, a few words.' },
          total: { type: 'integer', minimum: 0, maximum: MAX_TASKS, description: 'Number of planned worker tasks.' },
          done: { type: 'integer', minimum: 0, maximum: MAX_TASKS, description: 'Number of tasks accepted after review.' },
          phase: { type: 'string', enum: [...PHASES] },
          finished: { type: 'boolean', description: 'True once the flow is closed.' },
          tasks: {
            type: 'array',
            maxItems: MAX_TASKS,
            description:
              'The planned worker tasks in order, numbered from 1. Each title must equal the Agent tool `description` the task will be delegated with, so the panel can match runs to tasks.',
            items: {
              type: 'object',
              properties: {
                title: { type: 'string', maxLength: MAX_TASK_TITLE, description: 'A few words; reused verbatim as the Agent description.' },
                tier: { type: 'string', enum: [...WORKER_TIERS] },
                after: {
                  type: 'array',
                  items: { type: 'integer', minimum: 1, maximum: MAX_TASKS },
                  description: 'Numbers of the tasks this one waits for.',
                },
              },
              required: ['title', 'tier'],
            },
          },
        },
      },
    })
    await $.tool.register({
      name: 'step',
      description:
        'For aura-flow workers: report progress on your own task to the agents panel. ' +
        'Right after reading the brief, call it with `total` (your plan in 3-8 steps) and `done: 0`; ' +
        'call it again as each step finishes. Cheap and silent: it only draws a bar.',
      inputSchema: {
        type: 'object',
        properties: {
          done: { type: 'integer', minimum: 0, maximum: MAX_STEPS, description: 'Steps finished so far.' },
          total: { type: 'integer', minimum: 1, maximum: MAX_STEPS, description: 'Steps planned; may change if the plan changes.' },
          note: { type: 'string', maxLength: MAX_NOTE, description: 'The step in progress, a few words.' },
        },
        required: ['done'],
      },
    })
    await $.command.register({
      name: 'look',
      description: 'Pick the palette of the agents panel and band: auto, claude, chatgpt or webstorm',
      argumentHint: '[auto|claude|chatgpt|webstorm]',
    })
    await quietly(() => refreshLook($))
    $.clock.every(1000, () => void quietly(() => tick($)))
    return started
  })

  on('command.run', { command: 'look' }, async ($, e) => ({ text: await setLook($, e.args) }))

  on('config.set', { key: 'theme' }, async ($, e, next) => {
    const written = await next(e)
    await quietly(() => refreshLook($))
    return written
  })

  on('tool.call', { tool: TOOL }, async ($, e) => {
    const input = readProgress(e)
    if (input.title !== undefined && isNewFlow(await read($, flow), input)) {
      await update($, agents, list => list.filter(a => a.status === 'running'))
    }
    const next = await update($, flow, prev => merge(prev, input))
    const c = await syncCrew($)
    if (next && input.tasks?.length) await autoOpen($, next.title)
    return { result: `ok: ${label(next ?? blank(), c.workers)}` }
  }).catch(() => ({ result: 'ignored: the progress bar could not record this' }))

  on('tool.call', { tool: STEP_TOOL }, async ($, e) => {
    const agentId = e.agentId
    if (!agentId) return { result: 'ignored: only subagents report steps' }
    const input = readStep(e)
    await update($, agents, list => patchRun(list, agentId, a => applyStepReport(a, input)))
    return { result: 'ok' }
  }).catch(() => ({ result: 'ignored: the step could not be recorded' }))

  on('agent.spawn', async ($, e, next) => {
    const started = await next(e)
    if (started.deny !== undefined) return started
    await quietly(async () => {
      const at = await $.clock.now()
      const wasIdle = (await read($, crew)).running === 0
      await update($, agents, list => addRun(list, e, started, at))
      if (isWorkerType(e.subagentType)) await update($, flow, workerFlow)
      await syncCrew($)
      await update($, now, () => at)
      if (wasIdle) await autoOpen($, `agents-${at}`)
    })
    return started
  })

  on('turn.step', async function* ($, e, next) {
    const result = yield* next(e)
    const agentId = e.agentId
    const usage = result.usage
    if (!agentId || !usage) return result
    const model = usage.model || e.model || ''
    const effort = typeof e.effort === 'string' ? e.effort : undefined
    const seen = { woke: false }
    await quietly(async () => {
      await update($, agents, list =>
        patchRun(list, agentId, a => {
          seen.woke = a.status !== 'running'
          return applyStep(a, model, effort, usage)
        }),
      )
      if (seen.woke) await syncCrew($)
    })
    return result
  })

  on('turn.complete', async ($, e, next) => {
    const agentId = e.agentId
    if (agentId) {
      await quietly(async () => {
        const at = await $.clock.now()
        await update($, agents, list => patchRun(list, agentId, a => finishRun(a, e.reason === 'answer', at, e.usage)))
        await syncCrew($)
        await update($, now, () => at)
      })
    }
    return next(e)
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const list = await read($, agents)
    const at = Math.max(await read($, now), ...list.map(a => a.startedAt), 0)
    return paneTree(
      $.ui.resolve(e),
      {
        surface: e.surface,
        list,
        flow: await read($, flow),
        panel: await read($, panel),
        look: await read($, look),
        at,
        bodyColumns: e.props.bodyColumns,
      },
      {
        toggleCompact: () => update($, panel, prev => ({ ...prev, isCompact: !prev.isCompact })),
        toggleDone: () => update($, panel, prev => ({ ...prev, isDoneCollapsed: !prev.isDoneCollapsed })),
      },
    )
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const f = await read($, flow)
    if (f === null || e.props.hasSurvey) return next(e)
    return bandTree(
      $.ui.resolve(e),
      { surface: e.surface, flow: f, crew: await read($, crew), look: await read($, look), bodyColumns: e.props.bodyColumns },
      { toggle: () => void togglePane($), dismiss: () => dismissFlow($) },
    )
  })
}
