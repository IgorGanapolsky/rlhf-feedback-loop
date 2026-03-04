// tests/feedback-schema.test.js
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { parseTimestamp } = require('../scripts/feedback-schema');

test('parseTimestamp: Z-suffix returns valid Date', () => {
  const d = parseTimestamp('2026-03-04T12:00:00.000Z');
  assert.ok(d instanceof Date, 'should be a Date');
  assert.ok(!isNaN(d.getTime()), 'should not be NaN');
});

test('parseTimestamp: no-suffix (Python-stripped) returns valid Date', () => {
  const d = parseTimestamp('2026-03-04T12:00:00');
  assert.ok(d instanceof Date, 'should be a Date');
  assert.ok(!isNaN(d.getTime()), 'no-suffix should not be NaN');
});

test('parseTimestamp: UTC offset returns valid Date', () => {
  const d = parseTimestamp('2026-03-04T12:00:00+05:00');
  assert.ok(d instanceof Date, 'should be a Date');
  assert.ok(!isNaN(d.getTime()), 'offset should not be NaN');
});

test('parseTimestamp: null returns null', () => {
  assert.strictEqual(parseTimestamp(null), null);
});

test('parseTimestamp: undefined returns null', () => {
  assert.strictEqual(parseTimestamp(undefined), null);
});

test('parseTimestamp: garbage string returns null', () => {
  assert.strictEqual(parseTimestamp('garbage'), null);
  assert.strictEqual(parseTimestamp('not-a-date'), null);
});
