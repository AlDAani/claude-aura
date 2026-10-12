# good-look-flow

An orchestrated delivery flow for Claude Code. Run `/good-look-flow <task>` (`/good-look-flow:good-look-flow` when installed as a plugin): the session model plans, owns design, delegates implementation to tiered worker subagents and adversarially reviews what they return.

## What ships

- **Skill** `good-look-flow`: the orchestrator's playbook.
- **Agents** by tier, cheapest that gets the task right first time:

  | Agent | Model / effort | For |
  | --- | --- | --- |
  | `good-look-fable` | Fable / high | the hardest logic and bugs; design features on request |
  | `good-look-heavy` | Opus / xhigh | unfamiliar code, unclear root cause |
  | `good-look-careful` | Opus / high | delicate but well-understood changes |
  | `good-look-medium` | Opus / medium | standard feature work |
  | `good-look-light` | Opus / low | mechanical edits, builds, tests |

  `good-look-fable` runs on the Fable model; without access to it, change `model:` in `agents/good-look-fable.md` (say, to `opus`).

## With good-look-progress

The skill and the agents run fine alone. With the [good-look-progress](../good-look-progress) mod installed, the orchestrator reports the plan and accepted tasks to a progress bar above the prompt, and each worker reports its own steps to the agents panel. Without the mod those calls are skipped.

Install instructions are in the [repository README](../../README.md).
