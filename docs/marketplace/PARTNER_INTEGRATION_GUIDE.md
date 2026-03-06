# Partner Integration Guide

## Integration Steps

1. Install package: `npm i rlhf-feedback-loop`.
2. Add MCP server entry or run `init` for auto-setup.
3. Validate handshake by calling `initialize` and `tools/list`.
4. Enable profile-appropriate tool allowlists.
5. Run proof harness before production rollout.

## Partner Validation Commands

```bash
npm test
npm run prove:adapters
npm run prove:automation
```

## Required Evidence for Partner Sign-Off

- Compatibility report (`proof/compatibility/report.json` + `.md`)
- Automation report (`proof/automation/report.json` + `.md`)
- Verification summary (`docs/VERIFICATION_EVIDENCE.md`)
