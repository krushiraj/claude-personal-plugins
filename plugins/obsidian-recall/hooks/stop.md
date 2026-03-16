---
name: session-summary
description: On session end, summarize the conversation and save key insights to Obsidian vault
hooks:
  - event: Stop
    type: prompt
---

# Session Summary Hook

Before ending, review the entire conversation and decide if it contains knowledge worth preserving. Skip trivial conversations (simple questions, quick lookups, greetings).

## Quality Gate

Only save a note if the conversation contains at least ONE of:
- A non-obvious technical insight, discovery, or debugging finding
- An architectural decision or design rationale
- A solution to a problem that took multiple steps to figure out
- A workflow, process, or configuration that was set up
- Important project context, decisions, or tradeoffs discussed
- Research findings or analysis results

Do NOT save notes for:
- Simple file edits or routine code changes
- Quick Q&A with obvious answers
- Conversations that were mostly tool output
- Incomplete conversations where nothing was resolved

## If Worth Saving

Create a markdown file at:
`~/Library/Mobile Documents/com~apple~CloudDocs/ObsidianVault/claude-conversation/YYYY-MM-DD-short-title.md`

Use this structure:

```markdown
---
date: YYYY-MM-DD
project: <project name from working directory>
tags: [relevant, topic, tags]
type: conversation-summary
---

# <Descriptive Title>

## Summary
<2-3 sentence summary of what was accomplished>

## Key Insights
- <Insight 1: something non-obvious learned>
- <Insight 2: a useful finding or technique>

## Decisions Made
- <Decision and its rationale, if any>

## Technical Details
<Only include if there are specific commands, configurations, or code patterns worth remembering. Keep it concise - just the essential reference material, not full code blocks.>

## Next Steps
- <Any unfinished work or follow-ups identified>
```

Rules:
- Keep notes concise - aim for under 50 lines total
- Focus on the "why" and insights, not the "what" (the code diff tells the what)
- Use specific details, not vague summaries
- Tags should be 2-5 lowercase words that help with future search
- Title should be specific enough to find later (e.g. "Setting up Apple Notes to Obsidian sync" not "Note sync work")
- Skip sections that have nothing meaningful (e.g. no "Decisions Made" if none were made)

## Indexing

After writing the note, update the QMD index:
```bash
node ~/.bun/install/global/node_modules/@tobilu/qmd/dist/cli/qmd.js update -c obsidian
```
