---
paths:
  - "**/*.test.js"
  - "tests/**/*"
---

# Testing Standards

- **Co-location:** Place tests in `tests/` or files ending in `.test.js`.
- **Smoke Coverage:** Ensure smoke coverage for all new screens, utilities, and navigators.
- **Run Locally:** Always run `npm test` locally before opening a pull request.
- **Isolation:** Use clean worktrees for verification to avoid polluting the main environment.
