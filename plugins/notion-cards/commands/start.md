---
name: start
description: Start work on a Notion card - brainstorm, investigate, implement, then (only on explicit user approval) commit, push, and open a draft PR
argument-hint: "<card-id or notion-link>"
allowed-tools:
  - Read
  - Write
  - Bash
  - Grep
  - AskUserQuestion
---

# Start Work on Card

Start work on a Notion card. The order is fixed: **brainstorm → investigate → implement → verify → ASK before commit → ASK before push → ASK before draft PR**.

## Fixed workflow order and hard rules

1. Parse input and fetch card from Notion.
2. Confirm branch name with the user.
3. Create branch locally.
4. Write spec file locally.
5. **Brainstorm** the approach (use `superpowers:brainstorming`).
6. **Investigate** the code as directed by the brainstorm and any user follow-ups.
7. **Implement** the change (code + tests). Run tests locally (`yarn test:one <path>` in guru).
8. Show a diff/summary and **ask** before committing.
9. After the user says yes: commit.
10. **Ask** before pushing.
11. After the user says yes: push.
12. **Ask** before opening a draft PR.
13. After the user says yes: open the draft PR.

**Hard rules:**

- **Never auto-commit, auto-push, or auto-open a PR.** A blanket "proceed" / "go ahead" / "implement it" on a design authorizes code edits and local test runs only. Commits, pushes, and PR creation each need their own explicit yes.
- **Never fabricate an empty or placeholder commit** (e.g. `chore: init`, `wip`, blank commit) just to have something to push so you can open a draft PR. If there's no real diff, do not commit. If the user wants a draft PR with no code, they'll say so.
- If the user explicitly asks to stop earlier ("just create the branch", "don't push yet"), stop at that step and skip the rest.

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

10. **Implement the change** — write the code, add/update tests, run them locally (`yarn test:one <path>` in guru). Do not proceed until tests pass.

11. **Pause and ask before committing.** Show the diff or a tight summary of what changed. Example: "Ready to commit — here's the proposed message: `<message>`. Want me to commit, or would you like to tweak it first?" Do not commit until the user confirms.

12. **Pause and ask before pushing.** Example: "Commit is in. Want me to push `{branch_name}`?" Do not push until the user confirms. Never use `--force` or `--force-with-lease` without an explicit request.

13. **Pause and ask before opening the draft PR.** Example: "Pushed. Want me to open the draft PR now?" Do not open the PR until the user confirms.

14. **Draft PR body** (when authorized to create it) — the spec file lives locally only, so don't reference it in the PR:
    ```bash
    gh pr create --draft --title "[{ID}] {Title}" --body "## Summary

    {1–3 bullets on what changed and why}

    ## Card

    {notion_link}

    ## Test plan

    - [x] {test commands that were run}
    - [ ] {any follow-up verification}"
    ```

15. **Confirm completion** after each approved step, not at the end of the whole workflow — the user is driving.

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
