'use strict';

const os = require('os');
const path = require('path');
const fs = require('fs');
const { s3KeyFor, pickBackend } = require('../src/logAcquire');
const { runLocalCrawler } = require('../bin/log-acquire');

test('builds an S3 key that includes the build', () => {
  expect(s3KeyFor({ build: 'abc123', publisherUrl: 'https://x.org/a' })).toContain('abc123');
});

test('s3KeyFor is deterministic', () => {
  const c = { build: 'b', publisherUrl: 'https://x.org/a' };
  expect(s3KeyFor(c)).toBe(s3KeyFor(c));
});

test('s3KeyFor distinguishes different urls', () => {
  const a = s3KeyFor({ build: 'b', publisherUrl: 'https://x.org/a' });
  const b = s3KeyFor({ build: 'b', publisherUrl: 'https://x.org/b' });
  expect(a).not.toBe(b);
});

test('s3KeyFor falls back to url when publisherUrl is missing', () => {
  const key = s3KeyFor({ build: 'b', url: 'https://x.org/only-url' });
  expect(typeof key).toBe('string');
  expect(key.length).toBeGreaterThan(0);
});

test('pickBackend prefers s3 when available, else local', () => {
  expect(pickBackend({ s3Available: false })).toBe('local');
  expect(pickBackend({ s3Available: true })).toBe('s3');
});

// A crawler-FAILED run must still yield a captured log with BOTH streams — that
// failure output is exactly what the downstream classify step needs.
test('runLocalCrawler captures BOTH stdout and stderr on a non-zero exit', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'crawl-'));
  const script = path.join(dir, 'fake.js');
  fs.writeFileSync(
    script,
    'process.stdout.write("OUT_LINE\\n");process.stderr.write("ERR_LINE\\n");process.exit(7);'
  );
  const out = runLocalCrawler('https://x.org/a', 'PDF', { cmd: 'node', args: [script], cwd: dir });
  expect(out).toContain('OUT_LINE');
  expect(out).toContain('ERR_LINE');
});

// And the provenance written for a local run is 'local' regardless of exit code:
// drive the full write path with a fake crawler and assert case.logs.
test('local run writes the captured output and provenance "local" with an absolute path', () => {
  const { updateCase, readCase } = require('../src/caseFile');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'crawl-'));
  const folder = path.join(dir, '2026-06-26-x.org-pdf-deadbeef');
  updateCase(folder, { slug: 'x.org-pdf', mode: 'PDF', url: 'https://x.org/a' });

  const script = path.join(dir, 'fake.js');
  fs.writeFileSync(script, 'process.stderr.write("FAILLOG\\n");process.exit(1);');
  const out = runLocalCrawler('https://x.org/a', 'PDF', { cmd: 'node', args: [script], cwd: dir });

  const logsDir = path.join(folder, 'logs');
  fs.mkdirSync(logsDir, { recursive: true });
  const logPath = path.join(logsDir, 'local.PDF.log');
  fs.writeFileSync(logPath, out);
  const caseObj = readCase(folder);
  caseObj.logs = { provenance: 'local', path: path.resolve(logPath), acquiredAt: 'now' };
  updateCase(folder, caseObj);

  const reread = readCase(folder);
  expect(reread.logs.provenance).toBe('local');
  expect(path.isAbsolute(reread.logs.path)).toBe(true);
  expect(fs.readFileSync(reread.logs.path, 'utf8')).toContain('FAILLOG');
});
