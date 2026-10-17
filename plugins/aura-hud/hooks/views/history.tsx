import type { Elements, RenderSurface } from 'claude-code'

import type { AgentRun, Look } from '../../types'

import { agentSvg, paneWidth, ROW_H } from '../lib/draw-pane'
import { firstLine } from '../lib/history'
import type { History, HistoryItem, ToolState } from '../lib/history'
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
const LONG_HISTORY = 12

export const historyTree = (ui: Elements[RenderSurface], v: HistoryView, act: HistoryActions) => {
  const { Box, Text, Button, Markdown } = ui
  const a = v.run
  const story = v.history
  const tier = tierOf(a.type)
  const lastSay = story ? story.items.map(it => it.kind).lastIndexOf('say') : -1
  const isOver = a.status !== 'running'

  const header =
    v.surface === 'desktop' && 'Svg' in ui ? (
      <ui.Svg
        source={agentSvg(paneWidth(v.bodyColumns), a, v.at, v.look)}
        alt={rowAlt(a, v.at)}
        width={paneWidth(v.bodyColumns)}
        height={ROW_H}
      />
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

  const item = (it: HistoryItem, n: number) => {
    const key = `h${n}`
    if (it.kind === 'tool') {
      const mark = it.state === 'error' ? { color: 'error' as const } : { dimColor: true }
      return (
        <Box key={key} flexDirection="column">
          <Text wrap="truncate-end">
            <Text {...mark}>{GLYPH[it.state]}</Text> <Text bold>{it.tool}</Text>
            {it.what ? (
              <Text dimColor mono>
                {' '}
                {it.what}
              </Text>
            ) : null}
          </Text>
          {it.error ? (
            <Text color="error" wrap="truncate-end">
              {'  '}
              {it.error}
            </Text>
          ) : null}
        </Box>
      )
    }
    const label = it.kind === 'ask' ? S.followUp : isOver && n === lastSay ? S.report : ''
    return (
      <Box key={key} flexDirection="column" marginY={1}>
        {label ? <Text dimColor>{label}</Text> : null}
        <Markdown text={it.text} />
      </Box>
    )
  }

  return (
    <Box flexDirection="column">
      <Button key="back" plain label={`‹ ${S.pane}`} onPress={act.back} />
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
          </Text>
          {story.hidden > 0 ? (
            <Text dimColor>
              +{story.hidden} {S.earlier}
            </Text>
          ) : null}
          {story.items.length ? story.items.map(item) : <Text dimColor>{S.nothingYet}</Text>}
          {story.items.length > LONG_HISTORY ? <Button key="back-end" plain label={`‹ ${S.pane}`} onPress={act.back} /> : null}
        </Box>
      )}
    </Box>
  )
}
