---
name: crawler-fix-loop
description: Triage and fix reported PDF/META crawler issues from the crawler-reports DB. Use to sweep New reports, reproduce + classify failures, cluster by domain+error-class, and (later phases) drive the fix/verify loop. Triggered by "triage crawler reports", "what's failing in the crawler DB", or a reported crawler issue.
---

# Crawler Fix Loop — Orchestrator

The brain that turns reported crawler issues into reproduced, classified, and
(eventually) fixed-and-verified cases. It **wraps, doesn't replace**, the existing
hands: the `crawler-dev` (pdf.ts/meta.ts) and `metadata-crawler-dev` (selectors.js)
skills stay where driver edits happen.

**Phase 1 (now): triage only, READ-ONLY.** Intake → acquire logs → classify →
cluster → triage board. No driver edits, no Notion write-back, no browser check.

## The case file (backbone)

Every reported issue becomes a resumable, auditable folder under `tools/cases/`:

```
tools/cases/<date>-<slug>-<hash8>/
  case.json     ← source of truth: url, doi, mode, env, proxyUsed, build, status, diagnosis
  case.md       ← human-readable mirror
  logs/         ← S3 blob and/or local re-run logs (node; browser later)
  (later) diagnosis / fix.diff / verify.md
```

Modeled on YAML-as-source-of-truth: runs are resumable, clusterable, and a subagent
can pick up a half-finished case.

**Intake is polymorphic** — a raw URL, a DOI, a Notion page-id, or a `--sweep-new`
status sweep all normalize to the same case file.

## Stage map

```
INTAKE → ACQUIRE LOGS → CLASSIFY → CLUSTER → ┃checkpoint┃ → PLAN → FIX
  → VERIFY (node / browser / end-user) → SIMPLIFY → REPORT
```

| Stage | What it does | Status |
|-------|--------------|--------|
| INTAKE | Pull reports, resolve real publisher URL from `pub.url[]`, write case folder | ✅ Phase 1 |
| ACQUIRE LOGS | S3 by derived key → fallback to local `crawler:debug`; record provenance | ✅ Phase 1 |
| CLASSIFY | Logs → error class + site kind + obtainable data (taxonomy below) | ✅ Phase 1 |
| CLUSTER | Group cases by `domain + error-class`, emit the triage board | ✅ Phase 1 |
| — checkpoint — | Stop for human approval before any edit | — |
| PLAN | Present root cause + minimal change (2–3 rules max) | ⛔ Deferred |
| FIX | Apply the driver change | ⛔ Deferred — hand off MANUALLY |
| VERIFY (3 ctx) | node → browser → end-user (Chrome add-to-library) | ⛔ Deferred |
| SIMPLIFY | Drop each rule, keep minimal green set | ⛔ Deferred |
| REPORT | `verify.md` + case summary; Notion write-back | ⛔ Deferred |

A fix is "done" only when all 3 verify contexts pass — but that gate is not yet
automated.

## Phase boundary

**Implemented (Phase 1):** intake, acquire-logs, classify, cluster → the triage
board. All read-only.

**Deferred:**
- **Phase 2** — `verify-3ctx` (node + browser) and a `PostToolUse` driver-edit hook
  that auto-re-runs `crawler:debug` for the active case's URL.
- **Phase 3** — end-user Chrome add-to-library check via `claude-in-chrome` (+ GIF
  evidence).
- **Phase 4** — Notion write-back (Tested / Status / findings).

**For now, the FIX step is manual.** After triage points at a cluster, hand off to
the `crawler-dev` (shared pdf.ts/meta.ts) or `metadata-crawler-dev` (Apify
selectors.js) skill yourself, then come back. The orchestrator never edits drivers.

## Tools

All under `tools/`. Run from `tools/` (e.g.
`cd /Users/krushi/.claude-personal-plugins/plugins/crawler-dev/tools`).

| Command | Purpose |
|---------|---------|
| `node bin/intake.js --url <u>` | Build a case from a raw URL |
| `node bin/intake.js --doi <d>` | Build a case from a DOI |
| `node bin/intake.js --page <id>` | Build a case from a Notion report page-id |
| `node bin/intake.js --sweep-new [status] [--limit N]` | Sweep reports by status into cases |
| `node bin/log-acquire.js <caseFolder>` | Acquire logs (S3 stub → local `crawler:debug`), set `case.logs` |
| `node bin/triage.js [--limit N] [--status New] [--skip-sweep]` | Full sweep: intake → acquire → classify → cluster → board |

- `triage.js` default `--limit` is **5** because each case runs a real crawl and
  there are >100 New reports. `--skip-sweep` triages existing case folders (un-triaged
  first) without re-fetching.
- The board is written to `tools/cases/TRIAGE-<date>.md`, sorted by cluster count.
- The `/crawler-triage` slash command wraps `triage.js` and summarizes the board.

## Error taxonomy (the board's "Error Class" column)

From the classifier:

| Class | Meaning |
|-------|---------|
| `success` | Reproduced fine — data was obtainable (possibly transient / already fixed) |
| `referer-required` | 403/401 on the PDF link; works with a `referer` |
| `proxy-needed` | Access denied with proxy off — institutional access required |
| `blocked-paywall` | Hard paywall / no full text available |
| `network` | Timeout / ECONN / transport failure |
| `js-rendered` | Empty in node but content exists in browser (client-rendered) |
| `selector-drift` | Page reachable but the selector/`JqMeta` no longer matches |
| `doi-resolution-fail` | DOI didn't resolve to a usable publisher URL |
| `unknown` | Didn't match any rule — needs a human look |

## References

- Reports DB: `0e0cafa5-d636-4e04-a6f3-07abf7e6b653`; token in
  `~/.claude/notion-cards.local.md`.
- Shared crawlers: `js/shared/src/crawler/drivers/{pdf,meta,pdfTests,metaTests}.ts`;
  debug via `yarn crawler:debug <url> <PDF|META>`.
- Metadata crawler: `js/guru/apify/metadata-crawler/src/{selectors,metadataFetcher}.js`.
- Taxonomy source / known fixes: `skills/crawler-dev/tips.md`.
- Design + plan: `js/guru/docs/plans/2026-06-26-crawler-fix-loop-{design,phase1}.md`.
