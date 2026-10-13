import type { Flow, Phase, PlannedTask, Tier } from '../../types'

import { FLOW_TITLE, MAX_STEPS, MAX_TASK_TITLE, MAX_TASKS, MAX_TITLE, MAX_NOTE, PHASES, WORKER_PREFIX, WORKER_TIERS } from './consts'
import { capText, intIn } from './format'
import { S } from './strings'

export type ProgressInput = {
  title?: string
  total?: number
  done?: number
  phase?: Phase
  isFinished?: boolean
  tasks?: PlannedTask[]
}

export type StepInput = { done?: number; total?: number; note?: string }

const asTier = (v: unknown): Tier => {
  const t = typeof v === 'string' ? v.trim().toLowerCase().replace(/^[^:]*:/, '').replace(WORKER_PREFIX, '') : ''
  return (WORKER_TIERS as readonly string[]).includes(t) ? (t as Tier) : 'other'
}

const asTask = (v: unknown): PlannedTask | null => {
  if (typeof v !== 'object' || v === null) return null
  const raw = v as Record<string, unknown>
  const title = capText(raw.title, MAX_TASK_TITLE)
  if (!title) return null
  const after = Array.isArray(raw.after)
    ? [...new Set(raw.after.map(n => intIn(n, 1, MAX_TASKS)).filter((n): n is number => n !== undefined))]
    : []
  return { title, tier: asTier(raw.tier), after }
}

export const readProgress = (e: unknown): ProgressInput => {
  const raw = (typeof e === 'object' && e !== null ? e : {}) as Record<string, unknown>
  const input: ProgressInput = {}
  const title = capText(raw.title, MAX_TITLE)
  if (title) input.title = title
  const total = intIn(raw.total, 0, MAX_TASKS)
  if (total !== undefined) input.total = total
  const done = intIn(raw.done, 0, MAX_TASKS)
  if (done !== undefined) input.done = done
  if (typeof raw.phase === 'string' && (PHASES as readonly string[]).includes(raw.phase)) input.phase = raw.phase as Phase
  if (raw.finished === true) input.isFinished = true
  if (Array.isArray(raw.tasks))
    input.tasks = raw.tasks
      .slice(0, MAX_TASKS)
      .map(asTask)
      .filter((t): t is PlannedTask => t !== null)
  return input
}

export const readStep = (e: unknown): StepInput => {
  const raw = (typeof e === 'object' && e !== null ? e : {}) as Record<string, unknown>
  const input: StepInput = {}
  const done = intIn(raw.done, 0, MAX_STEPS)
  if (done !== undefined) input.done = done
  const total = intIn(raw.total, 1, MAX_STEPS)
  if (total !== undefined) input.total = total
  if (typeof raw.note === 'string') input.note = capText(raw.note, MAX_NOTE)
  return input
}

export const blank = (): Flow => ({
  title: FLOW_TITLE,
  total: 0,
  done: 0,
  phase: 'plan',
  isFinished: false,
  tasks: [],
})

export const isNewFlow = (prev: Flow | null, input: ProgressInput): boolean =>
  !prev || prev.isFinished || (input.title !== undefined && input.title !== prev.title)

export const merge = (prev: Flow | null, input: ProgressInput): Flow => {
  const base = !prev || isNewFlow(prev, input) ? blank() : { ...blank(), ...prev }
  const tasks = input.tasks ?? base.tasks
  const total = Math.min(MAX_TASKS, input.total ?? (input.tasks ? tasks.length : base.total))
  const done = Math.min(total || MAX_TASKS, input.done ?? base.done)
  return {
    title: input.title || base.title,
    total,
    done,
    phase: input.isFinished ? 'close' : (input.phase ?? base.phase),
    isFinished: input.isFinished === true,
    tasks,
  }
}

export const workerFlow = (prev: Flow | null): Flow => {
  const base = prev && !prev.isFinished ? prev : blank()
  return base.phase === 'plan' ? { ...base, phase: 'delegate' } : base
}


export const label = (f: Flow, workers: number): string => {
  if (f.isFinished) return S.done
  if (f.phase === 'plan') return S.plan
  if (f.phase === 'design') return S.design
  const count = f.total ? `${f.done}/${f.total}` : `${workers} ${S.busy}`
  return `${f.phase === 'review' ? S.review : S.tasks} ${count}`
}
