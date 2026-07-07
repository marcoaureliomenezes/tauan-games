// wingmen.js — Aliados AI de suporte (2 jatos amigos).
// Exporta: spawnWingmen, updateWingmen, clearWingmen, wingmenList.
// Cada wingman patrulha em ataque visível pelo mapa, dispara mísseis fracos e pode ser abatido.

import * as THREE from '../../vendor/three.module.min.js';
import { game } from './state.js';
import { spawnAllyMissile } from './ally-war.js';
import { explosion } from './fx.js';
import { audio } from './audio.js';
import { getAirportForMap } from './airport.js';
import { isAirborneState } from './sortie-state.js';

export const wingmenList = [];

// Formação PRÓXIMA (T-AR-03, operador): os amigos voam na janela de vista do
// jogador — antes (±110-210 u atrás) eles viviam fora da tela.
const _off0 = new THREE.Vector3( 55, 12, -85);
const _off1 = new THREE.Vector3(-65, 10, -65);
const OFFSETS = [_off0, _off1];
const NAMES = ['ASA-1', 'ASA-2'];

const _tmpPos = new THREE.Vector3();
const _tmpDir = new THREE.Vector3();

function _buildWingmanMesh() {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color: 0x2d4060 });
  const darkMat = new THREE.MeshLambertMaterial({ color: 0x1e2d45 });
  const exhMat  = new THREE.MeshBasicMaterial({ color: 0xff7020 });

  // Fuselagem
  const fuse = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.5, 3.5), bodyMat);
  g.add(fuse);

  // Asa esquerda
  const wingL = new THREE.Mesh(new THREE.BoxGeometry(3.5, 0.08, 1.2), darkMat);
  wingL.position.set(-2.2, -0.05, 0.3);
  g.add(wingL);

  // Asa direita
  const wingR = new THREE.Mesh(new THREE.BoxGeometry(3.5, 0.08, 1.2), darkMat);
  wingR.position.set(2.2, -0.05, 0.3);
  g.add(wingR);

  // Vertical tail
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.6, 0.55), darkMat);
  tail.position.set(0, 0.3, 1.65);
  g.add(tail);

  // Nacele de motor (glow do escapamento)
  const exh = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 0.4, 8), exhMat);
  exh.rotation.x = Math.PI / 2;
  exh.position.set(0, 0, 1.9);
  g.add(exh);

  g.scale.setScalar(1.4);
  return g;
}

function _makeWingman(scene, offsetIdx) {
  const mesh = _buildWingmanMesh();
  scene.add(mesh);
  const wm = {
    mesh,
    offsetIdx,
    name: NAMES[offsetIdx] || `ASA-${offsetIdx + 1}`,
    hp: 3,
    dead: false,
    falling: false,
    fallTimer: 0,
    fireTimer: 1.5 + Math.random() * 1.5,
    goalTimer: 0,
    attackTarget: null,
    goal: new THREE.Vector3(),
    _vel: new THREE.Vector3(),
  };
  game.wingmen.push(wm);
  wingmenList.push(wm);
  return wm;
}

export function spawnWingmen(scene, jet) {
  clearWingmen(scene);
  _makeWingman(scene, 0);
  _makeWingman(scene, 1);
}

/** Reforço (T-AR-02): amigos abatidos voltam ao serviço na próxima surtida. */
export function respawnDeadWingmen(scene) {
  let n = 0;
  for (let i = wingmenList.length - 1; i >= 0; i--) {
    const wm = wingmenList[i];
    if (!wm.dead) continue;
    wingmenList.splice(i, 1);
    const gi = game.wingmen.indexOf(wm);
    if (gi >= 0) game.wingmen.splice(gi, 1);
    _makeWingman(scene, wm.offsetIdx);
    n++;
  }
  return n;
}

export function clearWingmen(scene) {
  for (const wm of wingmenList) {
    if (wm.mesh.parent) scene.remove(wm.mesh);
  }
  wingmenList.length = 0;
  game.wingmen.length = 0;
}

const _worldOffset = new THREE.Vector3();
const _desiredDir = new THREE.Vector3();
const _lookAt = new THREE.Vector3();

/** Alvo dos amigos = inimigos DOS ALIADOS (game.allyEnemies), nunca os alvos do player. */
function chooseAllyEnemy(from) {
  let best = null;
  let bestD = Infinity;
  for (const e of game.allyEnemies) {
    if (e.dead || e.falling) continue;
    const d = from.distanceToSquared(e.mesh.position);
    if (d < bestD) { bestD = d; best = e; }
  }
  return best;
}

function chooseGoal(wm, jet) {
  const target = chooseAllyEnemy(jet.position);
  wm.attackTarget = target;
  if (target) {
    const side = wm.offsetIdx === 0 ? 1 : -1;
    const phase = (game.time || 0) * 0.35 + wm.offsetIdx * Math.PI;
    wm.goal.set(
      target.mesh.position.x + Math.cos(phase) * 130 * side,
      Math.max(target.mesh.position.y + 20, 70 + wm.offsetIdx * 18),
      target.mesh.position.z + Math.sin(phase) * 150,
    );
    return;
  }
  _worldOffset.copy(OFFSETS[wm.offsetIdx]).applyQuaternion(jet.quaternion);
  wm.goal.copy(jet.position).add(_worldOffset);
}

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
        explosion(wm.mesh.position.clone(), 1.2);
        audio.explosion(0.6);
        wm.mesh.parent && wm.mesh.parent.remove(wm.mesh);
        wm.dead = true;
      }
      continue;
    }

    // ─── No solo: amigos taxiam/pousam ao lado da pista e ficam parados ───────
    if (!airborne) {
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

    wm.goalTimer -= dt;
    if (wm.goalTimer <= 0 || wm.mesh.position.distanceToSquared(wm.goal) < 80 * 80) {
      wm.goalTimer = 2.2 + Math.random() * 1.6;
      chooseGoal(wm, jet);
    }

    _desiredDir.subVectors(wm.goal, wm.mesh.position);
    const dist = Math.max(1, _desiredDir.length());
    _desiredDir.normalize();
    const speed = Math.min(95, Math.max(42, dist * 0.55));
    wm._vel.lerp(_desiredDir.multiplyScalar(speed), Math.min(1, dt * 1.7));
    wm.mesh.position.addScaledVector(wm._vel, dt);
    wm.mesh.position.y = Math.max(26, wm.mesh.position.y);
    if (wm._vel.lengthSq() > 1) {
      _lookAt.copy(wm.mesh.position).add(wm._vel);
      wm.mesh.lookAt(_lookAt);
    }

    // Ataque aos INIMIGOS DOS ALIADOS (míssil dedicado — não toca nos alvos do player).
    wm.fireTimer -= dt;
    if (wm.fireTimer <= 0) {
      wm.fireTimer = 2.6 + Math.random() * 1.6;
      const foe = chooseAllyEnemy(wm.mesh.position);
      if (foe && wm.mesh.position.distanceToSquared(foe.mesh.position) < 1200 * 1200) {
        _tmpDir.subVectors(foe.mesh.position, wm.mesh.position).normalize();
        _tmpPos.copy(wm.mesh.position).addScaledVector(_tmpDir, 3);
        spawnAllyMissile(_tmpPos.clone(), foe, wm.mesh.quaternion, wm.name);
      } else {
        wm.fireTimer = 0.8;
      }
    }
  }
}
