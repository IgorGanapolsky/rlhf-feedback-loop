# Trust Center Packet

## Scope

This packet is the buyer-facing trust baseline for `rlhf-feedback-loop` deployments.

## Product Security Posture

- Local-first feedback capture by default.
- Explicit schema validation before memory promotion.
- Rubric and guardrail gates for positive memory promotion.
- Safe-path controls on file operations.
- MCP tool allowlists by profile (`default`, `readonly`, `locked`).

## Deployment Models

1. Local MCP only (no external data plane).
2. Hosted API with bearer authentication.
3. Enterprise deployment with policy-enforced controls.

## Control Families

- Access control and authentication.
- Data validation and integrity enforcement.
- Policy-based MCP tool restriction.
- Operational verification via reproducible proof reports.

## Evidence Bundle

- [VERIFICATION_EVIDENCE.md](../VERIFICATION_EVIDENCE.md)
- [compatibility/report.md](../../proof/compatibility/report.md)
- [compatibility/report.json](../../proof/compatibility/report.json)
- [automation/report.md](../../proof/automation/report.md)
- [automation/report.json](../../proof/automation/report.json)

## Incident and Change Response

- All production-facing behavior changes must include test + proof artifacts.
- Self-healing checks detect drift in test/proof health.
- Security-sensitive MCP profile changes are validated against allowlists.
