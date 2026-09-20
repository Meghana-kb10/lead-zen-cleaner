const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

const ARTIFACTS_DIR = 'C:/Users/kbmeg/.gemini/antigravity-ide/brain/cf0f4e07-85ff-496d-9022-a13f6a69d9b4';

async function run() {
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 960 });

  await page.goto('http://localhost:8080/closing', { waitUntil: 'networkidle2' });

  // Look for Founder 60s Brief button
  console.log('Clicking Founder 60s Brief button...');
  const clicked = await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Founder 60s Brief'));
    if (btn) {
      btn.click();
      return true;
    }
    return false;
  });
  console.log('Button clicked:', clicked);
  await new Promise(r => setTimeout(r, 1200));

  // Take screenshot of the opened modal
  const modalPath = path.join(ARTIFACTS_DIR, 'founder_60s_brief_modal.png');
  await page.screenshot({ path: modalPath, fullPage: true });
  console.log('Saved modal screenshot:', modalPath);

  // Check dialog contents
  const content = await page.evaluate(() => {
    const dialog = document.querySelector('[role="dialog"]');
    if (!dialog) return { open: false };
    return {
      open: true,
      text: dialog.innerText
    };
  });
  console.log('Dialog verified:', content.open, content.text.slice(0, 300));

  await browser.close();
}

run().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
