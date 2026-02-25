---
name: standup-workflow
description: This skill should be used when the user asks for "standup update", "daily standup", "geekbot answers", "what did I do", "standup report", "my work summary", "work report", "period report", "1:1 report", "performance report", "salary review report", "self retrospective", "work analytics", "productivity analysis", "where am I slowing down", "how am I performing", or mentions standup/geekbot/work-report in any context.
---

# Standup & Work Reporting Workflow

Guide the user to the appropriate standup-report plugin command based on their request.

## Command Routing

### Daily Standup
When the user wants daily standup updates or geekbot answers, use:
```
/standup [optional-since-date]
```

### Period Reports
When the user wants a report for 1:1s, performance reviews, or salary discussions, use:
```
/report <period>
```
Supported periods: weekly, monthly, quarterly, yearly, last-sprint, or custom YYYY-MM-DD:YYYY-MM-DD

### Self-Retrospective Analytics
When the user wants to analyze their productivity patterns or identify improvement areas, use:
```
/analytics [period]
```

## Data Sources

The plugin gathers data from three sources:
1. **Git activity** across all repos in `~/work/` - commits, branches, file changes
2. **Notion cards** - assigned cards, statuses, card IDs (uses settings from `~/.claude/notion-cards.local.md`)
3. **Shell history** - SSH sessions, server interactions, deployment commands

## Setup Requirements

- Git repos in `~/work/`
- Notion integration configured in `~/.claude/notion-cards.local.md` (optional but recommended)
- Zsh with timestamped history enabled (EXTENDED_HISTORY)

## Tips

- Run `/standup` first thing in the morning to get your geekbot answers ready
- Use `/report monthly` before 1:1 calls to have your talking points prepared
- Run `/analytics quarterly` for self-retrospective before performance reviews
- Custom date ranges work great for sprint retrospectives: `/report 2024-02-01:2024-02-14`
