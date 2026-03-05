const test = require('node:test');
const assert = require('node:assert/strict');
const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs');
const { runAutomationProof } = require('../scripts/prove-automation');

let report;
let tmpProofDir;

test('automation proof harness setup', async () => {
  tmpProofDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rlhf-automation-proof-test-'));
  report = await runAutomationProof({ proofDir: tmpProofDir, port: 0 });
});

test('automation proof: zero failures', () => {
  assert.equal(report.summary.failed, 0);
});

test('automation proof: at least 14 checks pass', () => {
  assert.ok(report.summary.passed >= 14, `expected >= 14 passed, got ${report.summary.passed}`);
});

test('automation proof: report.json written', () => {
  assert.ok(fs.existsSync(path.join(tmpProofDir, 'report.json')));
});

test('automation proof: report.md written', () => {
  assert.ok(fs.existsSync(path.join(tmpProofDir, 'report.md')));
});

// Individual check validations
const requiredChecks = [
  'feedback.capture.rubric_pass',
  'feedback.capture.rubric_block',
  'feedback.capture.negative_with_rubric',
  'analytics.rubric_tracking',
  'prevention_rules.rubric_dimensions',
  'dpo_export.rubric_metadata',
  'api.rubric_gate',
  'mcp.rubric_gate',
  'intent.checkpoint_enforcement',
  'context.evaluate.rubric',
  'context.semantic_cache.hit',
  'self_healing.helpers',
  'code_reasoning.dpo_traces',
  'code_reasoning.proof_gate',
];

for (const checkName of requiredChecks) {
  test(`automation proof: individual check "${checkName}" passes`, () => {
    const found = report.checks.find((c) => c.name === checkName);
    assert.ok(found, `check "${checkName}" not found in report`);
    assert.equal(found.passed, true, `check "${checkName}" failed: ${JSON.stringify(found.details)}`);
  });
}

test('automation proof: no unexpected failing checks', () => {
  const failed = report.checks.filter((c) => !c.passed);
  assert.equal(failed.length, 0, `unexpected failures: ${failed.map((c) => c.name).join(', ')}`);
});

test('automation proof: rubric pass has weighted score', () => {
  const check = report.checks.find((c) => c.name === 'feedback.capture.rubric_pass');
  assert.ok(typeof check.details.weightedScore === 'number');
  assert.ok(check.details.weightedScore > 0);
});

test('automation proof: rubric block has rejection reason', () => {
  const check = report.checks.find((c) => c.name === 'feedback.capture.rubric_block');
  assert.equal(check.details.accepted, false);
  assert.ok(check.details.reason);
});

test('automation proof: negative with rubric has failure tags', () => {
  const check = report.checks.find((c) => c.name === 'feedback.capture.negative_with_rubric');
  assert.ok(Array.isArray(check.details.tags));
  assert.ok(check.details.tags.some((t) => t.startsWith('rubric-')));
});

test('automation proof: analytics tracks rubric samples >= 3', () => {
  const check = report.checks.find((c) => c.name === 'analytics.rubric_tracking');
  assert.ok(check.details.samples >= 3);
});

test('automation proof: DPO rubric metadata present', () => {
  const check = report.checks.find((c) => c.name === 'dpo_export.rubric_metadata');
  assert.ok(check.details);
});

test('automation proof: API rubric gate returns 422', () => {
  const check = report.checks.find((c) => c.name === 'api.rubric_gate');
  assert.equal(check.details.status, 422);
});

test('automation proof: MCP rubric gate rejects', () => {
  const check = report.checks.find((c) => c.name === 'mcp.rubric_gate');
  assert.equal(check.details.accepted, false);
});

test('automation proof: intent checkpoint enforced', () => {
  const check = report.checks.find((c) => c.name === 'intent.checkpoint_enforcement');
  assert.equal(check.details.blocked, 'checkpoint_required');
  assert.equal(check.details.approved, 'ready');
});

test('automation proof: semantic cache hit on equivalent query', () => {
  const check = report.checks.find((c) => c.name === 'context.semantic_cache.hit');
  assert.equal(check.details.firstHit, false);
  assert.equal(check.details.secondHit, true);
});

test('automation proof: self-healing includes reasoning traces', () => {
  const check = report.checks.find((c) => c.name === 'self_healing.helpers');
  assert.ok(check.details.reasoning, 'should include reasoning aggregate');
  assert.ok(check.details.reasoning.allPassed, 'all traces should pass');
});

test('automation proof: code reasoning DPO traces have confidence', () => {
  const check = report.checks.find((c) => c.name === 'code_reasoning.dpo_traces');
  assert.ok(check.details);
});

test('automation proof: code reasoning proof gate passes', () => {
  const check = report.checks.find((c) => c.name === 'code_reasoning.proof_gate');
  assert.ok(check.details.allPassed, 'all proof traces should pass');
  assert.ok(check.details.averageConfidence > 0);
});

test('automation proof: report includes reasoning aggregate', () => {
  assert.ok(report.reasoning, 'report should have reasoning field');
  assert.equal(report.reasoning.refuted, 0);
  assert.ok(report.reasoning.allPassed);
});

test('automation proof: report includes proof traces', () => {
  assert.ok(Array.isArray(report.proofTraces));
  assert.ok(report.proofTraces.length > 0);
  report.proofTraces.forEach((trace) => {
    assert.ok(trace.traceId);
    assert.ok(trace.summary);
  });
});

test('automation proof: cleanup', () => {
  fs.rmSync(tmpProofDir, { recursive: true, force: true });
});
