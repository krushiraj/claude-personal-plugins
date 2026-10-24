# cross-agent implementation plan

Design: `2026-10-24-cross-agent-design.md`. Dependency-free Node, tests with `node --test`.

## Tasks

1. **Spike: Codex computer use + each CLI smoke test.** Run a trivial read-only prompt through `codex exec`, `agy -p`, `opencode run`, `claude -p`; record exact working argv. Try `codex exec -m astra` with a computer-use prompt; record whether it works. Output: notes that fix the adapter JSONs and the `e2e-test` default.
2. **Scaffold.** `plugins/cross-agent/.claude-plugin/plugin.json`, add entry to `.claude-plugin/marketplace.json`, README.
3. **Config module** (`lib/config.js`) + `schema.json`. Load committed + local, merge, validate (roles, `adapter:model` specs, access, effort). Tests: valid, missing role fields, unknown adapter, local override.
4. **Adapter loader + argv builder** (`lib/adapters.js`, `adapters/*.json`). Placeholder substitution, read/write mode, `default` model omits flag. Tests per adapter against expected argv.
5. **Health check** (`lib/health.js`). PATH lookup, optional auth probe from adapter. Tests with fake binaries on a temp PATH.
6. **Runner** (`bin/xa-dispatch`, `lib/run.js`). Spawn, timeout, capture last message, fallback loop, result JSON, exit code 3 when all fail. Tests with fake CLIs (success, non-zero, timeout, rate-limit text).
7. **Worktree isolation** (`lib/worktree.js`). Create temp worktree+branch, run there, return diff path, cleanup command. Tests in a temp git repo.
8. **Skill** (`skills/cross-agent/SKILL.md`). Trigger on `.cross-agent.json`; role-matching rules; how to call `xa-dispatch`; how to handle exit 3 (spawn native subagent); how to review a worktree diff before merging.
9. **Commands.** `/cross-agent:setup` (detect, propose, write config, update `.gitignore`) and `/cross-agent:run <role> "<task>"`.
10. **End-to-end verification.** In a scratch repo, run setup, dispatch one role per installed CLI, force a fallback by breaking the first agent, confirm worktree diff flow.
11. **Review.** `plugin-dev:plugin-validator` and `skill-reviewer` agents; fix findings.

## Order and gates

Task 1 gates 4 and the `e2e-test` default; 3 and 2 can proceed in parallel with it. Do not commit or push without being asked.
