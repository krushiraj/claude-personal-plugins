'use strict';

const fs = require('fs');
const path = require('path');

const CONFIG_NAME = '.cross-agent.json';
const LOCAL_NAME = '.cross-agent.local.json';
const ACCESS = ['read', 'write'];
const EFFORT = ['low', 'medium', 'high', 'xhigh', 'max'];

function readJson(file) {
  let text;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch (err) {
    if (err.code === 'ENOENT') return null;
    throw err;
  }
  try {
    return JSON.parse(text);
  } catch (err) {
    throw new Error(`${file}: invalid JSON (${err.message})`);
  }
}

// Walk up from `start` to find the nearest directory containing the config.
function findConfigDir(start) {
  let dir = path.resolve(start);
  for (;;) {
    if (fs.existsSync(path.join(dir, CONFIG_NAME))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

function parseAgent(spec) {
  const i = typeof spec === 'string' ? spec.indexOf(':') : -1;
  if (i < 1 || i === spec.length - 1) {
    throw new Error(`invalid agent "${spec}", expected "adapter:model" (use "adapter:default" for the CLI default)`);
  }
  return { spec, adapter: spec.slice(0, i), model: spec.slice(i + 1) };
}

// Local file overrides committed file per role, field by field. New roles may be added locally.
function mergeConfig(base, local) {
  if (!local) return base;
  const roles = { ...base.roles };
  for (const [name, override] of Object.entries(local.roles || {})) {
    roles[name] = { ...(roles[name] || {}), ...override };
  }
  return { ...base, roles };
}

function validate(cfg, adapterNames) {
  const errors = [];
  if (!cfg || typeof cfg !== 'object') return ['config must be a JSON object'];
  if (cfg.version !== 1) errors.push('"version" must be 1');
  if (!cfg.roles || typeof cfg.roles !== 'object' || !Object.keys(cfg.roles).length) {
    errors.push('"roles" must be a non-empty object');
    return errors;
  }
  for (const [name, role] of Object.entries(cfg.roles)) {
    const at = `roles.${name}`;
    if (!ACCESS.includes(role.access)) errors.push(`${at}.access must be one of ${ACCESS.join('|')}`);
    if (role.effort !== undefined && !EFFORT.includes(role.effort)) {
      errors.push(`${at}.effort must be one of ${EFFORT.join('|')}`);
    }
    if (role.isolate !== undefined && role.isolate !== 'worktree') errors.push(`${at}.isolate must be "worktree"`);
    if (!Array.isArray(role.agents) || !role.agents.length) {
      errors.push(`${at}.agents must be a non-empty array`);
      continue;
    }
    for (const spec of role.agents) {
      try {
        const { adapter } = parseAgent(spec);
        if (adapterNames && !adapterNames.includes(adapter)) {
          errors.push(`${at}.agents: unknown adapter "${adapter}" in "${spec}" (known: ${adapterNames.join(', ')})`);
        }
      } catch (err) {
        errors.push(`${at}.agents: ${err.message}`);
      }
    }
  }
  return errors;
}

function loadConfig(startDir, adapterNames) {
  const dir = findConfigDir(startDir);
  if (!dir) throw new Error(`no ${CONFIG_NAME} found at or above ${startDir}`);
  const merged = mergeConfig(readJson(path.join(dir, CONFIG_NAME)), readJson(path.join(dir, LOCAL_NAME)));
  const errors = validate(merged, adapterNames);
  if (errors.length) throw new Error(`invalid cross-agent config in ${dir}:\n- ${errors.join('\n- ')}`);
  return { dir, config: merged };
}

module.exports = { CONFIG_NAME, LOCAL_NAME, findConfigDir, parseAgent, mergeConfig, validate, loadConfig };
