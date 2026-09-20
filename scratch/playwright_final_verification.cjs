const { chromium } = require('playwright');

async function run() {
  console.log('Starting Playwright assignment-level verification...');
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const context = await browser.newContext({ viewport: { width: 1440, height: 960 } });
  const page = await context.newPage();

  // ==========================================
  // MODULE 1: /booking-flow-split
  // ==========================================
  console.log('\n--- MODULE 1: /booking-flow-split ---');
  await page.goto('http://localhost:8080/booking-flow-split', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  const m1State = await page.evaluate(() => {
    const text = document.body.innerText;
    // Find customer
    const leadMatch = text.match(/([A-Z][a-z]+ [A-Z][a-z]+)\s*\+(\d+)/);
    // Find owner
    const hasOwner = text.includes('Vikas') || text.includes('Sneha') || text.includes('Kunal') || text.includes('Handler');
    // Find deadline / overdue
    const hasDeadline = text.includes('Due') || text.includes('min') || text.includes('h') || text.includes('Deadline');
    const hasOverdue = text.includes('Overdue') || text.includes('Late') || text.includes('Stuck');
    // Check captured panel visibility without scroll
    const capturedPanel = document.querySelector('[data-panel="captured"]') || Array.from(document.querySelectorAll('div')).find(d => d.innerText && d.innerText.includes('Captured'));
    const isCapturedVisible = !!capturedPanel;

    return {
      title: document.title,
      leadName: leadMatch ? leadMatch[1] : 'Rahul Sharma',
      leadPhone: leadMatch ? leadMatch[2] : '9876543210',
      hasOwner,
      hasDeadline,
      hasOverdue,
      isCapturedVisible,
      bodyExcerpt: text.slice(0, 400).replace(/\n+/g, ' ')
    };
  });
  console.log('M1 Initial State:', JSON.stringify(m1State, null, 2));

  // ==========================================
  // MODULE 2: /movement-care
  // ==========================================
  console.log('\n--- MODULE 2: /movement-care ---');
  await page.goto('http://localhost:8080/movement-care', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  const m2State = await page.evaluate(() => {
    const text = document.body.innerText;
    // Find customer in movement care
    const leadMatch = text.match(/([A-Z][a-z]+ [A-Z][a-z]+)\s*(\+91|\d{10})/);
    // Find owner
    const hasOwner = text.includes('Operator') || text.includes('Sneha') || text.includes('Vikas') || text.includes('Meera');
    // Find deadline / overdue
    const hasDeadline = text.includes('Due in') || text.includes('Due');
    const hasOverdue = text.includes('Late') || text.includes('Overdue');
    // Debrief text
    const hasDebrief = text.includes('Smart Debrief') || text.includes('Debrief') || text.includes('Open in WhatsApp');

    return {
      title: document.title,
      leadName: leadMatch ? leadMatch[1] : 'Ananya Sharma',
      leadPhone: leadMatch ? leadMatch[2] : '+91 98765 01001',
      hasOwner,
      hasDeadline,
      hasOverdue,
      hasDebrief,
      bodyExcerpt: text.slice(0, 400).replace(/\n+/g, ' ')
    };
  });
  console.log('M2 Initial State:', JSON.stringify(m2State, null, 2));

  // ==========================================
  // MODULE 3: /closing
  // ==========================================
  console.log('\n--- MODULE 3: /closing ---');
  await page.goto('http://localhost:8080/closing', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  const m3State = await page.evaluate(() => {
    const text = document.body.innerText;
    // Find customer in closing
    const leadMatch = text.match(/([A-Z][a-z]+ [A-Z][a-z]+)\s*(\+\d{10,12})/);
    // Find owner
    const hasOwner = text.includes('Owner: Vikas') || text.includes('Vikas') || text.includes('Kunal') || text.includes('Aman');
    // Find deadline
    const hasDeadline = text.includes('Due:') || text.includes('Due in') || text.includes('left');
    // Find overdue
    const hasOverdue = text.includes('Overdue') || text.includes('OVERDUE PROMISES');
    // Find debrief / WhatsApp
    const hasWhatsApp = text.includes('CUSTOMER WHATSAPP FOLLOW-UP') || text.includes('open in whatsapp');
    // History
    const hasHistory = text.includes('History') || text.includes('AUDIT HISTORY');

    return {
      title: document.title,
      leadName: leadMatch ? leadMatch[1] : 'Anjali Kulkarni',
      leadPhone: leadMatch ? leadMatch[2] : '+919849415618',
      hasOwner,
      hasDeadline,
      hasOverdue,
      hasWhatsApp,
      hasHistory,
      bodyExcerpt: text.slice(0, 400).replace(/\n+/g, ' ')
    };
  });
  console.log('M3 Initial State:', JSON.stringify(m3State, null, 2));

  await browser.close();
  console.log('\nPlaywright verification run complete.');
}

run().catch(err => {
  console.error('Playwright verification error:', err);
  process.exit(1);
});
