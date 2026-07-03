#!/usr/bin/env node
'use strict';

// log-acquire CLI shell.
//
//   node bin/log-acquire.js <caseFolder>
//
// Gets the full crawler logs for a case. Backends, in order:
//   1. attached — the case carries an extension pdf-crawl-log JSON
//      (logs/attached.json, from intake --log-file/--logs-dir): replay it
//      OFFLINE via `yarn crawler:debug:replay` and record 'replay' provenance.
//      Deterministic, fast, no network — and never falls through to a live
//      crawl (the attached log IS the crawl).
//   2. s3 (stub) / local re-run, as before. The fallback log (success OR
//      crawler-failure) is exactly what the downstream `classify` step needs,
//      so a failed crawl is a SUCCESS for this tool — we still captured its
//      output.
//
// S3 is a documented stub (see src/logAcquire.js): there is no discoverable
// crawler-log bucket/scheme, so S3 is only attempted when CRAWLER_LOG_BUCKET is
// set AND the `aws` CLI is present. Otherwise we go straight to the local run.

const path = require('path');
const fs = require('fs');
const { execFileSync, spawnSync } = require('child_process');
const { readCase, updateCase } = require('../src/caseFile');
const { s3KeyFor, pickBackend } = require('../src/logAcquire');
const { canonicalMode } = require('../src/modes');

const CASES_DIR = path.join(__dirname, '..', 'cases');
// Where the shared package (with debugCrawler) lives; overridable via env.
const SHARED_DIR =
  process.env.GURU_DIR ||
  process.env.CRAWLER_SHARED_DIR ||
  '/Users/krushi/work/paperpile/js/shared';
const MAX_BUFFER = 64 * 1024 * 1024;
// Offline replays are fast (~10s), but ts-node startup + a big log deserves
// headroom. A hung replay is killed and we keep the attached provenance.
const REPLAY_TIMEOUT_MS = 120000;

// Is the `aws` CLI available on PATH?
function awsAvailable() {
  try {
    execFileSync('aws', ['--version'], { stdio: 'ignore' });
    return true;
  } catch (e) {
    return false;
  }
}

// Try to fetch the logs blob from S3. Returns the blob string on a hit, or null
// on any miss (no bucket configured, no aws CLI, object absent, error).
function tryS3(caseObj) {
  const bucket = process.env.CRAWLER_LOG_BUCKET;
  if (!bucket) return null;
  if (!awsAvailable()) return null;
  const key = s3KeyFor(caseObj);
  try {
    // `aws s3 cp s3://bucket/key -` streams the object to stdout.
    return execFileSync('aws', ['s3', 'cp', `s3://${bucket}/${key}`, '-'], {
      encoding: 'utf8',
      maxBuffer: MAX_BUFFER,
      stdio: ['ignore', 'pipe', 'ignore'],
    });
  } catch (e) {
    return null;
  }
}

// Run a yarn script in the shared repo and capture stdout+stderr. spawnSync
// (not execFileSync) so we ALWAYS get both streams regardless of exit code —
// the crawler logs to stderr too, and a passing crawl's log would otherwise be
// nearly empty. A non-zero exit (the crawler failing) is NOT an error for us.
// `opts` (cmd/args/cwd/timeout) is injectable so tests can point at a fake script.
function runYarnScript(argv, opts = {}) {
  const cmd = opts.cmd || 'yarn';
  const args = opts.args || argv;
  const cwd = opts.cwd || SHARED_DIR;
  const r = spawnSync(cmd, args, {
    cwd,
    encoding: 'utf8',
    maxBuffer: MAX_BUFFER,
    timeout: opts.timeout,
  });
  const parts = [];
  if (r.stdout) parts.push(r.stdout);
  if (r.stderr) parts.push(r.stderr);
  if (!parts.length && r.error) parts.push(`${argv[0]} could not run: ${r.error.message}`);
  return parts.join('\n');
}

// Re-run the crawler locally (live).
function runLocalCrawler(url, mode, opts = {}) {
  return runYarnScript(['crawler:debug', url, mode], opts);
}

// Replay an attached extension crawl log OFFLINE (deterministic, no network).
function runReplay(attachedPath, opts = {}) {
  return runYarnScript(
    ['crawler:debug:replay', attachedPath],
    Object.assign({ timeout: REPLAY_TIMEOUT_MS }, opts)
  );
}

function main() {
  const caseFolderArg = process.argv[2];
  if (!caseFolderArg) {
    console.error('Usage: node bin/log-acquire.js <caseFolder>');
    process.exit(1);
  }

  // Resolve the folder (accept absolute, relative, or bare folder name).
  let folder = caseFolderArg;
  if (!fs.existsSync(path.join(folder, 'case.json'))) {
    const alt = path.join(CASES_DIR, path.basename(caseFolderArg));
    if (fs.existsSync(path.join(alt, 'case.json'))) folder = alt;
  }
  if (!fs.existsSync(path.join(folder, 'case.json'))) {
    throw new Error(`no case.json in ${caseFolderArg}`);
  }

  const caseObj = readCase(folder);
  const logsDir = path.join(folder, 'logs');
  fs.mkdirSync(logsDir, { recursive: true });

  // 0) Attached extension crawl log -> offline replay. NEVER falls through to
  // a live crawl: the attached log already IS the crawl we want to diagnose.
  const attached = caseObj.logs && caseObj.logs.provenance === 'attached' && caseObj.logs.path;
  if (attached && fs.existsSync(attached)) {
    const attachedPath = path.resolve(attached);
    const out = runReplay(attachedPath);
    if (out && out.trim()) {
      const logPath = path.join(logsDir, 'replay.log');
      fs.writeFileSync(logPath, out);
      caseObj.logs = {
        provenance: 'replay',
        path: path.resolve(logPath),
        attachedPath,
        acquiredAt: new Date().toISOString(),
      };
      updateCase(folder, caseObj);
      console.log(`logs: replay -> ${logPath}`);
    } else {
      // Replay produced nothing useful — keep the attached provenance so a
      // human (or a fixed replay) can still work from the raw JSON.
      console.log(`logs: attached (replay produced no output) -> ${attachedPath}`);
    }
    return;
  }

  const mode = canonicalMode(caseObj.mode);
  const url = caseObj.publisherUrl || caseObj.url;
  if (!url) throw new Error('case has no publisherUrl/url to crawl');

  // 1) Try S3. An empty/whitespace object is a MISS, not a spurious 's3' hit.
  const s3Blob = tryS3(caseObj);
  const s3Hit = !!(s3Blob && s3Blob.trim());
  const backend = pickBackend({ s3Available: s3Hit });

  let provenance;
  let logPath;
  if (backend === 's3') {
    logPath = path.join(logsDir, 's3.log');
    fs.writeFileSync(logPath, s3Blob);
    provenance = 's3';
  } else {
    // 2) Local fallback — re-run the crawler, capture success OR failure output.
    const out = runLocalCrawler(url, mode);
    logPath = path.join(logsDir, `local.${mode}.log`);
    fs.writeFileSync(logPath, out);
    provenance = 'local';
    // debugCrawler writes the fetched PDF as <url-with-\W->_>.pdf into its cwd
    // (the shared repo) on a successful PDF crawl. Best-effort cleanup so we
    // don't litter the shared repo; never throw if it isn't there.
    try {
      fs.unlinkSync(path.join(SHARED_DIR, `${url.replace(/\W/g, '_')}.pdf`));
    } catch (e) {
      /* no PDF produced (META crawl or failure) — nothing to clean up */
    }
  }

  // 3) Persist provenance back onto the case IN PLACE (updateCase writes to the
  // exact folder we read, never a date-recomputed one). Store an absolute path
  // so downstream tools resolving it from another cwd don't break.
  caseObj.logs = {
    provenance,
    path: path.resolve(logPath),
    acquiredAt: new Date().toISOString(),
  };
  updateCase(folder, caseObj);

  console.log(`logs: ${provenance} -> ${logPath}`);
}

if (require.main === module) {
  try {
    main();
  } catch (err) {
    console.error(`Error: ${(err && err.message) || err}`);
    process.exit(1);
  }
}

module.exports = { runLocalCrawler, runReplay, runYarnScript };
