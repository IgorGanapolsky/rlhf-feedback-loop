# Zero-Filming IG + TikTok Automation

This is the local-first social pipeline for MCP Memory Gateway.

It exists so we can ship founder-style IG and TikTok content without filming, manual screenshotting, or manual posting.

## What The Pipeline Does

1. Renders a repo-owned HTML carousel into `1080x1080` PNG slides.
2. Builds a TikTok-safe `1080x1920` MP4 fallback from those same slides.
3. Writes a bundle manifest with canonical asset paths and platform captions.
4. Queues timed posts under local runtime state in `.rlhf/social-post-queue.json`.
5. Publishes through the already-authenticated Chrome session for Instagram and TikTok.

## Canonical Source

- Carousel HTML: [assets/pre-action-gates-instagram-carousel.html](./assets/pre-action-gates-instagram-carousel.html)
- Caption: [assets/pre-action-gates-caption.txt](./assets/pre-action-gates-caption.txt)

## Prerequisites

- macOS
- Google Chrome with the target IG/TikTok accounts already logged in
- `View -> Developer -> Allow JavaScript from Apple Events` enabled in Chrome
- `ffmpeg` installed and available on `PATH`

## Commands

Prepare a bundle:

```bash
npm run social:prepare -- --slug pre-action-gates
```

Queue the prepared bundle:

```bash
npm run social:queue -- \
  --bundle .artifacts/social/pre-action-gates/bundle.json \
  --when 2026-03-23T09:00:00-04:00 \
  --platforms instagram,tiktok
```

Re-running the same queue command for the same bundle, schedule, and platforms reuses the existing pending entry instead of creating a duplicate post.

Inspect queue state:

```bash
npm run social:status
```

Prepare browser drafts without publishing:

```bash
npm run social:publish -- \
  --bundle .artifacts/social/pre-action-gates/bundle.json \
  --platforms instagram,tiktok \
  --no-share \
  --cleanup-drafts
```

Publish immediately:

```bash
npm run social:publish -- \
  --bundle .artifacts/social/pre-action-gates/bundle.json \
  --platforms instagram,tiktok
```

Publish all due queue entries:

```bash
npm run social:publish:queue
```

Install a `launchd` scheduler that checks the queue every 15 minutes:

```bash
npm run social:scheduler:install
```

Preview the generated `launchd` file without installing it:

```bash
npm run social:scheduler:install -- --dry-run
```

## Runtime Notes

- Instagram uses the same 5-slide carousel bundle directly.
- TikTok web currently exposes a `video/*` uploader on this account surface, so the pipeline uses the generated MP4 fallback instead of a photo carousel.
- Queue state lives under `.rlhf/` and is intentionally local-only.
- The pipeline supports `--dry-run` and `--no-share` so browser automation can be verified without pushing duplicate live posts.
- Install the `launchd` agent only from a durable checkout path you intend to keep, because the plist points at the repo path that installed it.
