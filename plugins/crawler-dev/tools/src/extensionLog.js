'use strict';

// Pure core for intaking REAL extension-uploaded pdf-crawl-log JSON files
// (ops export: `<USERID>_pdf-crawl-log_<YYYYMMDDTHHMMSSZ>.json`).
//
// These files are directly consumable by `yarn crawler:debug:replay` in the
// shared repo, so a case built here can be re-diagnosed OFFLINE (see
// bin/log-acquire.js's 'attached' -> 'replay' backend). Every field may be
// missing in the wild (real exports lack doi/title/inputUrls/pubUrls at
// times) — parseExtensionLog must never throw.

const { isPublisherHost, hostOf } = require('./urls');

// The extension's own verdict -> taxonomy error class. CRAWLER_FAILED (and
// anything unrecognized) is NOT a verdict — it needs deeper classification
// from the replay log, so it maps to null.
const VERDICTS = {
  ACCESS_RESTRICTED: 'access-restricted', // paywall / no entitlement
  PROXY_LOGGED_OUT: 'proxy-logged-out', // proxy session expired
  BLOCKED: 'blocked-paywall',
  SITE_NOT_SUPPORTED: 'site-not-supported',
};

function extensionVerdict(errorMsg) {
  return (typeof errorMsg === 'string'
    && Object.prototype.hasOwnProperty.call(VERDICTS, errorMsg)
    && VERDICTS[errorMsg]) || null;
}

// `<USERID>_pdf-crawl-log_<YYYYMMDDTHHMMSSZ>.json` -> { userId, reportedAt }
// (reportedAt as an ISO 8601 string), or null when the name doesn't match.
function parseLogFilename(name) {
  const base = String(name == null ? '' : name).split('/').pop();
  const m = /^(.+)_pdf-crawl-log_(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z\.json$/.exec(base);
  if (!m) return null;
  const [, userId, y, mo, d, h, mi, s] = m;
  return { userId, reportedAt: `${y}-${mo}-${d}T${h}:${mi}:${s}Z` };
}

function asArray(v) {
  return Array.isArray(v) ? v : [];
}

// parseExtensionLog(json, meta) -> case object (same downstream shape as
// src/intake.js's parseReport). `meta` optionally carries filename-derived
// context: { userId, reportedAt, sourceFile }.
function parseExtensionLog(json, meta) {
  const j = json && typeof json === 'object' ? json : {};
  const m = meta && typeof meta === 'object' ? meta : {};

  const publisherInputs = asArray(j.inputUrls && j.inputUrls.publisher);
  const processed = asArray(j.processedUrls);
  const pubUrls = asArray(j.pubUrls);

  // The final URL the original crawl reached (useful when every candidate is
  // a doi.org resolver link).
  const finalUrl = processed.length ? processed[processed.length - 1] : undefined;

  // Prefer the first REAL publisher input (not doi.org/dx.doi.org/ncbi), then
  // the final processed URL, then the first pubUrls entry.
  const publisherUrl =
    publisherInputs.find((u) => isPublisherHost(hostOf(u))) || finalUrl || pubUrls[0];

  const domain = hostOf(publisherUrl);

  return {
    // These are pdf-crawl-logs: always a PDF crawl.
    mode: 'PDF',
    doi: j.doi,
    title: j.title,
    errorMsg: j.errorMsg,
    blockedUrl: j.blockedUrl,
    source: j.source,
    publisherUrl,
    finalUrl,
    domain,
    slug: domain ? `${domain}-pdf` : undefined,
    userId: m.userId,
    reportedAt: m.reportedAt,
    sourceFile: m.sourceFile,
  };
}

module.exports = { parseExtensionLog, extensionVerdict, parseLogFilename };
