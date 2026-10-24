'use strict';

const fs = require('fs');
const path = require('path');

// Resolve a binary the way a spawn would (PATH scan), ignoring shell functions and aliases.
function resolveBin(bin, envPath = process.env.PATH || '') {
  const candidates = bin.includes('/')
    ? [bin]
    : envPath.split(path.delimiter).filter(Boolean).map((d) => path.join(d, bin));
  for (const c of candidates) {
    try {
      fs.accessSync(c, fs.constants.X_OK);
      if (fs.statSync(c).isFile()) return c;
    } catch (_) {
      // not here
    }
  }
  return null;
}

module.exports = { resolveBin };
