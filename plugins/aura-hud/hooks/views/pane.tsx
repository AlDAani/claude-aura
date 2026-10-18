import type { Elements, RenderChildren, RenderSurface } from 'claude-code'

import type { AgentRun, AgentStatus, Flow, Look, Panel, WorkflowRun } from '../../types'

import { MAX_FINISHED_ROWS } from '../lib/consts'
import {
  bodyHeightOf,
  compactSvg,
  COMPACT_H,
  CRAB_W,
  GROUP_BODY_H,
  GROUP_H,
  groupBodySvg,
  groupIconSvg,
  headerHeight,
  headerSvg,
  paneWidth,
  PLANNED_H,
  plannedSvg,
  RAIL_W,
  railOf,
  railSvg,
  rowCrabSvg,
  rowDetailsSvg,
  rowHeightOf,
  TIER_EFFORT,
} from '../lib/draw-pane'
import { fitText, fmtCost, fmtTokens, fmtUsd, textBar } from '../lib/format'
import { modelName } from '../lib/model'
import { isFolded } from '../lib/panel'
import type { SectionKey } from '../lib/panel'
import { paletteOf, tierHex } from '../lib/palette'
import { ctxOf, kindOf, plannedOf, progressOf, showsSteps, tierOf, totalsOf } from '../lib/runs'
import { plural, S } from '../lib/strings'
import { failedPart, groupParts, groupsOf, isGroupOpen, noteOf, rowsOf, sectionsOf } from '../lib/workflows'
import type { Group, Item, SectionNote } from '../lib/workflows'

const STATUS_GLYPH: Readonly<Record<AgentStatus, string>> = { running: '●', done: '✓', failed: '✗' }
const STRIP_TOGGLE_W = 84
const VIEW_LABEL = { compact: `⊟ ${S.compact}`, full: `⊞ ${S.expand}` } as const
const CHEVRON = { desktop: { open: ' ⌄', shut: ' ›' }, text: { open: ' ▾', shut: ' ▸' } } as const
const STRIP_GLYPHS = 30
export const TITLE_SIZE = 16

export const stateWord = (status: AgentStatus): string =>
  status === 'running' ? S.isRunning : status === 'failed' ? S.isFailed : S.isFinished

export const modelLine = (a: AgentRun): string => (a.effort ? `${modelName(a.model)} · ${a.effort}` : modelName(a.model))

export const rowAlt = (a: AgentRun): string => {
  const kind = kindOf(a)
  const title = a.description || a.type
  const parts = [kind ? `${title}: ${kind}` : title, modelLine(a), stateWord(a.status)]
  if (showsSteps(a)) parts.push(`step ${a.stepDone ?? 0} of ${a.stepTotal}${a.stepNote ? `, ${a.stepNote}` : ''}`)
  parts.push(`${S.ctx} ${ctxOf(a)}%`, `≈${fmtCost(a.costUsd)}`)
  return parts.join(', ')
}

export const groupAlt = (g: Group): string =>
  [`${g.name}: ${S.workflowWord}`, ...groupParts(g), failedPart(g), `≈${fmtCost(g.cost)}`].filter(Boolean).join(', ')

export type PaneView = {
  surface: RenderSurface
  list: readonly AgentRun[]
  workflows: readonly WorkflowRun[]
  flow: Flow | null
  panel: Panel
  look: Look
  total: number | null
  context: number | null
  at: number
  bodyColumns: number
}

export type PaneActions = {
  toggleCompact: () => unknown
  toggleSection: (key: SectionKey) => unknown
  toggleGroup: (id: string, isOpen: boolean) => unknown
  openRun: (id: string) => unknown
}

export const paneTree = (ui: Elements[RenderSurface], v: PaneView, act: PaneActions) => {
  const { Box, Text, Button } = ui
  const { list, at } = v
  const f = v.flow
  const p = v.panel
  const lookId = v.look
  const isDesktop = v.surface === 'desktop' && 'Svg' in ui
  const chevron = isDesktop ? CHEVRON.desktop : CHEVRON.text
  const running = list.filter(a => a.status === 'running').reverse()
  const finishedRuns = list.filter(a => a.status !== 'running').reverse().slice(0, MAX_FINISHED_ROWS)
  const sections = sectionsOf(list, groupsOf(list, v.workflows))
  const finished = sections.finished.slice(0, MAX_FINISHED_ROWS)
  const hidden = sections.finished.length - finished.length
  const planned = plannedOf(f, list)
  const t = totalsOf(list)
  const title = f && !f.isFinished ? f.title : ''
  const isEmpty = list.length === 0 && planned.length === 0
  const sessionText = [v.total === null ? '' : `${S.sessionWord} ${fmtUsd(v.total)}`, v.context === null ? '' : `${S.contextWord} ${v.context}%`]
    .filter(Boolean)
    .join(' · ')
  const summary = [`≈${fmtUsd(t.cost)}`, `${fmtTokens(t.tokens)} ${plural(t.tokens, 'token', 'tokens')}`, sessionText]
    .filter(Boolean)
    .join(', ')

  const firstKey = isEmpty ? 'empty' : sections.running.length ? 'running' : sections.finished.length ? 'finished' : 'planned'
  const sectionHead = (key: SectionKey, label: string, count: number, note: SectionNote | null, toggle: RenderChildren) => {
    const isShut = isFolded(p, key)
    const isFirst = key === firstKey
    return (
      <Box key={`h-${key}`} flexDirection="row" justifyContent="space-between" alignItems="center" marginTop={isFirst ? 0 : 'xs'}>
        <Button key={`section-${key}`} plain hover={{ underline: true }} onPress={() => act.toggleSection(key)}>
          <Text bold dimColor>
            {label} · {count}
          </Text>
          <Text dimColor>{isShut ? chevron.shut : chevron.open}</Text>
        </Button>
        <Box flexDirection="row" alignItems="center" gap="sm">
          {isShut && note ? (
            <Text dimColor wrap="truncate-end">
              {note.failed ? <Text color="error">{`${note.failed} ${S.isFailed} · `}</Text> : null}≈{fmtCost(note.cost)}
            </Text>
          ) : null}
          {isFirst ? toggle : null}
        </Box>
      </Box>
    )
  }
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
  const groupTitle = (g: Group, isOpen: boolean, width: number) => (
    <Button key={`fold-${g.id}`} plain hover={{ underline: true }} onPress={() => act.toggleGroup(g.id, isOpen)}>
      <Text bold>{width > 0 ? fitText(g.name, TITLE_SIZE, width) : g.name}</Text>
      <Text dimColor>{isOpen ? chevron.open : chevron.shut}</Text>
    </Button>
  )
  const earlier = hidden > 0 && !isFolded(p, 'finished') && (
    <Text key="earlier" dimColor>
      +{hidden} {S.earlier}
    </Text>
  )
  const body = (itemOf: (it: Item) => RenderChildren, plannedOne: (n: number) => RenderChildren, toggle: RenderChildren): RenderChildren[] => [
    isEmpty && (
      <Box key="h-empty" flexDirection="row" justifyContent="space-between" alignItems="center">
        <Text dimColor>{S.empty}</Text>
        {toggle}
      </Box>
    ),
    sections.running.length > 0 && sectionHead('running', S.running, running.length, noteOf(sections.running), toggle),
    ...(isFolded(p, 'running') ? [] : sections.running.map(itemOf)),
    sections.finished.length > 0 && sectionHead('finished', S.finished, sections.finishedAgents, noteOf(sections.finished), toggle),
    ...(isFolded(p, 'finished') ? [] : finished.map(itemOf)),
    earlier,
    planned.length > 0 && sectionHead('planned', S.planned, planned.length, null, toggle),
    ...(isFolded(p, 'planned') ? [] : planned.map((_, n) => plannedOne(n))),
  ]

  if (isDesktop && 'Svg' in ui) {
    const { Svg } = ui
    const W = paneWidth(v.bodyColumns)
    const viewToggle = (
      <Button
        key="compact"
        plain
        dimColor
        hover={{ underline: true }}
        label={p.isCompact ? VIEW_LABEL.full : VIEW_LABEL.compact}
        onPress={act.toggleCompact}
      />
    )
    const runRow = (a: AgentRun, width: number) => {
      const bodyW = width - CRAB_W
      return (
        <Box key={a.id} flexDirection="row">
          <Svg source={rowCrabSvg(a, lookId)} alt={`${tierOf(a.type)} crab`} width={CRAB_W} height={rowHeightOf(a)} />
          <Box flexDirection="column" flexGrow={1}>
            {titleOf(a, bodyW - 8)}
            <Svg source={rowDetailsSvg(bodyW, a, at, lookId)} alt={rowAlt(a)} width={bodyW} height={bodyHeightOf(a)} />
          </Box>
        </Box>
      )
    }
    const groupBlock = (g: Group) => {
      const isOpen = isGroupOpen(g, p.openGroups)
      const rows = isOpen ? rowsOf(g) : []
      const rail = railOf(rows)
      const bodyW = W - CRAB_W
      return (
        <Box key={`wf-${g.id}`} flexDirection="column">
          <Box key={`wf-head-${g.id}`} flexDirection="row">
            <Svg source={groupIconSvg(g.tone, rows.length > 0, lookId)} alt={S.workflowWord} width={CRAB_W} height={GROUP_H} />
            <Box flexDirection="column" flexGrow={1}>
              {groupTitle(g, isOpen, bodyW - 24)}
              <Svg source={groupBodySvg(bodyW, g, at, lookId)} alt={groupAlt(g)} width={bodyW} height={GROUP_BODY_H} />
            </Box>
          </Box>
          {rows.length > 0 && (
            <Box flexDirection="row">
              <Svg
                source={railSvg(rail.height, rail.end, g.tone, lookId)}
                alt={`${rows.length} ${plural(rows.length, 'agent', 'agents')} of ${g.name}`}
                width={RAIL_W}
                height={rail.height}
              />
              <Box flexDirection="column" flexGrow={1}>
                {rows.map(a => runRow(a, W - RAIL_W))}
              </Box>
            </Box>
          )}
        </Box>
      )
    }
    const itemOf = (it: Item) => (it.kind === 'group' ? groupBlock(it.group) : runRow(it.run, W))
    const plannedOne = (n: number) => {
      const pl = planned[n]
      return pl ? (
        <Svg
          key={`plan-${pl.n}`}
          source={plannedSvg(W, pl, lookId)}
          alt={`${pl.n}. ${pl.title}: ${pl.tier}, ${S.isPlanned}`}
          width={W}
          height={PLANNED_H}
        />
      ) : null
    }

    if (p.isCompact) {
      return (
        <Box key="strip" flexDirection="row" justifyContent="space-between" alignItems="center">
          <Svg
            source={compactSvg(W - STRIP_TOGGLE_W, list, planned, t, v.total, v.context, lookId, at)}
            alt={`${list.length} ${plural(list.length, 'agent', 'agents')}, ${summary}`}
            width={W - STRIP_TOGGLE_W}
            height={COMPACT_H}
          />
          {viewToggle}
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
        {body(itemOf, plannedOne, viewToggle)}
      </Box>
    )
  }

  const palette = paletteOf(lookId)
  const cols = Math.max(24, v.bodyColumns || 40)
  const barW = Math.max(6, Math.min(20, cols - 34))
  const statusColor = (status: AgentStatus, color: string) => (status === 'failed' ? 'error' : status === 'done' ? 'success' : color)
  const row = (a: AgentRun) => {
    const color = tierHex(palette, tierOf(a.type))
    const kind = kindOf(a)
    const ctx = ctxOf(a)
    const progress = a.status === 'running' ? progressOf(a) : null
    const steps = showsSteps(a) ? `${a.stepDone ?? 0}/${a.stepTotal}${a.stepNote ? ' ' + a.stepNote : ''} · ` : ''
    return (
      <Box key={a.id} flexDirection="column" marginBottom={1}>
        <Box flexDirection="row" gap={1}>
          <Text color={color}>▣</Text>
          {titleOf(a, 0)}
          <Text color={statusColor(a.status, color)}>{STATUS_GLYPH[a.status]}</Text>
        </Box>
        <Text dimColor wrap="truncate-end">
          {'  '}
          {kind ? `${kind} · ` : ''}
          {modelLine(a)}
          {a.round > 1 ? ` · ${S.round} ${a.round}` : ''}
          {a.status === 'failed' ? <Text color="error"> · {S.failed}</Text> : null}
        </Text>
        <Text wrap="truncate-end">
          {'  '}
          {progress === null ? null : <Text color={color}>{textBar(progress, barW)} </Text>}
          <Text dimColor>
            {steps}
            {S.ctx} {ctx}% · ≈{fmtCost(a.costUsd)}
          </Text>
        </Text>
      </Box>
    )
  }
  const groupText = (g: Group) => {
    const isOpen = isGroupOpen(g, p.openGroups)
    const color = tierHex(palette, g.tone)
    const failed = failedPart(g)
    return (
      <Box key={`wf-${g.id}`} flexDirection="column" marginBottom={1}>
        <Box key={`wf-head-${g.id}`} flexDirection="row" gap={1}>
          <Text color={color}>◆</Text>
          {groupTitle(g, isOpen, 0)}
          <Text color={statusColor(g.status, color)}>{STATUS_GLYPH[g.status]}</Text>
        </Box>
        <Text wrap="truncate-end">
          {'  '}
          <Text color={color}>{S.workflowWord}</Text>
          <Text dimColor> · {groupParts(g).join(' · ')}</Text>
          {failed ? <Text color="error"> · {failed}</Text> : null}
          <Text dimColor> · ≈{fmtCost(g.cost)}</Text>
        </Text>
        <Text wrap="truncate-end">
          {'  '}
          {g.runs.slice(0, STRIP_GLYPHS).map((a, n) => (
            <Text key={`s${n}`} color={statusColor(a.status, color)}>
              ■
            </Text>
          ))}
          {g.runs.length > STRIP_GLYPHS ? <Text dimColor> +{g.runs.length - STRIP_GLYPHS}</Text> : null}
        </Text>
        {isOpen && (
          <Box flexDirection="column" marginLeft={2} marginTop={1}>
            {rowsOf(g).map(row)}
          </Box>
        )}
      </Box>
    )
  }
  const itemText = (it: Item) => (it.kind === 'group' ? groupText(it.group) : row(it.run))
  const plannedText = (n: number) => {
    const pl = planned[n]
    return pl ? (
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
    ) : null
  }

  return (
    <Box flexDirection="column">
      <Box flexDirection="row" justifyContent="space-between">
        <Text bold wrap="truncate-end">
          {title}
        </Text>
        <Button key="compact" label={p.isCompact ? S.expand : S.compact} plain dimColor onPress={act.toggleCompact} />
      </Box>
      <Text dimColor>
        ≈{fmtUsd(t.cost)} · {fmtTokens(t.tokens)} {plural(t.tokens, 'token', 'tokens')}
        {sessionText && ` · ${sessionText}`}
      </Text>
      {p.isCompact ? (
        <Text wrap="truncate-end">
          {[...running, ...finishedRuns].map(a => (
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
          {body(itemText, plannedText, null)}
        </Box>
      )}
    </Box>
  )
}
