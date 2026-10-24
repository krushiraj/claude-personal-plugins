'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { validate, parseAgent, mergeConfig, loadConfig } = require('../lib/config');
const { loadAdapters, buildArgv } = require('../lib/adapters');

const names = ['codex', 'agy', 'opencode', 'claude'];
const good = () => ({
  version: 1,
  roles: { plan: { access: 'read', agents: ['claude:opus', 'codex:gpt-6-sol'] } },
});

test('valid config passes', () => {
  assert.deepStrictEqual(validate(good(), names), []);
});

test('rejects bad access, effort, agent spec and unknown adapter', () => {
  const cfg = good();
  cfg.roles.plan.access = 'rw';
  cfg.roles.plan.effort = 'turbo';
  cfg.roles.plan.agents = ['nocolon', 'ghost:model'];
  const errors = validate(cfg, names).join('\n');
  assert.match(errors, /access must be/);
  assert.match(errors, /effort must be/);
  assert.match(errors, /expected "adapter:model"/);
  assert.match(errors, /unknown adapter "ghost"/);
});

test('model part may contain colons and dots', () => {
  assert.deepStrictEqual(parseAgent('opencode:provider/model:v1.2'), {
    spec: 'opencode:provider/model:v1.2', adapter: 'opencode', model: 'provider/model:v1.2',
  });
});

test('local config overrides per role field and can add roles', () => {
  const merged = mergeConfig(good(), {
    roles: { plan: { agents: ['agy:default'] }, extra: { access: 'read', agents: ['claude:haiku'] } },
  });
  assert.deepStrictEqual(merged.roles.plan.agents, ['agy:default']);
  assert.strictEqual(merged.roles.plan.access, 'read');
  assert.ok(merged.roles.extra);
});

test('loadConfig walks up to the nearest config and reports invalid JSON', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'xa-cfg-'));
  fs.mkdirSync(path.join(root, 'a', 'b'), { recursive: true });
  fs.writeFileSync(path.join(root, '.cross-agent.json'), JSON.stringify(good()));
  assert.strictEqual(loadConfig(path.join(root, 'a', 'b'), names).dir, fs.realpathSync(root) === root ? root : root);
  fs.writeFileSync(path.join(root, '.cross-agent.json'), '{ nope');
  assert.throws(() => loadConfig(root, names), /invalid JSON/);
  assert.throws(() => loadConfig(os.tmpdir() + '/definitely-no-config-here', names), /no \.cross-agent\.json/);
});

test('argv per adapter matches the headless invocations verified in the spike', () => {
  const a = loadAdapters();
  const vars = { cwd: '/w', outfile: '/o', prompt: 'hi' };
  assert.deepStrictEqual(
    buildArgv(a.codex, { ...vars, access: 'read', model: 'gpt-6-luna' }).args,
    ['exec', '-C', '/w', '-o', '/o', '-s', 'read-only', '-m', 'gpt-6-luna', 'hi'],
  );
  assert.deepStrictEqual(
    buildArgv(a.agy, { ...vars, access: 'read', model: 'gemini-3.8-flash-high' }).args,
    ['--mode', 'plan', '--model', 'gemini-3.8-flash-high', '-p', 'hi'],
  );
  assert.deepStrictEqual(
    buildArgv(a.opencode, { ...vars, access: 'write', model: 'default' }).args,
    ['run', '--dir', '/w', 'hi'],
  );
  assert.deepStrictEqual(
    buildArgv(a.claude, { ...vars, access: 'write', model: 'sonnet', effort: 'low' }).args,
    ['-p', '--permission-mode', 'acceptEdits', '--model', 'sonnet', '--effort', 'low', 'hi'],
  );
});

test('prompt is always the last argument (agy takes the token after -p)', () => {
  const a = loadAdapters();
  for (const ad of Object.values(a)) {
    const { args } = buildArgv(ad, { access: 'read', model: 'm', effort: 'high', cwd: '/w', outfile: '/o', prompt: 'THE PROMPT' });
    assert.strictEqual(args[args.length - 1], 'THE PROMPT', ad.name);
  }
});
