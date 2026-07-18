const { test, expect } = require('@playwright/test');

// Suite da release space-war-three-states-v1 — a máquina de 3 estados de voo:
//   ORBIT (sistema planetário) · CRUISE (interplanetário) · JOURNEY (interestelar)
// AC-01 boot acoplado à Terra (ORBIT) · AC-02 transição ORBIT→CRUISE→ORBIT com
// histerese · AC-03 mapas planetários (estações/luas novas) · AC-04 JOURNEY
// espelha a queima · AC-05 corredor de estrelas APAGADO dentro do sistema
// planetário (regressão da aberração "estrelas antes de Júpiter").

async function load(page) {
  await page.goto('/space-war/index.html');
  await page.waitForSelector('canvas', { state: 'attached', timeout: 30000 });
  await page.waitForFunction(() => window.__spaceWarReady === true, { timeout: 45000 });
}

async function startFlight(page) {
  await load(page);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(150);
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => window.__spaceWar.phase === 'flight', { timeout: 10000 });
}

// Máquina compartilhada com outras suítes (load alto): budgets largos.
test.describe('Space War — 3 estados de voo (ORBIT/CRUISE/JOURNEY)', () => {
  test.setTimeout(150000);

  // AC-01: a nave nasce ACOPLADA ao sistema planetário da Terra.
  test('AC-01: boot em modo ORBIT no sistema Terra (regime orbital)', async ({ page }) => {
    await startFlight(page);
    await page.waitForFunction(() => window.__spaceWar.mode === 'orbit', { timeout: 15000 });
    const st = await page.evaluate(() => ({
      planetary: window.__spaceWar.planetary && window.__spaceWar.planetary.key,
      systems: window.__spaceWar.planetarySystems.map((s) => s.key),
      earthRadius: window.__spaceWar.planetarySystems.find((s) => s.key === 'earth')?.radius,
    }));
    expect(st.planetary).toBe('earth');
    // mapas planetários: 8 do solar + 3 de Betelgeuse (escopo da release)
    expect(st.systems.length).toBe(11);
    // regra do operador: raio = 1.5 × órbita do satélite mais distante
    const lua = await page.evaluate(() => {
      const l = window.__spaceWar.bodies.find((b) => b.def.name === 'Lua');
      return l ? l.orbit : 0;
    });
    expect(st.earthRadius).toBeCloseTo(lua * 1.5, 3);
  });

  // AC-02: cruza a borda → CRUISE; volta → ORBIT no sistema de Marte.
  test('AC-02: ORBIT→CRUISE ao sair do sistema; re-acopla em Marte', async ({ page }) => {
    await startFlight(page);
    await page.waitForFunction(() => window.__spaceWar.mode === 'orbit', { timeout: 15000 });
    // longe de qualquer sistema planetário → CRUISE
    await page.evaluate(() => window.__swDebug.goTo('mars', 30));
    await page.waitForFunction(() => window.__spaceWar.mode === 'cruise', { timeout: 15000 });
    const cruise = await page.evaluate(() => ({
      planetary: window.__spaceWar.planetary,
      blend: window.__spaceWar.modeBlend,
    }));
    expect(cruise.planetary).toBe(null);
    expect(cruise.blend).toBeLessThan(1);        // transição em curso (gradual)
    // perto de Marte → acopla no sistema planetário de Marte
    await page.evaluate(() => window.__swDebug.goTo('mars', 2.2));
    await page.waitForFunction(
      () => window.__spaceWar.mode === 'orbit' && window.__spaceWar.planetary?.key === 'mars',
      { timeout: 15000 },
    );
  });

  // AC-03: mapas planetários têm mobília orbital (estações/satélites + luas novas).
  test('AC-03: estações orbitais e luas de Betelgeuse existem como corpos', async ({ page }) => {
    await startFlight(page);
    const found = await page.evaluate(() => {
      const keys = ['iss', 'sat1', 'marsstation', 'jupstation', 'satstation', 'brasastation'];
      const out = {};
      for (const k of keys) {
        const b = window.__spaceWar.bodies.find((x) => x.def.key === k);
        out[k] = b ? { kind: b.def.kind, isMoon: b.isMoon, parent: b.parent?.def?.key } : null;
      }
      const moons = ['Bruxa', 'Tição', 'Fagulha', 'Carvão'].map((n) =>
        window.__spaceWar.bodies.some((x) => x.def.name === n));
      return { out, moons };
    });
    for (const k of Object.keys(found.out)) {
      expect(found.out[k], `estação ${k} existe`).not.toBe(null);
      expect(found.out[k].kind).toBe('station');
      expect(found.out[k].isMoon).toBe(true);      // rail em torno do planeta
    }
    expect(found.out.iss.parent).toBe('earth');
    expect(found.moons).toEqual([true, true, true, true]);
  });

  // AC-04: engatar a jornada promove a máquina a JOURNEY; chegada devolve CRUISE.
  test('AC-04: JOURNEY durante a queima; chegada em CRUISE', async ({ page }) => {
    test.setTimeout(60000);
    await startFlight(page);
    await page.evaluate(() => window.__swDebug.goTo('terra', 4));
    await page.evaluate(() => window.__swDebug.target('betelgeuse'));
    await page.keyboard.press('KeyZ');
    await page.waitForFunction(() => window.__spaceWar.journey?.active, { timeout: 20000 });
    await page.waitForFunction(() => window.__spaceWar.mode === 'journey', { timeout: 15000 });
    await page.evaluate(() => window.__swDebug.journeyWarp(0.995));
    await page.waitForFunction(() => !window.__spaceWar.journey.active, { timeout: 15000 });
    await page.waitForFunction(() => window.__spaceWar.mode === 'cruise', { timeout: 20000 });
  });

  // AC-05: regressão da aberração — o corredor de estrelas NÃO acende dentro
  // do sistema planetário (nada de cruzar estrelas antes de Júpiter).
  test('AC-05: corredor de estrelas apagado dentro do sistema planetário', async ({ page }) => {
    await startFlight(page);
    await page.waitForFunction(() => window.__spaceWar.mode === 'orbit', { timeout: 15000 });
    await page.waitForTimeout(400);   // alguns frames de starfield
    const fade = await page.evaluate(() => window.__spaceWar.starfieldFade);
    expect(fade).toBeLessThan(0.2);
  });
});
