// idea-v2-shots.mjs — Screenshots 1280×720 do Idea Adventure v2 (réplica fiel
// às fotos) nos ângulos de referência: front 3/4, perfil lateral, rear 3/4
// (estepe com cintas em V visível) e traseira reta.
//
//   cd src/web-games && TEST_PORT=8094 node tests/corrida/tools/idea-v2-shots.mjs
//
// Saída: tests/corrida/screenshots/idea-v2-{front34,side,rear34,rear}.png

import { chromium } from 'playwright';
import { spawn } from 'child_process';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';

const PORT = process.env.TEST_PORT || '8094';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..', '..', '..', '..', '..');
const SHOTS = path.join(HERE, '..', 'screenshots');
const URL = `http://localhost:${PORT}/src/web-games/speed-run/`;

function portUp() {
  return new Promise((resolve) => {
    const req = http.get(`http://localhost:${PORT}`, () => resolve(true));
    req.on('error', () => resolve(false));
    req.setTimeout(500, () => { req.destroy(); resolve(false); });
  });
}

let server = null;
if (!(await portUp())) {
  server = spawn('python3', ['-m', 'http.server', String(PORT)], { cwd: REPO_ROOT, stdio: 'ignore' });
  for (let i = 0; i < 20 && !(await portUp()); i++) await new Promise((r) => setTimeout(r, 200));
  console.log(`server próprio na porta ${PORT} (pid ${server.pid})`);
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', (e) => console.log('PAGE ERROR:', e.message));
page.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE:', m.text()); });

// ângulos: [distância à frente(+)/trás(−), lado, altura da câmera, alvo Y]
const ANGLES = [
  ['front34', 4.8, 2.6, 1.8, 0.8],
  ['side', 0.0, -6.0, 1.1, 0.8],
  ['rear34', -4.8, -2.6, 1.8, 0.8],
  ['rear', -5.2, 0.0, 1.3, 0.8],
];

try {
  await page.goto(URL);
  await page.waitForFunction(() => window.__corridaReady === true, undefined, { timeout: 15000 });
  await page.keyboard.press('Enter');          // Idea é o carro 0 (default)
  await page.waitForFunction(() => window.__corrida.phase === 'race', undefined, { timeout: 10000 });
  await page.evaluate(() => {
    const G = window.__corrida;
    G.player.isPlayer = true;
    G.player.st.v = 0;                          // parado p/ retrato
  });

  for (const [name, fwd, side, camY, lookY] of ANGLES) {
    await page.evaluate(([fwd, side, camY, lookY]) => {
      const G = window.__corrida;
      const st = G.player.st;
      const fx = -Math.sin(st.heading), fz = -Math.cos(st.heading);   // frente do carro
      const sx = -fz, sz = fx;                                        // lateral esquerda
      G.camOverride = (camera) => {
        camera.position.set(
          st.pos.x + fx * fwd + sx * side,
          st.pos.y + camY,
          st.pos.z + fz * fwd + sz * side);
        camera.lookAt(st.pos.x, st.pos.y + lookY, st.pos.z);
        camera.fov = 50;
        camera.updateProjectionMatrix();
      };
    }, [fwd, side, camY, lookY]);
    await page.waitForTimeout(800);            // alguns frames p/ câmera assentar
    const file = path.join(SHOTS, `idea-v2-${name}.png`);
    await page.screenshot({ path: file });
    console.log(`screenshot: ${file}`);
  }
} finally {
  await browser.close();
  if (server) server.kill();
}
