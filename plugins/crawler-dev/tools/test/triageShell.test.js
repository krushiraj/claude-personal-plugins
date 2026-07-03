const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  parseArgs,
  resolveLimit,
  parseCreatedFolders,
  triageOne,
  triageFolders,
  DEFAULT_LIMIT,
} = require('../bin/triage');
const { updateCase, readCase } = require('../src/caseFile');

// Build a throwaway case folder on disk and return its path.
function tmpCase(fields) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'triage-case-'));
  updateCase(dir, fields);
  return dir;
}

// Write a throwaway log file and return its absolute path.
function tmpLog(text) {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'triage-log-')), 'crawl.log');
  fs.writeFileSync(file, text);
  return file;
}

const BLOCKED_LOG = "errors: [ 'BLOCKED' ],\n";

describe('parseArgs', () => {
  test('captures --limit value', () => {
    expect(parseArgs(['--limit', '3']).limit).toBe('3');
  });
  test('--limit abc keeps the raw (invalid) string for resolveLimit to reject', () => {
    expect(parseArgs(['--limit', 'abc']).limit).toBe('abc');
  });
  test('bare --limit (no value) is a true flag', () => {
    expect(parseArgs(['--limit']).limit).toBe(true);
  });
  test('--skip-sweep is a boolean flag', () => {
    expect(parseArgs(['--skip-sweep'])['skip-sweep']).toBe(true);
  });
});

describe('resolveLimit (cost guard must never be disabled by bad input)', () => {
  test('valid positive int passes through', () => {
    expect(resolveLimit('3')).toBe(3);
  });
  test('--limit abc -> DEFAULT_LIMIT', () => {
    expect(resolveLimit('abc')).toBe(DEFAULT_LIMIT);
  });
  test('bare --limit (true) -> DEFAULT_LIMIT', () => {
    expect(resolveLimit(true)).toBe(DEFAULT_LIMIT);
  });
  test('missing (undefined) -> DEFAULT_LIMIT', () => {
    expect(resolveLimit(undefined)).toBe(DEFAULT_LIMIT);
  });
  test('--limit 0 is rejected -> DEFAULT_LIMIT (keeps the cap on)', () => {
    expect(resolveLimit('0')).toBe(DEFAULT_LIMIT);
  });
  test('negative -> DEFAULT_LIMIT', () => {
    expect(resolveLimit('-3')).toBe(DEFAULT_LIMIT);
  });
});

describe('parseCreatedFolders', () => {
  test('extracts indented absolute folder paths the sweep created', () => {
    const a = tmpCase({ slug: 'a', domain: 'a.com' });
    const b = tmpCase({ slug: 'b', domain: 'b.com' });
    const stdout = `Swept 2 New reports -> 2 cases written, 0 skipped\n  ${a}\n  ${b}\n`;
    expect(parseCreatedFolders(stdout)).toEqual([a, b]);
  });
  test('ignores the summary line and de-dupes', () => {
    const a = tmpCase({ slug: 'a', domain: 'a.com' });
    const stdout = `  ${a}\n  ${a}\n`;
    expect(parseCreatedFolders(stdout)).toEqual([a]);
  });
});

describe('triageOne', () => {
  test('does NOT re-acquire when case.logs already present', () => {
    const logFile = tmpLog(BLOCKED_LOG);
    const dir = tmpCase({
      slug: 'has-logs',
      domain: 'a.com',
      mode: 'PDF',
      proxyUsed: true,
      logs: { provenance: 'local', path: logFile },
    });
    const acquire = jest.fn();
    const result = triageOne(dir, { acquire });
    expect(acquire).not.toHaveBeenCalled();
    expect(result.diagnosis.errorClass).toBe('blocked-paywall');
    // and it was persisted to disk
    expect(readCase(dir).diagnosis.errorClass).toBe('blocked-paywall');
  });

  test('acquires (via injected fn) when logs are missing, then classifies', () => {
    const logFile = tmpLog(BLOCKED_LOG);
    const dir = tmpCase({ slug: 'no-logs', domain: 'b.com', mode: 'PDF', proxyUsed: false });
    const acquire = jest.fn((folder) => {
      // emulate log-acquire writing logs onto the case
      const c = readCase(folder);
      c.logs = { provenance: 'local', path: logFile };
      updateCase(folder, c);
    });
    const result = triageOne(dir, { acquire });
    expect(acquire).toHaveBeenCalledTimes(1);
    expect(result.diagnosis).toBeDefined();
    // proxyUsed:false + blocked evidence -> proxy-needed
    expect(result.diagnosis.errorClass).toBe('proxy-needed');
  });
});

describe('triageOne (extension-log cases)', () => {
  test('attached provenance is NOT a crawl log: acquire runs (replay) before classify', () => {
    const attached = tmpLog('{"collectedLogs":[]}');
    const replayLog = tmpLog("Crawler failed: { errors: [ 'CRAWLER_FAILED' ], blockedUrl: null }\n[error] FETCH_FAILED: The URL does not point to a valid PDF file");
    const dir = tmpCase({
      slug: 'ext',
      domain: 'x.org',
      mode: 'PDF',
      errorMsg: 'CRAWLER_FAILED',
      logs: { provenance: 'attached', path: attached },
    });
    const acquire = jest.fn((folder) => {
      const c = readCase(folder);
      c.logs = { provenance: 'replay', path: replayLog, attachedPath: attached };
      updateCase(folder, c);
    });
    const result = triageOne(dir, { acquire });
    expect(acquire).toHaveBeenCalledTimes(1);
    // CRAWLER_FAILED verdict is null -> classified from the REPLAY log text
    expect(result.diagnosis.errorClass).toBe('pdf-url-not-pdf');
  });

  test('a non-null extension verdict is authoritative over the log text', () => {
    const replayLog = tmpLog('Result PDF: /tmp/x.pdf'); // would classify success
    const dir = tmpCase({
      slug: 'ext-blocked',
      domain: 'x.org',
      mode: 'PDF',
      errorMsg: 'ACCESS_RESTRICTED',
      logs: { provenance: 'replay', path: replayLog },
    });
    const result = triageOne(dir, { acquire: jest.fn() });
    expect(result.diagnosis.errorClass).toBe('access-restricted');
    expect(result.diagnosis.evidence).toBe('extension verdict: ACCESS_RESTRICTED');
  });
});

describe('triageFolders (resilience)', () => {
  test('a throwing case is skipped and the loop continues to the next', () => {
    const goodLog = tmpLog(BLOCKED_LOG);
    const bad = tmpCase({ slug: 'bad', domain: 'bad.com', mode: 'PDF' }); // no logs
    const good = tmpCase({
      slug: 'good',
      domain: 'good.com',
      mode: 'PDF',
      proxyUsed: true,
      logs: { provenance: 'local', path: goodLog },
    });
    // acquire throws -> only fires for the logs-less `bad` case.
    const acquire = jest.fn(() => {
      throw new Error('crawl timed out');
    });
    const { cases, skipped } = triageFolders([bad, good], { acquire });
    expect(skipped).toBe(1);
    expect(cases).toHaveLength(1);
    expect(cases[0].domain).toBe('good.com');
    expect(cases[0].folder).toBe(path.basename(good));
  });
});
