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
  costume?: string
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
  workflow?: string
}

export type WorkflowRun = {
  id: string
  runId: string
  callId: string
  name: string
  tone: number
  startedAt: number
}

export type Crew = {
  running: number
  workers: number
}

export type Panel = {
  isCompact: boolean
  isRunCollapsed?: boolean
  isDoneCollapsed: boolean
  isPlanCollapsed?: boolean
  autoOpenedFor: string
  openRun: string
  isBriefOpen: boolean
  openGroups?: Record<string, boolean>
}

declare module 'claude-code' {
  interface PluginState {
    'aura-hud': {
      flow: Flow | null
      agents: AgentRun[]
      workflows: WorkflowRun[]
      crew: Crew
      panel: Panel
      look: Look
      total: number | null
      context: number | null
    }
  }
}
