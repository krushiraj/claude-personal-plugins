const os = require('os'); const path = require('path'); const fs = require('fs');
const { writeCase, readCase } = require('../src/caseFile');

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
