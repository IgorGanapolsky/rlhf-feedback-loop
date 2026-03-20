'use strict';

const cp = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { pathToFileURL } = require('url');

const REPO_ROOT = path.resolve(__dirname, '..');
const DEFAULT_ASSET_HTML = path.join(
  REPO_ROOT,
  'docs',
  'marketing',
  'assets',
  'pre-action-gates-instagram-carousel.html'
);
const DEFAULT_CAPTION_PATH = path.join(
  REPO_ROOT,
  'docs',
  'marketing',
  'assets',
  'pre-action-gates-caption.txt'
);
const DEFAULT_OUTPUT_ROOT = path.join(REPO_ROOT, '.artifacts', 'social');
const DEFAULT_QUEUE_PATH = path.join(REPO_ROOT, '.rlhf', 'social-post-queue.json');
const DEFAULT_LAUNCHD_LABEL = 'io.github.IgorGanapolsky.mcp-memory-gateway.social';
const DEFAULT_SCHEDULE_INTERVAL_MINUTES = 15;
const INSTAGRAM_URL = 'https://www.instagram.com/';
const TIKTOK_UPLOAD_URL = 'https://www.tiktok.com/tiktokstudio/upload?lang=en';
const TIKTOK_CONTENT_URL = 'https://www.tiktok.com/tiktokstudio/content';
const INSTAGRAM_ACCEPT_PREFIX = 'image/';

function parseArgs(argv) {
  const args = { _: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) {
      args._.push(token);
      continue;
    }

    const eqIndex = token.indexOf('=');
    if (eqIndex !== -1) {
      args[token.slice(2, eqIndex)] = token.slice(eqIndex + 1);
      continue;
    }

    const key = token.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith('--')) {
      args[key] = true;
      continue;
    }

    args[key] = next;
    index += 1;
  }
  return args;
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function readText(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function writeText(filePath, content) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, content);
}

function readJson(filePath, fallback) {
  if (!fs.existsSync(filePath)) {
    return fallback;
  }
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, value) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function slugify(input) {
  return String(input || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'social-post';
}

function resolvePath(input, fallback) {
  const target = input || fallback;
  if (!target) {
    return null;
  }
  return path.isAbsolute(target) ? target : path.resolve(REPO_ROOT, target);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function mimeTypeForPath(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.png') return 'image/png';
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.webp') return 'image/webp';
  if (ext === '.mp4') return 'video/mp4';
  if (ext === '.mov') return 'video/quicktime';
  return 'application/octet-stream';
}

function extractHeadContent(html) {
  const match = html.match(/<head[^>]*>([\s\S]*?)<\/head>/i);
  if (!match) {
    throw new Error('Unable to locate <head> content in carousel HTML.');
  }
  return match[1];
}

function extractSlideBlocks(html) {
  const blocks = [];
  let searchIndex = 0;

  while (searchIndex < html.length) {
    const start = html.indexOf('<div class="slide', searchIndex);
    if (start === -1) {
      break;
    }

    let cursor = start;
    let depth = 0;
    let end = -1;

    while (cursor < html.length) {
      const nextOpen = html.indexOf('<div', cursor);
      const nextClose = html.indexOf('</div', cursor);

      if (nextClose === -1) {
        throw new Error('Unable to parse slide HTML. Found unbalanced <div> tags.');
      }

      if (nextOpen !== -1 && nextOpen < nextClose) {
        depth += 1;
        cursor = html.indexOf('>', nextOpen);
        if (cursor === -1) {
          throw new Error('Unable to parse opening <div> tag while extracting slide blocks.');
        }
        cursor += 1;
        continue;
      }

      depth -= 1;
      cursor = html.indexOf('>', nextClose);
      if (cursor === -1) {
        throw new Error('Unable to parse closing </div> tag while extracting slide blocks.');
      }
      cursor += 1;
      if (depth === 0) {
        end = cursor;
        break;
      }
    }

    if (end === -1) {
      throw new Error('Unable to resolve the end of a slide block.');
    }

    blocks.push(html.slice(start, end));
    searchIndex = end;
  }

  return blocks;
}

function buildIsolatedSlideDocument(headContent, slideHtml) {
  const exportStyles = [
    '<style>',
    'html, body { width: 1080px; height: 1080px; margin: 0; padding: 0; overflow: hidden; background: #111; }',
    'body { display: block; }',
    '.slide-label { display: none !important; }',
    '.slide { margin: 0 !important; }',
    '</style>',
  ].join('');

  return [
    '<!DOCTYPE html>',
    '<html lang="en">',
    '<head>',
    headContent,
    exportStyles,
    '</head>',
    '<body>',
    slideHtml,
    '</body>',
    '</html>',
  ].join('');
}

function writeIsolatedSlideDocuments({ sourceHtmlPath, outputDir }) {
  const html = readText(sourceHtmlPath);
  const headContent = extractHeadContent(html);
  const slides = extractSlideBlocks(html);

  if (slides.length === 0) {
    throw new Error('No .slide blocks found in carousel HTML.');
  }

  ensureDir(outputDir);
  const slideDocuments = slides.map((slideHtml, index) => {
    const slidePath = path.join(outputDir, `slide-${String(index + 1).padStart(2, '0')}.html`);
    writeText(slidePath, buildIsolatedSlideDocument(headContent, slideHtml));
    return slidePath;
  });

  return slideDocuments;
}

function findExecutable(candidates) {
  for (const candidate of candidates) {
    if (!candidate) {
      continue;
    }

    if (candidate.includes(path.sep) && fs.existsSync(candidate)) {
      return candidate;
    }

    const result = cp.spawnSync('which', [candidate], { encoding: 'utf8' });
    if (result.status === 0) {
      const resolved = result.stdout.trim();
      if (resolved) {
        return resolved;
      }
    }
  }
  return null;
}

function resolveChromeBinary() {
  const chrome = findExecutable([
    process.env.CHROME_BIN,
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    'Google Chrome',
    'google-chrome',
    'chromium',
    'chromium-browser',
  ]);
  if (!chrome) {
    throw new Error('Google Chrome binary not found. Set CHROME_BIN or install Google Chrome.');
  }
  return chrome;
}

function resolveFfmpegBinary() {
  const ffmpeg = findExecutable([process.env.FFMPEG_BIN, 'ffmpeg']);
  if (!ffmpeg) {
    throw new Error('ffmpeg binary not found. Set FFMPEG_BIN or install ffmpeg.');
  }
  return ffmpeg;
}

function renderSlides({ slideDocuments, outputDir, chromeBin, dryRun = false }) {
  ensureDir(outputDir);
  const slidePaths = slideDocuments.map((_, index) => (
    path.join(outputDir, `slide-${String(index + 1).padStart(2, '0')}.png`)
  ));

  if (dryRun) {
    return slidePaths;
  }

  for (let index = 0; index < slideDocuments.length; index += 1) {
    cp.execFileSync(chromeBin, [
      '--headless=new',
      '--disable-gpu',
      '--hide-scrollbars',
      '--allow-file-access-from-files',
      '--window-size=1080,1080',
      '--virtual-time-budget=5000',
      `--screenshot=${slidePaths[index]}`,
      pathToFileURL(slideDocuments[index]).href,
    ], { stdio: 'ignore' });
  }

  return slidePaths;
}

function buildFfmpegConcatManifest(slidePaths, durationSeconds) {
  const lines = [];
  for (const slidePath of slidePaths) {
    lines.push(`file '${slidePath.replace(/'/g, "'\\''")}'`);
    lines.push(`duration ${durationSeconds}`);
  }
  lines.push(`file '${slidePaths[slidePaths.length - 1].replace(/'/g, "'\\''")}'`);
  return `${lines.join('\n')}\n`;
}

function normalizeTikTokCaption(caption) {
  return String(caption || '')
    .replace(/[“”]/g, '"')
    .replace(/[’]/g, '\'')
    .replace(/[—–]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}

function renderTikTokVideo({
  slidePaths,
  outputPath,
  slideDurationSeconds = 2.4,
  ffmpegBin,
  dryRun = false,
}) {
  if (!slidePaths || slidePaths.length === 0) {
    throw new Error('TikTok fallback video requires at least one slide image.');
  }

  ensureDir(path.dirname(outputPath));
  if (dryRun) {
    return outputPath;
  }

  const concatPath = path.join(path.dirname(outputPath), 'tiktok-slides.txt');
  writeText(concatPath, buildFfmpegConcatManifest(slidePaths, slideDurationSeconds));

  cp.execFileSync(ffmpegBin, [
    '-y',
    '-f', 'concat',
    '-safe', '0',
    '-i', concatPath,
    '-f', 'lavfi',
    '-t', String(slidePaths.length * slideDurationSeconds + 0.5),
    '-i', 'anullsrc=channel_layout=stereo:sample_rate=48000',
    '-vf', 'fps=30,scale=1080:1080:flags=lanczos,pad=1080:1920:0:420:color=0x241f4f,format=yuv420p',
    '-c:v', 'libx264',
    '-preset', 'medium',
    '-profile:v', 'high',
    '-level', '4.1',
    '-pix_fmt', 'yuv420p',
    '-c:a', 'aac',
    '-b:a', '128k',
    '-shortest',
    '-movflags', '+faststart',
    outputPath,
  ], { stdio: 'ignore' });

  return outputPath;
}

function buildBundleManifest({
  id,
  sourceHtmlPath,
  captionPath,
  outputDir,
  slideDocumentPaths,
  slideImagePaths,
  tiktokVideoPath,
  instagramCaptionPath,
  tiktokCaptionPath,
  createdAt,
}) {
  return {
    id,
    createdAt,
    sourceHtmlPath,
    captionPath,
    outputDir,
    slideDocumentPaths,
    slideImagePaths,
    instagramCaptionPath,
    tiktokCaptionPath,
    tiktokVideoPath,
    platforms: {
      instagram: {
        type: 'carousel',
        assetPaths: slideImagePaths,
      },
      tiktok: {
        type: 'video',
        assetPath: tiktokVideoPath,
      },
    },
  };
}

function prepareBundle({
  sourceHtmlPath,
  captionPath,
  outputDir,
  slug,
  slideDurationSeconds = 2.4,
  chromeBin,
  ffmpegBin,
  dryRun = false,
  renderSlidesFn = renderSlides,
  renderTikTokVideoFn = renderTikTokVideo,
}) {
  const bundleId = slugify(slug || path.basename(sourceHtmlPath, path.extname(sourceHtmlPath)));
  const bundleRoot = outputDir || path.join(DEFAULT_OUTPUT_ROOT, bundleId);
  const sourceDir = path.join(bundleRoot, 'source');
  const slidesDir = path.join(bundleRoot, 'slides');
  const captionsDir = path.join(bundleRoot, 'captions');
  const videoDir = path.join(bundleRoot, 'video');

  ensureDir(bundleRoot);
  ensureDir(sourceDir);
  ensureDir(slidesDir);
  ensureDir(captionsDir);
  ensureDir(videoDir);

  const resolvedChromeBin = chromeBin || (dryRun ? 'dry-run-chrome' : resolveChromeBinary());
  const resolvedFfmpegBin = ffmpegBin || (dryRun ? 'dry-run-ffmpeg' : resolveFfmpegBinary());

  const slideDocumentPaths = writeIsolatedSlideDocuments({
    sourceHtmlPath,
    outputDir: sourceDir,
  });
  const slideImagePaths = renderSlidesFn({
    slideDocuments: slideDocumentPaths,
    outputDir: slidesDir,
    chromeBin: resolvedChromeBin,
    dryRun,
  });

  const caption = readText(captionPath).trim();
  const instagramCaptionPath = path.join(captionsDir, 'instagram.txt');
  const tiktokCaptionPath = path.join(captionsDir, 'tiktok.txt');
  writeText(instagramCaptionPath, `${caption}\n`);
  writeText(tiktokCaptionPath, `${normalizeTikTokCaption(caption)}\n`);

  const tiktokVideoPath = renderTikTokVideoFn({
    slidePaths: slideImagePaths,
    outputPath: path.join(videoDir, 'tiktok-fallback.mp4'),
    slideDurationSeconds,
    ffmpegBin: resolvedFfmpegBin,
    dryRun,
  });

  const manifest = buildBundleManifest({
    id: bundleId,
    createdAt: new Date().toISOString(),
    sourceHtmlPath,
    captionPath,
    outputDir: bundleRoot,
    slideDocumentPaths,
    slideImagePaths,
    tiktokVideoPath,
    instagramCaptionPath,
    tiktokCaptionPath,
  });

  const manifestPath = path.join(bundleRoot, 'bundle.json');
  writeJson(manifestPath, manifest);
  return { manifest, manifestPath };
}

function loadQueueState(queuePath = DEFAULT_QUEUE_PATH) {
  return readJson(queuePath, { entries: [] });
}

function saveQueueState(queuePath, queueState) {
  writeJson(queuePath, queueState);
}

function normalizePlatformList(platforms = []) {
  return [...new Set((platforms || []).map((platform) => String(platform).trim()).filter(Boolean))].sort();
}

function enqueueBundle({
  queuePath = DEFAULT_QUEUE_PATH,
  bundlePath,
  scheduledAt,
  platforms = ['instagram', 'tiktok'],
}) {
  const bundle = readJson(bundlePath, null);
  if (!bundle) {
    throw new Error(`Bundle manifest not found at ${bundlePath}`);
  }

  const queueState = loadQueueState(queuePath);
  const normalizedScheduledAt = new Date(scheduledAt).toISOString();
  const normalizedPlatforms = normalizePlatformList(platforms);
  const existingEntry = (queueState.entries || []).find((entry) => (
    entry.status === 'pending' &&
    entry.bundlePath === bundlePath &&
    entry.scheduledAt === normalizedScheduledAt &&
    JSON.stringify(normalizePlatformList(entry.platforms)) === JSON.stringify(normalizedPlatforms)
  ));

  if (existingEntry) {
    return existingEntry;
  }

  const entry = {
    id: `social_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    bundlePath,
    bundleId: bundle.id,
    scheduledAt: normalizedScheduledAt,
    platforms: normalizedPlatforms,
    status: 'pending',
    attempts: [],
    createdAt: new Date().toISOString(),
  };

  queueState.entries.push(entry);
  saveQueueState(queuePath, queueState);
  return entry;
}

function getDueEntries(queueState, now = new Date()) {
  return (queueState.entries || []).filter((entry) => (
    entry.status === 'pending' && new Date(entry.scheduledAt).getTime() <= now.getTime()
  ));
}

function escapeAppleScriptString(value) {
  return `"${String(value)
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')}"`;
}

function runAppleScript(script) {
  if (process.platform !== 'darwin') {
    throw new Error('Chrome social automation requires macOS and AppleScript.');
  }

  return cp.execFileSync('osascript', ['-'], {
    encoding: 'utf8',
    input: script,
  }).trim();
}

function buildChromeJavaScriptAppleScript({ urlPrefix, openUrl, tempJsPath }) {
  return [
    'tell application "Google Chrome"',
    '  activate',
    `  set targetPrefix to ${escapeAppleScriptString(urlPrefix)}`,
    `  set openTarget to ${escapeAppleScriptString(openUrl || urlPrefix)}`,
    '  set targetWindow to missing value',
    '  set targetTabIndex to 0',
    '  set targetTab to missing value',
    '  repeat with w in windows',
    '    set currentTabIndex to 1',
    '    repeat with t in tabs of w',
    '      if (URL of t starts with targetPrefix) then',
    '        set targetWindow to w',
    '        set targetTabIndex to currentTabIndex',
    '        exit repeat',
    '      end if',
    '      set currentTabIndex to currentTabIndex + 1',
    '    end repeat',
    '    if targetWindow is not missing value then exit repeat',
    '  end repeat',
    '  if targetWindow is not missing value then',
    '    if (index of targetWindow) is not 1 then set index of targetWindow to 1',
    '    if (active tab index of targetWindow) is not targetTabIndex then set active tab index of targetWindow to targetTabIndex',
    '    set targetTab to active tab of targetWindow',
    '  end if',
    '  if targetTab is missing value then',
    '    if (count of windows) = 0 then make new window',
    '    tell window 1',
    '      set targetTab to make new tab with properties {URL:openTarget}',
    '      set active tab index to index of targetTab',
    '    end tell',
    '    delay 1',
    '  end if',
    `  set jsCode to read POSIX file ${escapeAppleScriptString(tempJsPath)}`,
    '  return execute targetTab javascript jsCode',
    'end tell',
  ].join('\n');
}

function executeChromeJavaScript({ urlPrefix, openUrl, js }) {
  const tempJsPath = path.join(
    os.tmpdir(),
    `social-pipeline-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.js`
  );
  writeText(tempJsPath, js);

  const appleScript = buildChromeJavaScriptAppleScript({
    urlPrefix,
    openUrl,
    tempJsPath,
  });

  try {
    return runAppleScript(appleScript);
  } finally {
    fs.rmSync(tempJsPath, { force: true });
  }
}

async function pollChromeState({ urlPrefix, openUrl, js, timeoutMs = 20000, intervalMs = 1000, isReady }) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const raw = executeChromeJavaScript({ urlPrefix, openUrl, js });
    let parsed = raw;
    try {
      parsed = JSON.parse(raw);
    } catch {
      // Keep raw string if it is not JSON.
    }
    if (isReady(parsed)) {
      return parsed;
    }
    await sleep(intervalMs);
  }
  throw new Error(`Timed out waiting for Chrome state on ${urlPrefix}`);
}

function buildBrowserUploadScript(filePaths) {
  const files = filePaths.map((filePath) => ({
    name: path.basename(filePath),
    type: mimeTypeForPath(filePath),
    b64: fs.readFileSync(filePath).toString('base64'),
  }));

  return `
    (async () => {
      const input = document.querySelector('input[type=file]');
      if (!input) {
        return JSON.stringify({ ok: false, reason: 'no-file-input' });
      }
      const files = ${JSON.stringify(files)};
      const dt = new DataTransfer();
      for (const entry of files) {
        const binary = atob(entry.b64);
        const bytes = new Uint8Array(binary.length);
        for (let index = 0; index < binary.length; index += 1) {
          bytes[index] = binary.charCodeAt(index);
        }
        dt.items.add(new File([bytes], entry.name, { type: entry.type, lastModified: Date.now() }));
      }
      input.files = dt.files;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      await new Promise((resolve) => setTimeout(resolve, 1500));
      return JSON.stringify({
        ok: true,
        filesLength: input.files ? input.files.length : 0,
        body: document.body ? document.body.innerText.slice(0, 2400) : ''
      });
    })()
  `;
}

const INSTAGRAM_COMPOSER_JS = `
  (() => {
    const text = (element) => (element.innerText || element.getAttribute('aria-label') || '').trim();
    if (document.querySelector('input[type=file][multiple]')) {
      return JSON.stringify({ state: 'ready' });
    }
    const post = [...document.querySelectorAll('button,[role=button],a')].find((element) => /^post$/i.test(text(element)));
    if (post) {
      post.click();
      return JSON.stringify({ state: 'clicked-post' });
    }
    const create = [...document.querySelectorAll('button,[role=button],a')].find((element) => /^create$/i.test(text(element)));
    if (create) {
      create.click();
      return JSON.stringify({ state: 'clicked-create' });
    }
    return JSON.stringify({ state: 'waiting', title: document.title });
  })()
`;

const INSTAGRAM_EDITOR_JS = `
  (() => {
    const text = (element) => (element.innerText || element.getAttribute('aria-label') || '').trim();
    const editor = document.querySelector('textarea,[contenteditable=true]');
    const share = [...document.querySelectorAll('button,[role=button],a')].find((element) => /^share$/i.test(text(element)));
    return JSON.stringify({
      hasEditor: Boolean(editor),
      shareVisible: Boolean(share),
      body: document.body ? document.body.innerText.slice(0, 2400) : ''
    });
  })()
`;

function buildInstagramCaptionScript(caption) {
  return `
    (() => {
      const caption = ${JSON.stringify(caption)};
      const textarea = document.querySelector('textarea');
      if (textarea) {
        textarea.focus();
        textarea.value = caption;
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
        return JSON.stringify({ ok: true, mode: 'textarea' });
      }
      const editor = document.querySelector('[contenteditable=true]');
      if (!editor) {
        return JSON.stringify({ ok: false, reason: 'no-caption-editor' });
      }
      editor.focus();
      document.execCommand('selectAll', false);
      document.execCommand('insertText', false, caption);
      editor.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: caption }));
      return JSON.stringify({ ok: true, mode: 'contenteditable', text: editor.innerText.slice(0, 400) });
    })()
  `;
}

const INSTAGRAM_NEXT_JS = `
  (() => {
    const text = (element) => (element.innerText || element.getAttribute('aria-label') || '').trim();
    const next = [...document.querySelectorAll('button,[role=button],a')].find((element) => /^next$/i.test(text(element)));
    if (!next) {
      return JSON.stringify({ clicked: false });
    }
    next.click();
    return JSON.stringify({ clicked: true });
  })()
`;

const INSTAGRAM_SHARE_JS = `
  (() => {
    const text = (element) => (element.innerText || element.getAttribute('aria-label') || '').trim();
    const share = [...document.querySelectorAll('button,[role=button],a')].find((element) => /^share$/i.test(text(element)));
    if (!share) {
      return JSON.stringify({ clicked: false });
    }
    share.click();
    return JSON.stringify({ clicked: true });
  })()
`;

const INSTAGRAM_CLOSE_JS = `
  (() => {
    const text = (element) => (element.innerText || element.getAttribute('aria-label') || '').trim();
    const close = [...document.querySelectorAll('button,[role=button],svg')].find((element) => /close/i.test(text(element)));
    if (close && close.closest('button')) {
      close.closest('button').click();
      return JSON.stringify({ closed: true });
    }
    const discard = [...document.querySelectorAll('button,[role=button],a')].find((element) => /^discard$/i.test(text(element)));
    if (discard) {
      discard.click();
      return JSON.stringify({ discarded: true });
    }
    return JSON.stringify({ closed: false });
  })()
`;

const TIKTOK_READY_JS = `
  (() => {
    const text = (element) => (element.innerText || element.getAttribute('aria-label') || '').trim();
    const buttons = [...document.querySelectorAll('button,[role=button],a')];
    const gotIt = buttons.find((element) => /^got it$/i.test(text(element)));
    if (gotIt) {
      gotIt.click();
    }
    const retry = buttons.find((element) => /^retry$/i.test(text(element)));
    if (retry) {
      retry.click();
      return JSON.stringify({ state: 'clicked-retry' });
    }
    const continueButton = buttons.find((element) => /^continue$/i.test(text(element)));
    if (continueButton) {
      continueButton.click();
      return JSON.stringify({ state: 'clicked-continue' });
    }
    if (document.querySelector('[contenteditable=true]')) {
      return JSON.stringify({ state: 'editor-ready' });
    }
    const input = [...document.querySelectorAll('input[type=file]')].find((element) => /video\\//i.test(element.accept || ''));
    if (input) {
      return JSON.stringify({ state: 'upload-ready' });
    }
    return JSON.stringify({ state: 'waiting', body: document.body ? document.body.innerText.slice(0, 1600) : '' });
  })()
`;

const TIKTOK_FOCUS_EDITOR_JS = `
  (() => {
    const editor = document.querySelector('[contenteditable=true]');
    if (!editor) {
      return JSON.stringify({ ok: false, reason: 'no-editor' });
    }
    editor.focus();
    return JSON.stringify({ ok: true, text: editor.innerText.slice(0, 400) });
  })()
`;

const TIKTOK_SET_FOLLOWERS_JS = `
  (() => {
    const text = (element) => (element.innerText || element.getAttribute('aria-label') || '').trim();
    const buttons = [...document.querySelectorAll('button,[role=button],a,[role=combobox],div')];
    const openControl = buttons.find((element) => /^(followers|friends|only you|only me)$/i.test(text(element)));
    if (!openControl) {
      return JSON.stringify({ state: 'missing-privacy-control' });
    }
    if (/^followers$/i.test(text(openControl))) {
      return JSON.stringify({ state: 'already-followers' });
    }
    openControl.click();
    const option = [...document.querySelectorAll('button,[role=button],a,div,span')].find((element) => /^followers$/i.test(text(element)));
    if (option) {
      option.click();
      return JSON.stringify({ state: 'selected-followers' });
    }
    return JSON.stringify({ state: 'privacy-menu-opened' });
  })()
`;

const TIKTOK_POST_JS = `
  (() => {
    const text = (element) => (element.innerText || element.getAttribute('aria-label') || '').trim();
    const post = [...document.querySelectorAll('button,[role=button],a')].find((element) => /^post$/i.test(text(element)));
    if (!post) {
      return JSON.stringify({ clicked: false });
    }
    post.click();
    return JSON.stringify({ clicked: true });
  })()
`;

const TIKTOK_DISCARD_JS = `
  (() => {
    const text = (element) => (element.innerText || element.getAttribute('aria-label') || '').trim();
    const discard = [...document.querySelectorAll('button,[role=button],a')].find((element) => /^discard$/i.test(text(element)));
    if (!discard) {
      return JSON.stringify({ discarded: false });
    }
    discard.click();
    return JSON.stringify({ discarded: true });
  })()
`;

function pasteIntoActiveChrome(text) {
  const script = [
    `set the clipboard to ${escapeAppleScriptString(text)}`,
    'delay 0.2',
    'tell application "System Events"',
    '  keystroke "a" using command down',
    '  delay 0.2',
    '  keystroke "v" using command down',
    'end tell',
  ].join('\n');
  runAppleScript(script);
}

async function prepareInstagramDraft(bundle, { dryRun = false }) {
  const instagramAssets = bundle.platforms.instagram.assetPaths;
  if (!instagramAssets || instagramAssets.length === 0) {
    throw new Error('Instagram publish requires slide image assets.');
  }

  if (dryRun) {
    return {
      platform: 'instagram',
      mode: 'dry-run',
      assetCount: instagramAssets.length,
    };
  }

  await pollChromeState({
    urlPrefix: INSTAGRAM_URL,
    openUrl: INSTAGRAM_URL,
    js: INSTAGRAM_COMPOSER_JS,
    isReady: (state) => state && state.state === 'ready',
  });

  const uploadState = JSON.parse(executeChromeJavaScript({
    urlPrefix: INSTAGRAM_URL,
    openUrl: INSTAGRAM_URL,
    js: buildBrowserUploadScript(instagramAssets),
  }));

  if (!uploadState.ok || uploadState.filesLength !== instagramAssets.length) {
    throw new Error(`Instagram upload failed: ${JSON.stringify(uploadState)}`);
  }

  for (let index = 0; index < 3; index += 1) {
    executeChromeJavaScript({
      urlPrefix: INSTAGRAM_URL,
      openUrl: INSTAGRAM_URL,
      js: INSTAGRAM_NEXT_JS,
    });
    await sleep(1000);
    const editorState = JSON.parse(executeChromeJavaScript({
      urlPrefix: INSTAGRAM_URL,
      openUrl: INSTAGRAM_URL,
      js: INSTAGRAM_EDITOR_JS,
    }));
    if (editorState.hasEditor || editorState.shareVisible) {
      break;
    }
  }

  const caption = readText(bundle.instagramCaptionPath).trim();
  const captionState = JSON.parse(executeChromeJavaScript({
    urlPrefix: INSTAGRAM_URL,
    openUrl: INSTAGRAM_URL,
    js: buildInstagramCaptionScript(caption),
  }));

  if (!captionState.ok) {
    throw new Error(`Instagram caption write failed: ${JSON.stringify(captionState)}`);
  }

  return {
    platform: 'instagram',
    mode: 'draft-ready',
    assetCount: instagramAssets.length,
  };
}

async function publishInstagram(bundle, { dryRun = false, noShare = false }) {
  const draftState = await prepareInstagramDraft(bundle, { dryRun });
  if (dryRun || noShare) {
    return draftState;
  }

  const shareState = JSON.parse(executeChromeJavaScript({
    urlPrefix: INSTAGRAM_URL,
    openUrl: INSTAGRAM_URL,
    js: INSTAGRAM_SHARE_JS,
  }));

  if (!shareState.clicked) {
    throw new Error('Instagram share button was not available.');
  }

  await sleep(4000);
  return {
    platform: 'instagram',
    mode: 'published',
  };
}

async function cleanupInstagramDraft() {
  executeChromeJavaScript({
    urlPrefix: INSTAGRAM_URL,
    openUrl: INSTAGRAM_URL,
    js: INSTAGRAM_CLOSE_JS,
  });
  await sleep(500);
  executeChromeJavaScript({
    urlPrefix: INSTAGRAM_URL,
    openUrl: INSTAGRAM_URL,
    js: INSTAGRAM_CLOSE_JS,
  });
}

async function prepareTikTokDraft(bundle, { dryRun = false }) {
  const tiktokAsset = bundle.platforms.tiktok.assetPath;
  if (!tiktokAsset) {
    throw new Error('TikTok publish requires a fallback MP4 asset.');
  }

  if (dryRun) {
    return {
      platform: 'tiktok',
      mode: 'dry-run',
      assetPath: tiktokAsset,
    };
  }

  await pollChromeState({
    urlPrefix: 'https://www.tiktok.com/tiktokstudio/',
    openUrl: TIKTOK_UPLOAD_URL,
    js: TIKTOK_READY_JS,
    isReady: (state) => state && (state.state === 'upload-ready' || state.state === 'editor-ready'),
  });

  const readyState = JSON.parse(executeChromeJavaScript({
    urlPrefix: 'https://www.tiktok.com/tiktokstudio/',
    openUrl: TIKTOK_UPLOAD_URL,
    js: TIKTOK_READY_JS,
  }));

  if (readyState.state !== 'editor-ready') {
    const uploadState = JSON.parse(executeChromeJavaScript({
      urlPrefix: 'https://www.tiktok.com/tiktokstudio/',
      openUrl: TIKTOK_UPLOAD_URL,
      js: buildBrowserUploadScript([tiktokAsset]),
    }));
    if (!uploadState.ok || uploadState.filesLength !== 1) {
      throw new Error(`TikTok upload failed: ${JSON.stringify(uploadState)}`);
    }
  }

  await pollChromeState({
    urlPrefix: 'https://www.tiktok.com/tiktokstudio/',
    openUrl: TIKTOK_UPLOAD_URL,
    js: TIKTOK_READY_JS,
    isReady: (state) => state && state.state === 'editor-ready',
  });

  executeChromeJavaScript({
    urlPrefix: 'https://www.tiktok.com/tiktokstudio/',
    openUrl: TIKTOK_UPLOAD_URL,
    js: TIKTOK_FOCUS_EDITOR_JS,
  });
  pasteIntoActiveChrome(readText(bundle.tiktokCaptionPath).trim());

  executeChromeJavaScript({
    urlPrefix: 'https://www.tiktok.com/tiktokstudio/',
    openUrl: TIKTOK_UPLOAD_URL,
    js: TIKTOK_SET_FOLLOWERS_JS,
  });

  return {
    platform: 'tiktok',
    mode: 'draft-ready',
    assetPath: tiktokAsset,
  };
}

async function publishTikTok(bundle, { dryRun = false, noShare = false }) {
  const draftState = await prepareTikTokDraft(bundle, { dryRun });
  if (dryRun || noShare) {
    return draftState;
  }

  const postState = JSON.parse(executeChromeJavaScript({
    urlPrefix: 'https://www.tiktok.com/tiktokstudio/',
    openUrl: TIKTOK_UPLOAD_URL,
    js: TIKTOK_POST_JS,
  }));

  if (!postState.clicked) {
    throw new Error('TikTok post button was not available.');
  }

  await pollChromeState({
    urlPrefix: TIKTOK_CONTENT_URL,
    openUrl: TIKTOK_CONTENT_URL,
    js: `
      (() => JSON.stringify({
        url: location.href,
        body: document.body ? document.body.innerText.slice(0, 2600) : ''
      }))()
    `,
    timeoutMs: 30000,
    intervalMs: 2000,
    isReady: (state) => state && typeof state.body === 'string' && state.body.includes(bundle.id.split('-').join(' ')) === false
      ? state.body.includes('Followers') && state.body.includes(readText(bundle.tiktokCaptionPath).trim().slice(0, 60))
      : state && typeof state.body === 'string' && state.body.includes(readText(bundle.tiktokCaptionPath).trim().slice(0, 60)),
  });

  return {
    platform: 'tiktok',
    mode: 'published',
  };
}

async function cleanupTikTokDraft() {
  executeChromeJavaScript({
    urlPrefix: 'https://www.tiktok.com/tiktokstudio/',
    openUrl: TIKTOK_UPLOAD_URL,
    js: TIKTOK_DISCARD_JS,
  });
}

async function publishBundle(bundlePath, options = {}) {
  const bundle = readJson(bundlePath, null);
  if (!bundle) {
    throw new Error(`Bundle manifest not found: ${bundlePath}`);
  }

  const platformSet = new Set(
    String(options.platforms || 'instagram,tiktok')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean)
  );

  const results = [];
  if (platformSet.has('instagram')) {
    results.push(await publishInstagram(bundle, options));
  }
  if (platformSet.has('tiktok')) {
    results.push(await publishTikTok(bundle, options));
  }

  if (options.noShare && options.cleanupDrafts && !options.dryRun) {
    if (platformSet.has('instagram')) {
      await cleanupInstagramDraft();
    }
    if (platformSet.has('tiktok')) {
      await cleanupTikTokDraft();
    }
  }

  return results;
}

async function publishDueQueueEntries({
  queuePath = DEFAULT_QUEUE_PATH,
  dryRun = false,
  noShare = false,
  cleanupDrafts = false,
  now = new Date(),
}) {
  const queueState = loadQueueState(queuePath);
  const dueEntries = getDueEntries(queueState, now);
  const results = [];

  for (const entry of dueEntries) {
    try {
      const publishResults = await publishBundle(entry.bundlePath, {
        platforms: entry.platforms.join(','),
        dryRun,
        noShare,
        cleanupDrafts,
      });
      entry.status = dryRun || noShare ? 'prepared' : 'published';
      entry.publishedAt = new Date().toISOString();
      entry.attempts.push({
        at: entry.publishedAt,
        ok: true,
        results: publishResults,
      });
      results.push({ entry, publishResults });
    } catch (error) {
      entry.status = 'failed';
      entry.attempts.push({
        at: new Date().toISOString(),
        ok: false,
        error: error.message,
      });
      results.push({ entry, error: error.message });
    }
  }

  saveQueueState(queuePath, queueState);
  return results;
}

function buildLaunchAgentPlist({
  label = DEFAULT_LAUNCHD_LABEL,
  repoRoot = REPO_ROOT,
  queuePath = DEFAULT_QUEUE_PATH,
  intervalMinutes = DEFAULT_SCHEDULE_INTERVAL_MINUTES,
  nodeBin = process.execPath,
  scriptPath = path.join(REPO_ROOT, 'scripts', 'social-pipeline.js'),
}) {
  const intervalSeconds = Number(intervalMinutes) * 60;
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
  <dict>
    <key>Label</key>
    <string>${label}</string>
    <key>ProgramArguments</key>
    <array>
      <string>${nodeBin}</string>
      <string>${scriptPath}</string>
      <string>publish-queue</string>
      <string>--queue</string>
      <string>${queuePath}</string>
    </array>
    <key>WorkingDirectory</key>
    <string>${repoRoot}</string>
    <key>StartInterval</key>
    <integer>${intervalSeconds}</integer>
    <key>RunAtLoad</key>
    <true/>
    <key>StandardOutPath</key>
    <string>${path.join(repoRoot, '.artifacts', 'social', 'launchd.stdout.log')}</string>
    <key>StandardErrorPath</key>
    <string>${path.join(repoRoot, '.artifacts', 'social', 'launchd.stderr.log')}</string>
  </dict>
</plist>
`;
}

function installLaunchAgent({
  label = DEFAULT_LAUNCHD_LABEL,
  intervalMinutes = DEFAULT_SCHEDULE_INTERVAL_MINUTES,
  queuePath = DEFAULT_QUEUE_PATH,
  dryRun = false,
}) {
  const plistPath = path.join(os.homedir(), 'Library', 'LaunchAgents', `${label}.plist`);
  const plist = buildLaunchAgentPlist({
    label,
    intervalMinutes,
    queuePath,
  });

  if (dryRun) {
    return { plistPath, plist };
  }

  writeText(plistPath, plist);
  try {
    cp.execFileSync('launchctl', ['unload', plistPath], { stdio: 'ignore' });
  } catch {
    // Ignore if not loaded yet.
  }
  cp.execFileSync('launchctl', ['load', '-w', plistPath], { stdio: 'ignore' });
  return { plistPath, plist };
}

async function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  const command = args._[0] || 'status';

  if (command === 'prepare') {
    const sourceHtmlPath = resolvePath(args.source, DEFAULT_ASSET_HTML);
    const captionPath = resolvePath(args.caption, DEFAULT_CAPTION_PATH);
    const outputDir = resolvePath(args.output, path.join(DEFAULT_OUTPUT_ROOT, slugify(args.slug || 'pre-action-gates')));
    const { manifestPath, manifest } = prepareBundle({
      sourceHtmlPath,
      captionPath,
      outputDir,
      slug: args.slug || 'pre-action-gates',
      slideDurationSeconds: Number(args['slide-seconds'] || 2.4),
      dryRun: Boolean(args['dry-run']),
    });
    console.log(JSON.stringify({ manifestPath, manifest }, null, 2));
    return;
  }

  if (command === 'queue') {
    const entry = enqueueBundle({
      queuePath: resolvePath(args.queue, DEFAULT_QUEUE_PATH),
      bundlePath: resolvePath(args.bundle),
      scheduledAt: args.when || args.at,
      platforms: String(args.platforms || 'instagram,tiktok').split(',').map((value) => value.trim()).filter(Boolean),
    });
    console.log(JSON.stringify(entry, null, 2));
    return;
  }

  if (command === 'publish') {
    const results = await publishBundle(resolvePath(args.bundle), {
      platforms: args.platforms || 'instagram,tiktok',
      dryRun: Boolean(args['dry-run']),
      noShare: Boolean(args['no-share']),
      cleanupDrafts: Boolean(args['cleanup-drafts']),
    });
    console.log(JSON.stringify(results, null, 2));
    return;
  }

  if (command === 'publish-queue') {
    const results = await publishDueQueueEntries({
      queuePath: resolvePath(args.queue, DEFAULT_QUEUE_PATH),
      dryRun: Boolean(args['dry-run']),
      noShare: Boolean(args['no-share']),
      cleanupDrafts: Boolean(args['cleanup-drafts']),
      now: args.now ? new Date(args.now) : new Date(),
    });
    console.log(JSON.stringify(results, null, 2));
    return;
  }

  if (command === 'install-scheduler') {
    const result = installLaunchAgent({
      label: args.label || DEFAULT_LAUNCHD_LABEL,
      intervalMinutes: Number(args['interval-minutes'] || DEFAULT_SCHEDULE_INTERVAL_MINUTES),
      queuePath: resolvePath(args.queue, DEFAULT_QUEUE_PATH),
      dryRun: Boolean(args['dry-run']),
    });
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (command === 'status') {
    const queuePath = resolvePath(args.queue, DEFAULT_QUEUE_PATH);
    const queueState = loadQueueState(queuePath);
    console.log(JSON.stringify({
      queuePath,
      entries: queueState.entries || [],
    }, null, 2));
    return;
  }

  throw new Error(`Unknown command "${command}"`);
}

module.exports = {
  DEFAULT_ASSET_HTML,
  DEFAULT_CAPTION_PATH,
  DEFAULT_QUEUE_PATH,
  DEFAULT_LAUNCHD_LABEL,
  buildBundleManifest,
  buildChromeJavaScriptAppleScript,
  buildFfmpegConcatManifest,
  buildIsolatedSlideDocument,
  buildLaunchAgentPlist,
  buildBrowserUploadScript,
  enqueueBundle,
  extractHeadContent,
  extractSlideBlocks,
  getDueEntries,
  loadQueueState,
  normalizePlatformList,
  mimeTypeForPath,
  normalizeTikTokCaption,
  prepareBundle,
  renderSlides,
  renderTikTokVideo,
  saveQueueState,
  slugify,
  writeIsolatedSlideDocuments,
};

if (require.main === module) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
