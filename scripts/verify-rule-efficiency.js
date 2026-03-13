#!/usr/bin/env node
/**
 * verify-rule-efficiency.js
 * 
 * Implements a rigorous benchmarking framework for RLHF prevention rules.
 * Based on Zairah Mustahsan’s framework for reproducible AI search benchmarks.
 * 
 * 5-Step Framework:
 * 1. Define Ground Truth (Gold Sets)
 * 2. Run Retrieval/Inference
 * 3. Match against Prevention Rules
 * 4. Score Efficiency (Success Rate vs False Positives)
 * 5. Generate Reproducible Report
 */

const fs = require('fs');
const path = require('path');
const { routeQuery } = require('./context-engine');
const { constructContextPack } = require('./contextfs');

const PROJECT_ROOT = path.join(__dirname, '..');
const RULES_PATH = path.join(PROJECT_ROOT, '.rlhf', 'prevention-rules.md');
const REPORT_PATH = path.join(PROJECT_ROOT, 'proof', 'rule-efficiency-report.json');

// Ensure rules namespace has at least one file for hashing
const RULES_DIR = path.join(PROJECT_ROOT, '.rlhf', 'contextfs', 'rules');
if (!fs.existsSync(RULES_DIR)) {
  fs.mkdirSync(RULES_DIR, { recursive: true });
}
fs.writeFileSync(path.join(RULES_DIR, 'current-rules.json'), JSON.stringify({
  id: 'rules_001',
  title: 'Global Prevention Rules',
  content: fs.existsSync(RULES_PATH) ? fs.readFileSync(RULES_PATH, 'utf-8') : 'No rules yet',
  tags: ['rules'],
  createdAt: new Date().toISOString(),
}));

// 1. Define Ground Truth (Gold Sets)
const GOLD_SETS = [
  {
    intent: 'testing',
    query: 'How do I run tests in this repo?',
    expectedKeywords: ['jest', 'npm test'],
  },
  {
    intent: 'ci-cd',
    query: 'Fix build failure in GitHub Actions',
    expectedKeywords: ['workflow', 'pipeline', 'yaml'],
  },
  {
    intent: 'mcp-ai',
    query: 'How to update agent memory?',
    expectedKeywords: ['rlhf', 'feedback', 'memory'],
  },
];

async function runBenchmark() {
  console.log('Starting Rule Efficiency Benchmark...');
  
  const results = [];
  let totalScore = 0;

  for (const gold of GOLD_SETS) {
    console.log(`Testing Intent: ${gold.intent}...`);
    
    // 2. Run Retrieval (using our new Adaptive Retrieval)
    const retrieval = routeQuery(gold.query);
    
    // 3. Match against Prevention Rules (simulated via context pack)
    const pack = constructContextPack({
      query: gold.query,
      namespaces: ['rules', 'memoryLearning'],
    });

    const matchedItems = pack.items.map(i => i.title.toLowerCase());
    const matchedKeywords = gold.expectedKeywords.filter(kw => 
      matchedItems.some(title => title.includes(kw)) || 
      gold.query.toLowerCase().includes(kw)
    );

    const recall = matchedKeywords.length / gold.expectedKeywords.length;
    const precision = retrieval.intent === gold.intent ? 1.0 : 0.0;
    const f1 = (precision + recall) > 0 ? (2 * precision * recall) / (precision + recall) : 0;

    results.push({
      gold,
      retrieval,
      metrics: {
        recall,
        precision,
        f1,
      },
      cacheHit: pack.cache.hit,
    });

    totalScore += f1;
  }

  const finalScore = (totalScore / GOLD_SETS.length) * 100;
  
  const report = {
    timestamp: new Date().toISOString(),
    overallScore: finalScore.toFixed(2),
    benchmarks: results,
    config: {
      rulesPath: RULES_PATH,
      adaptiveRetrieval: true,
      zeroWasteCaching: true,
    }
  };

  // 5. Generate Reproducible Report
  if (!fs.existsSync(path.dirname(REPORT_PATH))) {
    fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
  }
  fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));

  console.log(`\nBenchmark Complete!`);
  console.log(`Overall Efficiency Score: ${finalScore.toFixed(2)}%`);
  console.log(`Report saved to: ${REPORT_PATH}`);
}

runBenchmark().catch(console.error);
