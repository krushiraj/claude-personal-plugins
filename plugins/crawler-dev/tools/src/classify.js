'use strict';

// Pure root-cause classifier for the Crawler Fix Loop (Task 5).
//
// classify(logText, ctx) maps a `yarn crawler:debug` log into a small
// root-cause taxonomy so triage can cluster failures by `domain + errorClass`
// and route each cluster to a known fix in skills/crawler-dev/tips.md.
//
// Input is treated as plain multiline text; we match on the markers the
// crawler actually prints (see the task brief + tips.md), case-insensitive
// where sensible. Pure: no fs/network/I-O. Defensive: empty/garbage -> unknown,
// never throws.
//
// THE RULES TABLE BELOW IS THE LIVING TAXONOMY.
// It is ordered and FIRST MATCH WINS. Each row maps to a tips.md section.
// `test(text, ctx)` returns the matched evidence line (string) when it fires,
// or a falsy value when it doesn't — so a rule both decides AND supplies its
// own evidence. To extend the taxonomy, add a row in priority order.

// Find the first line that matches `re` and return it trimmed (the evidence),
// or null. Keeps evidence anchored to a real log line the human can grep for.
function firstLine(text, re) {
  const lines = String(text).split('\n');
  for (const line of lines) {
    if (re.test(line)) return line.trim();
  }
  return null;
}

// Markers ------------------------------------------------------------------
const RE_RESULT_PDF = /Result PDF:/i;
const RE_RESULT_PUB = /Result Pub:/i;
// Access denied: explicit BLOCKED error, a populated blockedUrl, or HTTP 403/401.
const RE_BLOCKED = /\bBLOCKED\b/;
const RE_BLOCKED_URL = /blockedUrl:\s*'[^']+'/; // non-null blockedUrl
const RE_HTTP_DENIED = /\b(?:HTTP\s*)?(?:403|401)\b|forbidden|unauthorized|access[\s_-]?restricted|login[\s_-]?required|paywall/i;
// Referer-required: a 403/401 specifically while fetching a .pdf link.
const RE_PDF_DENIED = /(?:403|401|forbidden|unauthorized).{0,80}\.pdf|\.pdf.{0,80}(?:403|401|forbidden|unauthorized)/i;
// Network: transport-level failures (NOT http auth codes).
const RE_NETWORK = /FETCH_FAILED|aborted|timed?\s?out|timeout|ETIMEDOUT|ECONNRESET|ECONNREFUSED|ENOTFOUND|EAI_AGAIN|socket hang up|DNS|getaddrinfo/i;
// JS-rendered: content only appears after browser/JS execution.
const RE_JS = /\bSPA\b|Angular|<ds-app|JavaScript|dynamic:\s*true|rendered by (?:JavaScript|JS)|Just a moment|reCAPTCHA|Anubis|app shell/i;
// Selector-drift: page loaded but extraction returned nothing.
const RE_SELECTOR = /JqMeta.*(?:no|null|nothing|empty|failed|not found)|no citation_pdf_url|no pdf url|returned (?:nothing|null|no pdf)/i;
// DOI resolution failure (META).
const RE_DOI_FAIL = /Doi target (?:failed|returned)|DOI resolution|CrossRef returned no|DOI_RESOLUTION_FAILED|no record for 10\./i;

// Rules table — ordered, first match wins -----------------------------------
const RULES = [
  // tips.md "Default Converter Fails" / success path: a final Result line means
  // the crawl produced output; not a failure.
  {
    errorClass: 'success',
    siteKind: 'unknown',
    obtainable: (text) => ({
      pdf: RE_RESULT_PDF.test(text) ? true : null,
      // META success implies the publication (with its doi) resolved.
      doi: RE_RESULT_PUB.test(text) ? true : null,
      abstract: null,
    }),
    test: (text) => firstLine(text, RE_RESULT_PDF) || firstLine(text, RE_RESULT_PUB),
  },

  // tips.md "Referer Required": PDF link works in a browser but the crawler
  // gets 403/401 on the .pdf fetch -> needs `referer: true`. Checked BEFORE the
  // generic blocked/proxy rules because it is the more specific 403-on-pdf case.
  {
    errorClass: 'referer-required',
    siteKind: 'pdf-host',
    obtainable: { pdf: false, doi: null, abstract: null },
    test: (text) => firstLine(text, RE_PDF_DENIED),
  },

  // tips.md "Access Restricted Content" + Diagnosis Workflow (BLOCKED).
  // BLOCKED-vs-PROXY DECISION (access, not parsing):
  //   If access is denied AND ctx.proxyUsed === false, the crawler tried the
  //   bare (logged-out) request, so the failure is most likely just "needs
  //   institutional access" -> proxy-needed. This row is ordered ABOVE
  //   blocked-paywall, so proxy-off wins it; with proxy on (or unknown) we fall
  //   through to blocked-paywall (a genuine anti-bot/paywall block).
  {
    errorClass: 'proxy-needed',
    siteKind: 'publisher-html',
    obtainable: { pdf: false, doi: null, abstract: null },
    test: (text, ctx) =>
      ctx.proxyUsed === false &&
      (firstLine(text, RE_BLOCKED) ||
        firstLine(text, RE_BLOCKED_URL) ||
        firstLine(text, RE_HTTP_DENIED)),
  },

  // tips.md "Access Restricted Content" / Anubis / Cloudflare: a real block
  // (proxy was used, or unknown) — rarely fixable from our side.
  {
    errorClass: 'blocked-paywall',
    siteKind: 'publisher-html',
    obtainable: { pdf: false, doi: null, abstract: null },
    test: (text) =>
      firstLine(text, RE_BLOCKED) ||
      firstLine(text, RE_BLOCKED_URL) ||
      firstLine(text, RE_HTTP_DENIED),
  },

  // tips.md "Network Issues": transport-level failure (timeout/DNS/abort/ECONN).
  {
    errorClass: 'network',
    siteKind: 'unknown',
    obtainable: { pdf: null, doi: null, abstract: null },
    test: (text) => firstLine(text, RE_NETWORK),
  },

  // tips.md "PDF Behind JavaScript" / DSpace 7 SPA / Anubis: needs a browser.
  // Ordered before selector-drift: a JS shell is a more specific cause of
  // "extraction found nothing" than a stale selector.
  {
    errorClass: 'js-rendered',
    siteKind: 'js-app',
    obtainable: { pdf: null, doi: null, abstract: null },
    test: (text) => firstLine(text, RE_JS),
  },

  // tips.md "JqMeta Fails but PDF URL Exists": page loaded fine but the
  // extractor returned nothing -> selector/regex drift (a fixable parsing bug).
  {
    errorClass: 'selector-drift',
    siteKind: 'publisher-html',
    obtainable: { pdf: null, doi: null, abstract: null },
    test: (text) => firstLine(text, RE_SELECTOR),
  },

  // tips.md "DOI Resolution Fails": Doi target failed though a DOI exists.
  {
    errorClass: 'doi-resolution-fail',
    siteKind: 'publisher-html',
    obtainable: { pdf: null, doi: false, abstract: null },
    test: (text) => firstLine(text, RE_DOI_FAIL),
  },
];

const DEFAULT_OBTAINABLE = { pdf: null, doi: null, abstract: null };

// classify(logText, ctx) -> { errorClass, siteKind, obtainable, evidence }
function classify(logText, ctx) {
  const text = typeof logText === 'string' ? logText : '';
  const c = ctx && typeof ctx === 'object' ? ctx : {};

  for (const rule of RULES) {
    let evidence;
    try {
      evidence = rule.test(text, c);
    } catch (e) {
      evidence = null; // a buggy rule must never break classification
    }
    if (evidence) {
      const obtainable =
        typeof rule.obtainable === 'function'
          ? rule.obtainable(text, c)
          : rule.obtainable;
      return {
        errorClass: rule.errorClass,
        siteKind: rule.siteKind || 'unknown',
        obtainable: Object.assign({}, DEFAULT_OBTAINABLE, obtainable),
        evidence: typeof evidence === 'string' ? evidence : rule.errorClass,
      };
    }
  }

  return {
    errorClass: 'unknown',
    siteKind: 'unknown',
    obtainable: Object.assign({}, DEFAULT_OBTAINABLE),
    evidence: '',
  };
}

module.exports = { classify, RULES };
