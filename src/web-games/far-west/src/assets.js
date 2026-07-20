// assets.js — GLTF model registry loaded from vendor/models/manifest.json, with a
// guaranteed procedural low-poly fallback for EVERY semantic key: the game never
// breaks on a missing manifest or model. Exports: loadModels, spawn, getModel,
// getModelGeometry. To add a model key, add it to the manifest (and optionally to
// procedural.js makeFallback for a nicer fallback).

import * as THREE from '../../vendor/three.module.min.js';
import { GLTFLoader } from '../../vendor/jsm/loaders/GLTFLoader.js';
import { mergeGeometries } from '../../vendor/jsm/utils/BufferGeometryUtils.js';
import { makeFallback } from './procedural.js';

const registry = {}; // key -> { scene, animations }

/**
 * Loads the manifest and every GLB it lists. Missing manifest, missing files or
 * parse errors all fall through to procedural fallbacks — silently by design.
 * @param {THREE.WebGLRenderer} renderer unused today; reserved for KTX2 later
 * @returns {Promise<object>} the registry
 */
export async function loadModels(renderer) {
  let manifest = null;
  try {
    const res = await fetch('../vendor/models/manifest.json');
    if (res.ok) manifest = await res.json();
  } catch (e) { /* offline or absent manifest -> all fallbacks */ }
  if (manifest) {
    // Manifest shape: { models: { key: { file, ... } } } — a flat { key: "file" }
    // map is also accepted for forward compatibility.
    const entries = Object.entries(manifest.models || manifest)
      .map(([key, v]) => [key, typeof v === 'string' ? v : v && v.file])
      .filter(([, file]) => !!file);
    const loader = new GLTFLoader();
    await Promise.all(entries.map(async ([key, file]) => {
      try {
        const gltf = await loader.loadAsync(`../vendor/models/${file}`);
        // Material fix: rough non-metal PBR (GLB packs ship shiny/blown-out defaults)
        gltf.scene.traverse((n) => {
          if (n.isMesh && n.material) {
            if ('metalness' in n.material) n.material.metalness = 0;
            if ('roughness' in n.material) n.material.roughness = 0.9;
          }
        });
        registry[key] = { scene: gltf.scene, animations: gltf.animations || [] };
      } catch (e) { /* single model failure -> procedural fallback for this key */ }
    }));
  }
  return registry;
}

/** Registry entry for a key, or null when only the fallback is available. */
export function getModel(key) {
  return registry[key] || null;
}

/**
 * Minimal SkeletonUtils-style clone: clones the hierarchy, then rebinds skinned
 * meshes to the cloned bones (three's Object3D.clone shares skeletons otherwise).
 */
function cloneModel(source) {
  const clone = source.clone(true);
  const lookup = new Map(); // clone node -> source node
  const cloneLookup = new Map(); // source node -> clone node
  const stack = [[source, clone]];
  while (stack.length) {
    const [s, c] = stack.pop();
    lookup.set(c, s);
    cloneLookup.set(s, c);
    for (let i = 0; i < s.children.length; i++) stack.push([s.children[i], c.children[i]]);
  }
  // Mirrors three's SkeletonUtils.clone: rebuild each skinned mesh's skeleton
  // from the CLONED bones and rebind with the mesh's own bindMatrix (rebinding
  // with matrixWorld instead distorts the mesh badly).
  clone.traverse((node) => {
    if (!node.isSkinnedMesh) return;
    const sourceMesh = lookup.get(node);
    const bones = sourceMesh.skeleton.bones.map((b) => cloneLookup.get(b) || b);
    const inverses = sourceMesh.skeleton.boneInverses.map((m) => m.clone());
    node.skeleton = new THREE.Skeleton(bones, inverses);
    node.bind(node.skeleton, node.bindMatrix);
  });
  return clone;
}

/**
 * Returns a cloned Object3D for a semantic key (horse, deer, cowboy, treePine...).
 * Uses the GLB when loaded, otherwise the procedural low-poly fallback.
 * @returns {THREE.Object3D}
 */
export function spawn(key) {
  const entry = registry[key];
  return entry ? cloneModel(entry.scene) : makeFallback(key);
}

/**
 * Scales an object uniformly so its bounding box is targetHeight tall, with its
 * lowest point at local y=0 (feet on the ground). Skinned meshes are measured
 * with their skinned (bind-pose) bounds — naive Box3.setFromObject mismeasures
 * rigs that carry scale-100 node chains (common in GLB packs).
 * @param {THREE.Object3D} obj @param {number} targetHeight m
 */
export function fitHeight(obj, targetHeight) {
  obj.updateMatrixWorld(true);
  const box = new THREE.Box3();
  const tmp = new THREE.Box3();
  obj.traverse((n) => {
    if (n.isSkinnedMesh) {
      n.computeBoundingBox(); // skinned bounds in mesh-local space
      box.union(tmp.copy(n.boundingBox).applyMatrix4(n.matrixWorld));
    } else if (n.isMesh) {
      if (!n.geometry.boundingBox) n.geometry.computeBoundingBox();
      box.union(tmp.copy(n.geometry.boundingBox).applyMatrix4(n.matrixWorld));
    }
  });
  const h = (box.max.y - box.min.y) || 1;
  const s = targetHeight / h;
  obj.scale.setScalar(s);
  obj.position.y = -box.min.y * s;
  return obj;
}

/**
 * Average color of a textured material, sampled from its map (4x4 downscale).
 * Needed because some packs ship white baseColorFactor + a palette texture.
 * Falls back to the material color (or mid-grey) when sampling is impossible.
 */
function materialColor(material) {
  const white = { r: 1, g: 1, b: 1 };
  const col = (material && material.color) ? material.color : { r: 0.5, g: 0.5, b: 0.5 };
  const isWhite = Math.abs(col.r - 1) < 0.01 && Math.abs(col.g - 1) < 0.01 && Math.abs(col.b - 1) < 0.01;
  if (!material || !material.map || !material.map.image || !isWhite) return col;
  try {
    const cv = document.createElement('canvas');
    cv.width = 4; cv.height = 4;
    const ctx = cv.getContext('2d');
    ctx.drawImage(material.map.image, 0, 0, 4, 4);
    const d = ctx.getImageData(0, 0, 4, 4).data;
    let r = 0, g = 0, b = 0, n = 0;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] < 128) continue; // skip transparent texels
      r += d[i]; g += d[i + 1]; b += d[i + 2]; n++;
    }
    if (!n) return white;
    return { r: r / n / 255, g: g / n / 255, b: b / n / 255 };
  } catch (e) {
    return white;
  }
}

/**
 * Bakes a GLTF scene into a single vertex-colored BufferGeometry, scaled to
 * targetHeight with feet at y=0 — for InstancedMesh scatter. Returns null when
 * the key is unavailable or merge fails (caller uses its procedural fallback).
 * @param {string} key @param {number} targetHeight m
 */
export function getModelGeometry(key, targetHeight) {
  const entry = registry[key];
  if (!entry) return null;
  const geoms = [];
  entry.scene.updateMatrixWorld(true);
  entry.scene.traverse((n) => {
    if (!n.isMesh || !n.geometry) return;
    const g = n.geometry.clone().applyMatrix4(n.matrixWorld);
    const col = materialColor(n.material);
    const count = g.attributes.position.count;
    const colors = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      colors[i * 3] = col.r; colors[i * 3 + 1] = col.g; colors[i * 3 + 2] = col.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    for (const name of Object.keys(g.attributes)) {
      if (name !== 'position' && name !== 'normal' && name !== 'color') g.deleteAttribute(name);
    }
    geoms.push(g.index ? g.toNonIndexed() : g);
  });
  if (!geoms.length) return null;
  try {
    const merged = mergeGeometries(geoms, false);
    merged.computeBoundingBox();
    const bb = merged.boundingBox;
    const s = targetHeight / ((bb.max.y - bb.min.y) || 1);
    merged.applyMatrix4(new THREE.Matrix4().makeScale(s, s, s));
    merged.translate(0, -bb.min.y * s, 0);
    return merged;
  } catch (e) {
    return null;
  }
}
