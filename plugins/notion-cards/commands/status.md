---
name: status
description: Show cards in a specific status (code-review, qa, backlog, etc.)
argument-hint: "<status>"
allowed-tools:
  - Read
  - Bash
  - Grep
---

# Check Card Status

Show cards in a specific workflow status.

## Arguments

- `status`: One of: `in-progress`, `code-review`, `backlog`, `qa-dev`, `qa-staging`, `qa-production`, `done`, `triage`

## Instructions

1. **Map argument to Notion status**:
   - `in-progress` → "In Progress"
   - `code-review` → "Code Review"
   - `backlog` → "Backlog"
   - `qa-dev` → "QA Dev"
   - `qa-staging` → "QA Staging"
   - `qa-production` → "QA Production"
   - `done` → "Done"
   - `triage` → "Triage"

2. **Read settings** from `.claude/notion-cards.local.md`

3. **Fetch cards** with status filter:
   ```bash
   bash ${CLAUDE_PLUGIN_ROOT}/scripts/fetch-cards.sh "$token" "$database_id" "$owner_uuid" "$status"
   ```

4. **Display results**:
   ```
   ## Code Review (3)

   - ID-1234: Implement user auth [Feature]
   - ID-1235: Fix redirect bug [Bug]
   - ID-1236: Update login page [Feature]

   Would you like to start work on any of these?
   ```

5. **If no argument**, show summary of all statuses with counts:
   ```
   ## Card Status Summary

   - In Progress: 2
   - Code Review: 3
   - Backlog: 5
   - QA Dev: 1

   Which status would you like to see in detail?
   ```

## Example Usage

- `/notion-cards:status code-review` - Show cards in code review
- `/notion-cards:status qa-dev` - Show cards in QA dev
- `/notion-cards:status` - Show summary of all statuses
