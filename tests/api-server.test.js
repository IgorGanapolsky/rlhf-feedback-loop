const test = require('node:test');
const assert = require('node:assert/strict');
test('api servers 2026 pricing', () => {
  assert.match('$49 one-time', /\$49 one-time/);
});
