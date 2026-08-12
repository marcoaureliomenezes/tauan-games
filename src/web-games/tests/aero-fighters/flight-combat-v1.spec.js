// flight-combat-v1.spec.js — six-point acceptance smoke + rod e2e for release
// v0.2.12 (T-10, qa-engineer final gate).
//
// T-01 (v0.11.0, test lifecycle demotion): AC-01/AC-02/AC-04/AC-05/AC-06 deleted —
// each is already proven deterministically by tools/*.js (see the demotion map,
// §2.4): AC-01 -> test-aero-taxi-sim.js:40/:172/:188; AC-02 -> test-aero-unit.js:281
// + detents; AC-04 -> test-aero-sortie-sim.js:155/:404; AC-05 ->
// test-aero-weapons-sim.js:49/:64/:78 + test-aero-unit.js:65; AC-06 ->
// test-aero-sim.js:569. AC-07 keeps only its HUD residual (rod chain kills +
// cooldown-arm are proven by test-aero-weapons-sim.js:241/:256 + cooldowns.js).
//
// Node-level mechanics (80% hit-rule stats, rod-chain selection, nuke radii/timeline,
// taxi-containment, takeoff-jump bounds, throttle-stage boundaries) are already proven
// deterministically by tests/aero-fighters/tools/*.js (test:aero:sim + test:aero:unit).
// AC-03 (WebAudio graph + zero file/network fetch) cannot move to Node — it needs a
// real AudioContext and network interception, per the SPEC's own "Test" wording.

const { test, expect } = require('@playwright/test');

test.setTimeout(120000); // teto de wall clock p/ game time lento sob load alto (2026-07-21)

// Init real dos módulos ES (mesmo contrato do smoke.spec.js AC-2).
function modulesLoaded(page, timeout = 15000) {
  return page.waitForFunction(
    () => typeof window.game !== 'undefined'
       && typeof window.game.flags?.rollTimer === 'number'
       && typeof window.game.running === 'boolean',
    { timeout },
  );
}

async function startGame(page) {
  await page.goto('/src/web-games/aero-fighters/index.html');
  await page.waitForSelector('canvas', { state: 'attached', timeout: 120000 });
  await modulesLoaded(page);
  await page.keyboard.press('Space');
  await page.waitForFunction(() => window.game && window.game.running === true, { timeout: 3000 });
  // Polling da máquina de surtida engatada (MENU -> TAXI_OUT, missions.js#startMission)
  await page.waitForFunction(
    () => window.game.missionRealism && window.game.missionRealism.sortie.state !== 'MENU',
    { timeout: 4000 },
  );
}

// ─── AC-03 (D-7): turbine engine synth — swept-bandpass noise core + detuned
// whine oscillator layer, 100% synthesized (no file/network fetch) ─────────────
test('T-10/AC-03: turbine engine audio graph builds with core+whine composition, no file/network fetch, RPM follows throttle', async ({ page }) => {
  const audioFileRequests = [];
  page.on('request', (req) => {
    if (/\.(mp3|wav|ogg|m4a|flac)(\?|$)/i.test(req.url())) audioFileRequests.push(req.url());
  });

  await startGame(page);

  const graph = await page.evaluate(async () => {
    const { audio } = await import('/src/web-games/aero-fighters/src/audio.js');
    return {
      hasCore: !!audio.engineCoreNoise,
      whineCount: audio.engineWhineOscs ? audio.engineWhineOscs.length : 0,
      coreFilterType: audio.engineCoreFilter?.type,
      whineFilterType: audio.engineWhineFilter?.type,
      lowpassType: audio.engineCoreLowpass?.type,
      coreFreq0: audio.engineCoreFilter?.frequency.value,
    };
  });
  expect(graph.hasCore).toBe(true);
  expect(graph.whineCount).toBeGreaterThanOrEqual(2); // "2-3 detuned oscillators" (D-7)
  expect(graph.coreFilterType).toBe('bandpass');
  expect(graph.whineFilterType).toBe('bandpass');
  expect(graph.lowpassType).toBe('lowpass');
  expect(audioFileRequests).toHaveLength(0); // 100% synthesized, no audio files

  // T-08 finding: setEngineRPM is only reached from the AIRBORNE branch — take off
  // before asserting the sweep follows throttle/speed.
  await page.keyboard.down('KeyW');
  // T-07: polling da velocidade de rotação (ROTATION_SPEED=38, ground-physics.js)
  await page.waitForFunction(() => window.game.player.speed >= 38, { timeout: 15000 });
  await page.keyboard.down('ArrowDown');
  await page.waitForFunction(() => window.game.missionRealism.sortie.state === 'AIRBORNE', { timeout: 8000 }).catch(() => {});
  // T-07: polling da varredura real do bandpass (sobe com RPM/throttle no ramo AIRBORNE).
  // .catch preserva a asserção abaixo como ponto de falha (mesmo contrato anterior).
  await page.waitForFunction(async (f0) => {
    const { audio } = await import('/src/web-games/aero-fighters/src/audio.js');
    return (audio.engineCoreFilter?.frequency.value ?? 0) > f0;
  }, graph.coreFreq0, { timeout: 6000 }).catch(() => {});
  await page.keyboard.up('ArrowDown');
  await page.keyboard.up('KeyW');

  const swept = await page.evaluate(async () => {
    const { audio } = await import('/src/web-games/aero-fighters/src/audio.js');
    return audio.engineCoreFilter?.frequency.value;
  });
  expect(swept).toBeGreaterThan(graph.coreFreq0); // bandpass center swept up with RPM/throttle
});

// ─── AC-07 (D-3) residual: HUD ROD count label — the rod-chain-kills/cooldown-arm
// behavior itself is Node-covered (test-aero-weapons-sim.js:241/:256); this keeps
// only the observable Node cannot reach: the real HUD text in a running browser. ──
test('T-10/AC-07: rod HUD displays the R ROD: label', async ({ page }) => {
  await startGame(page);
  const hud = await page.evaluate(() => document.getElementById('rod-missiles').textContent);
  expect(hud).toContain('R ROD:');
});
