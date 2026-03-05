# RLHF Feedback Loop

[![CI](https://github.com/IgorGanapolsky/rlhf-feedback-loop/actions/workflows/ci.yml/badge.svg)](https://github.com/IgorGanapolsky/rlhf-feedback-loop/actions/workflows/ci.yml)
[![Self-Healing](https://github.com/IgorGanapolsky/rlhf-feedback-loop/actions/workflows/self-healing-monitor.yml/badge.svg)](https://github.com/IgorGanapolsky/rlhf-feedback-loop/actions/workflows/self-healing-monitor.yml)
[![npm](https://img.shields.io/npm/v/rlhf-feedback-loop)](https://www.npmjs.com/package/rlhf-feedback-loop)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Tests](https://img.shields.io/badge/tests-573%20passing-brightgreen)]()
[![MCP Ready](https://img.shields.io/badge/MCP-ready-black)](adapters/mcp/server-stdio.js)
[![DPO Ready](https://img.shields.io/badge/DPO-ready-blue)](scripts/export-dpo-pairs.js)

**Make your AI agent learn from mistakes.**

Your AI coding agent makes the same errors over and over. It claims things are done when they're not. It forgets what worked last time. This fixes that.

**rlhf-feedback-loop** captures thumbs up/down feedback on your agent's work, remembers what went right and wrong, blocks repeated failures, and exports training data so the agent actually improves.

Works with **ChatGPT**, **Claude**, **Codex**, **Gemini**, and **Amp** — same core, different adapters.

## Architecture at a Glance

### RLHF Feedback Loop

![RLHF Architecture](docs/diagrams/rlhf-architecture-pb.png)

### Plugin Topology

![Plugin Topology](docs/diagrams/plugin-topology-pb.png)

## Why This Exists

| Problem | What this does |
|---------|---------------|
| Agent keeps making the same mistake | Prevention rules auto-generated from repeated failures |
| No proof agent tested before claiming "done" | Rubric engine blocks positive feedback without test evidence |
| Feedback collected but never used | DPO pairs exported for actual model fine-tuning |
| Different tools, different formats | One API + MCP server works across 5 platforms |

## Install in 60 Seconds

```bash
npm install rlhf-feedback-loop
npx rlhf-feedback-loop init
```

That's it. You get the full engine — feedback capture, DPO export, prevention rules, LanceDB vectors, rubric scoring, and an MCP server — all running from `node_modules`. No files copied into your project.

```bash
# Capture feedback
npx rlhf-feedback-loop capture --feedback=up --context="tests pass"

# Export training pairs
npx rlhf-feedback-loop export-dpo

# View analytics
npx rlhf-feedback-loop stats

# Stay up to date
npm update rlhf-feedback-loop
```

Platform-specific adapter setup (optional):

| Platform | One-liner |
|----------|-----------|
| **Claude Code** | `init` auto-configures `.mcp.json` |
| **Codex** | `cat node_modules/rlhf-feedback-loop/adapters/codex/config.toml >> ~/.codex/config.toml` |
| **Gemini** | `cp node_modules/rlhf-feedback-loop/adapters/gemini/function-declarations.json .gemini/rlhf-tools.json` |
| **Amp** | `cp node_modules/rlhf-feedback-loop/plugins/amp-skill/SKILL.md .amp/skills/rlhf-feedback.md` |
| **ChatGPT** | Import `node_modules/rlhf-feedback-loop/adapters/chatgpt/openapi.yaml` in GPT Builder |

Detailed guides: [Claude](plugins/claude-skill/INSTALL.md) | [Codex](plugins/codex-profile/INSTALL.md) | [Gemini](plugins/gemini-extension/INSTALL.md) | [Amp](plugins/amp-skill/INSTALL.md) | [ChatGPT](adapters/chatgpt/INSTALL.md)

## How It Works

```
You give feedback (thumbs up/down)
        |
        v
  Capture + validate
        |
        v
  Score with rubric (is this actually good?)
        |
    +---+---+
    |       |
   Good    Bad
    |       |
  Learn   Remember mistake
    |       |
    v       v
  DPO    Prevention
  pairs   rules
```

1. You (or your agent) gives thumbs up or down with context
2. The rubric engine scores it — blocks false positives (e.g., "done!" with no tests)
3. Good outcomes become learning memories, bad ones become error memories
4. Errors generate prevention rules so the agent stops repeating them
5. Matched pairs export as DPO training data for fine-tuning

## Pricing

| Plan | Price | What you get |
|------|-------|-------------|
| **Open Source** | **$0 forever** | Full source, self-hosted, MIT license, 573 tests, 5-platform plugins |
| **Cloud Pro** | **$10/mo** | Hosted HTTPS API, provisioned API key on payment, Stripe billing, email support |

Get Cloud Pro: see the [landing page](docs/landing-page.html) or go straight to [Stripe Checkout](https://buy.stripe.com/)

---

## API

Full REST API available via `npx rlhf-feedback-loop start-api`:

| Endpoint | Purpose |
|----------|---------|
| `POST /v1/feedback/capture` | Capture up/down feedback |
| `GET /v1/feedback/stats` | Analytics dashboard |
| `POST /v1/dpo/export` | Export DPO training pairs |
| `POST /v1/feedback/rules` | Generate prevention rules |
| `GET /v1/feedback/summary` | Human-readable summary |

Full spec: `openapi/openapi.yaml`

## Deep Dive

For contributors and advanced configuration:

- [Context Engine](docs/CONTEXTFS.md) — multi-agent memory orchestration
- [Intent Router](docs/INTENT_ROUTER.md) — action planning with checkpoint policy
- [Autonomous GitOps](docs/AUTONOMOUS_GITOPS.md) — self-healing CI/CD
- [Verification Evidence](docs/VERIFICATION_EVIDENCE.md) — proof reports

## License

MIT. See [LICENSE](LICENSE).
