// cars.js — Catálogo de carros (inspirado no elenco do Cruis'n World: muscle,
// esportivo exótico, picape, conceito) + o carro do operador: FIAT IDEA
// ADVENTURE 2013 DUAL LOGIC (monovolume aventureiro, rack de teto, cladding).
// Modelos low-poly procedurais (caixas + cilindros) — nenhum asset externo.
//
// stats: topSpeed (u/s), accel (u/s²), handling (rad/s @ ref), grip (0-1),
// brake (u/s²). Balanceamento arcade: todos competitivos, personalidades
// diferentes (como no N64).

import * as THREE from '../../vendor/three.module.min.js';

export const CARS = [
  {
    key: 'idea', name: 'Idea Adventure 2013 Dual Logic',
    desc: 'O monovolume aventureiro do Marco — suspensão alta, encara terra como ninguém.',
    color: 0x8a8f96, accent: 0x2b2b2b,
    topSpeed: 62, accel: 26, handling: 2.15, grip: 0.94, brake: 46,
    dirtBonus: 0.22,                     // Adventure: perde MENOS grip na terra
    body: 'mpv',
  },
  {
    key: 'muscle', name: 'Thunder V8',
    desc: 'Muscle americano — reto ninguém segura, curva é outra história.',
    color: 0xb02030, accent: 0x111111,
    topSpeed: 72, accel: 30, handling: 1.7, grip: 0.82, brake: 40,
    dirtBonus: 0, body: 'muscle',
  },
  {
    key: 'exotic', name: 'Velocità GT',
    desc: 'Exótico italiano — cola no asfalto, sofre na terra.',
    color: 0xf0c020, accent: 0x181818,
    topSpeed: 76, accel: 32, handling: 2.3, grip: 0.97, brake: 52,
    dirtBonus: -0.1, body: 'exotic',
  },
  {
    key: 'pickup', name: 'Mule Pickup',
    desc: 'Picape parruda — lenta no retão, trator na terra.',
    color: 0x2a5aa0, accent: 0x333333,
    topSpeed: 58, accel: 24, handling: 1.9, grip: 0.88, brake: 44,
    dirtBonus: 0.28, body: 'pickup',
  },
  {
    key: 'concept', name: 'Neon 2049',
    desc: 'Conceito futurista — equilíbrio total, luzes de outro século.',
    color: 0x30c8c0, accent: 0x202030,
    topSpeed: 68, accel: 29, handling: 2.1, grip: 0.9, brake: 48,
    dirtBonus: 0.05, body: 'concept',
  },
];

function box(w, h, d, color, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d),
    new THREE.MeshLambertMaterial({ color }));
  m.position.set(x, y, z);
  return m;
}

// Grupo do carro: comprimento no eixo -Z (frente para -Z, como a câmera olha).
export function buildCarMesh(def) {
  const g = new THREE.Group();
  const c = def.color, a = def.accent;
  if (def.body === 'mpv') {
    // FIAT IDEA ADVENTURE: monovolume ALTO, capô curto, teto longo, rack,
    // cladding plástico escuro nas saias/para-choques (trim Adventure).
    g.add(box(1.75, 0.62, 3.9, c, 0, 0.62, 0));                 // base do corpo
    g.add(box(1.68, 0.68, 2.5, c, 0, 1.18, 0.25));              // cabine alta
    g.add(box(1.8, 0.2, 4.0, a, 0, 0.32, 0));                   // cladding inferior
    g.add(box(0.1, 0.09, 2.2, 0x1c1c1c, -0.6, 1.58, 0.2));      // rack esq
    g.add(box(0.1, 0.09, 2.2, 0x1c1c1c, 0.6, 1.58, 0.2));       // rack dir
    const wind = box(1.5, 0.55, 0.06, 0x223344, 0, 1.2, -1.05); // para-brisa
    wind.rotation.x = -0.35; g.add(wind);
  } else if (def.body === 'muscle') {
    g.add(box(1.9, 0.5, 4.6, c, 0, 0.55, 0));
    g.add(box(1.7, 0.45, 2.0, a, 0, 1.0, 0.3));
    g.add(box(0.5, 0.12, 0.5, a, 0, 0.86, -1.6));               // air scoop
  } else if (def.body === 'exotic') {
    g.add(box(1.9, 0.4, 4.4, c, 0, 0.45, 0));
    const cab = box(1.6, 0.4, 1.7, a, 0, 0.82, 0.1); g.add(cab);
    g.add(box(1.8, 0.1, 0.6, c, 0, 0.75, 1.95));                // aerofólio
    g.add(box(0.12, 0.3, 0.12, a, -0.7, 0.6, 1.95));
    g.add(box(0.12, 0.3, 0.12, a, 0.7, 0.6, 1.95));
  } else if (def.body === 'pickup') {
    g.add(box(1.95, 0.6, 4.6, c, 0, 0.65, 0.2));
    g.add(box(1.85, 0.65, 1.7, c, 0, 1.25, -0.7));              // cabine
    g.add(box(1.85, 0.35, 2.0, a, 0, 0.95, 1.2));               // caçamba
  } else {
    g.add(box(1.8, 0.42, 4.2, c, 0, 0.5, 0));
    g.add(box(1.5, 0.5, 2.2, a, 0, 0.95, 0));
    g.add(box(1.82, 0.06, 0.3, 0xffffff, 0, 0.52, -2.05));      // faixa neon
  }
  // rodas
  const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.3, 12);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x161616 });
  const wheels = [];
  const wy = def.body === 'mpv' || def.body === 'pickup' ? 0.46 : 0.4;
  for (const [x, z] of [[-0.95, -1.35], [0.95, -1.35], [-0.95, 1.35], [0.95, 1.35]]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.z = Math.PI / 2;
    w.position.set(x, wy, z);
    g.add(w); wheels.push(w);
  }
  // vidros escuros + lanternas
  g.add(box(0.5, 0.12, 0.06, 0xff3020, -0.55, 0.62, 2.0));
  g.add(box(0.5, 0.12, 0.06, 0xff3020, 0.55, 0.62, 2.0));
  g.add(box(0.5, 0.14, 0.06, 0xfff2b0, -0.55, 0.6, -2.0));
  g.add(box(0.5, 0.14, 0.06, 0xfff2b0, 0.55, 0.6, -2.0));
  g.userData.wheels = wheels;
  return g;
}
