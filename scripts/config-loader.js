#!/usr/bin/env node
'use strict';

/**
 * Config Loader — Centralized Path and Environment Management
 * 
 * Provides a single source of truth for:
 * - Local data paths (.rlhf, .claude/memory)
 * - Environment variable fallbacks
 * - Global system constants
 */

const path = require('path');
const fs = require('fs');

const PROJECT_ROOT = path.resolve(__dirname, '..');

/**
 * Resolve the feedback directory.
 * Priority: 
 * 1. process.env.RLHF_FEEDBACK_DIR
 * 2. .rlhf/ (local project)
 * 3. .claude/memory/feedback/ (legacy)
 * 4. ~/.rlhf/ (global fallback)
 */
function resolveFeedbackDir() {
  if (process.env.RLHF_FEEDBACK_DIR) {
    return path.resolve(process.env.RLHF_FEEDBACK_DIR);
  }

  const localRlhf = path.join(PROJECT_ROOT, '.rlhf');
  if (fs.existsSync(localRlhf)) {
    return localRlhf;
  }

  const legacyClaudeMemory = path.join(PROJECT_ROOT, '.claude', 'memory', 'feedback');
  if (fs.existsSync(legacyClaudeMemory)) {
    return legacyClaudeMemory;
  }

  const homeRlhf = path.join(process.env.HOME || '/tmp', '.rlhf');
  return homeRlhf;
}

// Dynamic PATHS object to support test environment overrides
const PATHS = {
  get PROJECT_ROOT() { return PROJECT_ROOT; },
  get FEEDBACK_DIR() { return resolveFeedbackDir(); },
  get MEMORY_LOG_PATH() { return path.join(this.FEEDBACK_DIR, 'memory-log.jsonl'); },
  get FEEDBACK_LOG_PATH() { return path.join(this.FEEDBACK_DIR, 'feedback-log.jsonl'); },
  get SUMMARY_PATH() { return path.join(this.FEEDBACK_DIR, 'feedback-summary.json'); },
  get PREVENTION_RULES_PATH() { return path.join(this.FEEDBACK_DIR, 'prevention-rules.md'); },
  get USAGE_FILE() { return path.join(this.FEEDBACK_DIR, 'usage-limits.json'); },
  get API_KEYS_PATH() { return path.join(this.FEEDBACK_DIR, 'api-keys.json'); },
  get FUNNEL_LEDGER_PATH() { return path.join(this.FEEDBACK_DIR, 'funnel-events.jsonl'); },
  get REVENUE_LEDGER_PATH() { return path.join(this.FEEDBACK_DIR, 'revenue-events.jsonl'); },
  get LOCAL_CHECKOUT_SESSIONS_PATH() { return path.join(this.FEEDBACK_DIR, 'local-checkout-sessions.json'); },
  get GATES_CONFIG() { return path.join(PROJECT_ROOT, 'config', 'gates', 'default.json'); },
  get AUTO_GATES_PATH() { return path.join(PROJECT_ROOT, 'config', 'gates', 'auto-promoted.json'); },
};

const CONSTANTS = {
  FREE_TIER_LIMIT: 5,
  MAX_RETRIES: 3,
  get DEFAULT_PORT() { return process.env.PORT || 3000; },
};

module.exports = {
  PATHS,
  CONSTANTS,
  resolveFeedbackDir,
};
