#!/usr/bin/env node
/**
 * autonomous-strategist.js
 * 
 * Implements "Planning-Based" AI.
 * First reasons about the system state, then constructs a plan, then acts.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { withReasoningPrompt } = require('./code-reasoning');

async function generateStrategy() {
  console.log('🧠 [Strategist Agent] Analyzing current system state and revenue funnel...');

  const ledgerPath = path.resolve(__dirname, '../.claude/memory/feedback/funnel-events.jsonl');
  const revenue = fs.existsSync(ledgerPath) ? fs.readFileSync(ledgerPath, 'utf-8').split('\n').filter(l => l.includes('"stage":"paid"')).length : 0;

  const rawPrompt = `
    System State:
    - Revenue Today: $${revenue * 49} (Estimated)
    - Infrastructure: Stripe Live, AWS Handshake verified, Perplexity Max SEO injected.
    - Active Channels: X.com (17M impressionsLever), GitHub (Always-On Loop).
    - Latest Milestone: support for $49 "Mistake-Free" credit packs.

    Goal: Capture the first real external dollar in the next 60 minutes.

    TASKS:
    1. Reason about the current bottleneck.
    2. Construct a 3-step execution plan for the session.
    3. Identify the highest-ROI message to dispatch to X.com.
  `;

  const prompt = withReasoningPrompt(rawPrompt, 'Chief Strategy Officer');
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

  try {
    const model = genAI.getGenerativeModel({ 
      model: "gemini-3-flash-preview"
    });
    const result = await model.generateContent(prompt);
    const strategy = result.response.text().trim();
    const strategyPath = path.join(__dirname, '../.planning/STATE.md');
    
    fs.writeFileSync(strategyPath, `# 🧠 Autonomous Strategy: ${new Date().toLocaleDateString()}\n\n${strategy}`);
    console.log('✅ Strategy generated and saved to .planning/STATE.md');
    return strategy;

  } catch (err) {
    console.error('🚨 Strategist failed:', err.message);
  }
}

generateStrategy();
