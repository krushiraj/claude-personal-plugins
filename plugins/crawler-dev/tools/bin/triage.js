#!/usr/bin/env node
'use strict';

// triage CLI shell — the "fix once, close many" orchestrator (Task 6).
//
//   node bin/triage.js [--limit N] [--status New] [--skip-sweep]
//   node bin/triage.js --logs-dir <dir> [--limit N]
//
// Pipeline (composes Tasks 1-5; no core edits):
//   1. Unless --skip-sweep: run intake's sweep to (re)create case folders and
//      CAPTURE the folders it just created (intake prints them) — those exact
//      fresh cases are what we triage, NOT whatever happens to sort first on disk.
//      With --logs-dir, the Notion sweep is replaced by intake --logs-dir over a
//      directory of extension pdf-crawl-log exports; log acquisition is then an
//      OFFLINE `crawler:debug:replay` of each attached log (fast, no network).
//   2. For each selected case folder:
//        a. readCase(folder)
//        b. if no case.logs -> run bin/log-acquire.js (with a timeout), re-read
//        c. classify(logText, { mode, proxyUsed }) on the acquired log
//        d. case.diagnosis = result; updateCase(folder, case)
//        e. resilient: one bad/slow case -> `skip <folder>: <reason>` on stderr, continue
//   3. clusterCases + renderBoard -> write cases/TRIAGE-<date>.md AND print it
//   4. print a final one-line summary
//
// COST GUARD — each triaged case triggers a REAL local crawl (log-acquire's
// fallback), which is slow and hits the network. So:
//   * --limit caps how many cases we crawl per run; with no/invalid --limit we
//     fall back to DEFAULT_LIMIT (a malformed value must NOT disable the cap).
//   * --limit <= 0 is rejected and treated as DEFAULT_LIMIT (keeps the guard on).
//   * a single crawl that hangs is killed after CRAWL_TIMEOUT_MS and skipped, so
//     it can never block the rest of the run.

const path = require('path');
const fs = require('fs');
const { spawnSync } = require('child_process');
const { readCase, updateCase } = require('../src/caseFile');
const { classify } = require('../src/classify');
const { extensionVerdict } = require('../src/extensionLog');
const { clusterCases, renderBoard } = require('../src/triage');

const TOOLS_DIR = path.join(__dirname, '..');
const CASES_DIR = path.join(TOOLS_DIR, 'cases');
const INTAKE_BIN = path.join(__dirname, 'intake.js');
const LOG_ACQUIRE_BIN = path.join(__dirname, 'log-acquire.js');

// Crawls are expensive: keep a no-flag run cheap. Documented default.
const DEFAULT_LIMIT = 5;
// Per-case crawl wall-clock cap. A hung crawl is killed and the case is skipped.
const CRAWL_TIMEOUT_MS = 90000;
const MAX_BUFFER = 64 * 1024 * 1024;

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const key = a.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) {
      out[key] = true; // bare flag (e.g. `--limit` with no value, or `--skip-sweep`)
    } else {
      out[key] = next;
      i++;
    }
  }
  return out;
}

// Resolve --limit defensively. A bare flag (true), a non-numeric string
// (parseInt -> NaN), or a non-positive number must NOT disable the cost guard —
// fall back to DEFAULT_LIMIT. `--limit 0` / negatives are rejected -> default.
function resolveLimit(raw) {
  if (typeof raw !== 'string') return DEFAULT_LIMIT;
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_LIMIT;
  return n;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function hasCaseJson(folder) {
  return fs.existsSync(path.join(folder, 'case.json'));
}

// Does this case already carry a diagnosis? (used to prefer un-triaged cases on
// a --skip-sweep run). Unreadable case.json -> treat as "no diagnosis".
function hasDiagnosis(folder) {
  try {
    const c = readCase(folder);
    return !!(c && c.diagnosis && c.diagnosis.errorClass);
  } catch (e) {
    return false;
  }
}

// Run intake's sweep, CAPTURING stdout so we can learn exactly which folders it
// created (intake prints each created folder, indented). Echo its output so the
// user still sees progress. Returns the list of freshly-created case folders.
function runSweep(status, limit) {
  console.error(`> sweeping ${status} reports (limit ${limit})...`);
  const r = spawnSync(
    process.execPath,
    [INTAKE_BIN, '--sweep-new', status, '--limit', String(limit)],
    { cwd: TOOLS_DIR, encoding: 'utf8', maxBuffer: MAX_BUFFER }
  );
  const stdout = r.stdout || '';
  if (stdout) process.stderr.write(stdout);
  if (r.stderr) process.stderr.write(r.stderr);
  if (r.status !== 0) {
    console.error('warning: sweep exited non-zero; continuing with what it created');
  }
  return parseCreatedFolders(stdout);
}

// Like runSweep, but over a directory of extension pdf-crawl-log exports
// (intake --logs-dir prints the same summary + indented-folders shape).
function runLogsSweep(dir, limit) {
  console.error(`> intaking extension crawl logs from ${dir} (limit ${limit})...`);
  const r = spawnSync(
    process.execPath,
    [INTAKE_BIN, '--logs-dir', dir, '--limit', String(limit)],
    { cwd: TOOLS_DIR, encoding: 'utf8', maxBuffer: MAX_BUFFER }
  );
  const stdout = r.stdout || '';
  if (stdout) process.stderr.write(stdout);
  if (r.stderr) process.stderr.write(r.stderr);
  if (r.status !== 0) {
    console.error('warning: logs-dir intake exited non-zero; continuing with what it created');
  }
  return parseCreatedFolders(stdout);
}

// intake prints created folders as indented absolute paths under the summary
// line. Pull those out (existing case.json only), de-duplicated, order preserved.
function parseCreatedFolders(stdout) {
  const seen = new Set();
  const folders = [];
  for (const line of String(stdout).split('\n')) {
    const m = line.match(/^\s+(\/.+\S)\s*$/);
    if (!m) continue;
    const folder = m[1];
    if (seen.has(folder)) continue;
    if (!hasCaseJson(folder)) continue;
    seen.add(folder);
    folders.push(folder);
  }
  return folders;
}

// List the case folders (the <date>-... dirs containing a case.json), sorted
// ascending by name (oldest first, since names are date-prefixed).
function listCaseFolders() {
  if (!fs.existsSync(CASES_DIR)) return [];
  return fs
    .readdirSync(CASES_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => path.join(CASES_DIR, d.name))
    .filter(hasCaseJson)
    .sort();
}

// Default real crawl: shell out to log-acquire with a hard timeout. A hung crawl
// is killed (SIGTERM) -> we surface a `crawl timed out` skip rather than block
// the whole run. Throws on timeout / non-zero exit; caller turns it into a skip.
function defaultAcquire(folder) {
  const r = spawnSync(process.execPath, [LOG_ACQUIRE_BIN, folder], {
    cwd: TOOLS_DIR,
    stdio: 'inherit',
    timeout: CRAWL_TIMEOUT_MS,
  });
  // spawnSync sets `error` on timeout (code ETIMEDOUT) and kills with `signal`.
  if (r.error) {
    if (r.error.code === 'ETIMEDOUT') throw new Error('crawl timed out');
    throw new Error(r.error.message);
  }
  if (r.signal) throw new Error(`crawl killed (${r.signal})`);
  if (r.status !== 0) throw new Error('log-acquire failed');
}

// Ensure a case has logs (acquire if missing), classify, persist diagnosis.
// `deps.acquire(folder)` is injectable so tests can drive this without crawling.
// Returns the updated case object. Throws on unrecoverable problems so the
// caller can `skip` this one and continue.
function triageOne(folder, deps = {}) {
  const acquire = deps.acquire || defaultAcquire;
  let caseObj = readCase(folder);

  // 'attached' provenance is the raw extension JSON, not yet a crawl log —
  // acquire turns it into logs/replay.log (offline). Missing logs -> live crawl.
  if (!caseObj.logs || caseObj.logs.provenance === 'attached') {
    acquire(folder); // throws on failure/timeout
    caseObj = readCase(folder);
  }

  if (!caseObj.logs || !caseObj.logs.path) {
    throw new Error('no log path on case after acquire');
  }
  if (!fs.existsSync(caseObj.logs.path)) {
    throw new Error(`log file missing: ${caseObj.logs.path}`);
  }

  const logText = fs.readFileSync(caseObj.logs.path, 'utf8');
  const ctx = { mode: caseObj.mode, proxyUsed: caseObj.proxyUsed };
  if (caseObj.errorMsg) {
    // Extension-reported cases: the extension's own verdict is authoritative
    // (classify short-circuits on it). CRAWLER_FAILED maps to null, so those
    // cases are classified from the REPLAY log text by the rules.
    ctx.extensionVerdict = extensionVerdict(caseObj.errorMsg);
    ctx.errorMsg = caseObj.errorMsg;
  }
  caseObj.diagnosis = classify(logText, ctx);
  updateCase(folder, caseObj);
  return caseObj;
}

// Triage a list of folders, resilient to per-case failures. Tags each returned
// case with its `folder` basename so the board can list cluster members.
function triageFolders(folders, deps = {}) {
  const cases = [];
  let skipped = 0;
  for (const folder of folders) {
    try {
      const caseObj = triageOne(folder, deps);
      caseObj.folder = path.basename(folder);
      cases.push(caseObj);
    } catch (err) {
      skipped++;
      console.error(`skip ${path.basename(folder)}: ${(err && err.message) || err}`);
    }
  }
  return { cases, skipped };
}

// Choose which folders to triage:
//   * normal run: exactly the folders the sweep just created (capped by limit).
//   * --skip-sweep: existing folders, preferring un-triaged ones, newest first.
function selectFolders({ skipSweep, sweptFolders, limit }) {
  if (!skipSweep) return sweptFolders.slice(0, limit);

  const folders = listCaseFolders().reverse(); // newest first (date-prefixed names)
  // Stable partition: undiagnosed (false=0) before already-diagnosed (true=1).
  folders.sort((a, b) => Number(hasDiagnosis(a)) - Number(hasDiagnosis(b)));
  return folders.slice(0, limit);
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const status = typeof args.status === 'string' ? args.status : 'New';
  const limit = resolveLimit(args.limit);
  const skipSweep = !!args['skip-sweep'];

  const logsDir = typeof args['logs-dir'] === 'string' ? args['logs-dir'] : null;

  // 1) Sweep (re)creates case folders unless explicitly skipped; capture them.
  // --logs-dir replaces the Notion sweep with an extension-log intake.
  let sweptFolders = [];
  if (logsDir) {
    sweptFolders = runLogsSweep(logsDir, limit);
  } else if (!skipSweep) {
    sweptFolders = runSweep(status, limit);
  } else {
    console.error('> --skip-sweep: triaging existing case folders (un-triaged first)');
  }

  // 2) Select + triage, resilient to per-case failures. (--logs-dir behaves
  // like a sweep: triage exactly the folders the intake just created.)
  const folders = selectFolders({ skipSweep: skipSweep && !logsDir, sweptFolders, limit });
  const { cases, skipped } = triageFolders(folders);

  // 3) Cluster + render the board.
  const clusters = clusterCases(cases);
  const board = renderBoard(clusters);
  const boardPath = path.join(CASES_DIR, `TRIAGE-${today()}.md`);
  fs.mkdirSync(CASES_DIR, { recursive: true });
  fs.writeFileSync(boardPath, board.endsWith('\n') ? board : board + '\n');

  console.log('');
  console.log(board);

  // 4) Final summary.
  console.log(
    `Triaged ${cases.length} cases into ${clusters.length} clusters -> ${boardPath}` +
      (skipped ? ` (${skipped} skipped)` : '')
  );
}

if (require.main === module) {
  try {
    main();
  } catch (err) {
    console.error(`Error: ${(err && err.message) || err}`);
    process.exit(1);
  }
}

module.exports = {
  parseArgs,
  resolveLimit,
  parseCreatedFolders,
  selectFolders,
  triageOne,
  triageFolders,
  listCaseFolders,
  DEFAULT_LIMIT,
};
