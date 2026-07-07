// environment/clouds.js — Nuvens BILLBOARD instanciadas, compartilhadas pelos
// mapas (T-AR-04). Substitui os aglomerados de esferas (look "algodão de Lego",
// dezenas de draw calls): 3 InstancedMesh (1 por variação de textura) de planos
// que encaram a câmera por frame — 3 draw calls no total, silhueta fofa real.

import * as THREE from '../../../vendor/three.module.min.js';
import { cloudTexture } from './textures.js';

// yMin da camada baixa ACIMA do relevo máximo (~120 + crag): nuvem no chão
// lia como "ovelha no pasto".
const LAYERS = [
  { count: 18, yMin: 190, yMax: 260, sMin: 90, sMax: 170, range: 2600 },
  { count: 22, yMin: 320, yMax: 480, sMin: 140, sMax: 260, range: 3400 },
  { count: 12, yMin: 560, yMax: 780, sMin: 220, sMax: 420, range: 4200 },
];

const _dummy = new THREE.Object3D();
const _tint = new THREE.Color();

export function buildClouds(scene, rng) {
  const rand = rng || Math.random.bind(Math);
  const sets = [];
  const items = [];
  for (const L of LAYERS) {
    for (let i = 0; i < L.count; i++) {
      items.push({
        x: (rand() * 2 - 1) * L.range,
        y: L.yMin + rand() * (L.yMax - L.yMin),
        z: (rand() * 2 - 1) * L.range,
        s: L.sMin + rand() * (L.sMax - L.sMin),
        v: 2.5 + rand() * 3.5,                 // deriva (vento oeste→leste)
        variant: Math.floor(rand() * 3),
        range: L.range,
      });
    }
  }
  const geo = new THREE.PlaneGeometry(1, 0.5);
  for (let v = 0; v < 3; v++) {
    const mine = items.filter((it) => it.variant === v);
    if (!mine.length) continue;
    const mat = new THREE.MeshBasicMaterial({
      map: cloudTexture(v), transparent: true, depthWrite: false,
      opacity: 0.92, fog: false,
    });
    const mesh = new THREE.InstancedMesh(geo, mat, mine.length);
    mesh.frustumCulled = false;
    mesh.renderOrder = 4;
    scene.add(mesh);
    sets.push({ mesh, items: mine, mat });
  }
  return { sets };
}

/** Deriva + billboard + tom por hora do dia. Chamar por frame. */
export function updateClouds(clouds, dt, camera, tint = null) {
  if (!clouds) return;
  for (const set of clouds.sets) {
    if (tint) {
      _tint.setRGB(tint.r, tint.g, tint.b);
      set.mat.color.lerp(_tint, Math.min(1, dt * 2));
    }
    set.items.forEach((it, i) => {
      it.x += it.v * dt;
      if (it.x > it.range) it.x = -it.range;
      _dummy.position.set(it.x, it.y, it.z);
      _dummy.quaternion.copy(camera.quaternion);   // billboard
      _dummy.scale.set(it.s, it.s, 1);
      _dummy.updateMatrix();
      set.mesh.setMatrixAt(i, _dummy.matrix);
    });
    set.mesh.instanceMatrix.needsUpdate = true;
  }
}
