/**
 * aws-billing.js
 * AWS Marketplace SaaS integration for MCP Memory Gateway.
 */

'use strict';

const { MarketplaceMeteringClient, ResolveCustomerCommand, BatchMeterUsageCommand } = require('@aws-sdk/client-marketplace-metering');
const { MarketplaceEntitlementServiceClient, GetEntitlementsCommand } = require('@aws-sdk/client-marketplace-entitlement-service');

const client = new MarketplaceMeteringClient({ region: process.env.AWS_REGION || 'us-east-1' });
const entitlementClient = new MarketplaceEntitlementServiceClient({ region: process.env.AWS_REGION || 'us-east-1' });

/**
 * Resolve the temporary registration token from AWS Marketplace.
 * This is called when a user first signs up via the fulfillment URL.
 */
async function resolveAwsCustomer(token) {
  if (process.env.AWS_MOCK === 'true') {
    return {
      CustomerIdentifier: 'mock_aws_customer_123',
      ProductCode: 'mcp-gateway-pro',
      CustomerEmail: 'aws-test@example.com'
    };
  }

  const command = new ResolveCustomerCommand({ RegistrationToken: token });
  try {
    const response = await client.send(command);
    return response; // { CustomerIdentifier, ProductCode, CustomerEmail }
  } catch (err) {
    console.error('[AWS Billing] Failed to resolve customer:', err.message);
    throw err;
  }
}

/**
 * Report usage to AWS for consumption-based billing.
 * AWS expects hourly reporting.
 */
async function reportUsageToAWS(customerIdentifier, dimension, quantity = 1) {
  if (process.env.AWS_MOCK === 'true') return { reported: true };

  const command = new BatchMeterUsageCommand({
    ProductCode: process.env.AWS_PRODUCT_CODE,
    UsageRecords: [{
      CustomerIdentifier: customerIdentifier,
      Dimension: dimension, // e.g., 'context_consolidations'
      Quantity: quantity,
      Timestamp: new Date()
    }]
  });

  try {
    const response = await client.send(command);
    return response;
  } catch (err) {
    console.error('[AWS Billing] Usage report failed:', err.message);
    return { reported: false, error: err.message };
  }
}

/**
 * Verify entitlements for a specific customer.
 * 2026 Mandate: Check for Concurrent Agreements.
 */
async function getAwsEntitlements(customerIdentifier) {
  if (process.env.AWS_MOCK === 'true') return { Entitlements: [{ Dimension: 'pro_tier', Value: { Integer: 1 } }] };

  const command = new GetEntitlementsCommand({
    ProductCode: process.env.AWS_PRODUCT_CODE,
    Filter: {
      CUSTOMER_IDENTIFIER: [customerIdentifier]
    }
  });

  try {
    const response = await entitlementClient.send(command);
    return response.Entitlements;
  } catch (err) {
    console.error('[AWS Billing] Entitlement check failed:', err.message);
    return [];
  }
}

module.exports = {
  resolveAwsCustomer,
  reportUsageToAWS,
  getAwsEntitlements
};
