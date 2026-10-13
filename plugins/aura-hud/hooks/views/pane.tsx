import type { Elements, RenderSurface } from 'claude-code'

import type { AgentRun, AgentStatus, Flow, Look, Panel } from '../../types'

import { MAX_FINISHED_ROWS } from '../lib/consts'
import { agentSvg, compactSvg, COMPACT_H, headerHeight, headerSvg, PLANNED_H, plannedSvg, ROW_H, TIER_MODEL } from '../lib/draw-pane'
import { fmtCost, fmtTime, fmtTokens, textBar } from '../lib/format'
import { modelName } from '../lib/model'
import { paletteOf, tierHex } from '../lib/palette'
import { ctxOf, elapsedOf, plannedOf, progressOf, showsSteps, tierOf, totalsOf } from '../lib/runs'
import { plural, S } from '../lib/strings'

const STATUS_GLYPH: Readonly<Record<AgentStatus, string>> = { running: '●', done: '✓', failed: '✗' }

const stateWord = (status: AgentStatus): string =>
  status === 'running' ? S.isRunning : status === 'failed' ? S.isFailed : S.isFinished

const modelLine = (a: AgentRun): string => (a.effort ? `${modelName(a.model)} · ${a.effort}` : modelName(a.model))

const rowAlt = (a: AgentRun, at: number): string => {
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
  at: number
  bodyColumns: number
}

export type PaneActions = { toggleCompact: () => unknown; toggleDone: () => unknown }

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
  const summary = `≈${fmtCost(t.cost)}, ${fmtTokens(t.tokens)} ${plural(t.tokens, 'token', 'tokens')}, ${fmtTime(t.time)}`

  const toggleCompact = (
    <Button
      key="compact"
      label={p.isCompact ? S.expand : S.collapse}
      plain
      onPress={act.toggleCompact}
    />
  )
  const toggleDone = (
    <Button
      key="done"
      label={`${p.isDoneCollapsed ? '▸' : '▾'} ${S.finished} · ${finishedAll.length}`}
      plain
      onPress={act.toggleDone}
    />
  )
  const earlier = hidden > 0 && !p.isDoneCollapsed && (
    <Text key="earlier" dimColor>
      +{hidden} {S.earlier}
    </Text>
  )

  if (v.surface === 'desktop' && 'Svg' in ui) {
    const { Svg } = ui
    const W = Math.max(240, Math.min(900, (v.bodyColumns || 40) * 8 - 8))
    const section = (key: string, text: string) => (
      <Text key={key} dimColor>
        {text}
      </Text>
    )

    if (p.isCompact) {
      return (
        <Box flexDirection="column" gap={1}>
          <Svg
            source={compactSvg(W, list, planned, t, lookId)}
            alt={`${list.length} ${plural(list.length, 'agent', 'agents')}, ${summary}`}
            width={W}
            height={COMPACT_H}
          />
          {toggleCompact}
        </Box>
      )
    }
    return (
      <Box flexDirection="column">
        <Svg
          source={headerSvg(W, title, t, lookId)}
          alt={title ? `${title}: ${summary}` : summary}
          width={W}
          height={headerHeight(title)}
        />
        {toggleCompact}
        {isEmpty && <Text dimColor>{S.empty}</Text>}
        {running.length > 0 && section('h-run', `${S.running} · ${running.length}`)}
        {running.map(a => (
          <Svg key={a.id} source={agentSvg(W, a, at, lookId)} alt={rowAlt(a, at)} width={W} height={ROW_H} />
        ))}
        {finishedAll.length > 0 && toggleDone}
        {!p.isDoneCollapsed &&
          finished.map(a => (
            <Svg key={a.id} source={agentSvg(W, a, at, lookId)} alt={rowAlt(a, at)} width={W} height={ROW_H} />
          ))}
        {earlier}
        {planned.length > 0 && section('h-plan', `${S.planned} · ${planned.length}`)}
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
    const progress = progressOf(a)
    const steps = showsSteps(a) ? `${a.stepDone ?? 0}/${a.stepTotal}${a.stepNote ? ' ' + a.stepNote : ''} · ` : ''
    return (
      <Box key={a.id} flexDirection="column" marginBottom={1}>
        <Box flexDirection="row" gap={1}>
          <Text color={color}>▣</Text>
          <Text bold wrap="truncate-end">
            {a.description || a.type}
          </Text>
          <Text color={a.status === 'failed' ? 'error' : a.status === 'done' ? 'success' : color}>{STATUS_GLYPH[a.status]}</Text>
        </Box>
        <Text dimColor wrap="truncate-end">
          {'  '}
          {tier === 'other' ? a.type : tier} · {modelLine(a)}
          {a.round > 1 ? ` · ${S.round} ${a.round}` : ''}
        </Text>
        <Text wrap="truncate-end">
          {'  '}
          {progress === null ? <Text dimColor>{textBar(ctx / 100, barW)}</Text> : <Text color={color}>{textBar(progress, barW)}</Text>}
          <Text dimColor>
            {' '}
            {steps}
            {S.ctx} {ctx}% · {fmtTokens(a.contextTokens)} ≈{fmtCost(a.costUsd)} {fmtTime(elapsedOf(a, at))}
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
                {pl.tier} · {TIER_MODEL[pl.tier]}
                {pl.after.length ? ` · ${S.after} ${pl.after.join(', ')}` : ''}
              </Text>
            </Box>
          ))}
        </Box>
      )}
    </Box>
  )
}
