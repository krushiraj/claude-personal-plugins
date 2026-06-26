#!/usr/bin/env node
'use strict';

// log-acquire CLI shell.
//
//   node bin/log-acquire.js <caseFolder>
//
// Gets the full crawler logs for a case: tries S3 first, falls back to
// re-running the crawler locally. The fallback log (success OR crawler-failure)
// is exactly what the downstream `classify` step needs, so a failed crawl is a
// SUCCESS for this tool — we still captured its output.
//
// S3 is a documented stub (see src/logAcquire.js): there is no discoverable
// crawler-log bucket/scheme, so S3 is only attempted when CRAWLER_LOG_BUCKET is
// set AND the `aws` CLI is present. Otherwise we go straight to the local run.

const path = require('path');
const fs = require('fs');
const { execFileSync, spawnSync } = require('child_process');
const { readCase, updateCase } = require('../src/caseFile');
const { s3KeyFor, pickBackend } = require('../src/logAcquire');

const CASES_DIR = path.join(__dirname, '..', 'cases');
const SHARED_DIR = '/Users/krushi/work/paperpile/js/shared';
const MAX_BUFFER = 64 * 1024 * 1024;

function normalizeMode(mode) {
  const m = (mode && String(mode).toUpperCase()) || 'PDF';
  return m === 'META' ? 'META' : 'PDF';
}

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

// Re-run the crawler locally and capture stdout+stderr. spawnSync (not
// execFileSync) so we ALWAYS get both streams regardless of exit code —
// crawler:debug logs to stderr too, and a passing crawl's log would otherwise be
// nearly empty. A non-zero exit (the crawler failing) is NOT an error for us.
// `opts` (cmd/args/cwd) is injectable so tests can point at a tiny fake script.
function runLocalCrawler(url, mode, opts = {}) {
  const cmd = opts.cmd || 'yarn';
  const argv = opts.args || ['crawler:debug', url, mode];
  const cwd = opts.cwd || SHARED_DIR;
  const r = spawnSync(cmd, argv, { cwd, encoding: 'utf8', maxBuffer: MAX_BUFFER });
  const parts = [];
  if (r.stdout) parts.push(r.stdout);
  if (r.stderr) parts.push(r.stderr);
  if (!parts.length && r.error) parts.push(`crawler:debug could not run: ${r.error.message}`);
  return parts.join('\n');
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
  const mode = normalizeMode(caseObj.mode);
  const url = caseObj.publisherUrl || caseObj.url;
  if (!url) throw new Error('case has no publisherUrl/url to crawl');

  const logsDir = path.join(folder, 'logs');
  fs.mkdirSync(logsDir, { recursive: true });

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

module.exports = { runLocalCrawler };
