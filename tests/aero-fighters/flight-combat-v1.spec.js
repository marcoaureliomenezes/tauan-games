// flight-combat-v1.spec.js — six-point acceptance smoke + rod e2e for release
// aero-fighters-flight-combat-v1 (T-10, qa-engineer final gate).
//
// Mirrors the existing smoke.spec.js/uplift.spec.js/nuclear-fx.spec.js convention:
// dynamic `import()` of the real ES modules served by the static dev server to reach
// module-scope singletons (`jet`, `scene`, `audio`) that are not exposed on `window`,
// same technique already used by nuclear-fx.spec.js (`import('/aero-fighters/src/nuclear-fx.js')`)
// and uplift.spec.js (`import('/aero-fighters/src/world.js')`).
//
// Node-level mechanics (80% hit-rule stats, rod-chain selection, nuke radii/timeline,
// taxi-containment, takeoff-jump bounds, throttle-stage boundaries) are already proven
// deterministically by tests/aero-fighters/tools/*.js (test:aero:sim + test:aero:unit).
// This file only smoke-checks the OBSERVABLE behavior in a real browser tick, per the
// SPEC's own "Test" wording for each AC.

const { test, expect } = require('@playwright/test');

async function startGame(page) {
  await page.goto('/aero-fighters/index.html');
  await page.waitForSelector('canvas', { state: 'attached', timeout: 15000 });
  await page.waitForTimeout(800);
  await page.keyboard.press('Space');
  await page.waitForFunction(() => window.game && window.game.running === true, { timeout: 3000 });
  await page.waitForTimeout(400);
}

// ─── AC-01 (D-4): roll-out keeps the player in control and on pavement; guided
// taxi arms only at/under TAXI_HANDOFF_SPEED on paved surface ──────────────────
test('T-10/AC-01: roll-out stays on pavement; guided taxi arms only at handoff speed on paved surface', async ({ page }) => {
  await page.goto('/aero-fighters/index.html?testMode=1&map=inhauma&seed=qa-rollout');
  await page.waitForSelector('canvas', { state: 'attached', timeout: 15000 });
  await page.waitForFunction(() => window.__aeroDebug && window.game, { timeout: 15000 });
  await page.keyboard.press('Space');
  await page.waitForFunction(() => window.game.running === true, { timeout: 5000 });

  // Arm the SAME ground-block code path a real touchdown reaches (player.js
  // updatePlayer, GROUND_STATES.has(LANDING_ROLL)) — fast, low-throttle, positioned
  // on the Inhaúma touchdown zone (runway center x=-560, touchdown z-range [60,220],
  // landing direction north->south / increasing z — per T-04 handoff geometry facts).
  await page.evaluate(async () => {
    const { jet } = await import('/aero-fighters/src/player.js');
    const mr = window.game.missionRealism;
    mr.sortie.state = 'LANDING_ROLL';
    mr.autoTaxi.active = false;
    mr.autoTaxi.phase = 'idle';
    mr.ground.groundSpeed = 55;
    window.game.player.throttle = 0.05; // idle — spools down naturally, no throttle input
    window.game.player.speed = 55;
    jet.position.set(-560, 5, 100);
    jet.quaternion.set(0, 1, 0, 0); // face +z (south) toward taxiway/apron, 180deg from default -z forward
  });

  const result = await page.evaluate(async () => {
    const { airportSurface } = await import('/aero-fighters/src/landing-zones.js');
    const samples = [];
    let handoffSpeed = null;
    const t0 = performance.now();
    while (performance.now() - t0 < 8000) {
      const p = { x: window.game.player.x, z: window.game.player.pz };
      const surface = airportSurface(p, 'inhauma');
      const autoActive = window.game.missionRealism.autoTaxi.active;
      const speed = window.game.player.speed;
      samples.push({ surface, autoActive, speed });
      if (autoActive && handoffSpeed === null) handoffSpeed = speed;
      if (autoActive) break;
      await new Promise((r) => setTimeout(r, 80));
    }
    return { samples, handoffSpeed };
  });

  expect(result.samples.length).toBeGreaterThan(3);
  // Never off-pavement (AC-01: airportSurface is never 'none' at any sample).
  expect(result.samples.every((s) => s.surface !== 'none')).toBe(true);
  // Never captured (auto-taxi armed) while still going faster than the handoff speed.
  const capturedWhileFast = result.samples.filter((s) => s.speed > 34).some((s) => s.autoActive);
  expect(capturedWhileFast).toBe(false);
  // Handoff eventually fires, and only at/under the threshold.
  expect(result.handoffSpeed).not.toBeNull();
  expect(result.handoffSpeed).toBeLessThanOrEqual(34);
});

// ─── AC-02 (D-6): throttle detents + afterburner plume gated at military+, largest
// at afterburner ─────────────────────────────────────────────────────────────
test('T-10/AC-02: afterburner plume is hidden at idle, visible+scaled-up at full throttle', async ({ page }) => {
  await startGame(page);

  const idle = await page.evaluate(async () => {
    const { jet } = await import('/aero-fighters/src/player.js');
    return {
      throttle: window.game.player.throttle,
      visible: jet.userData.afterburnerPlume.visible,
      scaleX: jet.userData.afterburnerPlume.scale.x,
    };
  });
  expect(idle.throttle).toBeLessThanOrEqual(0.10); // idle detent (config.js THROTTLE_IDLE_MAX)
  expect(idle.visible).toBe(false);

  // Ramp throttle to afterburner (>0.80) via sustained W.
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(3200);
  await page.keyboard.up('KeyW');

  const full = await page.evaluate(async () => {
    const { jet } = await import('/aero-fighters/src/player.js');
    return {
      throttle: window.game.player.throttle,
      visible: jet.userData.afterburnerPlume.visible,
      scaleX: jet.userData.afterburnerPlume.scale.x,
    };
  });
  expect(full.throttle).toBeGreaterThan(0.80); // afterburner detent
  expect(full.visible).toBe(true);
  expect(full.scaleX).toBeGreaterThan(idle.scaleX); // AC-02: plume scale at afterburner > at idle
});

// ─── AC-03 (D-7): turbine engine synth — swept-bandpass noise core + detuned
// whine oscillator layer, 100% synthesized (no file/network fetch) ─────────────
test('T-10/AC-03: turbine engine audio graph builds with core+whine composition, no file/network fetch, RPM follows throttle', async ({ page }) => {
  const audioFileRequests = [];
  page.on('request', (req) => {
    if (/\.(mp3|wav|ogg|m4a|flac)(\?|$)/i.test(req.url())) audioFileRequests.push(req.url());
  });

  await startGame(page);

  const graph = await page.evaluate(async () => {
    const { audio } = await import('/aero-fighters/src/audio.js');
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
  await page.waitForTimeout(3600);
  await page.keyboard.down('ArrowDown');
  await page.waitForFunction(() => window.game.missionRealism.sortie.state === 'AIRBORNE', { timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(1500);
  await page.keyboard.up('ArrowDown');
  await page.keyboard.up('KeyW');

  const swept = await page.evaluate(async () => {
    const { audio } = await import('/aero-fighters/src/audio.js');
    return audio.engineCoreFilter?.frequency.value;
  });
  expect(swept).toBeGreaterThan(graph.coreFreq0); // bandpass center swept up with RPM/throttle
});

// ─── AC-04: smooth takeoff — no instant altitude/position jump; legal sortie-state
// sequence (no skip/revert) ──────────────────────────────────────────────────
test('T-10/AC-04: takeoff roll->rotation->liftoff has no single-sample position/altitude jump, sortie state advances in legal order', async ({ page }) => {
  await startGame(page);

  // Sample every ~100ms while driving a real takeoff (mirrors smoke.spec.js AC-4/AC-6).
  const samplePromise = page.evaluate(async () => {
    const samples = [];
    const t0 = performance.now();
    while (performance.now() - t0 < 6000) {
      samples.push({
        t: performance.now(),
        y: window.game.player.y,
        z: window.game.player.pz,
        pitch: window.game.player.pitch,
        state: window.game.missionRealism.sortie.state,
      });
      if (window.game.missionRealism.sortie.state === 'AIRBORNE' && samples.length > 5) break;
      await new Promise((r) => setTimeout(r, 100));
    }
    return samples;
  });
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(3600);
  await page.keyboard.down('ArrowDown');
  await page.waitForTimeout(2200);
  await page.keyboard.up('ArrowDown');
  await page.keyboard.up('KeyW');
  const samples = await samplePromise;

  expect(samples.length).toBeGreaterThan(5);

  // No single-sample altitude jump (teleport-y hand-off).
  for (let i = 1; i < samples.length; i++) {
    const dy = Math.abs(samples[i].y - samples[i - 1].y);
    expect(dy).toBeLessThan(6); // generous bound for a 100ms sample under headless jitter
  }

  // Legal, non-reverting sortie-state order: TAXI_OUT/TAKEOFF_ROLL -> AIRBORNE, never backward.
  const RANK = { MENU: 0, TAXI_OUT: 1, TAKEOFF_ROLL: 2, AIRBORNE: 3, MISSION_ACTIVE: 4 };
  let maxRank = -1;
  for (const s of samples) {
    const r = RANK[s.state] ?? maxRank;
    expect(r).toBeGreaterThanOrEqual(maxRank); // never reverts to an earlier stage
    maxRank = Math.max(maxRank, r);
  }
  expect(samples[samples.length - 1].state).toBe('AIRBORNE');
});

// Static (non-patrolling) target types — targets.js only calls a movement updater
// for 'helicopter'/'tank'/'patrolAir' (updateHelicopter/updateTank/updatePatrolAir in
// updateTargets); every other type is position-fixed once spawned. Repositioning a
// moving type is overwritten the very next tick by its own waypoint AI (discovered via
// a throwaway diagnostic run against game.targets[0], which turned out to be a patrol
// unit — position snapped to (-360,-10,-580) one frame after being set to the intended
// spot). Tests that manually place a target MUST pick from this set.
const STATIC_TARGET_TYPES = ['base', 'factory', 'building', 'convoy', 'armedConvoy', 'aaGun'];

async function pickStaticTargets(page, count) {
  await page.waitForFunction(
    ({ types, n }) => window.game.targets.filter((t) => types.includes(t.type)).length >= n,
    { types: STATIC_TARGET_TYPES, n: count },
    { timeout: 8000 },
  );
  await page.evaluate((types) => {
    window.__qaStatic = window.game.targets.filter((t) => types.includes(t.type));
  }, STATIC_TARGET_TYPES);
}

// ─── AC-05 (D-1): guided missile visibly persists + curves (homing) and, with a
// forced-HIT seeded roll, guarantees terminal intercept damage ─────────────────
test('T-10/AC-05: guided missile (forced HIT) persists, curves via homing, and guarantees intercept damage', async ({ page }) => {
  await startGame(page);
  await pickStaticTargets(page, 1);
  // Deterministic HIT: rollMissileHit does `rng.random() < 0.80` — 0 is always < 0.80.
  await page.evaluate(() => { window.game.rng = { random: () => 0 }; });
  await page.evaluate(() => {
    const t = window.__qaStatic[0];
    t.mesh.position.set(window.game.player.x + 60, window.game.player.y + 2, window.game.player.pz - 260);
    t.dead = false;
    t.hp = 1; // one confirmed hit (MISSILES_LIGHT.DAMAGE=4) must kill it — proves "damages" (D-1), not just "hits"
  });
  await page.waitForTimeout(550); // lock-on window (0.35s + margin)

  const before = await page.evaluate(async () => {
    const { scene } = await import('/aero-fighters/src/scene.js');
    return scene.children.length;
  });
  await page.keyboard.press('KeyX');
  await page.waitForTimeout(80);
  const idx = await page.evaluate(async (beforeCount) => beforeCount, before);

  const samples = await page.evaluate(async (idx) => {
    const { scene } = await import('/aero-fighters/src/scene.js');
    const pts = [];
    const t0 = performance.now();
    while (performance.now() - t0 < 3000) {
      if (window.__qaStatic[0]?.dead) break; // stop before impact removes the mesh (index shift)
      const m = scene.children[idx];
      if (!m) break;
      pts.push({ x: m.position.x, y: m.position.y, z: m.position.z });
      await new Promise((r) => setTimeout(r, 80));
    }
    return pts;
  }, idx);

  expect(samples.length).toBeGreaterThan(2);
  const first = samples[0], last = samples[samples.length - 1];
  const dz = Math.abs(last.z - first.z);
  expect(dz).toBeGreaterThan(3); // persists and moves across samples (not despawned/frozen)
  // Curve check (geometric, not orientation-based): a homing pursuit deviates from the
  // straight line connecting the first and last sampled point; a straight/ballistic shot
  // would keep every midpoint on that line (perpendicular deviation ~0).
  const dx = last.x - first.x, ddz = last.z - first.z;
  const lineLen = Math.hypot(dx, ddz) || 1;
  let maxDeviation = 0;
  for (const p of samples) {
    const t = ((p.x - first.x) * dx + (p.z - first.z) * ddz) / (lineLen * lineLen);
    const projX = first.x + t * dx, projZ = first.z + t * ddz;
    maxDeviation = Math.max(maxDeviation, Math.hypot(p.x - projX, p.z - projZ));
  }
  // A homing pursuit continuously re-aims (lerp toward the target each frame, D-1/D-2)
  // and therefore never sits exactly on the straight first->last line, unlike a fixed-
  // heading ballistic shot (which would measure exactly 0 deviation, module float noise).
  expect(maxDeviation).toBeGreaterThan(1e-5);

  const dead = await page.waitForFunction(() => window.__qaStatic[0]?.dead === true, { timeout: 8000 })
    .then(() => true).catch(() => false);
  expect(dead).toBe(true); // forced-HIT roll guarantees terminal intercept damage
});

// ─── AC-06 (D-8/D-9): nuke destroys a target within the new BLAST_RADIUS in the
// real browser (radii/timeline/no-overshoot already covered by nuclear-fx.spec.js
// and uplift.spec.js U-AC-5; this closes the real-fire destruction-at-range gap) ──
test('T-10/AC-06: firing the nuke on a locked target within BLAST_RADIUS destroys it', async ({ page }) => {
  await startGame(page);
  await pickStaticTargets(page, 1);
  await page.evaluate(() => {
    const t = window.__qaStatic[0];
    // Well inside the new 760m BLAST_RADIUS, on the player's boresight for lock-on.
    t.mesh.position.set(window.game.player.x, window.game.player.y, window.game.player.pz - 300);
    t.dead = false;
    t.hp = t.maxHp ?? 10;
  });
  await page.waitForTimeout(550); // lock-on
  await page.keyboard.press('KeyT');
  const dead = await page.waitForFunction(() => window.__qaStatic[0]?.dead === true, { timeout: 10000 })
    .then(() => true).catch(() => false);
  expect(dead).toBe(true);
});

// ─── AC-07 (D-3): rod (R) — permanent e2e (flagged gap from the Lane C handoff) —
// fires without lock, chains kills on clustered targets, ammo decrements once per
// launch (not per kill), HUD ROD count updates ─────────────────────────────────
test('T-10/AC-07: rod (R) chains kills on clustered targets, decrements ammo once per launch, updates HUD ROD count', async ({ page }) => {
  await startGame(page);
  await pickStaticTargets(page, 3);

  await page.evaluate(() => {
    const p = window.game.player;
    const positions = [
      { x: p.x, y: p.y, z: p.pz - 80 },
      { x: p.x + 12, y: p.y, z: p.pz - 95 },
      { x: p.x - 12, y: p.y, z: p.pz - 105 },
    ];
    for (let i = 0; i < 3; i++) {
      const t = window.__qaStatic[i];
      t.mesh.position.set(positions[i].x, positions[i].y, positions[i].z);
      t.dead = false;
      t.hp = t.maxHp ?? 10;
    }
  });

  const before = await page.evaluate(() => window.game.player.rodMissiles);
  await page.keyboard.press('KeyR');

  await page.waitForFunction(
    () => window.__qaStatic.slice(0, 3).every((t) => t.dead === true),
    { timeout: 8000 },
  );

  const after = await page.evaluate(() => window.game.player.rodMissiles);
  expect(after).toBe(before - 1); // ammo decrements ONCE per launch, not per kill

  const hud = await page.evaluate(() => document.getElementById('rod-missiles').textContent);
  expect(hud).toContain(String(after));
});
