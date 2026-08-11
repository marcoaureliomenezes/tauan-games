// wingmen.js — Aliados AI de suporte (2 caças amigos em formação com o jogador).
// Exporta: spawnWingmen, updateWingmen, clearWingmen, wingmenList, wingmanSlotWorld.
// T-C-13 (Onda 5, release v0.3.4):
//  - Mesh melhor (caça multi-parte, padrão do defense enemy-fighter, pintura azul
//    aliada com acento distinto por wingman);
//  - VOO EM FORMAÇÃO: slots de escalon esq/dir atrás do líder (config.WINGMEN),
//    slot rotacionado só pelo YAW do jato, perseguição suave com lag (sem rubber-band);
//  - ENGAJAMENTO GENÉRICO por proximidade do PLAYER (não por mapa): qualquer hostil
//    AÉREO de game.targets (helicópteros/zepelins — ex.: Inhaúma) ou caça da ally-war
//    dentro de ENGAGE_RADIUS do jogador vira alvo; morto/afastado (RETURN_RADIUS),
//    o wingman volta à formação. Nos mapas legados o dogfight da ally-war continua:
//    os caças vermelhos perseguem os wingmen e chegam à vizinhança do jogador.
// Node-safe: fx.js/ally-war.js puxam scene.js (window) — carregados por import
// dinâmico tardio (fire-and-forget) para as sims Node (test-aero-visual.mjs).

import * as THREE from '../../vendor/three.module.min.js';
import { game } from './state.js';
import { audio } from './audio.js';
import { getAirportForMap } from './airport.js';
import { isAirborneState } from './sortie-state.js';
import { WINGMEN } from './config.js';

// Carregamento tardio (ver header) — resolve no 1º uso no browser, falha
// silenciosa em Node (onde esses efeitos não são exercitados).
let _fxP = null;
const lazyExplosion = (pos, scale) => {
  _fxP = _fxP || import('./fx.js');
  _fxP.then((m) => m.explosion(pos, scale)).catch(() => {});
};
let _allyP = null;
const lazyAllyMissile = (from, target, quat) => {
  _allyP = _allyP || import('./ally-war.js');
  _allyP.then((m) => m.spawnAllyMissile(from, target, quat)).catch(() => {});
};

export const wingmenList = [];

const _offsets = WINGMEN.FORMATION_OFFSETS.map((o) => new THREE.Vector3(...o));

const _tmpPos = new THREE.Vector3();
const _tmpDir = new THREE.Vector3();
const _fwd = new THREE.Vector3();
const _yawQ = new THREE.Quaternion();
const _YUP = new THREE.Vector3(0, 1, 0);

// ─── Mesh do caça aliado (T-C-13) ─────────────────────────────────────────────
/** Caça multi-parte (padrão defense/fx.makeEnemyFighterMesh) em azul aliado;
 *  `accent` distingue os dois wingmen (pontas de asa + deriva). */
function _buildWingmanMesh(accent) {
  const g = new THREE.Group();
  const body = new THREE.MeshLambertMaterial({ color: 0x2d4060 });
  const dark = new THREE.MeshLambertMaterial({ color: 0x1e2d45 });
  const acc = new THREE.MeshLambertMaterial({ color: accent });
  const glass = new THREE.MeshLambertMaterial({ color: 0x101c2c });
  const glow = new THREE.MeshBasicMaterial({ color: 0xff7020 });

  const fuse = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.5, 4.2), body);
  g.add(fuse);
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.36, 1.3, 6), dark);
  nose.rotation.x = -Math.PI / 2; nose.position.set(0, 0, -2.7); g.add(nose);
  const canopy = new THREE.Mesh(new THREE.SphereGeometry(0.32, 6, 5), glass);
  canopy.scale.set(0.8, 0.6, 1.6); canopy.position.set(0, 0.34, -0.8); g.add(canopy);
  for (const sx of [-1, 1]) { // asas em flecha
    const wing = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.08, 1.4), dark);
    wing.position.set(sx * 2.15, -0.05, 0.5); wing.rotation.y = -sx * 0.42; g.add(wing);
    const tip = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.1, 0.9), acc);
    tip.position.set(sx * 3.65, -0.05, 0.78); tip.rotation.y = -sx * 0.42; g.add(tip);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.72, 0.6), dark);
    tail.position.set(sx * 0.4, 0.36, 1.85); tail.rotation.z = sx * 0.55; g.add(tail);
  }
  const tailBand = new THREE.Mesh(new THREE.BoxGeometry(0.94, 0.18, 0.5), acc);
  tailBand.position.set(0, 0.3, 1.8); g.add(tailBand);
  const stabL = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.06, 0.55), dark);
  stabL.position.set(-0.85, 0.02, 1.85); stabL.rotation.y = 0.3; g.add(stabL);
  const stabR = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.06, 0.55), dark);
  stabR.position.set(0.85, 0.02, 1.85); stabR.rotation.y = -0.3; g.add(stabR);
  const exh = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.24, 0.45, 8), glow);
  exh.rotation.x = Math.PI / 2; exh.position.set(0, 0, 2.3); g.add(exh);

  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  g.scale.setScalar(1.4);
  return g;
}

const WINGMAN_ACCENTS = [0xd8dde6, 0x7fb8e8]; // branco-gelo / azul-claro

function _makeWingman(scene, offsetIdx) {
  const mesh = _buildWingmanMesh(WINGMAN_ACCENTS[offsetIdx % WINGMAN_ACCENTS.length]);
  scene.add(mesh);
  const wm = {
    mesh,
    offsetIdx,
    hp: 3,
    dead: false,
    falling: false,
    fallTimer: 0,
    fireTimer: 1.5 + Math.random() * 1.5,
    scanTimer: 0,
    attackTarget: null,   // { mesh, dead, falling?, hp? } — allyEnemy ou target aéreo
    goal: new THREE.Vector3(),
    _vel: new THREE.Vector3(),
  };
  game.wingmen.push(wm);
  wingmenList.push(wm);
  return wm;
}

export function spawnWingmen(scene, jet) {
  clearWingmen(scene);
  for (let i = 0; i < _offsets.length; i++) {
    const wm = _makeWingman(scene, i);
    wingmanSlotWorld(jet, i, wm.mesh.position);
    wm.goal.copy(wm.mesh.position);
  }
}

export function clearWingmen(scene) {
  for (const wm of wingmenList) {
    if (wm.mesh.parent) scene.remove(wm.mesh);
  }
  wingmenList.length = 0;
  game.wingmen.length = 0;
}

/** Posição-mundo do slot de formação do wingman `idx` relativo ao jato —
 *  offset rotacionado apenas pelo YAW do jato (exportado para a sim Node). */
export function wingmanSlotWorld(jet, idx, out) {
  _fwd.set(0, 0, -1).applyQuaternion(jet.quaternion);
  const yaw = Math.atan2(-_fwd.x, -_fwd.z);
  out.copy(_offsets[idx % _offsets.length]);
  _yawQ.setFromAxisAngle(_YUP, yaw);
  out.applyQuaternion(_yawQ);
  return out.add(jet.position);
}

// ─── Engajamento genérico (T-C-13) ────────────────────────────────────────────
/** Hostil aéreo de game.targets (helicóptero/zepelim legado ou de formação). */
const isAirborneHostile = (t) => !t.dead && (t.airborneAltitude || 0) > 0;
const targetAlive = (t) => t && !t.dead && !t.falling;

/** Ameaça mais próxima DO PLAYER: hostis aéreos de game.targets primeiro
 *  (defesa do líder), senão caças da ally-war. `maxR` = raio a partir do jato. */
function chooseThreat(jetPos, maxR) {
  let best = null;
  let bestD = maxR * maxR;
  for (const t of game.targets) {
    if (!isAirborneHostile(t)) continue;
    const d = jetPos.distanceToSquared(t.mesh.position);
    if (d < bestD) { bestD = d; best = t; }
  }
  if (best) return best;
  for (const e of game.allyEnemies) {
    if (!targetAlive(e)) continue;
    const d = jetPos.distanceToSquared(e.mesh.position);
    if (d < bestD) { bestD = d; best = e; }
  }
  return best;
}

const _worldOffset = new THREE.Vector3();
const _desiredDir = new THREE.Vector3();
const _desiredVel = new THREE.Vector3();
const _playerVel = new THREE.Vector3();
const _lookAt = new THREE.Vector3();

/** Vaga de estacionamento no aeroporto (amigos pousam quando o player pousa). */
function parkingSpot(wm) {
  const airport = getAirportForMap(game.activeMap);
  const s = airport.serviceZone;
  const side = wm.offsetIdx === 0 ? -1 : 1;
  return _worldOffset.set(
    s.center.x + side * (s.width * 0.5 + 40),
    airport.elevation + 2.0,
    s.center.z - 20,
  );
}

export function updateWingmen(dt, jet) {
  const mr = game.missionRealism;
  const state = mr?.sortie?.state;
  // Amigos decolam quando decolamos e pousam quando pousamos: só engajam em voo.
  const airborne = !mr?.enabled || isAirborneState(state);

  for (const wm of wingmenList) {
    if (wm.dead) continue;

    if (wm.falling) {
      wm.fallTimer -= dt;
      // Wobble e queda
      wm.mesh.rotation.z += (Math.random() - 0.5) * 3.0 * dt;
      wm.mesh.rotation.x += 0.8 * dt;
      wm.mesh.position.y -= 30 * dt;
      if (wm.fallTimer <= 0 || wm.mesh.position.y < 1) {
        lazyExplosion(wm.mesh.position.clone(), 1.2);
        audio.explosion(0.6);
        wm.mesh.parent && wm.mesh.parent.remove(wm.mesh);
        wm.dead = true;
      }
      continue;
    }

    // ─── No solo: amigos taxiam/pousam ao lado da pista e ficam parados ───────
    if (!airborne) {
      wm.attackTarget = null;
      const spot = parkingSpot(wm);
      _desiredDir.subVectors(spot, wm.mesh.position);
      const d = Math.max(0.5, _desiredDir.length());
      _desiredDir.normalize();
      const spd = Math.min(60, d * 0.9);
      wm._vel.lerp(_desiredDir.multiplyScalar(spd), Math.min(1, dt * 1.6));
      wm.mesh.position.addScaledVector(wm._vel, dt);
      if (wm._vel.lengthSq() > 0.5) {
        _lookAt.copy(wm.mesh.position).add(wm._vel);
        wm.mesh.lookAt(_lookAt);
      }
      // Nivela a atitude ao parar (sai do banking de combate)
      wm.mesh.rotation.z *= Math.max(0, 1 - dt * 3);
      wm.mesh.rotation.x *= Math.max(0, 1 - dt * 3);
      continue;
    }

    // ─── Escaneamento de ameaça (próxima do PLAYER) com histerese ─────────────
    wm.scanTimer -= dt;
    if (wm.scanTimer <= 0) {
      wm.scanTimer = 0.3;
      const cur = wm.attackTarget;
      if (targetAlive(cur) &&
          jet.position.distanceToSquared(cur.mesh.position) < WINGMEN.RETURN_RADIUS * WINGMEN.RETURN_RADIUS) {
        // Mantém o alvo atual (histerese RETURN_RADIUS > ENGAGE_RADIUS).
      } else {
        wm.attackTarget = chooseThreat(jet.position, WINGMEN.ENGAGE_RADIUS);
      }
    }

    // ─── Goal: slot de formação (todo frame) ou órbita do alvo ───────────────
    if (wm.attackTarget && targetAlive(wm.attackTarget)) {
      const tp = wm.attackTarget.mesh.position;
      const side = wm.offsetIdx === 0 ? 1 : -1;
      const phase = (game.time || 0) * 0.35 + wm.offsetIdx * Math.PI;
      wm.goal.set(
        tp.x + Math.cos(phase) * 130 * side,
        Math.max(tp.y + 20, 70 + wm.offsetIdx * 18),
        tp.z + Math.sin(phase) * 150,
      );
    } else {
      wm.attackTarget = null;
      wingmanSlotWorld(jet, wm.offsetIdx, wm.goal);
    }

    // ─── Perseguição suave: feedforward da velocidade do líder + ganho no erro ─
    _desiredDir.subVectors(wm.goal, wm.mesh.position);
    const dist = _desiredDir.length();
    _fwd.set(0, 0, -1).applyQuaternion(jet.quaternion);
    _playerVel.copy(_fwd).multiplyScalar(wm.attackTarget ? 0 : (game.player.speed || 0));
    _desiredVel.copy(_desiredDir).multiplyScalar(WINGMEN.CATCHUP_GAIN).add(_playerVel);
    if (_desiredVel.length() > WINGMEN.MAX_SPD) _desiredVel.setLength(WINGMEN.MAX_SPD);
    wm._vel.lerp(_desiredVel, Math.min(1, dt * WINGMEN.VEL_LAG));
    wm.mesh.position.addScaledVector(wm._vel, dt);
    wm.mesh.position.y = Math.max(26, wm.mesh.position.y);
    if (wm._vel.lengthSq() > 1) {
      _lookAt.copy(wm.mesh.position).add(wm._vel);
      wm.mesh.lookAt(_lookAt);
    }

    // ─── Disparo: míssil aliado no alvo engajado (ally-war resolve o dano) ────
    wm.fireTimer -= dt;
    if (wm.fireTimer <= 0) {
      const [fMin, fMax] = WINGMEN.FIRE_INTERVAL;
      wm.fireTimer = fMin + Math.random() * (fMax - fMin);
      const foe = wm.attackTarget;
      if (foe && targetAlive(foe) &&
          wm.mesh.position.distanceToSquared(foe.mesh.position) < WINGMEN.FIRE_RANGE * WINGMEN.FIRE_RANGE) {
        _tmpDir.subVectors(foe.mesh.position, wm.mesh.position).normalize();
        _tmpPos.copy(wm.mesh.position).addScaledVector(_tmpDir, 3);
        lazyAllyMissile(_tmpPos.clone(), foe, wm.mesh.quaternion);
      } else {
        wm.fireTimer = 0.8;
      }
    }
  }
}
