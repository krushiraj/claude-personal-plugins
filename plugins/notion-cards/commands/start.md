---
name: start
description: Start work on a Notion card - brainstorm, implement, then push and open draft PR
argument-hint: "<card-id or notion-link>"
allowed-tools:
  - Read
  - Write
  - Bash
  - Grep
  - AskUserQuestion
---

# Start Work on Card

Start work on a Notion card. The order is fixed: **brainstorm → investigate → implement → push → open draft PR**. Do not push or open the PR before the implementation is ready.

## Arguments

- `card-id`: Card ID like `ID-1234` or a Notion page URL

## Fixed workflow order

1. Parse input and fetch card from Notion
2. Confirm branch name with the user
3. Create branch locally
4. Write spec file locally
5. **Brainstorm** the approach (use `superpowers:brainstorming`)
6. **Investigate** the code as needed
7. **Implement** the change (code + tests)
8. Verify tests pass locally
9. **Only then**: push the branch and open a draft PR

Never push or open the PR before step 8. If the user explicitly asks to stop earlier (e.g. "just create the branch"), stop at that step and skip the rest.

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

7. **Create spec file** at `~/Desktop/guru-release/{ID}/spec.md`:
   ```bash
   mkdir -p ~/Desktop/guru-release/{ID}
   ```
   ```markdown
   # {ID}: {Title}

   **Status**: {Status}
   **Type**: {Type}

   ## Description

   {Content from Notion card}
   ```

8. **Brainstorm the approach** — invoke `superpowers:brainstorming` with a concise summary of the card. Surface the root-cause analysis, propose 2–3 fix options with trade-offs, lead with the recommendation, and get user agreement before coding.

9. **Investigate the codebase** as directed by the brainstorm — read the relevant files, verify assumptions the user flags (e.g. "do we actually do X anywhere?"), and report back with evidence before implementing.

10. **Implement the change** — write the code, add/update tests, and run them locally (`yarn test:one <path>` in guru). Do not proceed until tests pass.

11. **Push the branch** — only after steps 8–10 are complete:
    ```bash
    git push -u origin {branch_name}
    ```

12. **Create draft PR** — only after pushing:
    ```bash
    gh pr create --draft --title "[{ID}] {Title}" --body "## Summary

    {1–3 bullets on what changed and why}

    ## Spec

    See: ~/Desktop/guru-release/{ID}/spec.md

    ## Card

    {notion_link}

    ## Test plan

    - [x] {test commands that were run}
    - [ ] {any follow-up verification}"
    ```

13. **Confirm completion**:
    ```
    ✓ Branch created: krushi/id-1234-implement-user-auth
    ✓ Spec written: ~/Desktop/guru-release/ID-1234/spec.md
    ✓ Implementation done and tests passing
    ✓ Draft PR opened: [ID-1234] Implement User Authentication
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
