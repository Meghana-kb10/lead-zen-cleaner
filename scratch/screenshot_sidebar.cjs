const { chromium } = require('playwright');
const path = require('path');

const ARTIFACTS_DIR = 'C:/Users/kbmeg/.gemini/antigravity-ide/brain/cf0f4e07-85ff-496d-9022-a13f6a69d9b4';

async function test() {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
  await page.goto('http://localhost:8080/closing', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  const sidebar = await page.$('aside');
  if (sidebar) {
    const targetPath = path.join(ARTIFACTS_DIR, 'sidebar_highlighted_modules.png');
    await sidebar.screenshot({ path: targetPath });
    console.log('Sidebar screenshot saved at:', targetPath);
  } else {
    console.log('Sidebar element not found');
  }

  await browser.close();
}

test().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
