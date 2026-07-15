import * as THREE from '../../vendor/three.module.min.js';

export const AIRPORT_TEXT = 'AEROPORTO DO TAUAN E DO PAPAI';

export const desertAirport = Object.freeze({
  id: 'tauan-papai-desert',
  map: 'desert',
  elevation: 0,
  runway: { center: { x: -160, z: 120 }, heading: 0, length: 760, width: 58 },
  touchdownZone: { center: { x: -160, z: -130 }, length: 180, width: 48 },
  taxiway: { center: { x: -160, z: 260 }, length: 180, width: 34 },
  serviceZone: { center: { x: -160, z: 350 }, length: 86, width: 70 },
  text: { value: AIRPORT_TEXT, center: { x: 20, z: 170 }, width: 360, depth: 42 },
});

export const INHAUMA_AIRPORT_TEXT = 'AERODROMO INHAUMA';

export const inhaumaAirport = Object.freeze({
  id: 'aerodromo-inhauma',
  map: 'inhauma',
  elevation: 0,
  runway: { center: { x: -560, z: 320 }, heading: 0, length: 620, width: 52 },
  touchdownZone: { center: { x: -560, z: 140 }, length: 160, width: 44 },
  taxiway: { center: { x: -560, z: 430 }, length: 160, width: 30 },
  serviceZone: { center: { x: -560, z: 475 }, length: 76, width: 84 },
  text: { value: INHAUMA_AIRPORT_TEXT, center: { x: -500, z: 450 }, width: 260, depth: 36 },
});

export const ISLANDS_AIRPORT_TEXT = 'BASE AERONAVAL DO TAUAN';

// Pista costeira (ADR-U2): atol artificial em mar aberto, elevation acima das ondas.
export const islandsAirport = Object.freeze({
  id: 'tauan-atoll-islands',
  map: 'islands',
  elevation: 2.0,
  runway: { center: { x: -160, z: 120 }, heading: 0, length: 760, width: 58 },
  touchdownZone: { center: { x: -160, z: -130 }, length: 180, width: 48 },
  taxiway: { center: { x: -160, z: 260 }, length: 180, width: 34 },
  serviceZone: { center: { x: -160, z: 350 }, length: 86, width: 70 },
  text: { value: ISLANDS_AIRPORT_TEXT, center: { x: 20, z: 170 }, width: 360, depth: 42 },
});

export const RIO_AIRPORT_TEXT = 'AEROPORTO SANTOS DUMONT';

// Pista no aterro, a leste da malha urbana (prédios param em x=450).
export const rioAirport = Object.freeze({
  id: 'santos-dumont-rio',
  map: 'rio',
  elevation: 0.45,
  runway: { center: { x: 560, z: 200 }, heading: 0, length: 620, width: 52 },
  touchdownZone: { center: { x: 560, z: 20 }, length: 160, width: 44 },
  taxiway: { center: { x: 560, z: 440 }, length: 140, width: 30 },
  serviceZone: { center: { x: 560, z: 560 }, length: 86, width: 70 },
  text: { value: RIO_AIRPORT_TEXT, center: { x: 640, z: 480 }, width: 280, depth: 38 },
});

const airportGroups = new Map();

const AIRPORT_REGISTRY = { desert: desertAirport, inhauma: inhaumaAirport, islands: islandsAirport, rio: rioAirport };

export function getAirportForMap(map = 'desert') {
  return AIRPORT_REGISTRY[map] ?? desertAirport;
}

function addBox(group, x, y, z, sx, sy, sz, color) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(sx, sy, sz),
    new THREE.MeshLambertMaterial({ color }),
  );
  mesh.position.set(x, y + sy / 2, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);
  return mesh;
}

function addPavement(group, center, width, length, color, elevation = 0) {
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(width, length),
    new THREE.MeshLambertMaterial({
      color,
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    }),
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(center.x, elevation + 0.12, center.z);
  mesh.receiveShadow = true;
  group.add(mesh);
  return mesh;
}

function addGroundLabel(group, airport, labelText = AIRPORT_TEXT) {
  const canvas = document.createElement('canvas');
  canvas.width = 2048;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#101810';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.font = 'bold 118px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#f7f0b0';
  ctx.fillText(labelText, canvas.width / 2, canvas.height / 2);
  const tex = new THREE.CanvasTexture(canvas);
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(airport.text.width, airport.text.depth), mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(airport.text.center.x, airport.elevation + 0.21, airport.text.center.z);
  group.add(mesh);

  const lightMat = new THREE.MeshBasicMaterial({ color: 0xfff6a0 });
  const lights = [];
  for (let i = 0; i < 28; i++) {
    const t = i / 27;
    for (const side of [-1, 1]) {
      const l = new THREE.Mesh(new THREE.SphereGeometry(1.4, 8, 6), lightMat);
      l.position.set(
        airport.text.center.x - airport.text.width / 2 + airport.text.width * t,
        airport.elevation + 0.7,
        airport.text.center.z + side * airport.text.depth * 0.68,
      );
      group.add(l);
      lights.push(l);
    }
  }
  return { mesh, lights };
}

/**
 * T-04: batches N identical boxes into ONE InstancedMesh (one draw call) instead of
 * N separate Mesh/Geometry/Material triples — cheap, procedural, vertex/Lambert-friendly.
 * Positions are the box CENTER on the ground plane; the box is lifted by sy/2 so it
 * sits on `y` like `addBox` does.
 */
function addInstancedBoxes(group, size, color, positions, opts = {}) {
  if (!positions.length) return null;
  const geom = new THREE.BoxGeometry(size.sx, size.sy, size.sz);
  const mat = new THREE.MeshLambertMaterial({ color, ...opts });
  const mesh = new THREE.InstancedMesh(geom, mat, positions.length);
  const m = new THREE.Matrix4();
  positions.forEach((p, i) => {
    m.makeTranslation(p.x, p.y + size.sy / 2, p.z);
    mesh.setMatrixAt(i, m);
  });
  mesh.instanceMatrix.needsUpdate = true;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);
  return mesh;
}

/** T-04: runway edge lights, instanced (audit: was N individual Mesh boxes). */
function addRunwayEdgeLights(group, airport, lightCount = 5) {
  const e = airport.elevation;
  const r = airport.runway;
  const lightStep = Math.floor(r.length / (lightCount * 2 + 1) / 2) * 2;
  const positions = [];
  for (let i = -lightCount; i <= lightCount; i++) {
    positions.push({ x: r.center.x - r.width * 0.42, y: e, z: r.center.z + i * lightStep });
    positions.push({ x: r.center.x + r.width * 0.42, y: e, z: r.center.z + i * lightStep });
  }
  return addInstancedBoxes(group, { sx: 2, sy: 1.2, sz: 2 }, 0x88ffcc, positions);
}

/** T-04: dashed runway centerline, instanced. */
function addRunwayCenterline(group, airport, markCount = 4) {
  const e = airport.elevation;
  const r = airport.runway;
  const markStep = Math.floor(r.length / (markCount * 2 + 1) / 2) * 2;
  const positions = [];
  for (let i = -markCount; i <= markCount; i++) {
    positions.push({ x: r.center.x, y: e, z: r.center.z + i * markStep });
  }
  return addInstancedBoxes(group, { sx: 3, sy: 0.2, sz: 30 }, 0xe8e8d0, positions);
}

/**
 * T-04: threshold "piano key" stripes — a row of longitudinal white stripes across
 * the runway width, painted just inside BOTH ends so the runway reads as a runway
 * from either approach direction.
 */
function addThresholdStripes(group, airport, stripeCount = 8) {
  const r = airport.runway;
  const e = airport.elevation;
  const stripeLen = Math.min(40, r.length * 0.12);
  const stripeW = (r.width * 0.74) / (stripeCount * 1.6);
  const gap = stripeW * 0.65;
  const span = stripeCount * stripeW + (stripeCount - 1) * gap;
  const startX = r.center.x - span / 2 + stripeW / 2;
  const insetZ = stripeLen / 2 + 5;
  const ends = [r.center.z - r.length / 2 + insetZ, r.center.z + r.length / 2 - insetZ];
  const positions = [];
  for (const z of ends) {
    for (let i = 0; i < stripeCount; i++) {
      positions.push({ x: startX + i * (stripeW + gap), y: e, z });
    }
  }
  return addInstancedBoxes(group, { sx: stripeW, sy: 0.16, sz: stripeLen }, 0xf4f0e6, positions);
}

/** T-04: continuous high-contrast white edge stripes along both sides of the runway. */
function addRunwayEdgeStripes(group, airport) {
  const r = airport.runway;
  const e = airport.elevation;
  const stripeW = Math.max(1.4, r.width * 0.035);
  const inset = stripeW / 2 + 0.6;
  addBox(group, r.center.x - (r.width / 2 - inset), e, r.center.z, stripeW, 0.14, r.length - 6, 0xf4f0e6);
  addBox(group, r.center.x + (r.width / 2 - inset), e, r.center.z, stripeW, 0.14, r.length - 6, 0xf4f0e6);
}

/**
 * T-04: aiming-point marking (a large pair of white blocks) + touchdown-zone marking
 * (a few pairs of shorter stripes spread along `airport.touchdownZone`), the standard
 * "you are cleared to put wheels down here" cues.
 */
function addTouchdownZoneMarkings(group, airport) {
  const tz = airport.touchdownZone;
  const r = airport.runway;
  const e = airport.elevation;
  const aimW = Math.min(6, r.width * 0.12);
  const aimL = Math.min(26, tz.length * 0.3);
  addBox(group, tz.center.x - r.width * 0.22, e, tz.center.z, aimW, 0.22, aimL, 0xffffff);
  addBox(group, tz.center.x + r.width * 0.22, e, tz.center.z, aimW, 0.22, aimL, 0xffffff);

  const pairCount = 3;
  const span = tz.length * 0.68;
  const markW = Math.min(3.2, r.width * 0.07);
  const markL = 12;
  const positions = [];
  for (let i = 0; i < pairCount; i++) {
    const t = pairCount === 1 ? 0 : i / (pairCount - 1) - 0.5;
    const z = tz.center.z + t * span;
    positions.push({ x: tz.center.x - r.width * 0.34, y: e, z });
    positions.push({ x: tz.center.x + r.width * 0.34, y: e, z });
  }
  addInstancedBoxes(group, { sx: markW, sy: 0.18, sz: markL }, 0xefeee2, positions);
}

/**
 * T-04: canvas-drawn runway designation numbers near both thresholds — cheap (2
 * textures, built once at airport creation, mirrors the existing ground-label
 * technique in `addGroundLabel`). No external assets.
 */
function addRunwayDesignation(group, airport, labelA = '18', labelB = '36') {
  const r = airport.runway;
  const e = airport.elevation;
  const size = Math.min(r.width * 0.55, 26);
  const meshes = [];
  const makeDigits = (text, z) => {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.font = 'bold 190px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#f4f4f0';
    ctx.fillText(text, 128, 140);
    const tex = new THREE.CanvasTexture(canvas);
    const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(size, size), mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(r.center.x, e + 0.2, z);
    group.add(mesh);
    meshes.push(mesh);
  };
  const inset = r.length / 2 - size * 1.1;
  makeDigits(labelA, r.center.z - inset);
  makeDigits(labelB, r.center.z + inset);
  return meshes;
}

/** T-04: taxiway centerline (single continuous yellow line) + double yellow edge markings. */
function addTaxiwayMarkings(group, airport) {
  const t = airport.taxiway;
  const e = airport.elevation;
  addBox(group, t.center.x, e, t.center.z, 0.9, 0.14, t.length - 6, 0xffd23f);
  const edgeInset = Math.max(1.4, t.width * 0.08);
  const outer = t.width / 2 - edgeInset;
  addBox(group, t.center.x - outer, e, t.center.z, 0.6, 0.12, t.length - 6, 0xffd23f);
  addBox(group, t.center.x + outer, e, t.center.z, 0.6, 0.12, t.length - 6, 0xffd23f);
}

/** T-04: apron/service-zone readability — a painted yellow border + a couple of parking stalls. */
function addApronMarkings(group, airport) {
  const s = airport.serviceZone;
  const e = airport.elevation;
  const borderColor = 0xffd23f;
  const halfW = s.width / 2 - 1;
  const halfL = s.length / 2 - 1;
  addBox(group, s.center.x, e, s.center.z - halfL, s.width - 2, 0.12, 0.6, borderColor);
  addBox(group, s.center.x, e, s.center.z + halfL, s.width - 2, 0.12, 0.6, borderColor);
  addBox(group, s.center.x - halfW, e, s.center.z, 0.6, 0.12, s.length - 2, borderColor);
  addBox(group, s.center.x + halfW, e, s.center.z, 0.6, 0.12, s.length - 2, borderColor);

  const stallCount = 2;
  const stallSpan = s.length * 0.5;
  for (let i = 0; i < stallCount; i++) {
    const t = stallCount === 1 ? 0 : i / (stallCount - 1) - 0.5;
    const z = s.center.z + t * stallSpan;
    addBox(group, s.center.x, e, z, s.width * 0.55, 0.1, 1, 0xd8d6c4);
  }
}

/**
 * Runway + taxiway + apron furniture for any airport — the ONE shared clarity pass
 * (T-04): PAPI, edge lights, centerline dashes, threshold "piano key" stripes,
 * continuous edge stripes, aiming-point/touchdown-zone markings, canvas-drawn runway
 * designation numbers, a taxiway centerline + edge markings, and apron border/stalls.
 * Every map that calls this inherits the full clarity pass for free.
 */
function addRunwayFurniture(group, airport, lightCount = 5, markCount = 4) {
  addPapi(group, airport);
  addRunwayEdgeLights(group, airport, lightCount);
  addRunwayCenterline(group, airport, markCount);
  addThresholdStripes(group, airport);
  addRunwayEdgeStripes(group, airport);
  addTouchdownZoneMarkings(group, airport);
  addRunwayDesignation(group, airport);
  addTaxiwayMarkings(group, airport);
  addApronMarkings(group, airport);
}

/** PAPI (WS-4): fileira 2 brancas + 2 vermelhas ao lado da zona de toque. */
function addPapi(group, airport) {
  const tz = airport.touchdownZone;
  const e = airport.elevation;
  const px = tz.center.x - tz.width / 2 - 9;
  for (let i = 0; i < 4; i++) {
    const color = i < 2 ? 0xffffff : 0xff3030;
    addBox(group, px, e, tz.center.z - 12 + i * 8, 2.4, 1.6, 2.4, color);
  }
}

export function createDesertAirport(scene) {
  if (airportGroups.has('desert')) return airportGroups.get('desert');
  const airport = desertAirport;
  const group = new THREE.Group();
  group.name = 'tauan-papai-airport';

  addPavement(group, airport.runway.center, airport.runway.width, airport.runway.length, 0x202326);
  addPavement(group, airport.taxiway.center, airport.taxiway.width, airport.taxiway.length, 0x2b2c2c);
  addPavement(group, airport.serviceZone.center, airport.serviceZone.width, airport.serviceZone.length, 0x343434);

  addRunwayFurniture(group, airport);

  addBox(group, -410, 0, 298, 58, 22, 46, 0x6e7477);
  addBox(group, -410, 22, 298, 62, 8, 50, 0x384046);
  addBox(group, -322, 0, 372, 32, 14, 26, 0x506068);
  addBox(group, -276, 0, 358, 26, 9, 20, 0x8a896f);

  addBox(group, -372, 0, 272, 22, 8, 10, 0xd8d0aa);
  addBox(group, -352, 0, 272, 8, 4, 8, 0x222222);
  addBox(group, -325, 0, 284, 7, 2, 34, 0x111111);
  addBox(group, -315, 0, 284, 4, 5, 4, 0x1c57ff);
  addBox(group, -304, 0, 284, 4, 5, 4, 0x1c57ff);

  const label = addGroundLabel(group, airport, AIRPORT_TEXT);
  group.userData.airport = airport;
  group.userData.airportText = label;
  scene.add(group);
  airportGroups.set('desert', group);
  return group;
}

export function createInhaumaAirport(scene) {
  if (airportGroups.has('inhauma')) return airportGroups.get('inhauma');
  const airport = inhaumaAirport;
  const group = new THREE.Group();
  group.name = 'inhauma-airport';

  addPavement(group, airport.runway.center, airport.runway.width, airport.runway.length, 0x26292b);
  addPavement(group, airport.taxiway.center, airport.taxiway.width, airport.taxiway.length, 0x303332);
  addPavement(group, airport.serviceZone.center, airport.serviceZone.width, airport.serviceZone.length, 0x3b3a33);

  addRunwayFurniture(group, airport);

  addBox(group, -660, 0, 500, 48, 16, 34, 0x806f55);
  addBox(group, -660, 16, 500, 54, 6, 40, 0x5b3f2f);
  addBox(group, -615, 0, 535, 26, 10, 22, 0x8a7a5f);
  addBox(group, -700, 0, 450, 18, 9, 18, 0xb58a62);

  const label = addGroundLabel(group, airport, INHAUMA_AIRPORT_TEXT);
  group.userData.airport = airport;
  group.userData.airportText = label;
  scene.add(group);
  airportGroups.set('inhauma', group);
  return group;
}

/** Pista costeira islands (ADR-U2): atol-plataforma de areia + pavimentos elevados. */
export function createIslandsAirport(scene) {
  if (airportGroups.has('islands')) return airportGroups.get('islands');
  const airport = islandsAirport;
  const group = new THREE.Group();
  group.name = 'tauan-atoll-airport';

  // Plataforma de areia sob todo o complexo (atol artificial acima das ondas)
  const base = new THREE.Mesh(
    new THREE.BoxGeometry(airport.runway.width + 70, 2.4, airport.runway.length + 220),
    new THREE.MeshLambertMaterial({ color: 0xd8c690 }),
  );
  base.position.set(airport.runway.center.x + 10, airport.elevation - 1.25, airport.runway.center.z + 60);
  base.receiveShadow = true;
  group.add(base);

  addPavement(group, airport.runway.center, airport.runway.width, airport.runway.length, 0x24282b, airport.elevation);
  addPavement(group, airport.taxiway.center, airport.taxiway.width, airport.taxiway.length, 0x2e302f, airport.elevation);
  addPavement(group, airport.serviceZone.center, airport.serviceZone.width, airport.serviceZone.length, 0x383735, airport.elevation);
  addRunwayFurniture(group, airport);

  // Hangar e torre modestos na plataforma
  addBox(group, -260, airport.elevation, 330, 42, 14, 30, 0x6e7477);
  addBox(group, -230, airport.elevation, 395, 14, 8, 14, 0x506068);

  const label = addGroundLabel(group, airport, ISLANDS_AIRPORT_TEXT);
  group.userData.airport = airport;
  group.userData.airportText = label;
  scene.add(group);
  airportGroups.set('islands', group);
  return group;
}

/** Pista Santos Dumont (rio): aterro a leste da malha urbana. */
export function createRioAirport(scene) {
  if (airportGroups.has('rio')) return airportGroups.get('rio');
  const airport = rioAirport;
  const group = new THREE.Group();
  group.name = 'santos-dumont-airport';

  // Aterro claro sob os pavimentos
  const fill = new THREE.Mesh(
    new THREE.BoxGeometry(airport.runway.width + 60, 0.5, airport.runway.length + 200),
    new THREE.MeshLambertMaterial({ color: 0x9d9789 }),
  );
  fill.position.set(airport.runway.center.x + 14, airport.elevation - 0.3, airport.runway.center.z + 70);
  fill.receiveShadow = true;
  group.add(fill);

  addPavement(group, airport.runway.center, airport.runway.width, airport.runway.length, 0x202326, airport.elevation);
  addPavement(group, airport.taxiway.center, airport.taxiway.width, airport.taxiway.length, 0x2b2c2c, airport.elevation);
  addPavement(group, airport.serviceZone.center, airport.serviceZone.width, airport.serviceZone.length, 0x343434, airport.elevation);
  addRunwayFurniture(group, airport);

  // Terminal compacto estilo aeroporto urbano
  addBox(group, 660, airport.elevation, 540, 50, 16, 34, 0x8d97a3);
  addBox(group, 660, airport.elevation + 16, 540, 54, 5, 38, 0x49525c);
  addBox(group, 630, airport.elevation, 600, 18, 9, 18, 0x6a7682);

  const label = addGroundLabel(group, airport, RIO_AIRPORT_TEXT);
  group.userData.airport = airport;
  group.userData.airportText = label;
  scene.add(group);
  airportGroups.set('rio', group);
  return group;
}

const AIRPORT_BUILDERS = {
  desert: createDesertAirport,
  inhauma: createInhaumaAirport,
  islands: createIslandsAirport,
  rio: createRioAirport,
};

/** Cria (idempotente) o aeroporto do mapa dado. Todo mapa tem um (WS-2). */
export function createAirportFor(mapKey, scene) {
  const builder = AIRPORT_BUILDERS[mapKey] ?? createDesertAirport;
  return builder(scene);
}

export function getAirportDiagnostics(map = 'desert') {
  const airport = getAirportForMap(map);
  const group = airportGroups.get(airport.map);
  return {
    id: airport.id,
    map: airport.map,
    elevation: airport.elevation,
    runwayBounds: airport.runway,
    serviceZoneBounds: airport.serviceZone,
    taxiwayBounds: airport.taxiway,
    airportText: {
      value: airport.text.value,
      bounds: airport.text,
      letterCount: airport.text.value.replaceAll(' ', '').length,
      lightCount: group?.userData?.airportText?.lights?.length ?? 0,
    },
  };
}
