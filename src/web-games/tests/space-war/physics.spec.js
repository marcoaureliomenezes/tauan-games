const { test, expect } = require('@playwright/test');

// Suite da release v0.2.8.
// AC-01 pulsar BRILHA · AC-02 massas físicas · AC-05 arsenal gravitacional
// (traçadora [G] + bomba de Higgs [H] + poço em computeGravity + supernova)
// · AC-06 escala de parede.
//
// T-07 (v0.10.0, batch L2): 2 waits convertidos (frames pós-goTo → ticks de
// sim; settle do teleporte rasante → polling do corpo dominante); nenhum
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

test.describe('Space War — Fidelidade Física', () => {
  // Budgets largos (2026-07-18): CI compartilhada — boot software-GL >15s sob
  // carga estourava o teto de 30s por TEMPO, não por asserção.
  test.setTimeout(180000);

  // AC-01: a estrela de nêutrons EMITE luz (def.light), o strobe óptico ~30 Hz
  // está vivo e apontar para ela produz pixels CLAROS (núcleo + corona + halo).
  test('AC-01: pulsar brilha — light def + strobe + pixels claros', async ({ page }) => {
    test.setTimeout(120000);
    await startFlight(page);
    await page.evaluate(() => window.__swDebug.goTo('neutron', 400));
    await waitSimTicks(page, 3);        // T-07: era sleep fixo de 200 ms — 2-3 frames: strobe/fx rodam; queda ainda ínfima
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

  // AC-02 (TOV + hierarquia SMBH) DELETADO (T-02, demotion-map anexo §3): já
  // coberto verbatim por test-physics-unit.js:182 ("config: massas respeitam
  // a física").

  // AC-05a: traçadora [G] — infinita, balística, com trilha crescendo.
  test('AC-05a: bomba traçadora gravitacional — infinita + trilha', async ({ page }) => {
    test.setTimeout(120000);
    await startFlight(page);
    await page.evaluate(() => window.__swDebug.goTo('terra', 4));
    const ok = await page.evaluate(() => window.__swDebug.launchGravBomb());
    expect(ok).toBe(true);                         // infinita: nunca nega por munição
    await page.waitForFunction(() => {
      const ts = window.__spaceWar.projectiles.filter((p) => p.isTracer);
      return ts.length >= 1 && ts[0].trailN > 4;   // trilha registrando o caminho
    }, { timeout: 45000 });
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

  // AC-05b (Higgs — poço gravitacional transiente sentido pelo campo)
  // DELETADO — rebaixado para tools/test-sw-gravity-unit.js: computeGravity
  // real (gravity.js importa limpo em Node) sobe DE VERDADE com um poço
  // {mu:5e11, until, soft} perto do ponto de amostra, e volta ao baseline
  // quando game.time ultrapassa `until` (o mesmo corte que computeGravity usa
  // em produção — a expiração "~8 s" do pulso do jogo).

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

  // AC-06 (proporções — Terra grande vs nave, luas coerentes) DELETADO
  // (T-02, demotion-map anexo §3): já coberto por test-physics-unit.js:68
  // ("proporções verdadeiras: geometria do sistema solar é consistente" —
  // T-TP-01, mesmas invariantes de raio/SOI/órbita da lua).
});
