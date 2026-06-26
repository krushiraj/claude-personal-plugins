#!/usr/bin/env node
'use strict';

// triage CLI shell — the "fix once, close many" orchestrator (Task 6).
//
//   node bin/triage.js [--limit N] [--status New] [--skip-sweep]
//
// Pipeline (composes Tasks 1-5; no core edits):
//   1. Unless --skip-sweep: re-run intake's sweep to (re)create case folders:
//        node bin/intake.js --sweep-new <status> [--limit N]
//   2. For each case folder under cases/:
//        a. readCase(folder)
//        b. if no case.logs -> run bin/log-acquire.js, re-read
//        c. classify(logText, { mode, proxyUsed }) on the acquired log
//        d. case.diagnosis = result; updateCase(folder, case)
//        e. resilient: one bad case -> `skip <folder>: <reason>` on stderr, continue
//   3. clusterCases + renderBoard -> write cases/TRIAGE-<date>.md AND print it
//   4. print a final one-line summary
//
// IMPORTANT — each swept case triggers a REAL local crawl (log-acquire's
// fallback), which is slow and hits the network. So when no --limit is given we
// default to a SMALL limit (DEFAULT_LIMIT) to keep a default run cheap.

const path = require('path');
const fs = require('fs');
const { spawnSync } = require('child_process');
const { readCase, updateCase } = require('../src/caseFile');
const { classify } = require('../src/classify');
const { clusterCases, renderBoard } = require('../src/triage');

const TOOLS_DIR = path.join(__dirname, '..');
const CASES_DIR = path.join(TOOLS_DIR, 'cases');
const INTAKE_BIN = path.join(__dirname, 'intake.js');
const LOG_ACQUIRE_BIN = path.join(__dirname, 'log-acquire.js');

// Crawls are expensive: keep a no-flag run cheap. Documented default.
const DEFAULT_LIMIT = 5;

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const key = a.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) {
      out[key] = true;
    } else {
      out[key] = next;
      i++;
    }
  }
  return out;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

// Run a node script with stdio inherited so the user sees its live progress.
// Returns true on exit code 0.
function runNode(scriptPath, args) {
  const r = spawnSync(process.execPath, [scriptPath, ...args], {
    cwd: TOOLS_DIR,
    stdio: 'inherit',
  });
  return r.status === 0;
}

// List the case folders (the <date>-... dirs containing a case.json).
function listCaseFolders() {
  if (!fs.existsSync(CASES_DIR)) return [];
  return fs
    .readdirSync(CASES_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => path.join(CASES_DIR, d.name))
    .filter((folder) => fs.existsSync(path.join(folder, 'case.json')))
    .sort();
}

// Ensure a case has logs (acquire if missing), classify, persist diagnosis.
// Returns the updated case object. Throws on unrecoverable problems so the
// caller can `skip` this one and continue.
function triageOne(folder) {
  let caseObj = readCase(folder);

  if (!caseObj.logs) {
    const ok = runNode(LOG_ACQUIRE_BIN, [folder]);
    if (!ok) throw new Error('log-acquire failed');
    caseObj = readCase(folder);
  }

  if (!caseObj.logs || !caseObj.logs.path) {
    throw new Error('no log path on case after acquire');
  }
  if (!fs.existsSync(caseObj.logs.path)) {
    throw new Error(`log file missing: ${caseObj.logs.path}`);
  }

  const logText = fs.readFileSync(caseObj.logs.path, 'utf8');
  caseObj.diagnosis = classify(logText, {
    mode: caseObj.mode,
    proxyUsed: caseObj.proxyUsed,
  });
  updateCase(folder, caseObj);
  return caseObj;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const status = typeof args.status === 'string' ? args.status : 'New';
  const limit = typeof args.limit === 'string' ? parseInt(args.limit, 10) : DEFAULT_LIMIT;

  // 1) Sweep (re)creates case folders unless explicitly skipped.
  if (!args['skip-sweep']) {
    const sweepArgs = ['--sweep-new', status, '--limit', String(limit)];
    console.error(`> sweeping ${status} reports (limit ${limit})...`);
    const ok = runNode(INTAKE_BIN, sweepArgs);
    if (!ok) console.error('warning: sweep exited non-zero; continuing with existing cases');
  } else {
    console.error('> --skip-sweep: triaging existing case folders only');
  }

  // 2) Triage each case, resilient to per-case failures.
  let folders = listCaseFolders();
  // Cap how many cases we crawl/classify in one run (crawls are expensive).
  if (limit > 0) folders = folders.slice(0, limit);

  const cases = [];
  let skipped = 0;
  for (const folder of folders) {
    try {
      cases.push(triageOne(folder));
    } catch (err) {
      skipped++;
      console.error(`skip ${path.basename(folder)}: ${(err && err.message) || err}`);
    }
  }

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

module.exports = { triageOne, listCaseFolders };
