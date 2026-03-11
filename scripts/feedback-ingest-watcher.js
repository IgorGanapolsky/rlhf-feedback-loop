#!/usr/bin/env node
/**
 * Feedback JSONL Ingest Watcher
 *
 * Closes the gap where external plugins (Amp rlhf-bridge, etc.) write raw
 * JSONL to feedback-log.jsonl, bypassing captureFeedback(). This watcher
 * tails the log file, detects unprocessed entries (those lacking an
 * `actionType` field — which captureFeedback always sets), and re-ingests
 * them through the full pipeline so all 7 downstream systems fire:
 *
 *   1. Schema validation          ✅
 *   2. Memory promotion           ✅
 *   3. Vector indexing (recall)    ✅
 *   4. DPO/KTO export             ✅
 *   5. Prevention rules           ✅
 *   6. feedback_stats / summary   ✅ (already worked)
 *   7. feedback-log.jsonl write   ✅ (already worked)
 *
 * Modes:
 *   --watch     Start fs.watchFile polling (default interval 2s)
 *   --once      Single pass: ingest any unprocessed entries, then exit
 *   --test      Run built-in tests
 *
 * Zero changes required in the Amp plugin.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { captureFeedback, readJSONL, getFeedbackPaths } = require('./feedback-loop');

const INGEST_MARKER = '__ingested';
const POLL_INTERVAL_MS = Number(process.env.RLHF_WATCH_INTERVAL) || 2000;

/**
 * Detect entries that were written directly (by external plugins) and
 * never processed through captureFeedback().
 *
 * Heuristic: captureFeedback always sets `actionType` on every entry.
 * Raw external writes (e.g., appendFileSync from rlhf-bridge.ts) won't
 * have it. We also skip entries we've already ingested (marked with
 * __ingested: true) to prevent infinite loops.
 */
function isUnprocessed(entry) {
  if (!entry || typeof entry !== 'object') return false;
  if (entry[INGEST_MARKER]) return false;
  if (entry.actionType) return false;
  // Must have a signal to be ingestable
  if (!entry.signal) return false;
  return true;
}

/**
 * Convert a raw external entry into captureFeedback params.
 */
function toFeedbackParams(entry) {
  return {
    signal: entry.signal,
    context: entry.context || entry.reason || '',
    whatWentWrong: entry.whatWentWrong || entry.what_went_wrong || undefined,
    whatToChange: entry.whatToChange || entry.what_to_change || undefined,
    whatWorked: entry.whatWorked || entry.what_worked || undefined,
    tags: Array.isArray(entry.tags) ? [...entry.tags, 'ingested'] : ['ingested'],
    skill: entry.skill || undefined,
    rubricScores: entry.rubricScores || undefined,
    guardrails: entry.guardrails || undefined,
  };
}

/**
 * Single-pass ingest: read the log, find unprocessed entries, run them
 * through captureFeedback, and mark them as ingested in-place.
 *
 * Returns { ingested: number, skipped: number, errors: string[] }
 */
function ingestOnce(feedbackDir) {
  const paths = feedbackDir
    ? { FEEDBACK_LOG_PATH: path.join(feedbackDir, 'feedback-log.jsonl') }
    : getFeedbackPaths();

  const logPath = paths.FEEDBACK_LOG_PATH;
  if (!fs.existsSync(logPath)) {
    return { ingested: 0, skipped: 0, errors: [] };
  }

  const entries = readJSONL(logPath);
  const unprocessed = [];
  const indices = [];

  entries.forEach((entry, idx) => {
    if (isUnprocessed(entry)) {
      unprocessed.push(entry);
      indices.push(idx);
    }
  });

  if (unprocessed.length === 0) {
    return { ingested: 0, skipped: entries.length, errors: [] };
  }

  let ingested = 0;
  const errors = [];

  // Set env to target the right feedback dir if custom
  const prevEnv = process.env.RLHF_FEEDBACK_DIR;
  if (feedbackDir) {
    process.env.RLHF_FEEDBACK_DIR = feedbackDir;
  }

  try {
    for (let i = 0; i < unprocessed.length; i++) {
      const entry = unprocessed[i];
      try {
        const params = toFeedbackParams(entry);
        const result = captureFeedback(params);
        // Mark the original entry as ingested
        entries[indices[i]][INGEST_MARKER] = true;
        entries[indices[i]]._ingestResult = result.accepted ? 'promoted' : (result.status || 'rejected');
        ingested++;
      } catch (err) {
        errors.push(`Entry ${indices[i]}: ${err.message}`);
        entries[indices[i]][INGEST_MARKER] = true;
        entries[indices[i]]._ingestResult = 'error';
      }
    }

    // Rewrite the log with ingested markers so we don't re-process
    const rewritten = entries.map(e => JSON.stringify(e)).join('\n') + '\n';
    fs.writeFileSync(logPath, rewritten);
  } finally {
    if (feedbackDir) {
      if (prevEnv !== undefined) {
        process.env.RLHF_FEEDBACK_DIR = prevEnv;
      } else {
        delete process.env.RLHF_FEEDBACK_DIR;
      }
    }
  }

  return { ingested, skipped: entries.length - unprocessed.length, errors };
}

/**
 * Watch mode: poll the feedback log and ingest new entries.
 */
function startWatcher(feedbackDir) {
  const paths = feedbackDir
    ? { FEEDBACK_LOG_PATH: path.join(feedbackDir, 'feedback-log.jsonl') }
    : getFeedbackPaths();

  const logPath = paths.FEEDBACK_LOG_PATH;
  console.log(`[ingest-watcher] Watching ${logPath} (poll: ${POLL_INTERVAL_MS}ms)`);

  let lastSize = fs.existsSync(logPath) ? fs.statSync(logPath).size : 0;

  const interval = setInterval(() => {
    try {
      if (!fs.existsSync(logPath)) return;
      const currentSize = fs.statSync(logPath).size;
      if (currentSize <= lastSize) {
        lastSize = currentSize;
        return;
      }
      lastSize = currentSize;

      const result = ingestOnce(feedbackDir);
      if (result.ingested > 0) {
        console.log(`[ingest-watcher] Ingested ${result.ingested} entries`);
        if (result.errors.length > 0) {
          console.warn(`[ingest-watcher] Errors: ${result.errors.join('; ')}`);
        }
      }
    } catch (err) {
      console.error(`[ingest-watcher] Error: ${err.message}`);
    }
  }, POLL_INTERVAL_MS);

  // Initial pass
  const initial = ingestOnce(feedbackDir);
  if (initial.ingested > 0) {
    console.log(`[ingest-watcher] Initial ingest: ${initial.ingested} entries`);
  }

  return { interval, stop: () => clearInterval(interval) };
}

// ---------------------------------------------------------------------------
// Built-in Tests
// ---------------------------------------------------------------------------

function runTests() {
  const os = require('os');
  let passed = 0;
  let failed = 0;

  function assert(cond, name) {
    if (cond) { passed++; console.log(`  ✅ ${name}`); }
    else { failed++; console.log(`  ❌ ${name}`); }
  }

  console.log('\n🧪 feedback-ingest-watcher.js — Tests\n');

  // Test 1: isUnprocessed detects raw external entries
  assert(isUnprocessed({ signal: 'up', context: 'test' }), 'raw entry is unprocessed');
  assert(!isUnprocessed({ signal: 'up', actionType: 'store-learning' }), 'captureFeedback entry is processed');
  assert(!isUnprocessed({ signal: 'up', __ingested: true }), 'already-ingested entry is skipped');
  assert(!isUnprocessed({ context: 'no signal' }), 'entry without signal is skipped');
  assert(!isUnprocessed(null), 'null is skipped');

  // Test 2: toFeedbackParams maps fields correctly
  const params = toFeedbackParams({
    signal: 'down',
    context: 'broke the build',
    whatWentWrong: 'no tests',
    tags: ['ci'],
    skill: 'build-fix',
  });
  assert(params.signal === 'down', 'maps signal');
  assert(params.context === 'broke the build', 'maps context');
  assert(params.whatWentWrong === 'no tests', 'maps whatWentWrong');
  assert(params.tags.includes('ci'), 'preserves original tags');
  assert(params.tags.includes('ingested'), 'adds ingested tag');
  assert(params.skill === 'build-fix', 'maps skill');

  // Test 3: ingestOnce processes raw entries through full pipeline
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ingest-test-'));
  const logPath = path.join(tmpDir, 'feedback-log.jsonl');

  // Write raw entries (simulating Amp plugin appendFileSync)
  const rawEntries = [
    { signal: 'up', context: 'Agent ran tests before claiming done', whatWorked: 'Evidence-first workflow', tags: ['verification'], source: 'amp-plugin-bridge' },
    { signal: 'down', context: 'Agent fabricated test output', whatWentWrong: 'Showed fake passing tests', whatToChange: 'Always run actual commands', tags: ['verification'], source: 'amp-plugin-bridge' },
    { signal: 'up' }, // vague — should be ingested but rejected by captureFeedback
  ];
  fs.writeFileSync(logPath, rawEntries.map(e => JSON.stringify(e)).join('\n') + '\n');

  const result = ingestOnce(tmpDir);
  assert(result.ingested === 3, `ingestOnce processed all 3 raw entries (got ${result.ingested})`);
  assert(result.errors.length === 0, 'no errors during ingest');

  // Verify entries are now marked as ingested
  const postEntries = readJSONL(logPath);
  const unmarked = postEntries.filter(e => !e[INGEST_MARKER] && !e.actionType);
  // Original raw entries should be marked, plus captureFeedback wrote new entries
  const markedCount = postEntries.filter(e => e[INGEST_MARKER]).length;
  assert(markedCount >= 3, `original entries marked as ingested (${markedCount})`);

  // Verify memory-log.jsonl was created (memory promotion happened)
  const memPath = path.join(tmpDir, 'memory-log.jsonl');
  const memExists = fs.existsSync(memPath);
  assert(memExists, 'memory-log.jsonl created (memory promotion fired)');
  if (memExists) {
    const memories = readJSONL(memPath);
    assert(memories.length >= 1, `memories promoted (${memories.length})`);
  }

  // Test 4: Second ingestOnce is idempotent — nothing new to process
  const result2 = ingestOnce(tmpDir);
  // The newly-written captureFeedback entries have actionType, so they're skipped.
  // The originals have __ingested, so they're skipped.
  assert(result2.ingested === 0, 'second pass is idempotent');

  // Cleanup
  fs.rmSync(tmpDir, { recursive: true, force: true });

  console.log(`\n${'═'.repeat(50)}`);
  console.log(`Results: ${passed} passed, ${failed} failed, ${passed + failed} total`);
  console.log(`${'═'.repeat(50)}\n`);
  process.exit(failed > 0 ? 1 : 0);
}

// ---------------------------------------------------------------------------
// Exports & CLI
// ---------------------------------------------------------------------------

module.exports = { ingestOnce, startWatcher, isUnprocessed, toFeedbackParams };

if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.includes('--test')) {
    runTests();
  } else if (args.includes('--once')) {
    const result = ingestOnce();
    console.log(JSON.stringify(result, null, 2));
    process.exit(result.errors.length > 0 ? 1 : 0);
  } else {
    // Default: watch mode
    startWatcher();
  }
}
