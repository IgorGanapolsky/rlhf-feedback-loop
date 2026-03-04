#!/usr/bin/env node
/**
 * rlhf-feedback-loop CLI
 *
 * Usage:
 *   npx rlhf-feedback-loop init
 *
 * Creates a .rlhf/ directory with config and capture script for local use.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const COMMAND = process.argv[2];
const CWD = process.cwd();

function init() {
  const rlhfDir = path.join(CWD, '.rlhf');

  // Create directory
  if (!fs.existsSync(rlhfDir)) {
    fs.mkdirSync(rlhfDir, { recursive: true });
    console.log('Created .rlhf/');
  } else {
    console.log('.rlhf/ already exists — updating config');
  }

  // Write config.json
  const config = {
    version: '0.5.0',
    apiUrl: process.env.RLHF_API_URL || 'http://localhost:3000',
    logPath: '.rlhf/feedback-log.jsonl',
    memoryPath: '.rlhf/memory-log.jsonl',
    createdAt: new Date().toISOString(),
  };

  const configPath = path.join(rlhfDir, 'config.json');
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');
  console.log('Wrote .rlhf/config.json');

  // Copy capture-feedback script (inline minimal version for standalone use)
  const captureScript = `#!/usr/bin/env node
/**
 * Standalone feedback capture script — created by npx rlhf-feedback-loop init
 * Full version: https://github.com/IgorGanapolsky/rlhf-feedback-loop
 *
 * Usage:
 *   node .rlhf/capture-feedback.js --feedback=up --context="that worked great" --tags="testing"
 *   node .rlhf/capture-feedback.js --feedback=down --context="missed edge case" --what-went-wrong="..." --what-to-change="..."
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

const CONFIG_PATH = path.join(__dirname, 'config.json');
const config = fs.existsSync(CONFIG_PATH) ? JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8')) : {};
const LOG_PATH = path.join(process.cwd(), config.logPath || '.rlhf/feedback-log.jsonl');

function parseArgs(argv) {
  const args = {};
  argv.forEach((arg) => {
    if (!arg.startsWith('--')) return;
    const [key, ...rest] = arg.slice(2).split('=');
    args[key] = rest.length ? rest.join('=') : true;
  });
  return args;
}

const args = parseArgs(process.argv.slice(2));
const signal = args.feedback || args.signal;

if (!signal) {
  console.error('Error: --feedback=up or --feedback=down required');
  console.error('Usage: node .rlhf/capture-feedback.js --feedback=up --context="..."');
  process.exit(1);
}

const normalized = ['up', 'thumbs_up', 'positive'].includes(signal) ? 'up' : 'down';

const entry = {
  id: \`fb-\${Date.now()}-\${Math.random().toString(36).slice(2, 7)}\`,
  signal: normalized,
  context: args.context || '',
  whatWentWrong: args['what-went-wrong'] || undefined,
  whatToChange: args['what-to-change'] || undefined,
  whatWorked: args['what-worked'] || undefined,
  tags: args.tags ? args.tags.split(',').map((t) => t.trim()) : [],
  timestamp: new Date().toISOString(),
  hostname: os.hostname(),
};

// Remove undefined fields
Object.keys(entry).forEach((k) => entry[k] === undefined && delete entry[k]);

// Ensure log directory exists
const logDir = path.dirname(LOG_PATH);
if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });

fs.appendFileSync(LOG_PATH, JSON.stringify(entry) + '\\n');
console.log(\`Feedback captured [\${normalized}]: \${entry.id}\`);
console.log(\`Logged to: \${LOG_PATH}\`);
`;

  const scriptPath = path.join(rlhfDir, 'capture-feedback.js');
  fs.writeFileSync(scriptPath, captureScript);
  // Make executable
  try {
    fs.chmodSync(scriptPath, '755');
  } catch (_) {
    // chmod may not be available on all platforms — not fatal
  }
  console.log('Wrote .rlhf/capture-feedback.js');

  // Add .rlhf/feedback-log.jsonl to .gitignore if it exists
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
  console.log('Setup complete! Run:');
  console.log("  node .rlhf/capture-feedback.js --feedback=up --context='test'");
  console.log('');
  console.log('Full docs: https://github.com/IgorGanapolsky/rlhf-feedback-loop');
}

function help() {
  console.log('rlhf-feedback-loop CLI');
  console.log('');
  console.log('Commands:');
  console.log('  init    Scaffold .rlhf/ config and capture script in current directory');
  console.log('  help    Show this help message');
  console.log('');
  console.log('Examples:');
  console.log('  npx rlhf-feedback-loop init');
  console.log('  node .rlhf/capture-feedback.js --feedback=up --context="great result"');
}

switch (COMMAND) {
  case 'init':
    init();
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
