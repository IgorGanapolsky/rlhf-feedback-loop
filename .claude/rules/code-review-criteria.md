---
paths:
  - "**/*"
---

# Code Review Criteria

When performing automated code reviews, focus on these categories:

- **Bugs:** Flag missing null checks, race conditions, and logical errors.
- **Security:** Identify hardcoded secrets, directory traversal vulnerabilities, and unsafe dependencies.
- **Reliability:** Ensure error handling uses structured metadata and retry logic where appropriate.
- **Maintainability:** Modular components, clear naming conventions, and two-space indentation.

**Severity Levels:**
- **CRITICAL:** Blocks merge (e.g., security leaks, major bugs).
- **MAJOR:** Requires fix but might not block emergency hotfixes.
- **MINOR:** Stylistic suggestions or non-critical improvements.
