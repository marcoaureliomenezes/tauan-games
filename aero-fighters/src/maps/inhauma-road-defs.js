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
// WS-2 (terminação de estradas): NENHUMA estrada termina no ar/no nada. Toda ponta
// aberta ENTRA NUM TÚNEL numa encosta — ou de relevo REAL (serra/morro nomeado) ou de
// uma COLINA DE PORTAL sintética (getPortalMounds abaixo) posta na direção de saída da
// estrada, em terra seca e longe do aeroporto/rio (verificado contra o campo de altura).
// Anéis fechados não têm ponta. Regra: uma estrada é contínua (segue o mapa) e, no pior
// caso, entra num túnel — jamais para como um toco de fita em terreno plano.
//  - startcap/endcap: 'tunnel' → portal de túnel (inhauma-road-props.js) na ponta.
//  - startMound/endMound: true → a ponta NÃO fica sobre relevo real, então uma colina de
//    portal é gerada ali (getPortalMounds) para o túnel furar uma encosta de verdade.
export const INHAUMA_ROAD_CORRIDORS = [
  {
    id: 'mg-238', name: 'MG-238', ref: 'MG-238', kind: 'highway', width: 15, closed: false,
    startcap: 'tunnel', // SW: sai de um túnel no flanco dos morros-oeste (relevo REAL)
    endcap: 'tunnel',   // NE: entra num túnel no flanco da serra-leste (relevo REAL)
    // Espinha SW→NE ao NORTE do rio: emerge de um túnel no flanco dos morros-oeste
    // (-380,40), cruza a periferia, passa ao SUL do pico de Sete Lagoas em rampa suave e
    // curva para o flanco da serra-leste (1300,120), onde entra noutro túnel. Ambas as
    // pontas assentam em relevo real (h≈70 e h≈35) — sem colina sintética.
    control: [[-285, 8], [-90, -30], [220, -10], [560, -40], [880, -70], [1160, -180], [1320, -330], [1330, -150], [1335, -70]],
  },
  {
    id: 'anel-inhauma', name: 'Anel de Inhaúma', ref: 'Anel', kind: 'regional', width: 11, closed: true,
    // Anel fechado em volta da cidade (levemente deslocado a leste, fora do morro
    // oeste) — arco sul AO NORTE do reservatório (z≤110). Carros circulam pra sempre.
    control: [[60, -175], [250, -115], [275, 25], [170, 105], [-70, 105], [-165, 30], [-150, -120], [-30, -180]],
  },
  {
    id: 'amg-0360', name: 'AMG-0360', ref: 'AMG-0360', kind: 'street', width: 8, closed: false,
    startcap: 'tunnel', // início no flanco do morro-norte (relevo REAL) → túnel
    endcap: 'tunnel',   // norte rural: entra num túnel de colina de portal (endMound)
    endMound: true,     // a ponta norte (697,-1068) fica em rural plano → colina sintética
    // Estrada rural ao norte, a LESTE do morro norte (contorna, não sobe o pico).
    control: [[120, -260], [260, -460], [420, -650], [560, -860], [697, -1068]],
  },
  {
    id: 'mg-060', name: 'MG-060', ref: 'MG-060', kind: 'regional', width: 9, closed: false,
    startcap: 'tunnel', endcap: 'tunnel', // corredor oeste — as duas pontas entram em túnel
    startMound: true, endMound: true,     // ambas em rural plano (~21 m) → colinas de portal
    // Corredor oeste (a OESTE do aeroporto, a LESTE do rio). A ponta sul foi RECUADA para
    // fora do vale do reservatório (antes terminava submersa em (-780,410), h=0): agora
    // acaba em terra seca (-795,20) e entra num túnel. A ponta norte idem.
    control: [[-841, -567], [-800, -320], [-780, -120], [-795, 20]],
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

// ── Colinas de portal de túnel (WS-2) ─────────────────────────────────────────
// Uma estrada NÃO pode terminar no nada; onde a ponta não cai num relevo real, geramos
// uma colina arredondada na direção de saída da estrada para o túnel furar uma encosta.
// O centro fica a `radius` da ponta (borda interna da colina encosta na ponta), então a
// estrada segue plana até o portal e a colina sobe logo além dele. Puro JS (Node-safe):
// inhauma-scene.js soma estas colinas ao campo de altura (visual + colisão).
const PORTAL_MOUND = { radius: 150, peak: 46 };

/** Devolve [{x,z,radius,peak}] das colinas de portal para pontas marcadas com *Mound. */
export function getPortalMounds() {
  const out = [];
  for (const c of INHAUMA_ROAD_CORRIDORS) {
    if (c.closed) continue;
    const pts = sampleCorridor(c.control, c.closed);
    const n = pts.length;
    const addMound = (atStart) => {
      const a = atStart ? pts[0] : pts[n - 1];
      const b = atStart ? pts[1] : pts[n - 2];
      const dx = a.x - b.x, dz = a.z - b.z;           // b→a = direção de saída da estrada
      const L = Math.hypot(dx, dz) || 1;
      out.push({ x: a.x + (dx / L) * PORTAL_MOUND.radius, z: a.z + (dz / L) * PORTAL_MOUND.radius, radius: PORTAL_MOUND.radius, peak: PORTAL_MOUND.peak });
    };
    if (c.startMound) addMound(true);
    if (c.endMound) addMound(false);
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
      endcap: c.endcap || null,     // WS-2: 'tunnel' → portal na ponta final
      startcap: c.startcap || null, // WS-2: 'tunnel' → portal na ponta inicial
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
