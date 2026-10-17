#!/usr/bin/env node

import { createHash } from 'node:crypto'
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { deflateSync, inflateSync } from 'node:zlib'

const here = dirname(new URL(import.meta.url).pathname)
const output = resolve(here, '..', '..', 'plugins', 'aura-hud', 'hooks', 'lib', 'generated-costumes.ts')
const assets = here
const normalized = join(assets, 'normalized')
const reference = join(assets, 'reference')
const provenance = join(assets, 'provenance.json')
const contactSheet = join(assets, 'contact-sheet.svg')
const partial = process.argv.includes('--partial')
const inputArgument = process.argv.slice(2).find(argument => !argument.startsWith('--'))
if (!inputArgument) {
  console.error('usage: node art/costumes/import-costumes.mjs <folder with the generated PNGs> [--partial]')
  process.exit(2)
}
const input = resolve(inputArgument)

const costumes = [
  'fable-wizard',
  'fable-knight',
  'fable-royal',
  'fable-oracle',
  'fable-dragon',
  'fable-alchemist',
  'fable-stargazer',
  'opus-professor',
  'opus-surgeon',
  'opus-judge',
  'opus-captain',
  'opus-scientist',
  'opus-conductor',
  'sonnet-painter',
  'sonnet-poet',
  'sonnet-musician',
  'sonnet-barista',
  'sonnet-gardener',
  'sonnet-photographer',
  'sonnet-dj',
  'haiku-skater',
  'haiku-ninja',
  'haiku-courier',
  'haiku-sprinter',
  'haiku-surfer',
  'haiku-pilot',
]

const readPng = data => {
  const signature = '89504e470d0a1a0a'
  if (data.subarray(0, 8).toString('hex') !== signature) throw new Error('not a PNG')
  let offset = 8
  let width = 0
  let height = 0
  let bitDepth = 0
  let colorType = 0
  const chunks = []
  while (offset < data.length) {
    const length = data.readUInt32BE(offset)
    const type = data.subarray(offset + 4, offset + 8).toString('ascii')
    const body = data.subarray(offset + 8, offset + 8 + length)
    offset += 12 + length
    if (type === 'IHDR') {
      width = body.readUInt32BE(0)
      height = body.readUInt32BE(4)
      bitDepth = body[8]
      colorType = body[9]
      if (body[12] !== 0) throw new Error('interlaced PNGs are not supported')
    } else if (type === 'IDAT') chunks.push(body)
    else if (type === 'IEND') break
  }
  if (!width || width !== height) throw new Error(`expected a square PNG, received ${width}×${height}`)
  if (bitDepth !== 8 || ![2, 6].includes(colorType)) throw new Error(`expected 8-bit RGB/RGBA PNG, received type ${colorType} at ${bitDepth} bit`)
  const channels = colorType === 6 ? 4 : 3
  const rowBytes = width * channels
  const raw = inflateSync(Buffer.concat(chunks))
  const pixels = Buffer.alloc(rowBytes * height)
  let from = 0
  for (let y = 0; y < height; y += 1) {
    const filter = raw[from++]
    const row = pixels.subarray(y * rowBytes, (y + 1) * rowBytes)
    const previous = y ? pixels.subarray((y - 1) * rowBytes, y * rowBytes) : null
    for (let x = 0; x < rowBytes; x += 1) {
      const value = raw[from++]
      const left = x >= channels ? row[x - channels] : 0
      const above = previous ? previous[x] : 0
      const upperLeft = previous && x >= channels ? previous[x - channels] : 0
      if (filter === 0) row[x] = value
      else if (filter === 1) row[x] = (value + left) & 255
      else if (filter === 2) row[x] = (value + above) & 255
      else if (filter === 3) row[x] = (value + Math.floor((left + above) / 2)) & 255
      else if (filter === 4) {
        const p = left + above - upperLeft
        const pa = Math.abs(p - left)
        const pb = Math.abs(p - above)
        const pc = Math.abs(p - upperLeft)
        row[x] = (value + (pa <= pb && pa <= pc ? left : pb <= pc ? above : upperLeft)) & 255
      } else throw new Error(`unknown PNG filter ${filter}`)
    }
  }
  return { width, height, channels, pixels }
}

const colorAt = (png, x, y) => {
  const index = (y * png.width + x) * png.channels
  const alpha = png.channels === 4 ? png.pixels[index + 3] : 255
  return [png.pixels[index], png.pixels[index + 1], png.pixels[index + 2], alpha]
}

const hex = (r, g, b) => `#${[r, g, b].map(n => n.toString(16).padStart(2, '0')).join('')}`
const bucket = value => (value >= 240 ? 255 : Math.round(value / 32) * 32)
const quantizedHex = (r, g, b) => hex(bucket(r), bucket(g), bucket(b))

const isMagenta = (r, g, b, a) =>
  a < 128 ||
  (r > 215 && g < 100 && b > 170) ||
  (r > 80 && b > 80 && g < Math.min(r, b) * 0.4 && Math.abs(r - b) <= Math.max(r, b) * 0.22)
const isCyan = (r, g, b) => r <= 100 && g >= 150 && b >= 150 && g + b - r >= 360

const sampleCell = (png, cellX, cellY) => {
  const startX = Math.floor((cellX * png.width) / 32)
  const endX = Math.max(startX + 1, Math.floor(((cellX + 1) * png.width) / 32))
  const startY = Math.floor((cellY * png.height) / 32)
  const endY = Math.max(startY + 1, Math.floor(((cellY + 1) * png.height) / 32))
  const insetX = Math.floor((endX - startX) * 0.2)
  const insetY = Math.floor((endY - startY) * 0.2)
  const counts = new Map()
  for (let y = startY + insetY; y < endY - insetY; y += 1) {
    for (let x = startX + insetX; x < endX - insetX; x += 1) {
      const [r, g, b, a] = colorAt(png, x, y)
      if (isMagenta(r, g, b, a)) continue
      const color = isCyan(r, g, b) ? '#00ffff' : quantizedHex(r, g, b)
      counts.set(color, (counts.get(color) ?? 0) + 1)
    }
  }
  return [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] ?? null
}

const isHeadwear = (x, y) => x >= 3 && x <= 28 && y <= 20
const isLeftProp = (x, y) => x <= 3 && y >= 9 && y <= 27
const isRightProp = (x, y) => x >= 28 && y <= 27
const isSideProp = (x, y) => (x <= 3 || x >= 28) && y >= 18 && y <= 27
const isWideLeftProp = (x, y) => x <= 7 && y >= 10 && y <= 27
const isWideRightProp = (x, y) => x >= 25 && y >= 10 && y <= 27
const inSafeZone = (x, y) => isHeadwear(x, y) || isLeftProp(x, y) || isRightProp(x, y)

const propSides = {
  'fable-oracle': 'right',
  'fable-alchemist': 'left',
  'fable-stargazer': 'right',
  'opus-professor': 'left',
  'opus-surgeon': 'right',
  'opus-judge': 'right',
  'opus-captain': 'right',
  'opus-scientist': 'left',
  'opus-conductor': 'right',
  'sonnet-painter': 'right',
  'sonnet-poet': 'right',
  'sonnet-musician': 'left',
  'sonnet-barista': 'right',
  'sonnet-gardener': 'left',
  'sonnet-photographer': 'right',
  'sonnet-dj': 'left',
  'haiku-skater': 'left',
  'haiku-courier': 'right',
  'haiku-sprinter': 'right',
  'haiku-surfer': 'left',
  'haiku-pilot': 'right',
}

const propSourceOverrides = {
  'fable-alchemist': 'right',
  'opus-scientist': 'right',
  'sonnet-musician': 'right',
}

const rgb = color => [Number.parseInt(color.slice(1, 3), 16), Number.parseInt(color.slice(3, 5), 16), Number.parseInt(color.slice(5, 7), 16)]
const distance = (a, b) => a.reduce((total, value, i) => total + (value - b[i]) ** 2, 0)
const canonicalDistance = color => Math.min(distance(rgb(color), [217, 119, 87]), distance(rgb(color), [31, 30, 29]))
const artScore = color => (color === '#00ffff' ? 1_000_000 : canonicalDistance(color))

const simplifyPalette = cells => {
  const counts = new Map()
  for (const color of cells.values()) if (color !== '#00ffff') counts.set(color, (counts.get(color) ?? 0) + 1)
  const retained = [...counts]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 9)
    .map(([color]) => color)
  const retainedRgb = retained.map(rgb)
  for (const [key, color] of cells) {
    if (color === '#00ffff' || retained.includes(color)) continue
    const source = rgb(color)
    let nearest = 0
    for (let i = 1; i < retainedRgb.length; i += 1) if (distance(source, retainedRgb[i]) < distance(source, retainedRgb[nearest])) nearest = i
    cells.set(key, retained[nearest])
  }
}

const normalizeAccents = (cells, name) => {
  let candidates = [...cells].filter(([, color]) => color === '#00ffff')
  let promoted = false
  if (candidates.length < 2) {
    const groups = new Map()
    for (const [key, color] of cells) {
      const [r, g, b] = rgb(color)
      const chroma = Math.max(r, g, b) - Math.min(r, g, b)
      const clayDistance = distance([r, g, b], [217, 119, 87])
      const inkDistance = distance([r, g, b], [31, 30, 29])
      if (chroma < 20 || clayDistance < 1_800 || inkDistance < 1_800) continue
      const group = groups.get(color) ?? []
      group.push(key)
      groups.set(color, group)
    }
    const fallback = [...groups].sort(([a, aKeys], [b, bKeys]) => {
      const [ar, ag, ab] = rgb(a)
      const [br, bg, bb] = rgb(b)
      const aScore = (Math.max(ar, ag, ab) - Math.min(ar, ag, ab)) * 10 + aKeys.length
      const bScore = (Math.max(br, bg, bb) - Math.min(br, bg, bb)) * 10 + bKeys.length
      return bScore - aScore || a.localeCompare(b)
    })[0]?.[1]
    if (!fallback || fallback.length < 2) throw new Error(`${name}: has no usable colour to promote into its required tier accent`)
    const [first, second] = fallback
    cells.set(first, '#00ffff')
    cells.set(second, '#00ffff')
    candidates = [[first, '#00ffff'], [second, '#00ffff']]
    promoted = true
  }
  const center = candidates.reduce(
    (total, [key]) => {
      const [x, y] = key.split(',').map(Number)
      return [total[0] + x / candidates.length, total[1] + y / candidates.length]
    },
    [0, 0],
  )
  const retained = new Set(
    candidates
      .sort(([a], [b]) => {
        const [ax, ay] = a.split(',').map(Number)
        const [bx, by] = b.split(',').map(Number)
        return (ax - center[0]) ** 2 + (ay - center[1]) ** 2 - ((bx - center[0]) ** 2 + (by - center[1]) ** 2)
      })
      .slice(0, 12)
      .map(([key]) => key),
  )
  for (const [key, color] of cells) if (color === '#00ffff' && !retained.has(key)) cells.set(key, '#2f7de1')
  return { cells: retained.size, promoted }
}

const removeBackgroundFlecks = cells => {
  for (const [key, color] of [...cells]) {
    if (color === '#00ffff') continue
    const [r, g, b] = rgb(color)
    const chroma = Math.max(r, g, b) - Math.min(r, g, b)
    const darkOrNeutral = Math.max(r, g, b) < 112 || chroma < 48
    if (!darkOrNeutral) continue
    const [x, y] = key.split(',').map(Number)
    let hasNeighbour = false
    for (let dy = -1; dy <= 1; dy += 1) {
      for (let dx = -1; dx <= 1; dx += 1) if ((dx || dy) && cells.has(`${x + dx},${y + dy}`)) hasNeighbour = true
    }
    if (!hasNeighbour) cells.delete(key)
  }
}

const runsFor = cells => {
  const byColor = new Map()
  for (const [key, color] of cells) {
    const [x, y] = key.split(',').map(Number)
    const row = byColor.get(color) ?? new Map()
    const xs = row.get(y) ?? []
    xs.push(x)
    row.set(y, xs)
    byColor.set(color, row)
  }
  return [...byColor]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([color, rows]) => {
      const segments = []
      for (const [y, xs] of [...rows].sort(([a], [b]) => a - b)) {
        xs.sort((a, b) => a - b)
        let start = xs[0]
        let previous = start
        for (const x of xs.slice(1)) {
          if (x === previous + 1) previous = x
          else {
            segments.push(`${start},${y},${previous - start + 1}`)
            start = previous = x
          }
        }
        segments.push(`${start},${y},${previous - start + 1}`)
      }
      return [color, segments.join(' ')]
    })
}

const importCostume = async name => {
  const file = join(input, `${name}.png`)
  const bytes = await readFile(file)
  const png = readPng(bytes)
  const sourceCells = new Map()
  const expectedSide = propSides[name]
  for (let y = 0; y < 32; y += 1) {
    for (let x = 0; x < 32; x += 1) {
      const color = sampleCell(png, x, y)
      const isDriftedBase = Boolean(color) && y >= 16 && canonicalDistance(color) < 2_200
      const isPotentialProp = Boolean(expectedSide) && (isWideLeftProp(x, y) || isWideRightProp(x, y))
      if (color && !isDriftedBase && (inSafeZone(x, y) || isPotentialProp)) sourceCells.set(`${x},${y}`, color)
    }
  }
  const sourceSide = propSourceOverrides[name] ?? expectedSide
  const propEntries = expectedSide
    ? [...sourceCells].filter(([key]) => {
        const [x, y] = key.split(',').map(Number)
        return sourceSide === 'left' ? isWideLeftProp(x, y) : isWideRightProp(x, y)
      })
    : []
  if (expectedSide) {
    for (const key of sourceCells.keys()) {
      const [x, y] = key.split(',').map(Number)
      if (isWideLeftProp(x, y) || isWideRightProp(x, y)) sourceCells.delete(key)
    }
  }
  const cells = new Map()
  for (const [key, color] of sourceCells) {
    let [x, y] = key.split(',').map(Number)
    const runtimeY = isHeadwear(x, y) ? Math.min(9, Math.floor((y * 10) / 16)) : y - 6
    const destination = `${x - 1},${runtimeY}`
    const previous = cells.get(destination)
    if (!previous || artScore(color) >= artScore(previous)) cells.set(destination, color)
  }
  if (propEntries.length && expectedSide) {
    const points = propEntries.map(([key, color]) => [...key.split(',').map(Number), color])
    const xs = points.map(([x]) => x)
    const ys = points.map(([, y]) => y)
    const minX = Math.min(...xs)
    const maxX = Math.max(...xs)
    const minY = Math.min(...ys)
    const maxY = Math.max(...ys)
    const width = Math.max(1, maxX - minX + 1)
    const height = Math.max(1, maxY - minY + 1)
    const scale = Math.min(1, 4 / width, 12 / height)
    const targetX = expectedSide === 'left' ? 0 : 27
    const centerY = Math.min(16, Math.max(7, Math.round((minY + maxY) / 2) - 6))
    for (const [x, y, color] of points) {
      const mappedX = targetX + Math.min(3, Math.max(0, Math.round((x - minX) * scale)))
      const mappedY = Math.min(21, Math.max(4, Math.round(centerY + (y - (minY + maxY) / 2) * scale)))
      const destination = `${mappedX},${mappedY}`
      const previous = cells.get(destination)
      if (!previous || artScore(color) >= artScore(previous)) cells.set(destination, color)
    }
  }
  removeBackgroundFlecks(cells)
  const accents = normalizeAccents(cells, name)
  simplifyPalette(cells)
  const palette = new Set(cells.values())
  if (palette.size > 10) throw new Error(`${name}: palette reduction failed (${palette.size} colours)`)
  return {
    name,
    file,
    bytes,
    art: runsFor(cells),
    source: { bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex'), width: png.width, height: png.height },
    imported: { cells: cells.size, colours: palette.size, accentCells: accents.cells, accentPromoted: accents.promoted, mirroredProp: Boolean(expectedSide && sourceSide !== expectedSide) },
  }
}

const canonicalCrab =
  '<path d="M7 10h16v12h-16zM3 14h4v4h-4zM23 14h4v4h-4zM7 22h2v4h-2zM17 22h2v4h-2zM11 22h2v4h-2zM21 22h2v4h-2z" fill="#d97757"/>' +
  '<path d="M9 12h2v2h-2zM19 12h2v2h-2z" fill="#1f1e1d"/>'

const crc32 = data => {
  let crc = 0xffffffff
  for (const value of data) {
    crc ^= value
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0)
  }
  return (crc ^ 0xffffffff) >>> 0
}

const chunk = (type, data) => {
  const header = Buffer.alloc(8)
  header.writeUInt32BE(data.length, 0)
  header.write(type, 4, 4, 'ascii')
  const checksum = Buffer.alloc(4)
  checksum.writeUInt32BE(crc32(Buffer.concat([header.subarray(4), data])), 0)
  return Buffer.concat([header, data, checksum])
}

const pngOf = (pixels, width, height) => {
  const raw = Buffer.alloc((width * 4 + 1) * height)
  for (let y = 0; y < height; y += 1) {
    raw[y * (width * 4 + 1)] = 0
    pixels.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4)
  }
  const header = Buffer.alloc(13)
  header.writeUInt32BE(width, 0)
  header.writeUInt32BE(height, 4)
  header[8] = 8
  header[9] = 6
  return Buffer.concat([Buffer.from('89504e470d0a1a0a', 'hex'), chunk('IHDR', header), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))])
}

const pixelsOf = item => {
  const pixels = Buffer.alloc(32 * 32 * 4)
  const paint = (x, y, width, height, color) => {
    const [r, g, b] = rgb(color)
    for (let row = Math.max(0, y); row < Math.min(32, y + height); row += 1) {
      for (let column = Math.max(0, x); column < Math.min(32, x + width); column += 1) {
        pixels.set([r, g, b, 255], (row * 32 + column) * 4)
      }
    }
  }
  for (const [color, runs] of item.art) {
    for (const run of runs.split(' ')) {
      const [x, y, width] = run.split(',').map(Number)
      paint(x + 1, y + 6, width, 1, color)
    }
  }
  paint(8, 16, 16, 12, '#d97757')
  paint(4, 20, 4, 4, '#d97757')
  paint(24, 20, 4, 4, '#d97757')
  paint(8, 28, 2, 4, '#d97757')
  paint(18, 28, 2, 4, '#d97757')
  paint(12, 28, 2, 4, '#d97757')
  paint(22, 28, 2, 4, '#d97757')
  paint(10, 18, 2, 2, '#1f1e1d')
  paint(20, 18, 2, 2, '#1f1e1d')
  return pixels
}

const pathsOf = art =>
  art
    .map(([color, runs]) => {
      const d = runs
        .split(' ')
        .map(run => {
          const [x, y, width] = run.split(',')
          return `M${x} ${y}h${width}v1h-${width}z`
        })
        .join('')
      return `<path fill="${color}" d="${d}"/>`
    })
    .join('')

const sheetOf = imported => {
  const cell = 300
  const columns = 4
  const rows = Math.ceil(imported.length / columns)
  const symbols = imported.map((item, i) => `<symbol id="c${i}">${pathsOf(item.art)}<use href="#crab"/></symbol>`).join('')
  const tiles = imported
    .map((item, i) => {
      const x = (i % columns) * cell
      const y = Math.floor(i / columns) * cell
      const sprite = (left, top, scale) => `<use href="#c${i}" transform="translate(${left} ${top}) scale(${scale})"/>`
      return (
        `<g transform="translate(${x} ${y})"><rect width="146" height="264" rx="8" fill="#ffffff"/><rect x="150" width="146" height="264" rx="8" fill="#1f1e1d"/>` +
        `${sprite(57, 34, 1)}${sprite(17, 108, 4)}${sprite(207, 34, 1)}${sprite(167, 108, 4)}` +
        `<text x="148" y="282" text-anchor="middle">${item.name}</text></g>`
      )
    })
    .join('')
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${columns * cell}" height="${rows * cell}" viewBox="0 0 ${columns * cell} ${rows * cell}" shape-rendering="crispEdges">` +
    `<style>text{font:10px ui-monospace,monospace;fill:#777}</style><defs><symbol id="crab">${canonicalCrab}</symbol>${symbols}</defs>${tiles}</svg>\n`
  )
}

const main = async () => {
  const missing = []
  for (const name of costumes) {
    try {
      await readFile(join(input, `${name}.png`))
    } catch {
      missing.push(`${name}.png`)
    }
  }
  if (missing.length && !partial) throw new Error(`missing ${missing.length} costume source file(s) in ${input}: ${missing.join(', ')}`)
  if (partial && missing.length) console.warn(`Partial import: waiting for ${missing.length} source file(s): ${missing.join(', ')}`)
  const imported = []
  for (const name of costumes) if (!missing.includes(`${name}.png`)) imported.push(await importCostume(name))
  await rm(normalized, { recursive: true, force: true })
  await mkdir(normalized, { recursive: true })
  for (const item of imported) await writeFile(join(normalized, `${item.name}.png`), pngOf(pixelsOf(item), 32, 32))
  await mkdir(reference, { recursive: true })
  for (const file of ['BRIEF.md', 'examples.png', 'template.png', 'zones.png', 'zones.svg', 'prompt-set.json']) {
    const from = join(input, '..', file)
    const to = join(reference, file)
    if (resolve(from) !== resolve(to)) await cp(from, to).catch(() => undefined)
  }
  const generated = [
    "export type ImportedCostumeArt = readonly (readonly [color: string, runs: string])[]",
    '',
    'export const importedCostumes: Readonly<Record<string, ImportedCostumeArt>> = {',
    ...imported.map(item => `  ${JSON.stringify(item.name)}: ${JSON.stringify(item.art)},`),
    '}',
    '',
  ].join('\n')
  await writeFile(output, generated)
  await writeFile(contactSheet, sheetOf(imported))
  await writeFile(
    provenance,
    JSON.stringify(
      {
        importer: 'art/costumes/import-costumes.mjs',
        sourceDirectory: 'aura-icons/in',
        grid: '32×32',
        templateToRuntimeOffset: { x: -1, y: -6 },
        safeZones: 'headwear x=3..28,y=0..17 fitted above the live body; left prop x=0..3,y=9..27; right prop x=28..31,y=0..27',
        costumes: imported.map(({ name, source, imported: result }) => ({ name, source, imported: result })),
      },
      null,
      2,
    ) + '\n',
  )
  console.log(`Imported ${imported.length} costumes from ${input}`)
}

main().catch(error => {
  console.error(error instanceof Error ? error.stack || error.message : error)
  process.exitCode = 1
})
