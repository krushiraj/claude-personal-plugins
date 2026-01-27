---
description: Run smoke tests and verify Guru deployment
argument-hint: [staging|production]
allowed-tools: Bash, Read, AskUserQuestion
---

# Verify Guru Deployment with Smoke Tests

Run smoke tests and verify deployment completed successfully.

**Environment**: $ARGUMENTS (defaults to staging if not specified)

Use the guru-deployment skill and consult tips.md for known flaky tests.

## Steps

1. Determine environment for context in reporting.

2. Check Jenkins smoke test job:
   - URL: http://localhost:8090/job/Guru%20smoke%20tests/

3. Ask user about smoke test status:
   - "Have the smoke tests completed? What was the result?"
   - Options: All passed, Some failures, Not run yet

4. If some failures reported:
   - Ask user to share which tests failed
   - Consult `${CLAUDE_PLUGIN_ROOT}/skills/guru-deployment/references/tips.md` for known flaky tests
   - Determine if failures are:
     - Known flaky tests (can be ignored)
     - New failures (need investigation)

5. Report deployment verification status:

   **If all tests pass or only known flaky tests fail**:
   ```
   ✅ Deployment Verified

   Environment: {staging|production}
   Version: {version}
   Smoke Tests: Passed (or X known flaky tests ignored)

   Deployment complete!
   ```

   **If unknown failures**:
   ```
   ⚠️ Deployment Needs Review

   Environment: {staging|production}
   Version: {version}
   Smoke Tests: X failures need investigation

   Failed tests:
   - {test name 1}
   - {test name 2}

   Recommended: Investigate failures before proceeding.
   ```

6. If this is staging deployment:
   - Remind user that production deployment can proceed after verification
   - Command: `/guru-release:production`

7. If this is production deployment:
   - Celebrate successful deployment
   - Suggest posting release notes to Slack

## Updating Known Flaky Tests

If a test is determined to be flaky (intermittent failure not caused by code changes):

1. Note the test name
2. Add it to `${CLAUDE_PLUGIN_ROOT}/skills/guru-deployment/references/tips.md` under "Known Flaky Tests"

## Rollback Considerations

If deployment verification fails and rollback is needed:
- Consult tips.md for rollback procedure
- Identify previous good tag
- Reset release branch and force push
- Trigger manual deploy job

Always confirm rollback decisions with user.
