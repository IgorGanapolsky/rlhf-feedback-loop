const test = require('node:test');
const assert = require('node:assert/strict');
const {
  loadRubricConfig,
  normalizeRubricScores,
  buildRubricEvaluation,
  parseRubricScores,
  evaluateGuardrails,
  evaluateJudgeAgreement,
} = require('../scripts/rubric-engine');

test('loads rubric config with expected criteria', () => {
  const rubric = loadRubricConfig();
  assert.equal(rubric.rubricId, 'default-v1');
  assert.ok(Array.isArray(rubric.criteria));
  assert.ok(rubric.criteria.length >= 4);
});

test('rubric config criteria have required fields', () => {
  const rubric = loadRubricConfig();
  rubric.criteria.forEach((c) => {
    assert.ok(c.id, `criterion missing id`);
    assert.ok(typeof c.weight === 'number', `criterion ${c.id} missing weight`);
    assert.ok(typeof c.minPassingScore === 'number', `criterion ${c.id} missing minPassingScore`);
  });
});

test('rubric config weights sum to 1.0', () => {
  const rubric = loadRubricConfig();
  const total = rubric.criteria.reduce((sum, c) => sum + c.weight, 0);
  assert.ok(Math.abs(total - 1.0) < 0.001, `weights sum to ${total}, expected 1.0`);
});

test('rubric config has expected criteria IDs', () => {
  const rubric = loadRubricConfig();
  const ids = rubric.criteria.map((c) => c.id);
  assert.ok(ids.includes('correctness'));
  assert.ok(ids.includes('verification_evidence'));
  assert.ok(ids.includes('safety'));
  assert.ok(ids.includes('instruction_following'));
  assert.ok(ids.includes('clarity'));
});

test('normalizes rubric scores and validates criterion names', () => {
  const normalized = normalizeRubricScores([
    { criterion: 'correctness', score: 4, judge: 'judge-a' },
  ]);
  assert.equal(normalized.length, 1);
  assert.equal(normalized[0].criterion, 'correctness');
  assert.equal(normalized[0].score, 4);
});

test('normalizeRubricScores rejects unknown criterion', () => {
  assert.throws(
    () => normalizeRubricScores([{ criterion: 'unknown', score: 5 }]),
    /unknown criterion/,
  );
});

test('normalizeRubricScores handles multiple scores for same criterion', () => {
  const normalized = normalizeRubricScores([
    { criterion: 'correctness', score: 5, judge: 'judge-a' },
    { criterion: 'correctness', score: 3, judge: 'judge-b' },
  ]);
  assert.equal(normalized.length, 2);
});

test('normalizeRubricScores rejects out-of-range scores', () => {
  assert.throws(
    () => normalizeRubricScores([{ criterion: 'correctness', score: 0, judge: 'a' }]),
    /score must be between 1 and 5/,
  );
  assert.throws(
    () => normalizeRubricScores([{ criterion: 'safety', score: 10, judge: 'a' }]),
    /score must be between 1 and 5/,
  );
});

test('buildRubricEvaluation flags disagreement and failed guardrails', () => {
  const evaluation = buildRubricEvaluation({
    rubricScores: [
      { criterion: 'verification_evidence', score: 5, judge: 'judge-a' },
      { criterion: 'verification_evidence', score: 2, judge: 'judge-b', evidence: 'missing logs' },
      { criterion: 'correctness', score: 4, judge: 'judge-a', evidence: 'tests pass' },
    ],
    guardrails: {
      testsPassed: false,
      pathSafety: true,
      budgetCompliant: true,
    },
  });

  assert.equal(evaluation.promotionEligible, false);
  assert.ok(evaluation.failingGuardrails.includes('testsPassed'));
  assert.ok(evaluation.judgeDisagreements.length >= 1);
  assert.ok(evaluation.blockReasons.length >= 1);
});

test('buildRubricEvaluation passes when all criteria met with evidence', () => {
  const evaluation = buildRubricEvaluation({
    rubricScores: [
      { criterion: 'correctness', score: 4, judge: 'a', evidence: 'tests pass' },
      { criterion: 'verification_evidence', score: 4, judge: 'a', evidence: 'proof attached' },
      { criterion: 'safety', score: 4, judge: 'a', evidence: 'no issues' },
    ],
    guardrails: { testsPassed: true, pathSafety: true, budgetCompliant: true },
  });

  assert.equal(evaluation.promotionEligible, true);
  assert.equal(evaluation.blockReasons.length, 0);
});

test('buildRubricEvaluation includes weighted score', () => {
  const evaluation = buildRubricEvaluation({
    rubricScores: [
      { criterion: 'correctness', score: 5, judge: 'a' },
      { criterion: 'verification_evidence', score: 5, judge: 'a' },
      { criterion: 'safety', score: 5, judge: 'a' },
      { criterion: 'instruction_following', score: 5, judge: 'a' },
      { criterion: 'clarity', score: 5, judge: 'a' },
    ],
    guardrails: { testsPassed: true, pathSafety: true, budgetCompliant: true },
  });

  assert.ok(typeof evaluation.weightedScore === 'number');
  assert.ok(evaluation.weightedScore > 0.9, `expected high weighted score, got ${evaluation.weightedScore}`);
});

test('buildRubricEvaluation detects failing criteria', () => {
  const evaluation = buildRubricEvaluation({
    rubricScores: [
      { criterion: 'correctness', score: 1, judge: 'a' },
      { criterion: 'verification_evidence', score: 1, judge: 'a' },
    ],
    guardrails: { testsPassed: true, pathSafety: true, budgetCompliant: true },
  });

  assert.ok(evaluation.failingCriteria.length >= 2, 'should flag both as failing');
  assert.ok(evaluation.failingCriteria.includes('correctness'));
  assert.ok(evaluation.failingCriteria.includes('verification_evidence'));
});

test('buildRubricEvaluation returns rubricId', () => {
  const evaluation = buildRubricEvaluation({
    rubricScores: [{ criterion: 'correctness', score: 4, judge: 'a' }],
    guardrails: { testsPassed: true, pathSafety: true, budgetCompliant: true },
  });

  assert.equal(evaluation.rubricId, 'default-v1');
});

test('evaluateGuardrails detects all failed guardrails', () => {
  const result = evaluateGuardrails({
    testsPassed: false,
    pathSafety: false,
    budgetCompliant: true,
  });

  assert.ok(result.failed.includes('testsPassed'));
  assert.ok(result.failed.includes('pathSafety'));
  assert.equal(result.status.budgetCompliant, true);
});

test('evaluateGuardrails handles all passing', () => {
  const result = evaluateGuardrails({
    testsPassed: true,
    pathSafety: true,
    budgetCompliant: true,
  });

  assert.equal(result.failed.length, 0);
  assert.equal(result.status.testsPassed, true);
  assert.equal(result.status.pathSafety, true);
  assert.equal(result.status.budgetCompliant, true);
});
