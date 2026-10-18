import type { AgentRun, AgentStatus, Tier, WorkflowRun } from '../../types'

import { MAX_OPEN_GROUPS, MAX_TITLE, MAX_WORKFLOWS } from './consts'
import { capText } from './format'
import { plural, S } from './strings'

export type WorkflowNote = { runId: string; callId: string; name: string }

export type Group = {
  id: string
  name: string
  tone: Tier
  runs: AgentRun[]
  running: number
  done: number
  failed: number
  cost: number
  status: AgentStatus
  startedAt: number
  first: number
}

export type Item = { kind: 'group'; group: Group } | { kind: 'run'; run: AgentRun }

export type Sections = { running: Item[]; finished: Item[]; finishedAgents: number }

export type SectionNote = { failed: number; cost: number }

type Entry = { item: Item; at: number; n: number; agents: number; isLive: boolean }

const TONES: readonly Tier[] = ['medium', 'fable', 'light', 'careful', 'heavy']
const META_SPAN = 4000
const META_NAME = /\bmeta\s*=\s*\{[\s\S]*?\bname\s*:\s*(['"`])([^'"`\n]+)\1/

const textOf = (v: unknown): string => (typeof v === 'string' ? v : '')

const fieldsOf = (v: unknown): Readonly<Record<string, unknown>> => (typeof v === 'object' && v !== null ? (v as Record<string, unknown>) : {})

const stemOf = (path: string): string => (path.split(/[\\/]/).pop() ?? '').replace(/\.[^.]+$/, '')

export const readWorkflowCall = (e: unknown): WorkflowNote => {
  const o = fieldsOf(e)
  const name = META_NAME.exec(textOf(o.script).slice(0, META_SPAN))?.[2] || textOf(o.name) || stemOf(textOf(o.scriptPath))
  return { runId: textOf(o.resumeFromRunId), callId: textOf(o.tool_use_id), name: capText(name, MAX_TITLE) }
}

export const readWorkflowResult = (answer: unknown, callId: string): WorkflowNote => {
  const o = fieldsOf(fieldsOf(answer).result)
  return { runId: textOf(o.runId), callId, name: capText(o.workflowName, MAX_TITLE) }
}

const matches = (w: WorkflowRun, note: WorkflowNote): boolean =>
  (note.runId !== '' && w.runId === note.runId) || (note.callId !== '' && w.callId === note.callId)

export const noteWorkflow = (list: WorkflowRun[], note: WorkflowNote, at: number): WorkflowRun[] => {
  const i = list.findIndex(w => matches(w, note))
  const found = list[i]
  if (!found) {
    const id = note.runId || note.callId
    if (!id) return list
    const tone = ((list.at(-1)?.tone ?? -1) + 1) % TONES.length
    return [...list, { id, runId: note.runId, callId: note.callId, name: note.name, tone, startedAt: at }].slice(-MAX_WORKFLOWS)
  }
  const next = { ...found, runId: found.runId || note.runId, callId: note.callId || found.callId, name: note.name || found.name }
  if (next.runId === found.runId && next.callId === found.callId && next.name === found.name) return list
  return list.map((w, n) => (n === i ? next : w))
}

export const workflowIdOf = (list: readonly WorkflowRun[], note: WorkflowNote): string | undefined => list.find(w => matches(w, note))?.id

export const workflowNameOf = (list: readonly WorkflowRun[], id: string | undefined): string =>
  id ? list.find(w => w.id === id)?.name || S.workflow : ''

const toneAt = (n: number): Tier => TONES[n % TONES.length] ?? 'medium'

export const groupsOf = (list: readonly AgentRun[], records: readonly WorkflowRun[]): Map<string, Group> => {
  const byId = new Map(records.map(w => [w.id, w]))
  const groups = new Map<string, Group>()
  list.forEach((a, n) => {
    if (!a.workflow) return
    const w = byId.get(a.workflow)
    const g: Group = groups.get(a.workflow) ?? {
      id: a.workflow,
      name: w?.name || S.workflow,
      tone: toneAt(w?.tone ?? groups.size),
      runs: [],
      running: 0,
      done: 0,
      failed: 0,
      cost: 0,
      status: 'done',
      startedAt: a.startedAt,
      first: n,
    }
    groups.set(a.workflow, g)
    g.runs.push(a)
    g.cost += a.costUsd
    if (a.status === 'running') g.running += 1
    else if (a.status === 'failed') g.failed += 1
    else g.done += 1
    g.status = g.running ? 'running' : g.done === 0 ? 'failed' : 'done'
  })
  return groups
}

export const sectionsOf = (list: readonly AgentRun[], groups: ReadonlyMap<string, Group>): Sections => {
  const entries: Entry[] = []
  list.forEach((run, n) => {
    if (!run.workflow) entries.push({ item: { kind: 'run', run }, at: run.startedAt, n, agents: 1, isLive: run.status === 'running' })
  })
  for (const group of groups.values()) {
    entries.push({ item: { kind: 'group', group }, at: group.startedAt, n: group.first, agents: group.runs.length, isLive: group.status === 'running' })
  }
  entries.sort((x, y) => y.at - x.at || y.n - x.n)
  const finished = entries.filter(x => !x.isLive)
  return {
    running: entries.filter(x => x.isLive).map(x => x.item),
    finished: finished.map(x => x.item),
    finishedAgents: finished.reduce((sum, x) => sum + x.agents, 0),
  }
}

const agentsOf = (it: Item): readonly AgentRun[] => (it.kind === 'group' ? it.group.runs : [it.run])

export const noteOf = (items: readonly Item[]): SectionNote => {
  const agents = items.flatMap(agentsOf)
  return { failed: agents.filter(a => a.status === 'failed').length, cost: agents.reduce((sum, a) => sum + a.costUsd, 0) }
}

export const rowsOf = (g: Group): AgentRun[] => [
  ...g.runs.filter(a => a.status === 'running').reverse(),
  ...g.runs.filter(a => a.status !== 'running').reverse(),
]

export const isGroupOpen = (g: Group, open: Readonly<Record<string, boolean>> | undefined): boolean => {
  const chosen = open?.[g.id]
  return typeof chosen === 'boolean' ? chosen : g.status === 'running'
}

export const withOpen = (open: Readonly<Record<string, boolean>> | undefined, id: string, isOpen: boolean): Record<string, boolean> => {
  const kept = Object.entries(open ?? {}).filter(([key]) => key !== id).slice(1 - MAX_OPEN_GROUPS)
  return Object.fromEntries([...kept, [id, isOpen]])
}

export const groupParts = (g: Group): string[] =>
  [`${g.runs.length} ${plural(g.runs.length, 'agent', 'agents')}`, g.running ? `${g.running} ${S.isRunning}` : ''].filter(Boolean)

export const failedPart = (g: Group): string => (g.failed ? `${g.failed} ${S.isFailed}` : '')
