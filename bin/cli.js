#!/usr/bin/env node
/**
 * rlhf-feedback-loop CLI
 *
 * Usage:
 *   npx rlhf-feedback-loop init          # scaffold .rlhf/ config + .mcp.json
 *   npx rlhf-feedback-loop capture       # capture feedback
 *   npx rlhf-feedback-loop export-dpo    # export DPO training pairs
 *   npx rlhf-feedback-loop stats         # feedback analytics
 *   npx rlhf-feedback-loop rules         # generate prevention rules
 *   npx rlhf-feedback-loop self-heal     # run self-healing check + fix
 *   npx rlhf-feedback-loop prove         # run proof harness
 *   npx rlhf-feedback-loop start-api     # start HTTPS API server
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const COMMAND = process.argv[2];
const CWD = process.cwd();
const PKG_ROOT = path.join(__dirname, '..');

function parseArgs(argv) {
  const args = {};
  argv.forEach((arg) => {
    if (!arg.startsWith('--')) return;
    const [key, ...rest] = arg.slice(2).split('=');
    args[key] = rest.length ? rest.join('=') : true;
  });
  return args;
}

function pkgVersion() {
  const pkg = JSON.parse(fs.readFileSync(path.join(PKG_ROOT, 'package.json'), 'utf8'));
  return pkg.version;
}

function init() {
  const rlhfDir = path.join(CWD, '.rlhf');

  // Create directory
  if (!fs.existsSync(rlhfDir)) {
    fs.mkdirSync(rlhfDir, { recursive: true });
    console.log('Created .rlhf/');
  } else {
    console.log('.rlhf/ already exists — updating config');
  }

  // Write config.json (minimal — engine lives in node_modules)
  const config = {
    version: pkgVersion(),
    apiUrl: process.env.RLHF_API_URL || 'http://localhost:3000',
    logPath: '.rlhf/feedback-log.jsonl',
    memoryPath: '.rlhf/memory-log.jsonl',
    createdAt: new Date().toISOString(),
  };

  const configPath = path.join(rlhfDir, 'config.json');
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');
  console.log('Wrote .rlhf/config.json');

  // Detect platform and offer adapter setup
  const mcpJsonPath = path.join(CWD, '.mcp.json');
  const mcpServerPath = path.relative(CWD, path.join(PKG_ROOT, 'adapters', 'mcp', 'server-stdio.js'));

  if (!fs.existsSync(mcpJsonPath)) {
    const mcpConfig = {
      mcpServers: {
        'rlhf-feedback-loop': {
          command: 'node',
          args: [mcpServerPath],
        },
      },
    };
    fs.writeFileSync(mcpJsonPath, JSON.stringify(mcpConfig, null, 2) + '\n');
    console.log('Wrote .mcp.json (MCP server for Claude/Codex)');
  } else {
    const existing = JSON.parse(fs.readFileSync(mcpJsonPath, 'utf8'));
    if (!existing.mcpServers || !existing.mcpServers['rlhf-feedback-loop']) {
      existing.mcpServers = existing.mcpServers || {};
      existing.mcpServers['rlhf-feedback-loop'] = {
        command: 'node',
        args: [mcpServerPath],
      };
      fs.writeFileSync(mcpJsonPath, JSON.stringify(existing, null, 2) + '\n');
      console.log('Updated .mcp.json with rlhf-feedback-loop server');
    } else {
      console.log('.mcp.json already has rlhf-feedback-loop server');
    }
  }

  // Add data paths to .gitignore
  const gitignorePath = path.join(CWD, '.gitignore');
  if (fs.existsSync(gitignorePath)) {
    const gitignore = fs.readFileSync(gitignorePath, 'utf8');
    const entries = ['.rlhf/feedback-log.jsonl', '.rlhf/memory-log.jsonl'];
    const missing = entries.filter((e) => !gitignore.includes(e));
    if (missing.length > 0) {
      fs.appendFileSync(gitignorePath, '\n# RLHF local feedback data\n' + missing.join('\n') + '\n');
      console.log('Updated .gitignore with RLHF data paths');
    }
  }

  console.log('');
  console.log(`rlhf-feedback-loop v${pkgVersion()} initialized.`);
  console.log('');
  console.log('Quick start:');
  console.log('  npx rlhf-feedback-loop capture --feedback=up --context="tests pass"');
  console.log('  npx rlhf-feedback-loop capture --feedback=down --context="missed edge case"');
  console.log('  npx rlhf-feedback-loop stats');
  console.log('  npx rlhf-feedback-loop export-dpo');
  console.log('');
  console.log('All commands: npx rlhf-feedback-loop help');
}

function capture() {
  const args = parseArgs(process.argv.slice(3));

  // Delegate to the full engine
  const { captureFeedback, analyzeFeedback, feedbackSummary, writePreventionRules } = require(path.join(PKG_ROOT, 'scripts', 'feedback-loop'));

  if (args.stats) {
    console.log(JSON.stringify(analyzeFeedback(), null, 2));
    return;
  }

  if (args.summary) {
    console.log(feedbackSummary(Number(args.recent || 20)));
    return;
  }

  // Normalize signal with fuzzy matching (uses the full engine's normalize)
  const captureScript = require(path.join(PKG_ROOT, '.claude', 'scripts', 'feedback', 'capture-feedback.js'));
  // The capture-feedback.js runs as main when required directly, so we call via subprocess
  const scriptArgs = process.argv.slice(3).join(' ');
  try {
    const output = execSync(
      `node "${path.join(PKG_ROOT, '.claude', 'scripts', 'feedback', 'capture-feedback.js')}" ${scriptArgs}`,
      { encoding: 'utf8', stdio: 'pipe', cwd: CWD }
    );
    process.stdout.write(output);
  } catch (err) {
    process.stderr.write(err.stderr || err.stdout || err.message);
    process.exit(err.status || 1);
  }
}

function stats() {
  const { analyzeFeedback } = require(path.join(PKG_ROOT, 'scripts', 'feedback-loop'));
  console.log(JSON.stringify(analyzeFeedback(), null, 2));
}

function summary() {
  const args = parseArgs(process.argv.slice(3));
  const { feedbackSummary } = require(path.join(PKG_ROOT, 'scripts', 'feedback-loop'));
  console.log(feedbackSummary(Number(args.recent || 20)));
}

function exportDpo() {
  try {
    const output = execSync(
      `node "${path.join(PKG_ROOT, 'scripts', 'export-dpo-pairs.js')}"`,
      { encoding: 'utf8', stdio: 'pipe', cwd: CWD }
    );
    process.stdout.write(output);
  } catch (err) {
    process.stderr.write(err.stderr || err.stdout || err.message);
    process.exit(err.status || 1);
  }
}

function rules() {
  const args = parseArgs(process.argv.slice(3));
  const { writePreventionRules } = require(path.join(PKG_ROOT, 'scripts', 'feedback-loop'));
  const outPath = args.output || path.join(CWD, '.rlhf', 'prevention-rules.md');
  const result = writePreventionRules(outPath, Number(args.min || 2));
  console.log(`Wrote prevention rules to ${result.path}`);
}

function selfHeal() {
  try {
    const output = execSync(
      `node "${path.join(PKG_ROOT, 'scripts', 'self-healing-check.js')}" && node "${path.join(PKG_ROOT, 'scripts', 'self-heal.js')}"`,
      { encoding: 'utf8', stdio: 'inherit', cwd: CWD }
    );
  } catch (err) {
    process.exit(err.status || 1);
  }
}

function prove() {
  const args = parseArgs(process.argv.slice(3));
  const target = args.target || 'adapters';
  const script = path.join(PKG_ROOT, 'scripts', `prove-${target}.js`);
  if (!fs.existsSync(script)) {
    console.error(`Unknown proof target: ${target}`);
    console.error('Available: adapters, automation, attribution, lancedb, data-quality, intelligence, loop-closure, training-export');
    process.exit(1);
  }
  try {
    execSync(`node "${script}"`, { encoding: 'utf8', stdio: 'inherit', cwd: CWD });
  } catch (err) {
    process.exit(err.status || 1);
  }
}

function startApi() {
  const serverPath = path.join(PKG_ROOT, 'scripts', 'feedback-loop.js');
  try {
    execSync(`node "${serverPath}" --serve`, { stdio: 'inherit', cwd: CWD });
  } catch (err) {
    process.exit(err.status || 1);
  }
}

function help() {
  const v = pkgVersion();
  console.log(`rlhf-feedback-loop v${v}`);
  console.log('');
  console.log('Commands:');
  console.log('  init                  Scaffold .rlhf/ config + MCP server in current project');
  console.log('  capture [flags]       Capture feedback (--feedback=up|down --context="..." --tags="...")');
  console.log('  stats                 Show feedback analytics');
  console.log('  summary               Human-readable feedback summary');
  console.log('  export-dpo            Export DPO training pairs (prompt/chosen/rejected JSONL)');
  console.log('  rules                 Generate prevention rules from repeated failures');
  console.log('  self-heal             Run self-healing check and auto-fix');
  console.log('  prove [--target=X]    Run proof harness (adapters|automation|attribution|lancedb|...)');
  console.log('  start-api             Start the RLHF HTTPS API server');
  console.log('  help                  Show this help message');
  console.log('');
  console.log('Examples:');
  console.log('  npx rlhf-feedback-loop init');
  console.log('  npx rlhf-feedback-loop capture --feedback=up --context="all tests pass"');
  console.log('  npx rlhf-feedback-loop capture --feedback=down --context="broke prod" --what-went-wrong="no tests"');
  console.log('  npx rlhf-feedback-loop export-dpo');
  console.log('  npx rlhf-feedback-loop stats');
}

switch (COMMAND) {
  case 'init':
    init();
    break;
  case 'capture':
  case 'feedback':
    capture();
    break;
  case 'stats':
    stats();
    break;
  case 'summary':
    summary();
    break;
  case 'export-dpo':
  case 'dpo':
    exportDpo();
    break;
  case 'rules':
    rules();
    break;
  case 'self-heal':
    selfHeal();
    break;
  case 'prove':
    prove();
    break;
  case 'start-api':
  case 'serve':
    startApi();
    break;
  case 'help':
  case '--help':
  case '-h':
    help();
    break;
  default:
    if (COMMAND) {
      console.error(`Unknown command: ${COMMAND}`);
      console.error('Run: npx rlhf-feedback-loop help');
      process.exit(1);
    } else {
      help();
    }
}
