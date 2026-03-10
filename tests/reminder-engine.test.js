'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {
  REMINDER_TEMPLATES,
  DEFAULT_THRESHOLDS,
  trackEvent,
  getEventCount,
  shouldInjectReminder,
  renderTemplate,
  injectReminder,
  resetEvent,
} = require('../scripts/reminder-engine');

function tmpState() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'reminder-test-'));
  return path.join(dir, 'state.json');
}

test('REMINDER_TEMPLATES covers all DEFAULT_THRESHOLDS event types', () => {
  for (const eventType of Object.keys(DEFAULT_THRESHOLDS)) {
    assert.ok(REMINDER_TEMPLATES[eventType], `Missing template for: ${eventType}`);
  }
});

test('trackEvent increments count and persists state', () => {
  const stateFile = tmpState();
  assert.equal(trackEvent('guardrail_spike', stateFile), 1);
  assert.equal(trackEvent('guardrail_spike', stateFile), 2);
  assert.equal(getEventCount('guardrail_spike', stateFile), 2);
});

test('getEventCount returns 0 for unknown events', () => {
  const stateFile = tmpState();
  assert.equal(getEventCount('nonexistent_event', stateFile), 0);
});

test('shouldInjectReminder returns false below threshold', () => {
  const stateFile = tmpState();
  trackEvent('guardrail_spike', stateFile); // count=1
  trackEvent('guardrail_spike', stateFile); // count=2
  assert.equal(shouldInjectReminder('guardrail_spike', 3, stateFile), false);
});

test('shouldInjectReminder returns true at or above threshold', () => {
  const stateFile = tmpState();
  trackEvent('guardrail_spike', stateFile);
  trackEvent('guardrail_spike', stateFile);
  trackEvent('guardrail_spike', stateFile); // count=3
  assert.equal(shouldInjectReminder('guardrail_spike', 3, stateFile), true);
});

test('shouldInjectReminder uses DEFAULT_THRESHOLDS when threshold arg omitted', () => {
  const stateFile = tmpState();
  // tool_misuse threshold=2
  trackEvent('tool_misuse', stateFile);
  assert.equal(shouldInjectReminder('tool_misuse', undefined, stateFile), false);
  trackEvent('tool_misuse', stateFile);
  assert.equal(shouldInjectReminder('tool_misuse', undefined, stateFile), true);
});

test('renderTemplate substitutes context variables', () => {
  const result = renderTemplate('guardrail_spike', { count: 5, rule: 'ALWAYS verify' });
  assert.ok(result.includes('5'));
  assert.ok(result.includes('ALWAYS verify'));
  assert.ok(!result.includes('{{'));
});

test('renderTemplate returns fallback for unknown event type', () => {
  const result = renderTemplate('unknown_event', {});
  assert.ok(result.includes('unknown_event'));
});

test('renderTemplate leaves placeholder when context key missing', () => {
  const result = renderTemplate('guardrail_spike', { count: 1 }); // missing 'rule'
  assert.ok(result.includes('{rule}'));
});

test('injectReminder appends a user-role reminder to turns', () => {
  const stateFile = tmpState();
  trackEvent('guardrail_spike', stateFile);
  const turns = [{ role: 'assistant', content: 'existing turn' }];
  const updated = injectReminder(turns, 'guardrail_spike', { rule: 'NEVER skip checks' }, stateFile);
  assert.equal(updated.length, 2);
  assert.equal(updated[1].role, 'user');
  assert.ok(updated[1].content.includes('[System Reminder]'));
  assert.equal(updated[1].eventType, 'guardrail_spike');
});

test('injectReminder does not mutate the original turns array', () => {
  const stateFile = tmpState();
  const turns = [{ role: 'assistant', content: 'original' }];
  const updated = injectReminder(turns, 'guardrail_spike', {}, stateFile);
  assert.equal(turns.length, 1, 'original array must be unchanged');
  assert.equal(updated.length, 2);
});

test('resetEvent resets count to zero', () => {
  const stateFile = tmpState();
  trackEvent('error_cascade', stateFile);
  trackEvent('error_cascade', stateFile);
  assert.equal(getEventCount('error_cascade', stateFile), 2);
  resetEvent('error_cascade', stateFile);
  assert.equal(getEventCount('error_cascade', stateFile), 0);
});
