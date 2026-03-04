# Requirements: RLHF v3.0 Commercialization

**Defined:** 2026-03-04
**Core Value:** Deploy, bill, distribute — first paying customer

## v3 Requirements

### Deployment

- [x] **DEPLOY-01**: Dockerfile builds and runs the API server with all dependencies
- [ ] **DEPLOY-02**: API server deployed to Railway with HTTPS endpoint accessible from internet — deployment-ready, pending Railway account setup
- [x] **DEPLOY-03**: Health check endpoint returns 200 with version and uptime
- [x] **DEPLOY-04**: Environment variables configurable via Railway dashboard

### Billing

- [ ] **BILL-01**: Stripe Checkout creates a $49/mo Cloud Pro subscription
- [ ] **BILL-02**: On successful payment, system provisions a unique API key and returns it
- [ ] **BILL-03**: API validates incoming requests against provisioned keys (reject invalid/expired)
- [ ] **BILL-04**: Usage metering tracks requests per API key per month

### Plugin Distribution

- [ ] **PLUG-01**: npm package published — `npx rlhf-feedback-loop init` scaffolds local config
- [ ] **PLUG-02**: Claude Code skill installable via one command
- [ ] **PLUG-03**: Codex MCP plugin installable via config.toml one-liner
- [ ] **PLUG-04**: Gemini extension installable via function declaration import
- [ ] **PLUG-05**: Amp skill installable via skill template copy
- [ ] **PLUG-06**: Each plugin has a README with 5-minute setup instructions

### Discovery

- [ ] **DISC-01**: Landing page with pricing, demo, and Stripe checkout button
- [ ] **DISC-02**: ChatGPT GPT Store listing submitted
- [ ] **DISC-03**: Claude MCP Hub submission prepared
- [ ] **DISC-04**: README updated with install commands for all 5 platforms

### Proof Gate

- [ ] **PROOF-01**: Deployed API responds to curl from internet with valid JSON
- [ ] **PROOF-02**: Stripe test-mode checkout flow completes end-to-end
- [ ] **PROOF-03**: npm package installs and runs on clean machine
- [ ] **PROOF-04**: All existing tests still pass (314+), 0 failures

## Out of Scope (v3)

| Feature | Reason |
|---------|--------|
| Enterprise SSO/RBAC | v4 — need paying customers first |
| Multi-tenant data isolation | v4 — single-tenant fine for first 62 customers |
| Custom model fine-tuning service | v4 — OSS DPO export sufficient |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| DEPLOY-01 | Phase 13 | Complete (2026-03-04) |
| DEPLOY-02 | Phase 13 | Deployment-ready, pending Railway credentials |
| DEPLOY-03 | Phase 13 | Complete (2026-03-04) |
| DEPLOY-04 | Phase 13 | Complete (2026-03-04) |
| BILL-01 | Phase 14 | Pending |
| BILL-02 | Phase 14 | Pending |
| BILL-03 | Phase 14 | Pending |
| BILL-04 | Phase 14 | Pending |
| PLUG-01 | Phase 15 | Pending |
| PLUG-02 | Phase 15 | Pending |
| PLUG-03 | Phase 15 | Pending |
| PLUG-04 | Phase 15 | Pending |
| PLUG-05 | Phase 15 | Pending |
| PLUG-06 | Phase 15 | Pending |
| DISC-01 | Phase 16 | Pending |
| DISC-02 | Phase 16 | Pending |
| DISC-03 | Phase 16 | Pending |
| DISC-04 | Phase 16 | Pending |
| PROOF-01 | Phase 17 | Pending |
| PROOF-02 | Phase 17 | Pending |
| PROOF-03 | Phase 17 | Pending |
| PROOF-04 | Phase 17 | Pending |

**Coverage:**
- v3 requirements: 22 total
- Mapped to phases: 22
- Unmapped: 0

---
*Requirements defined: 2026-03-04*
*Traceability updated: 2026-03-04 (v3.0 roadmap created)*
