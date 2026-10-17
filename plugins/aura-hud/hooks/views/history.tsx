import type { Elements, RenderSurface } from 'claude-code'

import type { AgentRun, Look } from '../../types'

import { toolsAlt, toolsHeight, toolsSvg } from '../lib/draw-history'
import { agentSvg, paneWidth, rowHeightOf } from '../lib/draw-pane'
import { firstLine } from '../lib/history'
import type { Block, History, ToolItem, ToolState } from '../lib/history'
import { tierOf } from '../lib/runs'
import { plural, S } from '../lib/strings'
import { modelLine, rowAlt, stateWord } from './pane'

export type HistoryView = {
  surface: RenderSurface
  run: AgentRun
  history: History | null
  deny: string
  isBriefOpen: boolean
  look: Look
  at: number
  bodyColumns: number
}

export type HistoryActions = { back: () => unknown; toggleBrief: () => unknown }

const GLYPH: Readonly<Record<ToolState, string>> = { ok: '•', error: '✗', running: '◌' }
const LONG_HISTORY = 16

const rowsOf = (blocks: readonly Block[]): number => blocks.reduce((n, b) => n + (b.kind === 'tools' ? b.items.length : 3), 0)

const lastSayOf = (blocks: readonly Block[]): number => blocks.map(b => b.kind).lastIndexOf('say')

export const historyTree = (ui: Elements[RenderSurface], v: HistoryView, act: HistoryActions) => {
  const { Box, Text, Button, Markdown } = ui
  const a = v.run
  const story = v.history
  const tier = tierOf(a.type)
  const W = paneWidth(v.bodyColumns)
  const svgUi = v.surface === 'desktop' && 'Svg' in ui ? ui : null
  const lastSay = story ? lastSayOf(story.blocks) : -1
  const back = (key: string) => <Button key={key} plain label={`← ${S.pane}`} onPress={act.back} />

  const toolLine = (it: ToolItem, n: number) => (
    <Box key={`t${n}`} flexDirection="column">
      <Text wrap="truncate-end">
        <Text {...(it.state === 'error' ? { color: 'error' as const } : { dimColor: true })}>{GLYPH[it.state]}</Text> <Text bold>{it.tool}</Text>{' '}
        <Text dimColor>
          {it.what}
          {it.count > 1 ? ` ×${it.count}` : ''}
        </Text>
      </Text>
      {it.error ? (
        <Text color="error" wrap="truncate-end">
          {'  '}
          {it.error}
        </Text>
      ) : null}
    </Box>
  )

  const block = (b: Block, n: number) => {
    if (b.kind === 'tools') {
      if (svgUi) {
        const { Svg } = svgUi
        return <Svg key={`b${n}`} source={toolsSvg(W, b.items, tier, v.look)} alt={toolsAlt(b.items)} width={W} height={toolsHeight(b.items)} />
      }
      return (
        <Box key={`b${n}`} flexDirection="column">
          {b.items.map(toolLine)}
        </Box>
      )
    }
    const label = b.kind === 'ask' ? S.followUp : a.status !== 'running' && n === lastSay ? S.report : ''
    return (
      <Box key={`b${n}`} flexDirection="column" marginY={1}>
        {label ? <Text dimColor>{label}</Text> : null}
        <Markdown text={b.text} />
      </Box>
    )
  }

  const header = svgUi ? (
    <svgUi.Svg source={agentSvg(W, a, v.at, v.look)} alt={rowAlt(a, v.at)} width={W} height={rowHeightOf(a)} />
  ) : (
    <Box flexDirection="column">
      <Text bold wrap="truncate-end">
        {a.description || a.type}
      </Text>
      <Text dimColor wrap="truncate-end">
        {tier === 'other' ? a.type : tier} · {modelLine(a)} · {stateWord(a.status)}
      </Text>
    </Box>
  )

  return (
    <Box flexDirection="column">
      {back('back')}
      {header}
      {story === null ? (
        <Text dimColor>{v.deny ? `${S.noHistory}: ${v.deny}` : S.noHistory}</Text>
      ) : (
        <Box flexDirection="column" marginTop={1}>
          {story.brief ? (
            <Box flexDirection="column" marginBottom={1}>
              <Button key="brief" plain label={`${v.isBriefOpen ? '▾' : '▸'} ${S.brief}`} onPress={act.toggleBrief} />
              {v.isBriefOpen ? (
                <Markdown text={story.brief} />
              ) : (
                <Text dimColor wrap="truncate-end">
                  {firstLine(story.brief)}
                </Text>
              )}
            </Box>
          ) : null}
          <Text dimColor>
            {S.history} · {story.tools} {plural(story.tools, 'tool call', 'tool calls')}
            {story.hidden > 0 ? ` · ${story.hidden} ${S.earlier} not shown` : ''}
          </Text>
          {story.blocks.length ? story.blocks.map(block) : <Text dimColor>{S.nothingYet}</Text>}
          {rowsOf(story.blocks) > LONG_HISTORY ? back('back-end') : null}
        </Box>
      )}
    </Box>
  )
}
