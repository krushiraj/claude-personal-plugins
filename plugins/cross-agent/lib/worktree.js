'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

function git(cwd, ...args) {
  return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

// Worktrees branch from HEAD, so uncommitted changes in the main tree are not visible to the agent.
function createWorktree(repoDir, label, baseDir) {
  const root = git(repoDir, 'rev-parse', '--show-toplevel').trim();
  const id = `${label}-${Date.now().toString(36)}`;
  const dir = path.join(baseDir, `wt-${id}`);
  const branch = `xa/${id}`;
  git(root, 'worktree', 'add', '-q', '-b', branch, dir, 'HEAD');
  return { dir, branch, root };
}

// Stage everything and write the diff against HEAD. Returns true when the agent changed anything.
function captureDiff(wt, patchPath) {
  git(wt.dir, 'add', '-A');
  const diff = git(wt.dir, 'diff', '--cached', '--binary', 'HEAD');
  fs.writeFileSync(patchPath, diff);
  return diff.length > 0;
}

// Undo a failed attempt so the next fallback agent starts from a clean tree.
function resetWorktree(wt) {
  git(wt.dir, 'reset', '--hard', '-q', 'HEAD');
  git(wt.dir, 'clean', '-fdq');
}

function cleanupCommand(wt) {
  return `git -C ${JSON.stringify(wt.root)} worktree remove --force ${JSON.stringify(wt.dir)} && git -C ${JSON.stringify(wt.root)} branch -D ${wt.branch}`;
}

function statusSnapshot(cwd) {
  try {
    return git(cwd, 'status', '--porcelain');
  } catch (_) {
    return null;
  }
}

module.exports = { createWorktree, captureDiff, resetWorktree, cleanupCommand, statusSnapshot };
