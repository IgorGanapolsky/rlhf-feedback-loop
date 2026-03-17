---
paths:
  - "**/*"
---

# Domain 2: Tool Scoping and Profile Selection

Follow these rules when selecting an MCP security profile for a session or intent plan:

- **default**: Use for standard development, refactoring, and general automation.
- **readonly**: Use for security audits, PR reviews, and architectural explorations where no state changes are required.
- **locked**: Use for critical production environments or highly sensitive tasks where only a subset of diagnostic tools is permitted.
- **essential**: Use for low-context or budget-constrained subagent sessions.

## Selection Logic
1. Analyze the intent risk level (Low/Medium/High/Critical).
2. If risk is **High** or **Critical**, default to `readonly` for investigation and require manual approval before switching to `default` for execution.
3. If risk is **Low**, prefer `essential` to minimize context window usage.
