# Task 1 spike results (2026-10-24)

Versions: codex-cli 0.162.1, agy 1.4.7, opencode (installed), claude (`~/.local/bin/claude`, a shell function wraps it in zsh, so the runner must resolve the binary via PATH, not the function).

## Verified headless invocations (prompt = "reply PONG", all returned PONG)

| Adapter | Argv | Latency |
|---|---|---|
| claude | `claude -p --permission-mode plan "<prompt>"` | ~7s |
| opencode | `opencode run "<prompt>"` (default model `big-pickle`) | ~4s |
| agy | `agy --mode plan --model gemini-3.8-flash-high -p "<prompt>"` | ~19s |
| codex | `codex exec -s read-only -C <dir> -m gpt-6-luna "<prompt>"` | ~15s |

## Gotchas that change the design

1. **`agy -p` consumes the next token as its prompt.** Flags must come before `-p`, and the prompt must be the token right after it. Adapter template ordering: `[...flags, "-p", "{prompt}"]`.
2. **No `timeout` binary on macOS.** The runner enforces timeouts itself (spawn + kill timer).
3. **Codex model availability is per account.** `~/.codex/config.toml` default is `gpt-6-astra`, but this ChatGPT account rejects `gpt-6-astra`, `gpt-6-sol`, `gpt-5.6-sol` with `model_not_found` (HTTP 400, exit 1). Accepted: `gpt-6-luna`, `gpt-5.6-terra`. So a configured model can be valid in config yet fail at run time; fallback must trigger on non-zero exit, and setup must probe each configured model with a cheap prompt instead of trusting names.
4. **Codex last message:** `-o <file>` writes only on success; on failure stdout/stderr carry the error JSON. Runner should capture both.
5. **Shell function `claude`** in zsh rewrites `--yolo`; irrelevant to the runner as long as it spawns the real binary.

## Computer use (e2e-test role)

Headless `codex exec` exposes `mcp__cua_repl.js` and `mcp__cua_repl.js_reset` (computer-use REPL, backed by `~/.codex/computer-use/Codex Computer Use.app`). So the tool is present in non-interactive runs. NOT yet verified: an actual click/screenshot run (it takes over the screen and needs macOS Accessibility/Screen Recording grants). Do this as a supervised check in Task 10.

## Decisions pending

- Default `codex:sol` / `codex:astra` entries fail on this account today. Setup will probe and propose accessible alternatives (`gpt-6-luna`, `gpt-5.6-terra`) while still allowing the user's preferred names to be kept at the head of the fallback list.
