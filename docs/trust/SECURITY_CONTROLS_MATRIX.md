# Security Controls Matrix

| Control Domain | Control | Implementation | Evidence |
|---|---|---|---|
| Authentication | API requests require bearer auth by default | `src/api/server.js` auth checks | [VERIFICATION_EVIDENCE.md](../VERIFICATION_EVIDENCE.md) |
| Input Validation | Feedback schema + normalization gates | `scripts/feedback-schema.js` | `npm test` (`test:schema`) |
| Memory Safety | Low-signal feedback rejected from promotion | `scripts/feedback-loop.js` gating rules | [automation/report.md](../../proof/automation/report.md) |
| MCP Least Privilege | Tool access allowlisted by profile | `config/mcp-allowlists.json`, `scripts/mcp-policy.js` | [compatibility/report.md](../../proof/compatibility/report.md) |
| Path Safety | External output paths blocked | safe-path checks in API + MCP tools | [automation/report.md](../../proof/automation/report.md) |
| Integrity of Claims | Proof artifacts generated in JSON + Markdown | `scripts/prove-*.js` | `proof/*-report.{json,md}` |
| Runtime Reliability | Self-healing checks for tests/proofs/budget | `scripts/self-healing-check.js` | [VERIFICATION_EVIDENCE.md](../VERIFICATION_EVIDENCE.md) |
