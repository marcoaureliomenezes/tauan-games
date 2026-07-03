// test-ballistics-unit.js — Solver balístico em campo central analítico (node puro).
// Prova AC-02 (parte node): o tiro CURVA sob gravidade e ainda acerta o alvo.

import { solveBallistic } from '../../../space-war/src/ballistics.js';

let failures = 0;
function check(name, cond, detail = '') {
  if (cond) console.log(`  ok  ${name}`);
  else { failures++; console.error(`FAIL  ${name}${detail ? ' — ' + detail : ''}`); }
}

// Campo central estilo Terra do jogo: μ=3e6, corpo na origem, raio 100.
const MU = 3.0e6;
const gravityFn = (p, out) => {
  const r2 = p.x * p.x + p.y * p.y + p.z * p.z;
  const r = Math.sqrt(r2);
  const a = MU / Math.max(r2, 100);
  out.x = -a * p.x / r; out.y = -a * p.y / r; out.z = -a * p.z / r;
};

console.log('· alvo fixo na superfície, tiro lento — o arco tem que dobrar');
const shot = solveBallistic({
  pos: { x: 0, y: 600, z: 0 }, vel: { x: 0, y: 0, z: 0 }, speed: 150,
  targetPos: { x: 70.7, y: 70.7, z: 0 }, gravityFn, tol: 25,
});
check('solução encontrada (ok)', shot.ok, `miss=${shot.miss?.toFixed(1)}`);
check('acerta dentro da tolerância', shot.miss <= 25, `miss=${shot.miss?.toFixed(1)}`);
// direção direta vs direção de tiro: a gravidade puxa p/ origem — o tiro mira "acima"
const dl = Math.hypot(70.7 - 0, 70.7 - 600, 0);
const direct = { x: 70.7 / dl, y: (70.7 - 600) / dl, z: 0 };
const dot = shot.dir.x * direct.x + shot.dir.y * direct.y + shot.dir.z * direct.z;
const ang = Math.acos(Math.max(-1, Math.min(1, dot)));
check('direção de tiro ≠ direção direta (arco curvo)', ang > 0.02, `ang=${ang.toFixed(3)} rad`);
check('arco amostrado para o HUD (≥3 pontos)', shot.points.length >= 3);

console.log('· alvo em MOVIMENTO orbital — o solver lidera o alvo');
const rT = 300;
const vOrb = Math.sqrt(MU / rT);            // ~100 u/s circular
const moving = solveBallistic({
  pos: { x: 0, y: 900, z: 0 }, vel: { x: 0, y: 0, z: 0 }, speed: 260,
  targetPos: { x: rT, y: 0, z: 0 }, targetVel: { x: 0, y: 0, z: vOrb },
  gravityFn, tol: 40,
});
check('solução p/ alvo móvel (ok)', moving.ok, `miss=${moving.miss?.toFixed(1)}`);
check('tempo de voo plausível (0 < tof < 45)', moving.tof > 0 && moving.tof < 45);

console.log('· nave em movimento — herança de velocidade compensada');
const inherit = solveBallistic({
  pos: { x: 0, y: 700, z: 0 }, vel: { x: 120, y: 0, z: 0 }, speed: 200,
  targetPos: { x: 0, y: 105, z: 0 }, gravityFn, tol: 30,
});
check('solução com velocidade herdada (ok)', inherit.ok, `miss=${inherit.miss?.toFixed(1)}`);

if (failures) { console.error(`\n${failures} falha(s)`); process.exit(1); }
console.log('\ntest-ballistics-unit: solver balístico OK');
