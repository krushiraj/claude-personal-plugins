---
description: Create version commit and tag for Guru release
argument-hint: [version-number]
allowed-tools: Read, Bash, AskUserQuestion
---

# Create Guru Version and Tag

Create a new version commit and tag for Guru. Used during staging deployment.

Use the guru-deployment skill for deployment knowledge.

## Steps

1. Navigate to guru directory:
   ```bash
   cd /Users/krushi/work/paperpile/js/guru
   ```

2. Get current version from package.json:
   ```bash
   cat package.json | grep -o '"version": "[^"]*"' | grep -o '[0-9]\+\.[0-9]\+\.[0-9]\+'
   ```

3. Parse version and determine next version:
   - If `$1` provided, use that version
   - Otherwise, suggest next patch version (e.g., 1.3.15 → 1.3.16)

4. Ask user to confirm version number:
   - Show current version
   - Show suggested next version
   - Ask: "What version should this release be?"
   - Options: suggested patch, minor increment, or custom

5. Switch to sprint branch and pull latest:
   ```bash
   git checkout sprint
   git pull
   ```

6. **Race condition check**: Compare HEAD with what we saw during review.
   ```bash
   git log --oneline -3
   ```
   If new commits appeared since review phase, warn user:
   "New commits detected since review. Options: 1) Restart from review, 2) Continue anyway"

7. Run version script with confirmed version:
   ```bash
   ./scripts/version.sh {VERSION}
   ```

8. Verify the commit and tag were created:
   ```bash
   git log --oneline -1
   git tag -l "v{VERSION}"
   ```

9. Report status:
   - Version commit created
   - Tag created
   - **NOT pushed yet** - user must confirm before push

10. Inform user: "Version commit and tag ready. Run /guru-release:push to push, or use the staging workflow to continue."

## Important Notes

- Do NOT push automatically - wait for user confirmation
- If tag already exists, the script will fail - see tips.md for cleanup
- Version script creates both commit and tag atomically
- Minor/major version increments are rare - confirm with user if requested
