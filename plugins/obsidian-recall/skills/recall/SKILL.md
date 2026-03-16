---
name: recall
description: Load context from Obsidian vault memory. Temporal queries (yesterday, last week, session history) use native JSONL timeline. Topic queries use QMD BM25 search. "recall graph" generates interactive temporal graph of sessions and files. Every recall ends with "One Thing" - the single highest-leverage next action synthesized from results. Use when user says "recall", "what did we work on", "load context about", "remember when we", "prime context", "yesterday", "what was I doing", "last week", "session history", "recall graph", "session graph".
---

# Recall Skill

This skill provides context recall from the Obsidian vault at:
`~/Library/Mobile Documents/iCloud~md~obsidian/Documents/ObsidianVault`

## QMD Collections

- **obsidian** - Full Obsidian vault (notes, Apple Notes sync, conversation summaries)
- **sessions** - Claude Code session extracts (if indexed)

## How It Works

- Temporal queries use native Claude Code JSONL files via `recall-day.py`
- Topic queries use QMD BM25 search (`qmd search`) for speed
- Graph queries use `session-graph.py` for interactive visualization
- Conversation summaries are auto-saved to `ObsidianVault/claude-conversation/` on session end

## Key Paths

- Scripts: `${CLAUDE_PLUGIN_ROOT}/scripts/`
- Vault: `~/Library/Mobile Documents/iCloud~md~obsidian/Documents/ObsidianVault/`
- Conversation notes: `~/Library/Mobile Documents/iCloud~md~obsidian/Documents/ObsidianVault/claude-conversation/`
