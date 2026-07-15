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
//
// aero-fighters-inhauma-serra-v1 (T-04): os 4 corredores foram RE-AUTORADOS sobre o
// novo relevo DEM (vale alpino estilo Chamonix, T-01/T-02/T-03) — os pontos de controle
// abaixo já não descrevem a antiga base FBM. Metodologia: sondagem Node de
// sampleDemHeight/demSlopeAt (+ inhaumaContinuousHeight, ao vivo, para o resultado
// final) para (a) traçar o eixo do vale perto da origem (piso do vale ~4-14 m, sobe
// suavemente a leste/oeste e mais abruptamente a nordeste rumo à serra-leste), (b)
// medir a distância de cada ponto ao rio (T-05, `inhauma-river.js`, traçado pela
// drenagem real do DEM — landed em paralelo a esta mesma tarefa) e manter os corredores
// fora do canal molhado (`RIVER_HALF_WIDTH_M`=20 m) exceto onde uma travessia é
// deliberada (ver comentário do MG-238 e o relatório de T-04 para T-06), e (c) achar
// relevo real (encosta genuína, não platô) para as pontas abertas sempre que o DEM
// oferece — preferido a uma colina de portal sintética quando disponível.
const SAMPLE_STEP = 12; // m entre amostras da spline (fita + colisão contínuas)

// ── Corredores autorais ───────────────────────────────────────────────────────
// kind: 'highway' | 'regional' | 'street'  (largura/faixa/velocidade derivam disso)
// closed: true → anel fechado (tráfego circula pra sempre)
// O rio (T-05, `inhauma-river.js#getInhaumaRiverPolyline`) segue a drenagem real do
// DEM perto da origem — o vale ali é largo e raso, então cidade/anel/rio convivem no
// mesmo trecho. MG-238 cruza o canal UMA vez (travessia curta, ~35 m, ver comentário
// abaixo) — candidato natural a ponte T-06. Os demais 3 corredores ficam fora do canal
// molhado (`distanceToRiver` ≥ ~70 m em todo o traçado amostrado).
// WS-2 (terminação de estradas): NENHUMA estrada termina no ar/no nada. Toda ponta
// aberta ENTRA NUM TÚNEL numa encosta — ou de relevo REAL (declive genuíno do DEM) ou de
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
    startcap: 'tunnel', // SW: sai de um túnel no flanco oeste do vale (relevo REAL, DEM)
    endcap: 'tunnel',   // NE: entra num túnel no flanco da serra-leste (relevo REAL, DEM)
    // Espinha SW→NE seguindo o eixo/piso do vale DEM (h≈5-11 m perto da origem): sai de
    // um túnel no flanco oeste (-300,15; h≈14 m, rampa suave ~0.04, a leste da clareira
    // do aeroporto), atravessa a periferia em curva gentil — CRUZANDO o canal do rio
    // (T-05) uma única vez, em ~(107,-16)→(144,-13), ~35 m de travessia curta (ângulo
    // raso, ~40° do perpendicular) — candidato de ponte para T-06 — e sobe o flanco real
    // da serra-leste (h≈45→142 m, declive ~0.2-0.35, sem passar de crista/pico) até o
    // portal em (1335,-70).
    control: [[-300, 15], [-90, -30], [220, -10], [560, -40], [880, -70], [1160, -180], [1320, -330], [1330, -150], [1335, -70]],
  },
  {
    id: 'anel-inhauma', name: 'Anel de Inhaúma', ref: 'Anel', kind: 'regional', width: 11, closed: true,
    // Anel fechado em volta do centro da cidade, deslocado ao norte da posição v0.2.0
    // para (a) ficar fora do canal do rio (T-05) — o arco leste passa a ~90 m do rio,
    // claramente fora da influência (canal 20 m + margem 26 m) em vez de correr quase
    // paralelo a ele — e (b) manter ~49 m de folga do leito da MG-238 (evita correr
    // colado/paralelo ao carve da rodovia; só o cruzamento real com a AMG-0360 ao norte
    // fica próximo, tratado como interseção). Carros circulam pra sempre.
    control: [[60, -285], [225, -270], [165, -185], [-10, -110], [-90, -95], [-165, -80], [-150, -230], [-30, -290]],
  },
  {
    id: 'amg-0360', name: 'AMG-0360', ref: 'AMG-0360', kind: 'street', width: 8, closed: false,
    startcap: 'tunnel', startMound: true, // sul: piso de vale raso (h≈5 m, sem relevo real) → colina de portal
    endcap: 'tunnel',                     // norte: reencaminhado para a encosta real que o DEM
    // oferece mais a noroeste (h≈10→38 m, declive ~0.15, ao invés do antigo final plano
    // que precisava de colina sintética) — portal entra direto no relevo genuíno.
    control: [[120, -260], [220, -480], [280, -720], [220, -950], [100, -1150]],
  },
  {
    id: 'mg-060', name: 'MG-060', ref: 'MG-060', kind: 'regional', width: 9, closed: false,
    startcap: 'tunnel', endcap: 'tunnel', // corredor oeste — as duas pontas entram em túnel
    // Corredor oeste (a OESTE do aeroporto, a LESTE do vale), pontos inalterados do
    // course-correction anterior — mas agora o DEM já oferece relevo REAL e substancial
    // nas duas pontas (sul h≈150 m declive~0.29; norte h≈48 m declive~0.11), então as
    // colinas de portal sintéticas (antes necessárias sobre o piso ~21 m quase plano)
    // deixaram de ser precisas: startMound/endMound removidos.
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
