const { test, expect } = require('@playwright/test');

// Suite da release space-war-photometric-stars-v1.
// AC-01 starfield fotométrico em quads · AC-02 LOD ponto↔disco · AC-03 corona/
// flare honestos · AC-04 pulsar visível (operador) · AC-05 glows de sistema.
// Asserts por DIAGNÓSTICO (game.starLod/sysGlow — R-4 do PLAN): imunes ao
// rasterizador por CPU do headless.

async function startFlight(page) {
  await page.goto('/space-war/index.html');
  await page.waitForSelector('canvas', { state: 'attached', timeout: 15000 });
  await page.waitForFunction(() => window.__spaceWarReady === true, { timeout: 15000 });
  await page.keyboard.press('Enter');
  await page.waitForTimeout(150);
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => window.__spaceWar.phase === 'flight', { timeout: 4000 });
}

test.describe('Space War — Estrelas Fotométricas', () => {

  // AC-01: starfield em quads instanciados com parâmetros fotométricos; o
  // contrato da journey (contagem/fade/β) segue vivo.
  test('AC-01: starfield fotométrico — quads instanciados + gauge', async ({ page }) => {
    await startFlight(page);
    const field = await page.evaluate(() => ({
      ...window.__spaceWar.starfield,
      photo: window.__spaceWar.starfieldPhoto,
    }));
    expect(field.mode).toBe('instanced-quads');
    expect(field.stars).toBeGreaterThanOrEqual(2000);
    expect(field.layers).toBe(2);
    expect(field.photo.d0).toBeGreaterThan(0);
    expect(field.photo.corePx).toBeGreaterThan(0.5);
    expect(field.photo.corePx).toBeLessThan(5);       // núcleo FIXO pequeno — não 7px de disco
    expect(field.photo.maxPx).toBeLessThanOrEqual(16); // teto do glare de campo
  });

  // AC-02: LOD ponto↔disco ao VIVO — a NS (R=90) é sub-pixel a 1500·R (135k,
  // dentro de 0.9·raio do binário) e vira PONTO fotométrico saturado; a 400·R
  // resolve o DISCO com a anatomia viva.
  test('AC-02/04: pulsar — ponto fotométrico ofuscante no sistema, disco de perto', async ({ page }) => {
    test.setTimeout(60000);
    await startFlight(page);
    // dentro do sistema binário, longe da NS: modo PONTO, brilho saturado no teto
    await page.evaluate(() => window.__swDebug.goTo('neutron', 1500));
    await page.waitForFunction(
      () => window.__spaceWar.starLod.neutron && window.__spaceWar.starLod.neutron.mode === 'point',
      undefined, { timeout: 8000 },
    );
    const far = await page.evaluate(() => window.__spaceWar.starLod.neutron);
    expect(far.discPx).toBeLessThan(1);
    expect(far.I).toBeGreaterThan(1);                  // saturado (glare)
    expect(far.px).toBeGreaterThanOrEqual(4);
    expect(far.visible).toBe(true);
    // strobe 30 Hz MODULA o ponto: α = pointAlpha(I)·strobe; com I saturado
    // (α_base=1), o α do ponto SEGUE o strobe frame a frame. (Asserção de
    // acoplamento, não de variação: o dt clampado do headless — 0.05 s = 1.5
    // ciclos exatos de 30 Hz — alia o seno num valor constante.)
    const tie = await page.evaluate(() => ({
      alpha: window.__spaceWar.starLod.neutron.alpha,
      strobe: window.__spaceWar.pulsarStrobe,
    }));
    expect(tie.strobe).toBeGreaterThan(0.5);
    expect(Math.abs(tie.alpha - tie.strobe)).toBeLessThan(0.02);
    // de perto o disco resolve (histerese sobe em 2px) e o near-viz volta
    await page.evaluate(() => window.__swDebug.goTo('neutron', 400));
    await page.waitForFunction(
      () => window.__spaceWar.starLod.neutron.mode === 'disc',
      undefined, { timeout: 8000 },
    );
    const near = await page.evaluate(() => window.__spaceWar.starLod.neutron);
    expect(near.discPx).toBeGreaterThanOrEqual(2);
  });

  // AC-03: corona com TETO de pixels (≤ ~1.15× o disco na distância) e flare
  // ∝ fluxo — sem piso: a 4.8M u o flare do Sol é ZERO (além do cutoff) e perto
  // da Terra é pleno.
  test('AC-03: corona/flare honestos à distância', async ({ page }) => {
    test.setTimeout(60000);
    await startFlight(page);
    // perto da Terra: d(Sol) ≈ 440k < FLARE_FULL → flare pleno
    await page.waitForTimeout(250);
    const home = await page.evaluate(() => ({
      flareVis: window.__spaceWar.sunFlareVisible,
      flareF: window.__spaceWar.sunFlareFactor,
      sun: window.__spaceWar.starLod.sun,
    }));
    expect(home.flareVis).toBe(true);
    expect(home.flareF).toBe(1);
    expect(home.sun.mode).toBe('disc');
    // em Netuno (d(Sol) ≈ 3.8M, ainda no solar): flare ∝ fluxo (mínimo), disco
    // do Sol pequeno com corona COLADA (teto 1.15×disco além de CORONA_FAR).
    await page.evaluate(() => window.__swDebug.goTo('neptune', 8));
    await page.waitForFunction(
      () => window.__spaceWar.starLod.sun && window.__spaceWar.starLod.sun.discPx < 30,
      undefined, { timeout: 8000 },
    );
    const away = await page.evaluate(() => ({
      flareF: window.__spaceWar.sunFlareFactor,
      sun: window.__spaceWar.starLod.sun,
    }));
    expect(away.flareF).toBeLessThan(0.1);             // fluxo (0.7/3.8)² ≈ 0.03 — sem piso
    expect(away.sun.mode).toBe('disc');
    expect(away.sun.coronaPx).toBeLessThanOrEqual(away.sun.discPx * 1.3);
    // no binário (d(Sol) ≈ 22M — "anos-luz"): flare CORTADO e o Sol nem é disco:
    // vira o glow do sistema (cluster) — proporções verdadeiras.
    await page.evaluate(() => window.__swDebug.goTo('neutron', 1500));
    await page.waitForFunction(
      () => window.__spaceWar.starLod.sun && window.__spaceWar.starLod.sun.mode === 'cluster',
      undefined, { timeout: 8000 },
    );
    const veryFar = await page.evaluate(() => ({
      flareVis: window.__spaceWar.sunFlareVisible,
      flareF: window.__spaceWar.sunFlareFactor,
      solarGlow: window.__spaceWar.sysGlow.solar,
    }));
    expect(veryFar.flareVis).toBe(false);
    expect(veryFar.flareF).toBe(0);
    expect(veryFar.solarGlow.visible).toBe(true);
  });

  // AC-04 (metade interestelar) + AC-05: de OUTRO sistema, o farol do binário
  // (fluxo somado dominado pela NS) é visível e estroboscópico; o ponto
  // individual cede ao glow (sem dupla contagem). Ao resolver o sistema
  // (d < 0.9·raio) o glow some e os membros assumem.
  test('AC-04/05: glows de sistema fotométricos + handoff cluster→membros', async ({ page }) => {
    test.setTimeout(60000);
    await startFlight(page);
    await page.waitForTimeout(250);
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
      undefined, { timeout: 8000 },
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
