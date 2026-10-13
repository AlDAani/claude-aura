# good-look-progress

A Claude Code mod: a progress bar above the prompt and a live panel of subagents. Made for the [good-look-flow](../good-look-flow) skill, and useful with any subagents.

```
/plugin install good-look-progress --marketplace AlDAani/claude-good-look
```

- **Progress bar**: the flow's title, phase, accepted tasks out of planned, and a button with the crew size that opens the panel. It appears once something reports progress (good-look-flow does) or a `good-look-*` worker starts. Workers in flight show as a faint layer ahead of the accepted part.
- **Agents panel** (`/agents-info` toggles it): running, finished and planned subagents with model, effort, task progress, context, estimated cost and time. Working crabs walk, and each tier animates its prop: the astronaut floats, the detective sweeps the magnifier, the engineer turns the wrench, the chef tosses the omelette, the racer runs with a fluttering flag. `prefers-reduced-motion` stops them. The panel lists the 40 newest finished runs.

## Palettes

`/look` picks the palette the bar and the panel draw with:

| `/look` | Palette |
| --- | --- |
| `auto` (default) | Follows the Claude Code theme: ChatGPT Dark or WebStorm Islands Dark while one of the [good-look-themes](../good-look-themes) themes is active, Claude otherwise. |
| `claude` | The original lavender and clay. |
| `chatgpt` | ChatGPT Dark: neutral greys and a white accent. |
| `webstorm` | WebStorm Islands Dark: a blue accent and WebStorm's syntax colors for the tiers. |

Each palette has a light and a dark variant that follow the system appearance. With good-look-themes installed, `/look chatgpt` and `/look webstorm` also switch the Claude Code theme, and `/look claude` brings back the theme you had before.

## Tools it adds

- `mcp__good-look-progress__progress`: the orchestrator reports the plan, phase and accepted tasks.
- `mcp__good-look-progress__step`: a worker reports its own steps (`done`, `total`, `note`). A worker that does not report shows its context fill in grey instead.

Cost is an estimate from token counts and a built-in table of Anthropic prices (`hooks/lib/model.ts`), not a bill.

## What it reads and keeps

It reads what Claude Code hands every mod: subagent launches and their token usage, and the `theme` setting for `/look auto`. It keeps the panel's data in the session's state and the `/look` choice in its own plugin store. It sends nothing anywhere and runs no commands.

## Development

`claude plugin test plugins/good-look-progress` runs the tests in `tests/`. The hooks module is `hooks/register.tsx`; drawing, palettes and pricing live in `hooks/lib/`, the panel and bar trees in `hooks/views/`.

Install instructions for every plugin are in the [repository README](../../README.md).
