import * as THREE from '../../vendor/three.module.min.js';
import { CONFIG } from './config.js';
import { createRandom, hashSeed } from './random.js';
import { isSolid, tileHeight, tileInset } from './content/tiles.js';

// Camada urbana dos mapas: o que transforma um grid de corredores num QUARTEIRÃO.
//
// Referência de desenho: Medal of Honor (Allied Assault / Frontline). O que faz
// aqueles cenários lerem como cidade não é a planta — é a espessura do detalhe
// sobre ela: asfalto com faixa, calçada com meio-fio, fachada com embasamento,
// janelas afundadas, cornija e porta emoldurada, e a rua entulhada de carcaças
// de carro, escombros e barricadas de sacos de areia.
//
// Tudo aqui é instanciado: uma InstancedMesh por elemento repetido, então o
// custo de draw call não cresce com o tamanho do quarteirão.
//
// Esta camada não INVENTA colisor: os volumes sólidos já foram criados em
// world.js a partir da ALTURA DO TILE, e desenho e colisor têm de descrever o
// mesmo bloco. Duas ligações e uma exceção:
//   · a carcaça de carro ADOTA o colisor do seu tile ao se registrar como peça
//     destrutível — assim ele some junto com o carro quando ele explode;
//   · a calçada é uma plataforma de 0.13 m: degrau, não obstáculo.

const dummy = new THREE.Object3D();
const KERB_HEIGHT = 0.13;

/**
 * NÚCLEO SÓLIDO de uma peça de cobertura irregular.
 *
 * Escombro e sacos de areia são desenhados com pedaços soltos, mas o colisor é
 * um bloco: sem uma massa visível preenchendo esse bloco, o jogador esbarra no
 * vão entre dois pedaços e sente parede invisível — é o que a auditoria de
 * sólidos (`game.api.auditSolids`) reprova. O núcleo é essa massa: fica sob os
 * pedaços, na mesma pegada do colisor.
 */
function addCoverCore(group, world, spots, char, material) {
  const height = tileHeight(char);
  const side = CONFIG.cellSize * tileInset(char);
  const core = instance(group, new THREE.BoxGeometry(side, height * 0.82, side), material, spots.length, { ray: true });
  spots.forEach((cell, index) => {
    const point = world.toWorld(cell);
    place(core, index, [point.x, height * 0.41, point.z]);
  });
  core.instanceMatrix.needsUpdate = true;
}

export function addCity(group, mission, world, materials) {
  const random = createRandom(hashSeed(`${mission.code}-city`));
  const palette = cityPalette(mission);
  addStreetSurface(group, world, palette);
  addKerbs(group, world, palette);
  addFacades(group, world, palette, random);
  addCarWrecks(group, world, palette, random);
  addRubble(group, world, palette, random);
  addSandbags(group, world, palette, random);
  addLampPosts(group, world, palette, random);
}

/** Cinzas de rua derivados da paleta da missão, para a rua ler como a missão. */
function cityPalette(mission) {
  const wall = new THREE.Color(mission.palette.wall);
  const floor = new THREE.Color(mission.palette.floor);
  return {
    accent: new THREE.Color(mission.palette.accent),
    asphalt: floor.clone().offsetHSL(0, -0.04, -0.12),
    paint: new THREE.Color(0xcfc7a8),
    pavement: floor.clone().offsetHSL(0, -0.02, 0.1),
    kerb: wall.clone().offsetHSL(0, -0.03, 0.06),
    plinth: wall.clone().offsetHSL(0, 0, -0.08),
    cornice: wall.clone().offsetHSL(0, 0, 0.07),
    glass: new THREE.Color(0x0d1416),
    frame: wall.clone().offsetHSL(0, 0, -0.14),
    rust: new THREE.Color(0x6d4630),
    metal: new THREE.Color(0x3c4247),
    sandbag: new THREE.Color(0x7d7350),
    concrete: wall.clone().offsetHSL(0, -0.05, 0.02),
  };
}

const cellsOf = (world, predicate) => {
  const found = [];
  for (let z = 0; z < world.height; z += 1) {
    for (let x = 0; x < world.width; x += 1) if (predicate(world.chars[z][x], x, z)) found.push({ x, z });
  }
  return found;
};

/** Uma InstancedMesh pronta, já adicionada ao grupo. Devolve `null` se vazia. */
function instance(group, geometry, material, count, { ray = false, shadow = true } = {}) {
  if (!count) return null;
  const mesh = new THREE.InstancedMesh(geometry, material, count);
  mesh.castShadow = shadow;
  mesh.receiveShadow = shadow;
  if (!ray) mesh.userData.noRay = true;
  group.add(mesh);
  return mesh;
}

function place(mesh, index, position, rotation = [0, 0, 0], scale = [1, 1, 1]) {
  dummy.position.set(...position);
  dummy.rotation.set(...rotation);
  dummy.scale.set(...scale);
  dummy.updateMatrix();
  mesh.setMatrixAt(index, dummy.matrix);
}

// ---------------------------------------------------------------------------
// Rua e calçada
// ---------------------------------------------------------------------------

/** Asfalto sobre as células de rua, com faixa central pontilhada. */
function addStreetSurface(group, world, palette) {
  const road = cellsOf(world, (char) => char === '=');
  if (!road.length) return;
  const asphalt = new THREE.MeshStandardMaterial({ color: palette.asphalt, roughness: 0.97, metalness: 0.02 });
  const mesh = instance(group, new THREE.BoxGeometry(CONFIG.cellSize, 0.04, CONFIG.cellSize), asphalt, road.length, { shadow: false });
  const shade = new THREE.Color();
  road.forEach((cell, index) => {
    const point = world.toWorld(cell);
    place(mesh, index, [point.x, 0.02, point.z]);
    // Manchas de desgaste: o asfalto não pode ser um plano chapado.
    mesh.setColorAt(index, shade.setScalar(0.86 + ((cell.x * 7 + cell.z * 11) % 9) / 32));
  });
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.instanceMatrix.needsUpdate = true;

  // Faixa central: só onde a rua continua no mesmo eixo, para não pintar
  // travessas e cruzamentos.
  const lane = road.filter(({ x, z }) => {
    const horizontal = world.chars[z][x - 1] === '=' && world.chars[z][x + 1] === '=';
    const vertical = world.chars[z - 1]?.[x] === '=' && world.chars[z + 1]?.[x] === '=';
    return horizontal !== vertical;
  });
  if (!lane.length) return;
  const paint = new THREE.MeshStandardMaterial({ color: palette.paint, roughness: 0.9 });
  const stripes = instance(group, new THREE.PlaneGeometry(1.5, 0.16), paint, lane.length, { shadow: false });
  lane.forEach((cell, index) => {
    const point = world.toWorld(cell);
    const horizontal = world.chars[cell.z][cell.x - 1] === '=' && world.chars[cell.z][cell.x + 1] === '=';
    place(stripes, index, [point.x, 0.045, point.z], [-Math.PI / 2, 0, horizontal ? 0 : Math.PI / 2]);
  });
  stripes.instanceMatrix.needsUpdate = true;
}

/**
 * Calçada: laje de 0.13 m com meio-fio na aresta que dá para a rua. É um
 * DEGRAU de verdade (plataforma na física), não um decalque — subir na calçada
 * para se abrigar atrás de um poste faz parte do combate de rua.
 */
function addKerbs(group, world, palette) {
  const walk = cellsOf(world, (char) => char === ',');
  if (!walk.length) return;
  const slab = new THREE.MeshStandardMaterial({ color: palette.pavement, roughness: 0.94 });
  const mesh = instance(group, new THREE.BoxGeometry(CONFIG.cellSize, KERB_HEIGHT, CONFIG.cellSize), slab, walk.length, { ray: true });
  const shade = new THREE.Color();
  walk.forEach((cell, index) => {
    const point = world.toWorld(cell);
    place(mesh, index, [point.x, KERB_HEIGHT / 2, point.z]);
    shade.setScalar(0.9 + ((cell.x * 5 + cell.z * 3) % 7) / 40);
    mesh.setColorAt(index, shade);
  });
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.instanceMatrix.needsUpdate = true;

  // Meio-fio: faixa mais clara na aresta voltada para o asfalto.
  const edges = [];
  for (const cell of walk) {
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      if (world.chars[cell.z + dz]?.[cell.x + dx] === '=') edges.push({ cell, dx, dz });
    }
  }
  const kerbMaterial = new THREE.MeshStandardMaterial({ color: palette.kerb, roughness: 0.86 });
  const kerbs = instance(group, new THREE.BoxGeometry(0.16, KERB_HEIGHT + 0.06, CONFIG.cellSize), kerbMaterial, edges.length, { shadow: false });
  if (!kerbs) return;
  edges.forEach(({ cell, dx, dz }, index) => {
    const point = world.toWorld(cell);
    const half = CONFIG.cellSize / 2;
    place(kerbs, index, [point.x + dx * (half - 0.08), (KERB_HEIGHT + 0.06) / 2, point.z + dz * (half - 0.08)],
      [0, dz !== 0 ? Math.PI / 2 : 0, 0]);
  });
  kerbs.instanceMatrix.needsUpdate = true;
}

// ---------------------------------------------------------------------------
// Fachadas
// ---------------------------------------------------------------------------

/**
 * Detalhe de fachada, face a face. Para cada célula de parede, cada lado que dá
 * para um espaço aberto ganha: embasamento, cornija e — conforme o tile e o
 * sorteio — uma janela afundada com peitoril, uma porta emoldurada, ou um
 * respiro cego. É o que tira a parede da condição de "caixa lisa".
 */
function addFacades(group, world, palette, random) {
  const faces = [];
  for (let z = 0; z < world.height; z += 1) {
    for (let x = 0; x < world.width; x += 1) {
      const char = world.chars[z][x];
      if (char !== '#' && char !== 'n') continue;
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const neighbour = world.chars[z + dz]?.[x + dx];
        if (!neighbour || isSolid(neighbour)) continue;   // face interna: não aparece
        faces.push({ x, z, dx, dz, char, outdoor: neighbour === '=' || neighbour === ',', door: neighbour === '+' });
      }
    }
  }
  if (!faces.length) return;

  const half = CONFIG.cellSize / 2;
  const skin = 0.04;                       // o detalhe fica RENTE à parede
  const at = (face, y, out = 0) => {
    const point = world.toWorld({ x: face.x, z: face.z });
    return [point.x + face.dx * (half + skin + out), y, point.z + face.dz * (half + skin + out)];
  };
  const facing = (face) => [0, Math.atan2(face.dx, face.dz), 0];

  const band = (color, roughness) => new THREE.MeshStandardMaterial({ color, roughness });
  const plinthMaterial = band(palette.plinth, 0.93);
  const corniceMaterial = band(palette.cornice, 0.88);
  const frameMaterial = band(palette.frame, 0.8);
  const glassMaterial = new THREE.MeshStandardMaterial({ color: palette.glass, roughness: 0.24, metalness: 0.55 });

  // Embasamento e cornija em TODA face exposta: é o que dá escala à parede.
  const plinth = instance(group, new THREE.BoxGeometry(CONFIG.cellSize * 0.98, 0.55, 0.12), plinthMaterial, faces.length, { shadow: false });
  const cornice = instance(group, new THREE.BoxGeometry(CONFIG.cellSize, 0.24, 0.2), corniceMaterial, faces.length, { shadow: false });
  faces.forEach((face, index) => {
    place(plinth, index, at(face, 0.28), facing(face));
    place(cornice, index, at(face, CONFIG.wallHeight - 0.2, 0.04), facing(face));
  });
  plinth.instanceMatrix.needsUpdate = true;
  cornice.instanceMatrix.needsUpdate = true;

  // Aberturas: janela nas fachadas `n`, porta onde o vizinho é vão de porta,
  // e uma janela ocasional nas fachadas comuns viradas para a rua.
  const doors = faces.filter((face) => face.door);
  const windows = faces.filter((face) => !face.door && (face.char === 'n' || (face.outdoor && random() > 0.55)));

  if (windows.length) {
    const panes = instance(group, new THREE.BoxGeometry(1.5, 1.35, 0.06), glassMaterial, windows.length, { shadow: false });
    const casings = instance(group, new THREE.BoxGeometry(1.78, 1.62, 0.14), frameMaterial, windows.length, { shadow: false });
    const sills = instance(group, new THREE.BoxGeometry(1.94, 0.14, 0.28), corniceMaterial, windows.length, { shadow: false });
    const mullions = instance(group, new THREE.BoxGeometry(0.09, 1.35, 0.1), frameMaterial, windows.length * 2, { shadow: false });
    windows.forEach((face, index) => {
      const y = 1.62 + random() * 0.12;
      place(casings, index, at(face, y), facing(face));
      place(panes, index, at(face, y, 0.06), facing(face));
      place(sills, index, at(face, y - 0.8, 0.06), facing(face));
      // Caixilho em cruz: uma barra vertical e uma horizontal por janela.
      place(mullions, index * 2, at(face, y, 0.1), facing(face));
      place(mullions, index * 2 + 1, at(face, y, 0.1), [0, Math.atan2(face.dx, face.dz), Math.PI / 2], [1, 1.32, 1]);
    });
    [panes, casings, sills, mullions].forEach((mesh) => { mesh.instanceMatrix.needsUpdate = true; });
  }

  if (doors.length) {
    const jambs = instance(group, new THREE.BoxGeometry(0.2, 2.5, 0.24), frameMaterial, doors.length * 2, { shadow: false });
    const lintels = instance(group, new THREE.BoxGeometry(2.1, 0.26, 0.28), corniceMaterial, doors.length, { shadow: false });
    doors.forEach((face, index) => {
      const [px, , pz] = at(face, 0);
      const sx = face.dz !== 0 ? 1 : 0;      // eixo perpendicular à face
      const sz = face.dx !== 0 ? 1 : 0;
      const offset = CONFIG.cellSize * 0.42;
      place(jambs, index * 2, [px + sx * offset, 1.25, pz + sz * offset], facing(face));
      place(jambs, index * 2 + 1, [px - sx * offset, 1.25, pz - sz * offset], facing(face));
      place(lintels, index, at(face, 2.6, 0.02), facing(face));
    });
    jambs.instanceMatrix.needsUpdate = true;
    lintels.instanceMatrix.needsUpdate = true;
  }

  // Calhas verticais nas quinas viradas para a rua: detalhe barato que dá
  // verticalidade e quebra a repetição da textura.
  const pipes = faces.filter((face) => face.outdoor && random() > 0.72);
  const downpipes = instance(group, new THREE.CylinderGeometry(0.075, 0.075, CONFIG.wallHeight - 0.5, 8),
    band(palette.metal, 0.62), pipes.length, { shadow: false });
  if (downpipes) {
    pipes.forEach((face, index) => {
      const [px, , pz] = at(face, 0, 0.06);
      const sx = face.dz !== 0 ? 1 : 0;
      const sz = face.dx !== 0 ? 1 : 0;
      const side = random() > 0.5 ? 1 : -1;
      place(downpipes, index, [px + sx * side * CONFIG.cellSize * 0.4, (CONFIG.wallHeight - 0.5) / 2 + 0.2, pz + sz * side * CONFIG.cellSize * 0.4]);
    });
    downpipes.instanceMatrix.needsUpdate = true;
  }
}

// ---------------------------------------------------------------------------
// Entulho de rua
// ---------------------------------------------------------------------------

/**
 * Carcaça de carro. Um Group montado uma vez e clonado por célula (clone
 * compartilha geometria e material), porque um carro tem peças demais para
 * caber numa InstancedMesh só e são poucos por mapa.
 */
function addCarWrecks(group, world, palette, random) {
  const spots = cellsOf(world, (char) => char === 'c');
  if (!spots.length) return;
  const body = new THREE.MeshStandardMaterial({ color: palette.rust, roughness: 0.86, metalness: 0.35 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x14181a, roughness: 0.9 });
  const glass = new THREE.MeshStandardMaterial({ color: palette.glass, roughness: 0.3, metalness: 0.5, transparent: true, opacity: 0.7 });
  const prototype = buildCar(body, dark, glass);

  spots.forEach((cell) => {
    const point = world.toWorld(cell);
    const car = prototype.clone(true);
    car.position.set(point.x, 0, point.z);
    // O carro é pesado: a explosão o sacode e o arrasta, não o arremessa. Mas
    // ele tem tanque — acumulado o estrago, detona e leva a rua junto.
    const tile = world.cover.find((entry) => entry.x === cell.x && entry.z === cell.z);
    world.props?.register({
      kind: 'car', node: car, position: car.position, health: 155, mass: 7,
      explosive: true, radius: 6.4, hitHalf: 0.9, collider: tile?.collider || null,
    });
    // Alinha o carro com a rua e desalinha um pouco: carro abandonado não fica
    // paralelo ao meio-fio.
    const alongZ = world.chars[cell.z - 1]?.[cell.x] === '=' || world.chars[cell.z + 1]?.[cell.x] === '=';
    car.rotation.y = (alongZ ? Math.PI / 2 : 0) + (random() - 0.5) * 0.5;
    car.rotation.z = (random() - 0.5) * 0.06;
    group.add(car);
  });
}

function buildCar(body, dark, glass) {
  const car = new THREE.Group();
  const add = (geometry, material, position, rotation = [0, 0, 0]) => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(...position);
    mesh.rotation.set(...rotation);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    car.add(mesh);
    return mesh;
  };
  add(new THREE.BoxGeometry(1.96, 0.52, 3.5), body, [0, 0.62, 0]);            // monobloco
  add(new THREE.BoxGeometry(1.72, 0.56, 1.6), body, [0, 1.1, -0.12]);          // cabine
  add(new THREE.BoxGeometry(1.36, 0.42, 0.08), glass, [0, 1.14, 0.68]);       // para-brisa
  add(new THREE.BoxGeometry(0.08, 0.4, 1.4), glass, [0.74, 1.12, -0.14]);     // janela dir.
  add(new THREE.BoxGeometry(0.08, 0.4, 1.4), glass, [-0.74, 1.12, -0.14]);    // janela esq.
  add(new THREE.BoxGeometry(1.66, 0.16, 0.9), body, [0, 0.94, 1.24], [0.22, 0, 0]);   // capô
  add(new THREE.BoxGeometry(1.66, 0.16, 0.8), body, [0, 0.9, -1.32], [-0.18, 0, 0]);  // porta-malas
  add(new THREE.BoxGeometry(1.8, 0.2, 0.24), dark, [0, 0.6, 1.76]);           // para-choque
  add(new THREE.BoxGeometry(1.8, 0.2, 0.24), dark, [0, 0.6, -1.76]);          // para-choque tras.
  const wheel = new THREE.CylinderGeometry(0.36, 0.36, 0.26, 12);
  for (const [x, z] of [[0.82, 1.16], [-0.82, 1.16], [0.82, -1.16], [-0.82, -1.16]]) {
    add(wheel, dark, [x, 0.36, z], [0, 0, Math.PI / 2]);
  }
  return car;
}

/** Montes de escombro: blocos irregulares de concreto e tijolo partido. */
function addRubble(group, world, palette, random) {
  const spots = cellsOf(world, (char) => char === 'u');
  if (!spots.length) return;
  const chunksPerPile = 7;
  const material = new THREE.MeshStandardMaterial({ color: palette.concrete, roughness: 1 });
  addCoverCore(group, world, spots, 'u', material);
  const mesh = instance(group, new THREE.DodecahedronGeometry(0.42, 0), material, spots.length * chunksPerPile, { ray: true });
  const shade = new THREE.Color();
  const height = tileHeight('u');
  spots.forEach((cell, spot) => {
    const point = world.toWorld(cell);
    for (let i = 0; i < chunksPerPile; i += 1) {
      const index = spot * chunksPerPile + i;
      const spreadX = (random() - 0.5) * CONFIG.cellSize * 0.8;
      const spreadZ = (random() - 0.5) * CONFIG.cellSize * 0.8;
      // Cônico: mais alto no centro, esparramado nas bordas.
      const centred = 1 - Math.min(1, Math.hypot(spreadX, spreadZ) / (CONFIG.cellSize * 0.5));
      const size = 0.55 + random() * 0.8;
      place(mesh, index, [point.x + spreadX, height * centred * random() * 0.7 + 0.16, point.z + spreadZ],
        [random() * 3, random() * 3, random() * 3], [size, size * 0.75, size]);
      mesh.setColorAt(index, shade.setScalar(0.72 + random() * 0.5));
    }
  });
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.instanceMatrix.needsUpdate = true;

  // Vergalhão retorcido saindo do monte — a assinatura de prédio bombardeado.
  const rebar = instance(group, new THREE.CylinderGeometry(0.028, 0.028, 1.1, 5),
    new THREE.MeshStandardMaterial({ color: palette.rust, roughness: 0.78, metalness: 0.5 }), spots.length * 3, { shadow: false });
  spots.forEach((cell, spot) => {
    const point = world.toWorld(cell);
    for (let i = 0; i < 3; i += 1) {
      place(rebar, spot * 3 + i,
        [point.x + (random() - 0.5) * 2, 0.6 + random() * 0.3, point.z + (random() - 0.5) * 2],
        [(random() - 0.5) * 1.2, random() * 3, (random() - 0.5) * 1.2]);
    }
  });
  rebar.instanceMatrix.needsUpdate = true;
}

/** Barricada de sacos de areia: três fiadas em junta desencontrada. */
function addSandbags(group, world, palette, random) {
  const spots = cellsOf(world, (char) => char === 'b');
  if (!spots.length) return;
  const rows = 3;
  const perRow = 4;
  const material = new THREE.MeshStandardMaterial({ color: palette.sandbag, roughness: 1 });
  addCoverCore(group, world, spots, 'b', material);
  const mesh = instance(group, new THREE.CapsuleGeometry(0.17, 0.3, 3, 7), material, spots.length * rows * perRow, { ray: true });
  const shade = new THREE.Color();
  const width = CONFIG.cellSize * 0.88;
  spots.forEach((cell, spot) => {
    const point = world.toWorld(cell);
    // A barricada corre PERPENDICULAR à passagem que ela fecha.
    const alongZ = isSolid(world.chars[cell.z][cell.x - 1]) && isSolid(world.chars[cell.z][cell.x + 1]);
    for (let row = 0; row < rows; row += 1) {
      const stagger = row % 2 ? 0.5 : 0;
      for (let i = 0; i < perRow; i += 1) {
        const index = (spot * rows + row) * perRow + i;
        const along = ((i + stagger) / perRow - 0.5 + 0.5 / perRow) * width;
        place(mesh, index,
          [point.x + (alongZ ? 0 : along), 0.17 + row * 0.28, point.z + (alongZ ? along : 0)],
          [0, alongZ ? 0 : Math.PI / 2, Math.PI / 2 + (random() - 0.5) * 0.12]);
        mesh.setColorAt(index, shade.setScalar(0.82 + random() * 0.34));
      }
    }
  });
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.instanceMatrix.needsUpdate = true;
}

/** Postes de rua: mastro, braço e luminária; alguns acesos. */
function addLampPosts(group, world, palette, random) {
  const spots = cellsOf(world, (char) => char === 't');
  if (!spots.length) return;
  const metal = new THREE.MeshStandardMaterial({ color: palette.metal, roughness: 0.62, metalness: 0.6 });
  const glow = new THREE.MeshBasicMaterial({ color: 0xffe6b0, toneMapped: false });
  const height = tileHeight('t');
  const poles = instance(group, new THREE.CylinderGeometry(0.09, 0.13, height, 8), metal, spots.length);
  const arms = instance(group, new THREE.BoxGeometry(0.9, 0.09, 0.09), metal, spots.length, { shadow: false });
  const heads = instance(group, new THREE.BoxGeometry(0.42, 0.14, 0.28), glow, spots.length, { shadow: false });
  const bases = instance(group, new THREE.CylinderGeometry(0.24, 0.3, 0.3, 8), metal, spots.length, { shadow: false });
  spots.forEach((cell, index) => {
    const point = world.toWorld(cell);
    const swing = random() > 0.5 ? 1 : -1;
    place(poles, index, [point.x, height / 2, point.z]);
    place(bases, index, [point.x, 0.15, point.z]);
    place(arms, index, [point.x + swing * 0.45, height - 0.2, point.z]);
    place(heads, index, [point.x + swing * 0.85, height - 0.3, point.z]);
    // Só um em cada três acende: luz de rua é cara e o mapa é noturno.
    if (index % 3 === 0) {
      const light = new THREE.PointLight(0xffd9a0, 26, 13, 2);
      light.position.set(point.x + swing * 0.85, height - 0.42, point.z);
      group.add(light);
    }
  });
  [poles, arms, heads, bases].forEach((mesh) => { mesh.instanceMatrix.needsUpdate = true; });
}
