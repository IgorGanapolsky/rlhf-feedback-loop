# Marketplace Integration Surface

## Goal

Define a stable integration contract that supports marketplace listing and partner distribution.

## Core Components

1. MCP transport endpoint (stdio) for local agent platforms.
2. HTTPS API endpoints for hosted/team workflows.
3. Policy and allowlist controls for safe tool execution.
4. Machine-readable proof artifacts for buyer due diligence.

## Required Integration Behaviors

- Deterministic initialize/list/call flow for MCP tools.
- Safe-path enforcement on file output/input operations.
- Profile-aware tool access control.
- Evidence generation for adapter compatibility and automation behavior.

## Integration Interfaces

- CLI: `rlhf-feedback-loop serve`, `init`, `capture`, `prove`.
- MCP config patterns for Claude/Codex/Gemini/Cursor.
- API contract documented in `openapi/openapi.yaml`.

## Marketplace Positioning

Sell as the governance and reliability layer for enterprise agent workflows, not as a model replacement.
