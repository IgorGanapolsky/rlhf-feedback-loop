#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');

const DEFAULT_LOG = path.join(__dirname, '..', '.claude', 'memory', 'feedback', 'feedback-log.jsonl');
const NEG = new Set(['negative', 'negative_strong', 'down', 'thumbs_down']);
const POS = new Set(['positive', 'positive_strong', 'up', 'thumbs_up']);

function parseFeedbackFile(filePath) {
  if (!fs.existsSync(filePath)) return [];
  const entries = [];
  for (const line of fs.readFileSync(filePath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try { entries.push(JSON.parse(trimmed)); } catch { /* skip malformed */ }
  }
  return entries;
}

function classifySignal(entry) {
  const sig = (entry.signal || entry.feedback || '').toLowerCase();
  if (NEG.has(sig)) return 'negative';
  if (POS.has(sig)) return 'positive';
  return null;
}

function normalize(ctx) {
  return (ctx || '').replace(/\/Users\/[^\s/]+/g, '~').replace(/:[0-9]+/g, '').toLowerCase().trim();
}

function analyze(entries) {
  let positiveCount = 0, negativeCount = 0;
  const categories = {};
  const toolBuckets = {};
  const contextCounts = {};

  for (const e of entries) {
    const cls = classifySignal(e);
    if (!cls) continue;
    cls === 'positive' ? positiveCount++ : negativeCount++;

    const cat = e.task_category || e.category || 'uncategorized';
    categories[cat] = categories[cat] || { positive: 0, negative: 0, total: 0 };
    categories[cat][cls]++;
    categories[cat].total++;

    if (cls === 'negative') {
      const tool = e.tool_name || 'unknown';
      toolBuckets[tool] = (toolBuckets[tool] || 0) + 1;
      const key = normalize(e.context);
      if (key.length > 10) {
        if (!contextCounts[key]) contextCounts[key] = { raw: e.context, count: 0, tool };
        contextCounts[key].count++;
      }
    }
  }

  const total = positiveCount + negativeCount;
  const recurringIssues = Object.values(contextCounts)
    .filter(v => v.count >= 2)
    .sort((a, b) => b.count - a.count)
    .map(v => ({
      pattern: v.raw.slice(0, 120),
      count: v.count,
      severity: v.count >= 4 ? 'critical' : v.count >= 3 ? 'high' : 'medium',
      suggestedRule: `NEVER ${v.raw.slice(0, 80).replace(/CRITICAL ERROR - User frustrated: /i, '')}`,
    }));

  return {
    generatedAt: new Date().toISOString(),
    totalFeedback: total,
    negativeCount,
    positiveCount,
    negativeRate: total ? `${((negativeCount / total) * 100).toFixed(1)}%` : '0%',
    recurringIssues,
    categoryBreakdown: categories,
    topTools: toolBuckets,
  };
}

function toRules(report) {
  const lines = ['# Suggested Rules from Feedback Analysis', `# Generated: ${report.generatedAt}`, ''];
  lines.push(`# Negative rate: ${report.negativeRate} (${report.negativeCount}/${report.totalFeedback})`);
  lines.push('');
  for (const issue of report.recurringIssues) {
    lines.push(`- [${issue.severity.toUpperCase()}] (${issue.count}x) ${issue.suggestedRule}`);
  }
  if (!report.recurringIssues.length) lines.push('- No recurring issues detected.');
  return lines.join('\n');
}

if (require.main === module) {
  try {
    const logPath = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : DEFAULT_LOG;
    const entries = parseFeedbackFile(logPath);
    const report = analyze(entries);
    if (process.argv.includes('--rules')) {
      console.log(toRules(report));
    } else {
      console.log(JSON.stringify(report, null, 2));
    }
  } catch (err) {
    console.error('Warning:', err.message);
  }
  process.exit(0);
}

module.exports = { parseFeedbackFile, classifySignal, analyze, toRules, normalize };
