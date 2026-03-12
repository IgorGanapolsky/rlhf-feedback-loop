# HACKERNEWS — Launch Post

Generated: 2026-03-11T20:27:13.382Z

# Show HN: MCP Memory Gateway – Local-First Feedback Loop for AI Agents

**Primary Title:**
Show HN: MCP Memory Gateway – Local-first memory pipeline for AI agents

**Alternative Titles:**
1. Show HN: MCP Memory Gateway – Thompson Sampling for agent feedback routing
2. Show HN: MCP Memory Gateway – Generate fine-tuning data from agent failures

---

## Post Body

I've been working on a problem that hits most people building AI agents: how do you actually learn from what works and what doesn't? Most setups treat feedback as write-once data. MCP Memory Gateway inverts that.

It's a local-first memory and feedback pipeline that captures thumbs-up/down signals from Claude, Codex, Amp, and Gemini interactions, then surfaces patterns you can actually act on. Here's what makes it different:

**Thompson Sampling for feedback routing** — Instead of random sampling, the system uses Thompson Sampling to intelligently route which feedback signals matter most, reducing noise in your training data.

**Prevention rules from repeated failures** — When an agent fails the same way twice, the system generates a prevention rule. This gets exported alongside your training pairs, so your fine-tuning includes both what to do and what not to do.

**DPO/KTO export** — All captured preferences export as Direct Preference Optimization or Kahneman-Tversky Optimization pairs, ready for your fine-tuning pipeline. No manual formatting.

The whole thing runs locally—no external APIs, no proprietary platforms. Install with:

```
npx rlhf-feedback-loop init
```

Then drop it into your agent loop. The Pro Pack ($9 on Gumroad) adds multi-agent coordination and extended memory windows.

Built this because existing feedback systems felt like they were optimizing for dashboards instead of actual learning. Wanted something that treated agent feedback as actionable training signal.

Full code and docs: https://github.com/IgorGanapolsky/mcp-memory-gateway

Thanks for checking it out.

---

## Notes for Posting

Follow these guidelines when submitting[1][2][3]:

- **Use first-person voice** throughout your post description[1]
- **Include the backstory** of why you built this and what's different about it[3]
- **Be technical, not promotional** — drop marketing language; use factual, direct explanations[3]
- **Make sure people can try it** — Include the npm command so readers can immediately experiment[1]
- **Stay around to answer questions** in the thread[4]