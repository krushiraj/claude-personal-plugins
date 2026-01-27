---
description: Verify guru-env on deployment servers
argument-hint: [staging|production]
allowed-tools: Bash, AskUserQuestion
---

# Verify Guru Environment Variables on Servers

SSH to deployment servers and verify guru-env file exists.

**Environment**: $ARGUMENTS (defaults to staging if not specified)

Use the guru-deployment skill for deployment knowledge and server lists.

## Steps

1. Determine environment and server list:

   **Staging servers**:
   - stage-node-london-1
   - stage-node-virginia-1
   - stage-node-virginia-2
   - stage-workers-virginia-1
   - stage-workers-virginia-2

   **Production servers** (if `$1` is "production"):
   - production-node-london-1
   - production-node-virginia-1
   - production-node-virginia-2
   - production-workers-virginia-1
   - production-workers-virginia-2

2. For each server, check if guru-env exists:
   ```bash
   ssh {server} "ls -la /mount/data/guru/guru-env" 2>&1
   ```

3. Collect results and report status table:
   ```
   | Server                    | Status | Notes |
   |---------------------------|--------|-------|
   | stage-node-london-1       | ✓      |       |
   | stage-workers-virginia-2  | ✗      | File not found |
   ```

4. **Critical check for workers**:
   Workers servers (`*-workers-*`) MUST have env vars or deployment will fail.
   If any worker server is missing guru-env, highlight this prominently.

5. If any servers are missing env files:
   - List the affected servers
   - Explain that deployment may fail
   - Ask user: "Some servers are missing guru-env. Continue with deployment, or fix first?"

6. If all servers have env files:
   - Report all clear
   - Inform user they can proceed with build monitoring

## SSH Troubleshooting

If SSH fails:
- Verify VPN connection is active
- Check SSH key is loaded: `ssh-add -l`
- Verify server alias exists in ~/.ssh/config

## Important Notes

- Workers MUST have env vars - they won't start without them
- Node servers can sometimes tolerate missing env (uses defaults)
- Run this check BEFORE deployment, not after
- Update tips.md if you discover new env requirements
