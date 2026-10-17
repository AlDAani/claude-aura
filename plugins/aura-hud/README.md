# aura-hud

A Claude Code mod: a live panel of subagents. Made for the [aura-flow](../aura-flow) skill, and useful with any subagents.

```
/plugin install aura-hud --marketplace AlDAani/claude-aura
```

- **Agents panel**: opens by itself when subagents start working, and once per batch: closed, it stays closed until the next batch. It shows the flow's title and plan, the cost and tokens of the agents it lists, the cost of the whole session (the main thread and every subagent, the figure `/cost` shows), and how full the main session's context is, in red from 80%. It lists running, finished and planned subagents with model, effort, task progress, context and estimated cost. Clicking a subagent's title opens its history in the panel, scrolled to its latest entries: its brief, what it wrote, and a timeline of its tool calls, one line each, repeats folded and errors in red; a running one fills in as it works, and ← Agents goes back to the list. Working crabs hop and walk, and the original six costumes also animate their props: the astronaut floats, the detective sweeps the magnifier, the engineer turns the wrench, the chef tosses the omelette, the racer runs with a fluttering flag. `prefers-reduced-motion` stops them. The panel lists the 40 newest finished runs.

Each Fable, Opus, Sonnet and Haiku agent gets one of eight costumes when it starts and keeps it for its lifetime. Unknown models use the plain crab. The costumes ship as compact pixel runs in `hooks/lib/generated-costumes.ts`; the importer, the 32×32 sprites, the prompt set and a light/dark contact sheet live in `art/costumes/` at the root of the repository, outside the installed plugin. To rebuild from generated PNGs, run `node art/costumes/import-costumes.mjs <folder>` from the repository root.

## Palettes

`/look` picks the palette the panel draws with:

| `/look` | Palette |
| --- | --- |
| `auto` (default) | Follows the Claude Code theme: ChatGPT Dark or WebStorm Islands Dark while one of the [aura-themes](../aura-themes) themes is active, Claude otherwise. |
| `claude` | The original lavender and clay. |
| `chatgpt` | ChatGPT Dark: neutral greys and a white accent. |
| `webstorm` | WebStorm Islands Dark: a blue accent and WebStorm's syntax colors for the tiers. |

Each palette has a light and a dark variant that follow the system appearance. Setting a palette opens the agents panel so you can see it. `/look` recolors only the panel: Claude Code's own colors come from its theme, picked in `/theme` in a terminal (the [aura-themes](../aura-themes) themes match these palettes), and the Claude desktop app keeps its own colors. Should Claude Code ever offer plugin themes in its theme setting, `/look chatgpt` and `/look webstorm` switch to the matching theme and `/look claude` brings back the one you had.

## Tools it adds

- `mcp__aura-hud__progress`: the orchestrator reports the plan, phase and accepted tasks.
- `mcp__aura-hud__step`: a worker reports its own steps (`done`, `total`, `note`). Only a worker that reports steps gets a progress bar; any other running agent shows its live dot and its hopping crab.

The agents' cost is an estimate from token counts and a built-in table of Anthropic prices (`hooks/lib/model.ts`), not a bill. The session tile is Claude Code's own running total, the same figure `/cost` shows.

## What it reads and keeps

It reads what Claude Code hands every mod: subagent launches and their token usage, and the `theme` setting for `/look auto`. It changes the `theme` setting only from `/look`, as described above. It keeps the panel's data in the session's state, and the `/look` choice and the theme to restore in its own plugin store. It sends nothing anywhere and runs no commands.

## Development

`claude plugin test plugins/aura-hud` runs the tests in `tests/`. The hooks module is `hooks/register.tsx`; drawing, palettes and pricing live in `hooks/lib/`, the panel and bar trees in `hooks/views/`.

Install instructions for every plugin are in the [repository README](../../README.md).
