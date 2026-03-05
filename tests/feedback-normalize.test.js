const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');

const SCRIPT = path.join(__dirname, '..', '.claude', 'scripts', 'feedback', 'capture-feedback.js');

function run(feedbackValue) {
  return spawnSync('node', [SCRIPT, `--feedback=${feedbackValue}`, '--context=fuzzy-test'], {
    encoding: 'utf-8',
    timeout: 10000,
    cwd: path.join(__dirname, '..'),
  });
}

// Exit 0 = promoted, exit 2 = captured but not promoted (rubric gate).
// Exit 1 = normalize failed (unrecognized input).
// We test normalize by asserting status !== 1.

// Exact matches
test('normalize: "up" accepted', () => {
  assert.notEqual(run('up').status, 1);
});

test('normalize: "down" accepted', () => {
  assert.notEqual(run('down').status, 1);
});

test('normalize: "thumbsup" accepted', () => {
  assert.notEqual(run('thumbsup').status, 1);
});

test('normalize: "thumbsdown" accepted', () => {
  assert.notEqual(run('thumbsdown').status, 1);
});

test('normalize: "positive" -> up', () => {
  assert.notEqual(run('positive').status, 1);
});

test('normalize: "negative" -> down', () => {
  assert.notEqual(run('negative').status, 1);
});

// Misspell variants — fuzzy match (edit distance <= 2)
test('normalize: "thubs up" -> up (missing h)', () => {
  assert.notEqual(run('thubs up').status, 1);
});

test('normalize: "thumbs u" -> up (missing p)', () => {
  assert.notEqual(run('thumbs u').status, 1);
});

test('normalize: "thumb down" -> down (missing s)', () => {
  assert.notEqual(run('thumb down').status, 1);
});

test('normalize: "thumps up" -> up (p instead of b)', () => {
  assert.notEqual(run('thumps up').status, 1);
});

test('normalize: "thumbs dwon" -> down (transposed wo)', () => {
  assert.notEqual(run('thumbs dwon').status, 1);
});

test('normalize: "thumbs donw" -> down (transposed nw)', () => {
  assert.notEqual(run('thumbs donw').status, 1);
});

// Garbage input should fail (exit 1)
test('normalize: "banana" rejected', () => {
  assert.equal(run('banana').status, 1);
});

test('normalize: "xyz" rejected', () => {
  assert.equal(run('xyz').status, 1);
});
