const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const SUBWAY_ROOT = path.join(__dirname, '..', '..', '..', '..', 'Subway_RN_Demo');
const hasSubway = fs.existsSync(SUBWAY_ROOT);

test('subway-upgrades proof script exits 0', { skip: !hasSubway && 'Subway_RN_Demo repo not present' }, () => {
  const result = spawnSync('node', ['scripts/prove-subway-upgrades.js'], {
    cwd: path.join(__dirname, '..'),
    encoding: 'utf-8',
    timeout: 120000,
  });
  assert.equal(result.status, 0, `proof failed: ${(result.stderr || '').slice(-500)}`);
});
