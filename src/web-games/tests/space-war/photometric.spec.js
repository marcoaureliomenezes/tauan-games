const { test, expect } = require('@playwright/test');

// Suite da release v0.2.7.
// AC-01 starfield fotométrico em quads · AC-02 LOD ponto↔disco · AC-03 corona/
// flare honestos · AC-04 pulsar visível (operador) · AC-05 glows de sistema.
// Asserts por DIAGNÓSTICO (game.starLod/sysGlow — R-4 do PLAN): imunes ao
// rasterizador por CPU do headless.
//
// T-07 (v0.10.0, batch L2): 1 wait convertido (settle do boot → polling dos
// diagnósticos aferidos: glow do binário visível + membros em modo cluster);
// nenhum sleep fixo mantido neste spec.

async function startFlight(page) {
  await page.goto('/src/web-games/space-war/index.html');
  await page.waitForSelector('canvas', { state: 'attached', timeout: 60000 });
  await page.waitForFunction(() => window.__spaceWarReady === true, { timeout: 120000 });
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => window.__spaceWar.phase !== 'menu', { timeout: 30000 });
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => window.__spaceWar.phase === 'flight', { timeout: 45000 });
}

test.describe('Space War — Estrelas Fotométricas', () => {

  // AC-01 (starfield fotométrico + gauge), AC-02/04 (pulsar — LOD ponto↔disco)
  // e AC-03 (corona/flare honestos) DELETADOS (T-02, demotion-map anexo §3):
  // já cobertos por test-physics-unit.js:211 (fotometria PSF/gauge), :224
  // (LOD ponto↔disco com histerese, verbatim "2px↑/1px↓") e :199/:237
  // (fluxo inverso-quadrado + gauge do flare).

  // AC-04 (metade interestelar) + AC-05: de OUTRO sistema, o farol do binário
  // (fluxo somado dominado pela NS) é visível e estroboscópico; o ponto
  // individual cede ao glow (sem dupla contagem). Ao resolver o sistema
  // (d < 0.9·raio) o glow some e os membros assumem.
  test('AC-04/05: glows de sistema fotométricos + handoff cluster→membros', async ({ page }) => {
    test.setTimeout(120000);
    await startFlight(page);
    // T-07: era sleep fixo de 250 ms — espera os diagnósticos assentarem (as
    // condições aferidas abaixo: glow do binário aceso, membros em cluster).
    await page.waitForFunction(() => window.__spaceWar.sysGlow.binary?.visible === true
      && window.__spaceWar.starLod.s1?.mode === 'cluster', undefined, { timeout: 45000 });
    const fromSolar = await page.evaluate(() => ({
      glows: window.__spaceWar.sysGlow,
      ns: window.__spaceWar.starLod.neutron,
      s1: window.__spaceWar.starLod.s1,
    }));
    // farol do binário: NS-dominado, I>1, px≥4, visível de casa (AC-04)
    expect(fromSolar.glows.binary.visible).toBe(true);
    expect(fromSolar.glows.binary.I).toBeGreaterThan(1);
    expect(fromSolar.glows.binary.px).toBeGreaterThanOrEqual(4);
    // em CASA o glow do próprio solar fica suprimido (sistema resolvido)
    expect(fromSolar.glows.solar.visible).toBe(false);
    // todos os sistemas cullados têm glow fotométrico dentro dos tetos (AC-05)
    for (const key of ['binary', 'chaotic', 'core', 'veil', 'betelgeuse']) {
      const g = fromSolar.glows[key];
      expect(g).toBeTruthy();
      expect(g.px).toBeLessThanOrEqual(30);
      expect(g.alpha).toBeLessThanOrEqual(1);
    }
    // membros de sistema não-resolvido cedem ao glow (modo 'cluster')
    expect(fromSolar.ns.mode).toBe('cluster');
    expect(fromSolar.s1.mode).toBe('cluster');
    // resolvendo o binário: glow some, membro assume
    await page.evaluate(() => window.__swDebug.goTo('neutron', 1500));
    await page.waitForFunction(
      () => window.__spaceWar.sysGlow.binary.visible === false,
      undefined, { timeout: 45000 },
    );
    const resolved = await page.evaluate(() => ({
      glow: window.__spaceWar.sysGlow.binary,
      ns: window.__spaceWar.starLod.neutron,
    }));
    expect(resolved.glow.visible).toBe(false);
    expect(resolved.ns.mode).toBe('point');
    expect(resolved.ns.visible).toBe(true);
  });
});
