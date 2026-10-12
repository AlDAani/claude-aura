# claude-good-look

Skins for [Claude Code](https://claude.com/claude-code): mods that change how it looks, plus the skills they pair with. Every item is a standalone plugin under `plugins/`: install only what you need.

| Plugin | Type | What it does |
| --- | --- | --- |
| [good-look-flow](plugins/good-look-flow) | skill + agents | `/good-look-flow <task>`: the session model plans, delegates to tiered worker subagents and reviews their work. |
| [good-look-progress](plugins/good-look-progress) | mod | A progress bar above the prompt and a live agents panel. Made for good-look-flow, shows any subagents. |

good-look-flow and good-look-progress work on their own and light up together: with both installed, the flow drives the bar and workers report their progress to the panel.

## Install

### From the marketplace

In Claude Code:

```
/plugin marketplace add AlDAani/claude-good-look
/plugin install good-look-flow@claude-good-look
/plugin install good-look-progress@claude-good-look
```

Restart the session afterwards. Plugin skills and agents are namespaced: the skill is `/good-look-flow:good-look-flow`, the agents `good-look-flow:good-look-careful` and so on.

### By hand

```bash
git clone https://github.com/AlDAani/claude-good-look.git ~/claude-good-look
```

**A skill** (no plugin system involved, names stay short: `/good-look-flow`, `good-look-careful`): copy its folders into your Claude Code config.

```bash
cp -R ~/claude-good-look/plugins/good-look-flow/skills/good-look-flow ~/.claude/skills/
```

```bash
cp ~/claude-good-look/plugins/good-look-flow/agents/*.md ~/.claude/agents/
```

**A mod**: load the folder for one session,

```bash
claude --plugin-dir ~/claude-good-look/plugins/good-look-progress
```

or for every session (including the desktop app) through `env` in `~/.claude/settings.json`. Several folders are separated with `:`; if the variable is already set, append to it rather than replacing it:

```json
{
  "env": {
    "CLAUDE_CODE_PLUGIN_DIRS": "~/claude-good-look/plugins/good-look-progress"
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
  types/index.d.ts                a mod: its $.state contract
```

Check a plugin before publishing: `claude plugin validate plugins/<name>`, and the catalog with `claude plugin validate .`.

## License

MIT
