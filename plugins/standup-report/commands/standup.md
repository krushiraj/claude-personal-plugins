---
name: standup
description: Generate daily standup answers for Geekbot's 3 questions
allowed-tools:
  - Read
  - Bash
  - Grep
  - Glob
argument-hint: "[since-date]"
---

# Daily Standup Report

Generate answers for Geekbot's 3 daily standup questions. Gather data from git activity, Notion cards, and shell history.

## Instructions

### Step 1: Determine the date range

If the user provided a since-date argument (`$ARGUMENTS`), use that as the start date.
Otherwise, calculate the last workday:
- If today is Monday, use last Friday's date
- Otherwise, use yesterday's date

Format dates as YYYY-MM-DD. Today is the until-date.

### Step 2: Read Notion settings

Read `~/.claude/notion-cards.local.md` to extract `notion_token`, `database_id`, and `owner_uuid` from the YAML frontmatter.

If the file doesn't exist, skip Notion data and note it in the output.

### Step 3: Gather all data sources (run in parallel where possible)

**Git activity:**
```bash
bash ${CLAUDE_PLUGIN_ROOT}/scripts/git-activity.sh "SINCE_DATE" "UNTIL_DATE" "$HOME/work"
```

**Shell history:**
```bash
bash ${CLAUDE_PLUGIN_ROOT}/scripts/shell-history.sh "SINCE_DATE" "UNTIL_DATE"
```

**Notion cards (if settings available):**

Fetch current cards using the notion-cards plugin's fetch script. Look for the notion-cards plugin at `~/.claude/plugins/cache/personal-plugins/notion-cards/` to find `scripts/fetch-cards.sh`. Run:
```bash
bash <path-to-notion-cards>/scripts/fetch-cards.sh "$token" "$database_id" "$owner_uuid"
```

Parse the JSON to identify:
- Cards currently "In Progress" (what you're working on today)
- Cards in "Code Review" (things completed, waiting for review)
- Cards recently moved to "Done" or "QA" statuses (completed work)

**Claude Code conversation history (for additional context):**

Scan recent Claude Code conversation logs in `~/.claude/projects/` for work-related directories (those containing `-work-` in the path). The logs are `.jsonl` files. Look for conversations modified within the date range:
```bash
find ~/.claude/projects/ -name "*.jsonl" -path "*-work-*" -newer /tmp/since_marker 2>/dev/null
```
Create the marker file first: `touch -t YYYYMMDDHHMM /tmp/since_marker`

For each recent conversation log, use Grep to search for patterns like:
- SSH connections (`ssh `)
- Server names or IPs
- Deployment commands
- Database operations
- Key work activities discussed

This provides context about what the user was working on via Claude Code sessions - e.g., "Used Claude Code to debug crawler issues" or "Worked with Claude Code on deployment to staging".

### Step 4: Synthesize and format output

Using all gathered data, produce answers for these 3 Geekbot questions:

---

**Format the output exactly like this:**

## Daily Standup - [Today's Date]

### What did you do since [Since Date] to help the team finish the sprint?
- [Bullet points summarizing completed work from git commits, grouped by theme/feature]
- [Include any SSH/server work with context like "Investigated production issue on server X"]
- [Reference Notion card IDs where applicable, e.g., "ID-1234: Implemented captcha detection"]
- [Keep each bullet concise but informative - suitable for pasting into Geekbot]

### What will you do today to help the team finish the sprint?
- [Based on "In Progress" Notion cards and current branch work]
- [Infer from recent git activity what's likely being continued]
- [If there are Code Review cards, mention "Follow up on code review for ID-XXXX"]

### Is there any obstacle blocking you or the team from achieving the sprint goal?
- [If no obvious blockers found, say "No blockers at the moment"]
- [If there are stale branches or cards stuck in one status, mention them as potential concerns]

---

### Personal Note
> [A brief motivational suggestion for improving productivity or skills based on the activity patterns observed. Keep it encouraging and specific.]

---

## Important Guidelines

- Keep bullet points concise - these go into Geekbot, not a novel
- Group related commits into single bullet points (don't list every commit separately)
- Use Notion card IDs when referencing card work (e.g., "ID-2053: Added captcha detection")
- For SSH sessions, provide context about what was likely being done (e.g., "Debugged crawler issues on staging server")
- The "What will you do today" section should be realistic based on current in-progress work
- The personal note should be actionable and specific to what was observed
