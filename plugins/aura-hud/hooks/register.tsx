import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, UiScrollBlock, UiScrollTarget } from 'claude-code'

import type { AgentRun, Crew, Look, LookSetting } from '../types'

import { MAX_NOTE, MAX_STEPS, MAX_TASK_TITLE, MAX_TASKS, MAX_TITLE, PHASES, WORKER_TIERS } from './lib/consts'
import { blank, isNewFlow, label, merge, readProgress, readStep, workerFlow } from './lib/flow'
import { historyOf } from './lib/history'
import type { History } from './lib/history'
import { contextPercentOf } from './lib/model'
import { toggledSection } from './lib/panel'
import { isLookSetting, lookOfTheme, paletteOf } from './lib/palette'
import { addRun, applyStep, applyStepReport, crewOf, finishRun, isWorkerType, patchRun, sameCrew } from './lib/runs'
import { S } from './lib/strings'
import { noteWorkflow, readWorkflowCall, readWorkflowResult, withOpen, workflowIdOf, workflowNameOf } from './lib/workflows'
import type { WorkflowNote } from './lib/workflows'
import { historyTree } from './views/history'
import { paneTree } from './views/pane'

const flow = atom({ plugin: 'aura-hud', key: 'flow' } as const, null)
const agents = atom({ plugin: 'aura-hud', key: 'agents' } as const, [])
const workflows = atom({ plugin: 'aura-hud', key: 'workflows' } as const, [])
const crew = atom({ plugin: 'aura-hud', key: 'crew' } as const, { running: 0, workers: 0 })
const panel = atom({ plugin: 'aura-hud', key: 'panel' } as const, {
  isCompact: false,
  isRunCollapsed: false,
  isDoneCollapsed: false,
  isPlanCollapsed: false,
  autoOpenedFor: '',
  openRun: '',
  isBriefOpen: false,
  openGroups: {},
})
const look = atom({ plugin: 'aura-hud', key: 'look' } as const, 'claude')
const total = atom({ plugin: 'aura-hud', key: 'total' } as const, null)
const mainContext = atom({ plugin: 'aura-hud', key: 'context' } as const, null)

const TOOL = 'mcp__aura-hud__progress'
const STEP_TOOL = 'mcp__aura-hud__step'
const PANE = 'aura-agents'
const LOOK_KEY = 'look'
const HISTORY_ITEMS = 150
const HISTORY_CACHE = 24
const REVEAL_AFTER_MS = 60
const RECOUNT_AFTER_MS = [400, 2_500] as const
const RECOUNT_EVERY_MS = 5_000

const histories = new Map<string, { key: string; found: History | string }>()
const recounted = { at: Number.NEGATIVE_INFINITY }

const quietly = async (work: () => Promise<unknown>): Promise<void> => {
  try {
    await work()
  } catch {
    return
  }
}

async function syncCrew($: EngineInterface): Promise<Crew> {
  const next = crewOf(await read($, agents))
  await update($, crew, prev => (sameCrew(prev, next) ? prev : next))
  return next
}

async function autoOpen($: EngineInterface, key: string): Promise<void> {
  if ((await read($, panel)).autoOpenedFor === key) return
  await update($, panel, prev => ({ ...prev, autoOpenedFor: key, openRun: '' }))
  void $.ui.open({ id: PANE, title: S.pane }).catch(() => undefined)
}

async function setTotal($: EngineInterface, usd: number | undefined): Promise<void> {
  if (typeof usd !== 'number' || !Number.isFinite(usd)) return
  const next = Math.round(usd * 100) / 100
  await update($, total, prev => (prev === next ? prev : next))
}

async function setContext($: EngineInterface, percent: number | undefined): Promise<void> {
  if (typeof percent !== 'number' || !Number.isFinite(percent)) return
  const next = Math.max(0, Math.min(100, Math.round(percent)))
  await update($, mainContext, prev => (prev === next ? prev : next))
}

async function recountContext($: EngineInterface): Promise<void> {
  const { context } = await $.session.usage({ breakdown: 'summary' })
  const next = contextPercentOf(context)
  await update($, mainContext, prev => (prev === next ? prev : next))
}

async function recountSoon($: EngineInterface): Promise<void> {
  for (const ms of RECOUNT_AFTER_MS) $.clock.after(ms, () => void quietly(() => recountContext($)))
}

async function syncTotal($: EngineInterface, isFresh = false): Promise<void> {
  const usage = await $.session.usage()
  await setTotal($, usage.cost?.usd)
  if (typeof usage.context.percent === 'number') return setContext($, usage.context.percent)
  const at = await $.clock.now()
  if (!isFresh && at - recounted.at < RECOUNT_EVERY_MS) return
  recounted.at = at
  await recountContext($)
}

async function joinWorkflow($: EngineInterface, note: WorkflowNote): Promise<string | undefined> {
  const at = await $.clock.now()
  return workflowIdOf(await update($, workflows, list => noteWorkflow(list, note, at)), note)
}

async function historyFor($: EngineInterface, run: AgentRun, agentId: string): Promise<History | string> {
  const key = [run.steps, run.status, run.round, run.stepDone ?? ''].join('|')
  const hit = histories.get(run.id)
  if (hit?.key === key) return hit.found
  const read = await $.session.messages({ agentId })
  const found = 'deny' in read ? read.deny : historyOf(read, HISTORY_ITEMS)
  if (histories.size >= HISTORY_CACHE) histories.clear()
  histories.set(run.id, { key, found })
  return found
}

async function reveal($: EngineInterface, to: UiScrollTarget, block: UiScrollBlock): Promise<void> {
  await $.clock.sleep(REVEAL_AFTER_MS)
  await $.ui.scroll({ in: PANE, to, block })
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

async function setLook($: EngineInterface, args: string): Promise<string> {
  const arg = args.trim().toLowerCase()
  if (!arg) return S.lookIs(await storedLook($), paletteOf(await refreshLook($)).name)
  if (!isLookSetting(arg)) return S.lookUnknown(arg)
  await $.store.set(LOOK_KEY, arg)
  const name = paletteOf(await refreshLook($)).name
  await $.ui.open({ id: PANE, title: S.pane }).catch(() => undefined)
  return S.lookSet(name)
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const started = await next(e)
    await $.tool.register({
      name: 'progress',
      description:
        'Report /flow progress to the agents panel: the plan, the phase and the tasks accepted so far. ' +
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
      description: 'Pick the palette of the agents panel: auto, claude, chatgpt or webstorm',
      argumentHint: '[auto|claude|chatgpt|webstorm]',
      immediate: true,
    })
    await $.command.register({ name: 'hud', description: 'Open the agents panel', immediate: true })
    await quietly(() => refreshLook($))
    await quietly(() => syncTotal($, true))
    return started
  })

  on('session.measure', async ($, e, next) => {
    const measured = await next(e)
    await quietly(() => setTotal($, e.cost?.usd))
    await quietly(() => (typeof e.context.percent === 'number' ? setContext($, e.context.percent) : recountContext($)))
    return measured
  })

  on('session.compact', async ($, e, next) => {
    const compacted = await next(e)
    if (!e.agentId && e.trigger !== 'precompute' && compacted.skip === undefined) await quietly(() => recountSoon($))
    return compacted
  })

  on('session.end', async ($, e, next) => {
    const ended = await next(e)
    if (e.reason === 'clear') await quietly(() => recountSoon($))
    return ended
  })

  on('tool.call', { tool: 'Workflow' }, async ($, e, next) => {
    const call = readWorkflowCall(e)
    await quietly(() => joinWorkflow($, call))
    const answer = await next(e)
    await quietly(() => joinWorkflow($, readWorkflowResult(answer, call.callId)))
    return answer
  })

  on('command.run', { command: 'look' }, async ($, e) => ({ text: await setLook($, e.args) }))

  on('command.run', { command: 'hud' }, async $ => {
    await update($, panel, prev => ({ ...prev, openRun: '' }))
    await $.ui.open({ id: PANE, title: S.pane, focus: true }).catch(() => undefined)
    return {}
  })

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
  }).catch(() => ({ result: 'ignored: the agents panel could not record this' }))

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
      const group = e.workflow ? await joinWorkflow($, { runId: e.workflow.runId, callId: e.tool_use_id, name: '' }) : undefined
      await update($, agents, list => addRun(list, e, started, at, group))
      if (isWorkerType(e.subagentType)) await update($, flow, workerFlow)
      await syncCrew($)
      if (wasIdle) await autoOpen($, `agents-${at}`)
    })
    return started
  })

  on('turn.step', async function* ($, e, next) {
    const result = yield* next(e)
    const agentId = e.agentId
    const usage = result.usage
    if (usage) void quietly(() => syncTotal($))
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
      })
    }
    return next(e)
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const ui = $.ui.resolve(e)
    const list = await read($, agents)
    const records = await read($, workflows)
    const p = await read($, panel)
    const lookId = await read($, look)
    const at = await $.clock.now()
    const opened = p.openRun ? list.find(a => a.id === p.openRun) : undefined
    if (opened?.agentId) {
      const found = await historyFor($, opened, opened.agentId).catch(() => '')
      return historyTree(
        ui,
        {
          surface: e.surface,
          run: opened,
          workflow: workflowNameOf(records, opened.workflow),
          history: typeof found === 'string' ? null : found,
          deny: typeof found === 'string' ? found : '',
          isBriefOpen: Boolean(p.isBriefOpen),
          look: lookId,
          at,
          bodyColumns: e.props.bodyColumns,
        },
        {
          back: () => {
            void update($, panel, prev => ({ ...prev, openRun: '' })).then(() => quietly(() => reveal($, { key: opened.id }, 'center')))
          },
          toggleBrief: () => update($, panel, prev => ({ ...prev, isBriefOpen: !prev.isBriefOpen })),
        },
      )
    }
    return paneTree(
      ui,
      {
        surface: e.surface,
        list,
        workflows: records,
        flow: await read($, flow),
        panel: p,
        look: lookId,
        total: await read($, total),
        context: await read($, mainContext),
        at,
        bodyColumns: e.props.bodyColumns,
      },
      {
        toggleCompact: () => update($, panel, prev => ({ ...prev, isCompact: !prev.isCompact })),
        toggleSection: key => update($, panel, prev => toggledSection(prev, key)),
        toggleGroup: (id, isOpen) => update($, panel, prev => ({ ...prev, openGroups: withOpen(prev.openGroups, id, !isOpen) })),
        openRun: id => {
          void update($, panel, prev => ({ ...prev, openRun: id, isBriefOpen: false })).then(() => quietly(() => reveal($, 'end', 'end')))
        },
      },
    )
  })
}
