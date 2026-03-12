# DEVTO — Launch Post

Generated: 2026-03-11T20:27:45.040Z

```yaml
---
title: Teaching AI Agents to Learn from Their Mistakes with MCP Memory Gateway
published: true
description: Build a self-improving AI agent memory system using MCP Memory Gateway. Capture feedback, generate prevention rules, and export RLHF data for fine-tuning in a 5-phase pipeline.
tags: ai, machinelearning, webdev, opensource
cover_image: https://images.unsplash.com/photo-1677442136019-21780ecad995?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&q=80
---
```

# Teaching AI Agents to Learn from Their Mistakes with MCP Memory Gateway

As AI agents become core to our workflows—from code generation in Cursor to task automation in custom apps—they often repeat the same failures. An agent might hallucinate the wrong API endpoint or forget your preferred code style across sessions. What if it could **learn from thumbs-up/down feedback**, store reusable memories, auto-generate prevention rules, and export RLHF pairs for fine-tuning?

Enter **MCP Memory Gateway**, a local-first memory and feedback pipeline for AI agents built on the **Model Context Protocol (MCP)**. It turns your agent's mistakes into structured improvements via a 5-phase pipeline: **Capture → Validate → Remember → Prevent → Export**.

In this tutorial, I'll walk you through installing MCP Memory Gateway, integrating it with your MCP-enabled agents (like Cursor or Claude), and watching your agent self-improve. We'll use the `npx rlhf-feedback-loop init` CLI to bootstrap everything. By the end, you'll have a dashboard tracking your agent's **learning curve**—showing failure rates dropping over time.

This is production-grade for developers: fully local, zero vendor lock-in, and exports **KTO/DPO pairs** ready for fine-tuning on Hugging Face or OpenAI.

## Why MCP Memory Gateway?

MCP standardizes how AI agents connect to tools and data sources.[3] Agents (MCP Hosts) discover and invoke capabilities from MCP Servers via Clients.[1][3] But raw MCP lacks **persistent, feedback-driven memory**. Agents forget sessions, repeat errors, and can't distill learnings into fine-tuning data.

MCP Memory Gateway fills this gap:
- **Local-first**: Runs on your machine, no cloud required.
- **RLHF pipeline**: Captures thumbs-up/down signals from interactions.
- **Reusable memories**: Promotes high-quality memories for cross-session recall.
- **Prevention rules**: Auto-generates rules from repeated failures (e.g., "Never use `fetch` for authenticated APIs").
- **Export for fine-tuning**: Outputs KTO (Kahneman-Tversky Optimization) or DPO (Direct Preference Optimization) pairs.

It's designed for MCP ecosystems like Cursor, Claude, or custom OpenAI Agents SDK setups.[2]

## Quickstart: Bootstrap Your Memory Gateway

Fire up your terminal and run:

```bash
npx rlhf-feedback-loop@latest init my-agent-memory
```

This scaffolds a full MCP Memory Gateway project:

```
my-agent-memory/
├── mcp-server/          # MCP-compliant memory server
├── feedback-ui/         # Thumbs-up/down dashboard
├── dashboard/           # Learning curve + memories
├── config.yaml          # Pipeline rules
├── .env.example         # API keys (OpenAI/Anthropic)
└── package.json
```

Copy `.env.example` to `.env` and add your LLM provider key:

```bash
cp .env.example .env
# Edit .env: OPENAI_API_KEY=sk-...
```

Start the stack:

```bash
npm run dev
```

- MCP Server: `http://localhost:8787` (connect your agents here)
- Feedback UI: `http://localhost:3000`
- Dashboard: `http://localhost:3001`

Your MCP Memory Gateway is live. Cursor/Claude can now connect via `http://localhost:8787` as an MCP endpoint.[1]

## The 5-Phase Pipeline: How Agents Self-Improve

MCP Memory Gateway processes every agent interaction through five phases. Each builds on the last, turning raw feedback into actionable intelligence.

### Phase 1: **Capture** – Log Interactions with Feedback

Every agent action hits the MCP server, which logs:
- **Prompt**: User query.
- **Response**: Agent output.
- **Context**: Retrieved memories/tools used.
- **Feedback**: Thumbs-up 👍 (preferred) or thumbs-down 👎 (reject).

Use the feedback UI at `localhost:3000` post-interaction:

```json
{
  "session_id": "abc123",
  "interaction_id": "int-456",
  "feedback": "thumbs_down",
  "reason": "Wrong API endpoint: used /v1/users instead of /v2/customers"
}
```

CLI capture for scripts:

```bash
npx rlhf-feedback-loop capture --session abc123 --id int-456 --feedback thumbs_down --reason "Wrong endpoint"
```

> **Pro Tip**: Integrate with your agent loop. In OpenAI Agents SDK, hook `result.final_output` to auto-log.[2]

### Phase 2: **Validate** – Quality Gate for Memories

Not all interactions are worth remembering. Validation filters junk:

- **Success rate**: Thumbs-up > 70%.
- **Novelty**: TF-IDF similarity < 0.8 vs. existing memories.
- **Brevity**: < 500 tokens.

Run validation:

```bash
npx rlhf-feedback-loop validate --session abc123
```

Output:
```
Validated 12/15 interactions.
Promoted: 8 high-quality memories.
Rejected: 3 duplicates/low-value.
```

Invalidated items get pruned; winners advance.

### Phase 3: **Remember** – Persistent, Reusable Storage

Validated interactions become **memories** stored in a vector DB (local Chroma by default).

Memories are tagged by domain (e.g., "API-calls", "code-style") and retrievable via MCP tools like `get_memory(domain)` or `search_memories(query)`.

Query in your agent:

```
User: "Build a time-tracker app"
Agent retrieves: "time-track plan" from memory[1]
```

Dashboard at `localhost:3001` shows:

```
Memories: 42 total
- API Endpoints: 12 👍95% success
- Code Style: 8 👍88%
- Task Plans: 22 👍82%
```

### Phase 4: **Prevent** – Generate Rules from Failures

Repeated failures trigger **prevention rules**. E.g., 3+ thumbs-down on "Wrong endpoint":

```yaml
# Auto-generated: config/prevention-rules.yaml
rules:
  - pattern: "use /v1/users"
    action: "reject"
    reason: "Repeated failure: Use /v2/customers instead"
    score: 0.92  # Confidence
```

These inject into agent prompts via MCP:

```
System: Prevention Rules Active:
- Never use /v1/users → /v2/customers
```

CLI to regenerate:

```bash
npx rlhf-feedback-loop prevent --min-failures 3
```

Failure rate drops as rules compound.

### Phase 5: **Export** – RLHF Data for Fine-Tuning

Distill learnings into **KTO/DPO pairs**:

```bash
npx rlhf-feedback-loop export --format kto --output ./data/
```

Generates `kto_pairs.jsonl`:

```json
{"prompt": "Fetch users from API", "preferred": "Use /v2/customers", "rejected": "Don't use /v1/users", "weight": 1.0}
```

Upload to Hugging Face for fine-tuning or OpenAI fine-tunes. Track iterations in the dashboard.

## The Learning Curve Dashboard

The killer feature: real-time **learning curve** at `localhost:3001/analytics`.

```
Session | Total Int. | 👍 Rate | Failure Patterns Fixed
--------|------------|---------|------------------------
1       | 15         | 62%     | -
2       | 22         | 78%     | 3/5 endpoint errors
3       | 18         | 89%     | 7/8 total rules active
4       | 25         | 94%     | Convergence: 92%

📈 Success Rate: +32% over 4 sessions
🔥 Top Prevention Rule: "No /v1/users" (saved 12 failures)
```

Plots show **convergence**: thumbs-up rate approaching 95% as rules saturate.

## Real-World Example: Cursor + MCP Memory Gateway

1. Start gateway: `npm run dev`.
2. In Cursor settings, add MCP server: `http://localhost:8787`.
3. Prompt: "Build a time-tracker using my saved plan."
   - Agent pulls "time-track plan" memory.[1]
4. Output wrong? Thumbs-down in feedback UI.
5. Next session: Prevention rules fix it automatically.

Scale to teams: Shared MCP server across Cursor/Claude instances.

## Production Tips

- **Scale storage**: Swap Chroma for Pinecone in `config.yaml`.
- **Multi-LLM**: Add Anthropic/Claude via `.env`.
- **Agent Integration**:
  ```python
  # OpenAI Agents SDK[2]
  agent = OpenAI-Agent(mcp_servers=["http://localhost:8787"])
  result = agent.run("Task with memory")
  log_feedback(result)  # Custom hook
  ```
- **CI/CD**: `npm run export` → GitHub Actions → HF fine-tune.

## Get Started Today

MCP Memory Gateway makes agents **anti-fragile**: they improve from every mistake. No more resetting context or manual prompt hacks.

- **GitHub**: https://github.com/IgorGanapolsky/mcp-memory-gateway
- **Install**: `npx rlhf-feedback-loop init your-project`
- **Pro Pack**: Advanced features like team sync + auto-fine-tuning (coming soon—DM on X @IgorGanapolsky)

Fork, star, and build. What's your agent's biggest failure mode? Let's fix it.

*Word count: 1028*