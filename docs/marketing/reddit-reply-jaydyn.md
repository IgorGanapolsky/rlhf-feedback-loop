Great question — we actually built and measured this.

We run an RLHF feedback loop as an MCP server for Claude Code. After ~466 tests and months of daily use, here's what moved the needle most:

**Prevention rules** had the single biggest impact on success rate. Every time Claude makes a mistake and gets downvoted feedback, the system extracts a rule (e.g., "never claim done without running tests"). These get injected into context before Claude acts. Our repeated-failure rate dropped significantly once rules accumulated past ~20 entries.

**Pre-action gates** (`satisfy_gate`) were the biggest win for recovery time. Instead of Claude charging ahead and breaking things, it has to prove preconditions are met before proceeding. When a gate fails, you catch it in seconds instead of debugging a mess 10 minutes later.

**Context packs** (`construct_context_pack`) solved the "Claude forgot everything" problem. Each session gets a bounded retrieval of relevant feedback history, prevention rules, and task context. Not a full memory dump — just what's relevant.

**Feedback capture** (`capture_feedback`) is the foundation everything else runs on. Without explicit up/down signals with context, there's nothing to learn from.

The order matters: capture → prevent → gate → retrieve. Each layer compounds.

It's all OSS: https://github.com/IgorGanapolsky/mcp-memory-gateway
