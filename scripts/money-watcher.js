#!/usr/bin/env node
/**
 * money-watcher.js
 * Continuously polls the funnel ledger for the first real 'paid' event and alerts the system.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const LEDGER_PATH = path.resolve(__dirname, '../.claude/memory/feedback/funnel-events.jsonl');

console.log('👀 Money Watcher activated. Polling ledger for real revenue...');

let initialCount = 0;
if (fs.existsSync(LEDGER_PATH)) {
  const content = fs.readFileSync(LEDGER_PATH, 'utf-8');
  initialCount = content.split('\n').filter(l => l.includes('"stage":"paid"')).length;
}

setInterval(() => {
  if (!fs.existsSync(LEDGER_PATH)) return;
  
  const content = fs.readFileSync(LEDGER_PATH, 'utf-8');
  const paidLines = content.split('\n').filter(l => l.includes('"stage":"paid"'));
  
  if (paidLines.length > initialCount) {
    const newCount = paidLines.length - initialCount;
    console.log(`\n🚨🚨🚨 REVENUE ALERT: ${newCount} NEW PAID EVENT(S) DETECTED! 🚨🚨🚨`);
    console.log('The First Dollar has landed.');
    console.log(paidLines[paidLines.length - 1]);
    
    // Attempt to trigger a system beep
    process.stdout.write('\x07');
    
    // Update baseline
    initialCount = paidLines.length;
  }
}, 10000); // Check every 10 seconds
