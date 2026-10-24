---
description: Create or change this repo's cross-agent role-to-agent configuration
allowed-tools: Bash, Read, Write, Edit, AskUserQuestion
---

Set up or modify `.cross-agent.json` for the current repo. Re-runnable: if the file exists, show the current role table and ask what to change.

## 1. Detect

For each of `claude`, `codex`, `agy`, `opencode`: `command -v <bin>`. Report which are installed. For installed ones, gather model hints: `agy models`, `codex login status`, `~/.codex/config.toml` default model. Missing CLIs are fine; they just won't be offered.

## 2. Propose roles

Default roles (edit to the user's wishes; ask, do not assume):

| role | access | suggested agents (first = preferred) |
|---|---|---|
| plan | read | claude:opus, codex:gpt-6-sol |
| code | write, isolate worktree | claude:sonnet, opencode:default |
| design-review | read | codex:gpt-6-sol, claude:opus |
| e2e-test | write | codex:gpt-6-astra, claude:sonnet |
| visual-review | read | agy:gemini-3.8-flash-high, claude:opus |
| quick | write, isolate worktree, effort low | opencode:default, claude:haiku |

Only include agents whose CLI is installed. Always end each role with a `claude:*` entry so a role never has nothing to run. Keep the user's preferred models first even if they are not currently available, because a fallback notice is shown when they fail and they take effect automatically once access is gained.

## 3. Probe

For every distinct `adapter:model` in the proposal run `${CLAUDE_PLUGIN_ROOT}/bin/xa-dispatch --probe <spec> --timeout 60` (in parallel). Report which respond and which do not, with the reason. For failures, ask whether to keep them first (recommended when the user expects access), move them later, or drop them.

## 4. Write

Use AskUserQuestion to confirm role table changes (add/remove roles, reorder agents, change access/effort). Then write `.cross-agent.json` as:

```json
{ "version": 1, "roles": { "<role>": { "description": "...", "access": "read|write", "isolate": "worktree", "effort": "low", "agents": ["adapter:model"] } } }
```

(`isolate` and `effort` only where needed.) Machine-specific changes go in `.cross-agent.local.json` instead; make sure `.cross-agent.local.json` is listed in `.gitignore` (append it if not). Validate by running `${CLAUDE_PLUGIN_ROOT}/bin/xa-dispatch --list`. Do not commit or push unless the user asks.
