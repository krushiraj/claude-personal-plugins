---
name: analytics
description: Self-retrospective analytics - identify strengths, slowdowns, and improvement areas
allowed-tools:
  - Read
  - Bash
  - Grep
  - Glob
argument-hint: "[period: weekly|monthly|quarterly|YYYY-MM-DD:YYYY-MM-DD]"
---

# Self-Retrospective Analytics

Analyze work patterns to identify strengths, slowdowns, and areas for improvement.

## Instructions

### Step 1: Parse period

Parse `$ARGUMENTS` for the analysis period:
- `weekly` → last 7 days
- `monthly` → last 30 days (default if no argument)
- `quarterly` → last 90 days
- `yearly` → last 365 days
- `YYYY-MM-DD:YYYY-MM-DD` → custom range

### Step 2: Gather data

**Git activity:**
```bash
bash ${CLAUDE_PLUGIN_ROOT}/scripts/git-activity.sh "SINCE_DATE" "UNTIL_DATE" "$HOME/work"
```

**Shell history:**
```bash
bash ${CLAUDE_PLUGIN_ROOT}/scripts/shell-history.sh "SINCE_DATE" "UNTIL_DATE"
```

**Also gather daily commit counts for pattern analysis:**
```bash
# For each repo in ~/work, get commits per day
cd <repo> && git log --author="<user>" --since="SINCE_DATE" --until="UNTIL_DATE" --format="%ad" --date=format:"%Y-%m-%d %A" --all | sort | uniq -c | sort -rn
```

**Notion cards** (if `~/.claude/notion-cards.local.md` exists):
Use the notion-cards plugin's `fetch-cards.sh` script.

### Step 3: Analyze patterns

Compute the following metrics:
1. **Daily commit distribution** - which days of the week are most/least productive
2. **Time-of-day patterns** - from git commit timestamps, when is peak activity
3. **Repo focus** - which repos get the most attention, any neglected areas
4. **Commit frequency** - gaps in activity (potential blockers or context-switching)
5. **Commit size patterns** - large vs small commits (refactoring vs incremental)
6. **Card velocity** - how long cards stay in each status (if Notion data available)
7. **Context switching** - how often jumping between repos/cards on same day

### Step 4: Generate analytics report

**Format:**

---

# Self-Retrospective Analytics
**Period:** [Start] to [End]

## Productivity Snapshot

| Metric | Value | Trend |
|--------|-------|-------|
| Total commits | X | |
| Active days | X / Y total days | |
| Avg commits/active day | X.X | |
| Repos touched | X | |
| Lines changed | +X / -Y | |

## Strengths (What You're Doing Well)

1. **[Strength]**: [Evidence from data]
   - Example: "Consistent daily commits showing disciplined work habits"
2. **[Strength]**: [Evidence]
3. **[Strength]**: [Evidence]

## Slowdowns (Where You're Getting Stuck)

1. **[Issue]**: [Evidence from data]
   - Impact: [How this affects productivity]
   - Suggestion: [Actionable fix]
2. **[Issue]**: [Evidence]
   - Impact: [...]
   - Suggestion: [...]

## Activity Patterns

### Day of Week Distribution
```
Mon: ████████░░ X commits
Tue: ██████████ X commits (peak)
Wed: ███████░░░ X commits
Thu: █████░░░░░ X commits
Fri: ██████░░░░ X commits
Sat: ░░░░░░░░░░ X commits
Sun: ░░░░░░░░░░ X commits
```

### Focus Distribution
```
repo-1:     ████████████ X% (X commits)
repo-2:     ██████░░░░░░ X% (X commits)
repo-3:     ███░░░░░░░░░ X% (X commits)
```

### Context Switching Score
- **X.X switches/day** (days with commits to multiple repos)
- [Interpretation: Low = focused, High = fragmented]

## Red Flags

- [Any concerning patterns: long gaps, declining frequency, too much context switching]
- [Repos that haven't been touched but might need attention]
- [Cards that have been "In Progress" for too long]

## Growth Opportunities

1. **[Skill/Area]**: [Why and how to improve]
   - Action: [Specific next step]
2. **[Skill/Area]**: [Why and how]
   - Action: [Specific next step]
3. **[Skill/Area]**: [Why and how]
   - Action: [Specific next step]

## Personal Improvement Plan

### This Week
- [ ] [Specific actionable item based on findings]
- [ ] [Another specific item]

### This Month
- [ ] [Longer-term improvement goal]
- [ ] [Another goal]

### Motivational Note
> [An honest, encouraging reflection on the data. Acknowledge what's going well, be direct about what needs work, and frame everything as growth opportunity. Be the kind of mentor you'd want.]

---

## Important Guidelines

- Be **honest and direct** - sugar-coating defeats the purpose of self-retrospective
- Back every observation with **data evidence** (commit counts, dates, patterns)
- Focus on **actionable** suggestions, not vague advice
- Compare against the user's own baseline, not external benchmarks
- If data shows a gap (e.g., no commits for 3 days), note it but consider it could be meetings, planning, or legitimate downtime
- Context switching between repos isn't always bad - it could indicate breadth
- The bar charts should use actual proportional lengths based on the data
- Frame slowdowns as growth opportunities, not failures
