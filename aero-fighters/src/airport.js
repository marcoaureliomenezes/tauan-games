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

/** Luzes de pista + marcações de centerline + PAPI para qualquer aeroporto. */
function addRunwayFurniture(group, airport, lightCount = 5, markCount = 4) {
  addPapi(group, airport);
  const e = airport.elevation;
  const r = airport.runway;
  const lightStep = Math.floor(r.length / (lightCount * 2 + 1) / 2) * 2;
  for (let i = -lightCount; i <= lightCount; i++) {
    addBox(group, r.center.x - r.width * 0.42, e, r.center.z + i * lightStep, 2, 1.2, 2, 0x88ffcc);
    addBox(group, r.center.x + r.width * 0.42, e, r.center.z + i * lightStep, 2, 1.2, 2, 0x88ffcc);
  }
  const markStep = Math.floor(r.length / (markCount * 2 + 1) / 2) * 2;
  for (let i = -markCount; i <= markCount; i++) {
    addBox(group, r.center.x, e, r.center.z + i * markStep, 3, 0.2, 30, 0xe8e8d0);
  }
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

  addPapi(group, airport);
  for (let i = -5; i <= 5; i++) {
    addBox(group, airport.runway.center.x - airport.runway.width * 0.42, 0, airport.runway.center.z + i * 62, 2, 1.2, 2, 0x88ffcc);
    addBox(group, airport.runway.center.x + airport.runway.width * 0.42, 0, airport.runway.center.z + i * 62, 2, 1.2, 2, 0x88ffcc);
  }
  for (let i = -4; i <= 4; i++) {
    addBox(group, airport.runway.center.x, 0, airport.runway.center.z + i * 76, 3, 0.2, 30, 0xe8e8d0);
  }

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

  addPapi(group, airport);
  for (let i = -4; i <= 4; i++) {
    addBox(group, airport.runway.center.x - airport.runway.width * 0.42, 0, airport.runway.center.z + i * 58, 1.8, 1.0, 1.8, 0x88ffcc);
    addBox(group, airport.runway.center.x + airport.runway.width * 0.42, 0, airport.runway.center.z + i * 58, 1.8, 1.0, 1.8, 0x88ffcc);
  }
  for (let i = -3; i <= 3; i++) {
    addBox(group, airport.runway.center.x, 0, airport.runway.center.z + i * 70, 2.8, 0.2, 28, 0xe8e8d0);
  }

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
