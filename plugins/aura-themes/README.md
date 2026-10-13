# aura-themes

Color themes for Claude Code:

- **ChatGPT Dark**: the neutral greys of ChatGPT's dark mode, a white accent, blue links, and your messages on a dark grey bubble.
- **WebStorm Islands Dark**: the JetBrains Islands look, with WebStorm's blue accent and its Dark syntax colors for status, modes and subagents.

Install the plugin, then pick a theme in `/theme` in Claude Code in a terminal. Both themes show under their own names, marked as coming from aura-themes.

```
/plugin install aura-themes --marketplace AlDAani/claude-aura
```

A theme recolors Claude Code's own text, borders, diffs and message backgrounds. The window background stays your terminal's, so for the full look set the terminal background to `#212121` for ChatGPT Dark or `#191a1c` for WebStorm Islands Dark.

The Claude desktop app does not apply Claude Code themes yet. There, [aura-hud](../aura-hud) carries the same two palettes for its progress bar and agents panel: `/look chatgpt` or `/look webstorm`.

The plugin holds its manifest, this README and two JSON theme files: it runs no code and sends nothing anywhere.
