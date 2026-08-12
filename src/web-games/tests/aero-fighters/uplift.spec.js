// uplift.spec.js — ACs da release v0.1.0 (WS-1..WS-6).
// Cobre: liftoff nos mapas VIA BOTÃO (CRIT-1/CRIT-2b), verdade de superfície
// terra/água (HIGH-3), afundamento na água (WS-5), nuke stages (WS-6) e
// altímetro honesto (WS-3).
//
// T-01 (v0.11.0, test lifecycle demotion): U-AC-1 reduced from 4 maps to 2
// (desert + inhauma — one legacy-layout map, one campaign map; islands/rio
// dropped as redundant boots of the same button->takeoff path). U-AC-3
// ("floor-glue morto") deleted — the state-machine-liveness half of the
// invariant is proven by tools/test-aero-sortie-sim.js's new U-AC-3 test
// (diving onto the runway from RETURN_TO_BASE always resolves TOUCHDOWN_SAFE).
// U-AC-5 reduced to its camera-state residual — the nuke stage timeline itself
// is proven by tools/test-aero-sim.js:582. U-AC-8 deleted — proven verbatim by
// tools/test-aero-visual.mjs:133 ("wingman quebra formação p/ hostil aéreo...").

const { test, expect } = require('@playwright/test');

const MAP_BUTTONS = {
  islands: 'MAR DO SUL',
  desert: 'DESERTO',
  rio: 'RIO DE JANEIRO',
  inhauma: 'INHAUMA',
};

// T-01 (v0.11.0): U-AC-1 only exercises 2 of the 4 buttons (desert — legacy
// layout map — and inhauma — campaign map) since every button drives the exact
// same click->takeoff path; islands/rio would be redundant boots. U-AC-4/U-AC-6
// below still use the full MAP_BUTTONS map via bootViaButton (islands, desert).
const UPLIFT_MAP_KEYS = ['desert', 'inhauma'];

// T-07 (v0.10.0) — sleeps fixos convertidos em waitForFunction sobre estado real do
// jogo. Mantidos de propósito (justificativa inline em cada um):
//   takeOff 400ms        — duração deliberada: mantém nariz para cima através da transição de liftoff
//   U-AC-4 3200/2800ms   — durações deliberadas de voo/mergulho até o corredor de mar aberto e o impacto
//                          (o resultado já é gated pelos waitForFunction de sinking/overlay logo abaixo)

// Init real dos módulos ES (mesmo contrato do smoke.spec.js AC-2): substitui sleeps de load.
function modulesLoaded(page, timeout = 15000) {
  return page.waitForFunction(
    () => typeof window.game !== 'undefined'
       && typeof window.game.flags?.rollTimer === 'number'
       && typeof window.game.running === 'boolean',
    { timeout },
  );
}

async function bootViaButton(page, mapKey) {
  await page.goto('/src/web-games/aero-fighters/index.html');
  await page.waitForSelector('canvas', { state: 'attached', timeout: 120000 });
  await modulesLoaded(page);
  await page.click(`text=${MAP_BUTTONS[mapKey]}`);
  // T-07: polling da seleção real do mapa em vez de janela fixa pós-clique
  await page.waitForFunction((m) => window.game.activeMap === m, mapKey, { timeout: 5000 });
  await page.keyboard.press('Space');
  await page.waitForFunction(() => window.game && window.game.running === true, { timeout: 3000 });
}

async function takeOff(page) {
  await page.keyboard.down('KeyW');
  // T-07: polling da velocidade de rotação (ROTATION_SPEED=38, ground-physics.js)
  await page.waitForFunction(() => window.game.player.speed >= 38, { timeout: 17000 });
  await page.keyboard.down('ArrowDown');
  await page.waitForFunction(
    () => window.game.missionRealism.sortie.state === 'AIRBORNE',
    { timeout: 8000 },
  ).catch(() => {});
  // T-07 KEPT: duração deliberada da ação — mantém a entrada de nariz para cima
  // através da transição de liftoff (parte da manobra, não espera por estado).
  await page.waitForTimeout(400);
  await page.keyboard.up('ArrowDown');
  await page.keyboard.up('KeyW');
}

test.describe('Uplift — decolagem via botão (ADR-U2, CRIT-1/2b)', () => {
  for (const mapKey of UPLIFT_MAP_KEYS) {
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
  await page.waitForSelector('canvas', { state: 'attached', timeout: 120000 });
  // T-07: polling do init real dos módulos (window.game) em vez de sleep fixo
  await modulesLoaded(page);
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

// T-01 (v0.11.0, test lifecycle demotion): U-AC-3 ("floor-glue morto") deleted —
// the state-machine-liveness half of the invariant (dive onto the runway always
// resolves the touchdown gate, never gets stuck in AIRBORNE) is now proven by
// tools/test-aero-sortie-sim.js's new U-AC-3 test, driving the exact same
// production evaluateLandingEnvelope/transitionSortie functions.

test('U-AC-4: impacto na água afunda e reporta AFUNDOU NO MAR (WS-5)', async ({ page }) => {
  await bootViaButton(page, 'islands');
  await takeOff(page);
  // Voa reto além do fim da pista (corredor z<-260 é mar aberto) e então mergulha.
  // (Bancar antes de mergulhar não funciona: com a asa rolada, pitch local vira curva.)
  // T-07 KEPT (3200ms + 2800ms): durações deliberadas de voo/mergulho — cobrir o
  // corredor de mar aberto e descer até o impacto leva tempo de voo real (a posição
  // exata depende do heading pós-decolagem); o desfecho já é gated pelos
  // waitForFunction de sinking/overlay logo abaixo.
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

// U-AC-5 (T-01 demotion): the stage-progression timeline (flash->fireball->
// mushroom, bounded fireball radius, monotonic plume) is proven Node-side by
// tools/test-aero-sim.js:582. This residual keeps only the observable Node
// cannot reach: that a REAL in-browser nuke detonation never engages the
// cinematic camera (operator decision 2026-07-01).
test('U-AC-5: nuke detonation never engages the cinematic camera (operator decision 2026-07-01)', async ({ page }) => {
  await page.goto('/src/web-games/aero-fighters/index.html?map=desert&testMode=1');
  await page.waitForSelector('canvas', { state: 'attached', timeout: 120000 });
  // T-07: polling do init real dos módulos (window.game) em vez de sleep fixo
  await modulesLoaded(page);
  await page.keyboard.press('Space');
  await page.waitForFunction(() => window.game && window.game.running === true, { timeout: 3000 });
  await takeOff(page);
  await page.keyboard.press('KeyT'); // nuke sem lock — atinge o solo à frente
  // Aguarda a detonação realmente começar (sai de 'idle') antes de checar a
  // câmera — a progressão de stages em si é Node-covered (test-aero-sim.js:582).
  await page.waitForFunction(async () => {
    const m = await import('/src/web-games/aero-fighters/src/nuclear-fx.js');
    return m.nuclearFxState.stage !== 'idle';
  }, { timeout: 5000 });
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
  await page.waitForSelector('canvas', { state: 'attached', timeout: 120000 });
  await page.waitForFunction(() => window.__aeroDebug && window.game, { timeout: 120000 });
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

// T-01 (v0.11.0, test lifecycle demotion): U-AC-8 deleted — proven verbatim by
// tools/test-aero-visual.mjs:133 ("T-C-13(d): wingman quebra formação p/ hostil
// aéreo perto do player e retorna após o kill"), which drives the exact same
// wingmen.js#updateWingmen engage/hysteresis/return logic this E2E re-checked.
