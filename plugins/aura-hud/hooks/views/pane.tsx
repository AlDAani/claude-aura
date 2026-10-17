import type { Elements, RenderSurface } from 'claude-code'

import type { AgentRun, AgentStatus, Flow, Look, Panel } from '../../types'

import { MAX_FINISHED_ROWS } from '../lib/consts'
import {
  bodyHeightOf,
  compactSvg,
  COMPACT_H,
  CRAB_W,
  headerHeight,
  headerSvg,
  paneWidth,
  PLANNED_H,
  plannedSvg,
  rowCrabSvg,
  rowDetailsSvg,
  rowHeightOf,
  TIER_EFFORT,
} from '../lib/draw-pane'
import { fitText, fmtCost, fmtTime, fmtTokens, fmtUsd, textBar } from '../lib/format'
import { modelName } from '../lib/model'
import { paletteOf, tierHex } from '../lib/palette'
import { ctxOf, elapsedOf, plannedOf, progressOf, showsSteps, tierOf, totalsOf } from '../lib/runs'
import { plural, S } from '../lib/strings'

const STATUS_GLYPH: Readonly<Record<AgentStatus, string>> = { running: '●', done: '✓', failed: '✗' }
const EXPAND_W = 64
const TITLE_SIZE = 16

type Head = 'empty' | 'run' | 'done' | 'plan'

export const stateWord = (status: AgentStatus): string =>
  status === 'running' ? S.isRunning : status === 'failed' ? S.isFailed : S.isFinished

export const modelLine = (a: AgentRun): string => (a.effort ? `${modelName(a.model)} · ${a.effort}` : modelName(a.model))

export const rowAlt = (a: AgentRun, at: number): string => {
  const tier = tierOf(a.type)
  const parts = [`${a.description || a.type}: ${tier === 'other' ? a.type : tier}`, modelLine(a), stateWord(a.status)]
  if (showsSteps(a)) parts.push(`step ${a.stepDone ?? 0} of ${a.stepTotal}${a.stepNote ? `, ${a.stepNote}` : ''}`)
  parts.push(`${S.ctx} ${ctxOf(a)}%`, `≈${fmtCost(a.costUsd)}`, fmtTime(elapsedOf(a, at)))
  return parts.join(', ')
}

export type PaneView = {
  surface: RenderSurface
  list: readonly AgentRun[]
  flow: Flow | null
  panel: Panel
  look: Look
  total: number | null
  context: number | null
  at: number
  bodyColumns: number
}

export type PaneActions = { toggleCompact: () => unknown; toggleDone: () => unknown; openRun: (id: string) => unknown }

export const paneTree = (ui: Elements[RenderSurface], v: PaneView, act: PaneActions) => {
  const { Box, Text, Button } = ui
  const { list, at } = v
  const f = v.flow
  const p = v.panel
  const lookId = v.look
  const running = list.filter(a => a.status === 'running').reverse()
  const finishedAll = list.filter(a => a.status !== 'running').reverse()
  const finished = finishedAll.slice(0, MAX_FINISHED_ROWS)
  const hidden = finishedAll.length - finished.length
  const planned = plannedOf(f, list)
  const t = totalsOf(list, at)
  const title = f && !f.isFinished ? f.title : ''
  const isEmpty = list.length === 0 && planned.length === 0
  const sessionText = [v.total === null ? '' : `${S.sessionWord} ${fmtUsd(v.total)}`, v.context === null ? '' : `${S.contextWord} ${v.context}%`]
    .filter(Boolean)
    .join(' · ')
  const summary = [`≈${fmtCost(t.cost)}`, `${fmtTokens(t.tokens)} ${plural(t.tokens, 'token', 'tokens')}`, fmtTime(t.time), sessionText]
    .filter(Boolean)
    .join(', ')

  const toggleCompact = (
    <Button
      key="compact"
      label={p.isCompact ? S.expand : S.collapse}
      plain
      dimColor
      onPress={act.toggleCompact}
    />
  )
  const toggleDone = (
    <Button
      key="done"
      label={`${p.isDoneCollapsed ? '▸' : '▾'} ${S.finished} · ${finishedAll.length}`}
      plain
      dimColor
      onPress={act.toggleDone}
    />
  )
  const titleOf = (a: AgentRun, width: number) => {
    const title = width > 0 ? fitText(a.description || a.type, TITLE_SIZE, width) : a.description || a.type
    return a.agentId ? (
      <Button key={`open-${a.id}`} plain hover={{ underline: true }} onPress={() => act.openRun(a.id)}>
        <Text bold>{title}</Text>
      </Button>
    ) : (
      <Text bold>{title}</Text>
    )
  }
  const earlier = hidden > 0 && !p.isDoneCollapsed && (
    <Text key="earlier" dimColor>
      +{hidden} {S.earlier}
    </Text>
  )

  if (v.surface === 'desktop' && 'Svg' in ui) {
    const { Svg } = ui
    const W = paneWidth(v.bodyColumns)
    const bodyW = W - CRAB_W
    const runRow = (a: AgentRun) => (
      <Box key={a.id} flexDirection="row">
        <Svg source={rowCrabSvg(a, lookId)} alt={`${tierOf(a.type)} crab`} width={CRAB_W} height={rowHeightOf(a)} />
        <Box flexDirection="column" flexGrow={1}>
          {titleOf(a, bodyW - 8)}
          <Svg source={rowDetailsSvg(bodyW, a, at, lookId)} alt={rowAlt(a, at)} width={bodyW} height={bodyHeightOf(a)} />
        </Box>
      </Box>
    )
    const firstHead: Head = isEmpty ? 'empty' : running.length ? 'run' : finishedAll.length ? 'done' : 'plan'
    const headLeft = (key: Head) =>
      key === 'done' ? (
        toggleDone
      ) : (
        <Text key={`h-${key}`} dimColor>
          {key === 'empty' ? S.empty : key === 'run' ? `${S.running} · ${running.length}` : `${S.planned} · ${planned.length}`}
        </Text>
      )
    const head = (key: Head) =>
      key === firstHead ? (
        <Box key="head" flexDirection="row" justifyContent="space-between" alignItems="center">
          {headLeft(key)}
          {toggleCompact}
        </Box>
      ) : (
        headLeft(key)
      )

    if (p.isCompact) {
      return (
        <Box flexDirection="row" justifyContent="space-between" alignItems="center">
          <Svg
            source={compactSvg(W - EXPAND_W, list, planned, t, v.total, v.context, lookId, at)}
            alt={`${list.length} ${plural(list.length, 'agent', 'agents')}, ${summary}`}
            width={W - EXPAND_W}
            height={COMPACT_H}
          />
          {toggleCompact}
        </Box>
      )
    }
    return (
      <Box flexDirection="column">
        <Svg
          source={headerSvg(W, title, t, v.total, v.context, lookId)}
          alt={title ? `${title}: ${summary}` : summary}
          width={W}
          height={headerHeight(W, title, v.total, v.context)}
        />
        {isEmpty && head('empty')}
        {running.length > 0 && head('run')}
        {running.map(runRow)}
        {finishedAll.length > 0 && head('done')}
        {!p.isDoneCollapsed && finished.map(runRow)}
        {earlier}
        {planned.length > 0 && head('plan')}
        {planned.map(pl => (
          <Svg
            key={`plan-${pl.n}`}
            source={plannedSvg(W, pl, lookId)}
            alt={`${pl.n}. ${pl.title}: ${pl.tier}, ${S.isPlanned}`}
            width={W}
            height={PLANNED_H}
          />
        ))}
      </Box>
    )
  }

  const palette = paletteOf(lookId)
  const cols = Math.max(24, v.bodyColumns || 40)
  const barW = Math.max(6, Math.min(20, cols - 34))
  const row = (a: AgentRun) => {
    const tier = tierOf(a.type)
    const color = tierHex(palette, tier)
    const ctx = ctxOf(a)
    const progress = a.status === 'running' ? progressOf(a) : null
    const steps = showsSteps(a) ? `${a.stepDone ?? 0}/${a.stepTotal}${a.stepNote ? ' ' + a.stepNote : ''} · ` : ''
    return (
      <Box key={a.id} flexDirection="column" marginBottom={1}>
        <Box flexDirection="row" gap={1}>
          <Text color={color}>▣</Text>
          {titleOf(a, 0)}
          <Text color={a.status === 'failed' ? 'error' : a.status === 'done' ? 'success' : color}>{STATUS_GLYPH[a.status]}</Text>
        </Box>
        <Text dimColor wrap="truncate-end">
          {'  '}
          {tier === 'other' ? a.type : tier} · {modelLine(a)}
          {a.round > 1 ? ` · ${S.round} ${a.round}` : ''}
          {a.status === 'failed' ? <Text color="error"> · {S.failed}</Text> : null}
        </Text>
        <Text wrap="truncate-end">
          {'  '}
          {progress === null ? null : <Text color={color}>{textBar(progress, barW)} </Text>}
          <Text dimColor>
            {steps}
            {S.ctx} {ctx}% · ≈{fmtCost(a.costUsd)} · {fmtTime(elapsedOf(a, at))}
          </Text>
        </Text>
      </Box>
    )
  }

  return (
    <Box flexDirection="column">
      <Box flexDirection="row" justifyContent="space-between">
        <Text bold wrap="truncate-end">
          {title}
        </Text>
        {toggleCompact}
      </Box>
      <Text dimColor>
        ≈{fmtCost(t.cost)} · {fmtTokens(t.tokens)} {plural(t.tokens, 'token', 'tokens')} · {fmtTime(t.time)}
        {sessionText && ` · ${sessionText}`}
      </Text>
      {p.isCompact ? (
        <Text wrap="truncate-end">
          {[...running, ...finished].map(a => (
            <Text key={a.id} color={tierHex(palette, tierOf(a.type))}>
              {STATUS_GLYPH[a.status]}{' '}
            </Text>
          ))}
          {planned.map(pl => (
            <Text key={`plan-${pl.n}`} dimColor>
              ◷{' '}
            </Text>
          ))}
        </Text>
      ) : (
        <Box flexDirection="column" marginTop={1}>
          {isEmpty && <Text dimColor>{S.empty}</Text>}
          {running.length > 0 && (
            <Text dimColor>
              {S.running} · {running.length}
            </Text>
          )}
          {running.map(row)}
          {finishedAll.length > 0 && toggleDone}
          {!p.isDoneCollapsed && finished.map(row)}
          {earlier}
          {planned.length > 0 && (
            <Text dimColor>
              {S.planned} · {planned.length}
            </Text>
          )}
          {planned.map(pl => (
            <Box key={`plan-${pl.n}`} flexDirection="column" marginBottom={1}>
              <Text dimColor wrap="truncate-end">
                <Text color={tierHex(palette, pl.tier)}>▢</Text> {pl.n}. {pl.title} ◷
              </Text>
              <Text dimColor wrap="truncate-end">
                {'  '}
                {pl.tier}
                {TIER_EFFORT[pl.tier] ? ` · ${TIER_EFFORT[pl.tier]} ${S.effort}` : ''}
                {pl.after.length ? ` · ${S.after} ${pl.after.join(', ')}` : ''}
              </Text>
            </Box>
          ))}
        </Box>
      )}
    </Box>
  )
}
