# Session Primer

## Active Mission
- **North Star:** Earn **$100/day after-tax profit**.
- **Current Wedge:** $49 "Mistake-Free" Starter Pack (500 credits).
- **Target Audience:** Developers hitting "Claude amnesia" and context compaction.

## Current State (2026-03-20)
- **Revenue Today:** `node bin/cli.js cfo --today --timezone=America/New_York` still falls back to local operator truth and reports `$0.00` booked today.
- **Social Ops:** Zero-filming IG + TikTok pipeline now renders the canonical carousel HTML into `1080x1080` slides, builds a TikTok-safe `1080x1920` MP4 fallback, queues scheduled posts, and emits a `launchd` scheduler plist.
- **Publish Reality:** Browser publish dry-run is verified; live no-share browser proof is currently blocked by Google Chrome reporting `Allow JavaScript from Apple Events` is turned off at runtime.
- **Positioning:** Landing page still frames MCP Memory Gateway as an AI workflow control plane, not a generic memory server.

## Last Completed Task
- Implemented dependency cooldown check

## Exact Next Step
- Wire cooldown into CI pipeline
- Re-enable Google Chrome `View > Developer > Allow JavaScript from Apple Events` and rerun the no-share browser proof command to validate live draft creation without posting.

## Open Blockers
- Need Chainguard API key

## Behavioral Traits

_No strong behavioral patterns identified yet._

## Live Git Context

### Branch: codex/social-pipeline-automation

### Last 5 Commits:
```
b789415 fix: match stdio response transport to request transport (NDJSON support)
3215c0c feat: position gateway as workflow control plane (#292)
73a63c2 feat: add glama.json, M2.7 self-evolution loop, deny-by-default gates (#291)
e0e3693 chore: remove duplicate railway deploy lane (#290)
c8b9976 fix: wait for promoted railway deploys (#289)
```

### Modified Files:
```
 M docs/VERIFICATION_EVIDENCE.md
 M docs/marketing/assets/README.md
 M docs/marketing/social-posts.md
 M package.json
 M primer.md
 M tests/social-marketing-assets.test.js
?? docs/marketing/assets/pre-action-gates-caption.txt
?? docs/marketing/assets/pre-action-gates-instagram-carousel.html
?? docs/marketing/social-automation.md
?? scripts/social-pipeline.js
?? tests/social-pipeline.test.js
```
