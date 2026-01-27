---
name: Guru Deployment
description: This skill should be used when the user asks to "deploy guru", "release guru", "guru staging deployment", "guru production deployment", "promote guru to staging", "promote guru to production", "check guru deployment", or mentions guru release workflow, version tagging, or deployment verification. Provides comprehensive guidance for the Guru deployment pipeline.
version: 0.1.0
---

# Guru Deployment

Guided deployment workflow for Guru application from sprint branch through staging to production.

## Branch Flow

```
sprint → release/staging/guru → release/production/guru
```

All branches should remain identical after deployment. Changes flow one direction only.

## Deployment Phases

### Phase 1: Review Changes

Generate diff and release notes for review before any deployment action.

**For Staging** (from sprint to release/staging/guru):
```bash
cd /Users/krushi/work/paperpile/js/guru
git checkout release/staging/guru
git fetch origin
git diff HEAD origin/sprint -- ./
```

**For Production** (from staging to production):
```bash
cd /Users/krushi/work/paperpile/js/guru
git checkout release/production/guru
git fetch origin
git diff HEAD origin/release/staging/guru -- ./
```

**Cross-Repo Change Detection**: Check for related changes in misc, shared, and pp directories that may affect guru. Use git log correlation to identify potentially related commits.

### Phase 2: Generate Release Notes

Extract ticket IDs from commit messages and PR titles. Format for Slack:

```
Triggered build for Guru v{VERSION} {ENV}, this includes:
- [ID-XXXX] Description from commit/PR
- [ID-YYYY] Another change description
```

Use `gh pr list` and commit message parsing to gather ticket information.

### Phase 3: Version and Tag (Staging Only)

After user approval of release notes:

1. Switch to sprint branch and pull latest:
   ```bash
   git checkout sprint
   git pull
   ```

2. Check for race conditions - if new commits appeared, abort and restart

3. Run version script:
   ```bash
   cd /Users/krushi/work/paperpile/js/guru
   ./scripts/version.sh {VERSION}
   ```
   This creates a commit with version update and a git tag.

4. Push commit and tags:
   ```bash
   git push && git push --tags
   ```

### Phase 4: Merge to Release Branch

**For Staging**:
```bash
git checkout release/staging/guru
git rebase origin/sprint
git push
```

**For Production**:
```bash
git checkout release/production/guru
git rebase origin/release/staging/guru
git push
```

Verify the rebase applied cleanly with no conflicts.

### Phase 5: Environment Verification

SSH to servers and verify guru-env file exists in `/mount/data/guru`.

**Staging Servers** (SSH config aliases):
- stage-node-london-1
- stage-node-virginia-1
- stage-node-virginia-2
- stage-workers-virginia-1
- stage-workers-virginia-2 (mandatory - workers won't start without env vars)

**Production Servers** (replace `stage` with `production`):
- production-node-london-1
- production-node-virginia-1
- production-node-virginia-2
- production-workers-virginia-1
- production-workers-virginia-2

Check command:
```bash
ssh {server-alias} "ls -la /mount/data/guru/guru-env"
```

### Phase 6: Build Monitoring

Jenkins build should trigger automatically. Monitor at:
- http://localhost:8090/job/Guru%20staging/ (staging)
- http://localhost:8090/job/Guru%20production/ (production)

If build fails for trivial reasons (e.g., flaky test), use:
- http://localhost:8090/job/Deploy%20staging%20-%20js-guru/ (manual staging deploy)

SSH to build server:
```bash
ssh build
```

### Phase 7: Smoke Test Verification

After deployment completes, run smoke tests:
- http://localhost:8090/job/Guru%20smoke%20tests/

Some tests may fail intermittently. Consult `references/tips.md` for known flaky tests to ignore.

## Output Files

Create in `js/guru/` directory:
- `guru-release-notes.md` - Formatted release notes with Slack message
- `guru-diff.txt` - Full diff for user review

## Version Format

Read current version from `package.json` in js/guru directory:
```bash
cd /Users/krushi/work/paperpile/js/guru
grep '"version"' package.json
```

Suggest next patch version:
- Current: 1.3.15 → Suggested: 1.3.16
- Minor increments are rare, major very rare

Always ask user to confirm or specify the version number.

## Critical Checkpoints

**STOP and wait for user approval at these points:**
1. After generating release notes - user must review and approve
2. Before running version.sh - confirm version number
3. Before pushing tags - final confirmation
4. Before rebasing release branch - confirm diff looks correct

## Race Condition Handling

If someone commits to sprint during the process:
1. Delete the local version commit (if made)
2. Delete the tag (if created)
3. Start over from `git pull`

## Additional Resources

### Reference Files

- **`references/tips.md`** - Accumulated deployment tips, gotchas, and learned knowledge

### Environment Variables

Workers servers require mandatory env vars in guru-env. Deployment will fail if these are missing on worker nodes.
