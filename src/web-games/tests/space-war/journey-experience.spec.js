const { test, expect } = require('@playwright/test');

// Suite da release v0.2.5 (bug operator-reported
// space-war-interstellar-experience-flat): perfil 30/40/30, headlight forte,
// crescimento na passagem + riscos (diagnósticos), imunidade a colisão.
//
// T-07 (v0.10.0, batch L2): 4 waits convertidos (settle pós-goTo/warp → ticks
// de sim; β do cruzeiro → polling da condição aferida); nenhum sleep fixo
// mantido neste spec.

// T-07: polling sobre o relógio de SIMULAÇÃO em vez de sleep de parede.
// game.time avança a cada frame (dt clampado a 0,05 s): time >= t0 + n·0,05
// garante ≥ n frames renderizados — robusto ao slow-mo do headless.
async function waitSimTicks(page, n = 2, timeout = 30000) {
  const t0 = await page.evaluate(() => window.__spaceWar.time);
  await page.waitForFunction(([t, d]) => window.__spaceWar.time >= t + d, [t0, n * 0.05 - 1e-9], { timeout });
}

async function startFlight(page) {
  await page.goto('/src/web-games/space-war/index.html');
  await page.waitForSelector('canvas', { state: 'attached', timeout: 60000 });
  await page.waitForFunction(() => window.__spaceWarReady === true, { timeout: 120000 });
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => window.__spaceWar.phase !== 'menu', { timeout: 30000 });
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => window.__spaceWar.phase === 'flight', { timeout: 45000 });
}

async function engageJourney(page) {
  await page.evaluate(() => window.__swDebug.goTo('terra', 4));
  await waitSimTicks(page, 2);   // T-07: era sleep fixo de 120 ms — settle pós-teleporte
  await page.evaluate(() => window.__swDebug.target('betelgeuse'));
  await page.evaluate(() => window.__swDebug.journeyToggle());
  await page.waitForFunction(() => window.__spaceWar.journey && window.__spaceWar.journey.active, { timeout: 45000 });
}

test.describe('Space War — Experiência Interestelar', () => {

  // AC-01 (perfil 30/40/30 AO VIVO) DELETADO (T-02, demotion-map anexo §3):
  // já coberto verbatim por test-physics-unit.js:251 ("viagem trapezoidal
  // 30/40/30: cruzeiro plano em v_max").

  // AC-02/04: os mecanismos de passagem existem e estão armados — crescimento
  // rasante (teto ~48px) e riscos tangenciais (ganho > 0) no diag do starfield.
  // Lei NOVA (operador 2026-07-17): pontos SÓLIDOS consistentes, nunca borrões
  // nem riscos — passagem rasante cresce com teto CONTIDO (~12px), sem streaks.
  test('AC-02/04: pontos sólidos com crescimento contido na passagem', async ({ page }) => {
    test.setTimeout(180000);
    await startFlight(page);
    await engageJourney(page);
    await page.evaluate(() => window.__swDebug.journeyWarp(0.5));
    // T-07: era sleep fixo de 350 ms — espera o β de cruzeiro aferido abaixo.
    await page.waitForFunction(() => window.__spaceWar.starfieldBeta >= 0.98, undefined, { timeout: 45000 });
    const fx = await page.evaluate(() => ({
      fx: window.__spaceWar.starfieldFx,
      field: window.__spaceWar.starfield,
      beta: window.__spaceWar.starfieldBeta,
    }));
    expect(fx.field.mode).toBe('instanced-quads');
    expect(fx.fx.closeMaxPx).toBeGreaterThanOrEqual(8);    // rasante ainda cresce…
    expect(fx.fx.closeMaxPx).toBeLessThanOrEqual(16);      // …mas NUNCA vira borrão
    expect(fx.beta).toBeGreaterThanOrEqual(0.98);          // relatividade plena no cruzeiro
  });

  // AC-05 (sem colisão durante a viagem — imunidade) DELETADO — rebaixado
  // para tools/test-sw-journey-unit.js: journey.js está transitivamente
  // envenenado por scene.js (via nav.js/hud.js), então o invariante
  // `immune: true` é conferido por leitura literal da fonte, e o "nunca
  // aborta no corredor" vira a varredura do perfil trapezoidal puro
  // (celestial/physics.js, importa limpo) — cada ponto da queima (0.1..0.97)
  // produz uma fase/velocidade VÁLIDA, sem lacuna onde a colisão poderia
  // interromper o autopilot.
});
