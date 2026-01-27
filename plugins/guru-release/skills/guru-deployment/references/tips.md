# Guru Deployment Tips & Gotchas

This file contains accumulated knowledge from past deployments. Update as new learnings emerge.

## Cross-Repository Changes

Changes in these directories may affect Guru even when the commit is outside js/guru:
- `js/misc/` - Shared utilities
- `js/shared/` - Common components
- `js/pp/` - Paperpile core

**Detection approach**: When reviewing commits for a release, also check git log for these directories since the last release tag. Correlate timestamps and PR numbers to identify related changes.

## Known Flaky Tests

Some smoke tests fail intermittently and can usually be ignored:
- (Add specific test names as you learn them)

## Worker Server Priority

**CRITICAL**: `stage-workers-virginia-1` and `stage-workers-virginia-2` MUST have all mandatory env vars in `/mount/data/guru/guru-env` BEFORE deployment. Workers will not start without them, causing deployment failure.

Same applies to production workers.

## Jenkins Job Notes

- Staging build triggers automatically on push to `release/staging/guru`
- If build fails for test timeout or flaky test, use "Deploy staging - js-guru" job
- Always check build console output if deployment doesn't appear after 5 minutes

## PR and Commit Message Conventions

Ticket format: `[ID-XXXX]` in commit message or PR title
- IDs link to internal tracker
- Multiple tickets in one PR are common
- Some commits may not have ticket IDs (dependency updates, etc.)

## Common Issues

### Tag Already Exists
If version.sh fails because tag exists:
```bash
git tag -d v1.3.15
git push origin :refs/tags/v1.3.15
```
Then retry version.sh.

### Rebase Conflicts
If rebase to staging branch has conflicts:
1. Abort: `git rebase --abort`
2. Investigate what diverged
3. May need manual merge - consult team

### Build Server SSH
SSH alias `build` should be configured in `~/.ssh/config`. If not working:
1. Check VPN connection
2. Verify SSH key is loaded: `ssh-add -l`

## Notion Integration

If Notion MCP is configured, check the story board for:
- Preliminary steps mentioned in tickets
- Precautionary notes from PRs
- Dependencies on other services

## Rollback Procedure

If deployment needs rollback:
1. Identify the previous good tag
2. Reset release branch to that tag
3. Push with `--force-with-lease`
4. Trigger manual deploy job

---

## How to Update This File

Add new tips as you encounter issues during deployments. Include:
- What happened
- Why it happened (if known)
- How to prevent or fix it

Keep entries concise and actionable.
