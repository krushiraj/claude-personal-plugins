---
name: start
description: Start work on a Notion card - creates branch, spec file, and draft PR
argument-hint: "<card-id or notion-link>"
allowed-tools:
  - Read
  - Write
  - Bash
  - Grep
  - AskUserQuestion
---

# Start Work on Card

Start work on a Notion card by creating a branch, writing a spec file, and opening a draft PR.

## Arguments

- `card-id`: Card ID like `ID-1234` or a Notion page URL

## Instructions

1. **Parse input** to extract card ID:
   - If Notion URL: fetch page to get ID property
   - If card ID (e.g., `ID-1234`): use directly

2. **Read settings** from `~/.claude/notion-cards.local.md` (user-level config)

3. **Fetch card details** from Notion API:
   ```bash
   bash ${CLAUDE_PLUGIN_ROOT}/scripts/fetch-card-content.sh "$token" "$page_id"
   ```

   The script recursively fetches all nested blocks. For linked pages/databases, it shows placeholders like `[📄 Linked Page: Title]` instead of fetching their content.

4. **Generate branch name**:
   - Pattern: `{owner_name_lowercase}/{id_lowercase}-{2-5-word-description}`
   - Auto-generate description from card title (key words, hyphenated)
   - Example: `krushi/id-1234-implement-user-auth`

5. **Ask user to confirm branch name**:
   ```
   I'll create branch: krushi/id-1234-implement-user-auth

   Is this branch name OK? (yes/suggest alternative)
   ```

6. **After confirmation**, create branch:
   ```bash
   git checkout -b "{branch_name}"
   ```

7. **Create spec file** at `specs/{ID}-spec.md` (DO NOT COMMIT):
   ```markdown
   # {ID}: {Title}

   **Status**: {Status}
   **Type**: {Type}

   ## Description

   {Content from Notion card}
   ```

   **IMPORTANT**: Never add spec files to git. They are for local reference only.

8. **Push branch**:
   ```bash
   git push -u origin {branch_name}
   ```

9. **Create draft PR**:
   ```bash
   gh pr create --draft --title "[{ID}] {Title}" --body "## Spec

   See: specs/{ID}-spec.md

   ## Card

   {notion_link}"
   ```

10. **Confirm completion**:
    ```
    ✓ Branch created: krushi/id-1234-implement-user-auth
    ✓ Spec written: specs/ID-1234-spec.md (local only, not committed)
    ✓ Draft PR opened: [ID-1234] Implement User Authentication

    Would you like to brainstorm the implementation approach?
    ```

## Branch Naming Rules

- All lowercase
- Format: `{owner}/{id}-{description}`
- Description: 2-5 words from title, most relevant keywords
- No special characters except hyphens (and slash after owner)

## Error Handling

- Missing settings: Prompt to create `.claude/notion-cards.local.md`
- Invalid card ID: Show error, list available cards
- Branch exists: Ask to checkout existing or suggest new name
- API error: Show message, check token permissions
