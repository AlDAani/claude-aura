# claude-aura

Claude Aura: a live agents panel for [Claude Code](https://claude.com/claude-code). The plugin is [aura-hud](plugins/aura-hud): it shows every subagent while it works, grouped by the workflow that started it, with its model, progress, context and estimated cost, in Claude, ChatGPT Dark or WebStorm Islands Dark colors.

## Commands

| Command | What it does |
| --- | --- |
| `/hud` | Opens the agents panel, for example after you closed it. |
| `/look [auto\|claude\|chatgpt\|webstorm]` | Picks the colors of the agents panel and opens the panel to show them. Without an argument it shows the current choice. It recolors only the panel. |

The agents panel opens by itself when subagents start working, and its close button hides it until the next batch of agents; `/hud` opens it again at any time. `/look` and `/hud` run at once, even while Claude is working, and never interrupt it. Click a subagent's title to open its history. Agents a workflow starts sit under the workflow's name; click the name, or a section header such as Finished, to fold or unfold it. **⊟ Compact** turns the panel into a single line, and **⊞ Expand** brings the list back.

## Install

In a terminal:

```bash
claude plugin install aura-hud --marketplace AlDAani/claude-aura
```

In Claude Code in a terminal, `/plugin install aura-hud --marketplace AlDAani/claude-aura` does the same; in the Claude desktop app `/plugin` opens the plugin browser instead, so use the terminal command there. Then run `/reload-plugins` in open sessions, or start a new one.

### By hand

```bash
git clone https://github.com/AlDAani/claude-aura.git ~/claude-aura
```

Load the folder for one session,

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

`git pull` in the clone updates a plugin loaded this way.

aura-hud is built on function hooks (`hooks/register.tsx`), a newer Claude Code API that may change between releases. If it does not show up after installing from the marketplace, load it by hand as above.

## Layout

```
.claude-plugin/marketplace.json   the catalog the marketplace commands read
plugins/aura-hud/
  .claude-plugin/plugin.json      manifest
  hooks/hooks.json                points at the hooks module
  hooks/register.tsx              the hooks module
  hooks/lib/, hooks/views/        what the module draws and computes
  types/index.d.ts                its $.state contract
  tests/*.test.ts                 its tests, run by `claude plugin test`
art/costumes/                     the crab costume art and its importer
```

Check it before publishing: `claude plugin validate plugins/aura-hud`, and the catalog with `claude plugin validate .`.

## License

MIT
