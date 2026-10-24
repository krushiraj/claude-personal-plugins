---
description: Dispatch a task to the agent configured for a role
argument-hint: <role> "<task>"
allowed-tools: Bash, Read, Write
---

Dispatch a task through cross-agent.

Arguments: `$ARGUMENTS` (first word is the role, the rest is the task).

1. If the first word is not a role from `${CLAUDE_PLUGIN_ROOT}/bin/xa-dispatch --list`, show the available roles and stop.
2. Turn the task into a self-contained prompt file (goal, file paths, constraints, acceptance criteria, desired output format). The external agent has no access to this conversation.
3. Run `${CLAUDE_PLUGIN_ROOT}/bin/xa-dispatch <role> --prompt-file <file>`.
4. Follow the `cross-agent` skill for handling the result: show any fallback `notice` to the user verbatim, review worktree diffs before applying, and on exit code 3 fall back to a native Claude subagent.
