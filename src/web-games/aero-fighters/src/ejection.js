import * as THREE from '../../vendor/three.module.min.js';

export function createEjectionState() {
  return { active: false, pilotState: 'IN_AIRCRAFT', elapsed: 0, descentY: 0, saved: false };
}

export function requestEjection(state, aircraftPosition) {
  if (state.active) return false;
  state.active = true;
  state.pilotState = 'PARACHUTE';
  state.elapsed = 0;
  state.descentY = Math.max(aircraftPosition?.y ?? 80, 30);
  state.saved = false;
  return true;
}

export function updateEjection(state, dt) {
  if (!state.active) return false;
  state.elapsed += dt;
  state.descentY = Math.max(0, state.descentY - 9 * dt);
  if (state.descentY <= 0) {
    state.active = false;
    state.pilotState = 'SURVIVED';
    state.saved = true;
    return true;
  }
  return false;
}

export function createPilotVisual(scene) {
  const group = new THREE.Group();
  group.visible = false;
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.8, 10, 8), new THREE.MeshBasicMaterial({ color: 0x1c57ff }));
  const canopy = new THREE.Mesh(new THREE.ConeGeometry(4.5, 1.2, 16), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 }));
  canopy.position.y = 3.0;
  group.add(body, canopy);
  scene.add(group);
  return group;
}

// ─── T-D-10 (inhauma-defense-v1): pool de paraquedas da ejeção dos caças ────
// Reuso trivial do visual acima: o piloto inimigo ejetado (20% dos abates)
// desce à deriva até o terreno. Bounded: `max` paraquedas simultâneos.

/** Cria o pool de paraquedas { scene, max, active, free }. */
export function createParachutePool(scene, max = 2) {
  return { scene, max, active: [], free: [] };
}

/** Solta um paraquedas em (x,y,z) com deriva na direção `dir` (rad). */
export function spawnPoolParachute(pool, x, y, z, dir) {
  let p = pool.free.pop();
  if (!p) {
    if (pool.active.length >= pool.max) return null;
    p = { mesh: createPilotVisual(pool.scene), x: 0, y: 0, z: 0, dir: 0 };
  }
  p.x = x; p.y = y; p.z = z; p.dir = dir;
  p.mesh.position.set(x, y, z);
  p.mesh.visible = true;
  pool.active.push(p);
  return p;
}

/** Desce/deriva os paraquedas ativos; recolhe ao tocar o terreno. */
export function updatePoolParachutes(pool, dt, heightAt, sink = 9, drift = 5) {
  for (let i = pool.active.length - 1; i >= 0; i--) {
    const p = pool.active[i];
    p.y -= sink * dt;
    p.x += Math.cos(p.dir) * drift * dt;
    p.z += Math.sin(p.dir) * drift * dt;
    if (p.y <= heightAt(p.x, p.z) + 0.5) {
      p.mesh.visible = false;
      pool.active.splice(i, 1);
      pool.free.push(p);
      continue;
    }
    p.mesh.position.set(p.x, p.y, p.z);
  }
}

/** Remove os meshes do pool da cena (dispose do modo). */
export function clearParachutePool(pool) {
  for (const p of pool.active) pool.scene.remove(p.mesh);
  for (const p of pool.free) pool.scene.remove(p.mesh);
  pool.active.length = 0;
  pool.free.length = 0;
}
