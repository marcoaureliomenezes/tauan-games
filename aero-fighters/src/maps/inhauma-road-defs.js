// maps/inhauma-road-defs.js — Poucas estradas CONTÍNUAS, autorais (v0.2.0 course-correction).
//
// Substitui o dump OSM de 2169 vias (spiderweb preto) por ~5 corredores limpos.
// Cada corredor é definido por poucos pontos de controle e suavizado por um
// Catmull-Rom PURO EM JS (sem THREE) — assim este módulo e inhauma-roads.js
// continuam importáveis no Node (validador/sim) e a mesma geometria alimenta
// colisão, carve de terreno, tráfego e render. O render (browser) reusa
// THREE.CatmullRomCurve3 para a fita visual (ver inhauma-road-render.js).
//
// Convenção de eixos: x=leste, z=norte (mesma do resto do mapa).
// Zonas de exclusão do aeroporto (x≈-560): TODAS as estradas passam longe delas
// (a leste de x=-435 ou a oeste de x=-685). Verificado por inhauma-fidelity.spec.js.

const SAMPLE_STEP = 12; // m entre amostras da spline (fita + colisão contínuas)

// ── Corredores autorais ───────────────────────────────────────────────────────
// kind: 'highway' | 'regional' | 'street'  (largura/faixa/velocidade derivam disso)
// closed: true → anel fechado (tráfego circula pra sempre)
// Terreno tem RIO + represa (vale/lâmina d'água) cortando o centro-sul e um SO.
// Todos os corredores ficam em terra SECA (ao norte do rio, longe do reservatório)
// e em rampa suave (contornam o flanco dos morros, não o pico). Verificado por
// tests/…/inhauma-fidelity.spec.js (nada submerso, sem pico, sem exclusão do aeroporto).
export const INHAUMA_ROAD_CORRIDORS = [
  {
    id: 'mg-238', name: 'MG-238', ref: 'MG-238', kind: 'highway', width: 15, closed: false,
    // Espinha central→NE ao NORTE do rio: sai da borda oeste da cidade (fora do morro
    // oeste), passa ao SUL do pico da serra de Sete Lagoas em rampa suave até a NE.
    control: [[-90, -30], [220, -10], [560, -40], [880, -70], [1160, -180], [1320, -330]],
  },
  {
    id: 'anel-inhauma', name: 'Anel de Inhaúma', ref: 'Anel', kind: 'regional', width: 11, closed: true,
    // Anel fechado em volta da cidade (levemente deslocado a leste, fora do morro
    // oeste) — arco sul AO NORTE do reservatório (z≤110). Carros circulam pra sempre.
    control: [[60, -175], [250, -115], [275, 25], [170, 105], [-70, 105], [-165, 30], [-150, -120], [-30, -180]],
  },
  {
    id: 'amg-0360', name: 'AMG-0360', ref: 'AMG-0360', kind: 'street', width: 8, closed: false,
    // Estrada rural ao norte, a LESTE do morro norte (contorna, não sobe o pico).
    control: [[120, -260], [260, -460], [420, -650], [560, -860]],
  },
  {
    id: 'mg-060', name: 'MG-060', ref: 'MG-060', kind: 'regional', width: 9, closed: false,
    // Estrada oeste (rumo a Cachoeira da Prata) — a OESTE do aeroporto e a LESTE do rio.
    control: [[-800, -320], [-760, -80], [-770, 140], [-745, 300]],
  },
];

const LANES_BY_KIND = { highway: 2, regional: 2, street: 1 };

// ── Catmull-Rom uniforme (puro JS) ────────────────────────────────────────────
function catmull(p0, p1, p2, p3, t) {
  const t2 = t * t, t3 = t2 * t;
  return 0.5 * (
    2 * p1 +
    (-p0 + p2) * t +
    (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
    (-p0 + 3 * p1 - 3 * p2 + p3) * t3
  );
}

/** Amostra uma spline Catmull-Rom pelos pontos de controle → polilinha densa {x,z}. */
export function sampleCorridor(control, closed) {
  const n = control.length;
  const pt = (i) => {
    if (closed) return control[((i % n) + n) % n];
    return control[Math.max(0, Math.min(n - 1, i))];
  };
  const out = [];
  const segCount = closed ? n : n - 1;
  for (let i = 0; i < segCount; i++) {
    const p0 = pt(i - 1), p1 = pt(i), p2 = pt(i + 1), p3 = pt(i + 2);
    const chord = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]);
    const steps = Math.max(2, Math.ceil(chord / SAMPLE_STEP));
    for (let s = 0; s < steps; s++) {
      const t = s / steps;
      out.push({ x: catmull(p0[0], p1[0], p2[0], p3[0], t), z: catmull(p0[1], p1[1], p2[1], p3[1], t) });
    }
  }
  if (closed) {
    out.push({ ...out[0] }); // fecha o anel
  } else {
    const last = control[n - 1];
    out.push({ x: last[0], z: last[1] });
  }
  return out;
}

/** Constrói os objetos de estrada (mesma forma que o antigo getInhaumaRoads()). */
export function buildRoadsFromDefs() {
  return INHAUMA_ROAD_CORRIDORS.map((c) => {
    const points = sampleCorridor(c.control, c.closed);
    return {
      id: c.id,
      kind: c.kind,
      sourceKind: c.kind,
      ref: c.ref,
      name: c.name,
      osmId: null,
      w: c.width,
      width: c.width,
      lanes: LANES_BY_KIND[c.kind] ?? 2,
      closed: !!c.closed,
      points,
    };
  });
}

/** Rotas nomeadas (usadas por placas de rodovia). Reusa a polilinha densa. */
export function buildNamedRoutes() {
  const routes = {};
  for (const road of buildRoadsFromDefs()) routes[road.id] = road.points;
  return routes;
}
