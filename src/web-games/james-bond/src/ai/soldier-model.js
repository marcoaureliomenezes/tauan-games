import * as THREE from '../../../vendor/three.module.min.js';
import { makeFlashMaterial } from '../view-model.js';

// Proportioned combat soldier (~1.85 m) in a two-handed rifle stance, facing +Z.
// Colors: muted fatigues, plate-carrier vest, balaclava + helmet — CS-style silhouette.
export function buildSoldier(accent = 0x3d4a40, elite = false) {
  const root = new THREE.Group();
  const fatigues = new THREE.MeshStandardMaterial({ color: accent, roughness: 0.85, metalness: 0.05 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x1c211e, roughness: 0.9 });
  const vest = new THREE.MeshStandardMaterial({ color: elite ? 0x33261f : 0x232a26, roughness: 0.8 });
  const mask = new THREE.MeshStandardMaterial({ color: elite ? 0x4a1f1c : 0x171b19, roughness: 0.92 });
  const skin = new THREE.MeshStandardMaterial({ color: 0x9c7460, roughness: 0.85 });
  const gunMetal = new THREE.MeshStandardMaterial({ color: 0x1e2223, roughness: 0.42, metalness: 0.8 });

  const pelvis = mesh(new THREE.BoxGeometry(0.34, 0.2, 0.22), dark, [0, 0.98, 0]);
  const torso = mesh(new THREE.CapsuleGeometry(0.21, 0.42, 5, 12), fatigues, [0, 1.38, 0]);
  const plate = mesh(new THREE.BoxGeometry(0.4, 0.42, 0.3), vest, [0, 1.4, 0.02]);
  const pouchL = mesh(new THREE.BoxGeometry(0.1, 0.12, 0.08), dark, [-0.12, 1.24, 0.18]);
  const pouchR = mesh(new THREE.BoxGeometry(0.1, 0.12, 0.08), dark, [0.12, 1.24, 0.18]);

  const head = mesh(new THREE.SphereGeometry(0.14, 16, 12), mask, [0, 1.72, 0.01]);
  head.scale.set(0.92, 1.05, 0.98);
  const face = mesh(new THREE.BoxGeometry(0.14, 0.07, 0.06), skin, [0, 1.7, 0.12]);
  const goggles = mesh(new THREE.BoxGeometry(0.16, 0.045, 0.05), dark, [0, 1.75, 0.12]);
  const helmet = mesh(new THREE.SphereGeometry(0.155, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), fatigues, [0, 1.76, 0]);
  const brim = mesh(new THREE.CylinderGeometry(0.165, 0.17, 0.03, 16), fatigues, [0, 1.76, 0]);

  const legL = limb(0.085, 0.72, fatigues, [-0.11, 0.52, 0]);
  const legR = limb(0.085, 0.72, fatigues, [0.11, 0.52, 0]);
  const bootL = mesh(new THREE.BoxGeometry(0.13, 0.1, 0.26), dark, [-0.11, 0.05, 0.03]);
  const bootR = mesh(new THREE.BoxGeometry(0.13, 0.1, 0.26), dark, [0.11, 0.05, 0.03]);

  // arms reach forward to the rifle (two-handed stance)
  const armL = limb(0.065, 0.5, fatigues, [-0.24, 1.42, 0.16]);
  armL.rotation.set(-1.15, 0, -0.35);
  const armR = limb(0.065, 0.5, fatigues, [0.24, 1.38, 0.1]);
  armR.rotation.set(-0.9, 0, 0.55);
  const handL = mesh(new THREE.SphereGeometry(0.06, 10, 8), dark, [-0.08, 1.44, 0.42]);
  const handR = mesh(new THREE.SphereGeometry(0.06, 10, 8), dark, [0.12, 1.36, 0.2]);

  // rifle pointing +Z
  const rifle = new THREE.Group();
  const receiver = mesh(new THREE.BoxGeometry(0.07, 0.1, 0.5), gunMetal, [0, 0, 0.1]);
  const barrel = mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.42, 10), gunMetal, [0, 0.02, 0.5], [Math.PI / 2, 0, 0]);
  const magazine = mesh(new THREE.BoxGeometry(0.05, 0.18, 0.1), gunMetal, [0, -0.12, 0.08], [0.3, 0, 0]);
  const stock = mesh(new THREE.BoxGeometry(0.06, 0.09, 0.22), dark, [0, -0.01, -0.22]);
  rifle.add(receiver, barrel, magazine, stock);
  rifle.position.set(0.1, 1.4, 0.18);
  const muzzleTip = new THREE.Object3D();
  muzzleTip.position.set(0, 0.02, 0.72);
  rifle.add(muzzleTip);

  const flash = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.22), makeFlashMaterial());
  flash.position.copy(muzzleTip.position);
  flash.material.opacity = 0;
  flash.userData.fx = true;
  rifle.add(flash);

  root.add(pelvis, torso, plate, pouchL, pouchR, head, face, goggles, helmet, brim,
    legL, legR, bootL, bootR, armL, armR, handL, handR, rifle);

  head.userData.zone = 'head';
  helmet.userData.zone = 'head';
  goggles.userData.zone = 'head';
  torso.userData.zone = 'torso';
  plate.userData.zone = 'torso';
  pelvis.userData.zone = 'torso';
  [legL, legR, bootL, bootR, armL, armR, handL, handR, pouchL, pouchR, face].forEach((part) => { part.userData.zone = 'limb'; });
  [receiver, barrel, magazine, stock].forEach((part) => { part.userData.zone = 'limb'; });

  root.traverse((part) => { if (part.isMesh && !part.userData.fx) { part.castShadow = true; part.receiveShadow = true; } });
  root.userData.kind = 'enemy';

  const ring = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.58, 18), new THREE.MeshBasicMaterial({ color: 0xee5b55, side: THREE.DoubleSide, transparent: true, opacity: 0 }));
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.02;
  ring.userData.fx = true;
  root.add(ring);

  const hitMeshes = [];
  root.traverse((part) => { if (part.isMesh && part.userData.zone) hitMeshes.push(part); });
  return { root, ring, head, torso, legL, legR, armL, armR, rifle, muzzleTip, flash, hitMeshes };
}

function mesh(geometry, material, position, rotation = [0, 0, 0]) {
  const part = new THREE.Mesh(geometry, material);
  part.position.set(...position);
  part.rotation.set(...rotation);
  return part;
}

function limb(radius, length, material, position) {
  return mesh(new THREE.CapsuleGeometry(radius, length, 4, 10), material, position);
}
