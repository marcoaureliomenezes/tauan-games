// Registro de inimigos animados (GLB Quaternius, CC0 — ver
// vendor/models/LICENSES.md). Carrega uma vez, clona por instância.
//
// Contrato com guards.js: `spawnEnemyModel(type)` devolve `null` quando não há
// GLB para aquele tipo (ou o carregamento falhou), e nesse caso o chamador cai
// no modelo procedural de soldier-model.js. O jogo nunca quebra por falta de
// asset — mesma regra de fallback procedural adotada em todo o portfólio.

import * as THREE from '../../../vendor/three.module.min.js';
import { GLTFLoader } from '../../../vendor/jsm/loaders/GLTFLoader.js';

const MANIFEST_URL = '../vendor/models/enemies/manifest.json';
const registry = {}; // type -> { scene, clips: Map<nome normalizado, AnimationClip>, meta }

/**
 * Normaliza o nome do clipe: os GLBs vêm como "Armature|Velociraptor_Run" e
 * queremos só "run". Sem isto cada espécie precisaria da sua própria tabela.
 */
function normalizeClip(name, clipPrefix) {
  let out = String(name).split('|').pop();
  if (clipPrefix && out.startsWith(clipPrefix)) out = out.slice(clipPrefix.length);
  return out.toLowerCase();
}

export async function loadEnemyModels() {
  let manifest = null;
  try {
    const response = await fetch(MANIFEST_URL);
    if (response.ok) manifest = await response.json();
  } catch { /* offline ou manifesto ausente -> tudo procedural */ }
  if (!manifest) return registry;

  const loader = new GLTFLoader();
  const entries = Object.entries(manifest.models || {});
  await Promise.all(entries.map(async ([type, meta]) => {
    if (!meta?.file) return;
    try {
      const gltf = await loader.loadAsync(`../vendor/models/enemies/${meta.file}`);
      // Os packs vêm com PBR brilhante demais para a iluminação sombria do jogo.
      gltf.scene.traverse((node) => {
        if (!node.isMesh || !node.material) return;
        if ('metalness' in node.material) node.material.metalness = 0;
        if ('roughness' in node.material) node.material.roughness = 0.85;
      });
      const clips = new Map();
      for (const clip of gltf.animations || []) clips.set(normalizeClip(clip.name, meta.clipPrefix), clip);
      registry[type] = { scene: gltf.scene, clips, meta };
    } catch { /* falha de um modelo -> fallback procedural só para esse tipo */ }
  }));
  return registry;
}

export function hasEnemyModel(type) {
  return Boolean(registry[type]);
}

/**
 * Clone com rebind de esqueleto (equivalente ao SkeletonUtils.clone do three):
 * Object3D.clone compartilha o Skeleton, então todas as instâncias animariam
 * em uníssono e deformariam umas às outras.
 */
function cloneSkinned(source) {
  const clone = source.clone(true);
  const sourceOf = new Map();
  const cloneOf = new Map();
  const stack = [[source, clone]];
  while (stack.length) {
    const [s, c] = stack.pop();
    sourceOf.set(c, s);
    cloneOf.set(s, c);
    for (let i = 0; i < s.children.length; i += 1) stack.push([s.children[i], c.children[i]]);
  }
  clone.traverse((node) => {
    if (!node.isSkinnedMesh) return;
    const original = sourceOf.get(node);
    const bones = original.skeleton.bones.map((bone) => cloneOf.get(bone) || bone);
    const inverses = original.skeleton.boneInverses.map((matrix) => matrix.clone());
    node.skeleton = new THREE.Skeleton(bones, inverses);
    node.bind(node.skeleton, node.bindMatrix);
  });
  return clone;
}

/** Escala o objeto para `targetHeight` metros com os pés em y=0 local. */
function fitHeight(object, targetHeight) {
  object.updateMatrixWorld(true);
  const box = new THREE.Box3();
  const temp = new THREE.Box3();
  object.traverse((node) => {
    if (node.isSkinnedMesh) {
      node.computeBoundingBox();
      box.union(temp.copy(node.boundingBox).applyMatrix4(node.matrixWorld));
    } else if (node.isMesh) {
      if (!node.geometry.boundingBox) node.geometry.computeBoundingBox();
      box.union(temp.copy(node.geometry.boundingBox).applyMatrix4(node.matrixWorld));
    }
  });
  const height = (box.max.y - box.min.y) || 1;
  const scale = targetHeight / height;
  object.scale.setScalar(scale);
  object.position.y = -box.min.y * scale;
  return { scale, depth: (box.max.z - box.min.z) * scale, width: (box.max.x - box.min.x) * scale };
}

/**
 * Instancia um inimigo animado.
 * @param {string} type chave do manifesto (raptor, trex, phantom, monster, ...)
 * @param {number} targetHeight altura desejada em metros
 * @returns {null | { root, mixer, play, clipNames, hitMeshes, tint }}
 */
export function spawnEnemyModel(type, targetHeight = 1.85) {
  const entry = registry[type];
  if (!entry) return null;

  const root = new THREE.Group();
  const model = cloneSkinned(entry.scene);
  const fitted = fitHeight(model, targetHeight);
  root.add(model);
  model.traverse((node) => {
    if (!node.isMesh) return;
    node.castShadow = true;
    node.receiveShadow = true;
    // A malha animada não recebe raycast: quem responde aos tiros são as
    // caixas de zona abaixo, senão não dá para distinguir cabeça de perna.
    node.userData.noRay = true;
  });

  const mixer = new THREE.AnimationMixer(model);
  const actions = new Map();
  for (const [name, clip] of entry.clips) actions.set(name, mixer.clipAction(clip));

  let current = null;
  /**
   * Toca o primeiro clipe disponível entre os candidatos, com crossfade.
   * `once` trava no último quadro (usado por morte e ataque).
   */
  function play(candidates, { fade = 0.22, once = false, speed = 1 } = {}) {
    const name = candidates.find((candidate) => actions.has(candidate));
    if (!name) return null;
    const next = actions.get(name);
    if (next === current && !once) return name;
    next.reset();
    next.timeScale = speed;
    next.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat, once ? 1 : Infinity);
    next.clampWhenFinished = once;
    next.fadeIn(fade).play();
    // fadeOut manual em vez de crossFadeTo: o crossFade vira no-op silencioso
    // quando a ação anterior não está ativa (armadilha conhecida do three).
    if (current && current !== next) current.fadeOut(fade);
    current = next;
    return name;
  }

  // Geometria e materiais do clone são COMPARTILHADOS com o modelo mestre do
  // registro (Object3D.clone não os duplica). Descartá-los quebraria todos os
  // inimigos das missões seguintes, então só liberamos o que é desta instância:
  // materiais que nós clonamos (tinta/fantasma) e as caixas de dano.
  const owned = [];
  return {
    root,
    model,
    mixer,
    play,
    fitted,
    owned,
    clipNames: [...entry.clips.keys()],
    meta: entry.meta,
    dispose() {
      mixer.stopAllAction();
      mixer.uncacheRoot(model);
      for (const resource of owned) resource.dispose?.();
      owned.length = 0;
    },
  };
}

/**
 * Caixas de dano invisíveis: cabeça, torso e pernas, dimensionadas ao modelo.
 * Passe `owned` (rig.owned) para que geometria e material sejam liberados junto
 * com a instância — eles são exclusivos dela, ao contrário da malha do GLB.
 */
export function buildHitBoxes(root, height, radius = 0.42, owned = null) {
  const invisible = new THREE.MeshBasicMaterial({ visible: false });
  owned?.push(invisible);
  const zones = [
    { zone: 'head', size: [radius * 0.95, height * 0.16, radius * 0.95], y: height * 0.92 },
    { zone: 'torso', size: [radius * 1.5, height * 0.42, radius * 1.35], y: height * 0.62 },
    { zone: 'limb', size: [radius * 1.6, height * 0.42, radius * 1.2], y: height * 0.21 },
  ];
  return zones.map(({ zone, size, y }) => {
    const geometry = new THREE.BoxGeometry(...size);
    owned?.push(geometry);
    const mesh = new THREE.Mesh(geometry, invisible);
    mesh.position.y = y;
    mesh.userData.zone = zone;
    root.add(mesh);
    return mesh;
  });
}
