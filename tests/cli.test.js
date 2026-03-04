'use strict';

/**
 * Tests for bin/cli.js — npx rlhf-feedback-loop init
 *
 * Verifies:
 *   1. CLI runs without error
 *   2. init command creates .rlhf/ directory
 *   3. init command creates config.json with expected fields
 *   4. init command creates capture-feedback.js
 *   5. capture-feedback.js runs and exits cleanly
 *   6. capture-feedback.js writes a JSONL log entry
 *   7. help command exits 0 with usage text
 *   8. Unknown command exits 1
 */

const { execFileSync, spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');

const CLI = path.resolve(__dirname, '../bin/cli.js');

function makeTmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'rlhf-cli-test-'));
}

describe('bin/cli.js', () => {
  let tmpDir;

  before(() => {
    tmpDir = makeTmpDir();
  });

  after(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('CLI file exists and is executable', () => {
    assert.ok(fs.existsSync(CLI), `CLI not found at ${CLI}`);
    const stat = fs.statSync(CLI);
    // Owner executable bit
    assert.ok(stat.mode & 0o100, 'CLI should have executable bit set');
  });

  test('help command exits 0', () => {
    const result = spawnSync(process.execPath, [CLI, 'help'], { encoding: 'utf8' });
    assert.strictEqual(result.status, 0, `Expected exit 0, got ${result.status}\n${result.stderr}`);
    assert.ok(result.stdout.includes('rlhf-feedback-loop CLI'), 'Help should include CLI name');
    assert.ok(result.stdout.includes('init'), 'Help should mention init command');
  });

  test('--help flag exits 0', () => {
    const result = spawnSync(process.execPath, [CLI, '--help'], { encoding: 'utf8' });
    assert.strictEqual(result.status, 0);
  });

  test('no-arg invocation exits 0 with help', () => {
    const result = spawnSync(process.execPath, [CLI], { encoding: 'utf8' });
    assert.strictEqual(result.status, 0);
    assert.ok(result.stdout.includes('init'), 'No-arg output should mention init');
  });

  test('unknown command exits 1', () => {
    const result = spawnSync(process.execPath, [CLI, 'unknown-xyz'], { encoding: 'utf8' });
    assert.strictEqual(result.status, 1, `Expected exit 1, got ${result.status}`);
  });

  test('init creates .rlhf/ directory', () => {
    const result = spawnSync(process.execPath, [CLI, 'init'], {
      encoding: 'utf8',
      cwd: tmpDir,
    });
    assert.strictEqual(result.status, 0, `init failed:\n${result.stderr}`);
    const rlhfDir = path.join(tmpDir, '.rlhf');
    assert.ok(fs.existsSync(rlhfDir), '.rlhf/ directory should be created');
  });

  test('init creates config.json with required fields', () => {
    const configPath = path.join(tmpDir, '.rlhf', 'config.json');
    assert.ok(fs.existsSync(configPath), 'config.json should exist');
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    assert.ok(config.version, 'config.version should be set');
    assert.ok(config.apiUrl, 'config.apiUrl should be set');
    assert.ok(config.logPath, 'config.logPath should be set');
    assert.ok(config.createdAt, 'config.createdAt should be set');
    assert.ok(!isNaN(Date.parse(config.createdAt)), 'config.createdAt should be a valid ISO timestamp');
  });

  test('init creates capture-feedback.js', () => {
    const scriptPath = path.join(tmpDir, '.rlhf', 'capture-feedback.js');
    assert.ok(fs.existsSync(scriptPath), 'capture-feedback.js should be created');
  });

  test('init output includes setup complete message', () => {
    const result = spawnSync(process.execPath, [CLI, 'init'], {
      encoding: 'utf8',
      cwd: tmpDir,
    });
    assert.ok(
      result.stdout.includes('Setup complete'),
      `Expected "Setup complete" in output:\n${result.stdout}`
    );
  });

  test('capture-feedback.js --feedback=up exits 0 and writes log', () => {
    const scriptPath = path.join(tmpDir, '.rlhf', 'capture-feedback.js');
    const result = spawnSync(
      process.execPath,
      [scriptPath, '--feedback=up', '--context=cli test verification'],
      { encoding: 'utf8', cwd: tmpDir }
    );
    assert.strictEqual(
      result.status,
      0,
      `capture-feedback.js exited ${result.status}:\n${result.stderr}`
    );
    assert.ok(result.stdout.includes('Feedback captured'), 'Should print captured message');
    assert.ok(result.stdout.includes('[up]'), 'Should show signal in output');

    // Verify log file was written
    const logPath = path.join(tmpDir, '.rlhf', 'feedback-log.jsonl');
    assert.ok(fs.existsSync(logPath), 'feedback-log.jsonl should exist');
    const lines = fs.readFileSync(logPath, 'utf8').trim().split('\n');
    const lastEntry = JSON.parse(lines[lines.length - 1]);
    assert.strictEqual(lastEntry.signal, 'up', 'Log entry signal should be "up"');
    assert.strictEqual(lastEntry.context, 'cli test verification', 'Log entry context should match');
    assert.ok(lastEntry.id, 'Log entry should have an id');
    assert.ok(lastEntry.timestamp, 'Log entry should have a timestamp');
  });

  test('capture-feedback.js --feedback=down exits 0', () => {
    const scriptPath = path.join(tmpDir, '.rlhf', 'capture-feedback.js');
    const result = spawnSync(
      process.execPath,
      [
        scriptPath,
        '--feedback=down',
        '--context=something went wrong',
        '--what-went-wrong=test failure',
        '--what-to-change=fix the thing',
      ],
      { encoding: 'utf8', cwd: tmpDir }
    );
    assert.strictEqual(result.status, 0);
    assert.ok(result.stdout.includes('[down]'));
  });

  test('capture-feedback.js missing --feedback exits 1', () => {
    const scriptPath = path.join(tmpDir, '.rlhf', 'capture-feedback.js');
    const result = spawnSync(process.execPath, [scriptPath, '--context=no signal'], {
      encoding: 'utf8',
      cwd: tmpDir,
    });
    assert.strictEqual(result.status, 1, 'Should exit 1 when --feedback is missing');
  });

  test('init is idempotent — running twice exits 0', () => {
    const result = spawnSync(process.execPath, [CLI, 'init'], {
      encoding: 'utf8',
      cwd: tmpDir,
    });
    assert.strictEqual(result.status, 0, `Second init failed:\n${result.stderr}`);
    assert.ok(result.stdout.includes('Setup complete') || result.stdout.includes('already exists'));
  });
});
