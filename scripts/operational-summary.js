'use strict';

const { getBillingSummary } = require('./billing');
const { resolveHostedBillingConfig } = require('./hosted-config');

function normalizeText(value) {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  return text || null;
}

function shouldPreferHostedSummary() {
  return String(process.env.RLHF_METRICS_SOURCE || '').trim().toLowerCase() !== 'local';
}

function resolveHostedSummaryConfig() {
  const runtimeConfig = resolveHostedBillingConfig();
  const apiBaseUrl = normalizeText(process.env.RLHF_BILLING_API_BASE_URL) || runtimeConfig.billingApiBaseUrl;
  const apiKey = normalizeText(process.env.RLHF_API_KEY);
  return {
    apiBaseUrl,
    apiKey,
  };
}

async function fetchHostedBillingSummary(config = resolveHostedSummaryConfig()) {
  if (!shouldPreferHostedSummary()) {
    const err = new Error('Hosted operational summary is disabled.');
    err.code = 'hosted_summary_disabled';
    throw err;
  }
  if (!config.apiBaseUrl || !config.apiKey) {
    const err = new Error('Hosted operational summary is not configured.');
    err.code = 'hosted_summary_unconfigured';
    throw err;
  }

  const response = await fetch(new URL('/v1/billing/summary', config.apiBaseUrl), {
    method: 'GET',
    headers: {
      authorization: `Bearer ${config.apiKey}`,
      accept: 'application/json',
    },
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    const err = new Error(`Hosted operational summary request failed (${response.status}): ${detail || 'unknown error'}`);
    err.code = 'hosted_summary_http_error';
    err.status = response.status;
    throw err;
  }

  return response.json();
}

async function getOperationalBillingSummary() {
  try {
    const summary = await fetchHostedBillingSummary();
    return {
      source: 'hosted',
      summary,
      fallbackReason: null,
    };
  } catch (err) {
    return {
      source: 'local',
      summary: getBillingSummary(),
      fallbackReason: err && err.message ? err.message : 'hosted_summary_unavailable',
    };
  }
}

module.exports = {
  fetchHostedBillingSummary,
  getOperationalBillingSummary,
  resolveHostedSummaryConfig,
  shouldPreferHostedSummary,
};
