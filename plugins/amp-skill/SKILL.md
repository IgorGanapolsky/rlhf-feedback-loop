---
name: rlhf-feedback
description: Capture thumbs feedback and apply prevention rules before coding
---

# Amp RLHF Skill

On explicit user feedback:

```bash
node .rlhf/capture-feedback.js --feedback=up --context="..." --tags="..."
node .rlhf/capture-feedback.js --feedback=down --context="..." --what-went-wrong="..." --what-to-change="..." --tags="..."
```

Before major implementation:

```bash
node .rlhf/capture-feedback.js --feedback=up --context="session start" --tags="session" 2>/dev/null || true
```

## Triggers

- "thumbs up" / "that worked" / "looks good"
- "thumbs down" / "that failed" / "that was wrong"

## Negative Triggers (do NOT activate for)

- "generate code"
- "search files"
- "explain this"
- "run tests"
