'use strict';

// I/O shell for the Crawler Fix Loop case folder.
//
// A "case" is a folder <baseDir>/<YYYY-MM-DD>-<slug>/ containing:
//   case.json  - the full machine-readable case object
//   case.md    - a short human-readable summary
//
// Downstream tools (log-acquire, classify, triage) read/update this folder.

const fs = require('fs');
const path = require('path');

function today() {
  return new Date().toISOString().slice(0, 10);
}

// A filesystem-safe folder name even when slug is missing/odd.
function safeName(caseObj) {
  const raw = (caseObj && caseObj.slug)
    || `unknown-${(caseObj && caseObj.mode && String(caseObj.mode).toLowerCase()) || 'case'}`;
  return String(raw).replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'unknown-case';
}

function renderMd(caseObj) {
  const c = caseObj || {};
  const lines = [];
  lines.push(`# ${c.slug || safeName(c)}`);
  lines.push('');
  if (c.url) lines.push(`- **url**: ${c.url}`);
  if (c.publisherUrl) lines.push(`- **publisherUrl**: ${c.publisherUrl}`);
  if (c.mode) lines.push(`- **mode**: ${c.mode}`);
  if (c.env) lines.push(`- **env**: ${c.env}`);
  lines.push(`- **proxyUsed**: ${!!c.proxyUsed}`);
  if (c.doi) lines.push(`- **doi**: ${c.doi}`);
  lines.push(`- **status**: ${c.status || 'intake'}`);
  if (c.expectedPub && c.expectedPub.title) {
    lines.push(`- **expectedPub.title**: ${c.expectedPub.title}`);
  }
  lines.push('');
  return lines.join('\n');
}

// Create the case folder, write case.json + case.md, return the folder path.
function writeCase(baseDir, caseObj) {
  const folderName = `${today()}-${safeName(caseObj)}`;
  const folder = path.join(baseDir, folderName);
  fs.mkdirSync(folder, { recursive: true });
  fs.writeFileSync(path.join(folder, 'case.json'), JSON.stringify(caseObj, null, 2) + '\n');
  fs.writeFileSync(path.join(folder, 'case.md'), renderMd(caseObj));
  return folder;
}

// Parse and return <folder>/case.json.
function readCase(folder) {
  return JSON.parse(fs.readFileSync(path.join(folder, 'case.json'), 'utf8'));
}

module.exports = { writeCase, readCase };
