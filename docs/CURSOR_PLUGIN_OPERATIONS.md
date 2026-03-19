# Cursor Plugin Operations

## What each surface does

- Cursor Marketplace: install and metadata distribution surface
- Team Marketplace: private repo-backed install surface for Cursor Teams and Enterprise
- Cursor Directory: discoverability surface only

## Update behavior

- Runtime path: the Cursor plugin launches `npx -y mcp-memory-gateway@latest serve`.
- npm releases: publishing a new npm package can update the runtime that Cursor installs or launches.
- Marketplace metadata: `npm publish` does not update the listing description, screenshots, README copy, or directory profile.
- Team refresh: if a Team Marketplace is repo-backed, enable Auto Refresh when the admin UI exposes it.

## Release workflow

1. Publish the npm package when runtime code changes.
2. Verify the latest package is available with `npm view mcp-memory-gateway version`.
3. Bump plugin manifests when plugin copy, assets, or packaging changed.
4. Refresh the public Marketplace submission or Team Marketplace repo when metadata changed.
5. Refresh Cursor Directory copy separately when the positioning changes.

## Positioning rules

- Lead with the user problem: stop Cursor agents from repeating mistakes.
- Lead with outcome before architecture: memory, pre-action gates, proof.
- Keep `Agentic Feedback Studio`, `Veto Layer`, `DPO`, and `Thompson Sampling` in the body or tags, not the first sentence.
- Keep proof near the pitch by linking [VERIFICATION_EVIDENCE.md](./VERIFICATION_EVIDENCE.md).

## Suggested short description

Stop Cursor agents from repeating mistakes with local memory, pre-action guardrails, and verification-backed feedback loops.

## Suggested long description

MCP Memory Gateway gives Cursor agents a local-first reliability loop. Capture feedback with evidence, recall past failures before repeating them, block known-bad actions with the Veto Layer, and keep proof close to every workflow change.
