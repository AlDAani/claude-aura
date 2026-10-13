import type { Phase, Tier } from '../../types'

export const WORKER_PREFIX = 'good-look-'
export const FLOW_TITLE = 'good-look-flow'

export const PHASES: readonly Phase[] = ['plan', 'design', 'delegate', 'review', 'close']
export const WORKER_TIERS: readonly Tier[] = ['fable', 'heavy', 'careful', 'medium', 'light']

export const MAX_TASKS = 50
export const MAX_TITLE = 80
export const MAX_TASK_TITLE = 120
export const MAX_NOTE = 80
export const MAX_STEPS = 50
export const MAX_RUNS = 200
export const MAX_FINISHED_ROWS = 40
export const MIN_TICK_GAP = 4
