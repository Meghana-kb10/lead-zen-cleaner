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

  // 1. Click Shortcuts popover
  console.log('Opening Shortcuts Popover...');
  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Shortcuts'));
    if (btn) btn.click();
  });
  await new Promise(r => setTimeout(r, 800));

  const popoverPath = path.join(ARTIFACTS_DIR, 'closing_shortcuts_popover.png');
  await page.screenshot({ path: popoverPath, fullPage: true });
  console.log('Saved shortcuts popover screenshot:', popoverPath);

  // Close popover
  await page.keyboard.press('Escape');
  await new Promise(r => setTimeout(r, 500));

  // 2. Open "Definitely Close" modal to test numeric key 1-5 and Ctrl+Enter
  console.log('Testing numeric shortcut in creation modal...');
  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Definitely Close'));
    if (btn) btn.click();
  });
  await new Promise(r => setTimeout(r, 800));

  // Press '1' to pick 3 hours window
  await page.keyboard.press('1');
  await new Promise(r => setTimeout(r, 500));

  // Press Ctrl+Enter to submit
  await page.keyboard.down('Control');
  await page.keyboard.press('Enter');
  await page.keyboard.up('Control');
  await new Promise(r => setTimeout(r, 1200));

  // Switch to "All live" tab
  await page.evaluate(() => {
    const tab = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('All live'));
    if (tab) tab.click();
  });
  await new Promise(r => setTimeout(r, 800));

  const cardWithShortcutsPath = path.join(ARTIFACTS_DIR, 'closing_card_with_kbd_badges.png');
  await page.screenshot({ path: cardWithShortcutsPath, fullPage: true });
  console.log('Saved card with kbd badges screenshot:', cardWithShortcutsPath);

  // 3. Test pressing '3' on the board to re-promise +3h
  console.log('Testing key "3" shortcut on open card...');
  await page.keyboard.press('3');
  await new Promise(r => setTimeout(r, 1200));

  const afterKey3Path = path.join(ARTIFACTS_DIR, 'closing_after_key_3.png');
  await page.screenshot({ path: afterKey3Path, fullPage: true });
  console.log('Saved after key 3 screenshot:', afterKey3Path);

  // 4. Test pressing 'c' to mark it closed
  console.log('Testing key "c" shortcut to mark closed...');
  await page.keyboard.press('c');
  await new Promise(r => setTimeout(r, 1200));

  const afterKeyCPath = path.join(ARTIFACTS_DIR, 'closing_after_key_c.png');
  await page.screenshot({ path: afterKeyCPath, fullPage: true });
  console.log('Saved after key C screenshot:', afterKeyCPath);

  await browser.close();
  console.log('Shortcuts verification complete.');
}

run().catch(err => {
  console.error('Error during shortcuts test:', err);
  process.exit(1);
});
