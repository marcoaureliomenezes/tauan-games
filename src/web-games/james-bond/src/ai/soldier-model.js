import * as THREE from '../../../vendor/three.module.min.js';
import { makeFlashMaterial } from '../view-model.js';

// Enemy archetypes (~1.85 m, facing +Z):
//  human   — counter-terrorist do CS 1.6: farda navy, colete com porta-carregadores,
//            capacete com óculos, balaclava, joelheiras, rifle em posição de combate.
//  vampire — Drácula: sobretudo longo preto, colete vermelho, colarinho branco,
//            rosto pálido, olhos vermelhos, cabelo puxado, garras à frente.
//  monster — bruto estilo Resident Evil: torso nu pálido e musculoso, ferida exposta,
//            calças rasgadas, corcunda, braços longos, olhos brancos opacos.
export function buildSoldier(accent = 0x2b3547, elite = false, type = 'human') {
  const root = new THREE.Group();
  const parts = { hit: [] };
  if (type === 'vampire') buildVampire(root, parts);
  else if (type === 'monster') buildMonster(root, parts, elite);
  else buildHuman(root, parts, accent, elite);

  root.traverse((part) => { if (part.isMesh && !part.userData.fx) { part.castShadow = true; part.receiveShadow = true; } });
  root.userData.kind = 'enemy';
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.58, 18), new THREE.MeshBasicMaterial({ color: 0xee5b55, side: THREE.DoubleSide, transparent: true, opacity: 0 }));
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.02;
  ring.userData.fx = true;
  root.add(ring);

  const hitMeshes = [];
  root.traverse((part) => { if (part.isMesh && part.userData.zone) hitMeshes.push(part); });
  return { root, ring, head: parts.head, torso: parts.torso, legL: parts.legL, legR: parts.legR,
    armL: parts.armL, armR: parts.armR, muzzleTip: parts.muzzleTip || null, flash: parts.flash || null, hitMeshes };
}

function buildHuman(root, parts, accent, elite) {
  const navy = new THREE.MeshStandardMaterial({ color: accent, roughness: 0.82, metalness: 0.06 });
  const black = new THREE.MeshStandardMaterial({ color: 0x14171b, roughness: 0.88 });
  const vestMat = new THREE.MeshStandardMaterial({ color: elite ? 0x2b2018 : 0x181c20, roughness: 0.78 });
  const balaclava = new THREE.MeshStandardMaterial({ color: 0x121518, roughness: 0.92 });
  const gunMetal = new THREE.MeshStandardMaterial({ color: 0x1e2223, roughness: 0.42, metalness: 0.8 });

  parts.legL = limb(0.085, 0.72, navy, [-0.11, 0.52, 0]);
  parts.legR = limb(0.085, 0.72, navy, [0.11, 0.52, 0]);
  const bootL = box([0.13, 0.1, 0.26], black, [-0.11, 0.05, 0.03]);
  const bootR = box([0.13, 0.1, 0.26], black, [0.11, 0.05, 0.03]);
  const kneeL = box([0.12, 0.1, 0.06], black, [-0.11, 0.55, 0.1]);
  const kneeR = box([0.12, 0.1, 0.06], black, [0.11, 0.55, 0.1]);
  const pelvis = box([0.32, 0.2, 0.21], navy, [0, 0.98, 0]);
  parts.torso = limbMesh(0.2, 0.44, navy, [0, 1.4, 0]);
  const vest = box([0.4, 0.4, 0.3], vestMat, [0, 1.42, 0.01]);
  const pouch1 = box([0.09, 0.13, 0.07], black, [-0.11, 1.32, 0.17]);
  const pouch2 = box([0.09, 0.13, 0.07], black, [0, 1.32, 0.18]);
  const pouch3 = box([0.09, 0.13, 0.07], black, [0.11, 1.32, 0.17]);
  const shoulderL = box([0.13, 0.09, 0.2], navy, [-0.26, 1.6, 0]);
  const shoulderR = box([0.13, 0.09, 0.2], navy, [0.26, 1.6, 0]);
  parts.head = limbMesh(0.135, 0.06, balaclava, [0, 1.74, 0.01]);
  const visor = box([0.17, 0.05, 0.05], black, [0, 1.77, 0.11]);
  const helmet = mesh(new THREE.SphereGeometry(0.155, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), navy, [0, 1.78, 0]);
  const brim = mesh(new THREE.CylinderGeometry(0.165, 0.17, 0.03, 16), black, [0, 1.78, 0]);
  parts.armL = limb(0.06, 0.5, navy, [-0.26, 1.44, 0.14]);
  parts.armL.rotation.set(-1.15, 0, -0.35);
  parts.armR = limb(0.06, 0.5, navy, [0.26, 1.4, 0.1]);
  parts.armR.rotation.set(-0.9, 0, 0.55);
  const handL = limbMesh(0.055, 0.02, black, [-0.08, 1.46, 0.42]);
  const handR = limbMesh(0.055, 0.02, black, [0.12, 1.38, 0.2]);

  root.add(parts.legL, parts.legR, bootL, bootR, kneeL, kneeR, pelvis, parts.torso, vest,
    pouch1, pouch2, pouch3, shoulderL, shoulderR, parts.head, visor, helmet, brim,
    parts.armL, parts.armR, handL, handR);

  const rifle = new THREE.Group();
  const receiver = box([0.07, 0.1, 0.5], gunMetal, [0, 0, 0.1]);
  const barrel = mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.42, 10), gunMetal, [0, 0.02, 0.5], [Math.PI / 2, 0, 0]);
  const magazine = box([0.05, 0.18, 0.1], gunMetal, [0, -0.12, 0.08], [0.3, 0, 0]);
  const stock = box([0.06, 0.09, 0.22], black, [0, -0.01, -0.22]);
  parts.muzzleTip = new THREE.Object3D();
  parts.muzzleTip.position.set(0, 0.02, 0.72);
  parts.flash = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.22), makeFlashMaterial());
  parts.flash.position.copy(parts.muzzleTip.position);
  parts.flash.material.opacity = 0;
  parts.flash.userData.fx = true;
  rifle.add(receiver, barrel, magazine, stock, parts.muzzleTip, parts.flash);
  rifle.position.set(0.1, 1.4, 0.18);
  root.add(rifle);
  [receiver, barrel, magazine, stock].forEach((part) => { part.userData.zone = 'limb'; });

  parts.head.userData.zone = 'head';
  helmet.userData.zone = 'head';
  visor.userData.zone = 'head';
  parts.torso.userData.zone = 'torso';
  vest.userData.zone = 'torso';
  pelvis.userData.zone = 'torso';
  [parts.legL, parts.legR, bootL, bootR, kneeL, kneeR, shoulderL, shoulderR, parts.armL, parts.armR, handL, handR, pouch1, pouch2, pouch3]
    .forEach((part) => { part.userData.zone = 'limb'; });
}

function buildVampire(root, parts) {
  const coat = new THREE.MeshStandardMaterial({ color: 0x121218, roughness: 0.86, side: THREE.DoubleSide });
  const redVest = new THREE.MeshStandardMaterial({ color: 0x4f140e, roughness: 0.7 });
  const pale = new THREE.MeshStandardMaterial({ color: 0xd8c9bd, roughness: 0.68 });
  const hairMat = new THREE.MeshStandardMaterial({ color: 0x08080a, roughness: 0.6 });
  const white = new THREE.MeshStandardMaterial({ color: 0xe8e4da, roughness: 0.7 });

  parts.legL = limb(0.08, 0.72, coat, [-0.11, 0.52, 0]);
  parts.legR = limb(0.08, 0.72, coat, [0.11, 0.52, 0]);
  const bootL = box([0.12, 0.09, 0.26], hairMat, [-0.11, 0.045, 0.03]);
  const bootR = box([0.12, 0.09, 0.26], hairMat, [0.11, 0.045, 0.03]);
  const skirt = mesh(new THREE.CylinderGeometry(0.24, 0.38, 0.85, 12, 1, true), coat, [0, 0.95, 0]);
  parts.torso = limbMesh(0.2, 0.46, coat, [0, 1.42, 0]);
  const vest = box([0.26, 0.34, 0.06], redVest, [0, 1.42, 0.19]);
  const collar = box([0.2, 0.07, 0.12], white, [0, 1.68, 0.08]);
  const shoulderL = box([0.16, 0.07, 0.22], coat, [-0.25, 1.63, 0]);
  const shoulderR = box([0.16, 0.07, 0.22], coat, [0.25, 1.63, 0]);
  parts.head = limbMesh(0.13, 0.08, pale, [0, 1.76, 0.01]);
  const hair = mesh(new THREE.SphereGeometry(0.14, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.5), hairMat, [0, 1.79, -0.01]);
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0xff2a1e, toneMapped: false });
  const eyeL = box([0.038, 0.022, 0.02], eyeMat, [-0.05, 1.77, 0.125]);
  const eyeR = box([0.038, 0.022, 0.02], eyeMat, [0.05, 1.77, 0.125]);
  eyeL.userData.fx = true;
  eyeR.userData.fx = true;
  parts.armL = limb(0.06, 0.52, coat, [-0.26, 1.46, 0.18]);
  parts.armL.rotation.set(-1.5, 0, -0.3);
  parts.armR = limb(0.06, 0.52, coat, [0.26, 1.46, 0.18]);
  parts.armR.rotation.set(-1.45, 0, 0.3);
  const clawL = limbMesh(0.055, 0.04, pale, [-0.17, 1.52, 0.52]);
  const clawR = limbMesh(0.055, 0.04, pale, [0.17, 1.52, 0.52]);

  root.add(parts.legL, parts.legR, bootL, bootR, skirt, parts.torso, vest, collar,
    shoulderL, shoulderR, parts.head, hair, eyeL, eyeR, parts.armL, parts.armR, clawL, clawR);

  parts.head.userData.zone = 'head';
  hair.userData.zone = 'head';
  parts.torso.userData.zone = 'torso';
  vest.userData.zone = 'torso';
  skirt.userData.zone = 'torso';
  [parts.legL, parts.legR, bootL, bootR, shoulderL, shoulderR, parts.armL, parts.armR, clawL, clawR, collar]
    .forEach((part) => { part.userData.zone = 'limb'; });
}

function buildMonster(root, parts, elite) {
  const skinMat = new THREE.MeshStandardMaterial({ color: elite ? 0x7a6355 : 0x62665a, roughness: 0.92 });
  const pants = new THREE.MeshStandardMaterial({ color: 0x26262b, roughness: 0.95 });
  const wound = new THREE.MeshStandardMaterial({ color: 0x4a1410, roughness: 0.95 });
  const eyeWhite = new THREE.MeshBasicMaterial({ color: 0xd8d8cc, toneMapped: false });

  parts.legL = limb(0.11, 0.72, pants, [-0.14, 0.52, 0]);
  parts.legR = limb(0.11, 0.72, pants, [0.14, 0.52, 0]);
  const footL = box([0.15, 0.09, 0.28], skinMat, [-0.14, 0.045, 0.04]);
  const footR = box([0.15, 0.09, 0.28], skinMat, [0.14, 0.045, 0.04]);
  const pelvis = box([0.4, 0.22, 0.26], pants, [0, 0.98, 0]);
  parts.torso = limbMesh(0.27, 0.5, skinMat, [0, 1.42, 0.04]);
  parts.torso.rotation.x = 0.3; // corcunda
  const gash = box([0.12, 0.16, 0.025], wound, [0.1, 1.42, 0.29]);
  const chest = box([0.44, 0.18, 0.28], skinMat, [0, 1.56, 0.02]);
  parts.head = limbMesh(0.115, 0.05, skinMat, [0, 1.64, 0.2]);
  const eyeL = box([0.035, 0.022, 0.02], eyeWhite, [-0.045, 1.66, 0.3]);
  const eyeR = box([0.035, 0.022, 0.02], eyeWhite, [0.045, 1.66, 0.3]);
  eyeL.userData.fx = true;
  eyeR.userData.fx = true;
  // braços longos caídos à frente do corpo, não cruzados
  parts.armL = limb(0.085, 0.75, skinMat, [-0.36, 1.28, 0.1]);
  parts.armL.rotation.set(-0.85, 0, -0.2);
  parts.armR = limb(0.085, 0.75, skinMat, [0.36, 1.28, 0.1]);
  parts.armR.rotation.set(-0.85, 0, 0.2);
  const clawL = limbMesh(0.065, 0.06, skinMat, [-0.42, 0.92, 0.32]);
  const clawR = limbMesh(0.065, 0.06, skinMat, [0.42, 0.92, 0.32]);

  root.add(parts.legL, parts.legR, footL, footR, pelvis, parts.torso, gash, chest,
    parts.head, eyeL, eyeR, parts.armL, parts.armR, clawL, clawR);
  root.scale.setScalar(1.22);

  parts.head.userData.zone = 'head';
  parts.torso.userData.zone = 'torso';
  chest.userData.zone = 'torso';
  pelvis.userData.zone = 'torso';
  [parts.legL, parts.legR, footL, footR, parts.armL, parts.armR, clawL, clawR, gash]
    .forEach((part) => { part.userData.zone = 'limb'; });
}

function mesh(geometry, material, position, rotation = [0, 0, 0]) {
  const part = new THREE.Mesh(geometry, material);
  part.position.set(...position);
  part.rotation.set(...rotation);
  return part;
}

function box(size, material, position, rotation = [0, 0, 0]) {
  return mesh(new THREE.BoxGeometry(...size), material, position, rotation);
}

function limb(radius, length, material, position) {
  return mesh(new THREE.CapsuleGeometry(radius, length, 4, 10), material, position);
}

function limbMesh(radius, length, material, position) {
  return limb(radius, length, material, position);
}
