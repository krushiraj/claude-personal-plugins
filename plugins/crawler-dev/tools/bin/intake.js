#!/usr/bin/env node
'use strict';

// report-intake CLI shell.
//
// Builds a "case" folder under <tools>/cases/ from one of:
//   --url  <u>            minimal case from a publisher/PDF URL
//   --doi  <d>            minimal case from a DOI (url -> https://doi.org/<d>)
//   --page <notionId>     fetch the Notion crawler-report row and parse it
//
// Optional: --mode PDF|META  (default PDF; ignored for --page, which carries its own).

const path = require('path');
const fs = require('fs');
const { execFileSync } = require('child_process');
const { parseReport } = require('../src/intake');
const { writeCase } = require('../src/caseFile');
const { parsePageStdout } = require('../src/parsePageStdout');

const CASES_DIR = path.join(__dirname, '..', 'cases');

const USAGE = `Usage:
  node bin/intake.js --url <publisherUrl> [--mode PDF|META]
  node bin/intake.js --doi <doi> [--mode PDF|META]
  node bin/intake.js --page <notionPageId>`;

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

function normalizeMode(mode) {
  const m = (mode && String(mode).toUpperCase()) || 'PDF';
  return m === 'META' ? 'META' : 'PDF';
}

function caseFromUrl(url, mode) {
  const m = normalizeMode(mode);
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
function caseFromPage(pageId) {
  const script = path.join(
    __dirname, '..', '..', '..', 'notion-cards', 'scripts', 'fetch-card-content.sh'
  );
  const token = notionToken();
  const stdout = execFileSync('bash', [script, token, pageId], {
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
  });

  const page = parsePageStdout(stdout);
  const caseObj = parseReport(page);

  // Notion returns an error body with HTTP 200 for a bad id, so parsing
  // "succeeds" into an empty case. Reject anything lacking the essentials.
  if (!caseObj.mode && !caseObj.expectedPub && !caseObj.url && !caseObj.publisherUrl) {
    throw new Error(
      `could not parse Notion page ${pageId} (no mode/url/publication found — bad id or not a crawler-report row?)`
    );
  }

  caseObj.status = caseObj.status || 'intake';
  return caseObj;
}

function main() {
  const args = parseArgs(process.argv.slice(2));

  let caseObj;
  if (args.url && typeof args.url === 'string') {
    caseObj = caseFromUrl(args.url, args.mode);
  } else if (args.doi && typeof args.doi === 'string') {
    caseObj = caseFromDoi(args.doi, args.mode);
  } else if (args.page && typeof args.page === 'string') {
    caseObj = caseFromPage(args.page);
  } else {
    console.error('Error: provide one of --url, --doi, or --page.\n');
    console.error(USAGE);
    process.exit(1);
  }

  const folder = writeCase(CASES_DIR, caseObj);
  console.log(`Created: ${folder}`);
  console.log(
    `  ${caseObj.slug || '(no slug)'} | mode=${caseObj.mode} | ${caseObj.publisherUrl || caseObj.url || ''}`
  );
}

main();
