const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

test('loop-closure proof script exits 0', () => {
  const result = spawnSync('node', ['scripts/prove-loop-closure.js'], {
    cwd: path.join(__dirname, '..'),
    encoding: 'utf-8',
    timeout: 120000,
  });
  assert.equal(result.status, 0, `proof failed: ${(result.stderr || '').slice(-500)}`);
});
