const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

const ARTIFACTS_DIR = 'C:/Users/kbmeg/.gemini/antigravity-ide/brain/cf0f4e07-85ff-496d-9022-a13f6a69d9b4';

async function run() {
  console.log('Launching browser...');
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  const consoleLogs = [];
  page.on('console', msg => consoleLogs.push(`[${msg.type()}] ${msg.text()}`));

  console.log('Navigating to http://localhost:8080/closing...');
  await page.goto('http://localhost:8080/closing', { waitUntil: 'networkidle2', timeout: 30000 });

  // 1. Check outcome directive banner
  console.log('Verifying Outcome Banner...');
  const bannerText = await page.evaluate(() => {
    const el = document.querySelector('body');
    return el ? el.innerText : '';
  });

  const hasDirective = bannerText.includes("Deliver today's closing commitments: settle promises and prevent payment intent from slipping.");
  console.log('Outcome directive banner present:', hasDirective);

  // Take initial overview screenshot
  const overviewPath = path.join(ARTIFACTS_DIR, 'closing_overview.png');
  await page.screenshot({ path: overviewPath, fullPage: true });
  console.log('Saved overview screenshot:', overviewPath);

  // 2. Click "Definitely Close" on the first lead
  console.log('Clicking "Definitely Close" to create a commitment...');
  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Definitely Close'));
    if (btn) btn.click();
  });
  await new Promise(r => setTimeout(r, 1000));

  // Take screenshot of creation modal
  const modalPath = path.join(ARTIFACTS_DIR, 'closing_create_modal.png');
  await page.screenshot({ path: modalPath, fullPage: true });
  console.log('Saved creation modal screenshot:', modalPath);

  // 3. Select a step and submit commitment
  console.log('Selecting step and submitting commitment...');
  await page.evaluate(() => {
    // Select first step chip if present
    const stepChips = Array.from(document.querySelectorAll('button')).filter(b => b.innerText.includes('Call with') || b.innerText.includes('Send payment'));
    if (stepChips.length > 0) stepChips[0].click();

    // Find and click "Commit to close" button
    const commitBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Commit to close'));
    if (commitBtn) commitBtn.click();
  });
  await new Promise(r => setTimeout(r, 1500));

  // 3b. Switch to "All live" tab to see the active commitment
  console.log('Switching to "All live" tab...');
  await page.evaluate(() => {
    const tab = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('All live'));
    if (tab) tab.click();
  });
  await new Promise(r => setTimeout(r, 1000));

  // Take screenshot of the active commitment card in All live tab
  const cardPath = path.join(ARTIFACTS_DIR, 'closing_active_card.png');
  await page.screenshot({ path: cardPath, fullPage: true });
  console.log('Saved active card screenshot:', cardPath);

  // 4. Verify Active Commitment Card contents
  console.log('Inspecting active commitment card...');
  const activeCardDetails = await page.evaluate(() => {
    const bodyText = document.body.innerText;
    const waLinks = Array.from(document.querySelectorAll('a[href*="wa.me"]')).map(a => a.href);
    const copyBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Copy update'));
    const plus3hBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.trim() === '+3h');
    const itClosedBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('It closed'));
    const didNotCloseBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Did not close'));

    return {
      hasAnjali: bodyText.includes('Anjali Kulkarni'),
      hasDueIn: /Due in \d+[mh]/.test(bodyText) || /Due/.test(bodyText),
      hasLate: /Late \d+h/.test(bodyText) || /OVERDUE/.test(bodyText),
      waLinks,
      hasCopyBtn: !!copyBtn,
      hasPlus3h: !!plus3hBtn,
      hasItClosed: !!itClosedBtn,
      hasDidNotClose: !!didNotCloseBtn,
    };
  });
  console.log('Active card verification details:', activeCardDetails);

  // 5. Test +3h re-promise
  console.log('Testing +3h action...');
  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.trim() === '+3h');
    if (btn) btn.click();
  });
  await new Promise(r => setTimeout(r, 1200));

  const after3hPath = path.join(ARTIFACTS_DIR, 'closing_after_3h.png');
  await page.screenshot({ path: after3hPath, fullPage: true });
  console.log('Saved after +3h screenshot:', after3hPath);

  // 6. Test "Did not close" dialog
  console.log('Testing "Did not close" dialog...');
  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Did not close'));
    if (btn) btn.click();
  });
  await new Promise(r => setTimeout(r, 1000));

  const dialogInfo = await page.evaluate(() => {
    const dialog = document.querySelector('[role="dialog"]');
    if (!dialog) return { open: false };
    const text = dialog.innerText;
    const chips = Array.from(dialog.querySelectorAll('button')).map(b => b.innerText.trim());
    return { open: true, text: text.slice(0, 200), chipsCount: chips.length };
  });
  console.log('Did not close Dialog status:', dialogInfo);

  const dialogPath = path.join(ARTIFACTS_DIR, 'closing_not_closed_dialog.png');
  await page.screenshot({ path: dialogPath, fullPage: true });
  console.log('Saved dialog screenshot:', dialogPath);

  // Close dialog by clicking outside or pressing Escape
  await page.keyboard.press('Escape');
  await new Promise(r => setTimeout(r, 800));

  // 7. Test "It closed" action
  console.log('Testing "It closed" action...');
  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('It closed'));
    if (btn) btn.click();
  });
  await new Promise(r => setTimeout(r, 1200));

  const keptPath = path.join(ARTIFACTS_DIR, 'closing_kept.png');
  await page.screenshot({ path: keptPath, fullPage: true });
  console.log('Saved kept screenshot:', keptPath);

  // Close browser
  await browser.close();
  console.log('Browser verification completed successfully.');
}

run().catch(err => {
  console.error('Error during verification:', err);
  process.exit(1);
});
