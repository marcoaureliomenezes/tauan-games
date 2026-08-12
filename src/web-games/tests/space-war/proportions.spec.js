const { test, expect } = require('@playwright/test');

// Suite da release v0.2.9 (bugs operator-reported:
// fake-apparent-proportions, cross-system-visibility, blackhole/neutron-star
// look-not-approved). Asserts por LEI (θ = 2R/d) e por diagnóstico — nunca por
// número mágico de escala.
//
// T-07 (v0.10.0, batch L2): 2 waits convertidos (frames pós-goTo → ticks de
// sim; janela de empuxo do AC-06 → polling do grão do rastro + ticks); nenhum
// sleep fixo mantido neste spec.

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

test.describe('Space War — Proporções Verdadeiras', () => {
  // Budgets largos (2026-07-18): CI compartilhada — boot software-GL >15s sob
  // carga estourava o teto de 30s por TEMPO, não por asserção.
  test.setTimeout(180000);

  // AC-01 (volumes aparentes honestos, θ=2R/d) DELETADO (T-02, demotion-map
  // anexo §3): já coberto por test-physics-unit.js:68/:114 (T-TP-01 — Sol da
  // Terra entre 1.1°/8.6°, Saturno < ~1.9°).

  // AC-02: ANOS-LUZ — do sistema do buraco negro, NENHUMA malha do solar é
  // visível; o solar vira um glow fotométrico fraco (uma estrela como as outras).
  test('AC-02: de outro sistema, o solar é só um ponto de luz', async ({ page }) => {
    test.setTimeout(120000);
    await startFlight(page);
    await page.evaluate(() => window.__swDebug.goTo('neutron', 800));
    await page.waitForFunction(
      () => window.__spaceWar.sysGlow.binary && window.__spaceWar.sysGlow.binary.visible === false,
      undefined, { timeout: 45000 },
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
    test.setTimeout(120000);
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
    test.setTimeout(120000);
    await startFlight(page);
    await page.evaluate(() => window.__swDebug.goTo('neutron', 400));
    await waitSimTicks(page, 3);        // T-07: era sleep fixo de 250 ms — frames p/ strobe/fx rodarem pós-teleporte
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

  // AC-05 (remanescente com fade de distância, "sem pop") DELETADO —
  // rebaixado para test-physics-unit.js: a curva de fade
  // (1 - THREE.MathUtils.smoothstep(d, REMNANT_FULL, REMNANT_FAR)) é reproduzida
  // com os mesmos limiares de celestial/system.js (poço de import bloqueado
  // por scene.js) e varrida em 3 distâncias (longe/rampa parcial/dentro).

  // AC-06: nave sem BOLA azul — grão do rastro pequeno, reflexo sutil.
  test('AC-06: jato da nave fino e reflexo sutil', async ({ page }) => {
    await startFlight(page);
    const report = await page.evaluate(() => window.__swDebug.shipReport());
    expect(report.rimIntensity).toBeLessThanOrEqual(0.6);      // sem retângulo branco
    // throttle a fundo: grão do rastro nunca vira bola (era 5–9u).
    // T-07: era sleep fixo de 1200 ms — espera a CONDIÇÃO (grão emitido sob
    // empuxo pleno) + alguns ticks de empuxo sustentado, não o relógio.
    await page.keyboard.down('KeyW');
    await page.waitForFunction(() => (window.__spaceWar.thrusterGrain ?? 0) > 0, undefined, { timeout: 45000 });
    await waitSimTicks(page, 3);
    await page.keyboard.up('KeyW');
    const grain = await page.evaluate(() => window.__spaceWar.thrusterGrain ?? 0);
    expect(grain).toBeGreaterThan(0);
    expect(grain).toBeLessThan(3.2);
  });
});
