'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs');

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rlhf-recall-limit-'));
const tmpUsageFile = path.join(tmpDir, 'usage-limits.json');
process.env.RLHF_FEEDBACK_DIR = tmpDir;
process.env.RLHF_MCP_PROFILE = 'default';

const { callTool } = require('../adapters/mcp/server-stdio');
const rateLimiter = require('../scripts/rate-limiter');
rateLimiter.USAGE_FILE = tmpUsageFile;

test.beforeEach(() => {
  try { fs.unlinkSync(tmpUsageFile); } catch (_) {}
});

test('recall returns results without upgrade nudge for first 5 calls', async () => {
  for (let i = 0; i < 5; i++) {
    const result = await callTool('recall', { query: 'test task' });
    const text = result.content[0].text;
    assert.ok(!text.includes('Upgrade to Context Gateway'), `Call ${i + 1} should not show upgrade nudge`);
    assert.ok(!text.includes('Free tier limit reached'), `Call ${i + 1} should still return recall content`);
  }
});

test('recall shows upgrade nudge after 5 calls in a day', async () => {
  for (let i = 0; i < 5; i++) {
    await callTool('recall', { query: `warmup ${i + 1}` });
  }
  const result = await callTool('recall', { query: 'test task 6' });
  const text = result.content[0].text;
  assert.ok(text.includes('Upgrade to Context Gateway'), 'Call 6 should show upgrade nudge');
  assert.ok(text.includes('gumroad.com'), 'Should include Gumroad link');
  assert.ok(text.includes('rlhf-feedback-loop-production'), 'Should include hosted API link');
});

test('recall still returns actual results even when over limit', async () => {
  for (let i = 0; i < 5; i++) {
    await callTool('recall', { query: `warmup ${i + 1}` });
  }
  const result = await callTool('recall', { query: 'test task' });
  const text = result.content[0].text;
  // Should have both results AND the nudge
  assert.ok(text.length > 50, 'Should still return content, not just the nudge');
});

test.after(() => {
  try { fs.unlinkSync(tmpUsageFile); } catch (_) {}
  try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (_) {}
});
