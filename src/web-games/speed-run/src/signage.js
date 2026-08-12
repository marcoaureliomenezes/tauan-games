// signage.js (WS-6) — SINALIZAÇÃO DE CORRIDA GERADA POR DADOS ("placas ao
// redor da pista", estilo Top Gear). Nada é posicionado à mão: tudo deriva
// das amostras da spline (world.sampleTrack):
//
//   · CHEVRONS (seta amarela/preta) ANTES de cada curva com κ ≥ K_WARN:
//     2 placas na lateral DIREITA (−25 m e −10 m da entrada) + 1 placa no
//     ÁPICE pelo lado de FORA da curva, todas de frente p/ quem se aproxima;
//   · LOMBADA: placa amarela 30 m antes de CADA lombada desenhada (def.bumps);
//   · VADO: placa amarela 30 m antes de CADA vado (def.fords) — unifica o
//     aviso solto do sprint com os circuitos;
//   · TÁBUAS 300/200/100: antes da curva mais fechada de cada CIRCUITO;
//   · AD: variedade de letreiro (usada tb. em buildSigns do world.js).
//
// CUSTO: 2 draw calls no TOTAL — as placas são quads MESCLADOS num único
// BufferGeometry (UVs no atlas roadSignAtlas) e os postes num InstancedMesh.
//
// CORREDOR DIRIGÍVEL: o centro de cada placa/poste fica a width/2 + 2,0 m da
// centerline (largura LOCAL — full-scan 2026-08-11). O canto interno da placa
// mais larga (2,4 m) fica a ≥ 0,8 m da borda da estrada (> 0,5 m exigidos).
// A geometria mesclada é type 'BufferGeometry' → o full-scan NÃO a varre;
// por isso o clearance é MEDIDO aqui (por canto de placa × amostra) e
// exposto em world.signage p/ o spec e2e auditar (ws6-signs.spec.js).

import * as THREE from '../../vendor/three.module.min.js';
import { roadSignAtlas, signTileUV } from './textures.js';

// κ mínimo p/ sinalizar a curva (R ≲ 220 m). Medido 2026-08-11 (κ máx real por
// pista: city 0,0375 / serra 0,0235 / forest 0,0096 / arizona 0,0068 — limiar
// fixo mais alto deixava o arizona SEM placa nenhuma).
const K_WARN = 0.0045;
const K_APEX = 0.007;           // ápice sinalizado só em curva realmente fechada
const EDGE_CLEAR = 2.0;         // centro do poste: meia-pista + 2,0 m

// ── Curvatura por amostra (mesma fórmula do full-scan/probe: ângulo entre
// tan[i−3] e tan[i+3] ÷ arco) + DIREÇÃO da curva (sinal do cross.y) ──────────
export function trackCurvature(track) {
  const S = track.samples, N = S.length;
  const clampI = (i) => track.open ? Math.max(0, Math.min(N - 1, i)) : ((i % N) + N) % N;
  const kap = new Float64Array(N), turn = new Float64Array(N);
  for (let i = 0; i < N; i++) {
    const a = S[clampI(i - 3)], b = S[clampI(i + 3)];
    const arc = a.pos.distanceTo(S[i].pos) + S[i].pos.distanceTo(b.pos);
    kap[i] = a.tan.angleTo(b.tan) / Math.max(arc, 1e-6);
    // cross(a,b).y = a.z·b.x − a.x·b.z; > 0 = curva à ESQUERDA do piloto
    turn[i] = a.tan.z * b.tan.x - a.tan.x * b.tan.z;
  }
  return { kap, turn };
}

// anda `meters` para TRÁS ao longo da centerline a partir do índice i
function walkBack(track, i, meters) {
  const S = track.samples, N = S.length;
  const clampI = (k) => track.open ? Math.max(0, Math.min(N - 1, k)) : ((k % N) + N) % N;
  let acc = 0, j = i;
  while (acc < meters) {
    const pj = clampI(j - 1);
    acc += S[pj].pos.distanceTo(S[j].pos);
    if (track.open && pj === 0) break;
    j = pj;
  }
  return j;
}

// ── Lista de placas da pista (dados puros — testável sem render) ────────────
// Cada item: { kind, tile, i (amostra), sideSign (+1 = lado `side`, −1 = o
// outro), w, h, cy (centro Y sobre a estrada) }.
export function planSigns(def, track) {
  const S = track.samples, N = S.length, L = track.len;
  const { kap, turn } = trackCurvature(track);
  const lastI = track.open ? N - 1 : N;
  const clampI = (k) => track.open ? Math.max(0, Math.min(N - 1, k)) : ((k % N) + N) % N;
  const signs = [];

  // ── runs de curvatura acima do limiar → chevrons ──────────────────────────
  const runs = [];
  let i = 0;
  while (i < lastI) {
    if (kap[i] < K_WARN) { i++; continue; }
    let j = i, peak = 0, peakI = i, turnAcc = 0, arc = 0;
    while (j < lastI && kap[j] >= K_WARN && j - i < N / 2) {
      if (kap[j] > peak) { peak = kap[j]; peakI = j; }
      turnAcc += turn[j];
      arc += S[j].pos.distanceTo(S[clampI(j + 1)].pos);
      j++;
    }
    if (arc >= 6) runs.push({ entry: i, peakI, peak, left: turnAcc > 0 });
    i = j + 1;
  }
  // curva mais fechada do circuito → tábuas 300/200/100
  let sharpest = null;
  for (const r of runs) if (!sharpest || r.peak > sharpest.peak) sharpest = r;

  for (const r of runs) {
    const tile = r.left ? 1 : 0;                  // seta aponta p/ o lado da curva
    for (const back of [25, 10]) {
      signs.push({ kind: 'chevron', tile, i: walkBack(track, r.entry, back), sideSign: -1, w: 2.4, h: 1.2, cy: 1.9 });
    }
    if (r.peak >= K_APEX) {
      // placa no ápice pelo lado de FORA (curva à esq. → fora = direita e vice-versa)
      signs.push({ kind: 'chevron-apex', tile, i: r.peakI, sideSign: r.left ? -1 : 1, w: 2.4, h: 1.2, cy: 1.9 });
    }
  }
  if (sharpest && !track.open) {
    for (const [d, tile] of [[300, 4], [200, 5], [100, 6]]) {
      if (d < L * 0.9) signs.push({ kind: 'dist', tile, i: walkBack(track, sharpest.entry, d), sideSign: -1, w: 1.1, h: 0.55, cy: 1.45 });
    }
  }
  // LOMBADA 30 m antes de cada crista desenhada
  for (const b of def.bumps) {
    const ib = clampI(Math.round(b * track.M));
    signs.push({ kind: 'lombada', tile: 2, i: walkBack(track, ib, 30), sideSign: -1, w: 2.2, h: 1.1, cy: 1.85 });
  }
  // VADO 30 m antes de cada lâmina d'água
  for (const [a] of (def.fords || [])) {
    const ia = clampI(Math.round(a * track.M));
    signs.push({ kind: 'vado', tile: 3, i: walkBack(track, ia, 30), sideSign: -1, w: 2.2, h: 1.1, cy: 1.85 });
  }

  // ── dedupe: placas do MESMO lado a menos de 12 m — prioridade vado >
  //    lombada > dist > chevron (as de aviso legal ganham o poste) ───────────
  const prio = { vado: 0, lombada: 1, dist: 2, chevron: 3, 'chevron-apex': 4 };
  signs.sort((a, b) => prio[a.kind] - prio[b.kind]);
  const kept = [];
  for (const sg of signs) {
    const p = S[sg.i].pos;
    const clash = kept.some((k) => k.sideSign === sg.sideSign
      && Math.hypot(S[k.i].pos.x - p.x, S[k.i].pos.z - p.z) < 12);
    if (!clash) kept.push(sg);
  }
  return kept;
}

// ── Clearance de UMA placa (T-03: extraído de dentro de buildSignsWS6 para
// ser testável em Node sem THREE.Mesh nem canvas — pura função de dados,
// MESMA fórmula/valores de antes, só reorganizada) ──────────────────────────
// Recebe a amostra `sm` (S[sg.i]) e o descritor `sg` (item de planSigns) e
// recalcula os 2 cantos do quad (mesma geometria do laço de construção acima:
// offset = meia-pista + EDGE_CLEAR, normal horizontal −tangente, eixo r =
// cross(up, n)) e mede, contra TODA amostra da centerline (passo 3), a MENOR
// folga canto→centerline − meia-pista local. Positivo = fora do corredor
// dirigível; negativo = a placa invade o corredor (bug).
export function measureClearance(track, sm, sg) {
  const S = track.samples, N = S.length;
  const off = (sm.width / 2 + EDGE_CLEAR) * sg.sideSign;
  const cx = sm.pos.x + sm.side.x * off, cz = sm.pos.z + sm.side.z * off;
  const nx = -sm.tan.x, nz = -sm.tan.z;
  const nl = Math.hypot(nx, nz) || 1;
  const rx = nz / nl, rz = -nx / nl;              // cross(up, n) já unitário
  const hw = sg.w / 2;
  const corners = [[cx - rx * hw, cz - rz * hw], [cx + rx * hw, cz + rz * hw]];
  let best = Infinity;
  for (const [x, z] of corners) {
    for (let k = 0; k < N; k += 3) {
      const dx = S[k].pos.x - x, dz = S[k].pos.z - z;
      const pen = Math.hypot(dx, dz) - S[k].width / 2;
      if (pen < best) best = pen;
    }
  }
  return +best.toFixed(3);
}

// ── Construção: 1 BufferGeometry mesclado (atlas) + 1 InstancedMesh (postes)
export function buildSignsWS6(def, track, scene) {
  const S = track.samples;
  const planned = planSigns(def, track);
  if (!planned.length) return [];
  const atlas = roadSignAtlas();

  const pos = [], uv = [], idx = [];
  const up = new THREE.Vector3(0, 1, 0);
  const n = new THREE.Vector3(), r = new THREE.Vector3(), c = new THREE.Vector3();
  const postXforms = [];
  const report = [];

  for (const sg of planned) {
    const sm = S[sg.i];
    const off = (sm.width / 2 + EDGE_CLEAR) * sg.sideSign;
    c.set(sm.pos.x + sm.side.x * off, sm.pos.y + sg.cy, sm.pos.z + sm.side.z * off);
    // normal horizontal de frente p/ quem CHEGA (−tangente)
    n.set(-sm.tan.x, 0, -sm.tan.z).normalize();
    r.crossVectors(up, n).normalize();            // eixo horizontal da placa
    const t = signTileUV(sg.tile);
    const hw = sg.w / 2, hh = sg.h / 2;
    const base = pos.length / 3;
    // 4 cantos (cima-esq, cima-dir, baixo-esq, baixo-dir) × UV do tile
    pos.push(
      c.x - r.x * hw, c.y + hh, c.z - r.z * hw,
      c.x + r.x * hw, c.y + hh, c.z + r.z * hw,
      c.x - r.x * hw, c.y - hh, c.z - r.z * hw,
      c.x + r.x * hw, c.y - hh, c.z + r.z * hw,
    );
    uv.push(t.u0, t.v1, t.u1, t.v1, t.u0, t.v0, t.u1, t.v0);
    idx.push(base, base + 2, base + 1, base + 1, base + 2, base + 3);
    postXforms.push([c.x, sm.pos.y, c.z, sg.cy - hh]);   // poste até a borda inferior
    // clearance real p/ auditoria (corredor = borda + 0,5 m) — measureClearance
    // (T-03) recalcula os mesmos 2 cantos a partir de sm/sg; ver Node test.
    report.push({ kind: sg.kind, s: sm.s, clearance: measureClearance(track, sm, sg) });
  }

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  const boards = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ map: atlas, side: THREE.DoubleSide }));
  scene.add(boards);

  // postes galvanizados (1 draw call p/ TODOS)
  const postGeo = new THREE.CylinderGeometry(0.09, 0.09, 1, 5);
  const posts = new THREE.InstancedMesh(postGeo,
    new THREE.MeshLambertMaterial({ color: 0x8a9098 }), postXforms.length);
  const m = new THREE.Matrix4();
  postXforms.forEach(([x, yRoad, z, hTop], k) => {
    const h = Math.max(hTop, 0.4);
    m.makeScale(1, h, 1);
    m.setPosition(x, yRoad + h / 2, z);
    posts.setMatrixAt(k, m);
  });
  scene.add(posts);

  return report;
}
