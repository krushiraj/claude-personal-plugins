---
name: list
description: List your Notion cards grouped by status
allowed-tools:
  - Read
  - Bash
  - Grep
---

# List Notion Cards

List the user's Notion cards grouped by status.

## Instructions

1. Read settings from `~/.claude/notion-cards.local.md` (user-level config):
   ```bash
   cat ~/.claude/notion-cards.local.md
   ```
   Extract: `notion_token`, `database_id`, `owner_uuid`

2. Fetch cards using Notion API:
   ```bash
   bash ${CLAUDE_PLUGIN_ROOT}/scripts/fetch-cards.sh "$token" "$database_id" "$owner_uuid"
   ```

3. Parse the JSON response and group cards by status

4. Display in this order:
   - In Progress
   - Code Review
   - Backlog
   - QA Dev
   - QA Staging
   - QA Production

5. For each card show: `- {ID}: {Title} [{Type}]`

6. Hide Done and Triage by default

7. Paginate: show 10 per section, offer "show more"

## Example Output

```
## In Progress (2)
- ID-1234: Implement user auth [Feature]
- ID-1235: Fix redirect bug [Bug]

## Code Review (1)
- ID-1230: Add password reset [Feature]

## Backlog (3)
- ID-1240: Update dashboard [Feature]
...

Would you like to see a specific status or start work on a card?
```
