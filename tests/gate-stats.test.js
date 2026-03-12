// tests/gate-stats.test.js
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');

const {
  calculateStats,
  formatStats,
  formatLastPromotion,
  loadGatesFile,
} = require('../scripts/gate-stats');

// -- loadGatesFile --

test('loadGatesFile: returns empty array for nonexistent file', () => {
  const result = loadGatesFile('/tmp/nonexistent-gates-file.json');
  assert.deepStrictEqual(result, []);
});

test('loadGatesFile: returns gates from valid file', () => {
  const tmpFile = path.join(os.tmpdir(), `gate-test-${Date.now()}.json`);
  fs.writeFileSync(tmpFile, JSON.stringify({
    gates: [{ id: 'test-gate', action: 'block', occurrences: 3 }],
  }));
  try {
    const result = loadGatesFile(tmpFile);
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].id, 'test-gate');
  } finally {
    fs.unlinkSync(tmpFile);
  }
});

// -- formatLastPromotion --

test('formatLastPromotion: returns "none" for null', () => {
  assert.strictEqual(formatLastPromotion(null), 'none');
});

test('formatLastPromotion: formats upgrade event', () => {
  const promo = {
    type: 'upgrade',
    gateId: 'auto-testing',
    to: 'block',
    timestamp: new Date().toISOString(),
  };
  const result = formatLastPromotion(promo);
  assert.ok(result.includes('auto-testing'));
  assert.ok(result.includes('block'));
});

test('formatLastPromotion: formats new event with days ago', () => {
  const d = new Date();
  d.setDate(d.getDate() - 2);
  const promo = {
    type: 'new',
    gateId: 'auto-push',
    timestamp: d.toISOString(),
  };
  const result = formatLastPromotion(promo);
  assert.ok(result.includes('auto-push'));
  assert.ok(result.includes('2 days ago'));
});

// -- calculateStats --

test('calculateStats: returns stats object with required fields', () => {
  const stats = calculateStats();
  assert.strictEqual(typeof stats.totalGates, 'number');
  assert.strictEqual(typeof stats.manualGates, 'number');
  assert.strictEqual(typeof stats.autoPromotedGates, 'number');
  assert.strictEqual(typeof stats.blockGates, 'number');
  assert.strictEqual(typeof stats.warnGates, 'number');
  assert.strictEqual(typeof stats.totalBlocked, 'number');
  assert.strictEqual(typeof stats.totalWarned, 'number');
  assert.strictEqual(typeof stats.estimatedHoursSaved, 'string');
  assert.ok(Array.isArray(stats.gates));
});

test('calculateStats: includes manual gates from default.json', () => {
  const stats = calculateStats();
  // default.json has at least 5 gates
  assert.ok(stats.manualGates >= 1, 'should have at least 1 manual gate');
});

// -- formatStats --

test('formatStats: returns formatted string with all sections', () => {
  const stats = {
    totalGates: 7,
    manualGates: 4,
    autoPromotedGates: 3,
    blockGates: 5,
    warnGates: 2,
    totalBlocked: 12,
    totalWarned: 8,
    topBlocked: { id: 'push-without-thread-check', occurrences: 5 },
    lastPromotion: { type: 'upgrade', gateId: 'pr-review', to: 'block', timestamp: new Date().toISOString() },
    estimatedHoursSaved: '5.0',
    gates: [],
  };
  const output = formatStats(stats);
  assert.ok(output.includes('Gate Statistics'));
  assert.ok(output.includes('7 (4 manual, 3 auto-promoted)'));
  assert.ok(output.includes('Actions blocked: 12'));
  assert.ok(output.includes('Actions warned: 8'));
  assert.ok(output.includes('push-without-thread-check'));
  assert.ok(output.includes('~5.0 hours'));
});

test('formatStats: handles no top blocked gate', () => {
  const stats = {
    totalGates: 0,
    manualGates: 0,
    autoPromotedGates: 0,
    blockGates: 0,
    warnGates: 0,
    totalBlocked: 0,
    totalWarned: 0,
    topBlocked: null,
    lastPromotion: null,
    estimatedHoursSaved: '0.0',
    gates: [],
  };
  const output = formatStats(stats);
  assert.ok(output.includes('Top blocked gate: none'));
  assert.ok(output.includes('Last promotion: none'));
});
