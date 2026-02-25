---
name: report
description: Generate period-based work report for 1:1 reviews and salary discussions
allowed-tools:
  - Read
  - Bash
  - Grep
  - Glob
argument-hint: "<period: weekly|monthly|yearly|YYYY-MM-DD:YYYY-MM-DD>"
---

# Work Report Generator

Generate a comprehensive work report for a given period. Designed for 1:1 review calls, performance reviews, and salary raise discussions.

## Instructions

### Step 1: Parse the period argument

Parse `$ARGUMENTS` to determine the date range:

- `weekly` or `week` → last 7 days
- `monthly` or `month` → last 30 days
- `yearly` or `year` → last 365 days
- `YYYY-MM-DD:YYYY-MM-DD` → custom date range (e.g., `2024-01-01:2024-06-30`)
- `last-sprint` → last 14 days
- `quarter` or `quarterly` → last 90 days

If no argument provided, default to `monthly`.

### Step 2: Read Notion settings

Read `~/.claude/notion-cards.local.md` to extract `notion_token`, `database_id`, and `owner_uuid`.

### Step 3: Gather data

**Git activity across all repos:**
```bash
bash ${CLAUDE_PLUGIN_ROOT}/scripts/git-activity.sh "SINCE_DATE" "UNTIL_DATE" "$HOME/work"
```

**Shell history for server/ops work:**
```bash
bash ${CLAUDE_PLUGIN_ROOT}/scripts/shell-history.sh "SINCE_DATE" "UNTIL_DATE"
```

**Notion cards (if available):**
Use the notion-cards plugin's `fetch-cards.sh` script. Look for it at `~/.claude/plugins/cache/personal-plugins/notion-cards/` in the `scripts/` directory.

### Step 4: Analyze and categorize

Group all work into these categories:
1. **Features delivered** - new functionality added
2. **Bug fixes** - issues resolved
3. **Infrastructure/DevOps** - server work, deployments, CI/CD
4. **Code reviews** - PRs reviewed or submitted
5. **Investigation/Research** - debugging, analysis, exploration
6. **Refactoring** - code quality improvements

### Step 5: Generate the report

**Format the output like this:**

---

# Work Report: [Period Description]
**Period:** [Start Date] to [End Date]
**Author:** [Git user name]

## Executive Summary
[2-3 sentence high-level summary of contributions and impact during this period]

## Key Achievements
1. [Most impactful contribution with context]
2. [Second most impactful]
3. [Third most impactful]
[Up to 5 items]

## Detailed Breakdown

### Features Delivered
| Card | Description | Repo | Status |
|------|-------------|------|--------|
| ID-XXXX | Brief description | repo-name | Completed/In Review |

### Bug Fixes & Issues Resolved
- [Bullet points of bugs fixed with context]

### Infrastructure & Operations
- [Server work, deployments, SSH sessions with context]

### Code Quality
- [Refactoring, reviews, improvements]

## Metrics
- **Total commits:** X across Y repositories
- **Files changed:** X files, +Y/-Z lines
- **Notion cards completed:** X
- **Repos contributed to:** [list]
- **Most active repo:** [repo name] (X commits)

## Impact Assessment
[Paragraph describing the broader impact of this work on the team and product. Connect individual tasks to team goals and sprint objectives. Highlight any multiplier effects like unblocking others, improving processes, or reducing technical debt.]

## Areas of Focus
[Pie-chart style breakdown in text form showing where time was spent]
- Feature development: ~X%
- Bug fixes: ~X%
- Infrastructure: ~X%
- Code review: ~X%
- Research/Investigation: ~X%

## Looking Forward
- [Based on in-progress cards and recent trajectory, what's likely coming next]
- [Any pending items that should be highlighted]

---

## Important Guidelines

- This report is for **pitching yourself** in 1:1s and salary discussions - frame everything positively
- Quantify impact where possible (e.g., "Fixed critical bug affecting user imports" not just "Fixed a bug")
- Connect work to business value and team goals
- Highlight cross-repo work as showing breadth of contribution
- SSH/server work demonstrates ops capability - frame it as taking ownership
- If data is sparse for a period, acknowledge it honestly but highlight quality over quantity
- For salary discussions, emphasize scope expansion, initiative, and reliability
