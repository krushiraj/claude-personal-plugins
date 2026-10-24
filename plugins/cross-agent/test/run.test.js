'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { dispatch } = require('../lib/run');

const tmp = (p) => fs.mkdtempSync(path.join(os.tmpdir(), p));

// A fake CLI is a shell script; the last argv is the prompt, which the script can inspect.
function fakeCli(dir, name, body) {
  const file = path.join(dir, name);
  fs.writeFileSync(file, `#!/bin/sh\n${body}\n`, { mode: 0o755 });
  return file;
}

function adapter(name, bin, extra = {}) {
  return {
    name, bin, base: [], access: { read: [], write: [] }, model: ['--model', '{model}'],
    effort: [], prompt: ['{prompt}'], result: 'stdout', enforcesReadOnly: true, ...extra,
  };
}

function setup(roles, clis) {
  const bins = tmp('xa-bins-');
  const adapters = {};
  for (const [name, body] of Object.entries(clis)) {
    adapters[name] = adapter(name, fakeCli(bins, name, body));
  }
  return { adapters, config: { version: 1, roles }, cwd: tmp('xa-cwd-'), outDir: tmp('xa-out-') };
}

const run = (s, role, extra = {}) => dispatch({ role, prompt: 'do it', ...s, timeoutMs: 5000, ...extra });

test('first healthy agent wins, no fallback notice', async () => {
  const s = setup({ r: { access: 'read', agents: ['a:m'] } }, { a: 'echo ANSWER' });
  const out = await run(s, 'r');
  assert.strictEqual(out.ok, true);
  assert.strictEqual(out.fellBack, false);
  assert.strictEqual(out.notice, null);
  assert.match(fs.readFileSync(out.resultPath, 'utf8'), /ANSWER/);
});

test('model_not_found falls back and the notice names the agent and reason', async () => {
  const s = setup(
    { r: { access: 'read', agents: ['a:sol', 'b:luna'] } },
    { a: 'echo \'{"code":"model_not_found"}\' >&2; exit 1', b: 'echo FROM-B' },
  );
  const out = await run(s, 'r');
  assert.strictEqual(out.ok, true);
  assert.strictEqual(out.agent, 'b:luna');
  assert.strictEqual(out.fellBack, true);
  assert.match(out.notice, /a:sol \(model not available on this account\/plan\)/);
  assert.match(out.notice, /used b:luna/);
});

test('missing CLI is skipped with a reason', async () => {
  const s = setup({ r: { access: 'read', agents: ['ghost:m', 'b:m'] } }, { b: 'echo OK' });
  s.adapters.ghost = adapter('ghost', 'definitely-not-a-real-binary-xyz');
  const out = await run(s, 'r');
  assert.strictEqual(out.agent, 'b:m');
  assert.match(out.notice, /CLI not found on PATH/);
});

test('rate limit and auth failures are classified', async () => {
  const s = setup(
    { r: { access: 'read', agents: ['a:m', 'b:m', 'c:m'] } },
    { a: 'echo "429 Too Many Requests" >&2; exit 1', b: 'echo "Please log in" >&2; exit 1', c: 'echo ok' },
  );
  const out = await run(s, 'r');
  assert.match(out.notice, /rate limited or quota exhausted/);
  assert.match(out.notice, /not authenticated/);
});

test('empty output counts as failure', async () => {
  const s = setup({ r: { access: 'read', agents: ['a:m', 'b:m'] } }, { a: 'exit 0', b: 'echo hi' });
  const out = await run(s, 'r');
  assert.strictEqual(out.agent, 'b:m');
});

test('timeout kills the agent and falls back', async () => {
  const s = setup({ r: { access: 'read', agents: ['a:m', 'b:m'] } }, { a: 'sleep 30', b: 'echo hi' });
  const out = await run(s, 'r', { timeoutMs: 300 });
  assert.strictEqual(out.agent, 'b:m');
  assert.match(out.notice, /timed out/);
});

test('timeout still resolves when a grandchild keeps the output pipes open', async () => {
  // The shell exits on SIGTERM but the backgrounded sleep would hold stdout for 30s.
  const s = setup(
    { r: { access: 'read', agents: ['a:m', 'b:m'] } },
    { a: 'sleep 30 & wait', b: 'echo hi' },
  );
  const started = Date.now();
  const out = await run(s, 'r', { timeoutMs: 300 });
  assert.strictEqual(out.agent, 'b:m');
  assert.ok(Date.now() - started < 8000, 'must not wait for the grandchild');
});

test('warns when an agent writes to the main tree instead of its worktree', async () => {
  const repo = gitRepo();
  // Simulates a CLI that resolves the git project root: it writes into the main tree, not its cwd.
  const s = setup(
    { w: { access: 'write', isolate: 'worktree', agents: ['a:m'] } },
    { a: `echo leaked > "${repo}/leak.txt"; echo done` },
  );
  s.cwd = repo;
  const out = await run(s, 'w');
  assert.strictEqual(out.ok, true);
  assert.match(out.warning, /main working tree changed/);
});

test('all agents failing returns exit 3 and tells the skill to use a native subagent', async () => {
  const s = setup({ r: { access: 'read', agents: ['a:m'] } }, { a: 'exit 7' });
  const out = await run(s, 'r');
  assert.strictEqual(out.ok, false);
  assert.strictEqual(out.exitCode, 3);
  assert.match(out.notice, /All configured agents failed/);
  assert.match(out.nextStep, /native Claude subagent/);
});

test('unknown role throws with known roles listed', async () => {
  const s = setup({ r: { access: 'read', agents: ['a:m'] } }, { a: 'echo hi' });
  await assert.rejects(run(s, 'nope'), /unknown role "nope" \(known: r\)/);
});

test('read role on an adapter that cannot enforce read-only warns when files change', async () => {
  const s = setup({ r: { access: 'read', agents: ['a:m'] } }, { a: 'echo x > touched.txt; echo done' });
  s.adapters.a.enforcesReadOnly = false;
  execFileSync('git', ['init', '-q'], { cwd: s.cwd });
  const out = await run(s, 'r');
  assert.strictEqual(out.ok, true);
  assert.match(out.warning, /cannot enforce read-only/);
});

function gitRepo() {
  const cwd = tmp('xa-repo-');
  const git = (...a) => execFileSync('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', ...a], { cwd });
  git('init', '-q');
  fs.writeFileSync(path.join(cwd, 'a.txt'), 'one\n');
  git('add', '.');
  git('commit', '-qm', 'init');
  return cwd;
}

test('write role with worktree isolation leaves the main tree untouched and returns a patch', async () => {
  const s = setup(
    { w: { access: 'write', isolate: 'worktree', agents: ['a:m'] } },
    { a: 'echo two > new.txt; echo wrote' },
  );
  s.cwd = gitRepo();
  const out = await run(s, 'w');
  assert.strictEqual(out.ok, true);
  assert.strictEqual(out.worktree.changed, true);
  assert.ok(!fs.existsSync(path.join(s.cwd, 'new.txt')), 'main tree must be untouched');
  assert.match(fs.readFileSync(out.worktree.patchPath, 'utf8'), /\+two/);
  execFileSync('git', ['apply', '--check', out.worktree.patchPath], { cwd: s.cwd });
});

test('failed write attempt is reset before the fallback agent runs', async () => {
  const s = setup(
    { w: { access: 'write', isolate: 'worktree', agents: ['a:m', 'b:m'] } },
    { a: 'echo junk > junk.txt; exit 1', b: 'echo ok > good.txt; echo done' },
  );
  s.cwd = gitRepo();
  const out = await run(s, 'w');
  const patch = fs.readFileSync(out.worktree.patchPath, 'utf8');
  assert.match(patch, /good\.txt/);
  assert.doesNotMatch(patch, /junk\.txt/);
});
