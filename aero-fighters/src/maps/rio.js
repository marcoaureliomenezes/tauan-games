// maps/rio.js — Mapa 3: Rio de Janeiro (topografia procedural).
// Exporta: createRioWorld, updateRioWorld, rioHeightAt.
// Interface compatível com world.js (game.islands aponta para morros).

import * as THREE from '../../../vendor/three.module.min.js';
import { game } from '../state.js';

let _scene = null;

/** Morros do Rio: [cx, cz, radius, height, type, name] */
const HILL_DEFS = [
  [  80, -120,  45, 120, 'rock',   'paodeacucar'],
  [-200,  100,  70, 150, 'forest', 'corcovado'],
  [ 300,  250,  55,  90, 'twin',   'doisirmaos'],
  [-300,  300,  60,  80, 'mesa',   'pedradagavea'],
  [-100,  500, 120, 110, 'forest', 'tijuca'],
  [ 450, -200,  35,  55, 'urban',  'morro1'],
  [-400, -300,  40,  50, 'urban',  'morro2'],
  [ 200,  600,  30,  45, 'urban',  'morro3'],
];

function createMorro(hDef, scene) {
  const [cx, cz, radius, height, type] = hDef;
  const geo = new THREE.PlaneGeometry(radius * 2.4, radius * 2.4, 44, 44);
  geo.rotateX(-Math.PI / 2);

  const posAttr = geo.attributes.position;
  const colArr = new Float32Array(posAttr.count * 3);

  for (let i = 0; i < posAttr.count; i++) {
    const x = posAttr.getX(i);
    const z = posAttr.getZ(i);
    const dist = Math.sqrt(x * x + z * z);
    const t = dist / radius;

    let h = 0;
    if (type === 'rock') {
      // Cone rochoso (Pão de Açúcar)
      h = height * Math.max(0, 1 - t * t * 2.0);
    } else if (type === 'mesa') {
      // Mesa plana (Pedra da Gávea)
      h = t < 0.65 ? height : height * Math.max(0, 1 - (t - 0.65) / 0.25);
    } else if (type === 'twin') {
      // Par de picos (Dois Irmãos)
      const d1 = Math.sqrt((x - 0.3 * radius) * (x - 0.3 * radius) + z * z);
      const d2 = Math.sqrt((x + 0.3 * radius) * (x + 0.3 * radius) + z * z);
      h = height * Math.max(
        Math.max(0, 1 - (d1 / radius * 1.8) ** 2),
        Math.max(0, 1 - (d2 / radius * 1.8) ** 2),
      );
    } else {
      // Forest / urban: suave com ruído
      h = height * Math.max(0, 1 - t * t * 1.6);
    }

    // Ruído para naturalidade
    h += Math.sin(x * 0.2) * 2 + Math.cos(z * 0.18) * 2;
    h = Math.max(0, h);
    posAttr.setY(i, h);

    // Vertex colors por tipo e altitude
    const fh = h / height;
    if (type === 'rock' || type === 'mesa') {
      if (fh > 0.7) {
        colArr[i * 3] = 0.38; colArr[i * 3 + 1] = 0.35; colArr[i * 3 + 2] = 0.32; // rocha cinza
      } else if (fh > 0.15) {
        colArr[i * 3] = 0.22; colArr[i * 3 + 1] = 0.52; colArr[i * 3 + 2] = 0.16; // mata atlântica
      } else {
        colArr[i * 3] = 0.75; colArr[i * 3 + 1] = 0.70; colArr[i * 3 + 2] = 0.65; // cinza urbano
      }
    } else if (type === 'urban') {
      // Morros de favela: vegetação densa na encosta, rocha no topo, cinza urbano na base
      if (fh > 0.5) {
        colArr[i * 3] = 0.48; colArr[i * 3 + 1] = 0.43; colArr[i * 3 + 2] = 0.33; // rocha
      } else if (fh > 0.08) {
        colArr[i * 3] = 0.28; colArr[i * 3 + 1] = 0.54; colArr[i * 3 + 2] = 0.20; // mata atlântica
      } else {
        colArr[i * 3] = 0.76; colArr[i * 3 + 1] = 0.71; colArr[i * 3 + 2] = 0.65; // cinza urbano
      }
    } else {
      // forest
      if (fh > 0.6) {
        colArr[i * 3] = 0.45; colArr[i * 3 + 1] = 0.40; colArr[i * 3 + 2] = 0.30; // rocha topo
      } else if (fh > 0.05) {
        colArr[i * 3] = 0.22; colArr[i * 3 + 1] = 0.52; colArr[i * 3 + 2] = 0.16; // mata densa
      } else {
        colArr[i * 3] = 0.75; colArr[i * 3 + 1] = 0.70; colArr[i * 3 + 2] = 0.65;
      }
    }
  }

  geo.setAttribute('color', new THREE.BufferAttribute(colArr, 3));
  geo.computeVertexNormals();

  const mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true }));
  mesh.position.set(cx, 0, cz);
  mesh.receiveShadow = true;
  scene.add(mesh);

  return { cx, cz, radius, peakHeight: height, mesh, type };
}

/** Cria a malha urbana do Rio: asfalto, praia e edifícios via InstancedMesh. */
function createUrbanZone(scene) {
  // Asphalt city ground
  const asphalt = new THREE.MeshLambertMaterial({ color: 0x353535 });
  const cityFloor = new THREE.Mesh(new THREE.PlaneGeometry(1400, 700), asphalt);
  cityFloor.rotation.x = -Math.PI / 2;
  cityFloor.position.set(-50, 0.4, 230);
  cityFloor.receiveShadow = true;
  scene.add(cityFloor);

  // Beach strip (Copacabana / Ipanema)
  const beachMat = new THREE.MeshLambertMaterial({ color: 0xf0d98a });
  const beach = new THREE.Mesh(new THREE.PlaneGeometry(1200, 180), beachMat);
  beach.rotation.x = -Math.PI / 2;
  beach.position.set(-50, 0.3, -90);
  beach.receiveShadow = true;
  scene.add(beach);

  // Promenade (Avenida Atlântica) — light grey strip between beach and city
  const promMat = new THREE.MeshLambertMaterial({ color: 0x7a7a7a });
  const prom = new THREE.Mesh(new THREE.PlaneGeometry(1200, 35), promMat);
  prom.rotation.x = -Math.PI / 2;
  prom.position.set(-50, 0.5, -8);
  scene.add(prom);

  // Collect building positions (skip avenues and morro footprints)
  const bData = [];
  const avZs = [0, 150, 290, 430];  // major avenues (bz positions)
  const avXs = [-180, -50, 90, 230, 360]; // cross avenues

  for (let bx = -300; bx <= 430; bx += 32) {
    for (let bz = 10; bz <= 530; bz += 27) {
      // Avenue gaps
      if (avXs.some(ax => Math.abs(bx - ax) < 15)) continue;
      if (avZs.some(az => Math.abs(bz - az) < 13)) continue;
      if (Math.random() < 0.15) continue; // minor streets

      // Skip morro footprints
      const onMorro = HILL_DEFS.some(([cx, cz, r]) =>
        Math.hypot(bx - cx, bz - cz) < r + 20,
      );
      if (onMorro) continue;

      // Taller buildings downtown (around x=50, z=200)
      const downtown = Math.max(0, 1 - Math.hypot(bx - 50, bz - 200) / 220);
      const h = 12 + Math.random() * 65 * (0.3 + downtown * 0.7);
      const w = 14 + Math.random() * 8;
      const d = 14 + Math.random() * 8;
      bData.push({ x: bx, z: bz, h, w, d });
    }
  }

  const iGeo = new THREE.BoxGeometry(1, 1, 1);
  const iMat = new THREE.MeshLambertMaterial();
  const iMesh = new THREE.InstancedMesh(iGeo, iMat, bData.length);
  iMesh.castShadow = true;

  const _dummy = new THREE.Object3D();
  const _col = new THREE.Color();
  const bColors = [0x9aaab8, 0x7e8f9c, 0xb2a898, 0x6a808e, 0xa09280, 0x8899ab, 0xbdb5a5];

  bData.forEach((b, i) => {
    _dummy.position.set(b.x, b.h / 2, b.z);
    _dummy.scale.set(b.w, b.h, b.d);
    _dummy.updateMatrix();
    iMesh.setMatrixAt(i, _dummy.matrix);
    _col.setHex(bColors[Math.floor(Math.random() * bColors.length)]);
    iMesh.setColorAt(i, _col);
  });
  iMesh.instanceMatrix.needsUpdate = true;
  if (iMesh.instanceColor) iMesh.instanceColor.needsUpdate = true;
  scene.add(iMesh);
}

/** Cria o mundo Rio: oceano + morros + cidade + praia + fog bruma marítima. */
export function createRioWorld(scene, skyRef) {
  _scene = scene;

  // Oceano da Baía de Guanabara / Atlântico
  const oceanMat = new THREE.MeshLambertMaterial({ color: 0x1a4f6e });
  const ocean = new THREE.Mesh(
    new THREE.PlaneGeometry(10000, 10000, 1, 1),
    oceanMat,
  );
  ocean.rotation.x = -Math.PI / 2;
  ocean.position.y = 0;
  ocean.receiveShadow = true;
  scene.add(ocean);

  // Fog: bruma marítima
  scene.fog = new THREE.Fog(0x87ceeb, 300, 700);

  // Morros — populam game.islands para compatibilidade
  game.islands.length = 0;
  for (const def of HILL_DEFS) {
    const isl = createMorro(def, scene);
    game.islands.push(isl);
  }

  // Cidade: asfalto + praia + edifícios
  createUrbanZone(scene);
}

/** Update frame do Rio (oceano estático — sem animação de ondas neste mapa). */
export function updateRioWorld(dt, playerPos) {
  // Oceano estático no mapa Rio (diferente do mapa ilhas que tem animação)
}

/** Altura de um morro em (dx, dz) relativos ao centro. */
export function rioHeightAt(isl, dx, dz) {
  const t = Math.sqrt(dx * dx + dz * dz) / isl.radius;
  if (isl.type === 'mesa') {
    return t < 0.65 ? isl.peakHeight : isl.peakHeight * Math.max(0, 1 - (t - 0.65) / 0.25);
  }
  return isl.peakHeight * Math.max(0, 1 - t * t * 1.6);
}
