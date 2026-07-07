// celestial/system.js — O ÚNICO builder de sistemas estelares (AC-07) — agora
// FASEADO (audit T-PR-06): só UM sistema é materializado por vez, construído na
// ORIGEM da cena (fim do jitter float32 a 19–29M u). O resto da galáxia existe
// como descritores estáticos de config.SYSTEMS (glows/nav/mapa). loadSystem()
// constrói; unloadSystem() DESCARTA tudo (geometrias, materiais, luzes, fx,
// inimigos, projéteis, poços) — a fase anterior morre de verdade.

import * as THREE from '../../../vendor/three.module.min.js';
import { SYSTEMS } from '../config.js';
import { scene, camera } from '../scene.js';
import { game } from '../state.js';
import { HEADLESS, diskMaterial, REMNANT_VERT, REMNANT_FRAG } from './atoms.js';

// Hooks de animação por-frame (discos, jatos, caudas, pulsos, correntes).
const bodyFx = [];
// Decorações culladas junto com o sistema dono ({ group, cullKey }).
const _culledDecorations = [];
// Decorações do sistema ativo (para dispose).
const _decorations = [];

// Fábricas declarativas (universe.universeSystems()), injetadas no boot para
// evitar import circular universe↔system.
let _factories = null;
// Hooks de fase (main.js injeta): notificação pós-load/pós-unload.
let _hooks = { onLoaded: null, onUnloaded: null };

export function initUniverse(factories, hooks = {}) {
  _factories = factories;
  _hooks = { ..._hooks, ...hooks };
  game.dynBodies = game.dynBodies || [];
  if (!game.world.origin) game.world.origin = new THREE.Vector3();
}

export function systemEntry(key) { return SYSTEMS.find((s) => s.key === key) || null; }

const _zero = new THREE.Vector3(0, 0, 0);

function disposeObject(root) {
  root.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    if (o.material) {
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of mats) { if (m.map) m.map.dispose(); m.dispose(); }
    }
  });
}

// Descarrega o sistema ativo: cena limpa, GPU liberada, listas zeradas.
// O mundo entra em modo VAZIO (world.systemKey = null; origin fica onde está —
// o rebase por-frame do vazio assume a precisão a partir daqui).
export function unloadSystem() {
  if (!game.world.systemKey) return;
  const key = game.world.systemKey;
  for (const b of game.bodies) {
    scene.remove(b.group);
    disposeObject(b.group);
  }
  game.bodies.length = 0;
  if (game.dynBodies) game.dynBodies.length = 0;
  for (const deco of _decorations) {
    scene.remove(deco.group);
    if (deco.group.traverse) disposeObject(deco.group);
  }
  _decorations.length = 0;
  _culledDecorations.length = 0;
  bodyFx.length = 0;
  game.sun = null;
  game.world.systemKey = null;
  if (_hooks.onUnloaded) _hooks.onUnloaded(key);
}

// Materializa UM sistema na origem da cena. `shipGalactic` (opcional) é a
// posição galáctica atual da nave — convertida p/ o frame local novo.
export function loadSystem(key) {
  if (game.world.systemKey === key) return true;
  unloadSystem();
  const factory = (_factories || []).find((f) => f.def.key === key);
  const entry = systemEntry(key);
  if (!factory || !entry) return false;
  game.world.origin.set(...entry.center);
  game.world.systemKey = key;
  for (const body of factory.bodies(_zero.set(0, 0, 0))) {
    body.register(key);
    if (body.fx) bodyFx.push(body.fx);
  }
  for (const deco of (factory.decorations ? factory.decorations(_zero.set(0, 0, 0)) : [])) {
    scene.add(deco.group);
    if (deco.fx) bodyFx.push(deco.fx);
    if (deco.cullKey) _culledDecorations.push(deco);
    _decorations.push(deco);
  }
  if (_hooks.onLoaded) _hooks.onLoaded(key);
  return true;
}

// Anima os corpos e decorações especiais (disco de acreção, jatos, caudas, pulso).
export function updateBodyFX(dt) {
  for (const f of bodyFx) f.update(dt);
}

// ── CULLING DO SISTEMA ATIVO: além de 1.15×raio as malhas desligam (zero draw
// calls) e os pontos fotométricos/glow (starlod) assumem. Com fases, só o
// sistema carregado existe — o cull é uma iteração única contra a origem.
export function updateSOIView(shipPos) {
  const key = game.world.systemKey;
  if (!key) return;
  const sys = systemEntry(key);
  const near = shipPos.length() < sys.radius * 1.15;
  for (const b of game.bodies) {
    if (b.def.alwaysVisible) { b.group.visible = true; continue; }
    if (b.group.visible !== near) b.group.visible = near;
  }
  for (const deco of _culledDecorations) {
    deco.group.visible = near;
  }
}

// ═════════════════ Decorações reutilizáveis de sistema (D-6) ═════════════════

// Corrente de acreção: gás arrancado de `source` espiralando para `sink` —
// transferência de massa VISÍVEL, reposicionada a cada frame (ex-binário BN+pulsar).
export function accretionStream(source, sink, { cullKey = null } = {}) {
  const group = new THREE.Group();
  // WISPY, não cano (bug space-war-blackhole-look-not-approved): opacidade
  // baixa e afunilamento LARGO na fonte — lê como gás difuso caindo, e a
  // espiral local do BN (stars.js) assume a queda final no plano do disco.
  const streamMat = new THREE.MeshBasicMaterial({
    color: 0xaad4ff, transparent: true, opacity: 0.08,
    blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
  });
  const sinkR = sink.def.disk ? sink.def.disk.outer * 0.5 : sink.def.radius * 0.3;
  const stream = new THREE.Mesh(
    new THREE.CylinderGeometry(sinkR, source.def.radius * 1.6, 1, 12, 1, true),
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
    streamMat.opacity = 0.05 + 0.03 * Math.sin(this.t * 2.3);
  } };
  return { group, fx, cullKey };
}

// Casca de remanescente de supernova: esfera gigante com filamentos FBM, borda
// realçada (look de CASCA), 2 cores (Hα + O III), expansão sutil contínua.
// FADE POR DISTÂNCIA (bug space-war-blackhole-look-not-approved, AC-05): a
// "bola de plasma" é visível NA APROXIMAÇÃO desde longe (rampa suave) em vez
// do pop do cull duro de 1.15×raio — e some de vez só além de FAR_OUT.
const REMNANT_FULL = 1_200_000;    // até aqui: opacidade plena
const REMNANT_FAR = 3_500_000;     // daqui p/ fora: invisível (e mesh desligada)
export function supernovaRemnant({ radius, color1, color2, center, cullKey = null }) {
  const group = new THREE.Group();
  const mat = new THREE.ShaderMaterial({
    vertexShader: REMNANT_VERT,
    fragmentShader: REMNANT_FRAG,
    uniforms: {
      uTime: { value: 0 },
      uFade: { value: 1 },
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
    const d = camera.position.distanceTo(group.position);
    const fade = 1 - THREE.MathUtils.smoothstep(d, REMNANT_FULL, REMNANT_FAR);
    mat.uniforms.uFade.value = fade;
    shell.visible = fade > 0.01;
    game.remnantFade = fade;                        // diagnóstico p/ e2e (AC-05)
  } };
  return { group, fx, cullKey };
}
