const { test, expect } = require('@playwright/test');

// Smoke + AC suite para o jogo Space War (release space-war-v1).
// Cobre AC-01..AC-08 do SPEC: carrega sem build step, mundo construído,
// decolagem, gravidade, combate/nuke, mapa, e diagnóstico via window.__spaceWar.

async function load(page) {
  await page.goto('/space-war/index.html');
  await page.waitForSelector('canvas', { state: 'attached', timeout: 30000 });
  await page.waitForFunction(() => window.__spaceWarReady === true, { timeout: 45000 });
}

async function startFlight(page) {
  await load(page);
  await page.keyboard.press('Enter');      // menu -> briefing
  await page.waitForTimeout(150);
  await page.keyboard.press('Enter');      // briefing -> flight
  await page.waitForFunction(() => window.__spaceWar.phase === 'flight', { timeout: 10000 });
}

test.describe('Space War — Smoke / AC', () => {
  // Budgets largos (2026-07-18): a máquina de CI é compartilhada e o boot em
  // software-GL pode passar de 15s sob carga — AC-03/AC-10 estouravam o teto
  // de 30s por TEMPO, não por asserção. Nenhuma asserção foi alterada.
  test.setTimeout(90000);

  // AC-01 / AC-08: abre sem build step e expõe estado, sem erro fatal de console.
  test('AC-08: carrega sem erros de console e expõe window.__spaceWar', async ({ page }) => {
    const errors = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push(e.message));
    await load(page);
    const st = await page.evaluate(() => ({
      hasState: typeof window.__spaceWar === 'object',
      bodies: window.__spaceWar.bodies.length,
      phase: window.__spaceWar.phase,
    }));
    expect(st.hasState).toBe(true);
    expect(st.phase).toBe('menu');
    expect(errors).toEqual([]);
  });

  // AC-03: Sol + 8 planetas + luas existem e estão em órbita (movimento).
  test('AC-03: sistema solar construído e em movimento', async ({ page }) => {
    await load(page);
    const n = await page.evaluate(() => window.__spaceWar.bodies.length);
    expect(n).toBeGreaterThanOrEqual(18);   // 1 sol + 8 planetas + 12 luas = 21
    const hasJupiterMoons = await page.evaluate(() =>
      ['Io', 'Europa', 'Ganimedes', 'Calisto'].every((nm) =>
        window.__spaceWar.bodies.some((b) => b.def.name === nm)));
    expect(hasJupiterMoons).toBe(true);
    // Movimento orbital: a posição da Terra muda com o tempo.
    await startFlight(page);
    const p0 = await page.evaluate(() => {
      const e = window.__spaceWar.bodies.find((b) => b.def.key === 'earth');
      return { x: e.worldPos.x, z: e.worldPos.z };
    });
    await page.waitForTimeout(1200);
    const p1 = await page.evaluate(() => {
      const e = window.__spaceWar.bodies.find((b) => b.def.key === 'earth');
      return { x: e.worldPos.x, z: e.worldPos.z };
    });
    expect(Math.hypot(p1.x - p0.x, p1.z - p0.z)).toBeGreaterThan(0.1);
  });

  // AC-02: a nave decola da Terra (landed -> false, altitude sobe).
  test('AC-02: decolagem da Terra', async ({ page }) => {
    await startFlight(page);
    const landed0 = await page.evaluate(() => window.__spaceWar.ship.landed);
    expect(landed0).toBe(true);
    // Segura o empuxo até decolar de fato (robusto a fps — headless roda em câmera lenta).
    await page.keyboard.down('KeyW');
    await page.waitForFunction(() => window.__spaceWar.ship.landed === false, { timeout: 12000 });
    await page.waitForTimeout(800);          // sobe um pouco
    await page.keyboard.up('KeyW');
    const s = await page.evaluate(() => ({
      landed: window.__spaceWar.ship.landed,
      alt: window.__spaceWar.ship.altitude,
      hp: window.__spaceWar.ship.hp,
    }));
    expect(s.landed).toBe(false);          // sinal primário: decolou
    expect(s.alt).toBeGreaterThan(3);      // acima do ponto de partida
    expect(s.hp).toBeGreaterThan(0);
  });

  // AC-04: a nave sofre gravidade (gravMag > 0 perto da Terra).
  test('AC-04: gravidade age sobre a nave', async ({ page }) => {
    await startFlight(page);
    await page.keyboard.down('KeyW');
    await page.waitForFunction(() => window.__spaceWar.ship.landed === false, { timeout: 12000 });
    await page.waitForTimeout(300);
    await page.keyboard.up('KeyW');
    await page.waitForTimeout(400);
    const g = await page.evaluate(() => window.__spaceWar.ship.gravMag);
    expect(g).toBeGreaterThan(0);
  });

  // AC-04b: zona de não-retorno do Sol — gravidade excede o empuxo máximo.
  test('AC-04b: zona de não-retorno do Sol', async ({ page }) => {
    await startFlight(page);
    await page.evaluate(() => {
      const s = window.__spaceWar.ship;
      s.landed = false; s.throttle = 1; s.boost = false;
      s.pos.set(600, 0, 0); s.vel.set(0, 0, 0);   // dentro de SUN_NORETURN (720)
    });
    await page.waitForTimeout(500);
    const st = await page.evaluate(() => ({
      nr: window.__spaceWar.ship.noReturn,
      g: window.__spaceWar.ship.gravMag,
      dom: window.__spaceWar.ship.dominant?.def.name,
    }));
    expect(st.nr).toBe(true);
    expect(st.g).toBeGreaterThan(46);    // > empuxo máximo da nave (fuga impossível)
    expect(st.dom).toBe('Sol');
  });

  // AC-05: laser dispara e nuke decrementa o contador.
  test('AC-05: laser e nuke', async ({ page }) => {
    await startFlight(page);
    await page.keyboard.down('KeyW');
    await page.waitForFunction(() => window.__spaceWar.ship.landed === false, { timeout: 12000 });
    await page.waitForTimeout(300);
    await page.keyboard.up('KeyW');
    // laser — espera um projétil aparecer (robusto a fps; câmera lenta em headless)
    const before = await page.evaluate(() => window.__spaceWar.projectiles.length);
    await page.keyboard.down('Space');
    await page.waitForFunction((b) => window.__spaceWar.projectiles.length > b, before, { timeout: 6000 });
    await page.keyboard.up('Space');
    const after = await page.evaluate(() => window.__spaceWar.projectiles.length);
    expect(after).toBeGreaterThan(before);
    // nuke
    const nk0 = await page.evaluate(() => window.__spaceWar.ship.nukes);
    await page.keyboard.press('KeyF');
    await page.waitForTimeout(150);
    const nk1 = await page.evaluate(() => window.__spaceWar.ship.nukes);
    expect(nk1).toBe(nk0 - 1);
  });

  // AC-07: mapa do sistema abre.
  test('AC-07: mapa do sistema (M)', async ({ page }) => {
    await startFlight(page);
    await page.keyboard.press('KeyM');
    await page.waitForTimeout(150);
    const open = await page.evaluate(() => window.__spaceWar.mapOpen);
    expect(open).toBe(true);
  });

  // AC-09: navegação — alvo default é o objetivo da missão e T cicla destinos.
  test('AC-09: navegação (alvo default + ciclo T)', async ({ page }) => {
    await startFlight(page);
    const t0 = await page.evaluate(() => window.__spaceWar.nav.target?.name);
    expect(t0).toContain('OBJETIVO');            // missão 1 é bombardeio → nav aponta o objetivo
    await page.keyboard.press('KeyT');
    await page.waitForTimeout(100);
    const t1 = await page.evaluate(() => window.__spaceWar.nav.target?.name);
    expect(t1).not.toBe(t0);
    expect(typeof t1).toBe('string');
  });

  // AC-10: piloto automático de mira (C) gira o nariz para o alvo.
  test('AC-10: align autopilot (C) aponta a nave no alvo', async ({ page }) => {
    await startFlight(page);
    // entra em voo deterministicamente perto de Júpiter; alvo = Sol (direção oposta)
    await page.evaluate(() => window.__swDebug.goTo('jupiter'));
    await page.waitForTimeout(120);
    let name = '';
    for (let i = 0; i < 12 && name !== 'Sol'; i++) {
      await page.keyboard.press('KeyT'); await page.waitForTimeout(40);
      name = await page.evaluate(() => window.__spaceWar.nav.target?.name);
    }
    const aim = () => page.evaluate(() => {
      const rot = (q, v) => {
        const ix = q.w * v.x + q.y * v.z - q.z * v.y, iy = q.w * v.y + q.z * v.x - q.x * v.z,
          iz = q.w * v.z + q.x * v.y - q.y * v.x, iw = -q.x * v.x - q.y * v.y - q.z * v.z;
        return { x: ix * q.w + iw * -q.x + iy * -q.z - iz * -q.y, y: iy * q.w + iw * -q.y + iz * -q.x - ix * -q.z, z: iz * q.w + iw * -q.z + ix * -q.y - iy * -q.x };
      };
      const s = window.__spaceWar.ship, t = window.__spaceWar.nav.target;
      const n = rot(s.quat, { x: 0, y: 0, z: -1 });
      const d = { x: t.pos.x - s.pos.x, y: t.pos.y - s.pos.y, z: t.pos.z - s.pos.z };
      const dl = Math.hypot(d.x, d.y, d.z) || 1;
      return Math.acos(Math.max(-1, Math.min(1, (n.x * d.x + n.y * d.y + n.z * d.z) / dl)));
    });
    const before = await aim();
    await page.keyboard.press('KeyC');
    await page.waitForFunction(() => window.__spaceWar.ship.aligning === false, { timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(300);
    const after = await aim();
    expect(after).toBeLessThan(before);
    expect(after).toBeLessThan(0.4);             // nariz essencialmente no alvo
  });

  // AC-11: a nave NÃO morre no início (zona segura da Terra + escudo); decola intacta.
  test('AC-11: sobrevive ao início e à decolagem', async ({ page }) => {
    await startFlight(page);
    await page.waitForTimeout(3000);             // parado na plataforma
    let s = await page.evaluate(() => ({ hp: window.__spaceWar.ship.hp, phase: window.__spaceWar.phase, landed: window.__spaceWar.ship.landed }));
    expect(s.hp).toBe(100);
    expect(s.phase).toBe('flight');
    expect(s.landed).toBe(true);
    // decola e fica perto da Terra: escudo protege
    await page.keyboard.down('KeyW');
    await page.waitForFunction(() => window.__spaceWar.ship.landed === false, { timeout: 12000 });
    await page.waitForTimeout(1500);
    await page.keyboard.up('KeyW');
    s = await page.evaluate(() => ({ hp: window.__spaceWar.ship.hp, phase: window.__spaceWar.phase }));
    expect(s.hp).toBeGreaterThan(70);
    expect(s.phase).toBe('flight');
  });

  // AC-06: cena com fundo colorido (skybox galáctico, não preto puro).
  test('AC-06: skybox galáctico renderiza pixels coloridos', async ({ page }) => {
    await startFlight(page);
    await page.waitForTimeout(500);
    const shot = await page.screenshot();
    let colored = 0;
    for (let i = 54; i < Math.min(shot.length, 54 + 8000 * 4); i += 4) {
      if (shot[i] > 16 || shot[i + 1] > 16 || shot[i + 2] > 16) colored++;
    }
    expect(colored).toBeGreaterThan(300);
  });

  // Estabilidade: FPS mínimo em headless software-rendering (SwiftShader).
  // Piso baixo de propósito: o headless software-GL renderiza o skybox galáctico de
  // tela cheia + atmosferas por software a ~5-7fps sob carga; em hardware-GL real
  // (a máquina do Tauan) roda a 60fps. Este teste só pega regressão catastrófica
  // (cena travada / loop morto), não mede a experiência real.
  test('FPS >= 4 em 6s (headless software-GL)', async ({ page }) => {
    await startFlight(page);
    await page.evaluate(() => {
      window.__f = 0;
      const o = window.requestAnimationFrame.bind(window);
      window.requestAnimationFrame = (cb) => o((t) => { window.__f++; cb(t); });
    });
    const t0 = Date.now();
    await page.waitForTimeout(6000);
    const frames = await page.evaluate(() => window.__f);
    expect(frames / ((Date.now() - t0) / 1000)).toBeGreaterThanOrEqual(4);
  });
});
