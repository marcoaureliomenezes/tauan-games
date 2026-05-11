// factory-fx.js — Fumaça contínua de chaminés de fábricas.
// Exporta: addSmokeEmitter, removeSmokeEmittersOf, tickSmokeEmitters, tickFactoryParticles.
// Para adicionar novo tipo de emissor contínuo: estenda smokeEmitters com campo type.
//
// Pool exclusivo: factorySmokePool (30 slots) nunca compartilhado com explosões.
// Chamado por main.js: tickSmokeEmitters(dt) + tickFactoryParticles(dt) a cada frame.

import * as THREE from '../../vendor/three.module.min.js';
import { scene } from './scene.js';
import { COLORS } from './config.js';

const SMOKE_GEOM = new THREE.SphereGeometry(1.0, 6, 5);

// factorySmokePool: 30 slots — exclusivo desta lógica de chaminé
const factorySmoke = [], factorySmokePool = [];
for (let i = 0; i < 30; i++) {
  const m = new THREE.Mesh(SMOKE_GEOM, new THREE.MeshBasicMaterial({ color: COLORS.chimneySmoke, transparent: true, opacity: 0.5 }));
  m.visible = false; scene.add(m); factorySmokePool.push(m);
}

const smokeEmitters = [];

/** Registra um emissor contínuo de fumaça (chaminé de fábrica).
 *  @param {number} x @param {number} y @param {number} z
 *  @param {THREE.Object3D} ownerMesh — mesh do alvo dono do emissor */
export function addSmokeEmitter(x, y, z, ownerMesh) {
  smokeEmitters.push({ x, y, z, cool: Math.random() * 0.5, ownerMesh });
}

/** Remove todos os emissores associados a um mesh (chamado por killTarget). */
export function removeSmokeEmittersOf(mesh) {
  for (let i = smokeEmitters.length - 1; i >= 0; i--) {
    if (smokeEmitters[i].ownerMesh === mesh) smokeEmitters.splice(i, 1);
  }
}

/** Emite puffs de fumaça pelas chaminés ativas. Usa exclusivamente factorySmokePool.
 *  @param {number} dt segundos */
export function tickSmokeEmitters(dt) {
  for (const em of smokeEmitters) {
    em.cool -= dt;
    if (em.cool > 0) continue;
    em.cool = 0.4 + Math.random() * 0.3;
    const m = factorySmokePool.pop(); if (!m) continue;
    m.material.opacity = 0.45;
    m.material.color.setHex(COLORS.chimneySmoke);
    m.position.set(em.x, em.y, em.z);
    m.scale.setScalar(0.6);
    m.visible = true;
    factorySmoke.push({
      mesh: m,
      vx: (Math.random() - 0.5) * 0.5, vy: 2.0 + Math.random(), vz: (Math.random() - 0.5) * 0.5,
      life: 3.0, max: 4.0, maxScale: 3.5,
    });
  }
}

/** Atualiza as partículas de fumaça de chaminé ativas. Retorna slots ao factorySmokePool.
 *  @param {number} dt segundos */
export function tickFactoryParticles(dt) {
  for (let i = factorySmoke.length - 1; i >= 0; i--) {
    const s = factorySmoke[i]; s.life -= dt;
    s.mesh.position.x += s.vx * dt;
    s.mesh.position.y += s.vy * dt;
    s.mesh.position.z += s.vz * dt;
    s.vy *= 0.99;
    const t = s.life / s.max;
    s.mesh.material.opacity = Math.max(0, t * 0.5);
    const sc = 1 + (1 - t) * s.maxScale;
    s.mesh.scale.setScalar(sc);
    if (s.life <= 0) { s.mesh.visible = false; factorySmokePool.push(s.mesh); factorySmoke.splice(i, 1); }
  }
}
