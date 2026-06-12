import * as THREE from '../../vendor/three.module.min.js';
import { scene } from './scene.js';

const active = [];
export const nuclearFxState = {
  active: false,
  stage: 'idle',
  fireballRadius: 0,
  plumeHeight: 0,
  shockwaveRadius: 0,
  activeParticles: 0,
  lightPulse: 0,
};

export function spawnNuclearFx(epicenter) {
  const group = new THREE.Group();
  const fire = new THREE.Mesh(
    new THREE.SphereGeometry(1, 18, 12),
    new THREE.MeshBasicMaterial({ color: 0xffa020, transparent: true, opacity: 0.95 }),
  );
  const stem = new THREE.Mesh(
    new THREE.CylinderGeometry(3, 8, 1, 14),
    new THREE.MeshBasicMaterial({ color: 0x6a5544, transparent: true, opacity: 0.55 }),
  );
  const cap = new THREE.Mesh(
    new THREE.SphereGeometry(1, 18, 10),
    new THREE.MeshBasicMaterial({ color: 0x8b7a66, transparent: true, opacity: 0.65 }),
  );
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(1, 1.08, 64),
    new THREE.MeshBasicMaterial({ color: 0xfff0aa, transparent: true, opacity: 0.85, side: THREE.DoubleSide }),
  );
  ring.rotation.x = -Math.PI / 2;
  // PointLight transitória (WS-6): a detonação ilumina o terreno ao redor
  const light = new THREE.PointLight(0xffaa44, 7, 1800, 1.1);
  light.position.set(0, 45, 0);
  group.add(fire, stem, cap, ring, light);
  group.position.copy(epicenter);
  scene.add(group);
  active.push({ group, fire, stem, cap, ring, light, t: 0 });
  nuclearFxState.active = true;
  nuclearFxState.stage = 'flash';
}

export function updateNuclearFx(dt) {
  for (let i = active.length - 1; i >= 0; i--) {
    const fx = active[i];
    fx.t += dt;
    const t = fx.t;
    const fireR = Math.min(75, 4 + t * 34);
    const plumeH = Math.min(125, Math.max(0, (t - 0.5) * 45));
    const shockR = Math.min(360, t * 120);
    fx.fire.scale.setScalar(fireR);
    fx.fire.material.opacity = Math.max(0, 0.95 - t * 0.16);
    fx.stem.position.y = plumeH * 0.42;
    fx.stem.scale.set(1 + t * 1.2, Math.max(1, plumeH), 1 + t * 1.2);
    fx.cap.position.y = plumeH + 28;
    fx.cap.scale.set(28 + t * 10, 10 + t * 3, 28 + t * 10);
    fx.ring.scale.setScalar(shockR);
    fx.ring.material.opacity = Math.max(0, 0.8 - t * 0.16);
    if (fx.light) fx.light.intensity = Math.max(0, 7 * (1 - t / 2.8));
    // Vorticidade: cogumelo gira lentamente
    fx.cap.rotation.y += dt * 0.22;
    fx.stem.rotation.y -= dt * 0.12;
    nuclearFxState.stage = t < 0.25 ? 'flash' : t < 1.2 ? 'fireball' : t < 3.8 ? 'mushroom' : 'dissipating';
    nuclearFxState.fireballRadius = fireR;
    nuclearFxState.plumeHeight = plumeH;
    nuclearFxState.shockwaveRadius = shockR;
    nuclearFxState.activeParticles = active.length * 4;
    nuclearFxState.lightPulse = Math.max(0, 1 - t / 2.5);
    if (t > 7) {
      scene.remove(fx.group);
      active.splice(i, 1);
    }
  }
  if (active.length === 0) {
    nuclearFxState.active = false;
    if (nuclearFxState.stage !== 'idle') nuclearFxState.stage = 'idle';
  }
}
