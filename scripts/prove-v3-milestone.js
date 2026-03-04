#!/usr/bin/env node
/**
 * prove-v3-milestone.js
 *
 * Phase 17: Final proof gate for the v3.0 Commercialization milestone.
 * Verifies:
 *   PROOF-01: Dockerfile exists + /health endpoint works (start server, curl, kill)
 *   PROOF-02: billing.js exports all 5 required functions + key provision/validate round-trip
 *   PROOF-03: bin/cli.js runs `init` in tmpdir + creates config
 *   PROOF-04: npm test passes with count >= 314 and 0 failures
 *
 * All numbers are from actual runs — no placeholders.
 * Writes proof/v3-milestone-report.json and proof/v3-milestone-report.md
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { execSync, spawnSync } = require('child_process');
const os = require('os');

const ROOT = path.join(__dirname, '..');
const PROOF_DIR = path.join(ROOT, 'proof');

function ensureDir(d) {
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
}

function stamp() {
  return new Date().toISOString();
}

// ─── Result collector ──────────────────────────────────────────────────────
const results = [];

function record(check, passed, detail, evidence = '') {
  results.push({ check, passed, detail, evidence, ts: stamp() });
  const icon = passed ? 'PASS' : 'FAIL';
  console.log(`[${icon}] ${check}: ${detail}`);
  if (evidence && !passed) console.log(`       Evidence: ${evidence}`);
}

// ===========================================================================
// PROOF-01: Dockerfile exists + health endpoint responds
// ===========================================================================
console.log('\n── PROOF-01: Dockerfile + /health endpoint ──');

const dockerfilePath = path.join(ROOT, 'Dockerfile');
const dockerfileExists = fs.existsSync(dockerfilePath);
record('PROOF-01a: Dockerfile exists', dockerfileExists, dockerfileExists ? 'Dockerfile found' : 'Dockerfile MISSING');

// Start the API server, curl /health, then kill it
let healthPassed = false;
let healthDetail = '';
let healthEvidence = '';
let serverPid = null;

const serverPath = path.join(ROOT, 'src', 'api', 'server.js');
const serverExists = fs.existsSync(serverPath);
record('PROOF-01b: src/api/server.js exists', serverExists, serverExists ? 'server.js found' : 'server.js MISSING');

if (serverExists) {
  const TEST_PORT = 13877; // unlikely to collide
  const env = { ...process.env, PORT: String(TEST_PORT), RLHF_ALLOW_INSECURE: 'true' };
  try {
    const serverProc = require('child_process').spawn(
      process.execPath,
      [serverPath],
      { env, detached: false, stdio: 'pipe' }
    );
    serverPid = serverProc.pid;

    // Wait up to 4 seconds for the server to start
    let started = false;
    const deadline = Date.now() + 4000;
    while (Date.now() < deadline) {
      try {
        execSync(`curl -sf http://localhost:${TEST_PORT}/health`, { timeout: 1000 });
        started = true;
        break;
      } catch (_) {
        // not up yet — busy wait 200ms
        const t = Date.now() + 200;
        while (Date.now() < t) { /* spin */ }
      }
    }

    if (started) {
      const rawResponse = execSync(`curl -s http://localhost:${TEST_PORT}/health`, { timeout: 2000 }).toString().trim();
      healthEvidence = rawResponse;
      try {
        const parsed = JSON.parse(rawResponse);
        const hasVersion = typeof parsed.version !== 'undefined';
        const hasUptime = typeof parsed.uptime !== 'undefined';
        healthPassed = hasVersion && hasUptime;
        healthDetail = healthPassed
          ? `HTTP 200, version=${parsed.version}, uptime=${parsed.uptime}`
          : `Response missing version or uptime fields: ${rawResponse}`;
      } catch (e) {
        healthDetail = `Invalid JSON from /health: ${rawResponse}`;
      }
    } else {
      healthDetail = 'Server did not start within 4 seconds';
    }

    // Kill the server
    try { process.kill(serverPid, 'SIGTERM'); } catch (_) {}
  } catch (err) {
    healthDetail = `Server start error: ${err.message}`;
  }
} else {
  healthDetail = 'Skipped — server.js not found';
}

record('PROOF-01c: /health returns 200 with version+uptime', healthPassed, healthDetail, healthEvidence);

// ===========================================================================
// PROOF-02: billing.js exports all 5 required functions + provision/validate round-trip
// ===========================================================================
console.log('\n── PROOF-02: Billing module exports + key round-trip ──');

const REQUIRED_BILLING_EXPORTS = [
  'createCheckoutSession',
  'provisionApiKey',
  'validateApiKey',
  'recordUsage',
  'handleWebhook',
];

const billingPath = path.join(ROOT, 'scripts', 'billing.js');
let billingExportsPassed = false;
let billingExportsDetail = '';
let roundTripPassed = false;
let roundTripDetail = '';

if (fs.existsSync(billingPath)) {
  try {
    const billing = require(billingPath);
    const missingExports = REQUIRED_BILLING_EXPORTS.filter(fn => typeof billing[fn] !== 'function');
    billingExportsPassed = missingExports.length === 0;
    billingExportsDetail = billingExportsPassed
      ? `All 5 functions exported: ${REQUIRED_BILLING_EXPORTS.join(', ')}`
      : `Missing exports: ${missingExports.join(', ')}`;

    // Key provision + validate round-trip (runs in local mode when STRIPE_SECRET_KEY is absent)
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rlhf-proof-billing-'));
    const tmpKeyPath = path.join(tmpDir, 'api-keys.json');
    // Temporarily redirect key store to tmpdir
    const origKeyPath = billing._API_KEYS_PATH;

    // Provision a key
    process.env.STRIPE_SECRET_KEY = ''; // force local mode
    const provisioned = billing.provisionApiKey('test-customer-proof');
    // provisionApiKey returns { key, customerId, createdAt }
    const apiKey = provisioned && (provisioned.apiKey || provisioned.key);
    if (apiKey) {
      // Validate it
      const validation = billing.validateApiKey(apiKey);
      roundTripPassed = validation && validation.valid === true;
      roundTripDetail = roundTripPassed
        ? `Key provisioned (${apiKey.slice(0, 14)}...) and validated successfully`
        : `Key validation failed: ${JSON.stringify(validation)}`;
    } else {
      roundTripDetail = `provisionApiKey returned: ${JSON.stringify(provisioned)}`;
    }
    // Cleanup tmp key file if it was created in tmpdir
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (_) {}
  } catch (err) {
    billingExportsDetail = `Error loading billing.js: ${err.message}`;
    roundTripDetail = 'Skipped due to billing.js load error';
  }
} else {
  billingExportsDetail = 'billing.js not found at scripts/billing.js';
  roundTripDetail = 'Skipped — billing.js not found';
}

record('PROOF-02a: billing.js exports 5 required functions', billingExportsPassed, billingExportsDetail);
record('PROOF-02b: provisionApiKey + validateApiKey round-trip', roundTripPassed, roundTripDetail);

// ===========================================================================
// PROOF-03: bin/cli.js runs `init` in tmpdir and creates config
// ===========================================================================
console.log('\n── PROOF-03: CLI init in tmpdir ──');

const cliPath = path.join(ROOT, 'bin', 'cli.js');
let cliPassed = false;
let cliDetail = '';

if (fs.existsSync(cliPath)) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rlhf-proof-cli-'));
  try {
    const result = spawnSync(process.execPath, [cliPath, 'init'], {
      cwd: tmpDir,
      timeout: 15000,
      env: { ...process.env },
    });
    const stdout = (result.stdout || Buffer.alloc(0)).toString();
    const stderr = (result.stderr || Buffer.alloc(0)).toString();

    // Check if .rlhf directory and config were created
    const rlhfDir = path.join(tmpDir, '.rlhf');
    const configFile = path.join(rlhfDir, 'config.json');
    const rlhfDirExists = fs.existsSync(rlhfDir);
    const configExists = fs.existsSync(configFile);

    cliPassed = rlhfDirExists && configExists && result.status === 0;
    if (cliPassed) {
      const config = JSON.parse(fs.readFileSync(configFile, 'utf8'));
      cliDetail = `.rlhf/ created, config.json has keys: ${Object.keys(config).join(', ')}`;
    } else {
      cliDetail = [
        `exit=${result.status}`,
        `rlhfDir=${rlhfDirExists}`,
        `config=${configExists}`,
        stdout.trim() || stderr.trim(),
      ].filter(Boolean).join(' | ');
    }
  } finally {
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (_) {}
  }
} else {
  cliDetail = 'bin/cli.js not found';
}

record('PROOF-03: cli init creates .rlhf/ and config.json', cliPassed, cliDetail);

// ===========================================================================
// PROOF-04: npm test — count >= 314 and 0 failures
// ===========================================================================
console.log('\n── PROOF-04: npm test ──');

const TEST_THRESHOLD = 314;
let testsPassed = false;
let testsDetail = '';
let testCount = 0;
let testFailures = 0;
let testOutput = '';

// npm test runs multiple sub-scripts (test:schema, test:loop, etc.) — each emits
// its own "ℹ pass N" and "ℹ fail N" summary lines. We sum all of them.
function parseTestCounts(output) {
  let pass = 0;
  let fail = 0;
  // node:test emits lines like "ℹ pass 158" (with unicode char) or just "pass 158"
  for (const m of output.matchAll(/(?:ℹ\s+)?pass\s+(\d+)/gi)) {
    pass += parseInt(m[1], 10);
  }
  for (const m of output.matchAll(/(?:ℹ\s+)?fail\s+(\d+)/gi)) {
    fail += parseInt(m[1], 10);
  }
  return { pass, fail };
}

// Also count simple "Results: N passed, M failed" format (used by some sub-scripts)
function parseResultsFormat(output) {
  let pass = 0;
  let fail = 0;
  for (const m of output.matchAll(/Results:\s+(\d+)\s+passed,\s+(\d+)\s+failed/gi)) {
    pass += parseInt(m[1], 10);
    fail += parseInt(m[2], 10);
  }
  return { pass, fail };
}

let npmExitCode = 0;
try {
  // Note: do NOT set RLHF_ALLOW_INSECURE=true here — it disables auth checks and breaks auth tests
  const testEnv = { ...process.env, FORCE_COLOR: '0' };
  delete testEnv.RLHF_ALLOW_INSECURE;
  testOutput = execSync('npm test', {
    cwd: ROOT,
    timeout: 300000, // 5 minutes
    env: testEnv,
  }).toString();
} catch (err) {
  npmExitCode = typeof err.status === 'number' ? err.status : 1;
  testOutput = (err.stdout ? err.stdout.toString() : '') + (err.stderr ? err.stderr.toString() : err.message);
}

{
  const nodeTestCounts = parseTestCounts(testOutput);
  const resultsFormatCounts = parseResultsFormat(testOutput);
  // Use whichever is larger (prefer node:test counts which are more complete)
  const candidateCount = Math.max(nodeTestCounts.pass, resultsFormatCounts.pass);
  testCount = candidateCount;
  // Failures: if npm exited 0, there were 0 failures regardless of parsing edge cases
  testFailures = npmExitCode === 0 ? 0 : (nodeTestCounts.fail + resultsFormatCounts.fail);

  testsPassed = testCount >= TEST_THRESHOLD && testFailures === 0 && npmExitCode === 0;
  testsDetail = testsPassed
    ? `${testCount} tests passed, 0 failures (threshold: ${TEST_THRESHOLD}+)`
    : `npm exit=${npmExitCode}, count=${testCount}, failures=${testFailures} (need ${TEST_THRESHOLD}+ passing, 0 failures)`;
}

record(`PROOF-04: npm test >= ${TEST_THRESHOLD} passing, 0 failures`, testsPassed, testsDetail);

// ===========================================================================
// Summary
// ===========================================================================

const allPassed = results.every(r => r.passed);
const passCount = results.filter(r => r.passed).length;
const failCount = results.filter(r => !r.passed).length;

console.log('\n── Summary ──────────────────────────────────');
console.log(`Checks: ${results.length} total | ${passCount} passed | ${failCount} failed`);
console.log(`Overall: ${allPassed ? 'PASS' : 'FAIL'}`);

// ===========================================================================
// Write reports
// ===========================================================================

ensureDir(PROOF_DIR);

const jsonReport = {
  milestone: 'v3.0 Commercialization',
  generated: stamp(),
  overall: allPassed ? 'PASS' : 'FAIL',
  summary: { total: results.length, passed: passCount, failed: failCount },
  checks: results,
  testCount,
  testFailures,
};

fs.writeFileSync(
  path.join(PROOF_DIR, 'v3-milestone-report.json'),
  JSON.stringify(jsonReport, null, 2),
  'utf8'
);
console.log('\nWrote proof/v3-milestone-report.json');

const mdReport = `# v3.0 Milestone Proof Report

**Generated:** ${stamp()}
**Overall:** ${allPassed ? 'PASS' : 'FAIL'}

## Summary

| Metric | Value |
|--------|-------|
| Total checks | ${results.length} |
| Passed | ${passCount} |
| Failed | ${failCount} |
| Test count | ${testCount} |
| Test failures | ${testFailures} |

## Check Results

| Check | Status | Detail |
|-------|--------|--------|
${results.map(r => `| ${r.check} | ${r.passed ? 'PASS' : 'FAIL'} | ${r.detail.replace(/\|/g, '/')} |`).join('\n')}

## PROOF-01: Dockerfile + /health

${results.filter(r => r.check.startsWith('PROOF-01')).map(r => `- **${r.check}**: ${r.passed ? 'PASS' : 'FAIL'} — ${r.detail}`).join('\n')}

## PROOF-02: Billing Module

${results.filter(r => r.check.startsWith('PROOF-02')).map(r => `- **${r.check}**: ${r.passed ? 'PASS' : 'FAIL'} — ${r.detail}`).join('\n')}

## PROOF-03: CLI Init

${results.filter(r => r.check.startsWith('PROOF-03')).map(r => `- **${r.check}**: ${r.passed ? 'PASS' : 'FAIL'} — ${r.detail}`).join('\n')}

## PROOF-04: Test Suite

${results.filter(r => r.check.startsWith('PROOF-04')).map(r => `- **${r.check}**: ${r.passed ? 'PASS' : 'FAIL'} — ${r.detail}`).join('\n')}

---
*All numbers from actual runs. No placeholders.*
`;

fs.writeFileSync(
  path.join(PROOF_DIR, 'v3-milestone-report.md'),
  mdReport,
  'utf8'
);
console.log('Wrote proof/v3-milestone-report.md');

process.exit(allPassed ? 0 : 1);
