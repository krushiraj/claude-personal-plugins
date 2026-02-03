---
description: Full guided production deployment workflow for Guru
allowed-tools: Read, Write, Edit, Bash, Grep, Glob, Task, AskUserQuestion
---

# Guru Production Deployment Workflow

Execute the complete production deployment workflow for Guru. This promotes staging to production.

Use the guru-deployment skill for deployment knowledge and reference tips from `${CLAUDE_PLUGIN_ROOT}/skills/guru-deployment/references/tips.md`.

**Branch Flow**: `release/staging/guru` → `release/production/guru`

## Workflow Phases

Execute these phases sequentially, stopping for user confirmation at each checkpoint.

### Phase 1: Review Changes

1. Ensure working directory is `js/guru`:
   ```bash
   cd /Users/krushi/work/paperpile/js/guru
   ```

2. Fetch latest and checkout production branch:
   ```bash
   git fetch origin
   git checkout release/production/guru
   ```

3. Generate diff between production and staging:
   ```bash
   git diff HEAD origin/release/staging/guru -- ./
   ```

4. Check for related changes in misc/shared/pp that may affect guru.

5. Create two output files in `~/Desktop/guru-release/` (create directory if needed):
   - `guru-release-notes.md` - Formatted release notes with Slack message
   - `guru-diff.txt` - Full diff for review

6. Use the release-notes-generator agent to extract ticket IDs and format the Slack message. Use "Production" as the environment label.

7. Display summary in chat AND show file locations.

**CHECKPOINT 1**: Wait for user to review. Ask: "Please review `~/Desktop/guru-release/guru-release-notes.md` and `~/Desktop/guru-release/guru-diff.txt`. This is PRODUCTION deployment. Ready to proceed?"

### Phase 2: Merge to Production Branch

**Note**: Production deployments do NOT create new version tags. The version was tagged during staging deployment.

1. Checkout production branch and rebase from staging:
   ```bash
   git checkout release/production/guru
   git rebase origin/release/staging/guru
   ```

2. Verify rebase applied cleanly. If conflicts, stop and alert user.

**CHECKPOINT 2**: Ask user to confirm before pushing: "Production branch ready to push. This will trigger production deployment. Confirm?"

3. Push production branch:
   ```bash
   git push
   ```

### Phase 3: Environment Verification

1. SSH to each production server and verify guru-env exists:
   - production-node-london-1
   - production-node-virginia-1
   - production-node-virginia-2
   - production-workers-virginia-1
   - production-workers-virginia-2

   Check: `ssh {server} "ls -la /mount/data/guru/guru-env"`

2. Report status of each server. Flag any missing env files.

**CHECKPOINT 3**: If any env files missing, alert user: "Environment files missing on: {servers}. Deployment WILL FAIL. Stop and fix?"

### Phase 4: Build Monitoring

1. Inform user that build should trigger automatically at:
   http://localhost:8090/job/Guru%20production/

2. This is PRODUCTION - monitor more carefully than staging.

3. If user reports build failure, discuss options carefully before retrying.

4. SSH to build server if needed: `ssh build`

### Phase 5: Smoke Test Verification

1. After deployment completes, run smoke tests:
   http://localhost:8090/job/Guru%20smoke%20tests/

2. Review test results carefully - this is production.

3. Report deployment completion status.

## Important Notes

- PRODUCTION deployment - extra caution required
- No version/tag creation - that happens during staging
- Always wait for user confirmation at checkpoints
- If issues occur, consider rollback procedures in tips.md
