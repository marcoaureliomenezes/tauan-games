// music-probe.mjs — Prova headless da trilha procedural (src/music.js).
//
//   cd src/web-games && node tests/corrida/tools/music-probe.mjs
//
// A (autoplay): antes de qualquer gesto, NENHUM AudioContext existe; após a
//   1ª tecla (gesto), o ctx é criado e chega a 'running'.
// B (scheduler): com o ctx rodando, o motor agenda notas continuamente
//   (music.scheduled cresce) e o loop de 8 compassos avança.
// C (intensidade): no menu o lead está zerado (mix esparsa); ao iniciar a
//   corrida o mix sobe p/ 'race' (lead/kick sobem).
// D (mute): tecla M zera o gain master e o 2º M restaura.

import { chromium } from 'playwright';
import { spawn } from 'child_process';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';

const PORT = process.env.TEST_PORT || '8094';
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..', '..');
const URL = `http://localhost:${PORT}/src/web-games/speed-run/`;

const results = [];
function check(name, ok, detail) {
  results.push({ name, ok, detail });
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name} — ${detail}`);
}

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
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('PAGE ERROR:', e.message));
page.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE:', m.text()); });

try {
  await page.goto(URL);
  await page.waitForFunction(() => window.__corridaReady === true, undefined, { timeout: 15000 });

  // ── PART A: autoplay policy — sem gesto, sem áudio ─────────────────────────
  const preGesture = await page.evaluate(() => window.__music.ctx === null);
  check('A1: nenhum AudioContext antes do 1º gesto (autoplay policy)', preGesture,
    `ctx=${preGesture ? 'null' : 'CRIADO CEDO DEMAIS'}`);

  await page.keyboard.press('ArrowDown');           // 1º gesto (navegação do menu)
  await page.waitForFunction(
    () => window.__music.ctx && window.__music.ctx.state === 'running', undefined, { timeout: 5000 });
  check('A2: AudioContext running após o 1º gesto', true,
    `state=${await page.evaluate(() => window.__music.ctx.state)}`);

  // ── PART B: scheduler agenda notas continuamente ───────────────────────────
  const sched = await page.evaluate(async () => {
    const m = window.__music, n0 = m.scheduled;
    await new Promise((r) => setTimeout(r, 1500));
    return { n0, n1: m.scheduled, dest: m.master.context.destination.channelCount };
  });
  check('B1: scheduler ativo (notas agendadas crescem no tempo)', sched.n1 - sched.n0 > 20,
    `+${sched.n1 - sched.n0} notas em 1,5 s (total ${sched.n1})`);

  // ── PART C: intensidade menu (esparsa) → corrida (mix cheia) ──────────────
  const menuMix = await page.evaluate(() => ({
    lead: window.__music.ch.lead.gain.value, snare: window.__music.ch.snare.gain.value,
  }));
  check('C1: menu = mix esparsa (sem lead nem caixa)',
    menuMix.lead < 0.01 && menuMix.snare < 0.01,
    `lead=${menuMix.lead.toFixed(3)} snare=${menuMix.snare.toFixed(3)}`);

  await page.keyboard.press('Enter');               // larga a corrida
  await page.waitForFunction(() => ['countdown', 'race'].includes(window.__corrida.phase), undefined, { timeout: 5000 });
  await page.waitForTimeout(1200);                  // setTargetAtTime converge
  const raceMix = await page.evaluate(() => ({
    lead: window.__music.ch.lead.gain.value, kick: window.__music.ch.kick.gain.value,
    intensity: window.__music.intensity,
  }));
  check('C2: corrida = mix cheia (lead e kick sobem)',
    raceMix.intensity === 'race' && raceMix.lead > 0.3 && raceMix.kick > 0.5,
    `intensity=${raceMix.intensity} lead=${raceMix.lead.toFixed(3)} kick=${raceMix.kick.toFixed(3)}`);

  // ── PART D: mute (tecla M) zera o master e restaura ────────────────────────
  await page.keyboard.press('KeyM');
  await page.waitForTimeout(300);
  const muted = await page.evaluate(() => ({
    gain: window.__music.master.gain.value, muted: window.__music.muted,
  }));
  check('D1: M muta — gain master vai a 0', muted.muted === true && muted.gain < 0.01,
    `muted=${muted.muted} gain=${muted.gain.toFixed(4)}`);

  await page.keyboard.press('KeyM');
  await page.waitForTimeout(300);
  const unmuted = await page.evaluate(() => ({
    gain: window.__music.master.gain.value, muted: window.__music.muted,
  }));
  check('D2: M de novo — som restaurado', unmuted.muted === false && unmuted.gain > 0.5,
    `muted=${unmuted.muted} gain=${unmuted.gain.toFixed(3)}`);
} finally {
  await browser.close();
  if (server) server.kill();
}

const fails = results.filter((r) => !r.ok);
console.log(`\n${results.length - fails.length}/${results.length} checks passaram`);
process.exit(fails.length ? 1 : 0);
