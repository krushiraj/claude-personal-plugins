---
description: Review changes and generate release notes for Guru deployment
argument-hint: [staging|production]
allowed-tools: Read, Write, Bash, Grep, Glob, Task
---

# Review Guru Changes

Generate diff and release notes for Guru deployment review.

**Environment**: $ARGUMENTS (defaults to staging if not specified)

Use the guru-deployment skill for deployment knowledge.

## Steps

1. Determine environment (staging or production):
   - If `$1` is "production": compare production branch to staging branch
   - Otherwise (staging): compare staging branch to sprint branch

2. Navigate to guru directory:
   ```bash
   cd /Users/krushi/work/paperpile/js/guru
   ```

3. Fetch latest:
   ```bash
   git fetch origin
   ```

4. Generate diff based on environment:

   **For staging**:
   ```bash
   git checkout release/staging/guru
   git diff HEAD origin/sprint -- ./
   ```

   **For production**:
   ```bash
   git checkout release/production/guru
   git diff HEAD origin/release/staging/guru -- ./
   ```

5. Check for related changes in `js/misc`, `js/shared`, `js/pp` that may affect guru. Use git log to correlate by date/PR since last release.

6. Use the release-notes-generator agent to:
   - Extract ticket IDs from commits and PRs
   - Format Slack-ready message
   - Get current version for the message

7. Create output files in `js/guru/`:
   - Write diff to `guru-diff.txt`
   - Write release notes to `guru-release-notes.md`

8. Display summary:
   - Number of files changed
   - List of ticket IDs found
   - Formatted Slack message
   - Location of output files

## Output Format

The `guru-release-notes.md` should contain:

```markdown
# Guru Release Notes

## Environment: {staging|production}

## Slack Message
```
Triggered build for Guru v{VERSION} {ENV}, this includes:
- [ID-XXXX] Description
- [ID-YYYY] Description
```

## Changes Summary
- X files changed
- Y insertions, Z deletions

## Ticket Details
[Details about each ticket if available from PRs]

## Cross-Repo Changes
[Any related changes in misc/shared/pp]
```

Inform user that files are ready for review and that they should run the version command next (for staging) or push command (for production) when ready.
