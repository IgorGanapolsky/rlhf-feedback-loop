#!/usr/bin/env node
/**
 * money-watcher.js
 * Continuously polls the funnel ledger for the first real 'paid' event and alerts the system.
 */

'use strict';

const { getBillingSummary } = require('./billing');

console.log('👀 Money Watcher activated. Polling billing summary for new paid events...');

let initialCount = getBillingSummary().funnel.stageCounts.paid;

setInterval(() => {
  const summary = getBillingSummary();
  const paidCount = summary.funnel.stageCounts.paid;

  if (paidCount > initialCount) {
    const newCount = paidCount - initialCount;
    console.log(`\n🚨🚨🚨 PAYMENT ALERT: ${newCount} NEW PAID EVENT(S) DETECTED! 🚨🚨🚨`);
    console.log('Operational billing summary:');
    console.log(JSON.stringify({
      firstPaidAt: summary.funnel.firstPaidAt,
      lastPaidAt: summary.funnel.lastPaidAt,
      lastPaidEvent: summary.funnel.lastPaidEvent,
      activeKeys: summary.keys.active,
      totalUsage: summary.keys.totalUsage,
    }, null, 2));

    // Attempt to trigger a system beep
    process.stdout.write('\x07');

    // Update baseline
    initialCount = paidCount;
  }
}, 10000); // Check every 10 seconds
