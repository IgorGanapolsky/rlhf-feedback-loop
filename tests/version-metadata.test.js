const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { resolveHostedBillingConfig } = require('../scripts/hosted-config');

const PROJECT_ROOT = path.join(__dirname, '..');
const CANONICAL_APP_ORIGIN = 'https://rlhf-feedback-loop-production.up.railway.app';
const CURRENT_REPOSITORY_URL = 'https://github.com/IgorGanapolsky/mcp-memory-gateway';

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(PROJECT_ROOT, relativePath), 'utf8'));
}

function readText(relativePath) {
  return fs.readFileSync(path.join(PROJECT_ROOT, relativePath), 'utf8');
}

test('package version matches MCP manifests', () => {
  const packageJson = readJson('package.json');
  const serverManifest = readJson('server.json');

  assert.equal(serverManifest.version, packageJson.version);
});

test('public docs render the current package version', () => {
  const packageJson = readJson('package.json');
  const landingPage = readText('docs/landing-page.html');
  const mcpSubmission = readText('docs/mcp-hub-submission.md');

  assert.match(landingPage, /v__PACKAGE_VERSION__/);
  assert.match(landingPage, /Join as Founding Member — \$10\/mo/);
  assert.match(landingPage, /Hosted onboarding at https:\/\/rlhf-feedback-loop-production\.up\.railway\.app/);
  assert.match(landingPage, /falls back to the hosted app if checkout creation fails/);
  assert.doesNotMatch(landingPage, /100 spots|50 founding spots/i);
  assert.match(mcpSubmission, new RegExp(`## Version\\s+${packageJson.version}`));
});

test('landing page keeps GTM and schema assets wired', () => {
  const landingPage = readText('docs/landing-page.html');
  const gtmPlan = readText('docs/GO_TO_MARKET_REVENUE_WEDGE_2026-03.md');

  assert.match(landingPage, /"@type": "SoftwareApplication"/);
  assert.match(landingPage, /"@type": "FAQPage"/);
  assert.match(landingPage, /<section id='faq'>/);
  assert.match(landingPage, /__GTM_PLAN_URL__/);
  assert.match(landingPage, /__COMPATIBILITY_REPORT_URL__/);
  assert.match(landingPage, /__AUTOMATION_REPORT_URL__/);
  assert.match(gtmPlan, /"Outcome-Based" Memory Packages/);
  assert.match(gtmPlan, /\*\*\"Success-Based Memory Credits\.\"\*\*/);
  assert.match(gtmPlan, /"Mistake-Free" Credits/i);
});

test('hosted origin and repository metadata stay canonical across live-facing artifacts', () => {
  const packageJson = readJson('package.json');
  const serverManifest = readJson('server.json');
  const publicLanding = readText('public/index.html');
  const serverSource = readText('src/api/server.js');
  const twitterThread = readText('docs/marketing/twitter-thread.md');

  assert.equal(packageJson.homepage, CANONICAL_APP_ORIGIN);
  assert.equal(serverManifest.websiteUrl, CANONICAL_APP_ORIGIN);

  assert.match(publicLanding, new RegExp(`"url": "${CANONICAL_APP_ORIGIN.replaceAll('.', '\\.')}"`));
  assert.match(publicLanding, new RegExp(CURRENT_REPOSITORY_URL.replaceAll('.', '\\.')));
  assert.match(publicLanding, new RegExp(`Versioned proof: v${packageJson.version.replaceAll('.', '\\.')}`));
  assert.match(publicLanding, new RegExp(`Context Gateway • v${packageJson.version.replaceAll('.', '\\.')}`));
  assert.doesNotMatch(publicLanding, /mcp-gateway\.vercel\.app/);
  assert.doesNotMatch(publicLanding, /buy\.stripe\.com/);
  assert.doesNotMatch(publicLanding, /\$5\/mo/);
  assert.doesNotMatch(publicLanding, /50 spots|38 spots|Join 12 founding members/i);
  assert.doesNotMatch(publicLanding, /github\.com\/IgorGanapolsky\/rlhf-feedback-loop/);

  assert.match(serverSource, new RegExp(CURRENT_REPOSITORY_URL.replaceAll('.', '\\.')));
  assert.doesNotMatch(serverSource, /github\.com\/IgorGanapolsky\/rlhf-feedback-loop/);

  assert.match(twitterThread, /Live API: rlhf-feedback-loop-production\.up\.railway\.app/);
  assert.doesNotMatch(twitterThread, /us-central1\.run\.app/);
});

test('runtime hosted billing config defaults to the live founding price', () => {
  const previous = process.env.RLHF_FOUNDING_PRICE;
  delete process.env.RLHF_FOUNDING_PRICE;

  try {
    const runtimeConfig = resolveHostedBillingConfig();
    assert.equal(runtimeConfig.foundingPrice, '$10/mo');
    assert.equal(runtimeConfig.checkoutFallbackUrl, CANONICAL_APP_ORIGIN);
  } finally {
    if (previous === undefined) {
      delete process.env.RLHF_FOUNDING_PRICE;
    } else {
      process.env.RLHF_FOUNDING_PRICE = previous;
    }
  }
});
