# cross-agent: design

Route work from Claude Code to other coding agents (Claude, Codex, Antigravity `agy`, opencode) by **role**, configured per repo.

## Decisions

| Topic | Decision |
|---|---|
| Packaging | Plugin `cross-agent` in `plugins/cross-agent/` (skill + commands + runner + adapters) |
| Routing key | Roles (`plan`, `code`, `design-review`, `e2e-test`, `visual-review`, `quick`, user-extensible) |
| Transport | Headless CLI subprocesses. No MCP in v1 |
| Config | `.cross-agent.json` (committed) + `.cross-agent.local.json` (gitignored, machine overrides). JSON: zero dependencies, native in Node, `$schema` for editor validation |
| Runner | `bin/xa-dispatch`, dependency-free Node (>=18) |
| Access | Per-role `read` or `write`. Write roles run in a git worktree; Claude reviews the diff before merging |
| Fallback | Ordered `agents` list per role; first healthy agent runs; last resort is a native Claude subagent |
| Trigger | Skill auto-loads when `.cross-agent.json` exists; plus `/cross-agent:setup` and `/cross-agent:run` |

## Config

```json
{
  "$schema": "./schema.json",
  "version": 1,
  "roles": {
    "plan":          { "description": "Implementation planning", "access": "read",  "agents": ["claude:opus", "codex:sol"] },
    "code":          { "description": "Write code",              "access": "write", "isolate": "worktree", "agents": ["claude:sonnet", "opencode:default"] },
    "design-review": { "description": "Review design/diffs",     "access": "read",  "agents": ["codex:sol", "claude:opus"] },
    "e2e-test":      { "description": "E2E via computer use",    "access": "write", "agents": ["codex:astra", "claude:sonnet"] },
    "visual-review": { "description": "Review visual output",    "access": "read",  "agents": ["agy:gemini-3.8-flash-high", "claude:opus"] },
    "quick":         { "description": "Small low-effort tasks",  "access": "write", "effort": "low", "agents": ["opencode:default", "claude:haiku"] }
  }
}
```

Agent spec = `adapter:model`. `model` is passed through to the adapter's model flag; `default` omits the flag. Optional per-role `effort` (`low|medium|high|xhigh|max`).

## Adapters (verified against installed CLIs)

| Adapter | Read-only | Write | Model | Other |
|---|---|---|---|---|
| `codex` | `codex exec -s read-only` | `-s workspace-write` | `-m` | `-C <dir>`, `-o <file>` for last message, `-i` images |
| `agy` | `agy -p --mode plan` | `--mode accept-edits` | `--model` (see `agy models`) | `--effort`, `--output-format json` |
| `opencode` | `opencode run` (permissions via agent config) | same | `-m provider/model` | `--dir`, `--format json` |
| `claude` | `claude -p --permission-mode plan` | `--permission-mode acceptEdits` | `--model` | |

Adapters are JSON templates in `adapters/*.json` (argv arrays with `{model}`, `{cwd}`, `{effort}`, `{prompt}` placeholders), not code, so adding a CLI is a data change. Prompt goes on stdin where supported to avoid argv length and quoting issues.

## Dispatch flow

1. Skill matches the task to a role (by `description`) and calls `xa-dispatch <role> --prompt-file <f>`.
2. Runner loads config (local overrides merged over committed), walks `agents`:
   - health check: binary on PATH, adapter's cheap auth probe passes
   - first healthy agent wins; failure at run time (rate limit, non-zero exit, timeout) advances to the next
3. `write` + `isolate: worktree`: runner creates `git worktree` on a temp branch, runs the agent with cwd there, and returns the diff path. Never touches the main tree.
4. Output: JSON `{role, agent, fellBack, exitCode, resultPath, worktree?}` on stdout; the agent's final message is in `resultPath`.
5. **Fallbacks are never silent.** Every skipped agent is recorded in `attempts` with a reason (CLI missing, `model_not_found`, plan/quota, timeout, non-zero exit). When any fallback happened, the result carries a human-readable `notice` (e.g. `codex:gpt-6-sol unavailable (model not supported on this account); used codex:gpt-6-luna`) and the skill must surface it to the user verbatim. This covers plan downgrades and model access changes. Defaults keep the preferred model (sol/astra) first so a regained entitlement takes effect without config edits.
6. Native-Claude fallback: if every external agent fails, runner exits with code 3 and the skill spawns an in-harness subagent.

## Setup (`/cross-agent:setup`)

Detect installed CLIs and auth, list models (`agy models`, etc.), propose role defaults, ask the user to adjust, write `.cross-agent.json`, add `.cross-agent.local.json` to `.gitignore`. Re-runnable to change config.

## Risks

- **Codex computer use headless** (`e2e-test` with `codex:astra`): unverified. First implementation task is a spike. If not possible, role falls back to `claude:sonnet` with the computer-use tool and the config says so.
- Model ids `sol` / `astra` are taken from the user; setup validates them against the CLI where it can.
- Auth probes vary per CLI; unknown means "assume healthy, fail at run time and fall back".

## Out of scope for v1

MCP transport, hook that rewrites the Agent tool, per-skill role overrides, parallel fan-out inside one role, cost tracking.
