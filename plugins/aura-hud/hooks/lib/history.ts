import type { SessionMessage } from 'claude-code'

import { capText } from './format'

export type ToolState = 'ok' | 'error' | 'running'

export type ToolItem = {
  kind: 'tool'
  tool: string
  title: string
  isCode: boolean
  detail: string
  outcome: string
  meta: string
  plus: number
  minus: number
  state: ToolState
  error: string
  count: number
}

type Note = { kind: 'say'; text: string; isReport: boolean } | { kind: 'ask'; text: string }

type HistoryItem = Note | ToolItem

export type Block = Note | { kind: 'tools'; items: ToolItem[] }

export type History = { brief: string; blocks: Block[]; hidden: number; tools: number }

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

const ANSI = /\u001b\[[0-9;]*m/g
const NUMBERED = /^\s*\d+\t/
const FOUND = /^Found (\d+) (\w+)/
const HANDBACK = /handback/i
const REMINDER = /<system-reminder>[\s\S]*?<\/system-reminder>/g

const linesOf = (text: string): string[] =>
  text
    .replace(ANSI, '')
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)

const countLines = (text: string): number => (text ? text.split('\n').length : 0)

const editSize = (tool: string, input: Readonly<Record<string, unknown>>): readonly [number, number] => {
  if (tool === 'Write') return [countLines(str(input.content)), 0]
  if (tool === 'Edit') return [countLines(str(input.new_string)), countLines(str(input.old_string))]
  if (tool === 'MultiEdit' && Array.isArray(input.edits)) {
    return input.edits.reduce<readonly [number, number]>((sum, edit: unknown) => {
      const e = edit && typeof edit === 'object' ? (edit as Record<string, unknown>) : {}
      return [sum[0] + countLines(str(e.new_string)), sum[1] + countLines(str(e.old_string))]
    }, [0, 0])
  }
  return [0, 0]
}

const metaOf = (tool: string, result: string): string => {
  if (!result) return ''
  if (tool === 'Read') {
    const read = result.split('\n').filter(line => NUMBERED.test(line)).length
    return read ? `${read} lines` : ''
  }
  if (tool === 'Grep' || tool === 'Glob') {
    const found = FOUND.exec(result)
    if (found) return `${found[1]} ${found[2]}`
    if (/^No (files|matches) found/.test(result)) return 'none found'
    const lines = linesOf(result).length
    return `${lines} ${tool === 'Glob' ? 'files' : 'lines'}`
  }
  return ''
}

const summaryOf = (tool: string, input: Readonly<Record<string, unknown>>): Pick<ToolItem, 'title' | 'isCode' | 'detail'> => {
  if (tool === 'Bash') {
    const command = firstLine(str(input.command))
    const description = str(input.description).trim()
    return description ? { title: description, isCode: false, detail: command } : { title: command, isCode: true, detail: '' }
  }
  const what = toolWhat(tool, input)
  const isProse = ['Agent', 'Task', 'Skill', 'WebSearch', 'TodoWrite', STEP_TOOL].includes(tool)
  return { title: what, isCode: !isProse, detail: '' }
}

const toolItemOf = (use: SessionMessage['toolUses'][number]): ToolItem | Note => {
  if (HANDBACK.test(use.tool)) {
    const text = str(use.input.message) || str(use.input.text) || str(use.input.result) || use.text || ''
    return { kind: 'say', text: text.trim(), isReport: true }
  }
  const state: ToolState = use.isError ? 'error' : use.text === undefined ? 'running' : 'ok'
  const result = use.text ?? ''
  const [plus, minus] = state === 'ok' ? editSize(use.tool, use.input) : [0, 0]
  const summary = summaryOf(use.tool, use.input)
  return {
    kind: 'tool',
    tool: toolName(use.tool),
    title: capText(summary.title, MAX_LINE),
    isCode: summary.isCode,
    detail: capText(summary.detail, MAX_LINE),
    outcome: state === 'ok' && use.tool === 'Bash' ? capText(linesOf(result).slice(-2).join(' · '), MAX_LINE) : '',
    meta: state === 'ok' ? metaOf(use.tool, result) : '',
    plus,
    minus,
    state,
    error: state === 'error' ? capText(firstLine(result), MAX_LINE) : '',
    count: 1,
  }
}

const isRepeat = (last: HistoryItem | undefined, next: ToolItem): last is ToolItem =>
  last?.kind === 'tool' &&
  last.state === 'ok' &&
  next.state === 'ok' &&
  last.tool === next.tool &&
  last.title === next.title &&
  last.detail === next.detail

const blocksOf = (items: readonly HistoryItem[]): Block[] => {
  const blocks: Block[] = []
  for (const it of items) {
    const last = blocks.at(-1)
    if (it.kind !== 'tool') blocks.push(it)
    else if (last?.kind === 'tools') last.items.push(it)
    else blocks.push({ kind: 'tools', items: [it] })
  }
  return blocks
}

export const historyOf = (messages: readonly SessionMessage[], max: number): History => {
  const items: HistoryItem[] = []
  let brief = ''
  let tools = 0
  messages.forEach((m, i) => {
    const text = m.text.replace(REMINDER, '').trim()
    if (m.role === 'user') {
      if (i === 0) brief = text
      else if (text && !m.toolResults?.length) items.push({ kind: 'ask', text })
      return
    }
    if (text) items.push({ kind: 'say', text, isReport: false })
    for (const use of m.toolUses) {
      const item = toolItemOf(use)
      if (item.kind !== 'tool') {
        if (item.text) items.push(item)
        continue
      }
      tools += 1
      const last = items.at(-1)
      if (isRepeat(last, item)) {
        items[items.length - 1] = { ...item, count: last.count + 1, plus: last.plus + item.plus, minus: last.minus + item.minus }
        continue
      }
      items.push(item)
    }
  })
  const hidden = Math.max(0, items.length - max)
  return { brief, blocks: blocksOf(hidden ? items.slice(hidden) : items), hidden, tools }
}
