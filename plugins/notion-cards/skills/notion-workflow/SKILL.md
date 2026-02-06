---
name: notion-workflow
description: This skill should be used when the user asks to "list my cards", "show my notion cards", "what's in code review", "start on ID-1234", "work on this card", pastes a Notion link, mentions a card ID like "ID-1234", or asks about card status. Provides Notion cards workflow for listing cards, starting work with branch/spec/PR, and tracking status.
---

# Notion Cards Workflow

Integrate Notion cards with git workflow - list cards by status, start work on a card (create branch, write spec, open draft PR), and track card status across workflow stages.

## Prerequisites

Read settings from `.claude/notion-cards.local.md` which contains YAML frontmatter:

```yaml
---
notion_token: secret_xxx
database_id: xxxxx
owner_uuid: xxxxx-xxxxx-xxxxx
owner_name: Name
---
```

Parse settings using:
```bash
grep -E "^(notion_token|database_id|owner_uuid|owner_name):" .claude/notion-cards.local.md | sed 's/: /=/'
```

## Card ID Format

Card IDs follow the pattern `ID-1234` (uppercase prefix, hyphen, number). When extracting from Notion links or user input:
- Notion link: `https://notion.so/...` → fetch page, extract ID property
- Direct ID: `ID-1234`, `id-1234` → normalize to uppercase for display, lowercase for branches

## Status Order (Default Display)

Show cards grouped by status in this order:
1. **In Progress** - Currently being worked on
2. **Code Review** - Ready for review
3. **Backlog** - Queued for work
4. **QA Dev** - In QA on dev environment
5. **QA Staging** - In QA on staging
6. **QA Production** - Final QA check

**Hidden by default** (show only when user asks):
- Done
- Triage

Paginate results (show 10 cards per section, offer to show more).

## Core Workflows

### 1. List Cards

When user asks to see their cards:

1. Read settings from `.claude/notion-cards.local.md`
2. Fetch cards using Notion API:
   ```bash
   bash ${CLAUDE_PLUGIN_ROOT}/scripts/fetch-cards.sh "$token" "$database_id" "$owner_uuid"
   ```
3. Parse response and group by status
4. Display in status order with card ID, title, and type
5. Offer filtering: "Would you like to see a specific status?"

**Example output:**
```
## In Progress (2)
- ID-1234: Implement user authentication [Feature]
- ID-1235: Fix login redirect bug [Bug]

## Code Review (1)
- ID-1230: Add password reset flow [Feature]
```

### 2. Start Work on Card

When user provides a card ID or Notion link:

1. **Extract card ID** from input (ID-1234 or Notion URL)
2. **Read settings** from `.claude/notion-cards.local.md`
3. **Fetch card details** from Notion API
4. **Generate branch name**: `{owner_name_lowercase}/{id_lowercase}-{2-5-word-description}`
   - Auto-generate description from card title
   - **Ask user to confirm** before creating branch
5. **Create branch** after confirmation
6. **Write spec file** to `~/Desktop/guru-release/{ID}/spec.md`
7. **Create draft PR** with title `[{ID}] {Card Title}`

**Branch naming rules:**
- All lowercase
- Owner name from settings (lowercase)
- Card ID lowercase (e.g., `id-1234`)
- 2-5 words from title, hyphen-separated
- Example: `krushi/id-1234-implement-user-auth`

**Spec file format** (`~/Desktop/guru-release/{ID}/spec.md`):
```bash
mkdir -p ~/Desktop/guru-release/{ID}
```
```markdown
# {ID}: {Title}

**Status**: {Status}
**Type**: {Type}

## Description

{Card description/content from Notion}
```

**Draft PR creation:**
```bash
git checkout -b "{branch_name}"
mkdir -p ~/Desktop/guru-release/{ID}
# Write spec file to ~/Desktop/guru-release/{ID}/spec.md
git push -u origin {branch_name}
gh pr create --draft --title "[{ID}] {Title}" --body "## Spec\n\nSee: ~/Desktop/guru-release/{ID}/spec.md"
```

### 3. Check Card Status

When user asks "what's in code review?" or similar:

1. Read settings
2. Fetch cards filtered by requested status
3. Display matching cards with ID, title, type
4. Offer to start work on any of them

## Notion API Integration

### Fetch Cards by Owner

```bash
curl -s -X POST "https://api.notion.com/v1/databases/${DATABASE_ID}/query" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Notion-Version: 2022-06-28" \
  -H "Content-Type: application/json" \
  -d '{
    "filter": {
      "and": [
        {"property": "Owner", "people": {"contains": "'${OWNER_UUID}'"}},
        {"property": "Status", "status": {"does_not_equal": "Done"}}
      ]
    }
  }'
```

### Extract Card Properties

From API response, extract:
- **ID**: `properties.ID.unique_id.prefix` + `-` + `properties.ID.unique_id.number`
- **Title**: `properties.Name.title[0].plain_text`
- **Status**: `properties.Status.status.name`
- **Type**: `properties.Type.select.name`
- **Page ID**: `id` (for fetching content)

### Fetch Card Content

To get card description/content for spec:
```bash
curl -s "https://api.notion.com/v1/blocks/${PAGE_ID}/children" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Notion-Version: 2022-06-28"
```

Parse blocks to extract text content (paragraph, heading, bulleted_list, etc.).

## Integration with Brainstorming

The generated `specs/{ID}-spec.md` file is designed to work with the brainstorming skill:
- Contains card requirements and context
- Can be referenced when planning implementation
- Provides clear scope for the feature/bug

After creating the spec, suggest: "Spec created. Would you like to brainstorm the implementation approach?"

## Trigger Patterns

**List cards:**
- "show my cards"
- "list my notion cards"
- "what am I working on?"
- "my cards"

**Status queries:**
- "what's in code review?"
- "show QA cards"
- "anything in backlog?"
- "cards in progress"

**Start work:**
- "start on ID-1234"
- "work on ID-1234"
- Pasting a Notion link
- "pick up ID-1234"

## Error Handling

- **Missing settings**: Prompt user to create `.claude/notion-cards.local.md`
- **Invalid card ID**: Show error and list available cards
- **API errors**: Show error message, suggest checking token permissions
- **Branch exists**: Ask to checkout existing or create new branch name

## Scripts Reference

- **`scripts/fetch-cards.sh`**: Fetch cards from Notion (with optional status filter)
- **`scripts/fetch-card-content.sh`**: Fetch single card content for spec

## Quick Reference

| Action | Command/Trigger |
|--------|-----------------|
| List all cards | "show my cards" |
| Filter by status | "what's in code review?" |
| Start work | "start on ID-1234" |
| Show hidden | "show done cards", "show triage" |
