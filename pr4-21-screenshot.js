const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const PANEL_URL = 'http://127.0.0.1:4997';
const TOKEN = 'x5ACJleiGSZKFNuo76x6MsnzV9MUadsFBMoVK_sTjLQ';
const REPORT_DIR = '/home/marco/workspace/dadaia/.dadaia/reports/dadaia-workspace/qa-engineer';
const TS = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1400, height: 900 });

  // Collect console messages
  const consoleMessages = [];
  const consoleErrors = [];
  page.on('console', msg => {
    consoleMessages.push(`[${msg.type()}] ${msg.text()}`);
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });

  // Navigate with token
  await page.goto(`${PANEL_URL}/?token=${TOKEN}`);
  await page.waitForLoadState('networkidle');

  // Click Agents tab
  const agentsTab = await page.$('[data-tab="agents"]');
  if (!agentsTab) {
    console.error('ERROR: Agents tab not found!');
    const tabs = await page.$$eval('[role="tab"], .nav-tab, [data-tab]', els => els.map(e => e.textContent + ' / ' + e.getAttribute('data-tab')));
    console.log('Available tabs:', tabs);
  } else {
    await agentsTab.click();
  }

  // Wait for agents grid to load (not skeleton)
  await page.waitForFunction(() => {
    const grid = document.getElementById('agents-grid');
    if (!grid) return false;
    // Wait until aria-busy is false and we have real cards
    return grid.getAttribute('aria-busy') !== 'true' && grid.querySelectorAll('.agent-card:not(.agent-card--skeleton)').length > 0;
  }, { timeout: 15000 });

  // Take screenshot 1: default theme (mint or whatever default is)
  const screenshot1Path = path.join(REPORT_DIR, `${TS}-PR4-21-agents-tab-final.png`);
  await page.screenshot({ path: screenshot1Path, fullPage: false });
  console.log('SCREENSHOT_1:' + screenshot1Path);

  // Capture cards data
  const cardsData = await page.$$eval('.agent-card:not(.agent-card--skeleton)', cards => {
    return cards.map(c => ({
      agentId: c.dataset.agentId,
      tier: c.dataset.tier,
      tierLabel: c.querySelector('.agent-card__tier-label') ? c.querySelector('.agent-card__tier-label').textContent.trim() : null,
      sessions: c.querySelector('.agent-stat__value') ? c.querySelector('.agent-stat__value').textContent.trim() : null,
      hasBorder: !!c.offsetWidth,
      borderStyle: window.getComputedStyle(c).border,
      borderLeft: window.getComputedStyle(c).borderLeft,
      status: c.querySelector('.agent-status-badge') ? c.querySelector('.agent-status-badge').textContent.trim() : null,
    }));
  });
  console.log('CARDS_DATA:' + JSON.stringify(cardsData));

  // Try theme switcher - sage
  const themeButtons = await page.$$('[data-theme-value], .theme-btn, [aria-label*="theme"], [aria-label*="Theme"]');
  console.log('THEME_BUTTONS_COUNT:' + themeButtons.length);
  
  // Try to find theme buttons by title or class
  const themeBtns = await page.$$eval('button, [role="button"]', btns => 
    btns.filter(b => b.title && (b.title.toLowerCase().includes('theme') || b.title.toLowerCase().includes('mint') || b.title.toLowerCase().includes('sage') || b.title.toLowerCase().includes('warm')))
    .map(b => ({ text: b.textContent.trim(), title: b.title, ariaLabel: b.getAttribute('aria-label'), className: b.className }))
  );
  console.log('THEME_BTNS:' + JSON.stringify(themeBtns));

  // Take screenshots for each theme
  const screenshots = [{ theme: 'default', path: screenshot1Path }];

  // Try clicking theme buttons if available
  const themeVariants = ['sage', 'warm', 'mint'];
  for (const theme of themeVariants) {
    const btn = await page.$(`[data-theme="${theme}"], [data-theme-value="${theme}"], button[title="${theme}"]`);
    if (btn) {
      await btn.click();
      await page.waitForTimeout(500);
      const sPath = path.join(REPORT_DIR, `${TS}-PR4-21-theme-${theme}.png`);
      await page.screenshot({ path: sPath, fullPage: false });
      screenshots.push({ theme, path: sPath });
      console.log(`SCREENSHOT_${theme.toUpperCase()}:` + sPath);
    }
  }

  // Output console messages
  console.log('CONSOLE_ERRORS:' + JSON.stringify(consoleErrors));
  console.log('SCREENSHOTS:' + JSON.stringify(screenshots));

  await browser.close();
})().catch(err => {
  console.error('PLAYWRIGHT_ERROR:', err.message);
  process.exit(1);
});
