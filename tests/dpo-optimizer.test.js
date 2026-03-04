'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');

function freshModule() {
  delete require.cache[require.resolve('../scripts/dpo-optimizer')];
  return require('../scripts/dpo-optimizer');
}

describe('dpo-optimizer — dpoLogRatio()', () => {
  it('returns positive value when chosen > rejected', () => {
    const { dpoLogRatio } = freshModule();
    const r = dpoLogRatio(1.0, 0.5);
    assert.ok(r > 0, `expected positive, got ${r}`);
    assert.ok(r <= 1, `expected <= 1, got ${r}`);
  });

  it('returns negative value when chosen < rejected', () => {
    const { dpoLogRatio } = freshModule();
    const r = dpoLogRatio(0.5, 1.0);
    assert.ok(r < 0, `expected negative, got ${r}`);
    assert.ok(r >= -1, `expected >= -1, got ${r}`);
  });

  it('is symmetric: dpoLogRatio(a,b) == -dpoLogRatio(b,a)', () => {
    const { dpoLogRatio } = freshModule();
    const ab = dpoLogRatio(1.0, 0.5);
    const ba = dpoLogRatio(0.5, 1.0);
    assert.ok(Math.abs(ab + ba) < 0.0001, `expected symmetric, got ${ab} and ${ba}`);
  });

  it('returns 0 when chosen == rejected', () => {
    const { dpoLogRatio } = freshModule();
    const r = dpoLogRatio(0.5, 0.5);
    assert.ok(Math.abs(r) < 0.001, `expected ~0 for equal weights, got ${r}`);
  });

  it('clamps very small values to 0.01 floor', () => {
    const { dpoLogRatio } = freshModule();
    // Should not throw even with 0 or negative
    const r = dpoLogRatio(0, 0);
    assert.ok(Math.abs(r) < 0.001, 'equal clamped values should produce ~0');
  });
});

describe('dpo-optimizer — buildPreferencePairs()', () => {
  it('returns empty object when memory-log.jsonl is missing', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dpo-test-'));
    try {
      const { buildPreferencePairs } = freshModule();
      const pairs = buildPreferencePairs(tmpDir);
      assert.ok(typeof pairs === 'object', 'must return object');
      assert.strictEqual(Object.keys(pairs).length, 0, 'empty when no memories');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('returns grouped pairs when matching error+learning memories exist', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dpo-test-'));
    try {
      const memoryLog = path.join(tmpDir, 'memory-log.jsonl');
      const memories = [
        {
          id: 'err_1',
          category: 'error',
          title: 'MISTAKE: Claimed done without test proof',
          content: 'Claimed completion without running tests.',
          tags: ['verification', 'testing'],
          rubricSummary: { weightedScore: 0.3, failingCriteria: ['verification_evidence'], failingGuardrails: [] },
        },
        {
          id: 'learn_1',
          category: 'learning',
          title: 'SUCCESS: Always run tests before completion',
          content: 'Always run npm test and include output.',
          tags: ['verification', 'testing'],
          rubricSummary: { weightedScore: 0.9, failingCriteria: [], failingGuardrails: [] },
        },
      ];
      fs.writeFileSync(memoryLog, memories.map((m) => JSON.stringify(m)).join('\n') + '\n');

      const { buildPreferencePairs } = freshModule();
      const pairs = buildPreferencePairs(tmpDir);
      const totalPairs = Object.values(pairs).reduce((s, arr) => s + arr.length, 0);
      assert.ok(totalPairs >= 1, `expected >= 1 pair, got ${totalPairs}`);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});

describe('dpo-optimizer — run()', () => {
  it('writes dpo-model.json to feedbackDir', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dpo-test-'));
    try {
      // No memories — run should still produce dpo-model.json
      const { run } = freshModule();
      const result = run({ feedbackDir: tmpDir, modelPath: path.join(tmpDir, 'feedback_model.json') });
      assert.ok(typeof result === 'object', 'run returns object');
      assert.ok('pairs_processed' in result, 'result has pairs_processed');
      const dpoPath = path.join(tmpDir, 'dpo-model.json');
      assert.ok(fs.existsSync(dpoPath), 'dpo-model.json must exist after run()');
      const model = JSON.parse(fs.readFileSync(dpoPath, 'utf-8'));
      assert.ok('generated' in model, 'dpo-model.json has generated field');
      assert.ok('pairs_processed' in model, 'dpo-model.json has pairs_processed field');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('calls saveModel when pairs are found', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dpo-test-'));
    try {
      const memoryLog = path.join(tmpDir, 'memory-log.jsonl');
      const memories = [
        {
          id: 'err_x',
          category: 'error',
          title: 'MISTAKE: verification skipped',
          content: 'Verification was skipped before claiming completion.',
          tags: ['verification'],
          rubricSummary: { weightedScore: 0.2, failingCriteria: ['verification_evidence'], failingGuardrails: [] },
        },
        {
          id: 'learn_x',
          category: 'learning',
          title: 'SUCCESS: verification always runs',
          content: 'Always run verification before saying done.',
          tags: ['verification'],
          rubricSummary: { weightedScore: 0.85, failingCriteria: [], failingGuardrails: [] },
        },
      ];
      fs.writeFileSync(memoryLog, memories.map((m) => JSON.stringify(m)).join('\n') + '\n');

      const modelPath = path.join(tmpDir, 'feedback_model.json');
      const { run } = freshModule();
      const result = run({ feedbackDir: tmpDir, modelPath });

      if (result.pairs_processed > 0) {
        assert.ok(fs.existsSync(modelPath), 'saveModel must write feedback_model.json when pairs processed');
      }
      // dpo-model.json always written
      assert.ok(fs.existsSync(path.join(tmpDir, 'dpo-model.json')));
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});

describe('dpo-optimizer — applyDpoAdjustments()', () => {
  it('returns adjustments object', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dpo-test-'));
    try {
      const modelPath = path.join(tmpDir, 'model.json');
      const { applyDpoAdjustments } = freshModule();
      const pairs = {
        testing: [
          {
            chosen: { timestamp: new Date().toISOString() },
            rejected: { timestamp: new Date(Date.now() - 86400000 * 7).toISOString() },
          },
        ],
      };
      const adjustments = applyDpoAdjustments(modelPath, pairs);
      assert.ok(typeof adjustments === 'object', 'returns object');
      assert.ok(fs.existsSync(modelPath), 'saveModel called: model file must exist');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
