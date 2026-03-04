# Gemini: RLHF Function Declarations Install

Import the RLHF function declarations into your Gemini agent in under 60 seconds.

## One-Command Install (Node.js)

```bash
# Copy declarations to your project
cp adapters/gemini/function-declarations.json .gemini/rlhf-tools.json
```

## Import in Your Agent Code

```javascript
const fs = require('fs');

// Load RLHF tool declarations
const rlhfTools = JSON.parse(
  fs.readFileSync('adapters/gemini/function-declarations.json', 'utf8')
);

// Pass to Gemini SDK
const model = genAI.getGenerativeModel({
  model: 'gemini-pro',
  tools: [{ functionDeclarations: rlhfTools.tools }],
});
```

## Available Functions

| Function | Description |
|---|---|
| `capture_feedback` | Capture thumbs-up/down with context — POST `/v1/feedback/capture` |
| `feedback_summary` | Compact summary of recent feedback — GET `/v1/feedback/summary` |
| `prevention_rules` | Generate prevention rules from mistakes — POST `/v1/feedback/rules` |
| `plan_intent` | Policy-aware execution plan — POST `/v1/intents/plan` |

## Point to Your API

Set the base URL in your Gemini function handler:

```javascript
const RLHF_API_URL = process.env.RLHF_API_URL || 'http://localhost:3000';
const RLHF_API_KEY = process.env.RLHF_API_KEY;

async function callRlhfTool(name, params) {
  const endpoints = {
    capture_feedback: { method: 'POST', path: '/v1/feedback/capture' },
    feedback_summary: { method: 'GET', path: '/v1/feedback/summary' },
    prevention_rules: { method: 'POST', path: '/v1/feedback/rules' },
    plan_intent:      { method: 'POST', path: '/v1/intents/plan' },
  };
  const { method, path } = endpoints[name];
  const res = await fetch(`${RLHF_API_URL}${path}`, {
    method,
    headers: { Authorization: `Bearer ${RLHF_API_KEY}`, 'Content-Type': 'application/json' },
    body: method === 'POST' ? JSON.stringify(params) : undefined,
  });
  return res.json();
}
```

## Requirements

- Google Gemini SDK (`@google/generative-ai`)
- Node.js 18+ or Python 3.9+
- RLHF API running (local or hosted)

## Verify

```bash
node -e "const t = require('./adapters/gemini/function-declarations.json'); console.log('Tools:', t.tools.map(x=>x.name))"
# Expected: Tools: [ 'capture_feedback', 'feedback_summary', 'prevention_rules', 'plan_intent' ]
```
