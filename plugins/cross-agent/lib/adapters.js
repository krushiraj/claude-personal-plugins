'use strict';

const fs = require('fs');
const path = require('path');

const DEFAULT_DIR = path.join(__dirname, '..', 'adapters');

function loadAdapters(dir = DEFAULT_DIR) {
  const out = {};
  for (const file of fs.readdirSync(dir)) {
    if (!file.endsWith('.json')) continue;
    const def = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
    out[def.name] = def;
  }
  return out;
}

function fill(parts, vars) {
  return parts.map((p) => p.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m)));
}

// Order matters: some CLIs (agy) take the token after `-p` as the prompt, so the prompt goes last.
function buildArgv(adapter, { access, model, effort, cwd, outfile, prompt }) {
  const vars = { model, effort, cwd, outfile, prompt };
  const args = [
    ...fill(adapter.base, vars),
    ...fill(adapter.access[access] || [], vars),
  ];
  if (model && model !== 'default') args.push(...fill(adapter.model, vars));
  if (effort) args.push(...fill(adapter.effort, vars));
  args.push(...fill(adapter.prompt, vars));
  return { bin: adapter.bin, args };
}

module.exports = { loadAdapters, buildArgv, DEFAULT_DIR };
