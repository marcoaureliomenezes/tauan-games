// WS-5: pista sprint "Serra do Tauan" (A→B) + modo Fuga (perseguição policial).
// Sprint: corrida completa A→B com chegada (jogador guiado pela IA — mesma
// convenção do smoke). Fuga: dano por pancada da polícia, spike strip fura
// pneu, finais VOCÊ ESCAPOU / PEGO PELA POLÍCIA alcançáveis.
import { test, expect } from '@playwright/test';

const URL = '/src/web-games/speed-run/';

// seleciona a Serra (4ª pista) e entra no modo pedido
async function startSprint(page, mode = 'corrida') {
  await page.goto(URL);
  await page.waitForFunction(() => window.__corridaReady === true, { timeout: 15000 });
  for (let i = 0; i < 3; i++) await page.keyboard.press('ArrowRight');
  if (mode === 'fuga') {
    await page.keyboard.press('ArrowDown');          // linha CARRO
    await page.keyboard.press('ArrowDown');          // linha MODO
    await page.keyboard.press('ArrowRight');         // Corrida → Fuga
  }
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => ['countdown', 'race'].includes(window.__corrida.phase), { timeout: 5000 });
}

// IA guia o jogador (hook st.ai — mesma interface do smoke)
async function aiDrive(page, laneOffset = 0, skill = 0.9) {
  await page.evaluate(([lane, skill]) => {
    const G = window.__corrida;
    G.player.isPlayer = false;
    G.player.st.ai = { laneOffset: lane, skill, lookAhead: 0.014 };
  }, [laneOffset, skill]);
}

test.describe('WS-5 — Serra do Tauan (sprint A→B)', () => {
  test('menu: 4ª pista com linha MODO (Corrida/Fuga) só no sprint', async ({ page }) => {
    await page.goto(URL);
    await page.waitForFunction(() => window.__corridaReady === true, { timeout: 15000 });
    await expect(page.locator('#menuModes')).toBeHidden();
    for (let i = 0; i < 3; i++) await page.keyboard.press('ArrowRight');
    await expect(page.locator('#menuModes')).toBeVisible();
    await expect(page.locator('#menuModes')).toContainText('Corrida');
    await expect(page.locator('#menuModes')).toContainText('Fuga');
    await expect(page.locator('#menuTracks')).toContainText('Tauan City');
  });

  test('sprint: corrida completa A→B e termina na chegada (sem voltas)', async ({ page }) => {
    test.setTimeout(180000);
    await startSprint(page);
    await expect(page.locator('#trackName')).toHaveText('Serra do Tauan');
    const meta = await page.evaluate(() => {
      const G = window.__corrida;
      return {
        sprint: G.sprint, finishS: G.finishS, trackLen: G.world.trackLen,
        open: G.world.track.open, racers: G.cars.filter((c) => !c.isTraffic).length,
      };
    });
    expect(meta.sprint).toBe(true);
    expect(meta.open).toBe(true);
    expect(meta.trackLen).toBeGreaterThan(1750);
    expect(meta.finishS).toBeCloseTo((meta.trackLen - 30) / meta.trackLen, 5);
    expect(meta.racers).toBe(6);                     // jogador + 5 rivais
    await aiDrive(page);
    // HUD de sprint: "Faltam X.X km" em vez de voltas
    await page.waitForFunction(() => window.__corrida.phase === 'race', { timeout: 5000 });
    await expect(page.locator('#lap')).toContainText('Faltam');
    await page.waitForFunction(() => window.__corrida.phase === 'finished', { timeout: 170000 });
    const end = await page.evaluate(() => ({
      title: document.getElementById('finishTitle').textContent,
      cp: window.__corrida.player.st.cp,
      s: window.__corrida.player.st.sHint,
      finishS: window.__corrida.finishS,
    }));
    expect(end.title).toMatch(/CAMPEÃO|LUGAR/);      // pódio reutilizado no sprint
    expect(end.s).toBeGreaterThanOrEqual(end.finishS);
    expect(end.cp).toBeGreaterThanOrEqual(5);        // checkpoints 1..5/6 cruzados
  });
});

test.describe('WS-5 — modo Fuga', () => {
  test('pancada da polícia tira vida (barra no HUD)', async ({ page }) => {
    test.setTimeout(60000);
    await startSprint(page, 'fuga');
    await expect(page.locator('#trackName')).toContainText('FUGA');
    await expect(page.locator('#life')).toBeVisible();
    // IA guia o fugitivo JÁ na contagem — parado, as viaturas o alcançam na
    // largada (é o jogo); a prova compara vida ANTES/DEPOIS da pancada forçada
    await aiDrive(page);
    const setup = await page.evaluate(() => {
      const G = window.__corrida;
      return {
        life: G.chase.life,
        cops: G.cars.filter((c) => c.isPolice).length,
        racers: G.cars.filter((c) => !c.isTraffic && !c.isPolice).length,
      };
    });
    expect(setup.life).toBeLessThanOrEqual(100);
    expect(setup.cops).toBe(3);
    expect(setup.racers).toBe(1);                    // só o fugitivo "conta"
    // teleporta uma viatura colada atrás do jogador, mais rápida → PANCADA
    await page.evaluate(() => {
      const G = window.__corrida;
      const st = G.player.st;
      const cop = G.cars.find((c) => c.isPolice);
      cop.st.pos.set(
        st.pos.x + Math.sin(st.heading) * 5,
        st.pos.y,
        st.pos.z + Math.cos(st.heading) * 5);
      cop.st.heading = st.heading;
      cop.st.v = st.v + 14;
      window.__life0 = G.chase.life;
    });
    await page.waitForFunction(() => window.__corrida.chase.life < window.__life0, { timeout: 15000 });
    const ch = await page.evaluate(() => ({
      drop: window.__life0 - window.__corrida.chase.life,
      msg: window.__corrida.chase.msg,
    }));
    expect(ch.drop).toBeGreaterThanOrEqual(4);       // clamp 4–30 por evento
    expect(ch.drop).toBeLessThanOrEqual(30);
    expect(ch.msg).toContain('POLÍCIA');
  });

  // T-03 (2026-08-12, map de rebaixamento §4): SLIM — o decaimento de v/grip
  // do punctureT (physics.js:57-61) é lei pura, agora coberta em Node por
  // tools/test-corrida-physics.mjs ("spike strip: punctureT decai velocidade
  // e reduz grip"). O dano fixo (12, clamp 100→88) depende de G.chase
  // (main.js, não importável em Node hoje) — fica só esse assert aqui.
  test('spike strip: pneu furado causa dano (12, clamp 100→88)', async ({ page }) => {
    test.setTimeout(60000);
    await startSprint(page, 'fuga');
    await aiDrive(page, 2.5);                        // meia-pista + (lado da tira)
    await page.waitForFunction(() => window.__corrida.phase === 'race', { timeout: 5000 });
    const spike = await page.evaluate(() => {
      const G = window.__corrida;
      // isola a prova: viaturas lentas — nenhuma PANCADA antes da tira
      for (const c of G.cars) if (c.isPolice) c.st.def = { ...c.st.def, topSpeed: 20, accel: 10 };
      const sp = G.spawnSpike(1);                    // tira na meia-pista +
      return { s: sp.s, side: sp.side };
    });
    expect(spike.side).toBe(1);
    await page.waitForFunction(() => {
      const G = window.__corrida;
      return G.chase.spikes.some((sp) => sp.hit);
    }, { timeout: 30000 });
    const life = await page.evaluate(() => window.__corrida.chase.life);
    expect(life).toBeLessThanOrEqual(88);      // 100 − 12
  });

  test('finais: VOCÊ ESCAPOU na chegada e PEGO com a vida zerada', async ({ page }) => {
    test.setTimeout(90000);
    // ── escape: teleporta a 60 m da chegada com vida cheia ─────────────────
    await startSprint(page, 'fuga');
    await aiDrive(page);
    await page.waitForFunction(() => window.__corrida.phase === 'race', { timeout: 5000 });
    await page.evaluate(() => {
      const G = window.__corrida;
      const st = G.player.st;
      const s = G.finishS - 60 / G.world.trackLen;
      const sm = G.world.track.samples[Math.round(s * G.world.track.M)];
      st.pos.set(sm.pos.x, sm.pos.y, sm.pos.z);
      st.heading = Math.atan2(-sm.tan.x, -sm.tan.z);
      st.v = 40; st.sHint = sm.s; st.lastS = sm.s;
    });
    await page.waitForFunction(() => window.__corrida.phase === 'finished', { timeout: 20000 });
    await expect(page.locator('#finishTitle')).toContainText('VOCÊ ESCAPOU');
    await expect(page.locator('#finishSub')).toContainText('Vila Serrana');
    const escaped = await page.evaluate(() => window.__corrida.chase.escaped);
    expect(escaped).toBe(true);

    // ── pego: reinicia (R), vida a 5, viatura colada → um PANCADA encerra ──
    await page.keyboard.press('Enter');              // volta ao menu
    await page.waitForFunction(() => window.__corrida.phase === 'menu', { timeout: 5000 });
    await startSprint(page, 'fuga');
    await aiDrive(page);
    await page.waitForFunction(() => window.__corrida.phase === 'race', { timeout: 5000 });
    await page.evaluate(() => {
      const G = window.__corrida;
      G.chase.life = 5;
      const st = G.player.st;
      const cop = G.cars.find((c) => c.isPolice);
      cop.st.pos.set(
        st.pos.x + Math.sin(st.heading) * 5, st.pos.y, st.pos.z + Math.cos(st.heading) * 5);
      cop.st.heading = st.heading;
      cop.st.v = st.v + 14;
    });
    await page.waitForFunction(() => window.__corrida.phase === 'finished', { timeout: 20000 });
    await expect(page.locator('#finishTitle')).toContainText('PEGO PELA POLÍCIA');
    const caught = await page.evaluate(() => window.__corrida.chase.caught);
    expect(caught).toBe(true);
  });
});
