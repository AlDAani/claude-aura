import type { AgentRun, AgentStatus, Crew, Flow, PlannedTask, Tier } from '../../types'

import { MAX_RUNS, WORKER_PREFIX, WORKER_TIERS } from './consts'
import type { StepInput } from './flow'
import { norm } from './format'
import { costOf, sumUsage, windowOf } from './model'
import type { Usage } from './model'

export type Costume = Tier | 'explore'

export type Planned = PlannedTask & { n: number }

export type Totals = { cost: number; tokens: number; time: number }

export type SpawnInput = { description: string; subagentType: string; tool_use_id: string }

export type SpawnResult = { agentId?: string; model: string }

const bareType = (type: string): string => type.replace(/^[^:]*:/, '')

export const isWorkerType = (type: string): boolean => bareType(type).startsWith(WORKER_PREFIX)

export const tierOf = (type: string): Tier => {
  const bare = bareType(type)
  if (!bare.startsWith(WORKER_PREFIX)) return 'other'
  const t = bare.slice(WORKER_PREFIX.length).toLowerCase()
  return (WORKER_TIERS as readonly string[]).includes(t) ? (t as Tier) : 'other'
}

export const costumeOf = (type: string): Costume => (type === 'Explore' ? 'explore' : tierOf(type))

export const plannedOf = (f: Flow | null, list: readonly AgentRun[]): Planned[] => {
  const tasks = f && !f.isFinished ? (f.tasks ?? []) : []
  if (!tasks.length) return []
  const started = new Set(list.map(a => norm(a.description)))
  return tasks.map((t, i) => ({ ...t, n: i + 1 })).filter(t => !started.has(norm(t.title)))
}

export const totalsOf = (list: readonly AgentRun[], at: number): Totals => {
  let cost = 0
  let tokens = 0
  let start = Infinity
  let end = -Infinity
  for (const a of list) {
    cost += a.costUsd
    tokens += a.tokens
    start = Math.min(start, a.startedAt)
    end = Math.max(end, a.endedAt ?? Math.max(at, a.startedAt))
  }
  return { cost, tokens, time: list.length ? end - start : 0 }
}

export const progressOf = (a: AgentRun): number | null => {
  if (a.status === 'done') return 1
  if (a.stepTotal) return Math.min(1, (a.stepDone ?? 0) / a.stepTotal)
  return null
}

export const showsSteps = (a: AgentRun): boolean => Boolean(a.stepTotal) && a.status !== 'done'

export const ctxOf = (a: AgentRun): number =>
  a.contextMax ? Math.min(100, Math.round((a.contextTokens / a.contextMax) * 100)) : 0

export const elapsedOf = (a: AgentRun, at: number): number => (a.endedAt ?? Math.max(at, a.startedAt)) - a.startedAt

export const addRun = (list: readonly AgentRun[], e: SpawnInput, started: SpawnResult, at: number): AgentRun[] => {
  const key = norm(e.description)
  const round = 1 + (key ? list.filter(a => norm(a.description) === key).length : 0)
  const run: AgentRun = {
    id: started.agentId ?? e.tool_use_id,
    agentId: started.agentId,
    type: e.subagentType,
    description: e.description,
    model: started.model,
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
