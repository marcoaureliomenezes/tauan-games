// WS-3 restart hygiene: renderer.info através de 3 restarts (KeyR em corrida).
// Espera TODOS os carros carregarem (GLB assíncrono) antes do 1º snapshot —
// senão a contagem sobe por carga/upload tardio, não por vazamento.
// Veredito PASS/FAIL: gpuGeo/gpuTex têm que ficar ESTÁVEIS (plateau) — crescer
// de forma descontínua = recurso órfão de GPU (o auditado: ~48 geometrias de
// roda clonadas por restart, hoje cacheadas em cars.js).
const { chromium } = require('@playwright/test');
const { spawn } = require('child_process');
const PORT = 8096;
(async () => {
  const server = spawn('python3', ['-m', 'http.server', String(PORT)], { cwd: '/home/marco/workspace/dadaia/repos/tauan-games', stdio: 'ignore' });
  await new Promise((r) => setTimeout(r, 800));
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.goto(`http://localhost:${PORT}/src/web-games/speed-run/`);
    await page.waitForFunction(() => window.__corridaReady === true, { timeout: 15000 });
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => window.__corrida.phase === 'race', { timeout: 8000 });
    await page.waitForFunction(() =>
      window.__corrida.cars.every((c) => c.mesh.children.length > 0), { timeout: 15000 });
    const snap = () => page.evaluate(() => {
      const G = window.__corrida;
      const r = G.renderer.info;
      const wg = new Set(), wt = new Set();
      const root = G.scene.getObjectByName('worldRoot');
      root.traverse((o) => {
        if (o.geometry) wg.add(o.geometry.uuid);
        const mats = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
        for (const m of mats) if (m.map) wt.add(m.map.uuid);
      });
      // geometrias/texturas únicas referenciadas pela CENA inteira (mundo+carros):
      // estável = nada órfão; gpuGeo/gpuTex ≤ isso e em plateau = sem vazamento
      const sg = new Set(), stx = new Set();
      G.scene.traverse((o) => {
        if (o.geometry) sg.add(o.geometry.uuid);
        const mats = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
        for (const m of mats) for (const k of ['map', 'alphaMap', 'lightMap', 'emissiveMap']) if (m[k]) stx.add(m[k].uuid);
      });
      return { gpuTex: r.memory.textures, gpuGeo: r.memory.geometries, worldGeo: wg.size, worldTex: wt.size, sceneGeo: sg.size, sceneTex: stx.size };
    });
    const rows = [];
    rows.push(await snap());
    for (let i = 0; i < 3; i++) {
      await page.keyboard.press('KeyR');
      await page.waitForFunction(() => window.__corrida.phase === 'race', { timeout: 8000 });
      await page.waitForTimeout(400);
      rows.push(await snap());
    }
    rows.forEach((r, i) => console.log(`restart ${i}:`, JSON.stringify(r)));
    const stable = (k) => rows.every((r) => r[k] === rows[0][k]);
    const ok = stable('gpuGeo') && stable('gpuTex') && stable('sceneGeo') && stable('sceneTex');
    console.log(ok ? 'PASS: contagens estáveis em 3 restarts (sem vazamento de GPU)'
      : 'FAIL: gpuGeo/gpuTex cresceram entre restarts — vazamento residual');
    process.exitCode = ok ? 0 : 1;
  } finally { await browser.close(); server.kill(); }
})().catch((e) => { console.error(e); process.exit(1); });
