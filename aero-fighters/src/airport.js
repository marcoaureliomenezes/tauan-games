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

const airportGroups = new Map();

export function getAirportForMap(map = 'desert') {
  return map === 'inhauma' ? inhaumaAirport : desertAirport;
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

function addPavement(group, center, width, length, color) {
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
  mesh.position.set(center.x, 0, center.z);
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
  mesh.position.set(airport.text.center.x, 0.09, airport.text.center.z);
  group.add(mesh);

  const lightMat = new THREE.MeshBasicMaterial({ color: 0xfff6a0 });
  const lights = [];
  for (let i = 0; i < 28; i++) {
    const t = i / 27;
    for (const side of [-1, 1]) {
      const l = new THREE.Mesh(new THREE.SphereGeometry(1.4, 8, 6), lightMat);
      l.position.set(
        airport.text.center.x - airport.text.width / 2 + airport.text.width * t,
        0.7,
        airport.text.center.z + side * airport.text.depth * 0.68,
      );
      group.add(l);
      lights.push(l);
    }
  }
  return { mesh, lights };
}

export function createDesertAirport(scene) {
  if (airportGroups.has('desert')) return airportGroups.get('desert');
  const airport = desertAirport;
  const group = new THREE.Group();
  group.name = 'tauan-papai-airport';

  addPavement(group, airport.runway.center, airport.runway.width, airport.runway.length, 0x202326);
  addPavement(group, airport.taxiway.center, airport.taxiway.width, airport.taxiway.length, 0x2b2c2c);
  addPavement(group, airport.serviceZone.center, airport.serviceZone.width, airport.serviceZone.length, 0x343434);

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
