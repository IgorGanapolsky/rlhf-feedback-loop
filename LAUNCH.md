# FIRST DOLLAR LAUNCH PLAN (March 11, 2026)

The engineering proof is real. The commercial surface must stay honest.

## 1. The Monetization Surface
- **Live Hosted App**: [Context Gateway](https://rlhf-feedback-loop-production.up.railway.app)
- **Canonical Checkout Flow**: Start from the hosted app so checkout, onboarding, and funnel evidence stay on one billing origin.

## 2. Acquisition: The Outreach Script
Post this to your X/Twitter and LinkedIn immediately:

> "Agent memory is broken. Most agents have amnesia after every session.
>
> Today we launched **MCP Memory Gateway** — the 'Always-On' Veto Layer for AI Agents. 
> 
> ✅ Thumbs-Up/Down feedback loops
> ✅ Automatic prevention rules (Never make the same mistake twice)
> ✅ Local-first memory and DPO export
> ✅ $9 one-time Pro Pack for production configs
> 
> OSS core: https://github.com/IgorGanapolsky/mcp-memory-gateway
> Pro Pack: https://iganapolsky.gumroad.com/l/tjovof"

## 3. High-Intent Direct Messages
Send this to the top 3 agent builders in your network:

> "Hey, I just launched MCP Memory Gateway. It captures thumbs-up/down feedback, turns repeated failures into guardrails, and keeps the OSS core free. The public self-serve offer is a $9 one-time Pro Pack, and hosted pilots are by request. Would love your honest feedback: https://github.com/IgorGanapolsky/mcp-memory-gateway"

## 4. Commercial Truth
Use [docs/COMMERCIAL_TRUTH.md](docs/COMMERCIAL_TRUTH.md) as the source of truth for pricing, traction, and proof claims. Do not cite GitHub stars, npm downloads, or solo-maintainer activity as customer proof.

## 5. Verification
I am monitoring the repo-local billing proxy (`node bin/cli.js cfo`) in this checkout. It reports paid events, active keys, customer IDs, and usage from the append-only funnel ledger plus the local key store. The hosted API exposes the same summary shape at `GET /v1/billing/summary` when queried with the admin key. This is an operational proxy, not booked-revenue accounting.

Engineering is done. Pricing and traction claims must stay evidence-backed.
