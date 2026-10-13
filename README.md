# claude-aura

Claude Aura: upgrades for [Claude Code](https://claude.com/claude-code) — agent orchestration, a live progress HUD and color themes. Every item is a standalone plugin under `plugins/`: install only what you need.

| Plugin | Type | What it does |
| --- | --- | --- |
| [aura-flow](plugins/aura-flow) | skill + agents | `/flow <task>`: the session model plans, delegates to tiered worker subagents and reviews their work. |
| [aura-hud](plugins/aura-hud) | mod | A progress bar above the prompt and a live agents panel, in Claude, ChatGPT Dark or WebStorm Islands Dark colors (`/look`). Made for aura-flow, shows any subagents. |
| [aura-themes](plugins/aura-themes) | themes | ChatGPT Dark and WebStorm Islands Dark color themes for Claude Code, picked in `/theme`. |

aura-flow and aura-hud work on their own and light up together: with both installed, the flow drives the bar and workers report their progress to the panel. aura-themes recolors Claude Code itself in a terminal: pick its themes in `/theme`.

## Commands

| Command | What it does |
| --- | --- |
| `/flow <task>` | Plans the task, hands it to tiered worker agents and reviews what they return. The full name is `/aura-flow:flow`, for when another command already uses `/flow`. |
| `/look [auto\|claude\|chatgpt\|webstorm]` | Picks the colors of the progress bar and the agents panel and opens the panel to show them. Where the session lists the aura-themes themes in its theme setting, it switches the Claude Code theme too; otherwise pick that theme in `/theme` in a terminal. Without an argument it shows the current choice. |

The agents panel needs no command: it opens by itself when subagents start working, and the crew button on the progress bar shows or hides it.

## Install

### From the marketplace

In Claude Code:

```
/plugin marketplace add AlDAani/claude-aura
/plugin install aura-flow@claude-aura
/plugin install aura-hud@claude-aura
/plugin install aura-themes@claude-aura
```

In the Claude desktop app `/plugin` opens the plugin browser instead; install from a terminal there:

```bash
claude plugin install aura-hud --marketplace AlDAani/claude-aura
```

Restart the session afterwards.

### By hand

```bash
git clone https://github.com/AlDAani/claude-aura.git ~/claude-aura
```

**A skill** (no plugin system involved, names stay short: `/flow`, `aura-careful`): copy its folders into your Claude Code config.

```bash
cp -R ~/claude-aura/plugins/aura-flow/skills/flow ~/.claude/skills/
```

```bash
cp ~/claude-aura/plugins/aura-flow/agents/*.md ~/.claude/agents/
```

**A mod**: load the folder for one session,

```bash
claude --plugin-dir ~/claude-aura/plugins/aura-hud
```

or for every session (including the desktop app) through `env` in `~/.claude/settings.json`. Several folders are separated with `:`; if the variable is already set, append to it rather than replacing it:

```json
{
  "env": {
    "CLAUDE_CODE_PLUGIN_DIRS": "~/claude-aura/plugins/aura-hud"
  }
}
```

`git pull` in the clone updates a mod loaded this way; copied skills need copying again.

Mods are built on function hooks (`hooks/register.tsx`), a newer Claude Code API that may change between releases. If a mod installed from the marketplace does not show up, load it by hand as above.

## Layout

```
.claude-plugin/marketplace.json   the catalog `/plugin marketplace add` reads
plugins/<name>/
  .claude-plugin/plugin.json      manifest
  skills/<skill>/SKILL.md         a skill
  agents/*.md                     subagents it ships
  hooks/hooks.json                a mod: points at the hooks module
  hooks/register.tsx              a mod: the module itself
  hooks/lib/, hooks/views/        a mod: what the module draws and computes
  types/index.d.ts                a mod: its $.state contract
  tests/*.test.ts                 a mod: its tests, run by `claude plugin test`
  themes/*.json                   a theme pack: Claude Code color themes
```

Check a plugin before publishing: `claude plugin validate plugins/<name>`, and the catalog with `claude plugin validate .`.

## License

MIT
