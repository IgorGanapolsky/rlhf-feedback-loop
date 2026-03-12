#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const DEFAULT_CONFIG_PATH = path.join(__dirname, '..', 'config', 'gates', 'default.json');
const STATE_PATH = path.join(process.env.HOME || '/tmp', '.rlhf', 'gate-state.json');
const STATS_PATH = path.join(process.env.HOME || '/tmp', '.rlhf', 'gate-stats.json');
const TTL_MS = 5 * 60 * 1000; // 5 minutes

// ---------------------------------------------------------------------------
// Config loading
// ---------------------------------------------------------------------------

function loadGatesConfig(configPath) {
  const resolved = configPath || process.env.RLHF_GATES_CONFIG || DEFAULT_CONFIG_PATH;
  if (!fs.existsSync(resolved)) {
    throw new Error(`Gates config not found: ${resolved}`);
  }
  const raw = fs.readFileSync(resolved, 'utf8');
  const config = JSON.parse(raw);
  if (!config || !Array.isArray(config.gates)) {
    throw new Error('Invalid gates config: missing "gates" array');
  }
  return config;
}

// ---------------------------------------------------------------------------
// State management (unless conditions)
// ---------------------------------------------------------------------------

function loadState() {
  if (!fs.existsSync(STATE_PATH)) return {};
  try {
    return JSON.parse(fs.readFileSync(STATE_PATH, 'utf8'));
  } catch {
    return {};
  }
}

function saveState(state) {
  fs.mkdirSync(path.dirname(STATE_PATH), { recursive: true });
  fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2) + '\n');
}

function isConditionSatisfied(conditionId) {
  const state = loadState();
  const entry = state[conditionId];
  if (!entry) return false;
  const age = Date.now() - entry.timestamp;
  return age < TTL_MS;
}

function satisfyCondition(conditionId, evidence) {
  const state = loadState();
  state[conditionId] = {
    timestamp: Date.now(),
    evidence: evidence || '',
  };
  saveState(state);
  return state[conditionId];
}

// ---------------------------------------------------------------------------
// Stats tracking
// ---------------------------------------------------------------------------

function loadStats() {
  if (!fs.existsSync(STATS_PATH)) return { blocked: 0, warned: 0, passed: 0, byGate: {} };
  try {
    return JSON.parse(fs.readFileSync(STATS_PATH, 'utf8'));
  } catch {
    return { blocked: 0, warned: 0, passed: 0, byGate: {} };
  }
}

function saveStats(stats) {
  fs.mkdirSync(path.dirname(STATS_PATH), { recursive: true });
  fs.writeFileSync(STATS_PATH, JSON.stringify(stats, null, 2) + '\n');
}

function recordStat(gateId, action) {
  const stats = loadStats();
  if (action === 'block') stats.blocked = (stats.blocked || 0) + 1;
  else if (action === 'warn') stats.warned = (stats.warned || 0) + 1;
  else stats.passed = (stats.passed || 0) + 1;
  if (!stats.byGate) stats.byGate = {};
  if (!stats.byGate[gateId]) stats.byGate[gateId] = { blocked: 0, warned: 0 };
  if (action === 'block') stats.byGate[gateId].blocked += 1;
  else if (action === 'warn') stats.byGate[gateId].warned += 1;
  saveStats(stats);
}

// ---------------------------------------------------------------------------
// Matching engine
// ---------------------------------------------------------------------------

function matchesGate(gate, toolName, toolInput) {
  // Build the text to match against: for Bash it's the command, for Edit it's the file path
  const text = toolInput.command || toolInput.file_path || toolInput.path || '';
  try {
    const regex = new RegExp(gate.pattern);
    return regex.test(text);
  } catch {
    return false;
  }
}

function evaluateGates(toolName, toolInput, configPath) {
  let config;
  try {
    config = loadGatesConfig(configPath);
  } catch {
    // If config can't be loaded, pass through
    return null;
  }

  for (const gate of config.gates) {
    if (!matchesGate(gate, toolName, toolInput)) continue;

    // Check unless condition
    if (gate.unless && isConditionSatisfied(gate.unless)) {
      continue;
    }

    if (gate.action === 'block') {
      recordStat(gate.id, 'block');
      return {
        decision: 'deny',
        gate: gate.id,
        message: gate.message,
        severity: gate.severity,
      };
    }

    if (gate.action === 'warn') {
      recordStat(gate.id, 'warn');
      return {
        decision: 'warn',
        gate: gate.id,
        message: gate.message,
        severity: gate.severity,
      };
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// PreToolUse hook interface (stdin/stdout JSON)
// ---------------------------------------------------------------------------

function formatOutput(result) {
  if (!result) {
    // No gate matched — pass through
    return JSON.stringify({});
  }

  if (result.decision === 'deny') {
    return JSON.stringify({
      hookSpecificOutput: {
        permissionDecision: 'deny',
        permissionDecisionReason: `[GATE:${result.gate}] ${result.message}`,
      },
    });
  }

  if (result.decision === 'warn') {
    return JSON.stringify({
      hookSpecificOutput: {
        additionalContext: `[GATE:${result.gate}] WARNING: ${result.message}`,
      },
    });
  }

  return JSON.stringify({});
}

function run(input) {
  const toolName = input.tool_name || '';
  const toolInput = input.tool_input || {};
  const result = evaluateGates(toolName, toolInput);
  return formatOutput(result);
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = {
  loadGatesConfig,
  loadState,
  saveState,
  isConditionSatisfied,
  satisfyCondition,
  loadStats,
  saveStats,
  recordStat,
  matchesGate,
  evaluateGates,
  formatOutput,
  run,
  DEFAULT_CONFIG_PATH,
  STATE_PATH,
  STATS_PATH,
  TTL_MS,
};

// ---------------------------------------------------------------------------
// CLI: reads PreToolUse hook JSON from stdin
// ---------------------------------------------------------------------------

if (require.main === module) {
  let data = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (chunk) => { data += chunk; });
  process.stdin.on('end', () => {
    try {
      const input = JSON.parse(data);
      const output = run(input);
      process.stdout.write(output + '\n');
      process.exit(0);
    } catch (err) {
      process.stderr.write(`gates-engine error: ${err.message}\n`);
      process.stdout.write(JSON.stringify({}) + '\n');
      process.exit(0);
    }
  });
}
