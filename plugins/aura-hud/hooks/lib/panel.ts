import type { Panel } from '../../types'

export type SectionKey = 'running' | 'finished' | 'planned'

const FIELD = { running: 'isRunCollapsed', finished: 'isDoneCollapsed', planned: 'isPlanCollapsed' } as const

export const isFolded = (p: Panel, key: SectionKey): boolean => Boolean(p[FIELD[key]])

export const toggledSection = (p: Panel, key: SectionKey): Panel => ({ ...p, [FIELD[key]]: !isFolded(p, key) })
