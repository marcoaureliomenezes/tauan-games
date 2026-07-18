// cars.js — Catálogo + modelos com SILHUETA REAL: a carroceria é uma EXTRUSÃO
// do perfil lateral verdadeiro de cada carro (não caixas). O FIAT IDEA
// ADVENTURE 2013 DUALOGIC segue as proporções reais do monovolume: 3,96 m de
// comprimento, 1,73 de largura, 1,66 de altura, capô CURTO mergulhando num
// para-brisa inclinado, teto longo quase reto, traseira alta vertical,
// longarinas de teto e cladding plástico cinza-escuro do pacote Adventure.
//
// Eixos do modelo: frente = -Z, largura = X, altura = Y. Perfis em [z, y]
// (z>0 = frente) percorrendo do para-choque traseiro ao dianteiro pelo TOPO;
// a base fecha reta na altura da soleira.

import * as THREE from '../../vendor/three.module.min.js';

export const CARS = [
  {
    key: 'idea', name: 'Idea Adventure 2013 Dual Logic',
    desc: 'O monovolume aventureiro do Marco — suspensão alta, encara terra como ninguém.',
    color: 0x9ba1a8, accent: 0x23262a,
    topSpeed: 62, accel: 26, handling: 2.15, grip: 0.94, brake: 46,
    dirtBonus: 0.22, body: 'mpv',
    width: 1.75, sill: 0.34, wheelR: 0.44, wheelZ: [1.22, -1.28],
    // monobox alto: traseira vertical alta → teto longo → para-brisa inclinado
    // → capô curto e alto → nariz arredondado.
    profile: [
      [-1.98, 0.72], [-2.0, 1.18], [-1.92, 1.52], [-1.55, 1.64], [-0.2, 1.66],
      [0.42, 1.60], [1.02, 1.24], [1.5, 1.06], [1.88, 1.0], [1.98, 0.72],
    ],
    glass: { z0: -1.85, z1: 1.15, y0: 1.06, y1: 1.52, windshield: [0.5, 1.1, 1.56, 1.16] },
    rails: true, cladding: true,
  },
  {
    key: 'muscle', name: 'Thunder V8',
    desc: 'Muscle americano — reto ninguém segura, curva é outra história.',
    color: 0xb02030, accent: 0x141414,
    topSpeed: 72, accel: 30, handling: 1.7, grip: 0.82, brake: 40,
    dirtBonus: 0, body: 'muscle',
    width: 1.9, sill: 0.3, wheelR: 0.42, wheelZ: [1.52, -1.52],
    // capô LONGO, cabine recuada baixa, traseira fastback
    profile: [
      [-2.32, 0.66], [-2.34, 0.92], [-2.05, 1.0], [-1.35, 1.06], [-0.7, 1.3],
      [0.1, 1.34], [0.62, 1.06], [1.1, 0.98], [2.2, 0.92], [2.34, 0.62],
    ],
    glass: { z0: -1.15, z1: 0.5, y0: 0.98, y1: 1.28, windshield: [0.28, 1.0, 1.3, 1.04] },
    scoop: true,
  },
  {
    key: 'exotic', name: 'Velocità GT',
    desc: 'Exótico italiano — cola no asfalto, sofre na terra.',
    color: 0xf0c020, accent: 0x181818,
    topSpeed: 76, accel: 32, handling: 2.3, grip: 0.97, brake: 52,
    dirtBonus: -0.1, body: 'exotic',
    width: 1.94, sill: 0.24, wheelR: 0.4, wheelZ: [1.42, -1.38],
    // cunha baixíssima: nariz rente ao chão, cabine bolha no meio
    profile: [
      [-2.15, 0.6], [-2.18, 0.86], [-1.7, 0.95], [-0.95, 1.06], [-0.2, 1.1],
      [0.45, 1.0], [1.1, 0.76], [1.8, 0.58], [2.18, 0.5], [2.2, 0.38],
    ],
    glass: { z0: -0.85, z1: 0.42, y0: 0.82, y1: 1.06, windshield: [0.2, 0.78, 1.06, 0.86] },
    wing: true,
  },
  {
    key: 'pickup', name: 'Mule Pickup',
    desc: 'Picape parruda — lenta no retão, trator na terra.',
    color: 0x2a5aa0, accent: 0x2c2c2c,
    topSpeed: 58, accel: 24, handling: 1.9, grip: 0.88, brake: 44,
    dirtBonus: 0.28, body: 'pickup',
    width: 1.95, sill: 0.42, wheelR: 0.5, wheelZ: [1.45, -1.5],
    // caçamba baixa atrás + cabine alta + capô alto quadrado
    profile: [
      [-2.38, 0.8], [-2.4, 1.1], [-0.62, 1.1], [-0.58, 1.62], [0.42, 1.66],
      [0.9, 1.28], [1.35, 1.14], [2.3, 1.1], [2.4, 0.78],
    ],
    glass: { z0: -0.5, z1: 0.55, y0: 1.14, y1: 1.56, windshield: [0.42, 1.16, 1.6, 1.2] },
    bed: true,
  },
  {
    key: 'concept', name: 'Neon 2049',
    desc: 'Conceito futurista — equilíbrio total, luzes de outro século.',
    color: 0x30c8c0, accent: 0x202030,
    topSpeed: 68, accel: 29, handling: 2.1, grip: 0.9, brake: 48,
    dirtBonus: 0.05, body: 'concept',
    width: 1.85, sill: 0.28, wheelR: 0.42, wheelZ: [1.35, -1.35],
    // gota contínua: uma curva só do nariz à cauda
    profile: [
      [-2.1, 0.6], [-2.15, 0.95], [-1.6, 1.2], [-0.7, 1.34], [0.2, 1.3],
      [0.9, 1.08], [1.5, 0.84], [2.05, 0.62], [2.15, 0.42],
    ],
    glass: { z0: -1.3, z1: 0.7, y0: 0.95, y1: 1.3, windshield: [0.5, 0.9, 1.28, 0.98] },
    neon: true,
  },
];

const M = (color, opts = {}) => new THREE.MeshLambertMaterial({ color, ...opts });

// carroceria: Shape do perfil lateral extrudado na largura, com bevel (cantos
// arredondados — mata o visual "caixa de desenho animado").
function bodyMesh(def) {
  const shape = new THREE.Shape();
  const sill = def.sill;
  const prof = def.profile;
  shape.moveTo(prof[0][0], sill);
  for (const [z, y] of prof) shape.lineTo(z, y);
  shape.lineTo(prof[prof.length - 1][0], sill);
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: def.width - 0.16, bevelEnabled: true,
    bevelThickness: 0.08, bevelSize: 0.08, bevelSegments: 2, steps: 1,
  });
  geo.translate(0, 0, -(def.width - 0.16) / 2);
  geo.rotateY(Math.PI / 2);                       // perfil +z (frente) → mundo -Z
  const mesh = new THREE.Mesh(geo, M(def.color));
  return mesh;
}

// faixa de vidro: banda escura em volta do glasshouse + para-brisa inclinado.
function glassMeshes(def) {
  const g = def.glass;
  const out = [];
  const glassMat = M(0x1a2530);
  // banda lateral (levemente mais larga que o corpo → aparece dos 2 lados)
  const band = new THREE.Mesh(
    new THREE.BoxGeometry(def.width - 0.02, g.y1 - g.y0, Math.abs(g.z1 - g.z0)),
    glassMat);
  band.position.set(0, (g.y0 + g.y1) / 2, -(g.z0 + g.z1) / 2);
  out.push(band);
  // para-brisa: plano inclinado na frente da cabine
  const [zw, yb, yt, zt] = [g.windshield[0], g.windshield[1], g.windshield[2], g.windshield[3]];
  const ws = new THREE.Mesh(new THREE.PlaneGeometry(def.width - 0.3, Math.hypot(yt - yb, 0.6)), glassMat);
  ws.position.set(0, (yb + yt) / 2, -(zw + 0.3));
  ws.rotation.x = -Math.atan2(0.6, yt - yb) * 0.9;
  out.push(ws); void zt;
  return out;
}

function box(w, h, d, mat, x, y, z) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  return m;
}

export function buildCarMesh(def) {
  const g = new THREE.Group();
  const accent = M(def.accent);
  g.add(bodyMesh(def));
  for (const m of glassMeshes(def)) g.add(m);

  // rodas + caixas de roda escuras + calotas
  const wheelMat = M(0x101010);
  const hubMat = M(0xb8bcc2);
  g.userData.wheels = [];
  for (const z of def.wheelZ) {
    for (const sd of [-1, 1]) {
      const arch = new THREE.Mesh(
        new THREE.CylinderGeometry(def.wheelR + 0.12, def.wheelR + 0.12, 0.3, 12, 1, false, 0, Math.PI),
        accent);
      arch.rotation.z = Math.PI / 2; arch.rotation.y = Math.PI / 2;
      arch.position.set(sd * (def.width / 2 - 0.12), def.wheelR + 0.04, -z);
      g.add(arch);
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(def.wheelR, def.wheelR, 0.26, 14), wheelMat);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(sd * (def.width / 2 - 0.1), def.wheelR, -z);
      g.add(wheel); g.userData.wheels.push(wheel);
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(def.wheelR * 0.45, def.wheelR * 0.45, 0.28, 10), hubMat);
      hub.rotation.z = Math.PI / 2;
      hub.position.copy(wheel.position);
      g.add(hub);
    }
  }

  const zF = def.profile[def.profile.length - 1][0];   // frente (z>0 no perfil → -Z mundo)
  const zR = def.profile[0][0];
  // faróis / lanternas / grade / placa
  const lightMat = M(0xfff6cc, { emissive: 0x777044 });
  const tailMat = M(0xd02020, { emissive: 0x551010 });
  for (const sd of [-1, 1]) {
    g.add(box(0.42, 0.16, 0.06, lightMat, sd * (def.width / 2 - 0.42), def.profile[def.profile.length - 2][1] - 0.12, -zF + 0.02));
    g.add(box(0.4, 0.14, 0.06, tailMat, sd * (def.width / 2 - 0.4), def.profile[1][1] - 0.1, -zR - 0.02));
  }
  g.add(box(0.9, 0.16, 0.05, accent, 0, def.sill + 0.28, -zF + 0.02));          // grade
  g.add(box(0.5, 0.14, 0.04, M(0xd8d8d0), 0, def.sill + 0.1, -zR - 0.03));      // placa
  // retrovisores
  for (const sd of [-1, 1]) {
    g.add(box(0.16, 0.1, 0.08, M(def.color), sd * (def.width / 2 + 0.1), def.glass.y0 + 0.14, -(def.glass.z1 - 0.15)));
  }
  // para-choques (banda escura baixa nas duas pontas)
  g.add(box(def.width - 0.05, 0.2, 0.22, accent, 0, def.sill + 0.06, -zF + 0.06));
  g.add(box(def.width - 0.05, 0.2, 0.22, accent, 0, def.sill + 0.06, -zR - 0.06));

  // detalhes por corpo
  if (def.rails) {                                    // longarinas do Idea
    for (const sd of [-1, 1]) {
      g.add(box(0.07, 0.07, 2.6, M(0x1c1c1c), sd * (def.width / 2 - 0.22), def.profile[4][1] + 0.06, 0.25));
    }
  }
  if (def.cladding) {                                 // saia plástica Adventure
    g.add(box(def.width + 0.04, 0.16, Math.abs(zF - zR) - 0.3, accent, 0, def.sill + 0.02, 0));
  }
  if (def.scoop) g.add(box(0.5, 0.14, 0.55, accent, 0, def.profile[8][1] + 0.1, -1.5));
  if (def.wing) {
    g.add(box(def.width - 0.2, 0.07, 0.4, accent, 0, 1.02, 1.95));
    for (const sd of [-1, 1]) g.add(box(0.08, 0.3, 0.1, accent, sd * 0.7, 0.85, 1.95));
  }
  if (def.bed) g.add(box(def.width - 0.35, 0.06, 1.6, M(0x3a3f45), 0, 1.06, 1.5));
  if (def.neon) g.add(box(def.width - 0.2, 0.05, 0.05, M(0xffffff, { emissive: 0x88ffff }), 0, def.sill + 0.16, -zF + 0.1));

  return g;
}
