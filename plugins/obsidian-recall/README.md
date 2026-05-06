# obsidian-recall

Claude Code and Codex setup that syncs session transcripts to an Obsidian vault and recalls past work by date, topic, or graph. Claude uses the plugin Stop hook; Codex uses `~/.codex/hooks.json` plus `~/.codex/hooks/session-end-obsidian-sync.md`.

## Layout

```
obsidian-recall/
├── .claude-plugin/plugin.json   # manifest (name, version, description)
├── commands/
│   ├── recall.md                # /recall slash command (temporal | topic | graph)
│   └── sync-sessions.md         # /sync-sessions slash command (export/list/note/close)
├── hooks/
│   └── stop.md                  # Stop-event prompt hook: sync + quality-gated summary
├── skills/recall/SKILL.md       # auto-triggered skill for recall intents
└── scripts/
    ├── claude-sessions          # Claude CLI (sync/export/resume/note/close/log/list)
    ├── codex-sessions           # Codex CLI (sync/export from ~/.codex/sessions)
    ├── recall-day.py            # temporal recall from ~/.claude/projects JSONL
    ├── session-graph.py         # interactive pyvis graph of sessions × files
    └── extract-sessions.py      # dump user messages for QMD `sessions` collection
```

## Data flow

```
Claude Code session (~/.claude/projects/<slug>/<id>.jsonl)
        │
        │  Stop hook (hooks/stop.md)
        ▼
claude-sessions sync  ──►  ObsidianVault/claude-conversation/YYYY-MM-DD-<id8>.md
                                │
                                │  Phase 2 (if conversation is meaningful)
                                ▼
                           Summary / Insights / Decisions / Next Steps
                                │
                                ▼
                           extract-sessions.py  ──►  claude-sessions-qmd/
                                                          │
                                                          ▼
                                                     qmd update -c sessions

Codex session (~/.codex/sessions/YYYY/MM/DD/rollout-...<id>.jsonl)
        │
        │  Codex Stop/session_end hook
        ▼
codex-sessions sync ───►  ObsidianVault/claude-conversation/YYYY-MM-DD-codex-<unique-id-tail>.md
```

Recall then reads either the raw JSONL (temporal/graph) or the QMD indexes (topic).

## Hardcoded paths

All scripts assume this vault layout — edit `VAULT_DIR` in `scripts/claude-sessions` and the paths in `hooks/stop.md` if yours differs:

- Vault root: `~/Library/Mobile Documents/iCloud~md~obsidian/Documents/ObsidianVault`
- Session notes: `<vault>/claude-conversation/`
- QMD sessions source: `<vault>/claude-sessions-qmd/`
- Claude sessions source: `~/.claude/projects/`
- Codex sessions source: `~/.codex/sessions/`

## Components

### `scripts/claude-sessions` (CLI)

Primary interface. Subcommands:

| Command | Purpose |
|---|---|
| `sync [--session-id ID] [--transcript PATH]` | Create/update a session note from a JSONL transcript. Called by the Stop hook. Preserves `comments`, `projects`, `status`, `tags`, `rating`, `title` in frontmatter and the `## My Notes` section. |
| `export (--today \| --all \| FILE)` | Bulk-export sessions to the vault. |
| `resume (--pick \| --active \| FILE) [--fork]` | Resume a session via `claude --resume`; `--fork` starts a branch. |
| `note TEXT [--session-id ID]` | Append a timestamped note to the most recent active session. |
| `close [TEXT] [--session-id ID]` | Mark a session `status: done`. |
| `log TEXT [--status S] [--tags T] [--rating R]` | Update frontmatter fields on the active session. |
| `list [--active \| --all] [--json]` | List sessions. |

Add `--all-projects` to operate across every project in `~/.claude/projects` instead of only the current one.

### `scripts/codex-sessions` (CLI)

Primary Codex exporter. Subcommands:

| Command | Purpose |
|---|---|
| `sync [--session-id ID] [--transcript PATH] [--recent-minutes N]` | Create/update Codex session notes from recent Codex JSONL transcripts. Called by Codex hooks. |
| `export (--today \| --all)` | Bulk-export Codex sessions to the vault. |

Codex notes use `type: codex-session` and filenames like `YYYY-MM-DD-codex-<unique-id-tail>.md`. Codex UUIDs share a timestamp prefix, so the exporter uses the tail of the ID to avoid collisions. They live in the same `claude-conversation/` folder so Obsidian and QMD searches cover both agents.

### `scripts/recall-day.py`

Reads JSONL files directly (no dependency on the exported vault notes).

```
recall-day.py list DATE_EXPR [--project PATH] [--all-projects] [--min-msgs N]
recall-day.py expand SESSION_ID [--project PATH] [--all-projects] [--max-msgs N]
```

`DATE_EXPR`: `yesterday`, `today`, `2026-02-25`, `"last tuesday"`, `"this week"`, `"last week"`, `"3 days ago"`, `"last 3 days"`. Strips `<system-reminder>`, `<command-name>`, `<teammate-message>`, etc. before showing user messages.

### `scripts/session-graph.py`

Builds a NetworkX graph of sessions × files-touched for a date range, renders via pyvis to `/tmp/session-graph.html`, opens it. Requires `networkx` + `pyvis` (installed in `.venv` next to the plugin — `${CLAUDE_PLUGIN_ROOT}/.venv/bin/python3`).

```
session-graph.py DATE_EXPR [--min-msgs N] [--min-files N] [--day DAY] [--no-open]
```

Features: Obsidian-style theme, hover neighbor highlight, click-to-select, copy selected paths to clipboard.

### `scripts/extract-sessions.py`

Dumps user messages from recent sessions into markdown suitable for QMD BM25 indexing.

```
extract-sessions.py [--days 21] [--source ~/.claude/projects] [--output <dir>]
```

### `commands/recall.md` — `/recall`

Three modes, auto-classified from the argument:

- **Temporal** (`yesterday`, `last week`, a date) → `recall-day.py list` → `expand` on selection
- **Topic** (any keyword) → expand into 3–4 variants, run `qmd search` in parallel across `obsidian` and `sessions` collections, dedupe, fetch top 3 with `qmd get`
- **Graph** (`graph …`) → `session-graph.py`

Every invocation ends with a synthesized **One Thing** — the single highest-leverage next action based on momentum, blockers, or closest-to-done work.

### `commands/sync-sessions.md` — `/sync-sessions`

Thin wrapper around `claude-sessions`. Empty argument defaults to `export --today --all-projects`. Supports `export --today|--all`, `list [--all]`, `note "text"`, `close "text"`.

### `hooks/stop.md` — Stop event (prompt-type hook)

1. **Phase 1 — always:** `claude-sessions sync --session-id $CLAUDE_SESSION_ID --quiet` writes frontmatter (date, session_id, project, branch, messages, skills, artifacts) and user-message excerpts.
2. **Phase 2 — quality gate:** if the conversation has a non-obvious insight, an architectural decision, a multi-step debug, a workflow setup, or important project context, Claude inserts `## Summary`, `## Key Insights`, `## Decisions Made`, `## Technical Details`, `## Next Steps` between `## My Notes` and `## Conversation`, and updates `tags` in frontmatter. Otherwise no-op.
3. **Indexing:** runs `extract-sessions.py --days 3` then `qmd update -c obsidian -c sessions` (both best-effort with `|| true`).

### `skills/recall/SKILL.md`

Auto-trigger skill — fires when the user says things like "recall", "what did we work on", "load context about", "yesterday", "last week", "session history", "recall graph". Same behavior as `/recall`.

## External dependencies

- Python 3 (system) for `claude-sessions`, `recall-day.py`, `extract-sessions.py`
- `${CLAUDE_PLUGIN_ROOT}/.venv` with `networkx` + `pyvis` for `session-graph.py` (the `.venv` is not in git — recreate with `python3 -m venv .venv && .venv/bin/pip install networkx pyvis`)
- [`qmd`](https://github.com/…) CLI for topic search and indexing (optional; hook degrades gracefully)
- An Obsidian vault at the hardcoded iCloud path (edit `VAULT_DIR` if different)

## Recreating from scratch

1. Install the plugin into a marketplace-registered directory, e.g. `~/.claude-personal-plugins/plugins/obsidian-recall/`.
2. Ensure `plugin.json` matches the one in `.claude-plugin/`.
3. Create the `.venv` and install `networkx` + `pyvis` if you want graph mode.
4. Install `qmd` and create `obsidian` + (optionally) `sessions` collections pointing at the vault and `claude-sessions-qmd/` dir.
5. Edit `VAULT_DIR` in `scripts/claude-sessions` and the vault paths in `hooks/stop.md` if your Obsidian vault lives elsewhere.
6. Enable the plugin — the Claude Stop hook registers automatically via `hooks/stop.md`.
7. For Codex, register the hook in `~/.codex/hooks.json`:

```json
{
  "hooks": {
    "Stop": [
      {
        "matcher": "*",
        "hooks": [
          {
            "type": "command",
            "command": "python3 /Users/krushi/.claude-personal-plugins/plugins/obsidian-recall/scripts/codex-sessions --quiet --min-messages 1 sync --recent-minutes 240"
          }
        ]
      }
    ]
  }
}
```

Also keep `~/.codex/hooks/session-end-obsidian-sync.md` with `trigger: session_end` for Codex installations that use markdown hook triggers.

Once enabled, every session end writes a note; `/recall yesterday`, `/recall "authentication flow"`, and `/recall graph last week` exercise the three modes.
