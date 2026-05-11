// wingmen.js — Aliados AI em formação (2 jatos amigos).
// Exporta: spawnWingmen, updateWingmen, clearWingmen, wingmenList.
// Cada wingman voa em formação com o player, auto-ataca inimigos e pode ser abatido.

import * as THREE from '../../vendor/three.module.min.js';
import { game } from './state.js';
import { spawnBullet } from './projectiles.js';
import { explosion } from './fx.js';
import { audio } from './audio.js';

export const wingmenList = [];

const _off0 = new THREE.Vector3( 18, -2, 14);
const _off1 = new THREE.Vector3(-18, -2, 14);
const OFFSETS = [_off0, _off1];

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
    hp: 3,
    dead: false,
    falling: false,
    fallTimer: 0,
    fireTimer: 1.5 + Math.random() * 1.5,
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

export function clearWingmen(scene) {
  for (const wm of wingmenList) {
    if (wm.mesh.parent) scene.remove(wm.mesh);
  }
  wingmenList.length = 0;
  game.wingmen.length = 0;
}

const _worldOffset = new THREE.Vector3();

export function updateWingmen(dt, jet, targets) {
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

    // Formação: lerp posição para offset em espaço local do jato
    _worldOffset.copy(OFFSETS[wm.offsetIdx]).applyQuaternion(jet.quaternion);
    _tmpPos.copy(jet.position).add(_worldOffset);
    wm.mesh.position.lerp(_tmpPos, Math.min(1, 3.5 * dt));
    wm.mesh.quaternion.slerp(jet.quaternion, Math.min(1, 4.0 * dt));

    // Auto-ataque ao alvo mais próximo
    wm.fireTimer -= dt;
    if (wm.fireTimer <= 0) {
      wm.fireTimer = 2.0 + Math.random() * 0.8;
      let nearestDist2 = 800 * 800;
      let nearestTarget = null;
      for (const t of targets) {
        if (t.dead) continue;
        const d2 = wm.mesh.position.distanceToSquared(t.mesh.position);
        if (d2 < nearestDist2) { nearestDist2 = d2; nearestTarget = t; }
      }
      if (nearestTarget) {
        _tmpDir.subVectors(nearestTarget.mesh.position, wm.mesh.position).normalize();
        spawnBullet(wm.mesh.position.clone().addScaledVector(_tmpDir, 2), _tmpDir, false);
      }
    }
  }
}
