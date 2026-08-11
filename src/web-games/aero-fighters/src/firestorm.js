// firestorm.js — Firestorm pós-nuke (release v0.3.10,
// T-N-02/T-N-03). Após a detonação no mapa Inhaúma, todo inflamável dentro de
// NUKE_FIRESTORM.RADIUS (260 m = 2× o raio máx da bola de fogo, nuclear-fx.js)
// atravessa o ciclo: FOGO 60 s → SÓ FUMAÇA +120 s → CARBONIZADO (preto) permanente.
// Exporta: spawnFirestorm, updateFirestorm, clearFirestorm, setFirestormHooks,
//   firestormDebug + as curvas puras firestormPhaseAt/firestormCharAt (Node tests).
// Para adicionar um tipo novo de inflamável: novo ramo em spawnFirestorm +
// charEntriesFor.
//
// Cobertura: árvores (inhaumaTrees), construções (getInhaumaStructures —
// quarteirões instanciados via block.charRefs, marcos soltos via charRoot) e
// alvos (game.targets). Carbonização: InstancedMesh → setColorAt lerp→preto;
// Groups → materiais clonados 1× (units.js e inhauma-scene.js COMPARTILHAM
// materiais via cache) e escurecidos aos poucos durante o fogo, preto total ao
// fim das chamas. Alvos pegando fogo sofrem dano de fogo (letal em leves,
// pesado em blindados — na prática o shockwave da nuke já matou; o wreck
// carbonizado permanece).
//
// Node-safe: nada de scene.js/targets.js importados — malha dos pools e dano
// chegam por setFirestormHooks (padrão city-war.js). Guarda headless igual à de
// prop-fire.js: não roda sob webdriver, EXCETO em ?testMode=1 (pools capados em
// config.js#NUKE_FIRESTORM protegem o FPS; o cap MAX_EMITTERS prioriza os focos
// mais próximos do epicentro). Ticado por main.js: updateFirestorm(dt).

import * as THREE from '../../vendor/three.module.min.js';
import { NUKE_FIRESTORM, COLORS } from './config.js';
import { game } from './state.js';
import { inhaumaTrees, getInhaumaStructures } from './maps/inhauma-scene.js';

const HEADLESS = typeof navigator !== 'undefined' && navigator.webdriver === true;
const fxEnabled = () => !HEADLESS || game.runtime?.testMode === true;

// Hooks injetados por main.js — no-op em Node (tests injetam stubs).
let _h = { addMesh: () => {}, damageTarget: () => {} };
export function setFirestormHooks(hooks) { Object.assign(_h, hooks); }

const FIRE_S = NUKE_FIRESTORM.FIRE_S;
const TOTAL_S = NUKE_FIRESTORM.FIRE_S + NUKE_FIRESTORM.SMOKE_S;
// Blindados: fogo causa dano pesado (não letal direto). O resto morre queimado.
const ARMOR_TYPES = new Set(['tank', 'fTank', 'fApc', 'warship', 'armedConvoy']);

/** Fase do ciclo de fogo em t segundos desde a ignição: fire→smoke→charred. Pura. */
export function firestormPhaseAt(t) {
  if (t < FIRE_S) return 'fire';
  if (t < TOTAL_S) return 'smoke';
  return 'charred';
}

/** Fator de carbonização 0→1 ao longo das chamas (1 = preto total). Pura. */
export function firestormCharAt(t) {
  return Math.max(0, Math.min(1, t / FIRE_S));
}

// ── Pools próprios de puffs (chama aditiva + fumaça) — nunca compartilhados ──
const PUFF_GEOM = new THREE.SphereGeometry(1.0, 6, 5);
const FIRE_COLORS = [COLORS.flameYellow, COLORS.fireOrange, COLORS.fireRed];
const flamePool = [], smokePool = [], flames = [], smokes = [];
const emitters = [];
let built = false;

function build() {
  if (built) return;
  for (let i = 0; i < NUKE_FIRESTORM.FLAME_POOL; i++) {
    const m = new THREE.Mesh(PUFF_GEOM, new THREE.MeshBasicMaterial({
      color: COLORS.fireOrange, transparent: true, opacity: 0.9,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    m.visible = false; _h.addMesh(m); flamePool.push(m);
  }
  for (let i = 0; i < NUKE_FIRESTORM.SMOKE_POOL; i++) {
    const m = new THREE.Mesh(PUFF_GEOM, new THREE.MeshBasicMaterial({
      color: COLORS.smokeGrey, transparent: true, opacity: 0.5, depthWrite: false,
    }));
    m.visible = false; _h.addMesh(m); smokePool.push(m);
  }
  built = true;
}

// ── Carbonização ─────────────────────────────────────────────────────────────
const _c = new THREE.Color();
const BLACK = new THREE.Color(0x000000);

// Alvos de escurecimento de um objeto: {imesh, idx, orig} (InstancedMesh →
// setColorAt) ou {mat, orig} (material clonado de Group). orig = cor original,
// capturada na ignição; o lerp→preto nunca toca a cor original.
function charEntriesFor(kind, ref) {
  const out = [];
  if (kind === 'tree') {
    if (ref.crown?.instanceColor) {
      const orig = new THREE.Color();
      ref.crown.getColorAt(ref.ci, orig);
      out.push({ imesh: ref.crown, idx: ref.ci, orig });
    }
    // Tronco não tem instanceColor próprio: branco (multiplica a cor do material).
    if (ref.trunk) out.push({ imesh: ref.trunk, idx: ref.ci, orig: new THREE.Color(0xffffff) });
    return out;
  }
  if (kind === 'structure' && ref.block?.charRefs) {
    for (const cr of ref.block.charRefs) {
      if (!cr.mesh.instanceColor) continue;
      const orig = new THREE.Color();
      cr.mesh.getColorAt(cr.index, orig);
      out.push({ imesh: cr.mesh, idx: cr.index, orig });
    }
    return out;
  }
  const root = kind === 'structure' ? ref.charRoot : ref.mesh;
  if (!root) return out;
  if (root.userData._fsChar) return root.userData._fsChar; // já clonado (2ª nuke)
  const cloned = new Map(); // preserva o compartilhamento: 1 clone por material
  root.traverse((o) => {
    if (!o.isMesh || !o.material?.color) return;
    if (!cloned.has(o.material)) {
      const m = o.material.clone();
      cloned.set(o.material, m);
      out.push({ mat: m, orig: m.color.clone() });
    }
    o.material = cloned.get(o.material);
  });
  root.userData._fsChar = out;
  return out;
}

function applyChar(em, k) {
  for (const e of em.chars) {
    _c.copy(e.orig).lerp(BLACK, k);
    if (e.imesh) { e.imesh.setColorAt(e.idx, _c); e.imesh.instanceColor.needsUpdate = true; }
    else e.mat.color.copy(_c);
  }
}

/** Acende o firestorm no epicentro: todo inflamável dentro de NUKE_FIRESTORM
 * .RADIUS (árvores, construções, alvos) — cap MAX_EMITTERS, prioridade aos mais
 * próximos. Só no mapa Inhaúma; guarda headless/testMode como prop-fire.
 *  @param {{x:number,y:number,z:number}} ep epicentro da detonação */
export function spawnFirestorm(ep) {
  if (!fxEnabled() || game.activeMap !== 'inhauma') return;
  build();
  const R2 = NUKE_FIRESTORM.RADIUS * NUKE_FIRESTORM.RADIUS;
  const cands = [];
  for (const tr of inhaumaTrees) {
    const d2 = (tr.x - ep.x) ** 2 + (tr.z - ep.z) ** 2;
    if (d2 <= R2) cands.push({ kind: 'tree', x: tr.x, y: tr.y + 3, z: tr.z, scale: 1.0, ref: tr, d2 });
  }
  for (const s of getInhaumaStructures()) {
    const d2 = (s.x - ep.x) ** 2 + (s.z - ep.z) ** 2;
    if (d2 <= R2) cands.push({ kind: 'structure', x: s.x, y: (s.topY || 6) * 0.6, z: s.z, scale: 1.8, ref: s, d2 });
  }
  for (const t of game.targets) {
    const p = t.mesh?.position;
    if (!p) continue;
    const d2 = (p.x - ep.x) ** 2 + (p.z - ep.z) ** 2;
    if (d2 <= R2) cands.push({ kind: 'target', x: p.x, y: p.y + 2, z: p.z, scale: 1.5, ref: t, d2 });
  }
  cands.sort((a, b) => a.d2 - b.d2); // os mais próximos do epicentro primeiro
  for (const c of cands.slice(0, NUKE_FIRESTORM.MAX_EMITTERS)) {
    if (c.kind === 'target') {
      const t = c.ref;
      _h.damageTarget(t, ARMOR_TYPES.has(t.type) ? t.hp * 0.8 : t.hp * 2);
    }
    emitters.push({ ...c, t: 0, cool: Math.random() * 0.1, charCool: 0, charK: -1, chars: charEntriesFor(c.kind, c.ref) });
  }
}

function puffFlame(em) {
  const m = flamePool.pop(); if (!m) return;
  m.material.color.setHex(FIRE_COLORS[(Math.random() * FIRE_COLORS.length) | 0]);
  m.material.opacity = 0.9;
  m.position.set(
    em.x + (Math.random() - 0.5) * 2.6 * em.scale,
    em.y + Math.random() * 1.8 * em.scale,
    em.z + (Math.random() - 0.5) * 2.6 * em.scale,
  );
  const s0 = (0.9 + Math.random() * 1.3) * em.scale;
  m.scale.setScalar(s0); m.visible = true;
  flames.push({ mesh: m, vy: 4 + Math.random() * 5, life: 0.55 + Math.random() * 0.4, max: 0.95, sc: s0 });
}

function puffSmoke(em) {
  const m = smokePool.pop(); if (!m) return;
  m.material.opacity = 0.5;
  m.position.set(
    em.x + (Math.random() - 0.5) * 2 * em.scale,
    em.y + em.scale,
    em.z + (Math.random() - 0.5) * 2 * em.scale,
  );
  const s0 = 0.8 * em.scale;
  m.scale.setScalar(s0); m.visible = true;
  smokes.push({ mesh: m, vy: 2.2 + Math.random() * 1.2, life: 2.4 + Math.random() * 1.2, max: 3.6, sc: s0 });
}

/** Avança o ciclo fogo→fumaça→carbonizado de todos os focos. @param {number} dt s */
export function updateFirestorm(dt) {
  if (!fxEnabled()) return;
  for (let e = emitters.length - 1; e >= 0; e--) {
    const em = emitters[e];
    em.t += dt;
    const phase = firestormPhaseAt(em.t);
    if (phase === 'charred') { applyChar(em, 1); emitters.splice(e, 1); continue; }
    // Carbonização progressiva em passos de ~0.25 s (needsUpdate do
    // instanceColor re-upa o buffer inteiro — não fazer por frame); preto total
    // garantido a partir do fim das chamas.
    em.charCool -= dt;
    const k = phase === 'smoke' ? 1 : firestormCharAt(em.t);
    if (em.charCool <= 0 && k !== em.charK) { em.charCool = 0.25; em.charK = k; applyChar(em, k); }
    em.cool -= dt;
    if (em.cool > 0) continue;
    if (phase === 'fire') { em.cool = 0.07 + Math.random() * 0.08; puffFlame(em); }
    else { em.cool = 0.55 + Math.random() * 0.45; puffSmoke(em); }
  }
  for (let i = flames.length - 1; i >= 0; i--) {
    const f = flames[i]; f.life -= dt;
    f.mesh.position.y += f.vy * dt;
    f.vy *= 0.96;
    const u = Math.max(0, f.life / f.max);
    f.mesh.material.opacity = u * 0.9;
    f.mesh.scale.setScalar(f.sc * (0.6 + (1 - u) * 1.4));
    if (f.life <= 0) { f.mesh.visible = false; flamePool.push(f.mesh); flames.splice(i, 1); }
  }
  for (let i = smokes.length - 1; i >= 0; i--) {
    const s = smokes[i]; s.life -= dt;
    s.mesh.position.y += s.vy * dt;
    s.vy *= 0.99;
    const u = Math.max(0, s.life / s.max);
    s.mesh.material.opacity = u * 0.5;
    s.mesh.scale.setScalar(s.sc * (1 + (1 - u) * 3.2));
    if (s.life <= 0) { s.mesh.visible = false; smokePool.push(s.mesh); smokes.splice(i, 1); }
  }
}

/** Apaga todos os focos e devolve os puffs aos pools (restart/modo defesa). */
export function clearFirestorm() {
  for (const f of flames) { f.mesh.visible = false; flamePool.push(f.mesh); }
  for (const s of smokes) { s.mesh.visible = false; smokePool.push(s.mesh); }
  flames.length = 0; smokes.length = 0; emitters.length = 0;
}

/** Introspecção para testes Node (sem expor mutação — padrão cityWarDebug). */
export function firestormDebug() {
  return { emitters, flames: flames.length, smokes: smokes.length };
}
