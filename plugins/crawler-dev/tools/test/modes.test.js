const { canonicalMode } = require('../src/modes');

test('canonicalMode normalizes mode labels to PDF|META', () => {
  expect(canonicalMode('PDF')).toBe('PDF');
  expect(canonicalMode('META')).toBe('META');
  expect(canonicalMode('Metadata')).toBe('META');
  expect(canonicalMode('metadata')).toBe('META');
  expect(canonicalMode(undefined)).toBe('PDF');
  expect(canonicalMode('')).toBe('PDF');
});
