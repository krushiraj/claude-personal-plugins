const os = require('os'); const path = require('path'); const fs = require('fs');
const { writeCase, updateCase, readCase } = require('../src/caseFile');

test('writes and reads back a case folder', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'case-'));
  const c = { slug: 'x.org-pdf', mode: 'PDF', status: 'intake', url: 'https://x.org/a' };
  const folder = writeCase(dir, c);
  expect(fs.existsSync(path.join(folder, 'case.json'))).toBe(true);
  expect(fs.existsSync(path.join(folder, 'case.md'))).toBe(true);
  expect(readCase(folder).slug).toBe('x.org-pdf');
});

test('does not throw when slug is missing', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'case-'));
  expect(() => writeCase(dir, { mode: 'META' })).not.toThrow();
});

test('same slug + different doi -> two distinct folders', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'case-'));
  const a = writeCase(dir, { slug: 'x.org-pdf', mode: 'PDF', doi: '10.1/aaa' });
  const b = writeCase(dir, { slug: 'x.org-pdf', mode: 'PDF', doi: '10.1/bbb' });
  expect(a).not.toBe(b);
  expect(fs.existsSync(path.join(a, 'case.json'))).toBe(true);
  expect(fs.existsSync(path.join(b, 'case.json'))).toBe(true);
});

test('same slug + same doi -> same folder (idempotent)', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'case-'));
  const a = writeCase(dir, { slug: 'x.org-pdf', mode: 'PDF', doi: '10.1/aaa' });
  const b = writeCase(dir, { slug: 'x.org-pdf', mode: 'PDF', doi: '10.1/aaa' });
  expect(a).toBe(b);
});
