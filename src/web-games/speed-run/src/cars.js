// cars.js — Catálogo + modelos 3D REAIS vendorizados (Quaternius, CC0 1.0,
// baixados de poly.pizza/static CDN em 2026-07-18 → vendor/models/cars/).
// Carroceria suave de verdade, não caixas: esportivos, picape e caminhão
// (tráfego civil). EXCEÇÃO: o Idea Adventure virou modelo PROCEDURAL
// (idea-model.js, port das caixas da versão Godot — o SUV recolorido foi
// aposentado a pedido do operador).
// O recolor tinge o MATERIAL DOMINANTE (mais vértices) do GLB com a cor do
// catálogo — vidros/rodas (escuros) ficam intactos.

import * as THREE from '../../vendor/three.module.min.js';
import { GLTFLoader } from '../../vendor/jsm/loaders/GLTFLoader.js';
import { buildIdeaModel } from './idea-model.js';

export const CARS = [
  {
    key: 'idea', name: 'Idea Adventure 2013 Dual Logic',
    desc: 'O monovolume aventureiro do Marco — suspensão alta, encara terra como ninguém.',
    color: 0x9ba1a8,
    topSpeed: 62, accel: 26, handling: 2.15, grip: 0.94, brake: 46, mass: 1.28,
    dirtBonus: 0.22, model: 'procedural',           // idea-model.js (caixas, port Godot)
  },
  {
    key: 'muscle', name: 'Thunder V8',
    desc: 'Muscle americano — reto ninguém segura, curva é outra história.',
    color: 0xb02030,
    topSpeed: 72, accel: 30, handling: 1.7, grip: 0.82, brake: 40, mass: 1.55,
    dirtBonus: 0, model: 'SportsCarB',
  },
  {
    key: 'exotic', name: 'Velocità GT',
    desc: 'Exótico italiano — cola no asfalto, sofre na terra.',
    color: 0xf0c020,
    topSpeed: 76, accel: 32, handling: 2.3, grip: 0.97, brake: 52, mass: 1.3,
    dirtBonus: -0.1, model: 'SportsCarA',
  },
  {
    key: 'pickup', name: 'Mule Pickup',
    desc: 'Picape parruda — lenta no retão, trator na terra.',
    color: 0x2a5aa0,
    topSpeed: 58, accel: 24, handling: 1.9, grip: 0.88, brake: 44, mass: 1.9,
    dirtBonus: 0.28, model: 'PickupTruck',
  },
  {
    key: 'concept', name: 'Neon 2049',
    desc: 'Conceito futurista — equilíbrio total, luzes de outro século.',
    color: 0x30c8c0,
    topSpeed: 68, accel: 29, handling: 2.1, grip: 0.9, brake: 48, mass: 1.35,
    dirtBonus: 0.05, model: 'SportsCarC',
  },
];

// carro de TRÁFEGO civil (caminhão/SUV lentos circulando na pista)
export const TRAFFIC_DEFS = [
  { key: 'civTruck', name: 'Caminhão', color: 0xd8d2c0, topSpeed: 14, accel: 8, handling: 1.2, grip: 0.9, brake: 30, dirtBonus: 0, mass: 4.5, model: 'Truck' },
  { key: 'civSuv', name: 'SUV Civil', color: 0x6a7a52, topSpeed: 16, accel: 9, handling: 1.4, grip: 0.9, brake: 30, dirtBonus: 0, mass: 1.7, model: 'SUV' },
];

// POLÍCIA (WS-5, modo Fuga): 3 viaturas — muscle recolorido preto/branco +
// giroflex. Top speeds 225/210/200 km/h (÷3.4 = u/s, como o HUD).
export const POLICE_DEFS = [
  { key: 'police1', name: 'Polícia 1', color: 0x1a1c22, topSpeed: 66.2, accel: 30, handling: 1.9, grip: 0.92, brake: 44, mass: 1.55, dirtBonus: 0, model: 'SportsCarB' },
  { key: 'police2', name: 'Polícia 2', color: 0x1a1c22, topSpeed: 61.8, accel: 28, handling: 1.9, grip: 0.92, brake: 44, mass: 1.55, dirtBonus: 0, model: 'SportsCarB' },
  { key: 'police3', name: 'Polícia 3', color: 0x1a1c22, topSpeed: 58.8, accel: 28, handling: 1.9, grip: 0.92, brake: 44, mass: 1.55, dirtBonus: 0, model: 'SportsCarB' },
];

// adereços da viatura sobre o mesh do catálogo: portas brancas (caixas finas
// nas laterais) + GIROFLEX vermelho/azul emissor (par de caixas no teto —
// main.js alterna a visibilidade a cada 0,2 s → período 0,4 s).
export function makePolice(mesh) {
  const doorMat = new THREE.MeshLambertMaterial({ color: 0xf2f2ee });
  for (const sd of [-1, 1]) {
    const door = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.5, 1.9), doorMat);
    door.position.set(sd * 0.93, 0.62, 0.1);
    mesh.add(door);
  }
  const red = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.22, 0.34),
    new THREE.MeshBasicMaterial({ color: 0xff2a20 }));
  red.position.set(-0.34, 1.42, -0.2);
  const blue = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.22, 0.34),
    new THREE.MeshBasicMaterial({ color: 0x2a5aff }));
  blue.position.set(0.34, 1.42, -0.2);
  const barBase = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.08, 0.4),
    new THREE.MeshLambertMaterial({ color: 0x2a2c30 }));
  barBase.position.set(0, 1.3, -0.2);
  mesh.add(barBase, red, blue);
  mesh.userData.lightbar = { red, blue };
  return mesh;
}

const loader = new GLTFLoader();
const _cache = new Map();
function loadModel(name) {
  if (!_cache.has(name)) {
    _cache.set(name, new Promise((resolve, reject) => {
      loader.load(`../vendor/models/cars/${name}.glb`, (g) => resolve(g.scene), undefined, reject);
    }));
  }
  return _cache.get(name);
}

// tinge os materiais SATURADOS (lataria Quaternius é colorida); vidro, pneu e
// cromados são neutros (saturação baixa) e ficam intactos.
function recolor(root, colorHex) {
  const hsl = { h: 0, s: 0, l: 0 };
  const swapped = new Map();
  root.traverse((o) => {
    if (!o.isMesh) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    const out = mats.map((m) => {
      if (!m || !m.color) return m;
      if (swapped.has(m)) return swapped.get(m);
      m.color.getHSL(hsl);
      if (hsl.s < 0.25 || hsl.l < 0.08) return m;       // neutro/escuro: mantém
      const c = m.clone();
      c.color = new THREE.Color(colorHex);
      if ('metalness' in c) { c.metalness = 0.5; c.roughness = 0.38; }
      swapped.set(m, c);
      return c;
    });
    o.material = Array.isArray(o.material) ? out : out[0];
  });
}

// normaliza: comprimento ~len, base no chão, frente para -Z.
// bug M4: registra o COMPRIMENTO/LARGURA reais p/ o colisor cápsula
// (physics.collideCars) — o círculo único batia no ar ao lado do caminhão.
function normalize(root, len, def) {
  const box = new THREE.Box3().setFromObject(root);
  const size = box.getSize(new THREE.Vector3());
  const long = Math.max(size.x, size.z);
  const s = len / Math.max(long, 1e-3);
  root.scale.setScalar(s);
  if (size.x > size.z) root.rotation.y = Math.PI / 2;   // eixo longo → Z
  const box2 = new THREE.Box3().setFromObject(root);
  root.position.y = -box2.min.y;
  const c = box2.getCenter(new THREE.Vector3());
  root.position.x = -c.x; root.position.z = -c.z;
  const sz = box2.getSize(new THREE.Vector3());
  if (def) { def.colLen = Math.max(sz.x, sz.z); def.colWid = Math.min(sz.x, sz.z); }
}

// RIG das rodas: nos GLB Quaternius os nós de roda ficam na ORIGEM do modelo
// com a geometria deslocada até o cubo — girar rotation.x direto faz a roda
// ORBITAR a origem (a anomalia visível). Rig padrão de veículo (mesma técnica
// dos exemplos de vehicle do three.js): centra a geometria no cubo, cria um
// pivô no ponto do cubo e gira o pivô no eixo do eixo (X local).
//
// HIGIENE DE RESTART (vazamento auditado): o clone+translate era feito POR
// CARRO POR CORRIDA e NUNCA disposto — ~48 geometrias de GPU se acumulavam a
// cada restart. O resultado é idêntico entre carros do mesmo modelo (mesma
// geometria-base compartilhada pelo scene.clone, mesma ordem de traverse),
// então o clone re-centrado é CACHEADO por (modelo|nó|mesh) e compartilhado.
// A geometria-base do GLB NUNCA é tocada (o clone é sobre ela).
const _wheelGeoCache = new Map();     // `${modelo}|${nó}|${mesh}` → geometria re-centrada

// O modelo PROCEDURAL (idea) é o oposto: geometria FRESCA a cada build — não
// há o que cachear. Essas geometrias (rodas + carroceria) são registradas e
// dispostas pelo restart em main.js (disposeProcCarGeometries), junto com a
// faxina do worldRoot. Os MATERIAIS (MAT.*) são módulo-compartilhados: fora.
const _procGeos = new Set();
export function disposeProcCarGeometries() {
  for (const geo of _procGeos) geo.dispose();
  _procGeos.clear();
}

function rigWheels(root, g, modelKey) {
  const nodes = [];
  root.traverse((o) => {
    if (/wheel/i.test(o.name) && !(o.parent && /wheel/i.test(o.parent.name))) nodes.push(o);
  });
  nodes.forEach((node, ni) => {
    const box = new THREE.Box3().setFromObject(node);       // transforms locais = identidade
    const c = box.getCenter(new THREE.Vector3());
    const radius = box.getSize(new THREE.Vector3()).y / 2;  // unid. do modelo; escala depois
    let mi = 0;
    node.traverse((m) => {
      if (!m.isMesh) return;
      if (modelKey) {
        // GLB: geometria-base compartilhada → clone re-centrado via CACHE
        const key = `${modelKey}|${ni}|${mi++}`;
        let geo = _wheelGeoCache.get(key);
        if (!geo) {
          geo = m.geometry.clone().translate(-c.x, -c.y, -c.z);
          _wheelGeoCache.set(key, geo);
        }
        m.geometry = geo;
      } else {
        // procedural: geometria já é fresca/exclusiva deste build → in-place
        m.geometry.translate(-c.x, -c.y, -c.z);
      }
    });
    const pivot = new THREE.Group();
    pivot.rotation.order = 'YXZ';                           // Y = esterço, X = giro do eixo
    pivot.position.copy(c);
    node.parent.add(pivot);
    pivot.add(node);
    node.position.set(0, 0, 0);
    g.userData.wheels.push({ pivot, radius: Math.max(radius, 0.05), front: c.z > 0.3 });
  });
}

export function buildCarMesh(def) {
  const g = new THREE.Group();
  g.userData.wheels = [];
  // IDEA ADVENTURE: modelo procedural 1:1 (nariz +Z, base já no chão). Mesmo
  // rig de rodas dos GLB; colisor cápsula = carroceria NOMINAL da spec
  // (4.15×1.75) — espelhos/estepe ficam fora da cápsula de colisão.
  if (def.key === 'idea') {
    const root = buildIdeaModel();
    rigWheels(root, g);                                     // em espaço do modelo, ANTES da escala
    const raw = new THREE.Box3().setFromObject(root).getSize(new THREE.Vector3());
    normalize(root, Math.max(raw.x, raw.z), null);          // escala ~1: só assenta no chão e centra
    for (const w of g.userData.wheels) w.radius *= root.scale.x;
    def.colLen = 4.15;
    def.colWid = 1.75;
    g.add(root);
    // geometrias frescas deste build → dispose no restart (ver rigWheels)
    root.traverse((o) => { if (o.isMesh) _procGeos.add(o.geometry); });
    return g;
  }
  loadModel(def.model).then((scene) => {
    const root = scene.clone(true);
    recolor(root, def.color);
    rigWheels(root, g, def.model);                          // em espaço do modelo, ANTES da escala
    normalize(root, def.key === 'civTruck' ? 6.5 : 4.3, def);
    for (const w of g.userData.wheels) w.radius *= root.scale.x;
    g.add(root);
  }).catch(() => {
    // fallback (offline/teste): caixa simples na cor do carro
    const m = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.1, 4.2),
      new THREE.MeshLambertMaterial({ color: def.color }));
    m.position.y = 0.55;
    g.add(m);
    _procGeos.add(m.geometry);                              // fresco por build: dispose no restart
    def.colLen = def.key === 'civTruck' ? 6.5 : 4.2;        // M4: cápsula coerente com a caixa
    def.colWid = 1.8;
  });
  return g;
}
