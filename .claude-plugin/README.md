# MCP Memory Gateway for Claude Desktop

`mcp-memory-gateway` gives Claude Desktop a local-first **Agentic Feedback Studio** and **Veto Layer** for workflow hardening.

The extension path is useful when a team wants Claude Desktop to keep one workflow sharper over time without adding another orchestration layer. The MCP server captures explicit feedback, recalls past failures, promotes reusable prevention rules, and produces proof-backed rollout artifacts.

## Features

- Workflow hardening for Claude-first engineering and ops workflows
- Veto Layer gates that block repeated mistakes before tool use
- Reliability memory and recall across long sessions
- Bounded context packs, provenance, and diagnostics
- DPO export and analytics bundle generation after runtime reliability lands

## Installation

### Local install today

Use the portable npm launcher:

```bash
claude mcp add rlhf -- npx -y mcp-memory-gateway serve
```

Or use the project bootstrap:

```bash
npx mcp-memory-gateway init
```

### Anthropic directory path

If Anthropic approves the listing, install from Claude Desktop via `Settings -> Extensions`.

Directory inclusion is an external review process. Do not claim listing or approval before it is real.

## Configuration

The local OSS path needs no API key.

Optional hosted path:

```json
{
  "mcpServers": {
    "rlhf": {
      "command": "npx",
      "args": ["-y", "mcp-memory-gateway", "serve"],
      "env": {
        "RLHF_BASE_URL": "https://rlhf-feedback-loop-production.up.railway.app",
        "RLHF_API_KEY": "rlhf_YOUR_KEY_HERE"
      }
    }
  }
}
```

## Examples

### Example 1: PR review hardening

Ask Claude Desktop to review a PR, capture the failure when it skips a blocker, and let the Veto Layer promote that pattern into a reusable gate.

### Example 2: Code modernization workflow

Use Claude Desktop on a long refactor and keep migration notes, architecture constraints, and verification steps durable across sessions instead of re-explaining them every time.

### Example 3: Internal ops or release workflow

Run one internal workflow repeatedly, attach proof artifacts, and keep repeated mistakes from leaking into the next operator run.

## Privacy Policy

Privacy policy: https://rlhf-feedback-loop-production.up.railway.app/privacy

## Support

- GitHub Issues: https://github.com/IgorGanapolsky/mcp-memory-gateway/issues
- Security Advisories: https://github.com/IgorGanapolsky/mcp-memory-gateway/security
- Verification evidence: https://github.com/IgorGanapolsky/mcp-memory-gateway/blob/main/docs/VERIFICATION_EVIDENCE.md

## Notes For Submission

- Local Claude metadata lives in `.claude-plugin/plugin.json` and `.claude-plugin/marketplace.json`.
- Anthropic directory requirements and the internal publish checklist live in `docs/CLAUDE_DESKTOP_EXTENSION.md`.
