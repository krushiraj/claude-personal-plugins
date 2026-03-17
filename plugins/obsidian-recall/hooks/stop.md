---
name: session-sync
description: On session end, sync session metadata to Obsidian and add rich summary for meaningful conversations
hooks:
  - event: Stop
    type: prompt
---

# Session Sync Hook

Two-phase hook that runs on every session end.

## Phase 1: Always Sync Metadata

Run the sync script to create/update the session metadata file:

```bash
python3 ${CLAUDE_PLUGIN_ROOT}/scripts/claude-sessions sync --session-id ${CLAUDE_SESSION_ID} --quiet
```

This creates `claude-conversation/YYYY-MM-DD-<short-id>.md` with frontmatter (date, session_id, project, branch, messages, skills, artifacts) and user message excerpts.

If the script fails or CLAUDE_SESSION_ID is not available, continue to Phase 2 anyway.

## Phase 2: Quality-Gated Rich Summary

Review the entire conversation and decide if it contains knowledge worth preserving beyond the basic metadata.

### Quality Gate

Only enhance the session file if the conversation contains at least ONE of:
- A non-obvious technical insight, discovery, or debugging finding
- An architectural decision or design rationale
- A solution to a problem that took multiple steps to figure out
- A workflow, process, or configuration that was set up
- Important project context, decisions, or tradeoffs discussed
- Research findings or analysis results

Do NOT enhance for:
- Simple file edits or routine code changes
- Quick Q&A with obvious answers
- Conversations that were mostly tool output
- Incomplete conversations where nothing was resolved

### If Worth Enhancing

Find the session file created in Phase 1 at:
`~/Library/Mobile Documents/iCloud~md~obsidian/Documents/ObsidianVault/claude-conversation/`

The file matching the current session will be named `YYYY-MM-DD-<first 8 chars of session id>.md`.

Read the file, then **insert rich content sections** between the `## My Notes` section and the `## Conversation` section. Preserve all existing content (frontmatter, My Notes, Conversation). Also update the frontmatter `tags` field.

Add these sections (skip any that have nothing meaningful):

```markdown
## Summary
<2-3 sentence summary of what was accomplished>

## Key Insights
- <Insight 1: something non-obvious learned>
- <Insight 2: a useful finding or technique>

## Decisions Made
- <Decision and its rationale, if any>

## Technical Details
<Only include if there are specific commands, configurations, or code patterns worth remembering. Keep concise.>

## Next Steps
- <Any unfinished work or follow-ups identified>
```

### If NOT Worth Enhancing

Do nothing further — the metadata file from Phase 1 is sufficient.

## Rules

- Keep enhanced notes concise — aim for under 50 lines of added content
- Focus on the "why" and insights, not the "what" (the code diff tells the what)
- Use specific details, not vague summaries
- Tags should be 2-5 lowercase words that help with future search
- Update the `tags` field in frontmatter when adding rich content
- Skip sections that have nothing meaningful

## Indexing

After writing (whether Phase 1 only or Phase 1 + Phase 2), extract recent sessions and update QMD indexes if qmd is available:

```bash
# Extract recent sessions for QMD sessions collection
python3 ${CLAUDE_PLUGIN_ROOT}/scripts/extract-sessions.py --days 3 --source ~/.claude/projects --output "$HOME/Library/Mobile Documents/iCloud~md~obsidian/Documents/ObsidianVault/claude-sessions-qmd" 2>/dev/null || true

# Update both QMD collections
qmd update -c obsidian 2>/dev/null || true
qmd update -c sessions 2>/dev/null || true
```
