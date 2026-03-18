# Claude Desktop Extension Plan

Status: current  
Updated: March 18, 2026

This document turns the existing Claude-specific bundle metadata into a concrete promotion and submission packet for Claude Desktop.

Commercial guardrails:

- Use [COMMERCIAL_TRUTH.md](COMMERCIAL_TRUTH.md) for revenue and traction claims.
- Use [VERIFICATION_EVIDENCE.md](VERIFICATION_EVIDENCE.md) plus proof reports for engineering authority.
- Do not claim directory approval, partnership, or listing status before it is real.

## Why this matters

Claude Desktop extensions are a real discovery surface for Claude-first users.

For this repo, that means:

- one-click discovery is a demand lane
- local install lowers friction for Claude-first buyers
- directory inclusion supports credibility, but it is not customer proof

## Official references

- Anthropic Local MCP Server Submission Guide: https://support.claude.com/en/articles/12922832-local-mcp-server-submission-guide
- Anthropic Software Directory Terms: https://support.claude.com/en/articles/13145338-anthropic-software-directory-terms
- Anthropic Software Directory Policy: https://support.claude.com/en/articles/13145358-anthropic-software-directory-policy
- MCPB manifest specification: https://github.com/modelcontextprotocol/mcpb/blob/main/MANIFEST.md

## Repo assets already in place

- Claude plugin metadata: [../.claude-plugin/plugin.json](../.claude-plugin/plugin.json)
- Claude marketplace metadata: [../.claude-plugin/marketplace.json](../.claude-plugin/marketplace.json)
- Claude extension README: [../.claude-plugin/README.md](../.claude-plugin/README.md)
- Local install config example: [../adapters/claude/.mcp.json](../adapters/claude/.mcp.json)
- Privacy policy URL: `https://rlhf-feedback-loop-production.up.railway.app/privacy`
- Security policy: [../SECURITY.md](../SECURITY.md)
- Proof pack: [VERIFICATION_EVIDENCE.md](VERIFICATION_EVIDENCE.md)
- Public server metadata: [../server.json](../server.json)

## Local install path

Use the portable install command in Claude Desktop today:

```bash
claude mcp add rlhf -- npx -y mcp-memory-gateway serve
```

Or bootstrap from the package:

```bash
npx mcp-memory-gateway init
```

## Submission-ready messaging

Use:

- Claude Desktop extension
- Claude workflow hardening
- Veto Layer
- Agentic Feedback Studio
- proof-backed reliability

Do not use:

- official Anthropic partner
- Anthropic-approved extension
- directory-listed today
- any unverified customer or ROI claim

## Anthropic requirements mapped to this repo

### 1. Tool safety annotations

Anthropic requires every tool to declare `readOnlyHint` or `destructiveHint`.

This repo now enforces that contract in the MCP tool registry and test suite:

- tool definitions: [../scripts/tool-registry.js](../scripts/tool-registry.js)
- verification: [../tests/mcp-server.test.js](../tests/mcp-server.test.js)

### 2. Privacy policy

- Public privacy route exists at `https://rlhf-feedback-loop-production.up.railway.app/privacy`
- The Claude extension README links directly to it

### 3. Support and vulnerability reporting

- Issues: GitHub issue tracker
- Security reports: GitHub Security Advisories
- Support policy: [../SECURITY.md](../SECURITY.md)

### 4. Usage examples

The Claude extension README includes three examples:

- PR review hardening
- code modernization workflow
- internal ops or release workflow

### 5. Proof and trust layer

Every buyer-facing or directory-facing claim should point back to:

- [VERIFICATION_EVIDENCE.md](VERIFICATION_EVIDENCE.md)
- [../proof/compatibility/report.json](../proof/compatibility/report.json)
- [../proof/automation/report.json](../proof/automation/report.json)

## Promotion lanes

### 1. Public landing page

Call out the Claude Desktop extension path as:

- install locally today
- review proof and privacy before rollout
- treat directory inclusion as discoverability, not traction proof

### 2. GEO fan-out

Target high-intent queries and fan-out pages around:

- Claude Desktop extensions
- Claude Desktop plugins
- local MCP servers for Claude Desktop
- Claude workflow hardening

### 3. Repo metadata

Keep `.claude-plugin/plugin.json` and `.claude-plugin/marketplace.json` aligned with:

- package version
- current product description
- keywords for `claude-desktop`, `workflow-hardening`, and `veto-layer`

## Submission checklist

1. Re-run the standard verification suite.
2. Keep Claude plugin metadata version-aligned with `package.json`.
3. Confirm privacy, support, and proof links resolve.
4. Prepare MCPB packaging if Anthropic requires a final `.mcpb` artifact for submission.
5. Submit through Anthropic's official directory process.
6. Do not market the directory listing until approval is real.
