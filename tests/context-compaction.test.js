'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { compactContext } = require('../scripts/context-engine');

function makeEntry(id, signal, context, whatWentWrong) {
  return { id, signal, context: context || '', whatWentWrong: whatWentWrong || '' };
}

test('compactContext returns entries unchanged when under limits', () => {
  const entries = [
    makeEntry('e1', 'negative', 'short context', 'short error'),
    makeEntry('e2', 'positive', 'short context', ''),
  ];
  const result = compactContext(entries, [], { windowSize: 30, perEntryMaxChars: 512 });
  assert.equal(result.compacted, false);
  assert.equal(result.removedCount, 0);
  assert.equal(result.stage, 5);
  assert.equal(result.entries.length, 2);
});

test('stage 1 caps each signal group to 10 entries', () => {
  const entries = Array.from({ length: 25 }, (_, i) =>
    makeEntry(`e${i}`, 'negative', `context ${i}`, `error ${i}`),
  );
  const result = compactContext(entries, [], {});
  // 25 negative entries → capped at 10
  assert.ok(result.entries.length <= 10, `Expected ≤10 entries, got ${result.entries.length}`);
  assert.ok(result.compacted);
});

test('stage 2 truncates fields exceeding perEntryMaxChars', () => {
  const longText = 'x'.repeat(1000);
  const entries = [makeEntry('e1', 'negative', longText, longText)];
  const result = compactContext(entries, [], { perEntryMaxChars: 100 });
  const entry = result.entries.find(e => e.id === 'e1');
  assert.ok(entry, 'entry should be present');
  assert.ok(entry.context.length <= 100);
  assert.ok(entry.whatWentWrong.length <= 100);
});

test('stage 3 drops entries with empty context and whatWentWrong', () => {
  const entries = [
    makeEntry('keep', 'negative', 'has context', ''),
    makeEntry('drop', 'negative', '', ''),
  ];
  const result = compactContext(entries, [], {});
  assert.ok(result.entries.some(e => e.id === 'keep'));
  assert.ok(!result.entries.some(e => e.id === 'drop'));
});

test('stage 4 windows to most recent windowSize entries', () => {
  const entries = Array.from({ length: 50 }, (_, i) =>
    makeEntry(`e${i}`, i % 2 === 0 ? 'negative' : 'positive', `context ${i}`, `error ${i}`),
  );
  const result = compactContext(entries, [], { windowSize: 5 });
  // Each signal group gets 10 max (stage 1), then windowed to 5 (stage 4) before dedup
  assert.ok(result.entries.length <= 5, `Expected ≤5 after windowing, got ${result.entries.length}`);
});

test('stage 5 deduplicates entries with identical whatWentWrong', () => {
  const entries = [
    makeEntry('e1', 'negative', 'ctx A', 'same error'),
    makeEntry('e2', 'negative', 'ctx B', 'same error'),
    makeEntry('e3', 'negative', 'ctx C', 'different error'),
  ];
  const result = compactContext(entries, [], { windowSize: 30 });
  const ids = result.entries.map(e => e.id);
  // One of e1/e2 should be dropped; e3 should remain
  assert.ok(ids.includes('e3'));
  const sameErrorCount = result.entries.filter(e => e.whatWentWrong === 'same error').length;
  assert.equal(sameErrorCount, 1);
});

test('anchor entries are always preserved regardless of compaction', () => {
  const anchors = [makeEntry('anchor1', 'negative', 'foundational', 'anchor error')];
  const entries = [
    ...anchors,
    makeEntry('drop', 'negative', '', ''),
  ];
  const result = compactContext(entries, anchors, {});
  assert.ok(result.entries.some(e => e.id === 'anchor1'), 'anchor must survive compaction');
});

test('compactContext handles empty entries array', () => {
  const result = compactContext([], [], {});
  assert.equal(result.entries.length, 0);
  assert.equal(result.removedCount, 0);
  assert.equal(result.compacted, false);
});
