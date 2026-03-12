'use strict';

/**
 * tests/billing.test.js
 */

const { test, describe, before, after, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');

const { startServer } = require('../src/api/server');

let tmpDir;
const billingTestRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'billing-suite-'));
const testApiKeysPath = path.join(billingTestRoot, 'api-keys.json');
const testFunnelLedgerPath = path.join(billingTestRoot, 'funnel-events.jsonl');
const testLocalCheckoutSessionsPath = path.join(billingTestRoot, 'local-checkout-sessions.json');

const savedApiKeysPath = process.env._TEST_API_KEYS_PATH;
const savedFunnelPath = process.env._TEST_FUNNEL_LEDGER_PATH;
const savedLocalCheckoutSessionsPath = process.env._TEST_LOCAL_CHECKOUT_SESSIONS_PATH;
const savedStripeSecretKey = process.env.STRIPE_SECRET_KEY;
const savedStripePriceId = process.env.STRIPE_PRICE_ID;

// Initial setup
process.env._TEST_API_KEYS_PATH = testApiKeysPath;
process.env._TEST_FUNNEL_LEDGER_PATH = testFunnelLedgerPath;
process.env._TEST_LOCAL_CHECKOUT_SESSIONS_PATH = testLocalCheckoutSessionsPath;
process.env.STRIPE_SECRET_KEY = '';
process.env.STRIPE_PRICE_ID = '';

after(() => {
  process.env.STRIPE_SECRET_KEY = savedStripeSecretKey || '';
  process.env.STRIPE_PRICE_ID = savedStripePriceId || '';
  if (savedApiKeysPath === undefined) delete process.env._TEST_API_KEYS_PATH;
  else process.env._TEST_API_KEYS_PATH = savedApiKeysPath;
  if (savedFunnelPath === undefined) delete process.env._TEST_FUNNEL_LEDGER_PATH;
  else process.env._TEST_FUNNEL_LEDGER_PATH = savedFunnelPath;
  if (savedLocalCheckoutSessionsPath === undefined) delete process.env._TEST_LOCAL_CHECKOUT_SESSIONS_PATH;
  else process.env._TEST_LOCAL_CHECKOUT_SESSIONS_PATH = savedLocalCheckoutSessionsPath;
  fs.rmSync(billingTestRoot, { recursive: true, force: true });
});

function setupTempStore() {
  if (fs.existsSync(testApiKeysPath)) fs.rmSync(testApiKeysPath, { force: true });
  return testApiKeysPath;
}

function cleanupTempStore() {
  if (fs.existsSync(testApiKeysPath)) fs.rmSync(testApiKeysPath, { force: true });
}

function requireFreshBilling(stripeKey = '') {
  delete require.cache[require.resolve('../scripts/billing')];
  process.env.STRIPE_SECRET_KEY = stripeKey;
  return require('../scripts/billing');
}

function clearBillingArtifacts() {
  for (const t of [testApiKeysPath, testFunnelLedgerPath, testLocalCheckoutSessionsPath]) {
    if (fs.existsSync(t)) fs.rmSync(t, { force: true });
  }
}

function readLedgerEvents() {
  if (!fs.existsSync(testFunnelLedgerPath)) return [];
  return fs.readFileSync(testFunnelLedgerPath, 'utf-8').split('\n').map(l => l.trim()).filter(Boolean).map(l => JSON.parse(l));
}

describe('billing.js — provisionApiKey', () => {
  let keyStorePath;
  beforeEach(() => { keyStorePath = setupTempStore(); });
  afterEach(() => { cleanupTempStore(); });

  test('generates a unique key with rlhf_ prefix', () => {
    const billing = requireFreshBilling('');
    assert.equal(billing._API_KEYS_PATH(), keyStorePath);
    const result = billing.provisionApiKey('cus_test_001');
    assert.ok(result.key.startsWith('rlhf_'));
    assert.equal(result.customerId, 'cus_test_001');
    assert.ok(JSON.parse(fs.readFileSync(keyStorePath, 'utf-8')).keys[result.key]);
  });

  test('reuses existing active key for same customerId', () => {
    const billing = requireFreshBilling('');
    const r1 = billing.provisionApiKey('cus_reuse_001');
    const r2 = billing.provisionApiKey('cus_reuse_001');
    assert.equal(r1.key, r2.key);
  });
});

describe('billing.js — funnel ledger', () => {
  beforeEach(() => { 
    clearBillingArtifacts(); 
    delete require.cache[require.resolve('../scripts/billing')];
    process.env._TEST_FUNNEL_LEDGER_PATH = testFunnelLedgerPath;
  });

  test('createCheckoutSession emits acquisition event', async () => {
    const billing = require('../scripts/billing');
    const result = await billing.createCheckoutSession({ installId: 'inst_123', metadata: { campaign: 'test' } });
    assert.ok(result.sessionId.startsWith('test_session_'));
    assert.match(result.traceId, /^checkout_/);
    const events = readLedgerEvents();
    const acq = events.find(e => e.stage === 'acquisition');
    assert.ok(acq);
    assert.equal(acq.installId, 'inst_123');
    assert.equal(acq.traceId, result.traceId);
  });

  test('checkout session status preserves trace id for cross-service lookup', async () => {
    const billing = require('../scripts/billing');
    const checkout = await billing.createCheckoutSession({ installId: 'inst_trace_lookup' });
    const session = await billing.getCheckoutSessionStatus(checkout.sessionId);
    assert.equal(session.found, true);
    assert.equal(session.traceId, checkout.traceId);
  });

  test('recordUsage emits activation only once', () => {
    const billing = require('../scripts/billing');
    const p = billing.provisionApiKey('cus_act');
    billing.recordUsage(p.key);
    billing.recordUsage(p.key);
    const events = readLedgerEvents();
    assert.equal(events.filter(e => e.stage === 'activation').length, 1);
  });

  test('getBillingSummary merges funnel ledger and key store state', () => {
    const billing = require('../scripts/billing');
    const activeKey = billing.provisionApiKey('cus_summary_a', {
      installId: 'inst_summary_a',
      source: 'stripe_webhook_checkout_completed',
    });
    const disabledKey = billing.provisionApiKey('cus_summary_b', {
      installId: 'inst_summary_b',
      source: 'github_marketplace_purchased',
    });

    billing.recordUsage(activeKey.key);
    billing.recordUsage(activeKey.key);
    billing.disableCustomerKeys('cus_summary_b');
    billing.appendFunnelEvent({
      stage: 'acquisition',
      event: 'checkout_session_created',
      installId: 'inst_summary_a',
      evidence: 'sess_summary_a',
      metadata: { customerId: 'cus_summary_a' },
    });
    billing.appendFunnelEvent({
      stage: 'paid',
      event: 'stripe_checkout_completed',
      installId: 'inst_summary_a',
      evidence: 'cs_summary_a',
      metadata: { customerId: 'cus_summary_a' },
    });

    const summary = billing.getBillingSummary();
    assert.equal(summary.coverage.source, 'funnel_ledger+key_store');
    assert.equal(summary.coverage.tracksBookedRevenue, false);
    assert.equal(summary.funnel.stageCounts.acquisition, 1);
    assert.equal(summary.funnel.stageCounts.activation, 1);
    assert.equal(summary.funnel.stageCounts.paid, 1);
    assert.equal(summary.keys.total, 2);
    assert.equal(summary.keys.active, 1);
    assert.equal(summary.keys.disabled, 1);
    assert.equal(summary.keys.totalUsage, 2);
    assert.equal(summary.keys.activeCustomers, 1);
    assert.equal(summary.keys.bySource.stripe_webhook_checkout_completed, 1);
    assert.equal(summary.keys.bySource.github_marketplace_purchased, 1);
    assert.equal(summary.keys.activeBySource.stripe_webhook_checkout_completed, 1);
    assert.ok(summary.funnel.firstPaidAt);
    assert.equal(summary.funnel.lastPaidEvent.customerId, 'cus_summary_a');

    const activeCustomer = summary.customers.find((entry) => entry.customerId === 'cus_summary_a');
    const disabledCustomer = summary.customers.find((entry) => entry.customerId === 'cus_summary_b');
    assert.equal(activeCustomer.activeKeys, 1);
    assert.equal(activeCustomer.usageCount, 2);
    assert.equal(disabledCustomer.activeKeys, 0);
    assert.equal(disabledCustomer.source, 'github_marketplace_purchased');
    assert.equal(disabledKey.customerId, 'cus_summary_b');
  });
});

describe('billing.js — rotateApiKey', () => {
  test('rotateApiKey rotates key and disables old one', () => {
    const keyStorePath = setupTempStore();
    const billing = requireFreshBilling('');
    const p1 = billing.provisionApiKey('cus_rot');
    const oldKey = p1.key;
    const rot = billing.rotateApiKey(oldKey);
    assert.equal(rot.rotated, true);
    assert.ok(rot.key.startsWith('rlhf_'));
    assert.notEqual(rot.key, oldKey);
    assert.equal(billing.validateApiKey(oldKey).valid, false);
    assert.equal(billing.validateApiKey(rot.key).valid, true);
    cleanupTempStore();
  });
});

describe('API server — /v1/billing/* routes', () => {
  let server, port, billing;
  before(async () => {
    process.env.RLHF_ALLOW_INSECURE = 'true';
    process.env._TEST_API_KEYS_PATH = testApiKeysPath;
    process.env._TEST_FUNNEL_LEDGER_PATH = testFunnelLedgerPath;
    process.env._TEST_LOCAL_CHECKOUT_SESSIONS_PATH = testLocalCheckoutSessionsPath;

    delete require.cache[require.resolve('../src/api/server')];
    delete require.cache[require.resolve('../scripts/billing')];
    
    const { startServer: freshStart } = require('../src/api/server');
    const started = await freshStart({ port: 0 });
    server = started.server;
    port = started.port;
    billing = require('../scripts/billing');
  });
  after(async () => {
    await new Promise(r => server.close(r));
    delete process.env.RLHF_ALLOW_INSECURE;
  });

  test('POST /v1/billing/checkout returns sessionId', async () => {
    const res = await fetch(`http://localhost:${port}/v1/billing/checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ installId: 'inst_api' })
    });
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('access-control-allow-origin'), '*');
    const body = await res.json();
    assert.ok(body && body.sessionId && body.sessionId.startsWith('test_session_'));
    assert.match(body.traceId, /^checkout_/);
    assert.equal(res.headers.get('x-rlhf-trace-id'), body.traceId);
  });
});
