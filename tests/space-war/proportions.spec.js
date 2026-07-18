const { test, expect } = require('@playwright/test');

// Suite da release space-war-true-proportions-v1 (bugs operator-reported:
// fake-apparent-proportions, cross-system-visibility, blackhole/neutron-star
// look-not-approved). Asserts por LEI (θ = 2R/d) e por diagnóstico — nunca por
// número mágico de escala.

async function startFlight(page) {
  await page.goto('/space-war/index.html');
  await page.waitForSelector('canvas', { state: 'attached', timeout: 30000 });
  await page.waitForFunction(() => window.__spaceWarReady === true, { timeout: 45000 });
  await page.keyboard.press('Enter');
  await page.waitForTimeout(150);
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => window.__spaceWar.phase === 'flight', { timeout: 10000 });
}

test.describe('Space War — Proporções Verdadeiras', () => {
  // Budgets largos (2026-07-18): CI compartilhada — boot software-GL >15s sob
  // carga estourava o teto de 30s por TEMPO, não por asserção.
  test.setTimeout(90000);

  // AC-01: honestidade angular AO VIVO — o Sol do céu da Terra é um SOL
  // (1.1°–8.6°), não um terço da tela; Saturno é uma joia, não um disco.
  test('AC-01: volumes aparentes honestos no sistema solar', async ({ page }) => {
    await startFlight(page);
    const geo = await page.evaluate(() => {
      const sw = window.__spaceWar;
      const sun = sw.bodies.find((b) => b.isSun);
      const earth = sw.bodies.find((b) => b.def.key === 'earth');
      const saturn = sw.bodies.find((b) => /saturno/i.test(b.def.name));
      const dSE = earth.worldPos.distanceTo(sun.worldPos);
      const dSat = saturn.worldPos.distanceTo(earth.worldPos);
      return {
        earthR: earth.def.radius,
        thetaSunDeg: (2 * sun.def.radius / dSE) * 57.29578,
        thetaSaturnDeg: (2 * (saturn.def.ring ? saturn.def.ring.outer : saturn.def.radius) / dSat) * 57.29578,
      };
    });
    expect(geo.earthR).toBeGreaterThanOrEqual(2200);   // grande vs a NAVE (275 naves)
    expect(geo.thetaSunDeg).toBeGreaterThan(1.1);
    expect(geo.thetaSunDeg).toBeLessThan(8.6);
    expect(geo.thetaSaturnDeg).toBeLessThan(1.5);      // conjunção varia com as fases orbitais
  });

  // AC-02: ANOS-LUZ — do sistema do buraco negro, NENHUMA malha do solar é
  // visível; o solar vira um glow fotométrico fraco (uma estrela como as outras).
  test('AC-02: de outro sistema, o solar é só um ponto de luz', async ({ page }) => {
    test.setTimeout(60000);
    await startFlight(page);
    await page.evaluate(() => window.__swDebug.goTo('neutron', 800));
    await page.waitForFunction(
      () => window.__spaceWar.sysGlow.binary && window.__spaceWar.sysGlow.binary.visible === false,
      undefined, { timeout: 8000 },
    );
    const far = await page.evaluate(() => {
      const sw = window.__spaceWar;
      const solarMeshes = sw.bodies.filter((b) => b.system === 'solar' && b.group.visible);
      const betelMeshes = sw.bodies.filter((b) => b.system === 'betelgeuse' && b.group.visible);
      return {
        solarVisible: solarMeshes.map((b) => b.def.name),
        betelVisible: betelMeshes.map((b) => b.def.name),
        solarGlow: sw.sysGlow.solar,
        dSolar: Math.hypot(sw.ship.pos.x, sw.ship.pos.y, sw.ship.pos.z),
      };
    });
    // seria impossível ver Saturno do buraco negro (operador)
    expect(far.solarVisible).toEqual([]);
    expect(far.betelVisible).toEqual([]);
    expect(far.dSolar).toBeGreaterThan(16_000_000);    // anos-luz de jogo
    expect(far.solarGlow.visible).toBe(true);          // o Sol de lá: mais uma estrela
    expect(far.solarGlow.px).toBeLessThanOrEqual(30);
  });

  // AC-03: buraco negro das REFERÊNCIAS — disco domina (>30·rs), espiral de gás,
  // estrias espirais + aro quente no shader, jatos bipolares.
  test('AC-03: buraco negro por referência (3× horizonte, disco 5×, espiral, jatos)', async ({ page }) => {
    test.setTimeout(60000);
    await startFlight(page);
    const bh = await page.evaluate(() => {
      const sw = window.__spaceWar;
      const b = sw.bodies.find((x) => x.def.key === 'blackhole');
      let tubes = 0, cylinders = 0, rings = 0, spiralUniform = 0, rimUniform = 0;
      b.group.traverse((o) => {
        if (!o.isMesh) return;
        const g = o.geometry && o.geometry.type;
        if (g === 'TubeGeometry') tubes++;
        if (g === 'CylinderGeometry') cylinders++;
        if (g === 'RingGeometry') {
          rings++;
          const u = o.material && o.material.uniforms;
          if (u && u.uSpiral && u.uSpiral.value >= 1) spiralUniform++;
          if (u && u.uRim && u.uRim.value >= 1) rimUniform++;
        }
      });
      return { rs: b.def.rs, diskOuter: b.def.disk.outer, diskInner: b.def.disk.inner,
        jet: b.def.jet === true, tubes, cylinders, rings, spiralUniform, rimUniform };
    });
    expect(bh.rs).toBe(480);
    expect(bh.diskOuter / bh.rs).toBeGreaterThan(30);  // o disco DOMINA a cena
    expect(bh.diskInner / bh.rs).toBeCloseTo(3.0, 1);  // ISCO
    expect(bh.jet).toBe(true);
    expect(bh.cylinders).toBeGreaterThanOrEqual(4);    // jato bipolar (2×2 camadas)
    expect(bh.tubes).toBeGreaterThanOrEqual(1);        // espiral de gás caindo
    expect(bh.spiralUniform).toBeGreaterThanOrEqual(1); // estrias espirais no disco
    expect(bh.rimUniform).toBeGreaterThanOrEqual(1);    // aro interno branco-quente
  });

  // AC-04: estrela de nêutrons das REFERÊNCIAS — core 3×, agulhas polares,
  // gaiola dipolo, halo, strobe vivo.
  test('AC-04: estrela de nêutrons por referência (R 90, needles, gaiola)', async ({ page }) => {
    test.setTimeout(60000);
    await startFlight(page);
    await page.evaluate(() => window.__swDebug.goTo('neutron', 400));
    await page.waitForTimeout(250);
    const ns = await page.evaluate(() => {
      const sw = window.__spaceWar;
      const b = sw.bodies.find((x) => x.def.kind === 'neutron');
      let cylinders = 0, dipoles = 0, sprites = 0, maxJetLen = 0;
      b.group.traverse((o) => {
        if (o.isSprite) sprites++;
        if (!o.isMesh) return;
        const g = o.geometry && o.geometry.type;
        if (g === 'CylinderGeometry') {
          cylinders++;
          maxJetLen = Math.max(maxJetLen, o.geometry.parameters.height || 0);
        }
        if (g === 'TubeGeometry') dipoles++;
      });
      return { radius: b.def.radius, cylinders, dipoles, sprites, maxJetLen,
        strobe: sw.pulsarStrobe };
    });
    expect(ns.radius).toBe(90);
    expect(ns.cylinders).toBeGreaterThanOrEqual(4);            // 2 agulhas × 2 camadas
    expect(ns.maxJetLen).toBeGreaterThanOrEqual(90 * 200);     // needles LONGAS (refs)
    expect(ns.dipoles).toBeGreaterThanOrEqual(10);             // gaiola dipolo visível
    expect(ns.sprites).toBeGreaterThanOrEqual(3);              // glint/corona/halo
    expect(ns.strobe).toBeGreaterThan(0.5);                    // farol 30 Hz vivo
  });

  // AC-05: a "bola de plasma" (remanescente) acende NA APROXIMAÇÃO — nada de pop.
  test('AC-05: remanescente com fade de distância (sem pop)', async ({ page }) => {
    test.setTimeout(60000);
    await startFlight(page);
    // longe (sistema solar): invisível
    const farFade = await page.evaluate(() => window.__spaceWar.remnantFade ?? 0);
    expect(farFade).toBeLessThan(0.05);
    // a ~1.9M do centro do binário: rampa PARCIAL (visível, ainda não plena)
    await page.evaluate(() => window.__swDebug.goTo('blackhole', 4000));
    await page.waitForFunction(
      () => (window.__spaceWar.remnantFade ?? 0) > 0.05,
      undefined, { timeout: 8000 },
    );
    const midFade = await page.evaluate(() => window.__spaceWar.remnantFade);
    expect(midFade).toBeGreaterThan(0.05);
    // dentro do sistema: pleno
    await page.evaluate(() => window.__swDebug.goTo('neutron', 800));
    await page.waitForFunction(
      () => (window.__spaceWar.remnantFade ?? 0) > 0.9,
      undefined, { timeout: 8000 },
    );
  });

  // AC-06: nave sem BOLA azul — grão do rastro pequeno, reflexo sutil.
  test('AC-06: jato da nave fino e reflexo sutil', async ({ page }) => {
    await startFlight(page);
    const report = await page.evaluate(() => window.__swDebug.shipReport());
    expect(report.rimIntensity).toBeLessThanOrEqual(0.6);      // sem retângulo branco
    // throttle a fundo por ~1.2s: grão do rastro nunca vira bola (era 5–9u)
    await page.keyboard.down('KeyW');
    await page.waitForTimeout(1200);
    await page.keyboard.up('KeyW');
    const grain = await page.evaluate(() => window.__spaceWar.thrusterGrain ?? 0);
    expect(grain).toBeGreaterThan(0);
    expect(grain).toBeLessThan(3.2);
  });
});
