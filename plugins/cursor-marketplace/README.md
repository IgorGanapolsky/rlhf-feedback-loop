# MCP Memory Gateway for Cursor

`MCP Memory Gateway` is the human-facing plugin name in Cursor listings.
`mcp-memory-gateway` stays the plugin slug, npm package, and launcher target.

The canonical short description is:

> Stop Cursor agents from repeating mistakes with local memory, pre-action gates, and proof-backed feedback.

The plugin installs the project MCP server so Cursor agents can:

- capture explicit user feedback with evidence
- recall past mistakes before repeating them
- block known-bad actions before tool use
- promote repeated failures into prevention rules
- export DPO-style preference pairs and analytics bundles

## Plugin contents

- `.cursor-plugin/plugin.json` for Cursor Marketplace metadata
- `.mcp.json` for the `rlhf` MCP server
- `assets/logo-400x400.png` for marketplace branding

This first Cursor package is intentionally minimal. It bundles the MCP server only, which keeps the review surface small and aligns with Cursor Cloud Agents support.

## Install surfaces

### Cursor Marketplace

Use this for installation and plugin metadata distribution.

### Team Marketplace

Cursor Teams and Enterprise can import this repository through `Dashboard -> Settings -> Plugins -> Team Marketplaces`. If Cursor exposes `Enable Auto Refresh`, turn it on so repo-backed plugin updates refresh automatically.

### Cursor Directory

Treat Cursor Directory as a discoverability surface, not the runtime distribution channel. It helps people find the plugin, but npm releases do not rewrite directory copy on their own.

If a manual submission form asks for `Name`, use `MCP Memory Gateway` instead of the slug.

### Local setup before approval

Use the existing project bootstrap:

```bash
npx mcp-memory-gateway init
```

Or copy the plugin MCP config into `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "rlhf": {
      "command": "npx",
      "args": ["-y", "mcp-memory-gateway@latest", "serve"]
    }
  }
}
```

## Update behavior

- Runtime updates: the plugin asks npm for `mcp-memory-gateway@latest`, so new npm releases can flow into the Cursor runtime without editing the plugin config.
- Metadata updates: `npm publish` does not refresh the marketplace description, screenshots, README, or directory listing copy. Republish the plugin bundle when those assets change.
- Guaranteed rollouts: if you need deterministic behavior for a specific release, pin a version manually in local config instead of relying on `@latest`.

## What makes this useful in Cursor

MCP Memory Gateway gives Cursor agents a local-first reliability loop:

- **Repeated-mistake prevention** keeps the same repo failures from coming back every session
- **Veto Layer** gates block known-bad actions before tool use
- **Context engineering** keeps relevant project history in scope
- **Thompson Sampling** and attribution logs improve action ranking
- **DPO exports** let you warehouse and fine-tune downstream

Verification evidence for shipped behavior lives in `docs/VERIFICATION_EVIDENCE.md`.
Release and promotion rules live in `docs/CURSOR_PLUGIN_OPERATIONS.md`.
