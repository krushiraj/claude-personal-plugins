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
const crypto = require('crypto');

function today() {
  return new Date().toISOString().slice(0, 10);
}

// A filesystem-safe folder name even when slug is missing/odd.
function safeName(caseObj) {
  const raw = (caseObj && caseObj.slug)
    || `unknown-${(caseObj && caseObj.mode && String(caseObj.mode).toLowerCase()) || 'case'}`;
  return String(raw).replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'unknown-case';
}

// Folder name: <date>-<slug>-<hash8>. The slug clusters by publisher+mode, but
// distinct reports sharing a slug must not collide, so we append an 8-hex sha1
// of the most specific identity on the case. Same identity -> same folder
// (idempotent / correct dedup); different identity -> different folder. With no
// identity available, fall back to the plain <date>-<slug> name.
function folderName(caseObj) {
  const base = `${today()}-${safeName(caseObj)}`;
  const identity = (caseObj && (caseObj.doi || caseObj.publisherUrl || caseObj.url)) || '';
  if (!identity) return base;
  const hash8 = crypto.createHash('sha1').update(String(identity)).digest('hex').slice(0, 8);
  return `${base}-${hash8}`;
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

// Write case.json + case.md into an EXISTING/known folder, in place. Use this
// to update a case you already located (e.g. log-acquire persisting results) so
// the write lands exactly where you read from — never a date-recomputed folder.
function updateCase(folder, caseObj) {
  fs.mkdirSync(folder, { recursive: true });
  fs.writeFileSync(path.join(folder, 'case.json'), JSON.stringify(caseObj, null, 2) + '\n');
  fs.writeFileSync(path.join(folder, 'case.md'), renderMd(caseObj));
  return folder;
}

// Mint a case folder under baseDir from the case identity (intake), then write.
function writeCase(baseDir, caseObj) {
  return updateCase(path.join(baseDir, folderName(caseObj)), caseObj);
}

// Parse and return <folder>/case.json.
function readCase(folder) {
  return JSON.parse(fs.readFileSync(path.join(folder, 'case.json'), 'utf8'));
}

module.exports = { writeCase, updateCase, readCase };
