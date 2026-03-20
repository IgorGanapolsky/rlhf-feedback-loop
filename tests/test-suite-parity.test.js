'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const PROJECT_ROOT = path.join(__dirname, '..');
const TESTS_DIR = path.join(PROJECT_ROOT, 'tests');
const pkg = require(path.join(PROJECT_ROOT, 'package.json'));

function listRepoTests(dir = TESTS_DIR) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...listRepoTests(fullPath));
      continue;
    }

    if (entry.isFile() && entry.name.endsWith('.test.js')) {
      files.push(path.relative(PROJECT_ROOT, fullPath));
    }
  }

  return files.sort();
}

function collectReachableScriptCommands(scriptName = 'test', seen = new Set()) {
  if (seen.has(scriptName)) {
    return '';
  }

  seen.add(scriptName);
  const command = pkg.scripts[scriptName] || '';
  const nested = [];
  const runPattern = /npm run ([a-z0-9:-]+)/gi;
  let match;

  while ((match = runPattern.exec(command)) !== null) {
    nested.push(collectReachableScriptCommands(match[1], seen));
  }

  return [command, ...nested].join(' ');
}

function listNpmTestFiles() {
  const reachableCommands = collectReachableScriptCommands();
  const matches = reachableCommands.match(/tests\/[^\s'"]+\.test\.js/g) || [];
  return new Set(matches);
}

test('npm test includes every repository test file', () => {
  const repoTests = listRepoTests();
  const npmTestFiles = listNpmTestFiles();
  const missing = repoTests.filter((file) => !npmTestFiles.has(file));

  assert.deepEqual(missing, []);
});
