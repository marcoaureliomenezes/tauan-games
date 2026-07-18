// shot-mode.js — Capturas visuais da rearquitetura 3-estados (QA visual).
// Uso: node tests/space-war/tools/shot-mode.js <outdir>
// Não é um teste: gera screenshots p/ inspeção humana/do agente.
const { chromium } = require('@playwright/test');
const path = require('path');

const OUT = process.argv[2] || '/tmp/space-war-shots';
const BASE = process.env.TEST_PORT ? `http://localhost:${process.env.TEST_PORT}` : 'http://localhost:8080';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await page.goto(`${BASE}/space-war/index.html`);
  await page.waitForFunction(() => window.__spaceWarReady === true, { timeout: 20000 });
  await page.keyboard.press('Enter');
  await page.waitForTimeout(200);
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => window.__spaceWar.phase === 'flight', { timeout: 5000 });
  await page.waitForFunction(() => window.__spaceWar.mode === 'orbit', { timeout: 5000 });

  const shot = async (name, settle = 900) => {
    await page.waitForTimeout(settle);
    await page.screenshot({ path: path.join(OUT, `${name}.png`) });
    const st = await page.evaluate(() => ({
      mode: window.__spaceWar.mode,
      planetary: window.__spaceWar.planetary?.key ?? null,
      speed: Math.round(window.__spaceWar.ship.speed),
    }));
    console.log(name, JSON.stringify(st));
  };

  // 1. ORBIT: Terra vista da órbita (nave no lado iluminado, perto)
  await page.evaluate(() => window.__swDebug.goTo('earth', 2.2));
  await shot('01-orbit-earth');

  // 2. ORBIT: perto da Lua (a visão pedida pelo operador: Terra + Lua grandes)
  await page.evaluate(() => window.__swDebug.target('lua'));
  await page.evaluate(() => window.__swDebug.goTo('lua', 3.5));
  await shot('02-orbit-moon');

  // 3. ORBIT: Marte + Fobos/Deimos + estação
  await page.evaluate(() => window.__swDebug.goTo('mars', 2.6));
  await shot('03-orbit-mars');

  // 4. ORBIT: Saturno (anéis + Titã/Reia + estação)
  await page.evaluate(() => window.__swDebug.goTo('saturn', 2.0));
  await shot('04-orbit-saturn');

  // 5. CRUISE: longe dos sistemas planetários, modo cruise
  await page.evaluate(() => window.__swDebug.goTo('mars', 30));
  await page.waitForFunction(() => window.__spaceWar.mode === 'cruise', { timeout: 5000 });
  await shot('05-cruise');

  // 6. JOURNEY: cruzeiro relativístico (warp para o meio da queima)
  await page.evaluate(() => window.__swDebug.target('betelgeuse'));
  await page.evaluate(() => window.__swDebug.journeyToggle());
  await page.waitForFunction(() => window.__spaceWar.journey?.active, { timeout: 5000 });
  await page.evaluate(() => window.__swDebug.journeyWarp(0.5));
  await shot('06-journey-cruise', 1500);

  await browser.close();
  console.log('OK ->', OUT);
}

main().catch((e) => { console.error(e); process.exit(1); });
