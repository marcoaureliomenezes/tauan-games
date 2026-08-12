const { test, expect } = require('@playwright/test');

const URL = '/src/web-games/demolition-ball/index.html?quality=low';

async function boot(page) {
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(URL);
  await page.waitForFunction(() => window.__demolition && window.__demolition.frames > 3, null, { timeout: 60000 });
  return errors;
}

test('carrega, renderiza em WebGL2 e roda sem erros de console', async ({ page }) => {
  const errors = await boot(page);
  const info = await page.evaluate(() => {
    const d = window.__demolition;
    return {
      frames: d.frames,
      structures: d.city.structures.length,
      cars: d.traffic.cars.length,
      mission: d.missions.current.spec.title,
      targets: d.missions.current.targets.length,
      gl: !!document.getElementById('scene').getContext('webgl2'),
      stats: d.renderer.stats(),
    };
  });
  expect(info.gl).toBe(true);
  expect(info.structures).toBeGreaterThan(40);
  expect(info.cars).toBe(34);
  expect(info.targets).toBeGreaterThan(0);
  expect(info.mission).toContain('Contrato 1');
  expect(info.stats.boxes).toBeGreaterThan(200);
  expect(info.stats.drawCalls).toBeGreaterThan(3);
  expect(errors).toEqual([]);
});

test('o trator dirige e a cidade continua consistente', async ({ page }) => {
  await boot(page);
  const start = await page.evaluate(() => ({ x: window.__demolition.rig.pos.x, z: window.__demolition.rig.pos.z }));
  // Drive by SIM time, not wall time: on slow CI rasterizers 1.6 wall-seconds
  // can be a handful of frames (~0.25 sim-s) and the rig barely moves.
  const t0 = await page.evaluate(() => {
    const d = window.__demolition;
    d.begin();
    d.press('KeyW');
    return d.simTime;
  });
  await page.waitForFunction((t) => window.__demolition.simTime > t + 2.2, t0, { timeout: 90000 });
  await page.evaluate(() => window.__demolition.release('KeyW'));
  const end = await page.evaluate(() => ({
    x: window.__demolition.rig.pos.x,
    z: window.__demolition.rig.pos.z,
    speed: window.__demolition.rig.speed,
  }));
  const moved = Math.hypot(end.x - start.x, end.z - start.z);
  expect(moved).toBeGreaterThan(3);
  expect(Number.isFinite(end.speed)).toBe(true);
});

// T-04: a invariante de inextensibilidade do cabo (90 frames de Space,
// dist(ball,tip) <= ropeLen+0.15, e velocidade máxima > 2 provando que a
// bomba realmente constrói balanço) foi rebaixada para unit.mjs — dirige o
// Rig direto, sem browser (ver "rig: the ball never outruns the rope while
// swinging"). Este E2E era o DN clássico do anexo de rebaixamento.

test('impacto da bola demole a estrutura alvo e gera escombros', async ({ page }) => {
  test.slow();   // frame-driven loop: at CI fps the full budget can near 26x22 RAFs
  await boot(page);
  const result = await page.evaluate(async () => {
    const d = window.__demolition;
    d.begin();
    const target = d.missions.current.targets[0];
    const before = target.progress;
    for (let hit = 0; hit < 26; hit++) {
      d.teleportBallTo(target, 5);
      for (let i = 0; i < 22; i++) await new Promise((r) => requestAnimationFrame(r));
      // Early exit once the acceptance condition is met — keeps slow CI
      // runners inside the timeout without weakening the assertion.
      if (target.progress > 0.06 && d.debris.chunks.length > 0 && d.debris.dust.length > 0) break;
    }
    return {
      before,
      after: target.progress,
      chunks: d.debris.chunks.length,
      dust: d.debris.dust.length,
      name: target.name,
    };
  });
  expect(result.before).toBe(0);
  expect(result.after).toBeGreaterThan(0.05);
  expect(result.chunks).toBeGreaterThan(0);
  expect(result.dust).toBeGreaterThan(0);
});

test('mapa expande e recolhe com M', async ({ page }) => {
  await boot(page);
  await page.evaluate(() => window.__demolition.begin());
  const small = await page.evaluate(() => document.getElementById('minimap').getBoundingClientRect().width);
  await page.keyboard.press('m');
  // polling no estado real (T-07) — era waitForTimeout(300) ×2
  await page.waitForFunction((s) =>
    document.getElementById('minimap').getBoundingClientRect().width > s * 1.5, small, { timeout: 3000 });
  const big = await page.evaluate(() => document.getElementById('minimap').getBoundingClientRect().width);
  expect(big).toBeGreaterThan(small * 1.5);
  await page.keyboard.press('m');
  await page.waitForFunction((s) =>
    Math.abs(document.getElementById('minimap').getBoundingClientRect().width - s) < 2, small, { timeout: 3000 });
  const back = await page.evaluate(() => document.getElementById('minimap').getBoundingClientRect().width);
  expect(Math.abs(back - small)).toBeLessThan(2);
});

test('HUD mostra contrato, alvos e caixa', async ({ page }) => {
  await boot(page);
  await expect(page.locator('#mission-title')).toContainText('Contrato');
  await expect(page.locator('#target-list li')).not.toHaveCount(0);
  await expect(page.locator('#money')).toContainText('$');
});

// T-04: "equipe de isolamento" (R-11) DELETADO — o E2E chamava
// `d.crew.update(dt, missions, traffic)` num laço `while`, literalmente
// re-rodando em página o MESMO método puro que unit.mjs:419 ("equipe: ciclo
// completo") já roda em Node, com as MESMAS asserções (cones===28,
// closedEdges===4, depois ===0) — zero comportamento adicional de browser
// (sem clique, sem DOM além do botão/estado já cobertos acima).

// ---------------------------------------------------------------- v0.9.0 (R-01)

// T-04: slim — os valores-padrão de cada modo (threshold/deadline/targets)
// já são provados em unit.mjs:227/:248 construindo MissionSystem com as
// MESMAS opções de MODES.tauan/MODES.contratos (modes.js). O que só o
// browser prova é a FIAÇÃO real: o clique em #mode-* de fato troca
// window.__demolition.mode, e o modo trava depois de begin() — só isso fica.
test('overlay oferece os dois modos e o Tauan é o padrão (AC-1)', async ({ page }) => {
  await boot(page);
  await expect(page.locator('#mode-tauan')).toBeVisible();
  await expect(page.locator('#mode-contratos')).toBeVisible();
  expect(await page.evaluate(() => window.__demolition.mode.id)).toBe('tauan');

  await page.click('#mode-contratos');
  expect(await page.evaluate(() => window.__demolition.mode.id)).toBe('contratos');

  // Depois de começar, o modo trava.
  await page.evaluate(() => window.__demolition.begin());
  await page.evaluate(() => window.__demolition.selectMode('tauan'));
  const locked = await page.evaluate(() => window.__demolition.mode.id);
  expect(locked).toBe('contratos');
});
