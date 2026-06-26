'use strict';

// Pure triage core for the Crawler Fix Loop (Task 6).
//
// Once cases are classified (case.diagnosis.errorClass), triage clusters them by
// `domain + errorClass` so a single fix can close many cases ("fix once, close
// many"). The two exports are pure (no fs/network) and defensive: missing
// domain/diagnosis -> 'unknown', never throws.

const UNKNOWN = 'unknown';

function domainOf(caseObj) {
  return (caseObj && caseObj.domain) || UNKNOWN;
}

function errorClassOf(caseObj) {
  return (caseObj && caseObj.diagnosis && caseObj.diagnosis.errorClass) || UNKNOWN;
}

// A representative human-readable identifier for a case (for the Example column).
function exampleOf(caseObj) {
  const c = caseObj || {};
  return c.publisherUrl || c.url || c.doi || c.slug || c.folder || '';
}

// clusterCases(cases) -> [{ key, domain, errorClass, count, mode, cases:[...] }]
// Grouped by `${domain}|${errorClass}`, sorted by count DESC then key ASC.
function clusterCases(cases) {
  const list = Array.isArray(cases) ? cases : [];
  const byKey = new Map();

  for (const caseObj of list) {
    const domain = domainOf(caseObj);
    const errorClass = errorClassOf(caseObj);
    const key = `${domain}|${errorClass}`;
    let cluster = byKey.get(key);
    if (!cluster) {
      cluster = {
        key,
        domain,
        errorClass,
        count: 0,
        // The mode of the first member; clusters are domain+errorClass scoped so
        // members usually share a mode, but it's a representative hint either way.
        mode: (caseObj && caseObj.mode) || UNKNOWN,
        cases: [],
      };
      byKey.set(key, cluster);
    }
    cluster.count += 1;
    cluster.cases.push(caseObj);
  }

  return [...byKey.values()].sort(
    (a, b) => b.count - a.count || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0)
  );
}

// Escape a cell value so a stray '|' doesn't break the markdown table.
function cell(value) {
  return String(value == null ? '' : value).replace(/\|/g, '\\|');
}

// The representative diagnosis for a cluster (its first member's).
function repDiagnosis(cluster) {
  const first = cluster && cluster.cases && cluster.cases[0];
  return (first && first.diagnosis) || {};
}

// Compact "what can we still get?" hint from a diagnosis's obtainable map, e.g.
// `pdf:false`. Drops null/undefined fields; all-unknown -> '-'.
function obtainableHint(diag) {
  const o = diag && diag.obtainable;
  if (!o || typeof o !== 'object') return '-';
  const parts = Object.keys(o)
    .filter((k) => o[k] !== null && o[k] !== undefined)
    .map((k) => `${k}:${o[k]}`);
  return parts.length ? parts.join(' ') : '-';
}

// A short inline evidence snippet (backticks stripped so it can't break the md).
function evidenceSnippet(diag) {
  const ev = diag && diag.evidence;
  if (!ev) return '';
  return String(ev).replace(/`/g, '').replace(/\s+/g, ' ').trim().slice(0, 120);
}

// A member label for the cluster-members list: folder name preferred, then a
// stable identifier, so the user can act on every case in the cluster.
function memberLabel(caseObj) {
  const c = caseObj || {};
  return c.folder || c.slug || exampleOf(c) || '(case)';
}

const MAX_MEMBERS_SHOWN = 8;

// renderBoard(clusters) -> markdown triage board string. The table is the
// at-a-glance "fix once, close many" view; the per-cluster members section below
// it carries the actionable payload (every member + an obtainable/evidence hint).
function renderBoard(clusters) {
  const list = Array.isArray(clusters) ? clusters : [];
  const totalCases = list.reduce((sum, c) => sum + (c.count || 0), 0);
  const totalClusters = list.length;

  // Already sorted by clusterCases, but render is robust if handed raw clusters.
  const sorted = [...list].sort(
    (a, b) => (b.count || 0) - (a.count || 0) || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0)
  );

  const lines = [];
  lines.push('# Crawler Triage Board');
  lines.push('');
  lines.push(`${totalCases} cases in ${totalClusters} clusters (fix once, close many).`);
  lines.push('');
  lines.push('| Count | Domain | Error Class | Mode | Obtainable | Example |');
  lines.push('| ----- | ------ | ----------- | ---- | ---------- | ------- |');
  for (const c of sorted) {
    const example = exampleOf((c.cases && c.cases[0]) || {});
    lines.push(
      `| ${cell(c.count)} | ${cell(c.domain)} | ${cell(c.errorClass)} | ${cell(c.mode)} | ${cell(obtainableHint(repDiagnosis(c)))} | ${cell(example)} |`
    );
  }
  lines.push('');

  if (sorted.length) {
    lines.push('## Cluster members');
    lines.push('');
    for (const c of sorted) {
      const diag = repDiagnosis(c);
      const ev = evidenceSnippet(diag);
      lines.push(
        `- **${c.key}** (${c.count}) — obtainable ${obtainableHint(diag)}` +
          (ev ? ` — evidence: \`${ev}\`` : '')
      );
      const members = (c.cases || []).map(memberLabel);
      const shown = members.slice(0, MAX_MEMBERS_SHOWN);
      const more = members.length > shown.length ? ` (+${members.length - shown.length} more)` : '';
      lines.push(`  - ${shown.join(', ')}${more}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

module.exports = { clusterCases, renderBoard };
