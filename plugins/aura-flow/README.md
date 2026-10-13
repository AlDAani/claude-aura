# aura-flow

An orchestrated delivery flow for Claude Code. Run `/flow <task>` (its full name is `/aura-flow:flow`, for when another command already uses `/flow`): the session model plans, owns design, delegates implementation to tiered worker subagents and adversarially reviews what they return.

```
/plugin install aura-flow --marketplace AlDAani/claude-aura
```

## What ships

- **Skill** `flow`: the orchestrator's playbook.
- **Agents** by tier, cheapest that gets the task right first time:

  | Agent | Model / effort | For |
  | --- | --- | --- |
  | `aura-fable` | Fable / high | the hardest logic and bugs; design features on request |
  | `aura-heavy` | Opus / xhigh | unfamiliar code, unclear root cause |
  | `aura-careful` | Opus / high | delicate but well-understood changes |
  | `aura-medium` | Opus / medium | standard feature work |
  | `aura-light` | Opus / low | mechanical edits, builds, tests |

  `aura-fable` runs on the Fable model; without access to it, change `model:` in `agents/aura-fable.md` (say, to `opus`).

## With aura-hud

The skill and the agents run fine alone. With the [aura-hud](../aura-hud) mod installed, the orchestrator shows the plan and accepted tasks in the agents panel, and each worker reports its own steps there. Without the mod those calls are skipped.

Install instructions are in the [repository README](../../README.md).
