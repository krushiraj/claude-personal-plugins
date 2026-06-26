const { summarize } = require('../src/summarize');

test('counts unique folders, not raw rows', () => {
  const created = ['/c/a', '/c/a', '/c/b']; // a duplicate folder
  expect(summarize(created, 1, 4, 'New')).toBe(
    'Swept 4 New reports -> 2 cases written, 1 skipped'
  );
});

test('handles empty created list', () => {
  expect(summarize([], 0, 0, 'New')).toBe('Swept 0 New reports -> 0 cases written, 0 skipped');
});

test('omits status label when not provided', () => {
  expect(summarize(['/c/a'], 0, 1)).toBe('Swept 1 reports -> 1 cases written, 0 skipped');
});
