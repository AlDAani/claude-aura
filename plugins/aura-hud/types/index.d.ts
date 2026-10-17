export type Phase = 'plan' | 'design' | 'delegate' | 'review' | 'close'

export type Tier = 'fable' | 'heavy' | 'careful' | 'medium' | 'light' | 'other'

export type Look = 'claude' | 'chatgpt' | 'webstorm'

export type LookSetting = 'auto' | Look

export type PlannedTask = {
  title: string
  tier: Tier
  after: number[]
}

export type Flow = {
  title: string
  total: number
  done: number
  phase: Phase
  isFinished: boolean
  tasks: PlannedTask[]
}

export type AgentStatus = 'running' | 'done' | 'failed'

export type AgentRun = {
  id: string
  agentId?: string
  type: string
  description: string
  model: string
  effort?: string
  status: AgentStatus
  startedAt: number
  endedAt?: number
  contextTokens: number
  contextMax: number
  tokens: number
  costUsd: number
  steps: number
  round: number
  stepDone?: number
  stepTotal?: number
  stepNote?: string
}

export type Crew = {
  running: number
  workers: number
}

export type Panel = {
  isCompact: boolean
  isDoneCollapsed: boolean
  autoOpenedFor: string
  openRun: string
  isBriefOpen: boolean
}

declare module 'claude-code' {
  interface PluginState {
    'aura-hud': {
      flow: Flow | null
      agents: AgentRun[]
      crew: Crew
      panel: Panel
      now: number
      look: Look
      total: number | null
    }
  }
}
