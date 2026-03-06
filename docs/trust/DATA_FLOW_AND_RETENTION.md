# Data Flow and Retention

## Data Flow

1. Agent/user sends explicit feedback signal (`up` or `down`) with context.
2. Signal is validated against schema constraints.
3. Feedback event is appended to local feedback log.
4. Memory promotion occurs only when quality gates pass.
5. Optional exports generate DPO training pairs.

## Data Classes

- Feedback events (context, tags, signal, timestamps).
- Memory records (promoted patterns).
- Prevention rules (aggregated anti-regression controls).
- Proof artifacts (machine-readable verification metadata).

## Retention Defaults

- Local-first logs are retained in project storage until deleted by operator policy.
- No mandatory cloud sync is required for local MCP deployments.

## Deletion and Portability

- JSONL logs are human-readable and removable with standard file operations.
- Export formats support downstream model training pipelines.

## Data Boundary Statement

In local MCP mode, data remains in the developer-controlled environment unless explicitly exported or sent to a hosted API endpoint.
