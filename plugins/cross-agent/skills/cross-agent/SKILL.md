---
name: cross-agent
description: Use when a repo has a .cross-agent.json file and you are about to spawn a subagent or delegate planning, coding, review, e2e testing, visual review or other well-scoped work. Routes the task to the agent (Codex, Antigravity/agy, opencode, Claude) configured for that role instead of the default in-harness subagent.
---

# cross-agent: role-based delegation to other coding agents

This repo maps **roles** (plan, code, design-review, e2e-test, visual-review, quick, ...) to ordered lists of external agents in `.cross-agent.json`. When you would delegate work to a subagent, delegate through the configured role instead.

## When to use

- The repo has `.cross-agent.json` at or above the working directory, AND
- you are about to delegate a well-scoped task (plan, implement, review, test, visual check, small chore).

Do not use it for work you should do directly in the main conversation (answering the user, small edits, reading a file). If the user says "do it yourself" or "use a Claude subagent", respect that.

## Steps

1. **Pick the role.** Run `${CLAUDE_PLUGIN_ROOT}/bin/xa-dispatch --list` and match the task to a role by its `description`. If none fits, use a native subagent and say so.
2. **Write a self-contained prompt file.** The external agent has none of this conversation's context. Include: the goal, relevant file paths, constraints, acceptance criteria, and the exact output format you want back. Write it to the scratchpad or a temp file.
3. **Dispatch:**
   ```
   ${CLAUDE_PLUGIN_ROOT}/bin/xa-dispatch <role> --prompt-file <file> [--timeout <sec>]
   ```
   The command prints one JSON object. Long jobs: run it in the background and wait for completion rather than polling.
4. **Always tell the user about fallbacks.** If `fellBack` is true or `notice` is set, show the `notice` text to the user verbatim in your next message (for example a model that is no longer available on their plan). Never hide a fallback.
5. **Use the result.**
   - `ok: true`: read `resultPath` for the agent's answer. Treat it as a colleague's report, not ground truth: verify claims that matter.
   - `warning` set: the agent could not enforce read-only and files changed. Run `git status`, tell the user.
   - `worktree` present (write roles with isolation): the agent worked in a separate git worktree. Review `worktree.patchPath` (the diff), run relevant tests, then apply with `git apply <patchPath>` in the main tree only if it is good. Afterwards run `worktree.cleanup`. Never merge without reviewing the diff.
   - `exitCode: 3` (`ok: false`): every configured agent failed. Show the `notice`, then spawn a native Claude subagent for the task.
   - `exitCode: 2`: config or usage error (see `error`). Fix the config or the call; do not retry blindly.

## Parallel roles

Independent roles can be dispatched in parallel (separate Bash calls with `run_in_background`). Write roles use separate worktrees, so they do not collide.

## Configuration

`/cross-agent:setup` creates or edits `.cross-agent.json` (committed, shared) and `.cross-agent.local.json` (gitignored, machine-specific overrides per role). Agent specs are `adapter:model`; `adapter:default` uses the CLI's default model. Adapters: `claude`, `codex`, `agy`, `opencode`.
