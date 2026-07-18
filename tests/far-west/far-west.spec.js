const { test, expect } = require('@playwright/test');

const EXTERNAL_PROTOCOLS = new Set(['http:', 'https:']);

function collectRuntimeProblems(page) {
  const problems = [];

  page.on('console', (message) => {
    if (message.type() === 'error') {
      problems.push(`console error: ${message.text()}`);
    }
  });

  page.on('pageerror', (error) => {
    problems.push(`page error: ${error.message}`);
  });

  page.on('request', (request) => {
    const url = new URL(request.url());
    const isExternal =
      EXTERNAL_PROTOCOLS.has(url.protocol) &&
      !['localhost', '127.0.0.1'].includes(url.hostname);

    if (isExternal) {
      problems.push(`external request: ${request.url()}`);
    }
  });

  page.on('requestfailed', (request) => {
    problems.push(`request failed: ${request.url()} (${request.failure()?.errorText})`);
  });

  return problems;
}

async function bootGame(page) {
  const problems = collectRuntimeProblems(page);
  await page.goto('/src/web-games/far-west/');
  await page.waitForFunction(
    () => window.game && window.game.world && typeof window.game.world.heightAt === 'function',
    null,
    { timeout: 60000 }
  );
  // start overlay (pointer-lock gesture) — click through if present
  const overlay = page.locator('#overlay');
  if (await overlay.isVisible().catch(() => false)) {
    await overlay.click();
  }
  const startOverlay = page.locator('#start-overlay');
  if (await startOverlay.isVisible().catch(() => false)) {
    await startOverlay.click();
  }
  return problems;
}

test.describe('Far West — smoke offline e boot', () => {
  // 3D world boot (heightgrid + GLB load) can exceed the 30 s default under CPU contention
  test.describe.configure({ timeout: 120000 });
  test('catalogo principal navega para a pagina do jogo', async ({ page }) => {
    const problems = collectRuntimeProblems(page);

    await page.goto('/');

    const gameLink = page.getByRole('link', { name: /Far West/i });
    await expect(gameLink).toBeVisible();
    await expect(gameLink).toHaveAttribute('href', 'src/web-games/far-west/');

    await gameLink.click();

    await expect(page).toHaveURL(/\/far-west\/$/);
    expect(problems).toEqual([]);
  });

  test('abre sem erros de console, sem requests externos e com mundo carregado', async ({ page }) => {
    const problems = await bootGame(page);

    const shape = await page.evaluate(() => ({
      hasHeightAt: typeof window.game.world.heightAt === 'function',
      hasPlayer: !!window.game.player && typeof window.game.player.stamina === 'number',
      hasEntities: !!window.game.entities,
      cameraMode: window.game.ui.cameraMode,
      mapOpen: window.game.ui.mapOpen,
    }));

    expect(shape.hasHeightAt).toBe(true);
    expect(shape.hasPlayer).toBe(true);
    expect(shape.hasEntities).toBe(true);
    expect(['first', 'third']).toContain(shape.cameraMode);
    expect(shape.mapOpen).toBe(false);
    expect(problems).toEqual([]);
  });

  test('canvas WebGL renderiza pixels nao-pretos', async ({ page }) => {
    await bootGame(page);
    await page.waitForTimeout(1500);

    const screenshot = await page.screenshot();
    // a rendered 3D scene must have byte variance (not a solid black frame)
    const uniqueBytes = new Set(screenshot.subarray(0, 4000)).size;
    expect(uniqueBytes).toBeGreaterThan(16);
  });

  test('[V] alterna camera entre primeira e terceira pessoa', async ({ page }) => {
    await bootGame(page);

    const before = await page.evaluate(() => window.game.ui.cameraMode);
    await page.keyboard.press('KeyV');
    await page.waitForTimeout(200);
    const after = await page.evaluate(() => window.game.ui.cameraMode);

    expect(after).not.toBe(before);
    expect(['first', 'third']).toContain(after);
  });

  test('[M] abre e fecha o mapa', async ({ page }) => {
    await bootGame(page);

    await page.keyboard.press('KeyM');
    await page.waitForTimeout(200);
    expect(await page.evaluate(() => window.game.ui.mapOpen)).toBe(true);

    await page.keyboard.press('KeyM');
    await page.waitForTimeout(200);
    expect(await page.evaluate(() => window.game.ui.mapOpen)).toBe(false);
  });

  test('[F] mira e [mouse] consome municao', async ({ page }) => {
    await bootGame(page);

    await page.keyboard.down('KeyF');
    await page.waitForTimeout(150);
    expect(await page.evaluate(() => window.game.ui.aiming)).toBe(true);

    const ammoBefore = await page.evaluate(() => window.game.player.ammo);
    await page.mouse.move(400, 300);
    await page.mouse.down();
    await page.mouse.up();
    await page.waitForTimeout(200);
    const ammoAfter = await page.evaluate(() => window.game.player.ammo);

    expect(ammoAfter).toBe(ammoBefore - 1);
    await page.keyboard.up('KeyF');
  });

  test('[espaco] cavalo pula e retorna ao chao', async ({ page }) => {
    await bootGame(page);

    const ground = await page.evaluate(() => ({
      y: window.game.player.position.y,
      h: window.game.world.heightAt(window.game.player.position.x, window.game.player.position.z),
    }));
    await page.keyboard.press('Space');
    let maxY = ground.y;
    for (let i = 0; i < 25; i++) {
      await page.waitForTimeout(100);
      const y = await page.evaluate(() => window.game.player.position.y);
      if (y > maxY) maxY = y;
    }
    const after = await page.evaluate(() => ({
      y: window.game.player.position.y,
      h: window.game.world.heightAt(window.game.player.position.x, window.game.player.position.z),
    }));

    expect(maxY - ground.h).toBeGreaterThan(0.8);
    expect(Math.abs(after.y - after.h)).toBeLessThan(0.05);
  });

  test('cavalo segue o yaw da camera quando nao esta mirando', async ({ page }) => {
    await bootGame(page);

    await page.keyboard.down('KeyW');
    await page.evaluate(async () => {
      const cam = await import('/src/web-games/far-west/src/camera.js');
      window.__cam = cam;
      cam.injectLook(1.2, 0); // offset camera yaw from horse heading
    });
    await page.waitForTimeout(2500);
    await page.keyboard.up('KeyW');

    const delta = await page.evaluate(() => {
      let d = window.game.player.heading - window.__cam.getCamYaw();
      while (d > Math.PI) d -= 2 * Math.PI;
      while (d < -Math.PI) d += 2 * Math.PI;
      return Math.abs(d);
    });
    expect(delta).toBeLessThan(0.5);
  });

  test('cavalo colide com rocha grande (sem penetracao)', async ({ page }) => {
    await bootGame(page);

    const rock = await page.evaluate(() => window.game.world.testRock);
    expect(rock).toBeTruthy();
    await page.evaluate(async ([r]) => {
      const m = await import('/src/web-games/far-west/src/horse.js');
      const cam = await import('/src/web-games/far-west/src/camera.js');
      m.teleportHorse(r.x + r.radius + 8, r.z, -Math.PI / 2); // east of the rock, facing it
      cam.injectLook(-Math.PI / 2 - cam.getCamYaw(), 0); // sync camera yaw (heading ease)
    }, [rock]);

    await page.keyboard.down('KeyW');
    await page.keyboard.down('ShiftLeft');
    await page.waitForTimeout(3000);
    await page.keyboard.up('ShiftLeft');
    await page.keyboard.up('KeyW');

    const dist = await page.evaluate(([r]) => {
      const p = window.game.player.position;
      return Math.hypot(p.x - r.x, p.z - r.z);
    }, [rock]);
    expect(dist).toBeGreaterThanOrEqual(rock.radius + 0.4);
  });

  test('tiro vai onde a mira aponta (coerencia mira-impacto)', async ({ page }) => {
    await bootGame(page);

    // Aim the camera at a terrain point ~30 m ahead, remember the exact ray
    const expected = await page.evaluate(() => {
      const THREE = window.THREE;
      const cam = window.game.camera;
      const dir = cam.getWorldDirection(new THREE.Vector3());
      // march the ray to the terrain (same method as combat.js terrainHit)
      for (let t = 4; t <= 220; t += 1) {
        const x = cam.position.x + dir.x * t;
        const y = cam.position.y + dir.y * t;
        const z = cam.position.z + dir.z * t;
        if (y < window.game.world.heightAt(x, z)) return { x, y, z };
      }
      return null;
    });
    expect(expected).toBeTruthy();

    await page.keyboard.down('KeyF'); // ADS: minimal spread
    await page.waitForTimeout(300);
    await page.mouse.move(400, 225);
    await page.mouse.down();
    await page.mouse.up();
    await page.waitForTimeout(300);
    await page.keyboard.up('KeyF');

    const err = await page.evaluate(([exp]) => {
      const s = window.game.flags.lastShot;
      if (!s) return Infinity;
      return Math.hypot(s.end.x - exp.x, s.end.y - exp.y, s.end.z - exp.z);
    }, [expected]);
    expect(err).toBeLessThan(0.5);
  });

  test('cavalo responde a WASD e altera posicao do jogador', async ({ page }) => {
    await bootGame(page);

    const before = await page.evaluate(() => ({ ...window.game.player.position }));
    await page.keyboard.down('KeyW');
    await page.waitForTimeout(1500);
    await page.keyboard.up('KeyW');

    const after = await page.evaluate(() => ({ ...window.game.player.position }));
    const moved = Math.hypot(after.x - before.x, after.z - before.z);
    expect(moved).toBeGreaterThan(1);
  });

  test('entidades-chave existem no mundo (bandidos, cidades, aldeias, trem)', async ({ page }) => {
    await bootGame(page);

    const entities = await page.evaluate(() => ({
      bandits: window.game.entities.bandits?.length ?? 0,
      towns: window.game.entities.towns?.length ?? 0,
      villages: window.game.entities.villages?.length ?? 0,
      deer: window.game.entities.deer?.length ?? 0,
      train: !!window.game.entities.train,
      camp: !!window.game.entities.camp,
    }));

    expect(entities.bandits).toBeGreaterThanOrEqual(5);
    expect(entities.towns).toBe(2);
    expect(entities.villages).toBe(2);
    expect(entities.deer).toBeGreaterThan(0);
    expect(entities.train).toBe(true);
    expect(entities.camp).toBe(true);
  });
});
