---
description: Push version and merge to release branch for Guru
argument-hint: [staging|production]
allowed-tools: Read, Bash, AskUserQuestion
---

# Push Guru Version and Merge to Release Branch

Push the version commit/tag and merge to the appropriate release branch.

**Environment**: $ARGUMENTS (defaults to staging if not specified)

Use the guru-deployment skill for deployment knowledge.

## Steps

1. Determine environment (staging or production):
   - If `$1` is "production": merge staging → production
   - Otherwise (staging): push tags + merge sprint → staging

2. Navigate to guru directory:
   ```bash
   cd /Users/krushi/work/paperpile/js/guru
   ```

### For Staging Deployment

3. Verify we're on sprint with unpushed version commit:
   ```bash
   git status
   git log origin/sprint..HEAD --oneline
   ```

4. **CHECKPOINT**: Ask user to confirm push:
   "Ready to push version commit and tags to origin. This will trigger the staging build. Confirm?"

5. Push commit and tags:
   ```bash
   git push && git push --tags
   ```

6. Checkout staging branch and rebase from sprint:
   ```bash
   git checkout release/staging/guru
   git fetch origin
   git rebase origin/sprint
   ```

7. Check for conflicts. If any, stop and alert user.

8. Push staging branch:
   ```bash
   git push
   ```

### For Production Deployment

3. Checkout production branch:
   ```bash
   git checkout release/production/guru
   git fetch origin
   ```

4. **CHECKPOINT**: Ask user to confirm:
   "Ready to promote staging to production. This is a PRODUCTION deployment. Confirm?"

5. Rebase from staging:
   ```bash
   git rebase origin/release/staging/guru
   ```

6. Check for conflicts. If any, stop and alert user.

7. Push production branch:
   ```bash
   git push
   ```

## Post-Push

Report completion:
- Branch pushed successfully
- Build should trigger at Jenkins
- Next step: verify environment vars with `/guru-release:env`

## Important Notes

- Always confirm before pushing to origin
- Production requires extra confirmation
- If rebase has conflicts, stop immediately and consult user
- Build triggers automatically on push to release branches
