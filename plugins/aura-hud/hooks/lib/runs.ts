import type { AgentRun, AgentStatus, Crew, Flow, PlannedTask, Tier } from '../../types'

import { MAX_RUNS, WORKER_PREFIX, WORKER_TIERS, WORKFLOW_AGENT } from './consts'
import type { StepInput } from './flow'
import { norm } from './format'
import { costOf, sumUsage, windowOf } from './model'
import type { Usage } from './model'

export type Planned = PlannedTask & { n: number }

export type Totals = { cost: number; tokens: number }

export type SpawnInput = { description: string; subagentType: string; tool_use_id: string; workflow?: { agentIndex: number } }

export type SpawnResult = { agentId?: string; model: string }

const bareType = (type: string): string => type.replace(/^[^:]*:/, '')

export const isWorkerType = (type: string): boolean => bareType(type).startsWith(WORKER_PREFIX)

export const tierOf = (type: string): Tier => {
  const bare = bareType(type)
  if (!bare.startsWith(WORKER_PREFIX)) return 'other'
  const t = bare.slice(WORKER_PREFIX.length).toLowerCase()
  return (WORKER_TIERS as readonly string[]).includes(t) ? (t as Tier) : 'other'
}

export const kindOf = (a: AgentRun): string => {
  const tier = tierOf(a.type)
  if (tier !== 'other') return tier
  return a.workflow && a.type === WORKFLOW_AGENT ? '' : a.type
}

export const COSTUMES_BY_MODEL = {
  fable: ['fable-wizard', 'fable-astronaut', 'fable-knight', 'fable-royal', 'fable-oracle', 'fable-dragon', 'fable-alchemist', 'fable-stargazer'],
  opus: ['opus-detective', 'opus-engineer', 'opus-professor', 'opus-surgeon', 'opus-judge', 'opus-captain', 'opus-scientist', 'opus-conductor'],
  sonnet: ['sonnet-chef', 'sonnet-painter', 'sonnet-poet', 'sonnet-musician', 'sonnet-barista', 'sonnet-gardener', 'sonnet-photographer', 'sonnet-dj'],
  haiku: ['haiku-racer', 'haiku-pirate', 'haiku-skater', 'haiku-ninja', 'haiku-courier', 'haiku-sprinter', 'haiku-surfer', 'haiku-pilot'],
} as const

type ModelFamily = keyof typeof COSTUMES_BY_MODEL

export type ModelCostume = (typeof COSTUMES_BY_MODEL)[ModelFamily][number]

export type Costume = Tier | 'explore' | ModelCostume

const ALL_MODEL_COSTUMES = new Set<string>(Object.values(COSTUMES_BY_MODEL).flat())

const isCostume = (value: string): value is Costume =>
  value === 'explore' || (['fable', 'heavy', 'careful', 'medium', 'light', 'other'] as readonly string[]).includes(value) || ALL_MODEL_COSTUMES.has(value)

const familyOf = (model: string): ModelFamily | null => {
  const name = /(?:^|[-:])(fable|opus|sonnet|haiku)(?:[-:]|$)/i.exec(model)?.[1]
  return name ? (name.toLowerCase() as ModelFamily) : null
}

const legacyCostumeOf = (type: string): Costume => (type === 'Explore' ? 'explore' : tierOf(type))

const stableIndex = (key: string, length: number): number => {
  let hash = 2166136261
  for (let i = 0; i < key.length; i += 1) hash = Math.imul(hash ^ key.charCodeAt(i), 16777619)
  return (hash >>> 0) % length
}

export const newCostumeOf = (type: string, model: string, random = Math.random): Costume => {
  const family = familyOf(model)
  if (!family) return model ? 'other' : legacyCostumeOf(type)
  const set = COSTUMES_BY_MODEL[family]
  return set[Math.min(set.length - 1, Math.floor(random() * set.length))] as Costume
}

export const costumeOf = (type: string, model = '', id = '', stored?: string): Costume => {
  if (stored && isCostume(stored)) return stored
  const family = familyOf(model)
  if (!family) return model ? 'other' : legacyCostumeOf(type)
  const set = COSTUMES_BY_MODEL[family]
  return set[stableIndex(id || `${type}/${model}`, set.length)] as Costume
}

export const plannedOf = (f: Flow | null, list: readonly AgentRun[]): Planned[] => {
  const tasks = f && !f.isFinished ? (f.tasks ?? []) : []
  if (!tasks.length) return []
  const started = new Set(list.map(a => norm(a.description)))
  return tasks.map((t, i) => ({ ...t, n: i + 1 })).filter(t => !started.has(norm(t.title)))
}

export const totalsOf = (list: readonly AgentRun[]): Totals => {
  let cost = 0
  let tokens = 0
  for (const a of list) {
    cost += a.costUsd
    tokens += a.tokens
  }
  return { cost, tokens }
}

export const progressOf = (a: AgentRun): number | null => {
  if (a.status === 'done') return 1
  if (a.stepTotal) return Math.min(1, (a.stepDone ?? 0) / a.stepTotal)
  return null
}

export const showsSteps = (a: AgentRun): boolean => Boolean(a.stepTotal) && a.status !== 'done'

export const ctxOf = (a: AgentRun): number =>
  a.contextMax ? Math.min(100, Math.round((a.contextTokens / a.contextMax) * 100)) : 0


export const addRun = (list: readonly AgentRun[], e: SpawnInput, started: SpawnResult, at: number, workflow?: string): AgentRun[] => {
  const key = norm(e.description)
  const round = 1 + (key ? list.filter(a => a.workflow === workflow && norm(a.description) === key).length : 0)
  const run: AgentRun = {
    id: started.agentId ?? (e.workflow ? `${e.tool_use_id}:${e.workflow.agentIndex}` : e.tool_use_id),
    agentId: started.agentId,
    workflow,
    type: e.subagentType,
    description: e.description,
    model: started.model,
    costume: newCostumeOf(e.subagentType, started.model),
    status: 'running',
    startedAt: at,
    contextTokens: 0,
    contextMax: windowOf(started.model),
    tokens: 0,
    costUsd: 0,
    steps: 0,
    round,
  }
  return [...list.filter(a => a.id !== run.id), run].slice(-MAX_RUNS)
}

export const patchRun = (list: AgentRun[], agentId: string, change: (a: AgentRun) => AgentRun): AgentRun[] => {
  const i = list.findIndex(a => a.agentId === agentId)
  const run = list[i]
  if (!run) return list
  const next = list.slice()
  next[i] = change(run)
  return next
}

export const applyStep = (a: AgentRun, model: string, effort: string | undefined, u: Usage): AgentRun => {
  const used = sumUsage(u)
  return {
    ...a,
    model,
    effort: effort ?? a.effort,
    status: 'running',
    endedAt: undefined,
    contextTokens: used,
    contextMax: windowOf(model),
    tokens: a.tokens + used,
    costUsd: a.costUsd + costOf(model, u),
    steps: a.steps + 1,
  }
}

export const finishRun = (a: AgentRun, isAnswer: boolean, at: number, usage?: Usage & { model?: string }): AgentRun => {
  const status: AgentStatus = isAnswer ? 'done' : 'failed'
  const ended = { ...a, status, endedAt: at }
  if (a.steps > 0 || !usage) return ended
  const model = usage.model || a.model
  return { ...ended, model, tokens: sumUsage(usage), costUsd: costOf(model, usage) }
}

export const applyStepReport = (a: AgentRun, input: StepInput): AgentRun => {
  const total = input.total ?? a.stepTotal ?? 0
  const done = input.done ?? a.stepDone ?? 0
  return { ...a, stepTotal: total, stepDone: total ? Math.min(total, done) : done, stepNote: input.note || undefined }
}

export const crewOf = (list: readonly AgentRun[]): Crew => {
  let running = 0
  let workers = 0
  for (const a of list) {
    if (a.status !== 'running') continue
    running += 1
    if (isWorkerType(a.type)) workers += 1
  }
  return { running, workers }
}

export const sameCrew = (a: Crew, b: Crew): boolean =>
  a.running === b.running && a.workers === b.workers
