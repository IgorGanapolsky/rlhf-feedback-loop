---
title: GPT Store Submission — RLHF Feedback Loop
created: 2026-03-04T00:00:00Z
updated: 2026-03-04T00:00:00Z
status: ready-to-submit
---

# GPT Store Submission: RLHF Feedback Loop

Copy-paste this content into the ChatGPT GPT Builder (https://chat.openai.com/gpts/editor).

---

## GPT Name

```
RLHF Feedback Loop
```

---

## Short Description (max 50 characters)

```
Stop your AI agent from repeating mistakes
```

---

## Full Description (max 300 characters)

```
Capture thumbs-up/down feedback from AI coding agents, enforce schema quality, generate prevention rules, and export DPO training pairs. Works with Claude, Codex, Gemini, and Amp. Start locally for free or connect to the Cloud Pro API.
```

---

## Instructions (paste into the "Instructions" field)

```
You are a feedback loop assistant for AI coding agents.

Your primary capabilities:
1. Capture explicit feedback signals (up/down) with context about what worked or went wrong.
2. Validate feedback entries against the RLHF schema before promoting to memory.
3. Suggest prevention rules when the same failure pattern appears multiple times.
4. Export DPO preference pairs for offline model fine-tuning.
5. Route feedback to the correct context pack (code-review, refactoring, debugging, etc).

When a user reports something that worked well, call POST /v1/feedback with feedback=up and the context they describe.
When a user reports a mistake or failure, call POST /v1/feedback with feedback=down, extract what-went-wrong and what-to-change from the conversation.

Always confirm the feedback ID returned by the API so the user knows it was captured.

If the user asks for a summary of recent feedback patterns, call GET /v1/feedback/summary.
If the user asks for prevention rules, call GET /v1/feedback/rules.
If the user asks for DPO export, call GET /v1/feedback/export/dpo.

API base URL: https://rlhf-api.up.railway.app
Authentication: Bearer token in the Authorization header (user must provide their API key).
```

---

## Conversation Starters

```
1. "Capture feedback: the auth refactor worked — token validation is now a pure function"
2. "Capture feedback: failed — I hardcoded the DB URL instead of using env vars"
3. "Show me prevention rules generated from recent failures"
4. "Export my feedback as DPO training pairs"
```

---

## OpenAPI Actions Schema

Reference the schema file: `adapters/chatgpt/openapi.yaml` (already in repo).

To import into GPT Builder:
1. Open GPT Builder → Actions → Add Action
2. Paste the contents of `adapters/chatgpt/openapi.yaml`
3. Set authentication to: **API Key** → Header name: `Authorization` → Format: `Bearer {key}`
4. Server URL: `https://rlhf-api.up.railway.app`

### Inline Schema (minimal version for quick submission)

```yaml
openapi: 3.1.0
info:
  title: RLHF Feedback Loop API
  description: Capture feedback from AI coding agents, generate prevention rules, and export DPO training pairs.
  version: 0.5.0
servers:
  - url: https://rlhf-api.up.railway.app
    description: Cloud Pro hosted API
paths:
  /v1/feedback:
    post:
      operationId: captureFeedback
      summary: Capture a feedback signal
      security:
        - bearerAuth: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [feedback, context]
              properties:
                feedback:
                  type: string
                  enum: [up, down]
                  description: Thumbs up or thumbs down
                context:
                  type: string
                  description: What the agent was doing when feedback was given
                what_worked:
                  type: string
                  description: (up only) Specific action that succeeded
                what_went_wrong:
                  type: string
                  description: (down only) What the agent did wrong
                what_to_change:
                  type: string
                  description: (down only) How to fix it next time
                tags:
                  type: array
                  items:
                    type: string
      responses:
        '200':
          description: Feedback captured
          content:
            application/json:
              schema:
                type: object
                properties:
                  id:
                    type: string
                  status:
                    type: string
                  version:
                    type: string
  /v1/feedback/summary:
    get:
      operationId: getFeedbackSummary
      summary: Get summary of recent feedback patterns
      security:
        - bearerAuth: []
      responses:
        '200':
          description: Feedback summary
  /v1/feedback/rules:
    get:
      operationId: getPreventionRules
      summary: Get prevention rules generated from failure patterns
      security:
        - bearerAuth: []
      responses:
        '200':
          description: Prevention rules in markdown format
  /v1/feedback/export/dpo:
    get:
      operationId: exportDpoPairs
      summary: Export DPO preference pairs for fine-tuning
      security:
        - bearerAuth: []
      responses:
        '200':
          description: DPO pairs in JSON format
  /health:
    get:
      operationId: healthCheck
      summary: Check API health
      responses:
        '200':
          description: API is healthy
components:
  securitySchemes:
    bearerAuth:
      type: http
      scheme: bearer
```

---

## Category

- Primary: **Productivity**
- Secondary: **Programming & Development**

---

## Profile Image Suggestion

A simple icon: blue feedback loop arrow (circular) with a thumbs-up/thumbs-down overlay. Or use the GitHub social preview image from the repo.

---

## Privacy Policy URL

```
https://github.com/IgorGanapolsky/rlhf-feedback-loop/blob/main/SECURITY.md
```

---

## Submission Checklist

- [ ] GPT name entered
- [ ] Description entered
- [ ] Instructions pasted
- [ ] Conversation starters added
- [ ] OpenAPI schema imported (Actions tab)
- [ ] API key authentication configured
- [ ] Category set to Productivity / Programming
- [ ] Profile image uploaded
- [ ] Privacy policy URL added
- [ ] Test: send a capture feedback message and verify API call succeeds
- [ ] Submit for review

---

## Notes

- The GPT Store review process typically takes 1-5 business days.
- Ensure the Railway deployment is live before submitting (the actions will be tested by reviewers).
- The API key for the GPT actions should be a dedicated key created via Stripe checkout.
