const { test, expect } = require('@playwright/test');

// Suite da release space-war-three-states-v1 — a máquina de 3 estados de voo:
//   ORBIT (sistema planetário) · CRUISE (interplanetário) · JOURNEY (interestelar)
// AC-01 boot acoplado à Terra (ORBIT) · AC-02 transição ORBIT→CRUISE→ORBIT com
// histerese · AC-03 mapas planetários (estações/luas novas) · AC-04 JOURNEY
// espelha a queima · AC-05 corredor de estrelas APAGADO dentro do sistema
// planetário (regressão da aberração "estrelas antes de Júpiter").
//
// T-07 (v0.10.0, batch L2): 2 waits convertidos (frames de starfield → ticks
// de sim; settle do assistente de órbita → polling do frameReport); nenhum
// sleep fixo mantido neste spec.

// T-07: polling sobre o relógio de SIMULAÇÃO em vez de sleep de parede.
// game.time avança a cada frame (dt clampado a 0,05 s): time >= t0 + n·0,05
// garante ≥ n frames renderizados — robusto ao slow-mo do headless.
async function waitSimTicks(page, n = 2, timeout = 30000) {
  const t0 = await page.evaluate(() => window.__spaceWar.time);
  await page.waitForFunction(([t, d]) => window.__spaceWar.time >= t + d, [t0, n * 0.05 - 1e-9], { timeout });
}

async function load(page) {
  await page.goto('/src/web-games/space-war/index.html');
  await page.waitForSelector('canvas', { state: 'attached', timeout: 60000 });
  await page.waitForFunction(() => window.__spaceWarReady === true, { timeout: 120000 });
}

async function startFlight(page) {
  await load(page);
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => window.__spaceWar.phase !== 'menu', { timeout: 30000 });
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => window.__spaceWar.phase === 'flight', { timeout: 45000 });
}

// Máquina compartilhada com outras suítes (load alto): budgets largos.
test.describe('Space War — 3 estados de voo (ORBIT/CRUISE/JOURNEY)', () => {
  test.setTimeout(150000);

  // AC-01 (boot em ORBIT/raio 1.5×lua), AC-02 (ORBIT→CRUISE→ORBIT com
  // histerese) e AC-04 (JOURNEY domina a máquina) DELETADOS (T-02,
  // demotion-map anexo §3): já cobertos por test-mode-unit.js — histerese
  // (:74, entra/segue/sai), "journey domina a máquina" (:100).
  //
  // AC-03 (estações orbitais + luas de Betelgeuse) DELETADO — rebaixado para
  // test-mode-unit.js (inventário puro de config.js: 6 slugs de estação +
  // 4 luas de Betelgeuse, sem precisar dos corpos MATERIALIZADOS que exigem
  // scene.js).

  // AC-05: regressão da aberração — o corredor de estrelas NÃO acende dentro
  // do sistema planetário (nada de cruzar estrelas antes de Júpiter).
  test('AC-05: corredor de estrelas apagado dentro do sistema planetário', async ({ page }) => {
    await startFlight(page);
    await page.waitForFunction(() => window.__spaceWar.mode === 'orbit', { timeout: 45000 });
    await waitSimTicks(page, 3);      // T-07: era sleep fixo de 400 ms — alguns frames de starfield
    const fade = await page.evaluate(() => window.__spaceWar.starfieldFade);
    expect(fade).toBeLessThan(0.2);
  });

  // AC-06: FRAME LOCAL-NÍVEL — "o planeta é o chão" (aero-fighters): no modo
  // ORBIT o up da nave e da câmera alinham com o up local radial e o planeta
  // fica como arco na metade de baixo da tela.
  test('AC-06: planeta como referencial fixo embaixo (frame aero-fighters)', async ({ page }) => {
    await startFlight(page);
    await page.waitForFunction(() => window.__spaceWar.mode === 'orbit', { timeout: 45000 });
    // decola e engata o ASSISTENTE DE ÓRBITA ([O]) — circulariza em volta da
    // Terra: é a experiência exata do frame (planeta embaixo, asas niveladas)
    await page.keyboard.down('KeyW');
    await page.waitForFunction(() => window.__spaceWar.ship.landed === false, { timeout: 45000 });
    await page.keyboard.up('KeyW');
    await page.keyboard.press('KeyO');
    await page.waitForFunction(() => window.__spaceWar.ship.inOrbit === true, { timeout: 40000 });
    // T-07: era sleep fixo de 1500 ms — espera o assistente NIVELAR de fato
    // (a condição que o teste afere), não um relógio de parede.
    await page.waitForFunction(() => {
      const fr = window.__swDebug.frameReport();
      return fr && fr.body === 'earth' && fr.shipUpDot > 0.8 && fr.camUpDot > 0.8;
    }, undefined, { timeout: 45000 });
    const fr = await page.evaluate(() => window.__swDebug.frameReport());
    expect(fr).not.toBe(null);
    expect(fr.body).toBe('earth');
    expect(fr.shipUpDot).toBeGreaterThan(0.8);     // asas no horizonte local
    expect(fr.camUpDot).toBeGreaterThan(0.8);      // câmera no frame do planeta
    expect(fr.bodyNdcY).toBeLessThan(0.2);         // planeta na metade de baixo
  });
});
