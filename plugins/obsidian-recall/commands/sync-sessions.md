---
name: sync-sessions
description: Sync Claude sessions to Obsidian. Export, list, annotate, close sessions. Use when user says "sync sessions", "export sessions", "list sessions", "close session".
argument-hint: [export --today|export --all|list|note "text"|close "text"]
allowed-tools: Bash(python3:*)
---

# Sync Sessions Command

Manage Claude Code session files in Obsidian vault.

## Parse Arguments

Parse what comes after `/sync-sessions`:

| Input | Action |
|-------|--------|
| (empty) | Export today's sessions across all projects |
| `export --today` | Export today's sessions |
| `export --all` | Export all sessions |
| `list` | List active sessions |
| `list --all` | List all sessions |
| `note "text"` | Add timestamped note to most recent active session |
| `close "text"` | Mark most recent active session as done |

## Execute

Run the appropriate command:

```bash
python3 ${CLAUDE_PLUGIN_ROOT}/scripts/claude-sessions PARSED_COMMAND --all-projects
```

For no arguments, default to:
```bash
python3 ${CLAUDE_PLUGIN_ROOT}/scripts/claude-sessions export --today --all-projects
```

## Present Results

After running, summarize what was synced/listed. If exporting, mention the output directory:
`~/Library/Mobile Documents/iCloud~md~obsidian/Documents/ObsidianVault/claude-conversation/`
