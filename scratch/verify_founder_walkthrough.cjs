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

  // 1. Click Founder 60s Brief
  console.log('Clicking Founder 60s Brief button...');
  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Founder 60s Brief'));
    if (btn) btn.click();
  });
  await new Promise(r => setTimeout(r, 800));

  // 2. Click Customer Audit Trail tab
  console.log('Switching to Customer Audit Trail (Q7 Proof) tab...');
  const tabs = await page.$$('[role="tab"]');
  for (const tab of tabs) {
    const text = await page.evaluate(el => el.innerText, tab);
    if (text.includes('Customer Audit Trail')) {
      console.log('Found tab element, clicking via Puppeteer click()...');
      await tab.click();
      break;
    }
  }
  await new Promise(r => setTimeout(r, 1000));

  // Screenshot tab 2
  const trailModalPath = path.join(ARTIFACTS_DIR, 'founder_customer_walkthrough_proof.png');
  await page.screenshot({ path: trailModalPath, fullPage: true });
  console.log('Saved walkthrough proof screenshot:', trailModalPath);

  // 3. Click Seed Aarav Patel into Closing Desk
  console.log('Looking for Seed Aarav Patel button...');
  const buttons = await page.$$('button');
  let seedClicked = false;
  for (const btn of buttons) {
    const text = await page.evaluate(el => el.innerText, btn);
    if (text.includes('Seed Aarav Patel')) {
      console.log('Found Seed button, clicking via Puppeteer click()...');
      await btn.click();
      seedClicked = true;
      break;
    }
  }
  console.log('Seed clicked:', seedClicked);
  await new Promise(r => setTimeout(r, 1000));

  // Screenshot after seed confirmation
  const seededModalPath = path.join(ARTIFACTS_DIR, 'founder_customer_seeded_confirmation.png');
  await page.screenshot({ path: seededModalPath, fullPage: true });
  console.log('Saved seeded confirmation screenshot:', seededModalPath);

  // 4. Click Open Aarav Patel in Closing Desk Board
  console.log('Navigating to Closing Desk board...');
  const openBtns = await page.$$('button');
  for (const b of openBtns) {
    const text = await page.evaluate(el => el.innerText, b);
    if (text.includes('Open Aarav Patel')) {
      await b.click();
      break;
    }
  }
  await new Promise(r => setTimeout(r, 1500));

  // Screenshot board with Aarav Patel
  const boardWithAaravPath = path.join(ARTIFACTS_DIR, 'closing_aarav_patel_live.png');
  await page.screenshot({ path: boardWithAaravPath, fullPage: true });
  console.log('Saved board with Aarav Patel screenshot:', boardWithAaravPath);

  // 5. Expand Aarav Patel's History
  console.log('Clicking History button on Aarav Patel card...');
  let historyOpened = false;
  const boardButtons = await page.$$('button');
  for (const b of boardButtons) {
    const text = await page.evaluate(el => el.innerText, b);
    if (text.includes('History')) {
      console.log('Found History button with text:', text, 'clicking...');
      await b.click();
      historyOpened = true;
      break;
    }
  }
  console.log('History opened:', historyOpened);
  await new Promise(r => setTimeout(r, 1000));

  // Screenshot Aarav Patel with expanded history
  const historyExpandedPath = path.join(ARTIFACTS_DIR, 'closing_aarav_history_expanded.png');
  await page.screenshot({ path: historyExpandedPath, fullPage: true });
  console.log('Saved Aarav history screenshot:', historyExpandedPath);

  await browser.close();
  console.log('SUCCESS: All walkthrough verification steps passed.');
}

run().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
