'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { caseFromLogFile, intakeLogFile } = require('../bin/intake');
const { readCase } = require('../src/caseFile');

const FIXTURE = path.join(__dirname, 'fixtures', 'extension-log.json');

// Stage the fixture under a realistic ops-export filename in a temp dir.
function stagedLogFile() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ext-logs-'));
  const file = path.join(dir, '37CF486C062F11E5AF7A2FE6BF9F7527_pdf-crawl-log_20260624T120329Z.json');
  fs.copyFileSync(FIXTURE, file);
  return file;
}

test('caseFromLogFile parses the JSON and the filename meta', () => {
  const c = caseFromLogFile(stagedLogFile());
  expect(c.mode).toBe('PDF');
  expect(c.doi).toBe('10.1159/000347069');
  expect(c.errorMsg).toBe('CRAWLER_FAILED');
  expect(c.slug).toBe('www.karger.com-pdf');
  expect(c.userId).toBe('37CF486C062F11E5AF7A2FE6BF9F7527');
  expect(c.reportedAt).toBe('2026-06-24T12:03:29Z');
  expect(path.isAbsolute(c.sourceFile)).toBe(true);
  expect(c.status).toBe('intake');
});

test('intakeLogFile copies the source JSON as logs/attached.json with attached provenance', () => {
  const src = stagedLogFile();
  const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ext-cases-'));
  const { folder, caseObj } = intakeLogFile(src, baseDir);

  const attached = path.join(folder, 'logs', 'attached.json');
  expect(fs.existsSync(attached)).toBe(true);
  // byte-identical copy — the replay input must be the REAL upload
  expect(fs.readFileSync(attached, 'utf8')).toBe(fs.readFileSync(src, 'utf8'));

  expect(caseObj.logs.provenance).toBe('attached');
  expect(caseObj.logs.path).toBe(path.resolve(attached));
  expect(caseObj.logs.acquiredAt).toBeTruthy();

  // and it was persisted onto disk
  const reread = readCase(folder);
  expect(reread.logs.provenance).toBe('attached');
  expect(reread.errorMsg).toBe('CRAWLER_FAILED');
});
