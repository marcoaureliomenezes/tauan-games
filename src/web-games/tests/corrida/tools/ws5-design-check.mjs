// ws5-design-check.mjs — validação geométrica da Serra do Tauan (dados puros,
// sem DOM): comprimento, slopes de descida, gatilho de voo nas 3 cristas e
// κ máx na zona de pouso (espelha probe PART E).
import { TRACKS } from '../../../speed-run/src/tracks.js';
import { sampleTrack } from '../../../speed-run/src/world.js';

const def = TRACKS.find((t) => t.key === 'serra');
const track = sampleTrack(def);
const S = track.samples, N = S.length, M = track.M;
const L = track.len;
console.log(`trackLen=${L.toFixed(0)} m  open=${track.open}  amostras=${N}`);

// posição (s) de cada ponto de controle aprox: amostra mais próxima
for (const [x, z] of def.pts) {
  let best = 0, bd = Infinity;
  for (let i = 0; i < N; i++) {
    const d = (S[i].pos.x - x) ** 2 + (S[i].pos.z - z) ** 2;
    if (d < bd) { bd = d; best = i; }
  }
  console.log(`  pt(${x},${z}) → s≈${(best / M).toFixed(3)}  y=${S[best].pos.y.toFixed(1)}`);
}

const clampI = (i) => Math.max(0, Math.min(N - 1, i));
const slopeAt = (i) => (S[clampI(i + 1)].pos.y - S[i].pos.y)
  / Math.max(S[i].pos.distanceTo(S[clampI(i + 1)].pos), 1e-6);
const kap = S.map((sm, i) => {
  const a = S[clampI(i - 3)], b = S[clampI(i + 3)];
  const arc = a.pos.distanceTo(sm.pos) + sm.pos.distanceTo(b.pos);
  return a.tan.angleTo(b.tan) / Math.max(arc, 1e-6);
});

// slope máximo da DESCIDA (sem bumps): varredura do slope de perfil puro
let maxDesc = 0, maxDescS = 0;
for (let i = 0; i < N; i++) {
  const sl = slopeAt(i);
  if (sl < maxDesc) { maxDesc = sl; maxDescS = S[i].s; }
}
console.log(`slope mín (descida mais íngreme, COM bumps)=${maxDesc.toFixed(3)} @ s=${maxDescS.toFixed(3)}`);

const GRAV = 28, VMAX = 76;
for (const b of def.bumps) {
  const ib = Math.round(b * M);
  let minSl = 0;
  for (let k = -20; k <= 20; k++) minSl = Math.min(minSl, slopeAt(clampI(ib + k)));
  const vy = Math.min(Math.max(2.5, -minSl * VMAX * 1.1), 3 + VMAX * 0.16);
  const D = 2 * VMAX * vy / GRAV + 10;
  let kMax = 0, kMaxS = 0;
  for (let k = 0; k <= Math.ceil(D / L * N); k++) {
    const i = clampI(ib + k);
    if (kap[i] > kMax) { kMax = kap[i]; kMaxS = S[i].s; }
  }
  const launch60 = minSl * 60 < -9;
  console.log(`crista s=${b}: climbV@60=${(minSl * 60).toFixed(1)} (${launch60 ? 'DECOLA' : 'NÃO DECOLA'})  vy@76=${vy.toFixed(1)}  D=${D.toFixed(0)} u  κmáx=${kMax.toFixed(5)} @ s=${kMaxS.toFixed(3)}  ${kMax < 0.002 ? 'OK' : 'CURVA!'}`);
}

// distância mínima entre pernas não-adjacentes (hairpin check p/ probe PART A)
let minLeg = Infinity;
for (let i = 0; i < N; i++) {
  for (let w = 15; w <= 40; w++) {
    const j = i + w;
    if (j >= N) break;
    const d = Math.hypot(S[i].pos.x - S[j].pos.x, S[i].pos.z - S[j].pos.z);
    if (d < minLeg) minLeg = d;
  }
}
console.log(`distância mín entre pernas (janela 15–40 amostras): ${minLeg.toFixed(1)} u`);
