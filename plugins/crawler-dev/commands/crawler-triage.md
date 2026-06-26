---
description: Sweep New crawler reports, acquire logs, classify, and emit a clustered triage board (read-only)
argument-hint: "[status] [limit] — e.g. `New 10` or just `10`"
allowed-tools: Read, Bash, Glob, Grep
---

# Crawler Triage

Run the read-only triage sweep over reported crawler issues: pull rows from the
crawler-reports DB, reproduce/acquire logs, classify each root cause, and write a
clustered triage board grouped by `domain + error-class` ("fix once, close many").

This is **READ-ONLY**. It does not edit drivers (`pdf.ts`/`meta.ts`/`selectors.js`)
and does not write back to Notion. It only reproduces failures and reports.

## Arguments

`$ARGUMENTS` is optional and may be `[status] [limit]` in either order:

- `/crawler-triage` → status `New`, limit `5`
- `/crawler-triage 10` → status `New`, limit `10`
- `/crawler-triage New 10` → status `New`, limit `10`
- `/crawler-triage Tested 3` → status `Tested`, limit `3`

**Default limit is 5 — and that is deliberate.** Each case triggers a *real* crawl
(`yarn crawler:debug`) to acquire logs, which is slow and hits the network. There
are currently **>100 New reports** in the DB, so an unbounded sweep would take a
very long time and hammer publishers. Only raise the limit when the user explicitly
asks for a wider sweep.

## Prerequisites

- Notion token at `~/.claude/notion-cards.local.md` (used to query the reports DB).
- Outbound network — crawls fetch the live publisher pages.

## Steps

### 1. Parse arguments

From `$ARGUMENTS`, pick out an optional status word (defaults to `New`) and an
optional integer limit (defaults to `5`). If only a number is given, it's the limit.

### 2. Run the triage sweep

```bash
cd /Users/krushi/.claude-personal-plugins/plugins/crawler-dev/tools
node bin/triage.js --limit <N> --status <status>
```

This sweeps the reports, acquires logs (S3 stub → local `yarn crawler:debug`
fallback), classifies each case, persists the diagnosis into each `case.json`, and
writes the board to `tools/cases/TRIAGE-<date>.md`.

### 3. Echo the board

```bash
cat /Users/krushi/.claude-personal-plugins/plugins/crawler-dev/tools/cases/TRIAGE-*.md
```

### 4. Summarize for the user

Read the board and report back, concisely:

- The **top clusters by count** (domain + error class), with the Obtainable column
  so it's clear whether the data is recoverable.
- A single **recommendation**: which cluster is the highest-value one to drill into
  next — the one where one driver fix closes the most reports.
- Remind the user this was read-only triage. To actually fix a cluster, hand off
  manually to the `crawler-dev` (pdf.ts/meta.ts) or `metadata-crawler-dev`
  (selectors.js) skill — the fix/verify stages are not yet automated (Phase 2+).

## Notes

- Error Class values come from the classifier taxonomy: `success`,
  `referer-required`, `proxy-needed`, `blocked-paywall`, `network`, `js-rendered`,
  `selector-drift`, `doi-resolution-fail`, `unknown`.
- Case folders live under `tools/cases/<date>-<slug>-<hash8>/` (gitignored) and are
  resumable — re-running reuses existing folders.
- See the `crawler-fix-loop` skill for the full stage map and how Phase 1 fits.
