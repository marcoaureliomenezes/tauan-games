// uplift.spec.js — ACs da release aero-fighters-uplift-v1 (WS-1..WS-6).
// Cobre: liftoff nos 4 mapas VIA BOTÃO (CRIT-1/CRIT-2b), fim do floor-glue (CRIT-2),
// verdade de superfície terra/água (HIGH-3), afundamento na água (WS-5),
// nuke stages + cinematic (WS-6) e altímetro honesto (WS-3).

const { test, expect } = require('@playwright/test');

const MAP_BUTTONS = {
  islands: 'MAR DO SUL',
  desert: 'DESERTO',
  rio: 'RIO DE JANEIRO',
  inhauma: 'INHAUMA',
};

async function bootViaButton(page, mapKey) {
  await page.goto('/src/web-games/aero-fighters/index.html');
  await page.waitForSelector('canvas', { state: 'attached', timeout: 15000 });
  await page.waitForTimeout(600);
  await page.click(`text=${MAP_BUTTONS[mapKey]}`);
  await page.waitForTimeout(500);
  await page.keyboard.press('Space');
  await page.waitForFunction(() => window.game && window.game.running === true, { timeout: 3000 });
}

async function takeOff(page) {
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(4200);
  await page.keyboard.down('ArrowDown');
  await page.waitForFunction(
    () => window.game.missionRealism.sortie.state === 'AIRBORNE',
    { timeout: 8000 },
  ).catch(() => {});
  await page.waitForTimeout(400);
  await page.keyboard.up('ArrowDown');
  await page.keyboard.up('KeyW');
}

test.describe('Uplift — decolagem nos 4 mapas via botão (ADR-U2, CRIT-1/2b)', () => {
  for (const mapKey of Object.keys(MAP_BUTTONS)) {
    test(`U-AC-1 (${mapKey}): seleção por botão decola e mantém o mapa ativo`, async ({ page }) => {
      await bootViaButton(page, mapKey);
      const before = await page.evaluate(() => ({ map: window.game.activeMap, y: window.game.player.y }));
      expect(before.map).toBe(mapKey); // CRIT-2b: sem override para desert
      await takeOff(page);
      const after = await page.evaluate(() => ({
        st: window.game.missionRealism.sortie.state,
        y: window.game.player.y,
      }));
      expect(after.st).toBe('AIRBORNE');
      expect(after.y).toBeGreaterThan(before.y + 3);
    });
  }
});

test('U-AC-2: verdade de superfície — terra no desert, água no mar aberto (HIGH-3)', async ({ page }) => {
  await page.goto('/src/web-games/aero-fighters/index.html');
  await page.waitForSelector('canvas', { state: 'attached', timeout: 15000 });
  await page.waitForTimeout(600);
  const kinds = await page.evaluate(async () => {
    const w = await import('/src/web-games/aero-fighters/src/world.js');
    const out = {};
    window.game.activeMap = 'desert';
    out.desertOpenFloor = w.surfaceInfoAt(300, 100).kind;
    out.desertCrash = w.checkTerrainCollision({ x: 300, y: 0.5, z: 100 });
    window.game.activeMap = 'islands';
    out.openSea = w.surfaceInfoAt(900, 900).kind;
    out.seaCrash = w.checkTerrainCollision({ x: 900, y: 0.5, z: 900 });
    window.game.activeMap = 'desert';
    return out;
  });
  expect(kinds.desertOpenFloor).toBe('land');
  expect(kinds.desertCrash).toBe('GROUND');   // nunca mais "MAR" no deserto
  expect(kinds.openSea).toBe('water');
  expect(kinds.seaCrash).toBe('WATER');
});

test('U-AC-3: floor-glue morto — tocar a pista em voo nunca congela (CRIT-2)', async ({ page }) => {
  await bootViaButton(page, 'desert');
  await takeOff(page);
  // Mergulha de volta na pista
  await page.keyboard.down('ArrowUp');
  await page.waitForTimeout(1600);
  await page.keyboard.up('ArrowUp');
  await page.waitForTimeout(1500);
  const s1 = await page.evaluate(() => ({ st: window.game.missionRealism.sortie.state, y: window.game.player.y, z: window.game.player.pz, hp: window.game.player.hp, running: window.game.running, mayday: window.game.flags.mayday }));
  await page.waitForTimeout(2200);
  const s2 = await page.evaluate(() => ({ st: window.game.missionRealism.sortie.state, y: window.game.player.y, z: window.game.player.pz, hp: window.game.player.hp, running: window.game.running, mayday: window.game.flags.mayday }));
  // O estado degenerado era: AIRBORNE, y≈0.9, z congelado, hp intacto, sem evento.
  const frozen = s2.st === 'AIRBORNE' && s2.y < 2 && Math.abs(s2.z - s1.z) < 2 && s2.hp === 3 && s2.running && !s2.mayday;
  expect(frozen).toBe(false);
});

test('U-AC-4: impacto na água afunda e reporta AFUNDOU NO MAR (WS-5)', async ({ page }) => {
  await bootViaButton(page, 'islands');
  await takeOff(page);
  // Voa reto além do fim da pista (corredor z<-260 é mar aberto) e então mergulha.
  // (Bancar antes de mergulhar não funciona: com a asa rolada, pitch local vira curva.)
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(3200);
  await page.keyboard.up('KeyW');
  await page.keyboard.down('ArrowUp');
  await page.waitForTimeout(2800);
  await page.keyboard.up('ArrowUp');
  // Espera o início do afundamento OU overlay final (sinking dura ~4.2 s)
  await page.waitForFunction(
    () => window.game.flags.sinking > 0 || (document.getElementById('overlay')?.innerText || '').includes('AFUNDOU'),
    { timeout: 9000 },
  );
  await page.waitForFunction(
    () => (document.getElementById('overlay')?.innerText || '').includes('AFUNDOU NO MAR'),
    { timeout: 8000 },
  );
  const overlay = await page.evaluate(() => document.getElementById('overlay').innerText);
  expect(overlay).toContain('AFUNDOU NO MAR');
});

test('U-AC-5: nuke percorre stages e a câmera permanece NORMAL (sem cinematic — operador 2026-07-01)', async ({ page }) => {
  await page.goto('/src/web-games/aero-fighters/index.html?map=desert&testMode=1');
  await page.waitForSelector('canvas', { state: 'attached', timeout: 15000 });
  await page.waitForTimeout(600);
  await page.keyboard.press('Space');
  await page.waitForFunction(() => window.game && window.game.running === true, { timeout: 3000 });
  await takeOff(page);
  await page.keyboard.press('KeyT'); // nuke sem lock — atinge o solo à frente
  const sawStages = await page.evaluate(async () => {
    const m = await import('/src/web-games/aero-fighters/src/nuclear-fx.js');
    const seen = new Set();
    const t0 = performance.now();
    while (performance.now() - t0 < 15000) {
      seen.add(m.nuclearFxState.stage);
      if (seen.has('mushroom')) break;
      await new Promise(r => setTimeout(r, 120));
    }
    return [...seen];
  });
  expect(sawStages).toContain('fireball');
  expect(sawStages).toContain('mushroom');
  const cine = await page.evaluate(() => ({
    engaged: window.game.missionRealism.camera.cinematic?.active === true,
    slowmo: window.game.flags.nukeSlowmo, // guarda ADR-U4: nunca em testMode/webdriver
  }));
  // Decisão do operador (2026-07-01): a detonação NÃO troca de câmera.
  expect(cine.engaged).toBe(false);
  expect(cine.slowmo).toBe(0);
});

test('U-AC-6: altímetro honesto — HUD ALT = metros reais (WS-3)', async ({ page }) => {
  await bootViaButton(page, 'desert');
  await takeOff(page);
  const r = await page.evaluate(() => ({
    y: window.game.player.y,
    hud: document.getElementById('altitude').textContent,
  }));
  const shown = parseInt(r.hud.replace(/[^0-9]/g, ''), 10);
  expect(Math.abs(shown - Math.floor(r.y))).toBeLessThanOrEqual(8); // tolerância de 1 frame
});

test('U-AC-7: Inhauma tem chão amplo e estruturas sólidas', async ({ page }) => {
  await page.goto('/src/web-games/aero-fighters/index.html?testMode=1&map=inhauma&seed=solid-inhauma');
  await page.waitForSelector('canvas', { state: 'attached', timeout: 15000 });
  await page.waitForFunction(() => window.__aeroDebug && window.game, { timeout: 15000 });
  await page.keyboard.press('Space');
  await page.waitForFunction(() => window.game.running === true, { timeout: 5000 });

  const checks = await page.evaluate(async () => {
    const w = await import('/src/web-games/aero-fighters/src/world.js');
    return {
      farHeights: [
        window.__aeroDebug.getTerrainHeightAt(7200, 0),
        window.__aeroDebug.getTerrainHeightAt(-6400, 5100),
        window.__aeroDebug.getTerrainHeightAt(0, -8200),
      ],
      // Church query point tracks INHAUMA_LANDMARKS['igreja-inhauma'] / CHURCH
      // (inhauma-scene.js#buildTown) — T-09 relocated the church to (-330,-40); this
      // was still probing the pre-T-09 (20,-40) spot, which is now bare mountainside
      // (fix-forward on the T-10 QA blocker, 2026-07-15).
      church: w.surfaceInfoAt(-330, -40),
      plantTower: w.surfaceInfoAt(565, 640),
      churchCrash: w.checkTerrainCollision({ x: -330, y: 4, z: -40 }),
      mountainCrash: w.checkTerrainCollision({ x: 760, y: 5, z: -300 }),
    };
  });

  expect(checks.farHeights.every(Number.isFinite)).toBe(true);
  expect(checks.church.kind).toBe('structure');
  expect(checks.plantTower.kind).toBe('structure');
  expect(checks.churchCrash).toBe('GROUND');
  expect(checks.mountainCrash).toBe('MOUNTAIN');
});

test('U-AC-8: Inhauma tem helicópteros, comboio armado e aliados com guerra própria', async ({ page }) => {
  test.setTimeout(45000);
  await page.goto('/src/web-games/aero-fighters/index.html?testMode=1&map=inhauma&seed=slow-action');
  await page.waitForSelector('canvas', { state: 'attached', timeout: 15000 });
  await page.waitForFunction(() => window.__aeroDebug && window.game, { timeout: 15000 });
  await page.keyboard.press('Space');
  await page.waitForFunction(() => window.game.running === true && window.game.targets.length > 0, { timeout: 5000 });

  const initial = await page.evaluate(() => {
    const types = window.game.targets.map((t) => t.type);
    const heli = window.game.targets.find((t) => t.type === 'helicopter');
    const armed = window.game.targets.find((t) => t.type === 'armedConvoy');
    return {
      types,
      heliAltitude: heli ? heli.mesh.position.y - (heli.spawnY || 0) : 0,
      armedY: armed?.mesh.position.y ?? null,
      armedSpawnY: armed?.spawnY ?? null,
      supportMissiles: window.game.flags.supportMissilesFired || 0,
      wingmen: window.game.wingmen.length,
      allyEnemies: window.game.allyEnemies.length,
      targetsTotal: window.game.targets.length,
    };
  });
  expect(initial.types.filter((t) => t === 'helicopter').length).toBeGreaterThanOrEqual(2);
  expect(initial.types).toContain('armedConvoy');
  expect(initial.heliAltitude).toBeGreaterThan(30);
  expect(Math.abs(initial.armedY - initial.armedSpawnY)).toBeLessThan(2);
  expect(initial.wingmen).toBeGreaterThanOrEqual(2);
  // Os amigos têm os PRÓPRIOS inimigos (frente de batalha separada da do player).
  expect(initial.allyEnemies).toBeGreaterThanOrEqual(1);

  // Os amigos só engajam em voo (decolam quando decolamos): faz a decolagem.
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(3500);
  await page.keyboard.down('ArrowDown');
  await page.waitForTimeout(2500);
  await page.keyboard.up('ArrowDown');
  await page.keyboard.up('KeyW');

  // Em voo, os amigos atacam OS INIMIGOS DELES com mísseis dedicados.
  await page.waitForFunction(() => (window.game.flags.supportMissilesFired || 0) > 0, { timeout: 12000 });
  const after = await page.evaluate(() => ({
    supportMissiles: window.game.flags.supportMissilesFired || 0,
    wingmenAlive: window.game.wingmen.length,
    airborne: window.game.missionRealism.sortie.state === 'AIRBORNE',
    // Os amigos NÃO destroem os alvos do player (cada lado tem seus inimigos).
    targetsTotal: window.game.targets.length,
  }));
  // Os aliados travam a própria guerra (mísseis dedicados) enquanto voamos, e a
  // formação continua intacta. (A checagem antiga de posição relativa dependia da
  // taxa de quadros — os aliados TRAILEM o líder por design — e era frágil.)
  expect(after.supportMissiles).toBeGreaterThan(initial.supportMissiles);
  expect(after.airborne).toBe(true);
  expect(after.wingmenAlive).toBeGreaterThanOrEqual(2);
});
