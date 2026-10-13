import type { Elements, RenderSurface } from 'claude-code'

import type { Crew, Flow, Look } from '../../types'

import { BAND_H, bandSvg } from '../lib/draw-band'
import { label, ratio } from '../lib/flow'
import { textBar } from '../lib/format'

const CLAY = '#d97757'

export type BandView = { surface: RenderSurface; flow: Flow; crew: Crew; look: Look; bodyColumns: number }

export type BandActions = { toggle: () => unknown; dismiss: () => unknown }

export const bandTree = (ui: Elements[RenderSurface], v: BandView, act: BandActions) => {
  const { Box, Text, Button } = ui
  const f = v.flow
  const percent = `${Math.round(ratio(f) * 100)}%`
  const text = label(f, v.crew.workers)
  const crewButton = <Button key="aura-agents" label={`×${v.crew.size}`} plain onPress={act.toggle} />
  const dismiss = <Button key="aura-dismiss" label="✕" plain role="dismiss" onPress={act.dismiss} />

  if (v.surface === 'desktop' && 'Svg' in ui) {
    const { Svg } = ui
    const width = Math.max(180, Math.min(1600, (v.bodyColumns || 100) * 8 - 96))
    return (
      <Box flexDirection="row" alignItems="center" gap={1}>
        <Svg
          source={bandSvg(f, v.crew.workers, width, v.crew.running > 0, v.look)}
          alt={`${f.title}: ${text}, ${percent}`}
          width={width}
          height={BAND_H}
        />
        {crewButton}
        {dismiss}
      </Box>
    )
  }

  const cols = v.bodyColumns
  const titleW = Math.max(8, Math.min(30, f.title.length + 2, Math.floor(cols / 3)))
  const width = Math.max(6, Math.min(40, cols - titleW - 32))
  const tone = f.isFinished ? 'success' : 'claude'
  return (
    <Box flexDirection="row" gap={2}>
      <Box width={titleW} flexShrink={0}>
        <Text color={tone}>● </Text>
        <Text wrap="truncate-end">{f.title}</Text>
      </Box>
      <Text color={tone}>{textBar(ratio(f), width)}</Text>
      <Text bold>{text}</Text>
      <Text dimColor>{percent}</Text>
      <Text color={CLAY}>▣</Text>
      {crewButton}
      {dismiss}
    </Box>
  )
}
