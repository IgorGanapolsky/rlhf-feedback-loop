'use strict';

/**
 * Post to X.com via browser automation (Playwright).
 * Bypasses the X API when it returns 503.
 *
 * Usage:
 *   X_USERNAME=IgorGanapolsky X_PASSWORD=... node scripts/tweet-via-browser.js "tweet text"
 */

const { chromium } = require('playwright');

const USERNAME = process.env.X_USERNAME || 'IgorGanapolsky';
const PASSWORD = process.env.X_PASSWORD;
const TWEET_TEXT = process.argv[2];

async function postTweet(text) {
  if (!text) {
    console.error('Usage: node scripts/tweet-via-browser.js "your tweet"');
    process.exit(1);
  }

  console.log('🐦 Launching browser to post tweet...');
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  });
  const page = await context.newPage();

  try {
    // Navigate to X login
    console.log('  Navigating to X.com login...');
    await page.goto('https://x.com/i/flow/login', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000);

    // Enter username
    console.log('  Entering username...');
    const usernameInput = page.getByLabel('Phone, email, or username');
    await usernameInput.fill(USERNAME);
    await page.getByRole('button', { name: 'Next' }).click();
    await page.waitForTimeout(2000);

    // Enter password
    console.log('  Entering password...');
    const passwordInput = page.getByLabel('Password', { exact: true });
    await passwordInput.fill(PASSWORD);
    await page.getByRole('button', { name: 'Log in' }).click();
    await page.waitForTimeout(3000);

    // Wait for home timeline
    console.log('  Waiting for home timeline...');
    await page.waitForURL('**/home', { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(2000);

    // Click the tweet compose area
    console.log('  Composing tweet...');
    const composeArea = page.getByRole('textbox', { name: /post/i }).first()
      || page.locator('[data-testid="tweetTextarea_0"]').first();
    await composeArea.click();
    await page.waitForTimeout(500);

    // Type the tweet
    await composeArea.fill(text);
    await page.waitForTimeout(1000);

    // Click Post button
    console.log('  Posting...');
    const postButton = page.getByTestId('tweetButtonInline');
    await postButton.click();
    await page.waitForTimeout(3000);

    // Take screenshot as proof
    const screenshotPath = '.amp/in/artifacts/marketing/tweet-posted.png';
    await page.screenshot({ path: screenshotPath, fullPage: false });
    console.log(`  ✓ Screenshot saved: ${screenshotPath}`);
    console.log('  ✅ Tweet posted successfully!');

  } catch (err) {
    console.error(`  ✗ Error: ${err.message}`);
    const screenshotPath = '.amp/in/artifacts/marketing/tweet-error.png';
    await page.screenshot({ path: screenshotPath }).catch(() => {});
    console.error(`  Screenshot saved: ${screenshotPath}`);
  } finally {
    await browser.close();
  }
}

postTweet(TWEET_TEXT);
