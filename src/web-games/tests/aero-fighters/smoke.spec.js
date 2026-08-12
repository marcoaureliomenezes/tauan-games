const { test, expect } = require('@playwright/test');

// T-07 (v0.10.0) — sleeps fixos convertidos em waitForFunction sobre estado real do
// jogo. Mantidos de propósito (justificativa inline em cada um):
//   AC-6b 5200ms — duração deliberada da entrada sustentada de climb (a janela É o estímulo)
//   AC-11 200ms  — janela de estabilidade: prova que o disparo NÃO decrementa (condição negativa)
//   AC-15 600ms  — janela de estabilidade: prova que o barrel roll NÃO crasha
//   AC-17 300ms  — settle curto do loop/HUD antes de forçar lives=0
//   AC-18 8000ms — janela de medição: taxa de FPS sobre exatamente 8 s

// Init real dos módulos ES (mesmo contrato do AC-2): substitui sleeps de "load settle".
function modulesLoaded(page, timeout = 15000) {
  return page.waitForFunction(
    () => typeof window.game !== 'undefined'
       && typeof window.game.flags?.rollTimer === 'number'
       && typeof window.game.running === 'boolean',
    { timeout },
  );
}

// Helper: navigate, wait for canvas, start game
async function startGame(page) {
  await page.goto('/src/web-games/aero-fighters/index.html');
  // Timeout tolerante: shader compilation de PBR + shadow map demora no primeiro frame
  await page.waitForSelector('canvas', { state: 'attached', timeout: 15000 });
  await modulesLoaded(page);
  await page.keyboard.press('Space');
  await page.waitForFunction(() => window.game && window.game.running === true, { timeout: 3000 });
  // Polling da máquina de surtida engatada (MENU -> TAXI_OUT, missions.js#startMission)
  await page.waitForFunction(
    () => window.game.missionRealism && window.game.missionRealism.sortie.state !== 'MENU',
    { timeout: 4000 },
  );
}

// Polling da velocidade de rotação (ROTATION_SPEED=38, ground-physics.js) — substitui
// as esperas fixas de "ganhar velocidade" antes de puxar ↓/↑.
function waitRotationSpeed(page, timeout = 15000) {
  return page.waitForFunction(() => window.game.player.speed >= 38, { timeout });
}

test.describe('Aero Fighters — Smoke Suite', () => {

  // AC-1: canvas renders
  test('AC-1: 3D canvas renders with visible pixels', async ({ page }) => {
    await page.goto('/src/web-games/aero-fighters/index.html');
    await page.waitForSelector('canvas', { state: 'attached', timeout: 15000 });
    await modulesLoaded(page);
    const shot = await page.screenshot();
    const nonZero = shot.some((b, i) => i > 100 && b !== 0);
    expect(nonZero).toBe(true);
  });

  // AC-2: no JS errors on load
  test('AC-2: no console errors on load', async ({ page }) => {
    const errors = [];
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', e => errors.push(e.message));
    await page.goto('/src/web-games/aero-fighters/index.html');
    // Wait until all ES modules have initialized:
    //   - window.game defined (state.js)
    //   - game.flags.rollTimer defined (player.js, last game module to import)
    //   - game.running is a boolean (main.js fully executed and tick() started)
    // This replaces the unconditional waitForTimeout(4000).
    // Timeout 15000ms to detect real load failures without masking them.
    await page.waitForFunction(
      () => typeof window.game !== 'undefined'
         && typeof window.game.flags?.rollTimer === 'number'
         && typeof window.game.running === 'boolean',
      { timeout: 15000 },
    );
    expect(errors).toHaveLength(0);
  });

  // AC-3 (2026-08-11, armas por CADÊNCIA): o míssil leve segue infinito, mas o
  // contrato do HUD mudou — mostra o estado de recarga ("X MSL: ✓" pronto, ou a
  // contagem em segundos). player.missiles continua um valor fixo de exibição
  // (100), nunca decrementado; a cadência vem de weapon-cooldowns.js (X 0.2 s).
  test('AC-3: light missiles are infinite — HUD shows cooldown state and display value stays 100', async ({ page }) => {
    await page.goto('/src/web-games/aero-fighters/index.html');
    // T-07: polling do estado real (player + cooldowns prontos) em vez de sleep fixo
    await page.waitForFunction(() => window.game?.player?.weaponCooldowns, { timeout: 8000 });
    const missiles = await page.evaluate(() => window.game?.player?.missiles);
    expect(missiles).toBe(100); // valor fixo de exibição — cadência limita, não munição
    const cd = await page.evaluate(() => window.game?.player?.weaponCooldowns);
    expect(cd).toBeTruthy();
    expect(cd.light).toBe(0); // nasce pronta
    const hud = await page.evaluate(() => document.getElementById('missiles').textContent);
    expect(hud).toContain('X MSL:');
  });

  // AC-4: ArrowDown rotates after takeoff speed — jet lifts from runway
  test('AC-4: ArrowDown rotates after takeoff speed — jet lifts from runway', async ({ page }) => {
    await startGame(page);
    const yBefore = await page.evaluate(() => window.game.player.y);
    await page.keyboard.down('KeyW');
    await waitRotationSpeed(page);
    await page.keyboard.down('ArrowDown');
    // T-07: polling do liftoff real (mesmo padrão do AC-5) em vez de segurar ↓ por tempo fixo
    await page.waitForFunction(
      () => window.game.missionRealism.sortie.state === 'AIRBORNE',
      { timeout: 7000 },
    );
    await page.keyboard.up('ArrowDown');
    await page.keyboard.up('KeyW');
    const yAfter = await page.evaluate(() => window.game.player.y);
    expect(yAfter).toBeGreaterThan(yBefore);
  });

  // AC-5 (ADR-U1, v0.1.0): no SOLO a intenção "subir" é inequívoca —
  // ↑ OU ↓ rotacionam e decolam. (Substitui o contrato antigo em que ↑ não decolava.)
  test('AC-5: ArrowUp rotates and lifts off during takeoff roll (ADR-U1)', async ({ page }) => {
    await startGame(page);
    const yBefore = await page.evaluate(() => window.game.player.y);
    await page.keyboard.down('KeyW');
    // espera ganhar velocidade de rotação antes de puxar (mesma janela do AC-4)
    await waitRotationSpeed(page);
    await page.keyboard.down('ArrowUp');
    // solta ↑ no instante do liftoff: em VOO o esquema invertido vale (↑ = nariz
    // para baixo) — segurar mergulharia de volta na pista
    await page.waitForFunction(
      () => window.game.missionRealism.sortie.state === 'AIRBORNE',
      { timeout: 7000 },
    );
    await page.keyboard.up('ArrowUp');
    // T-07: polling do ganho real de altitude pós-liftoff em vez de settle fixo
    await page.waitForFunction((yb) => window.game.player.y > yb + 2, yBefore, { timeout: 4000 });
    await page.keyboard.up('KeyW');
    const result = await page.evaluate(() => ({
      running: window.game.running && !window.game.player.dead,
      y: window.game.player.y,
    }));
    expect(result.y).toBeGreaterThan(yBefore + 2);
    expect(result.running).toBe(true);
  });

  // AC-6: jet can take off and survive initial climb
  test('AC-6: jet survives runway takeoff and initial climb', async ({ page }) => {
    await startGame(page);
    await page.keyboard.down('KeyW');     // full throttle
    await waitRotationSpeed(page, 12000);
    await page.keyboard.down('ArrowDown'); // pull back hard (nose up = climb)
    // T-07: polling do liftoff + altitude real (>3 m, a própria condição assertada)
    // em vez de segurar ↓ por tempo fixo — timeout detecta stall/crash de verdade
    await page.waitForFunction(
      () => window.game.missionRealism.sortie.state === 'AIRBORNE' && window.game.player.y > 3,
      { timeout: 9000 },
    );
    await page.keyboard.up('ArrowDown');
    await page.keyboard.up('KeyW');
    const alive = await page.evaluate(() => !window.game.player.dead && window.game.running);
    expect(alive).toBe(true);
    const alt = await page.evaluate(() => window.game.player.y);
    expect(alt).toBeGreaterThan(3);
  });

  // AC-6b: sustained climb input stays inside a playable pitch envelope
  test('AC-6b: sustained climb input does not flip into vertical dive', async ({ page }) => {
    await startGame(page);
    await page.keyboard.down('KeyW');
    await waitRotationSpeed(page);
    await page.keyboard.down('ArrowDown');
    // T-07 KEPT: duração deliberada da ação testada — "sustained climb input":
    // a janela longa sob entrada contínua é o próprio estímulo cujo envelope de
    // pitch está sob teste (condição temporal, não espera ociosa por estado).
    await page.waitForTimeout(5200);
    await page.keyboard.up('ArrowDown');
    await page.keyboard.up('KeyW');
    const s = await page.evaluate(() => ({
      running: window.game.running && !window.game.player.dead,
      y: window.game.player.y,
      pitch: window.game.player.pitch,
    }));
    expect(s.y).toBeGreaterThan(3);
    expect(s.pitch).toBeLessThan(1.0);
    expect(s.pitch).toBeGreaterThan(-0.95);
    expect(s.running).toBeTruthy();
  });

  // AC-7: ArrowLeft steers on ground / rolls in flight and changes heading
  test('AC-7: ArrowLeft steers and changes x position', async ({ page }) => {
    await startGame(page);
    const xBefore = await page.evaluate(() => window.game.player.x);
    await page.keyboard.down('KeyW');
    await page.keyboard.down('ArrowLeft');
    // T-07: polling do deslocamento lateral real em vez de janela fixa
    await page.waitForFunction((x0) => Math.abs(window.game.player.x - x0) > 0.5, xBefore, { timeout: 6000 });
    await page.keyboard.up('ArrowLeft');
    await page.keyboard.up('KeyW');
    const xAfter = await page.evaluate(() => window.game.player.x);
    expect(xAfter).not.toBeCloseTo(xBefore, 0);
  });

  // AC-8: W key increases speed
  test('AC-8: W key increases throttle and speed', async ({ page }) => {
    await startGame(page);
    const spdBefore = await page.evaluate(() => window.game.player.speed);
    await page.keyboard.down('KeyW');
    // T-07: polling do ganho real de velocidade sob W em vez de janela fixa
    await page.waitForFunction((s0) => window.game.player.speed > s0, spdBefore, { timeout: 5000 });
    await page.keyboard.up('KeyW');
    const spdAfter = await page.evaluate(() => window.game.player.speed);
    expect(spdAfter).toBeGreaterThan(spdBefore);
  });

  // AC-9: S key decreases speed
  test('AC-9: S key decreases throttle and speed', async ({ page }) => {
    await startGame(page);
    await page.keyboard.down('KeyW');
    const spd0 = await page.evaluate(() => window.game.player.speed);
    // T-07: polling do ganho real de velocidade sob W em vez de janela fixa
    await page.waitForFunction((s) => window.game.player.speed > s + 5, spd0, { timeout: 5000 });
    await page.keyboard.up('KeyW');
    const spdBefore = await page.evaluate(() => window.game.player.speed);
    await page.keyboard.down('KeyS');
    // T-07: polling da queda real de velocidade sob S em vez de janela fixa
    await page.waitForFunction((s) => window.game.player.speed < s, spdBefore, { timeout: 6000 });
    await page.keyboard.up('KeyS');
    const spdAfter = await page.evaluate(() => window.game.player.speed);
    expect(spdAfter).toBeLessThan(spdBefore);
  });

  // AC-10: Space fires cannon
  test('AC-10: Space fires cannon projectile', async ({ page }) => {
    await startGame(page);
    const before = await page.evaluate(() => window.game.projectiles.length);
    await page.keyboard.press('Space');
    // T-07: polling do spawn real do projétil em vez de janela fixa
    await page.waitForFunction((n) => window.game.projectiles.length > n, before, { timeout: 2000 });
    const after = await page.evaluate(() => window.game.projectiles.length);
    expect(after).toBeGreaterThan(before);
  });

  // AC-11 (T-C-14, SPEC §C/F): X dispara míssil teleguiado (após lock-on ~0.35 s)
  // e NÃO decrementa o contador — o míssil leve é infinito desde T-C-08; o guard de
  // supply e o decremento foram removidos de main.js#fireMissile.
  test('AC-11: X fires homing missile (após lock-on) sem decrementar — supply infinito', async ({ page }) => {
    await startGame(page);
    await page.evaluate(() => {
      const t = window.game.targets[0];
      if (t) {
        t.mesh.position.set(window.game.player.x, window.game.player.y + 4, window.game.player.pz - 120);
        t.dead = false;
      }
    });
    // T-07: polling do lock-on real (crosshair.js#missileLockedTarget, 0.35 s no cone)
    await page.waitForFunction(async () => {
      const { missileLockedTarget } = await import('/src/web-games/aero-fighters/src/crosshair.js');
      return !!missileLockedTarget();
    }, { timeout: 3000 });
    const before = await page.evaluate(() => window.game.player.missiles);
    await page.keyboard.press('KeyX');
    // T-07 KEPT: janela de estabilidade — a asserção é NEGATIVA (o disparo NÃO
    // decrementa o contador); é preciso cobrir ao menos um tick pós-disparo para
    // que um decremento indevido fosse capturado.
    await page.waitForTimeout(200);
    const after = await page.evaluate(() => window.game.player.missiles);
    expect(after).toBe(before); // T-C-08: infinito — sem decremento
  });

  // AC-12 (T-C-14, SPEC §F): o que spawna como alvo depende do mapa. Nos mapas
  // legados (ilhas/deserto/rio) a missão spawna os tipos do layout fixo
  // (base/factory/aaGun...) via missions.js#spawnMission. Em Inhaúma NÃO há waves:
  // spawnMission é no-op (missions.js) e os alvos são as FORMAÇÕES da campanha —
  // a guarnição de Cachoeira (spawn no create do mapa, T-C-05) + as colunas do
  // Ato 1 (spawn-over-time seedado, T-C-06) — tipos 'f*' (units.js#unitTargetType).
  test('AC-12 (islands): mission spawns static military targets (layout legado)', async ({ page }) => {
    await startGame(page);
    await page.waitForFunction(() => window.game.targets.length > 0, { timeout: 4000 });
    // T-07: polling da presença real de alvos militares (a própria condição assertada)
    await page.waitForFunction(() =>
      window.game.targets.some(e => ['base', 'factory', 'building', 'convoy', 'armedConvoy', 'helicopter', 'aaGun'].includes(e.type)),
      { timeout: 4000 });
    const hasMilitary = await page.evaluate(() =>
      window.game.targets.some(e => ['base', 'factory', 'building', 'convoy', 'armedConvoy', 'helicopter', 'aaGun'].includes(e.type))
    );
    expect(hasMilitary).toBe(true);
  });

  test('AC-12 (inhauma): spawns são formações da campanha/guarnição (tipos f*)', async ({ page }) => {
    await page.goto('/src/web-games/aero-fighters/index.html?testMode=1&map=inhauma&seed=ac12-campaign');
    await page.waitForSelector('canvas', { state: 'attached', timeout: 15000 });
    await page.waitForFunction(() => window.__aeroDebug && window.game, { timeout: 15000 });
    await page.keyboard.press('Space');
    await page.waitForFunction(() => window.game.running === true, { timeout: 5000 });
    // A guarnição já está em game.targets desde o create do mapa (sem wave).
    await page.waitForFunction(() => window.game.targets.length > 0, { timeout: 4000 });
    const r = await page.evaluate(() => ({
      types: window.game.targets.map((t) => t.type),
      allFormation: window.game.targets.every((t) => typeof t.formationId === 'string'),
      campaign: {
        act: window.game.campaign?.act,
        total: window.game.campaign?.actTargetsTotal,
        mirroredTotal: window.game.targetsTotal,
      },
    }));
    expect(r.types.some((t) => t.startsWith('f'))).toBe(true);
    expect(r.allFormation).toBe(true); // nenhum alvo de wave/layout no barramento
    expect(r.campaign.act).toBe(1);
    // Contrato SPEC §F: "total" = objetivo do ATO, espelhado pela campanha.
    expect(r.campaign.mirroredTotal).toBe(r.campaign.total);
  });

  // AC-13 (T-C-14, SPEC §F): matar inimigo incrementa score — segue válido: unidades
  // de formação entram em game.targets (registerAsTargets) e o kill flui pelo mesmo
  // barramento de dano/score de targets.js (killTarget). game.enemies é alias de
  // game.targets (state.js).
  test('AC-13: killing enemy increments score', async ({ page }) => {
    await startGame(page);
    await page.waitForFunction(() => window.game.enemies.length > 0, { timeout: 4000 });
    const scoreBefore = await page.evaluate(() => window.game.score);
    await page.evaluate(() => { if (window.game.enemies[0]) window.game.enemies[0].hp = 0; });
    // T-07: polling do incremento real de score (kill processado no tick seguinte)
    await page.waitForFunction((s) => window.game.score > s, scoreBefore, { timeout: 3000 });
    const scoreAfter = await page.evaluate(() => window.game.score);
    expect(scoreAfter).toBeGreaterThan(scoreBefore);
  });

  // AC-14: low throttle leads to stall or very low speed
  test('AC-14: sustained S key causes stall or near-stall speed', async ({ page }) => {
    await startGame(page);
    await page.keyboard.down('KeyS');
    // T-07: polling do stall real (a própria condição assertada) em vez de janela fixa
    await page.waitForFunction(
      () => window.game.player.stalled || window.game.player.speed < 15,
      { timeout: 12000 },
    );
    await page.keyboard.up('KeyS');
    const stalled = await page.evaluate(() => window.game.player.stalled);
    const spd     = await page.evaluate(() => window.game.player.speed);
    expect(stalled || spd < 15).toBe(true);
  });

  // AC-15: Shift triggers barrel roll without crashing
  test('AC-15: Shift barrel roll keeps jet alive', async ({ page }) => {
    await startGame(page);
    await page.keyboard.press('ShiftLeft');
    // T-07 KEPT: janela de estabilidade — prova que o barrel roll NÃO crasha o jato;
    // precisa cobrir a duração da manobra para que um crash fosse capturado.
    await page.waitForTimeout(600);
    const running = await page.evaluate(() => window.game.running && !window.game.player.dead);
    expect(running).toBe(true);
  });

  // AC-16: scene background is not black (ocean/sky rendering)
  test('AC-16: scene renders coloured background (sky + ocean)', async ({ page }) => {
    await page.goto('/src/web-games/aero-fighters/index.html');
    // T-07: polling do primeiro render real (módulos carregados) em vez de sleep fixo
    await modulesLoaded(page);
    const shot = await page.screenshot();
    let nonBlack = 0;
    for (let i = 54; i < Math.min(shot.length, 54 + 4000 * 4); i += 4) {
      if (shot[i] > 20 || shot[i+1] > 20 || shot[i+2] > 20) nonBlack++;
    }
    expect(nonBlack).toBeGreaterThan(500);
  });

  // AC-17: lives=0 shows mission failed
  test('AC-17: setting player lives to 0 shows MISSÃO FALHOU', async ({ page }) => {
    await startGame(page);
    // T-07 KEPT: settle curto do loop/HUD antes da mutação forçada (lives=0) —
    // garante que a injeção cai num tick estável, não no frame do start.
    await page.waitForTimeout(300);
    await page.evaluate(() => { window.game.player.lives = 0; });
    // T-07: polling do overlay real de fim de missão em vez de janela fixa
    await page.waitForFunction(
      () => document.body.innerText.includes('MISSÃO FALHOU'),
      { timeout: 3000 },
    );
    const text = await page.evaluate(() => document.body.innerText);
    expect(text).toContain('MISSÃO FALHOU');
  });

  // AC-18: FPS >= 7 over 8s (browser real fica 60+; threshold tolerante para
  // headless chromium com software rendering + PBR + skybox + tracers)
  test('AC-18: FPS >= 7 over 8s', async ({ page }) => {
    await startGame(page);
    await page.evaluate(() => {
      window.__fps = { n: 0 };
      const orig = window.requestAnimationFrame.bind(window);
      window.requestAnimationFrame = cb => orig(ts => { window.__fps.n++; cb(ts); });
    });
    const t0 = Date.now();
    // T-07 KEPT: janela de medição — a métrica sob teste é a TAXA de frames sobre
    // exatamente 8 s de relógio; não é espera por estado, é o próprio instrumento.
    await page.waitForTimeout(8000);
    const elapsed = (Date.now() - t0) / 1000;
    const frames  = await page.evaluate(() => window.__fps.n);
    expect(frames / elapsed).toBeGreaterThanOrEqual(7);
  });
});
