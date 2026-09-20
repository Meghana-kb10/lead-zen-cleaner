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

  // Add an overdue commitment to localStorage
  await page.evaluate(() => {
    const raw = localStorage.getItem('gharpayy.close.commitments.v1');
    const commitments = raw ? JSON.parse(raw) : [];
    
    // Add overdue commitment
    const overdueDueAt = new Date(Date.now() - 4 * 3600000).toISOString(); // 4 hours ago
    commitments.push({
      id: 'cc-overdue-test',
      leadId: 'bf-test-1',
      leadName: 'Rajesh Verma',
      leadPhone: '+919988776655',
      promisedBy: 'Meera',
      dueAt: overdueDueAt,
      windowId: '3h',
      steps: ['Send payment QR', 'Confirm token deposit'],
      status: 'open',
      changeCount: 1,
      createdAt: new Date(Date.now() - 7 * 3600000).toISOString(),
      updatedAt: new Date(Date.now() - 4 * 3600000).toISOString(),
      history: [
        {
          at: new Date(Date.now() - 7 * 3600000).toISOString(),
          by: 'Meera',
          kind: 'promised',
          dueAt: overdueDueAt,
          windowId: '3h',
          steps: ['Send payment QR']
        }
      ]
    });
    localStorage.setItem('gharpayy.close.commitments.v1', JSON.stringify(commitments));
  });

  // Reload page to pick up updated commitments
  await page.reload({ waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 1000));

  // Click Overdue tab
  await page.evaluate(() => {
    const overdueTab = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Overdue'));
    if (overdueTab) overdueTab.click();
  });
  await new Promise(r => setTimeout(r, 800));

  const overdueCardPath = path.join(ARTIFACTS_DIR, 'closing_overdue_card.png');
  await page.screenshot({ path: overdueCardPath, fullPage: true });
  console.log('Saved overdue card screenshot:', overdueCardPath);

  // Click History button on the overdue card to inspect audit history
  await page.evaluate(() => {
    const histBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('History'));
    if (histBtn) histBtn.click();
  });
  await new Promise(r => setTimeout(r, 800));

  const historyPath = path.join(ARTIFACTS_DIR, 'closing_history_expanded.png');
  await page.screenshot({ path: historyPath, fullPage: true });
  console.log('Saved history expanded screenshot:', historyPath);

  // Check details on card
  const details = await page.evaluate(() => {
    const body = document.body.innerText;
    return {
      hasOverdueBadge: body.includes('OVERDUE') || body.includes('Late'),
      hasLate4h: /Late \d+h/.test(body),
      hasDestructiveBorder: !!document.querySelector('.border-destructive, .border-red-500'),
      hasWhatsAppArea: body.includes('CUSTOMER WHATSAPP FOLLOW-UP'),
      hasSteps: body.includes('Send payment QR')
    };
  });
  console.log('Overdue card verification:', details);

  await browser.close();
}

run().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
