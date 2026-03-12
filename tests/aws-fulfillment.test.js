#!/usr/bin/env node
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer } = require('../src/api/server');

test('AWS Fulfillment Handshake - resolves token and provisions key', async (t) => {
  // Force AWS Mock mode
  process.env.AWS_MOCK = 'true';
  process.env.RLHF_ALLOW_INSECURE = 'true';

  const { server, port } = await startServer({ port: 0 });
  const fulfillmentUrl = `http://localhost:${port}/v1/aws/fulfillment`;

  try {
    const res = await fetch(fulfillmentUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 'x-amzn-marketplace-token': 'test-aws-token-123' })
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    
    assert.equal(body.message, 'AWS Marketplace subscription verified');
    assert.ok(body.key.startsWith('rlhf_'), 'Should return a valid API key');
    assert.equal(body.customerId, 'mock_aws_customer_123');
    assert.match(body.nextSteps.env, /RLHF_API_KEY=rlhf_/);

  } finally {
    await new Promise(r => server.close(r));
    delete process.env.AWS_MOCK;
    delete process.env.RLHF_ALLOW_INSECURE;
  }
});
