---
description: Full guided staging deployment workflow for Guru
allowed-tools: Read, Write, Edit, Bash, Grep, Glob, Task, AskUserQuestion
---

# Guru Staging Deployment Workflow

Execute the complete staging deployment workflow for Guru with confirmation checkpoints.

Use the guru-deployment skill for deployment knowledge and reference tips from `${CLAUDE_PLUGIN_ROOT}/skills/guru-deployment/references/tips.md`.

## Workflow Phases

Execute these phases sequentially, stopping for user confirmation at each checkpoint.

### Phase 1: Review Changes

1. Ensure working directory is `js/guru`:
   ```bash
   cd /Users/krushi/work/paperpile/js/guru
   ```

2. Fetch latest and checkout staging branch:
   ```bash
   git fetch origin
   git checkout release/staging/guru
   ```

3. Generate diff between staging and sprint:
   ```bash
   git diff HEAD origin/sprint -- ./
   ```

4. Check for related changes in misc/shared/pp that may affect guru by examining recent commits.

5. Create two output files in `~/Desktop/guru-release/` (create directory if needed):
   - `guru-release-notes.md` - Formatted release notes with Slack message
   - `guru-diff.txt` - Full diff for review

6. Use the release-notes-generator agent to extract ticket IDs and format the Slack message.

7. Display summary in chat AND show file locations.

**CHECKPOINT 1**: Wait for user to review the diff and release notes. Ask: "Please review `~/Desktop/guru-release/guru-release-notes.md` and `~/Desktop/guru-release/guru-diff.txt`. Ready to proceed with versioning?"

### Phase 2: Version and Tag

1. Get current version from package.json or version file
2. Suggest next patch version (e.g., 1.3.15 → 1.3.16)
3. Ask user to confirm or specify version number

**CHECKPOINT 2**: Confirm version number with user before proceeding.

4. Switch to sprint branch and pull latest:
   ```bash
   git checkout sprint
   git pull
   ```

5. Check if new commits appeared since we started (race condition). If yes, warn user and offer to restart.

6. Run version script:
   ```bash
   ./scripts/version.sh {VERSION}
   ```

**CHECKPOINT 3**: Ask user to confirm before pushing: "Version commit and tag created. Ready to push?"

7. Push commit and tags:
   ```bash
   git push && git push --tags
   ```

### Phase 3: Merge to Staging Branch

1. Checkout staging branch and rebase from sprint:
   ```bash
   git checkout release/staging/guru
   git rebase origin/sprint
   ```

2. Verify rebase applied cleanly. If conflicts, stop and alert user.

3. Push staging branch:
   ```bash
   git push
   ```

### Phase 4: Environment Verification

1. SSH to each staging server and verify guru-env exists:
   - stage-node-london-1
   - stage-node-virginia-1
   - stage-node-virginia-2
   - stage-workers-virginia-1
   - stage-workers-virginia-2

   Check: `ssh {server} "ls -la /mount/data/guru/guru-env"`

2. Report status of each server. Flag any missing env files.

**CHECKPOINT 4**: If any env files missing, alert user: "Environment files missing on: {servers}. Deployment may fail. Continue monitoring build?"

### Phase 5: Build Monitoring

1. Inform user that build should trigger automatically at:
   http://localhost:8090/job/Guru%20staging/

2. If user reports build failure, suggest manual deploy job:
   http://localhost:8090/job/Deploy%20staging%20-%20js-guru/

3. SSH to build server if needed: `ssh build`

### Phase 6: Smoke Test Verification

1. After deployment completes, run smoke tests:
   http://localhost:8090/job/Guru%20smoke%20tests/

2. Review test results. Consult tips.md for known flaky tests to ignore.

3. Report deployment completion status.

## Important Notes

- Always wait for user confirmation at checkpoints
- If interrupted, individual phase commands can be used to continue
- Update tips.md with any new learnings during this deployment
