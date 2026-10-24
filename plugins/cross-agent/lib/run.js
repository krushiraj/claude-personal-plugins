'use strict';

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { parseAgent } = require('./config');
const { buildArgv } = require('./adapters');
const { resolveBin } = require('./health');
const wtree = require('./worktree');

const EXIT_ALL_FAILED = 3;

// macOS has no `timeout`, so enforce it here: SIGTERM, then SIGKILL after a grace period.
// The agent runs in its own process group so grandchildren (servers, shells) die with it and cannot
// keep our pipes open; after the kill we stop waiting for `close` and resolve anyway.
function spawnAgent({ bin, args, cwd, timeoutMs, env }) {
  return new Promise((resolve) => {
    const child = spawn(bin, args, { cwd, env, stdio: ['ignore', 'pipe', 'pipe'], detached: true });
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    let done = false;
    const finish = (code, extra = '') => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      resolve({ code, stdout, stderr: stderr + extra, timedOut });
    };
    const killGroup = (sig) => {
      try { process.kill(-child.pid, sig); } catch (_) { /* already gone */ }
    };
    child.stdout.on('data', (d) => { stdout += d; });
    child.stderr.on('data', (d) => { stderr += d; });
    const timer = setTimeout(() => {
      timedOut = true;
      killGroup('SIGTERM');
      setTimeout(() => { killGroup('SIGKILL'); finish(null); }, 2000);
    }, timeoutMs);
    child.on('error', (err) => finish(null, err.message));
    child.on('close', (code) => { killGroup('SIGKILL'); finish(code); });
  });
}

function classifyFailure(res, timeoutMs) {
  if (res.timedOut) return `timed out after ${Math.round(timeoutMs / 1000)}s`;
  const text = `${res.stderr}\n${res.stdout}`;
  if (/model_not_found|not supported when using|model .*(does not exist|not found|unavailable)/i.test(text)) {
    return 'model not available on this account/plan';
  }
  if (/rate.?limit|quota|usage limit|\b429\b|too many requests/i.test(text)) return 'rate limited or quota exhausted';
  if (/not logged in|unauthori[sz]ed|\b401\b|authenticat|please log ?in|login required/i.test(text)) {
    return 'not authenticated';
  }
  const lastLine = text.split('\n').map((l) => l.trim()).filter(Boolean).pop() || 'no output';
  return `exit ${res.code}: ${lastLine.slice(0, 200)}`;
}

function buildNotice(attempts, used) {
  const skipped = attempts.map((a) => `${a.agent} (${a.reason})`);
  if (!skipped.length) return null;
  return used
    ? `Fell back: ${skipped.join('; ')} -> used ${used}`
    : `All configured agents failed: ${skipped.join('; ')}`;
}

async function dispatch({ role, prompt, cwd, config, adapters, outDir, timeoutMs = 600000, env = process.env }) {
  const r = config.roles[role];
  if (!r) throw new Error(`unknown role "${role}" (known: ${Object.keys(config.roles).join(', ')})`);
  fs.mkdirSync(outDir, { recursive: true });

  const wt = r.access === 'write' && r.isolate === 'worktree' ? wtree.createWorktree(cwd, role, outDir) : null;
  const workdir = wt ? wt.dir : cwd;
  const attempts = [];
  const base = { role, access: r.access };
  // Some CLIs resolve the git project root instead of honouring cwd and write outside the worktree.
  const mainBefore = wt ? wtree.statusSnapshot(wt.root) : null;
  const escapeWarning = () => (wt && mainBefore !== null && wtree.statusSnapshot(wt.root) !== mainBefore
    ? 'The main working tree changed while the agent ran in an isolated worktree; the agent may have written outside it. Inspect with git status.'
    : undefined);

  for (const spec of r.agents) {
    const { adapter: name, model } = parseAgent(spec);
    const adapter = adapters[name];
    if (!adapter) { attempts.push({ agent: spec, status: 'skipped', reason: `unknown adapter "${name}"` }); continue; }
    const bin = resolveBin(adapter.bin, env.PATH);
    if (!bin) { attempts.push({ agent: spec, status: 'skipped', reason: `${adapter.bin} CLI not found on PATH` }); continue; }

    const outfile = path.join(outDir, `${role}-attempt${attempts.length}.out`);
    const { args } = buildArgv(adapter, { access: r.access, model, effort: r.effort, cwd: workdir, outfile, prompt });
    const guardReadOnly = r.access === 'read' && !adapter.enforcesReadOnly;
    const before = guardReadOnly ? wtree.statusSnapshot(workdir) : null;

    const res = await spawnAgent({ bin, args, cwd: workdir, timeoutMs, env });
    const text = adapter.result === 'outfile' && fs.existsSync(outfile)
      ? fs.readFileSync(outfile, 'utf8')
      : res.stdout;

    if (res.code === 0 && text.trim()) {
      const resultPath = path.join(outDir, `${role}-result.md`);
      fs.writeFileSync(resultPath, text);
      const out = {
        ...base, ok: true, exitCode: 0, agent: spec, fellBack: attempts.length > 0, attempts,
        notice: buildNotice(attempts, spec), resultPath,
      };
      if (guardReadOnly && before !== null && wtree.statusSnapshot(workdir) !== before) {
        out.warning = `${adapter.name} cannot enforce read-only; the working tree changed during a read role. Inspect with git status.`;
      }
      const escaped = escapeWarning();
      if (escaped) out.warning = [out.warning, escaped].filter(Boolean).join(' ');
      if (wt) {
        const patchPath = path.join(outDir, `${role}.patch`);
        out.worktree = {
          dir: wt.dir, branch: wt.branch, patchPath,
          changed: wtree.captureDiff(wt, patchPath), cleanup: wtree.cleanupCommand(wt),
        };
      }
      return out;
    }

    attempts.push({ agent: spec, status: 'failed', reason: classifyFailure(res, timeoutMs) });
    if (wt) wtree.resetWorktree(wt);
  }

  return {
    ...base, ok: false, exitCode: EXIT_ALL_FAILED, agent: null, fellBack: true, attempts,
    notice: buildNotice(attempts, null),
    nextStep: 'Spawn a native Claude subagent for this role.',
    warning: escapeWarning(),
    worktree: wt ? { dir: wt.dir, branch: wt.branch, cleanup: wtree.cleanupCommand(wt) } : undefined,
  };
}

module.exports = { dispatch, spawnAgent, classifyFailure, EXIT_ALL_FAILED };
