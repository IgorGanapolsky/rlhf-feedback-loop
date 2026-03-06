const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const SUBWAY_ROOT = path.join(__dirname, '..', '..', '..', '..', 'Subway_RN_Demo');
const subwayPrereqs = [
  path.join(SUBWAY_ROOT, '.claude', 'scripts', 'feedback', 'vector-store.js'),
  path.join(SUBWAY_ROOT, '.claude', 'scripts', 'feedback', 'dpo-optimizer.js'),
  path.join(SUBWAY_ROOT, '.claude', 'scripts', 'feedback', 'thompson-sampling.js'),
  path.join(SUBWAY_ROOT, '.github', 'workflows', 'self-healing-monitor.yml'),
  path.join(SUBWAY_ROOT, '.github', 'workflows', 'self-healing-auto-fix.yml'),
  path.join(SUBWAY_ROOT, 'jest.governance.config.js'),
];
const isSubwayReady = subwayPrereqs.every((p) => fs.existsSync(p));

test(
  'subway-upgrades proof script exits 0',
  { skip: !isSubwayReady && 'Subway_RN_Demo phase-11 artifacts not present in local environment' },
  () => {
  const result = spawnSync('node', ['scripts/prove-subway-upgrades.js'], {
    cwd: path.join(__dirname, '..'),
    encoding: 'utf-8',
    timeout: 120000,
  });
  assert.equal(result.status, 0, `proof failed: ${(result.stderr || '').slice(-500)}`);
  }
);
