'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '..');
const {
  DEFAULT_ASSET_HTML,
  DEFAULT_CAPTION_PATH,
  buildChromeJavaScriptAppleScript,
  buildLaunchAgentPlist,
  enqueueBundle,
  extractSlideBlocks,
  getDueEntries,
  loadQueueState,
  normalizeTikTokCaption,
  prepareBundle,
  writeIsolatedSlideDocuments,
} = require('../scripts/social-pipeline');

function makeTempDir(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

test('canonical IG carousel asset exposes five slide blocks', () => {
  const html = fs.readFileSync(DEFAULT_ASSET_HTML, 'utf8');
  const slides = extractSlideBlocks(html);
  assert.equal(slides.length, 5);
  assert.match(slides[0], /slide-1/);
  assert.match(slides[4], /slide-5/);
});

test('isolated slide documents are generated from the canonical HTML asset', () => {
  const tempDir = makeTempDir('social-slides-');
  const documents = writeIsolatedSlideDocuments({
    sourceHtmlPath: DEFAULT_ASSET_HTML,
    outputDir: tempDir,
  });

  assert.equal(documents.length, 5);
  assert.equal(fs.existsSync(documents[0]), true);
  assert.match(fs.readFileSync(documents[0], 'utf8'), /slide-1/);
  assert.match(fs.readFileSync(documents[0], 'utf8'), /\.slide-label \{ display: none !important; \}/);
});

test('prepareBundle writes bundle manifest, captions, and deterministic asset paths', () => {
  const tempDir = makeTempDir('social-bundle-');
  const result = prepareBundle({
    sourceHtmlPath: DEFAULT_ASSET_HTML,
    captionPath: DEFAULT_CAPTION_PATH,
    outputDir: tempDir,
    slug: 'pre-action-gates',
    chromeBin: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    ffmpegBin: '/opt/homebrew/bin/ffmpeg',
    renderSlidesFn: ({ slideDocuments, outputDir }) => {
      return slideDocuments.map((_, index) => {
        const outPath = path.join(outputDir, `slide-${String(index + 1).padStart(2, '0')}.png`);
        fs.writeFileSync(outPath, `png-${index + 1}`);
        return outPath;
      });
    },
    renderTikTokVideoFn: ({ outputPath }) => {
      fs.writeFileSync(outputPath, 'video');
      return outputPath;
    },
  });

  assert.equal(fs.existsSync(result.manifestPath), true);
  assert.equal(result.manifest.slideImagePaths.length, 5);
  assert.equal(fs.existsSync(result.manifest.instagramCaptionPath), true);
  assert.equal(fs.existsSync(result.manifest.tiktokCaptionPath), true);
  assert.equal(fs.existsSync(result.manifest.tiktokVideoPath), true);
  assert.match(
    fs.readFileSync(result.manifest.tiktokCaptionPath, 'utf8'),
    /Pre-Action Gates don't ask - they enforce\./
  );
});

test('queue state persists pending entries and due filtering only returns scheduled work', () => {
  const tempDir = makeTempDir('social-queue-');
  const bundlePath = path.join(tempDir, 'bundle.json');
  const queuePath = path.join(tempDir, 'queue.json');

  fs.writeFileSync(bundlePath, JSON.stringify({ id: 'bundle-1' }));
  const entry = enqueueBundle({
    queuePath,
    bundlePath,
    scheduledAt: '2026-03-20T10:00:00.000Z',
    platforms: ['instagram', 'tiktok'],
  });

  const queueState = loadQueueState(queuePath);
  assert.equal(queueState.entries.length, 1);
  assert.equal(queueState.entries[0].id, entry.id);

  const due = getDueEntries(queueState, new Date('2026-03-20T10:01:00.000Z'));
  assert.equal(due.length, 1);
  assert.equal(due[0].bundleId, 'bundle-1');

  const notDue = getDueEntries(queueState, new Date('2026-03-20T09:59:00.000Z'));
  assert.equal(notDue.length, 0);
});

test('enqueueBundle is idempotent for the same pending bundle, schedule, and platforms', () => {
  const tempDir = makeTempDir('social-queue-dedupe-');
  const bundlePath = path.join(tempDir, 'bundle.json');
  const queuePath = path.join(tempDir, 'queue.json');

  fs.writeFileSync(bundlePath, JSON.stringify({ id: 'bundle-1' }));
  const first = enqueueBundle({
    queuePath,
    bundlePath,
    scheduledAt: '2026-03-20T10:00:00.000Z',
    platforms: ['tiktok', 'instagram', 'instagram'],
  });
  const second = enqueueBundle({
    queuePath,
    bundlePath,
    scheduledAt: '2026-03-20T10:00:00.000Z',
    platforms: ['instagram', 'tiktok'],
  });

  const queueState = loadQueueState(queuePath);
  assert.equal(first.id, second.id);
  assert.deepEqual(first.platforms, ['instagram', 'tiktok']);
  assert.equal(queueState.entries.length, 1);
});

test('Chrome AppleScript only focuses a window/tab when it is not already frontmost', () => {
  const script = buildChromeJavaScriptAppleScript({
    urlPrefix: 'https://www.instagram.com/',
    openUrl: 'https://www.instagram.com/',
    tempJsPath: '/tmp/social-proof.js',
  });

  assert.match(script, /if \(index of targetWindow\) is not 1 then set index of targetWindow to 1/);
  assert.match(script, /if \(active tab index of targetWindow\) is not targetTabIndex then set active tab index of targetWindow to targetTabIndex/);
});

test('normalizeTikTokCaption collapses multiline IG captions to one line', () => {
  const input = [
    'Every AI memory tool asks the agent to cooperate.',
    'Pre-Action Gates do not ask — they enforce.',
    '#OpenSource',
  ].join('\n');

  assert.equal(
    normalizeTikTokCaption(input),
    'Every AI memory tool asks the agent to cooperate. Pre-Action Gates do not ask - they enforce. #OpenSource'
  );
});

test('launchd plist targets publish-queue on a fixed interval', () => {
  const plist = buildLaunchAgentPlist({
    label: 'io.github.IgorGanapolsky.test-social',
    repoRoot,
    queuePath: path.join(repoRoot, '.rlhf', 'social-post-queue.json'),
    intervalMinutes: 30,
    nodeBin: '/usr/local/bin/node',
    scriptPath: path.join(repoRoot, 'scripts', 'social-pipeline.js'),
  });

  assert.match(plist, /io\.github\.IgorGanapolsky\.test-social/);
  assert.match(plist, /publish-queue/);
  assert.match(plist, /social-post-queue\.json/);
  assert.match(plist, /<integer>1800<\/integer>/);
});
