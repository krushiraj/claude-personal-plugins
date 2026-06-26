'use strict';

// Pure core for the `log-acquire` step of the Crawler Fix Loop.
//
// S3 LOG SCHEME — DISCOVERY FINDINGS (2026-06-26)
// ------------------------------------------------
// Task brief said "full crawler logs live in S3". I searched both codebases for
// a concrete upload scheme:
//   grep -rniE 's3|putObject|upload.*log|crawl.?log|requestId|logBucket' \
//        shared/src guru/server
//   plus: '.amazonaws.com', 'BUCKET', 'crawlerLog', 'uploadLog', 'collectedLogs'.
//
// What exists:
//   - The crawler can COLLECT logs in-process: `crawlOptions.collectLogs` makes
//     the FetchClient accumulate `collectedLogs` (shared/src/crawler/FetchClient,
//     Crawler.ts, index.ts), returned on the crawl result.
//   - Those logs can be REPLAYED locally from a hand-supplied `logs.json` via
//     `yarn crawler:debug:replay <logs.json>` (shared/scripts/debugCrawlerReplay.ts).
//   - The only S3 host references are unrelated (PDF rewrites, attachment sync).
//
// What does NOT exist (anywhere I could find): a bucket name + key pattern that
// the production crawler uploads its per-crawl logs to, and any requestId/url
// indexing for them. There is no discoverable "crawler log bucket".
//
// DECISION: the S3 backend is a documented STUB. `s3KeyFor` still builds a
// deterministic best-guess key (so if/when a bucket+scheme is wired up, the
// shell can try `aws s3 cp`), but the shell treats S3 as "always a MISS" unless
// the env var CRAWLER_LOG_BUCKET is set AND the `aws` CLI succeeds. In practice
// we always fall back to re-running the crawler locally, which IS the full log.

const crypto = require('crypto');

// Deterministic short hash of the crawl identity.
function hash12(s) {
  return crypto.createHash('sha1').update(String(s)).digest('hex').slice(0, 12);
}

// Best-guess S3 key for a case's crawler logs. Deterministic and pure.
// Shape: crawler-logs/<build>/<sha1(publisherUrl||url)>.json
// `build` is included verbatim (callers assert on it); the identity is hashed so
// the key is filesystem/url safe regardless of the source URL.
function s3KeyFor(caseObj) {
  const c = caseObj || {};
  const build = c.build || 'unknown-build';
  const identity = c.publisherUrl || c.url || '';
  return `crawler-logs/${build}/${hash12(identity)}.json`;
}

// Choose which backend to read logs from. S3 when available, else local re-run.
function pickBackend({ s3Available }) {
  return s3Available ? 's3' : 'local';
}

module.exports = { s3KeyFor, pickBackend };
