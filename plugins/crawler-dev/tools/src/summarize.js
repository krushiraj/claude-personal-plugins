'use strict';

// Pure summary line for a sweep. Counts UNIQUE created folders (a sweep may
// write several reports into the same idempotent folder), so the reported
// count matches what actually exists on disk.
function summarize(createdFolders, skipped, total, status) {
  const unique = new Set(createdFolders || []).size;
  const label = status ? `${status} ` : '';
  return `Swept ${total} ${label}reports -> ${unique} cases written, ${skipped} skipped`;
}

module.exports = { summarize };
