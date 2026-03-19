'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

function isSourceCheckout(pkgRoot) {
  return fs.existsSync(path.join(pkgRoot, '.git'));
}

function parseWorktreePaths(raw) {
  return String(raw || '')
    .split('\n')
    .filter((line) => line.startsWith('worktree '))
    .map((line) => line.slice('worktree '.length).trim())
    .filter(Boolean);
}

function resolveStableSourceRoot(pkgRoot) {
  if (!isSourceCheckout(pkgRoot)) {
    return null;
  }

  try {
    const output = execFileSync('git', ['-C', pkgRoot, 'worktree', 'list', '--porcelain'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    const worktreePaths = parseWorktreePaths(output);

    for (const worktreePath of worktreePaths) {
      const gitPath = path.join(worktreePath, '.git');
      if (!fs.existsSync(gitPath)) {
        continue;
      }
      if (fs.statSync(gitPath).isDirectory()) {
        return worktreePath;
      }
    }
  } catch (_) {
    return pkgRoot;
  }

  return pkgRoot;
}

function resolveLocalServerPath(pkgRoot, scope = 'project') {
  const baseRoot = scope === 'home' ? resolveStableSourceRoot(pkgRoot) || pkgRoot : pkgRoot;
  return path.join(baseRoot, 'adapters', 'mcp', 'server-stdio.js');
}

function portableMcpEntry(pkgVersion) {
  return {
    command: 'npx',
    args: ['-y', `mcp-memory-gateway@${pkgVersion}`, 'serve'],
  };
}

function localMcpEntry(pkgRoot, scope = 'project') {
  return {
    command: 'node',
    args: [resolveLocalServerPath(pkgRoot, scope)],
  };
}

function resolveMcpEntry({ pkgRoot, pkgVersion, scope = 'project' }) {
  if (!isSourceCheckout(pkgRoot)) {
    return portableMcpEntry(pkgVersion);
  }
  return localMcpEntry(pkgRoot, scope);
}

module.exports = {
  isSourceCheckout,
  localMcpEntry,
  parseWorktreePaths,
  portableMcpEntry,
  resolveLocalServerPath,
  resolveMcpEntry,
  resolveStableSourceRoot,
};
