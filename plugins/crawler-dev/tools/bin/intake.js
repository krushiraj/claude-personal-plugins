#!/usr/bin/env node
'use strict';

// report-intake CLI shell.
//
// Builds a "case" folder under <tools>/cases/ from one of:
//   --url  <u>            minimal case from a publisher/PDF URL
//   --doi  <d>            minimal case from a DOI (url -> https://doi.org/<d>)
//   --page <notionId>     fetch the Notion crawler-report row and parse it
//   --sweep-new [status]  intake every report row in the given status (default New)
//                         supports --limit N to cap how many rows are processed
//   --log-file <path>     one case from one REAL extension pdf-crawl-log JSON;
//                         the source JSON is COPIED into <case>/logs/attached.json
//                         so log-acquire can replay it offline
//   --logs-dir <dir>      sweep a directory of *_pdf-crawl-log_*.json exports
//                         (supports --limit N; per-file resilient)
//
// Optional: --mode PDF|META  (default PDF; ignored for --page, which carries its own).

const path = require('path');
const fs = require('fs');
const { execFileSync } = require('child_process');
const { parseReport } = require('../src/intake');
const { parseExtensionLog, parseLogFilename } = require('../src/extensionLog');
const { writeCase, updateCase } = require('../src/caseFile');
const { parsePageStdout } = require('../src/parsePageStdout');
const { parseReportRows } = require('../src/fetchReports');
const { summarize } = require('../src/summarize');
const { canonicalMode } = require('../src/modes');

const CASES_DIR = path.join(__dirname, '..', 'cases');
const REPORTS_DB_ID = '0e0cafa5-d636-4e04-a6f3-07abf7e6b653';

const USAGE = `Usage:
  node bin/intake.js --url <publisherUrl> [--mode PDF|META]
  node bin/intake.js --doi <doi> [--mode PDF|META]
  node bin/intake.js --page <notionPageId>
  node bin/intake.js --sweep-new [status] [--limit N]
  node bin/intake.js --log-file <pdfCrawlLog.json>
  node bin/intake.js --logs-dir <dir> [--limit N]`;

// Tiny flag parser: --key value pairs into a plain object.
function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith('--')) {
        out[key] = true;
      } else {
        out[key] = next;
        i++;
      }
    }
  }
  return out;
}

function hostOf(url) {
  try {
    return new URL(url).hostname;
  } catch (e) {
    return undefined;
  }
}

function caseFromUrl(url, mode) {
  const m = canonicalMode(mode);
  const domain = hostOf(url);
  return {
    url,
    publisherUrl: url,
    domain,
    mode: m,
    slug: domain ? `${domain}-${m.toLowerCase()}` : undefined,
    status: 'intake',
  };
}

function caseFromDoi(doi, mode) {
  const url = `https://doi.org/${doi}`;
  const c = caseFromUrl(url, mode);
  c.doi = doi;
  return c;
}

// Read the Notion token from the local notion-cards settings file.
function notionToken() {
  const file = path.join(process.env.HOME || '', '.claude', 'notion-cards.local.md');
  const text = fs.readFileSync(file, 'utf8');
  const line = text.split('\n').find((l) => l.includes('notion_token'));
  if (!line) throw new Error(`notion_token not found in ${file}`);
  return line.replace(/.*:\s*/, '').trim().replace(/^["']|["']$/g, '');
}

// Fetch a Notion row via the shared script and shape it for parseReport.
// Accepts an optional pre-read token so a sweep need not re-read the settings
// file once per row.
function caseFromPage(pageId, token) {
  const script = path.join(
    __dirname, '..', '..', '..', 'notion-cards', 'scripts', 'fetch-card-content.sh'
  );
  const tok = token || notionToken();
  const stdout = execFileSync('bash', [script, tok, pageId], {
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
  });

  const page = parsePageStdout(stdout);
  const caseObj = parseReport(page);

  // Notion returns an error body with HTTP 200 for a bad id, so parsing
  // "succeeds" into an empty case. Reject anything lacking the essentials.
  // (mode is always canonicalized to a non-empty token now, so it is no longer
  // a signal of emptiness — rely on url/publisherUrl/publication.)
  if (!caseObj.expectedPub && !caseObj.url && !caseObj.publisherUrl) {
    throw new Error(
      `could not parse Notion page ${pageId} (no url/publication found — bad id or not a crawler-report row?)`
    );
  }

  caseObj.status = caseObj.status || 'intake';
  return caseObj;
}

// Fetch + parse a single Notion report row and write its case folder.
// Shared by --page and --sweep-new. Returns { folder, caseObj }.
function intakePage(pageId, token) {
  const caseObj = caseFromPage(pageId, token);
  const folder = writeCase(CASES_DIR, caseObj);
  return { folder, caseObj };
}

// Print the "Created:" summary for a single case.
function printCreated(folder, caseObj) {
  console.log(`Created: ${folder}`);
  console.log(
    `  ${caseObj.slug || '(no slug)'} | mode=${caseObj.mode} | ${caseObj.publisherUrl || caseObj.url || ''}`
  );
}

// Query the reports DB for rows in the given status and return [{ id }].
// Warns (but does not fail) when the result was truncated at one page.
function fetchReportRows(status, token) {
  const script = path.join(__dirname, 'fetch-reports.sh');
  const stdout = execFileSync('bash', [script, token, REPORTS_DB_ID, status], {
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
  });
  const data = JSON.parse(stdout);
  if (data && data.has_more === true) {
    console.error(
      `warning: more than 100 ${status} reports exist; only the first page was fetched`
    );
  }
  return parseReportRows(data);
}

// Intake every report row in the given status, resilient to per-row failures.
// limit (>0) caps how many rows are processed.
function sweep(status, limit) {
  const token = notionToken();
  let rows = fetchReportRows(status, token);
  if (limit > 0) rows = rows.slice(0, limit);
  const created = [];
  let skipped = 0;

  for (const row of rows) {
    try {
      const { folder } = intakePage(row.id, token);
      created.push(folder);
    } catch (err) {
      skipped++;
      console.error(`skip ${row.id}: ${(err && err.message) || err}`);
    }
  }

  console.log(summarize(created, skipped, rows.length, status));
  for (const folder of [...new Set(created)]) console.log(`  ${folder}`);
}

// Ops export filename pattern for extension crawl logs.
const LOG_FILE_RE = /_pdf-crawl-log_.*\.json$/;

// Parse one extension pdf-crawl-log JSON into a case object (pure-ish: reads
// the file, delegates shaping to src/extensionLog).
function caseFromLogFile(file) {
  const abs = path.resolve(file);
  const json = JSON.parse(fs.readFileSync(abs, 'utf8'));
  const meta = Object.assign({ sourceFile: abs }, parseLogFilename(abs) || {});
  const caseObj = parseExtensionLog(json, meta);
  caseObj.status = caseObj.status || 'intake';
  return caseObj;
}

// Intake one extension log: write the case folder, COPY the source JSON in as
// logs/attached.json, and record 'attached' provenance so log-acquire replays
// it offline instead of running a live crawl. `baseDir` injectable for tests.
function intakeLogFile(file, baseDir) {
  const abs = path.resolve(file);
  const caseObj = caseFromLogFile(abs);
  const folder = writeCase(baseDir || CASES_DIR, caseObj);

  const logsDir = path.join(folder, 'logs');
  fs.mkdirSync(logsDir, { recursive: true });
  const attached = path.join(logsDir, 'attached.json');
  fs.copyFileSync(abs, attached);

  caseObj.logs = {
    provenance: 'attached',
    path: path.resolve(attached),
    acquiredAt: new Date().toISOString(),
  };
  updateCase(folder, caseObj);
  return { folder, caseObj };
}

// Sweep a directory of *_pdf-crawl-log_*.json exports, resilient per file.
// Prints the same summary + indented-folders shape as the Notion sweep so
// bin/triage.js can capture the created folders.
function sweepLogsDir(dir, limit) {
  let files = fs
    .readdirSync(dir)
    .filter((f) => LOG_FILE_RE.test(f))
    .sort()
    .map((f) => path.join(dir, f));
  if (limit > 0) files = files.slice(0, limit);

  const created = [];
  let skipped = 0;
  for (const file of files) {
    try {
      const { folder } = intakeLogFile(file);
      created.push(folder);
    } catch (err) {
      skipped++;
      console.error(`skip ${path.basename(file)}: ${(err && err.message) || err}`);
    }
  }

  console.log(summarize(created, skipped, files.length, 'extension-log'));
  for (const folder of [...new Set(created)]) console.log(`  ${folder}`);
}

function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args['logs-dir'] && typeof args['logs-dir'] === 'string') {
    const limit = typeof args.limit === 'string' ? parseInt(args.limit, 10) : 0;
    sweepLogsDir(args['logs-dir'], limit);
    return;
  }

  if (args['log-file'] && typeof args['log-file'] === 'string') {
    const { folder, caseObj } = intakeLogFile(args['log-file']);
    printCreated(folder, caseObj);
    return;
  }

  if (args['sweep-new']) {
    const status = typeof args['sweep-new'] === 'string' ? args['sweep-new'] : 'New';
    const limit = typeof args.limit === 'string' ? parseInt(args.limit, 10) : 0;
    sweep(status, limit);
    return;
  }

  let caseObj;
  if (args.url && typeof args.url === 'string') {
    caseObj = caseFromUrl(args.url, args.mode);
  } else if (args.doi && typeof args.doi === 'string') {
    caseObj = caseFromDoi(args.doi, args.mode);
  } else if (args.page && typeof args.page === 'string') {
    const { folder, caseObj: pageCase } = intakePage(args.page);
    printCreated(folder, pageCase);
    return;
  } else {
    console.error('Error: provide one of --url, --doi, --page, or --sweep-new.\n');
    console.error(USAGE);
    process.exit(1);
  }

  const folder = writeCase(CASES_DIR, caseObj);
  printCreated(folder, caseObj);
}

if (require.main === module) {
  try {
    main();
  } catch (err) {
    console.error(`Error: ${(err && err.message) || err}`);
    process.exit(1);
  }
}

module.exports = { caseFromUrl, caseFromDoi, parseArgs };
