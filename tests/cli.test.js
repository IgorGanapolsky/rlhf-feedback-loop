'use strict';

/**
 * Tests for bin/cli.js — npx rlhf-feedback-loop
 *
 * Verifies:
 *   1. CLI runs without error
 *   2. init command creates .rlhf/ directory with config.json
 *   3. init command creates/updates .mcp.json with server entry
 *   4. help command exits 0 with usage text listing subcommands
 *   5. Unknown command exits 1
 *   6. capture subcommand routes to the full engine
 *   7. init is idempotent
 */

const { spawnSync, spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');

const CLI = path.resolve(__dirname, '../bin/cli.js');

function makeTmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'rlhf-cli-test-'));
}

function frameMcpMessage(payload) {
  const body = JSON.stringify(payload);
  return `Content-Length: ${Buffer.byteLength(body, 'utf8')}\r\n\r\n${body}`;
}

function findHeaderBoundary(text) {
  const crlf = text.indexOf('\r\n\r\n');
  const lf = text.indexOf('\n\n');
  if (crlf === -1 && lf === -1) return null;
  if (crlf === -1) return { index: lf, separatorLen: 2 };
  if (lf === -1) return { index: crlf, separatorLen: 4 };
  return crlf < lf ? { index: crlf, separatorLen: 4 } : { index: lf, separatorLen: 2 };
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
    assert.ok(stat.mode & 0o100, 'CLI should have executable bit set');
  });

  test('help command exits 0 and lists subcommands', () => {
    const result = spawnSync(process.execPath, [CLI, 'help'], { encoding: 'utf8' });
    assert.strictEqual(result.status, 0, `Expected exit 0, got ${result.status}\n${result.stderr}`);
    assert.ok(result.stdout.includes('rlhf-feedback-loop'), 'Help should include CLI name');
    assert.ok(result.stdout.includes('init'), 'Help should mention init');
    assert.ok(result.stdout.includes('capture'), 'Help should mention capture');
    assert.ok(result.stdout.includes('export-dpo'), 'Help should mention export-dpo');
    assert.ok(result.stdout.includes('stats'), 'Help should mention stats');
    assert.ok(result.stdout.includes('rules'), 'Help should mention rules');
    assert.ok(result.stdout.includes('self-heal'), 'Help should mention self-heal');
    assert.ok(result.stdout.includes('prove'), 'Help should mention prove');
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

  test('init creates .mcp.json with server entry', () => {
    const mcpPath = path.join(tmpDir, '.mcp.json');
    assert.ok(fs.existsSync(mcpPath), '.mcp.json should be created');
    const mcp = JSON.parse(fs.readFileSync(mcpPath, 'utf8'));
    assert.ok(mcp.mcpServers, '.mcp.json should have mcpServers');
    assert.ok(mcp.mcpServers['rlhf-feedback-loop'], 'Should have rlhf-feedback-loop server entry');
    assert.strictEqual(mcp.mcpServers['rlhf-feedback-loop'].command, 'node');
    assert.ok(mcp.mcpServers['rlhf-feedback-loop'].args[0].includes('server-stdio.js'));
  });

  test('init output includes initialized message and platform detection', () => {
    const result = spawnSync(process.execPath, [CLI, 'init'], {
      encoding: 'utf8',
      cwd: tmpDir,
    });
    assert.ok(
      result.stdout.includes('initialized'),
      `Expected "initialized" in output:\n${result.stdout}`
    );
    assert.ok(
      result.stdout.includes('Detecting platforms'),
      `Expected platform detection in output:\n${result.stdout}`
    );
  });

  test('capture --feedback=up routes to full engine', () => {
    const result = spawnSync(
      process.execPath,
      [CLI, 'capture', '--feedback=up', '--context=cli test verification'],
      { encoding: 'utf8', cwd: path.resolve(__dirname, '..') }
    );
    // Exit 0 (promoted) or 2 (captured but not promoted) are both valid
    assert.notEqual(result.status, 1, `capture should not exit 1:\n${result.stderr}`);
  });

  test('capture --feedback=down routes to full engine', () => {
    const result = spawnSync(
      process.execPath,
      [CLI, 'capture', '--feedback=down', '--context=test failure', '--what-went-wrong=broke it'],
      { encoding: 'utf8', cwd: path.resolve(__dirname, '..') }
    );
    assert.notEqual(result.status, 1, `capture should not exit 1:\n${result.stderr}`);
  });

  test('serve starts MCP stdio server and responds to initialize handshake', async () => {
    const child = spawn(process.execPath, [CLI, 'serve'], {
      cwd: tmpDir,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stdoutBuffer = '';
    let stderrBuffer = '';
    let settled = false;

    const finalize = (resolve, reject, value, isError = false) => {
      if (settled) return;
      settled = true;
      try {
        child.kill('SIGKILL');
      } catch (_) {
        // no-op
      }
      if (isError) reject(value);
      else resolve(value);
    };

    const response = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        finalize(resolve, reject, new Error(`MCP initialize timeout; stderr=${stderrBuffer}`), true);
      }, 5000);

      child.stderr.on('data', (chunk) => {
        stderrBuffer += String(chunk || '');
      });

      child.stdout.on('data', (chunk) => {
        stdoutBuffer += String(chunk || '');
        const boundary = findHeaderBoundary(stdoutBuffer);
        if (!boundary) return;
        const header = stdoutBuffer.slice(0, boundary.index);
        const match = header.match(/Content-Length:\s*(\d+)/i);
        if (!match) return;
        const length = Number(match[1]);
        const bodyStart = boundary.index + boundary.separatorLen;
        const body = stdoutBuffer.slice(bodyStart, bodyStart + length);
        if (Buffer.byteLength(body, 'utf8') < length) return;

        clearTimeout(timer);
        try {
          const parsed = JSON.parse(body);
          finalize(resolve, reject, parsed, false);
        } catch (err) {
          finalize(resolve, reject, err, true);
        }
      });

      child.stdin.write(frameMcpMessage({
        jsonrpc: '2.0',
        id: 99,
        method: 'initialize',
        params: {},
      }));
    });

    assert.equal(response.id, 99);
    assert.equal(response.result.serverInfo.name, 'rlhf-feedback-loop-mcp');
  });

  test('init is idempotent — running twice exits 0', () => {
    const result = spawnSync(process.execPath, [CLI, 'init'], {
      encoding: 'utf8',
      cwd: tmpDir,
    });
    assert.strictEqual(result.status, 0, `Second init failed:\n${result.stderr}`);
    assert.ok(result.stdout.includes('initialized') || result.stdout.includes('already exists'));
  });
});
