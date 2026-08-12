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

  // AC-01: perfil 30/40/30 AO VIVO — fases nos pontos certos, cruzeiro em v_max.
  test('AC-01: 30% acelera, 40% em v_max (CRUZEIRO), 30% freia', async ({ page }) => {
    test.setTimeout(180000);
    await startFlight(page);
    await engageJourney(page);
    const probe = async (sNorm) => {
      await page.evaluate((sn) => window.__swDebug.journeyWarp(sn), sNorm);
      await waitSimTicks(page, 2);   // T-07: era sleep fixo de 350 ms — 2 ticks p/ o estado pós-warp assentar
      return page.evaluate(() => {
        const j = window.__spaceWar.journey;
        return { phase: j.phase, v: j.v, vMax: j.vMax, beta: j.beta };
      });
    };
    const accel = await probe(0.15);
    expect(accel.phase).toBe('accel');
    expect(accel.v).toBeLessThan(accel.vMax * 0.75);
    const coast = await probe(0.5);
    expect(coast.phase).toBe('coast');
    expect(Math.abs(coast.v - coast.vMax) / coast.vMax).toBeLessThan(0.01);
    // AC-03: headlight FORTE no cruzeiro — β ≥ 0.98 (a 90° o céu cai p/ ~5.7°)
    expect(coast.beta).toBeGreaterThanOrEqual(0.98);
    const decel = await probe(0.85);
    expect(decel.phase).toBe('decel');
    expect(decel.v).toBeLessThan(decel.vMax * 0.75);
  });

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

  // AC-05: IMUNIDADE — a queima atravessa o corredor inteiro sem abortar
  // (reverte o abort-por-impacto do rc-1 por ordem do operador).
  test('AC-05: sem colisão durante a viagem — queima nunca aborta no corredor', async ({ page }) => {
    test.setTimeout(240000);
    await startFlight(page);
    await engageJourney(page);
    const immune = await page.evaluate(() => window.__spaceWar.journey.immune);
    expect(immune).toBe(true);
    // varre o corredor inteiro: a queima segue ativa em todos os pontos
    for (const sn of [0.1, 0.3, 0.5, 0.7, 0.9, 0.97]) {
      await page.evaluate((x) => window.__swDebug.journeyWarp(x), sn);
      // T-07: era sleep fixo de 250 ms — 2 ticks de sim p/ o frame pós-warp rodar
      await waitSimTicks(page, 2);
      const alive = await page.evaluate(() => ({
        active: window.__spaceWar.journey.active,
        hp: window.__spaceWar.ship.hp,
      }));
      expect(alive.active).toBe(true);
      expect(alive.hp).toBeGreaterThan(0);
    }
    // e a CHEGADA continua normal
    await page.evaluate(() => window.__swDebug.journeyWarp(0.999));
    await page.waitForFunction(() => !window.__spaceWar.journey.active, { timeout: 45000 });
    const speed = await page.evaluate(() => window.__spaceWar.ship.speed);
    expect(speed).toBeLessThanOrEqual(1600);
  });
});
