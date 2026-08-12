const { test, expect } = require('@playwright/test');

// Aceitação da release space-war-three-states-v1 — O VOO COMPLETO (pedido do
// operador 2026-07-18): "ao final devo poder jogar e me mover de um sistema
// planetário a outro experienciando os 3 estados extensivamente".
//
// Num ÚNICO voo (um boot só):
//   1. ORBIT (Terra) — decolagem + visão orbital (Lua dentro do mesmo sistema)
//   2. ORBIT→CRUISE — sai do sistema Terra, cruzeiro interplanetário
//   3. CRUISE→ORBIT — acopla em Marte COM FREIO AUTOMÁTICO GRADUAL (chegando
//      a 2.000 u/s, o acoplamento desacelera a nave ao regime orbital)
//   4. JOURNEY — [Z] para Betelgeuse (outro sistema estelar), cruzeiro β~0.99
//   5. JOURNEY→CRUISE→ORBIT — chegada e acoplamento em Brasa (Betelgeuse):
//      sistema planetário alienígena com luas (Tição/Fagulha) + estação
//
// T-07 (v0.10.0, batch L2): 3 waits convertidos (settle pós-goTo → polling do
// modo/sistema; freio de acoplamento → polling da velocidade relativa; fx do
// cruzeiro → polling de β/fade); nenhum sleep fixo mantido neste spec.

async function startFlight(page) {
  await page.goto('/src/web-games/space-war/index.html');
  await page.waitForSelector('canvas', { state: 'attached', timeout: 60000 });
  await page.waitForFunction(() => window.__spaceWarReady === true, { timeout: 120000 });
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => window.__spaceWar.phase !== 'menu', { timeout: 30000 });
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => window.__spaceWar.phase === 'flight', { timeout: 45000 });
}



test.describe('Space War — O voo completo pelos 3 estados', () => {
  test.setTimeout(240000);

  test('Terra(ORBIT) → CRUISE → Marte(ORBIT c/ freio) → JOURNEY → Brasa(ORBIT)', async ({ page }) => {
    await startFlight(page);

    // ── 1. ORBIT (Terra): nasce acoplado; decolagem mantém o modo ──
    await page.waitForFunction(() => window.__spaceWar.mode === 'orbit' && window.__spaceWar.planetary?.key === 'earth', { timeout: 45000 });
    await page.keyboard.down('KeyW');
    await page.waitForFunction(() => window.__spaceWar.ship.landed === false, { timeout: 45000 });
    await page.keyboard.up('KeyW');
    // visão orbital: a Lua está DENTRO do mesmo sistema planetário
    await page.evaluate(() => window.__swDebug.goTo('lua', 3));
    // T-07: era sleep fixo de 400 ms — espera a máquina confirmar o acoplamento
    // no sistema Terra pós-teleporte (a condição aferida logo abaixo).
    await page.waitForFunction(() => window.__spaceWar.mode === 'orbit' && window.__spaceWar.planetary?.key === 'earth', undefined, { timeout: 45000 });
    const earthSystem = await page.evaluate(() => ({
      mode: window.__spaceWar.mode, planetary: window.__spaceWar.planetary?.key,
      cruise: window.__spaceWar.planetary?.radius / 20,
    }));
    expect(earthSystem.mode).toBe('orbit');
    expect(earthSystem.planetary).toBe('earth');   // Terra–Lua = uma "fase" só

    // ── 2. ORBIT→CRUISE: longe de qualquer sistema planetário ──
    await page.evaluate(() => window.__swDebug.goTo('mars', 30));
    await page.waitForFunction(() => window.__spaceWar.mode === 'cruise', { timeout: 45000 });

    // ── 3. CRUISE→ORBIT com FREIO DE ACOPLAMENTO: chega a 2.000 u/s ──
    await page.evaluate(() => window.__swDebug.goTo('mars', 6));   // fora do sistema (R≈3.8k)
    await page.waitForFunction(() => window.__spaceWar.mode === 'cruise', { timeout: 45000 });
    await page.evaluate(() => {
      const g = window.__spaceWar;
      const mars = g.bodies.find((b) => b.def.key === 'mars');
      const d = mars.worldPos.clone().sub(g.ship.pos).normalize();
      g.ship.vel.copy(d).multiplyScalar(2000);      // mergulho a 2.000 u/s
    });
    await page.waitForFunction(
      () => window.__spaceWar.mode === 'orbit' && window.__spaceWar.planetary?.key === 'mars',
      { timeout: 30000 },
    );
    // após o blend, a velocidade relativa a Marte caiu ao regime orbital.
    // T-07: era sleep fixo de 3500 ms — espera o FREIO cumprir seu papel (a
    // própria condição aferida), robusto ao slow-mo do headless.
    await page.waitForFunction(() => {
      const g = window.__spaceWar;
      const mars = g.bodies.find((b) => b.def.key === 'mars');
      const v = g.ship.vel.clone(); if (mars.worldVel) v.sub(mars.worldVel);
      return v.length() < (g.planetary.radius / 20) * 3;
    }, undefined, { timeout: 60000 });
    const rel = await page.evaluate(() => {
      const g = window.__spaceWar;
      const mars = g.bodies.find((b) => b.def.key === 'mars');
      const v = g.ship.vel.clone(); if (mars.worldVel) v.sub(mars.worldVel);
      return { rel: v.length(), localCruise: window.__spaceWar.planetary.radius / 20 };
    });
    expect(rel.rel).toBeLessThan(rel.localCruise * 3);   // freou de 2000 → regime orbital

    // ── 4. JOURNEY: [Z] para Betelgeuse ──
    await page.evaluate(() => window.__swDebug.target('betelgeuse'));
    await page.keyboard.press('KeyZ');
    await page.waitForFunction(() => window.__spaceWar.journey?.active, { timeout: 45000 });
    await page.waitForFunction(() => window.__spaceWar.mode === 'journey', { timeout: 45000 });
    await page.evaluate(() => window.__swDebug.journeyWarp(0.5));
    // T-07: era sleep fixo de 300 ms — espera β/fade do cruzeiro assentarem
    // (as condições aferidas abaixo) após o warp.
    await page.waitForFunction(() => window.__spaceWar.journey.beta > 0.9 && window.__spaceWar.starfieldFade > 0.5, undefined, { timeout: 45000 });
    const cruiseFx = await page.evaluate(() => ({
      beta: window.__spaceWar.journey.beta,
      fade: window.__spaceWar.starfieldFade,
    }));
    expect(cruiseFx.beta).toBeGreaterThan(0.9);          // relatividade plena no cruzeiro
    expect(cruiseFx.fade).toBeGreaterThan(0.5);          // corredor aceso FORA dos sistemas

    // ── 5. Chegada: JOURNEY→CRUISE → acopla em Brasa (Betelgeuse) ──
    await page.evaluate(() => window.__swDebug.journeyWarp(0.995));
    await page.waitForFunction(() => !window.__spaceWar.journey.active, { timeout: 30000 });
    await page.waitForFunction(() => window.__spaceWar.mode === 'cruise', { timeout: 45000 });
    await page.evaluate(() => window.__swDebug.goTo('brasa', 2));
    await page.waitForFunction(
      () => window.__spaceWar.mode === 'orbit' && window.__spaceWar.planetary?.key === 'brasa',
      { timeout: 45000 },
    );
    // sistema planetário alienígena completo: luas + estação no mapa
    const brasa = await page.evaluate(() => {
      const b = window.__spaceWar.bodies.find((x) => x.def.key === 'brasa');
      return b.moons.map((m) => m.def.name);
    });
    expect(brasa).toContain('Tição');
    expect(brasa).toContain('Fagulha');
    expect(brasa).toContain('Estação de Brasa');
  });
});
