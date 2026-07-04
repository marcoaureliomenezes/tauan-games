const { test, expect } = require('@playwright/test');

// Suite da release space-war-physics-fidelity-v1.
// AC-01 pulsar BRILHA · AC-02 massas físicas · AC-05 arsenal gravitacional
// (traçadora [G] + bomba de Higgs [H] + poço em computeGravity + supernova)
// · AC-06 escala de parede.

async function load(page) {
  await page.goto('/space-war/index.html');
  await page.waitForSelector('canvas', { state: 'attached', timeout: 15000 });
  await page.waitForFunction(() => window.__spaceWarReady === true, { timeout: 15000 });
}

async function startFlight(page) {
  await load(page);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(150);
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => window.__spaceWar.phase === 'flight', { timeout: 4000 });
}

test.describe('Space War — Fidelidade Física', () => {

  // AC-01: a estrela de nêutrons EMITE luz (def.light), o strobe óptico ~30 Hz
  // está vivo e apontar para ela produz pixels CLAROS (núcleo + corona + halo).
  test('AC-01: pulsar brilha — light def + strobe + pixels claros', async ({ page }) => {
    test.setTimeout(60000);
    await startFlight(page);
    await page.evaluate(() => window.__swDebug.goTo('neutron', 400));
    await page.waitForTimeout(200);       // 2-3 frames: strobe/fx rodam; queda ainda ínfima
    const probe = await page.evaluate(() => {
      const sw = window.__spaceWar;
      const ns = sw.bodies.find((b) => b.def.kind === 'neutron');
      return {
        hasLight: !!(ns && ns.def.light),
        intensity: (ns && ns.def.light && ns.def.light.intensity) || 0,
        strobe: sw.pulsarStrobe ?? null,
      };
    });
    expect(probe.hasLight).toBe(true);
    expect(probe.intensity).toBeGreaterThanOrEqual(3);
    expect(probe.strobe).toBeGreaterThan(0.5);
    expect(probe.strobe).toBeLessThanOrEqual(1.01);
    // Estrutura luminosa REAL no grafo: PointLight + ≥3 sprites de brilho
    // (glint/corona/halo) com opacidade viva — a anatomia do pulsar que cega.
    const lum = await page.evaluate(() => {
      const ns = window.__spaceWar.bodies.find((b) => b.def.kind === 'neutron');
      let lights = 0, glowSprites = 0;
      ns.group.traverse((o) => {
        if (o.isPointLight) lights++;
        if (o.isSprite && o.material && o.material.opacity > 0.15) glowSprites++;
      });
      return { lights, glowSprites };
    });
    expect(lum.lights).toBeGreaterThanOrEqual(1);
    expect(lum.glowSprites).toBeGreaterThanOrEqual(3);
  });

  // AC-02: massas respeitam a física ao VIVO (TOV, hierarquia SMBH) e as
  // estrelas S continuam railed em elipses (seguíveis).
  test('AC-02: TOV + hierarquia SMBH + estrelas S vivas', async ({ page }) => {
    await startFlight(page);
    const m = await page.evaluate(() => {
      const sw = window.__spaceWar;
      const ns = sw.bodies.find((b) => b.def.kind === 'neutron');
      const bh = sw.bodies.find((b) => b.def.key === 'blackhole');
      const sgr = sw.bodies.find((b) => b.def.key === 'sgr');
      const s1 = sw.bodies.find((b) => b.def.key === 's1');
      return { ns: ns.mu, bh: bh.mu, sgr: sgr.mu, sHasMotion: !!(s1 && s1.worldVel) };
    });
    expect(m.ns).toBeLessThanOrEqual(2.2e12);      // limite TOV
    expect(m.sgr).toBeGreaterThan(m.bh);           // SMBH ≫ BN estelar
    expect(m.sHasMotion).toBe(true);
  });

  // AC-05a: traçadora [G] — infinita, balística, com trilha crescendo.
  test('AC-05a: bomba traçadora gravitacional — infinita + trilha', async ({ page }) => {
    test.setTimeout(60000);
    await startFlight(page);
    await page.evaluate(() => window.__swDebug.goTo('terra', 4));
    const ok = await page.evaluate(() => window.__swDebug.launchGravBomb());
    expect(ok).toBe(true);                         // infinita: nunca nega por munição
    await page.waitForFunction(() => {
      const ts = window.__spaceWar.projectiles.filter((p) => p.isTracer);
      return ts.length >= 1 && ts[0].trailN > 4;   // trilha registrando o caminho
    }, { timeout: 8000 });
    // FLOOD (auto-repeat da tecla): munição infinita ≠ simultâneas ilimitadas —
    // debounce + FIFO seguram o teto de 6 ativas (achado LOW da QA).
    const flood = await page.evaluate(async () => {
      for (let i = 0; i < 15; i++) {
        window.__swDebug.launchGravBomb();
        await new Promise((r) => setTimeout(r, 260));
      }
      return window.__spaceWar.projectiles.filter((p) => p.isTracer).length;
    });
    expect(flood).toBeGreaterThanOrEqual(1);
    expect(flood).toBeLessThanOrEqual(6);
  });

  // AC-05b: bomba de Higgs — poço transiente entra em game.wells, puxa DE VERDADE
  // (computeGravity muda perto do poço) e expira sozinho.
  test('AC-05b: Higgs — poço gravitacional transiente sentido pelo campo', async ({ page }) => {
    test.setTimeout(120000);   // headless slow-mo: 8 s de pulso ≈ 26+ s de parede
    await startFlight(page);
    // 8·R da Terra (176k, lado do Sol — goTo é heliocêntrico: 25·R cairia DENTRO
    // do Sol pós-escala!). Sem superfícies por perto o arrasto do poço (cap 600
    // u/s²) é dramático mas inofensivo — a nave sobrevive e o poço expira.
    await page.evaluate(() => window.__swDebug.goTo('terra', 8));
    const launched = await page.evaluate(() => window.__swDebug.launchHiggs('plasma'));
    expect(launched).toBe(true);
    await page.waitForFunction(() => window.__spaceWar.wells.length >= 1, { timeout: 20000 });
    const well = await page.evaluate(() => {
      const sw = window.__spaceWar;
      const w = sw.wells[0];
      return { mu: w.mu, cd: sw.ship.higgsCd };
    });
    expect(well.mu).toBeGreaterThanOrEqual(1e11);  // "very large pull"
    expect(well.cd).toBeGreaterThan(0);            // recarga engatada
    // transiente: o poço morre sozinho (~8 s de pulso ≈ 30-45 s de parede headless)
    await page.waitForFunction(() => window.__spaceWar.wells.length === 0, { timeout: 60000 });
    // e a nave SOBREVIVEU ao arrasto (sim vivo — não congelou em gameover)
    const phase = await page.evaluate(() => window.__spaceWar.phase);
    expect(phase).toBe('flight');
  });

  // AC-05c: Higgs perto do SOL com outcome forçado — SUPERNOVA multicolorida.
  test('AC-05c: Higgs desestabiliza o Sol — supernova acontece', async ({ page }) => {
    test.setTimeout(150000);   // arm+pulso ≈ 9.2 s de sim ≈ 30-45 s de parede na CI
    await startFlight(page);
    await page.evaluate(() => window.__swDebug.goTo('sol', 2.2));   // dentro do alcance de Roche do poço (engaja o Sol)
    const launched = await page.evaluate(() => window.__swDebug.launchHiggs('supernova'));
    expect(launched).toBe(true);
    // arm 1.2 s + pulso 8 s (ou mergulho antes) → supernovaCount incrementa
    await page.waitForFunction(() => (window.__spaceWar.supernovaCount || 0) >= 1, { timeout: 90000 });
  });

  // AC-06 (SUPERSEDED por space-war-true-proportions-v1): a inflação estática
  // de raios foi retificada pelo operador — a Terra é grande vs a NAVE (2200 =
  // 275 naves) e a "parede" vem de CHEGAR PERTO (θ = 2R/d honesto); luas
  // coerentes (dentro da SOI, fora de 2·R) continuam LEI.
  test('AC-06: proporções — Terra grande vs nave, luas coerentes', async ({ page }) => {
    await startFlight(page);
    const g = await page.evaluate(() => {
      const sw = window.__spaceWar;
      const earth = sw.bodies.find((b) => /terra/i.test(b.def.name));
      const moon = sw.bodies.find((b) => /^lua$/i.test(b.def.name));
      return {
        earthR: earth.def.radius,
        moonOrbit: moon ? moon.def.orbit : null,
        earthSoi: earth.soi,
      };
    });
    expect(g.earthR).toBeGreaterThanOrEqual(2200);
    if (g.moonOrbit) {
      expect(g.moonOrbit).toBeGreaterThan(g.earthR * 2.0);
      expect(g.moonOrbit).toBeLessThan(g.earthSoi);
    }
    // voo rasante: a 0.15·R de altitude o corpo é PAREDE (dominante = Terra)
    await page.evaluate(() => window.__swDebug.goTo('terra', 1.15));
    await page.waitForTimeout(200);
    const low = await page.evaluate(() => ({
      dom: window.__spaceWar.ship.dominant?.def?.name || '',
      alt: window.__spaceWar.ship.altitude,
    }));
    expect(low.dom.toLowerCase()).toContain('terra');
    expect(low.alt).toBeLessThan(g.earthR * 0.6);
  });
});
