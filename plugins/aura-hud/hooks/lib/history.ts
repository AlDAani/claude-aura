import type { SessionMessage } from 'claude-code'

import { capText } from './format'

export type ToolState = 'ok' | 'error' | 'running'

export type HistoryItem =
  | { kind: 'say'; text: string }
  | { kind: 'ask'; text: string }
  | { kind: 'tool'; tool: string; what: string; state: ToolState; error: string }

export type History = { brief: string; items: HistoryItem[]; hidden: number; tools: number }

const STEP_TOOL = 'mcp__aura-hud__step'
const MAX_LINE = 200
const MCP = /^mcp__(.+?)__(.+)$/

const str = (v: unknown): string => (typeof v === 'string' ? v : '')

export const firstLine = (s: string): string => s.trim().split('\n', 1)[0] ?? ''

const shortPath = (p: string): string => {
  const parts = p.split('/').filter(Boolean)
  return parts.length > 3 ? `…/${parts.slice(-3).join('/')}` : p
}

export const toolName = (tool: string): string => {
  if (tool === STEP_TOOL) return 'Step'
  const m = MCP.exec(tool)
  return m ? `${m[2]} · ${m[1]}` : tool
}

export const toolWhat = (tool: string, input: Readonly<Record<string, unknown>>): string => {
  switch (tool) {
    case 'Bash':
      return firstLine(str(input.command)) || str(input.description)
    case 'Read':
    case 'Write':
    case 'Edit':
    case 'MultiEdit':
      return shortPath(str(input.file_path))
    case 'NotebookEdit':
      return shortPath(str(input.notebook_path))
    case 'Grep':
      return [str(input.pattern), shortPath(str(input.path))].filter(Boolean).join('  in ')
    case 'Glob':
      return str(input.pattern)
    case 'WebFetch':
      return str(input.url)
    case 'WebSearch':
    case 'ToolSearch':
      return str(input.query)
    case 'Agent':
    case 'Task':
      return str(input.description)
    case 'Skill':
      return str(input.skill)
    case 'TodoWrite':
      return Array.isArray(input.todos) ? `${input.todos.length} todos` : ''
    case STEP_TOOL:
      return [`${String(input.done ?? 0)}/${String(input.total ?? '?')}`, str(input.note)].filter(Boolean).join('  ')
    default:
      return firstLine(Object.values(input).map(str).find(Boolean) ?? '')
  }
}

export const historyOf = (messages: readonly SessionMessage[], max: number): History => {
  const items: HistoryItem[] = []
  let brief = ''
  let tools = 0
  messages.forEach((m, i) => {
    const text = m.text.trim()
    if (m.role === 'user') {
      if (i === 0) brief = text
      else if (text && !m.toolResults?.length) items.push({ kind: 'ask', text })
      return
    }
    if (text) items.push({ kind: 'say', text })
    for (const use of m.toolUses) {
      tools += 1
      const state: ToolState = use.isError ? 'error' : use.text === undefined ? 'running' : 'ok'
      items.push({
        kind: 'tool',
        tool: toolName(use.tool),
        what: capText(toolWhat(use.tool, use.input), MAX_LINE),
        state,
        error: state === 'error' ? capText(firstLine(use.text ?? ''), MAX_LINE) : '',
      })
    }
  })
  const hidden = Math.max(0, items.length - max)
  return { brief, items: hidden ? items.slice(hidden) : items, hidden, tools }
}
