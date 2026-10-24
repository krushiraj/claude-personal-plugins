# cross-agent

Route work from Claude Code to other coding agents by **role**, configured per repo.

- `plan` -> Claude Opus, `code` -> Sonnet, `design-review` -> Codex, `e2e-test` -> Codex (computer use), `visual-review` -> Antigravity (`agy`), `quick` -> opencode, ... whatever you configure.
- Each role has an ordered list of agents. If one is missing, not logged in, rate limited, or the model is not on your plan, the next one runs and **you are told** which fallback happened and why.
- Write roles run in a git worktree; you get a patch to review, never silent edits to your tree.

## Use

1. `/cross-agent:setup` detects installed CLIs, probes models, and writes `.cross-agent.json`.
2. With the config present, the `cross-agent` skill routes delegated work through `bin/xa-dispatch`. Or call it directly: `/cross-agent:run <role> "<task>"`.

## Config

`.cross-agent.json` (commit it) and `.cross-agent.local.json` (gitignore it; per-role overrides for this machine).

```json
{
  "version": 1,
  "roles": {
    "plan":          { "description": "Implementation planning", "access": "read",  "agents": ["claude:opus", "codex:gpt-6-sol"] },
    "code":          { "description": "Write code", "access": "write", "isolate": "worktree", "agents": ["claude:sonnet", "opencode:default"] },
    "design-review": { "description": "Review design and diffs", "access": "read", "agents": ["codex:gpt-6-sol", "codex:gpt-6-luna", "claude:opus"] },
    "e2e-test":      { "description": "E2E via computer use", "access": "write", "agents": ["codex:gpt-6-astra", "claude:sonnet"] },
    "visual-review": { "description": "Review visual output", "access": "read", "agents": ["agy:gemini-3.8-flash-high", "claude:opus"] },
    "quick":         { "description": "Small low-effort tasks", "access": "write", "isolate": "worktree", "effort": "low", "agents": ["opencode:default", "claude:haiku"] }
  }
}
```

Agent = `adapter:model` (`adapter:default` uses the CLI default). Adapters: `claude`, `codex`, `agy`, `opencode`; each is a JSON template in `adapters/`.

## CLI

```
bin/xa-dispatch <role> --prompt-file <f> [--cwd d] [--timeout sec]
bin/xa-dispatch --list
bin/xa-dispatch --probe <adapter:model>
```

Prints one JSON result. Exit 0 ok, 2 config/usage error, 3 every agent failed (the skill then uses a native Claude subagent).

## Known limits

- opencode has no enforced read-only mode; the runner detects and warns if a read role changed files.
- Worktrees branch from `HEAD`, so uncommitted changes are not visible to the agent.
- Tests: `yarn test` (Node >= 18, no dependencies).
