'use strict';

const { s3KeyFor, pickBackend } = require('../src/logAcquire');

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
