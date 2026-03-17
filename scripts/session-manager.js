#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { getFeedbackPaths } = require('./feedback-loop');

/**
 * Session Manager — Infinite Context Snapshotting
 * 
 * Implements the 'Priority Snapshot' pattern: 
 * Every critical task completion writes a tiny (<2KB) summary 
 * to restore model state after context window resets.
 */

function getSessionPath() {
  const { FEEDBACK_DIR } = getFeedbackPaths();
  return path.join(FEEDBACK_DIR, 'active_session.json');
}

function saveSessionSnapshot(taskSummary) {
  const sessionPath = getSessionPath();
  const dir = path.dirname(sessionPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const snapshot = {
    timestamp: new Date().toISOString(),
    lastTask: taskSummary.task || 'unknown',
    outcome: taskSummary.outcome || 'success',
    criticalDecisions: taskSummary.decisions || [],
    nextSteps: taskSummary.nextSteps || [],
    contextModeSavings: taskSummary.savings || '0KB',
    version: '1.0.0'
  };

  fs.writeFileSync(sessionPath, JSON.stringify(snapshot, null, 2));
  return snapshot;
}

/**
 * Attempt to detect momentum from external tools (KeepGoing, GStack)
 * to leverage their temporal context.
 */
function tryLoadExternalMomentum() {
  const home = process.env.HOME || '/tmp';
  const possiblePaths = [
    path.join(home, '.gstack-dev', 'e2e-live.json'),
    path.join(home, '.keepgoing', 'last-checkpoint.json')
  ];

  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      try {
        const data = JSON.parse(fs.readFileSync(p, 'utf-8'));
        return {
          source: path.basename(p),
          intent: data.intent || data.current_task || 'unknown',
          lastAction: data.last_tool_call || data.last_action || 'unknown',
          timestamp: data.timestamp || data.updated_at
        };
      } catch { /* skip malformed */ }
    }
  }
  return null;
}

function loadSessionSnapshot() {
  const sessionPath = getSessionPath();
  let local = null;
  if (fs.existsSync(sessionPath)) {
    try {
      local = JSON.parse(fs.readFileSync(sessionPath, 'utf-8'));
    } catch { /* skip */ }
  }

  const external = tryLoadExternalMomentum();
  
  if (!local && !external) return null;

  return {
    local,
    externalMomentum: external,
    mergedContext: `Restoring session momentum from ${external ? external.source : 'local cache'}. 
Last task: ${external?.intent || local?.lastTask}.
Next steps: ${(local?.nextSteps || []).join(', ')}`
  };
}

function clearSession() {
  const sessionPath = getSessionPath();
  if (fs.existsSync(sessionPath)) fs.unlinkSync(sessionPath);
}

module.exports = {
  saveSessionSnapshot,
  loadSessionSnapshot,
  clearSession
};

if (require.main === module) {
  const command = process.argv[2];
  if (command === 'show') {
    console.log(JSON.stringify(loadSessionSnapshot(), null, 2));
  } else if (command === 'clear') {
    clearSession();
    console.log('Session cleared.');
  }
}
