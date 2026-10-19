# aura-hud

A Claude Code mod: a live panel of the subagents a session runs.

```
/plugin install aura-hud --marketplace AlDAani/claude-aura
```

- **Agents panel**: opens by itself when subagents start working, and once per batch: closed, it stays closed until the next batch, and `/hud` opens it again at any time. It shows the cost and tokens of the agents it lists, the cost of the whole session (the main thread and every subagent, the figure `/cost` shows), and how full the main session's context is, in red from 80%; right after a compaction or `/clear` it shows an estimate of the new size until the next response measures it. It lists running and finished subagents with model, effort, task progress, context and estimated cost, and planned ones when a skill reports a plan through the tools below. Agents a workflow starts sit together under the workflow's name, joined by a rail in the workflow's own color: the header counts its agents, how many are running and how many failed, draws one segment per agent (green done, colored running, red failed) and sums their cost. A running workflow is open and a finished one folds to its header; clicking the name opens or closes it. The Running, Finished and Planned headers fold their sections the same way (▾ open, ▸ folded), and a folded section still says how many of its agents failed and what they cost. **⊟ Compact**, at the end of the first row, turns the panel into one line of crabs and totals; **⊞ Expand** brings the list back. Clicking a subagent's title opens its history in the panel, scrolled to its latest entries: its brief, what it wrote, its final report, and a timeline of its tool calls: commands under the agent's own description of them with their outcome, edits with the lines they added and removed, reads with their length, repeats folded and errors in red; a running one fills in as it works, and ← Agents goes back to the list. Working crabs hop and walk, and the original six costumes also animate their props: the astronaut floats, the detective sweeps the magnifier, the engineer turns the wrench, the chef tosses the omelette, the racer runs with a fluttering flag. `prefers-reduced-motion` stops them. The panel lists the 40 newest finished runs.

Each Fable, Opus, Sonnet and Haiku agent gets one of eight costumes when it starts and keeps it for its lifetime. Unknown models use the plain crab. The costumes ship as compact pixel runs in `hooks/lib/generated-costumes.ts`; the importer, the 32×32 sprites, the prompt set and a light/dark contact sheet live in `art/costumes/` at the root of the repository, outside the installed plugin. To rebuild from generated PNGs, run `node art/costumes/import-costumes.mjs <folder>` from the repository root.

## Palettes

`/look` picks the palette the panel draws with:

| `/look` | Palette |
| --- | --- |
| `auto` (default) | Follows the Claude Code theme: ChatGPT Dark or WebStorm Islands Dark while a theme of that name is active, Claude otherwise. |
| `claude` | The original lavender and clay. |
| `chatgpt` | ChatGPT Dark: neutral greys and a white accent. |
| `webstorm` | WebStorm Islands Dark: a blue accent and WebStorm's syntax colors for the tiers. |

Each palette has a light and a dark variant that follow the system appearance. Setting a palette opens the agents panel so you can see it. `/look` recolors only the panel: Claude Code's own colors come from its theme, picked in `/theme` in a terminal, and the Claude desktop app keeps its own colors.

## Tools it adds

Two tools an orchestrating skill and its worker subagents can call; no agent calls them unless a skill tells it to:

- `mcp__aura-hud__progress`: reports the plan, phase and accepted tasks, shown as the panel's title and its Planned section.
- `mcp__aura-hud__step`: a worker reports its own steps (`done`, `total`, `note`). Only a worker that reports steps gets a progress bar; any other running agent shows its live dot and its hopping crab.

The agents' cost is an estimate from token counts and a built-in table of Anthropic prices (`hooks/lib/model.ts`), not a bill. The session tile is Claude Code's own running total, the same figure `/cost` shows.

## What it reads and keeps

It reads what Claude Code hands every mod: subagent and workflow launches and their token usage, compactions, and the `theme` setting for `/look auto`. It changes no settings. It keeps the panel's data in the session's state, and the `/look` choice in its own plugin store. It sends nothing anywhere and runs no commands.

## Development

`claude plugin test plugins/aura-hud` runs the tests in `tests/`. The hooks module is `hooks/register.tsx`; drawing, palettes and pricing live in `hooks/lib/`, the panel and bar trees in `hooks/views/`.

Install instructions are in the [repository README](../../README.md).
