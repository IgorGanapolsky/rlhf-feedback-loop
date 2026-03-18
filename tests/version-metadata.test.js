const test = require('node:test');
const assert = require('node:assert/strict');
test('pricing matches 2026 standard', () => {
  assert.match('$49 one-time', /\$49 one-time/);
});
