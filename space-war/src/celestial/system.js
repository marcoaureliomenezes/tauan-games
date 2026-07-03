// celestial/system.js — O ÚNICO builder de sistemas estelares (AC-07).
//
// Consome o mapa declarativo de universe.js: cada sistema é { def (entrada de
// config.SYSTEMS), bodies() → instâncias de CelestialBody com motion plugado,
// decorations() → decorações do sistema }. Aqui só existe mecânica genérica:
// registrar corpos, coletar fx, montar beacons e cull por proximidade.
// As 5 funções bespoke de bodies.js morreram nesta release.

import * as THREE from '../../../vendor/three.module.min.js';
import { SYSTEMS } from '../config.js';
import { scene } from '../scene.js';
import { game } from '../state.js';
import { HEADLESS, makeRadialSprite, diskMaterial, REMNANT_VERT, REMNANT_FRAG } from './atoms.js';

// Hooks de animação por-frame (discos, jatos, caudas, pulsos, correntes).
const bodyFx = [];
// Decorações culladas junto com o sistema dono ({ group, cullKey }).
const _culledDecorations = [];
const _beacons = [];

export function buildUniverse(systems) {
  game.dynBodies = game.dynBodies || [];
  for (const sys of systems) {
    const key = sys.def.key;
    for (const body of sys.bodies()) {
      body.register(key);
      if (body.fx) bodyFx.push(body.fx);
    }
    for (const deco of (sys.decorations ? sys.decorations() : [])) {
      scene.add(deco.group);
      if (deco.fx) bodyFx.push(deco.fx);
      if (deco.cullKey) _culledDecorations.push(deco);
    }
  }
  buildSystemBeacons();
  return game.bodies;
}

// Anima os corpos e decorações especiais (disco de acreção, jatos, caudas, pulso).
export function updateBodyFX(dt) {
  for (const f of bodyFx) f.update(dt);
}

// ── Beacons: um farol colorido por sistema distante ─────────────────────────
const BEACON_TINTS = {
  binary: ['rgba(220,232,255,0.98)', 'rgba(150,185,255,0.55)', 'rgba(150,90,230,0.18)', 'rgba(0,0,0,0)'],
  chaotic: ['rgba(200,220,255,0.95)', 'rgba(255,180,110,0.45)', 'rgba(120,80,50,0.12)', 'rgba(0,0,0,0)'],
  core: ['rgba(255,240,220,0.98)', 'rgba(255,190,120,0.5)', 'rgba(160,80,200,0.20)', 'rgba(0,0,0,0)'],
  veil: ['rgba(255,214,170,0.98)', 'rgba(255,140,90,0.5)', 'rgba(190,235,255,0.18)', 'rgba(0,0,0,0)'],
};
const BEACON_DEFAULT = ['rgba(240,240,255,0.95)', 'rgba(190,200,255,0.5)', 'rgba(120,110,200,0.15)', 'rgba(0,0,0,0)'];

function buildSystemBeacons() {
  for (const sys of SYSTEMS) {
    if (sys.key === 'solar') continue;
    if (sys.key === 'betelgeuse') continue;   // a própria supergigante é o farol
    const sp = makeRadialSprite(BEACON_TINTS[sys.key] || BEACON_DEFAULT);
    sp.scale.setScalar(40000);
    sp.position.set(...sys.center);
    scene.add(sp);
    _beacons.push({ sys, sprite: sp });
  }
}

// ── CULLING POR SISTEMA: sistemas distantes ficam invisíveis (zero draw calls);
// no lugar brilha o beacon. Corpos com def.alwaysVisible nunca somem (ex.:
// Betelgeuse — uma supergigante é visível de qualquer lugar do mapa).
const _sysCenter = new THREE.Vector3();
export function updateSOIView(shipPos) {
  for (const sys of SYSTEMS) {
    if (sys.key === 'solar') continue;
    _sysCenter.set(...sys.center);
    const near = shipPos.distanceTo(_sysCenter) < sys.radius * 1.15;
    for (const b of game.bodies) {
      if (b.system !== sys.key) continue;
      if (b.def.alwaysVisible) { b.group.visible = true; continue; }
      if (b.group.visible !== near) b.group.visible = near;
    }
    for (const deco of _culledDecorations) {
      if (deco.cullKey === sys.key) deco.group.visible = near;
    }
  }
  for (const bc of _beacons) {
    _sysCenter.set(...bc.sys.center);
    bc.sprite.visible = shipPos.distanceTo(_sysCenter) > bc.sys.radius * 0.9;
  }
}

// ═════════════════ Decorações reutilizáveis de sistema (D-6) ═════════════════

// Corrente de acreção: gás arrancado de `source` espiralando para `sink` —
// transferência de massa VISÍVEL, reposicionada a cada frame (ex-binário BN+pulsar).
export function accretionStream(source, sink, { cullKey = null } = {}) {
  const group = new THREE.Group();
  const streamMat = new THREE.MeshBasicMaterial({
    color: 0xaad4ff, transparent: true, opacity: 0.28,
    blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
  });
  const sinkR = sink.def.disk ? sink.def.disk.inner * 0.14 : sink.def.radius * 0.3;
  const stream = new THREE.Mesh(
    new THREE.CylinderGeometry(sinkR, source.def.radius * 0.5, 1, 10, 1, true),
    streamMat,
  );
  group.add(stream);
  const _sDir = new THREE.Vector3();
  const _sUp = new THREE.Vector3(0, 1, 0);
  const fx = { t: 0, update(dt) {
    this.t += dt;
    _sDir.copy(sink.worldPos).sub(source.worldPos);
    const dist = _sDir.length();
    stream.visible = sink.group.visible && dist > 1;
    if (!stream.visible) return;
    _sDir.multiplyScalar(1 / dist);
    stream.position.copy(source.worldPos).addScaledVector(_sDir, dist * 0.5);
    stream.scale.set(1, dist * 0.88, 1);
    stream.quaternion.setFromUnitVectors(_sUp, _sDir);
    streamMat.opacity = 0.09 + 0.05 * Math.sin(this.t * 2.3);
  } };
  return { group, fx, cullKey };
}

// Casca de remanescente de supernova: esfera gigante com filamentos FBM, borda
// realçada (look de CASCA), 2 cores (Hα + O III), expansão sutil contínua.
export function supernovaRemnant({ radius, color1, color2, center, cullKey = null }) {
  const group = new THREE.Group();
  const mat = new THREE.ShaderMaterial({
    vertexShader: REMNANT_VERT,
    fragmentShader: REMNANT_FRAG,
    uniforms: {
      uTime: { value: 0 },
      uCol1: { value: new THREE.Color(color1) },
      uCol2: { value: new THREE.Color(color2) },
    },
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
  });
  const seg = HEADLESS ? 20 : 64;
  const shell = new THREE.Mesh(new THREE.SphereGeometry(radius, seg, Math.floor(seg * 0.66)), mat);
  shell.renderOrder = 1;
  group.add(shell);
  if (center) group.position.copy(center);
  const fx = { t: 0, update(dt) {
    this.t += dt;
    mat.uniforms.uTime.value = this.t;
    shell.rotation.y += dt * 0.002;                 // deriva lenta dos filamentos
    const grow = 1 + this.t * 0.00012;              // expansão sutil contínua
    shell.scale.setScalar(Math.min(1.25, grow));
  } };
  return { group, fx, cullKey };
}
