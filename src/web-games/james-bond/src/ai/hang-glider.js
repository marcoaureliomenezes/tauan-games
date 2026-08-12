// Web game package: james-bond.
// Asa-delta dos REFORÇOS (F3): o inimigo não "aparece" mais numa célula
// escondida — ele ENTRA no mapa voando, pendurado numa asa-delta, e pousa.
//
// O visual é procedural e barato: asa triangular em duas faces (dedo diedro),
// tubos de borda/quilha e trapézio de controle. Pool FIXO criado uma vez por
// deploy (mesma lei de fx.js: nada de mesh/material novo no meio da partida);
// se o pool estiver cheio o reforço nasce no chão como antes — o pool nunca
// cresce.
import * as THREE from '../../../vendor/three.module.min.js';

/** Altura do ponto de entrada acima do ponto de pouso. */
export const GLIDER_ALTITUDE = 17;
/** Distância horizontal entre o ponto de entrada e o pouso (vem de fora do centro). */
export const GLIDER_INSET = 24;
/** Segundos de voo do pouso. A cadência padrão (5/min = 1 a cada 12 s) nunca
 * junta mais de 2 asas no ar; o pool de 4 tem folga dupla. */
export const GLIDER_DURATION = 5;
export const GLIDER_POOL_SIZE = 4;

// Cores vivas de vela — cada asa do pool tem a sua, para duas chegadas
// simultâneas não parecerem a mesma asa clonada.
const SAIL_COLORS = [0xe52521, 0xfbd000, 0x049cd8, 0x43b047];
const FRAME_COLOR = 0x2b2b30;

/** Cilindro entre dois pontos — os tubos da armação. */
function tube(a, b, radius, material) {
  const direction = b.clone().sub(a);
  const length = direction.length();
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, length, 6), material);
  mesh.position.copy(a).addScaledVector(direction, 0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
  return mesh;
}

/**
 * Monta uma asa-delta. O grupo olha para +Z (nariz à frente); o piloto fica
 * pendurado ~1,5 m abaixo da asa — quem posiciona o conjunto é o chamador
 * (guards.js cola o grupo acima da cabeça do inimigo a cada frame).
 */
export function buildHangGlider(sailColor = 0xe52521) {
  const group = new THREE.Group();
  const nose = new THREE.Vector3(0, 0, 1.15);
  const leftTip = new THREE.Vector3(-1.7, 0.14, -0.9);
  const rightTip = new THREE.Vector3(1.7, 0.14, -0.9);
  const tail = new THREE.Vector3(0, 0.03, -0.72);

  // Vela: dois triângulos com leve diedro (as pontas sobem 0,14 m).
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([
    nose.x, nose.y, nose.z, leftTip.x, leftTip.y, leftTip.z, tail.x, tail.y, tail.z,
    nose.x, nose.y, nose.z, tail.x, tail.y, tail.z, rightTip.x, rightTip.y, rightTip.z,
  ], 3));
  geometry.computeVertexNormals();
  const sail = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({
    color: sailColor, side: THREE.DoubleSide, roughness: 0.85, metalness: 0,
  }));

  const frameMaterial = new THREE.MeshStandardMaterial({ color: FRAME_COLOR, roughness: 0.6, metalness: 0.35 });
  const center = new THREE.Vector3(0, 0.04, 0.05);
  const barL = new THREE.Vector3(-0.34, -1.05, -0.18);
  const barR = new THREE.Vector3(0.34, -1.05, -0.18);
  const harnessTop = new THREE.Vector3(0, 0.02, 0.3);
  const harnessBottom = new THREE.Vector3(0, -1.5, 0.05);
  const frame = new THREE.Group();
  frame.add(tube(nose, tail, 0.028, frameMaterial));        // quilha
  frame.add(tube(nose, leftTip, 0.024, frameMaterial));     // borda de ataque esquerda
  frame.add(tube(nose, rightTip, 0.024, frameMaterial));    // borda de ataque direita
  frame.add(tube(center, barL, 0.02, frameMaterial));       // trapézio esquerdo
  frame.add(tube(center, barR, 0.02, frameMaterial));       // trapézio direito
  frame.add(tube(barL, barR, 0.02, frameMaterial));         // barra de controle
  frame.add(tube(harnessTop, harnessBottom, 0.015, frameMaterial)); // tirante do arnês

  group.add(sail, frame);
  // Nunca entra em raycast de tiro nem em auditoria de sólidos — é cenário de
  // voo, não alvo nem obstáculo (o ALVO é o inimigo pendurado embaixo).
  group.traverse((part) => { part.userData.fx = true; part.userData.noRay = true; });
  return group;
}

/**
 * Pool fixo de asas-delta, criado UMA vez por deploy. `acquire` devolve null
 * quando todas estão voando — o chamador decide o fallback (nascer no chão).
 */
export function createGliderPool(scene, size = GLIDER_POOL_SIZE) {
  const gliders = [];
  for (let i = 0; i < size; i += 1) {
    const group = buildHangGlider(SAIL_COLORS[i % SAIL_COLORS.length]);
    group.visible = false;
    scene.add(group);
    gliders.push({ group, inUse: false });
  }
  return {
    acquire() {
      const glider = gliders.find((entry) => !entry.inUse);
      if (!glider) return null;
      glider.inUse = true;
      glider.group.visible = true;
      return glider;
    },
    release(glider) {
      if (!glider) return;
      glider.inUse = false;
      glider.group.visible = false;
    },
    get inFlight() { return gliders.filter((entry) => entry.inUse).length; },
    dispose() {
      gliders.forEach((glider) => {
        scene.remove(glider.group);
        glider.group.traverse((part) => { part.geometry?.dispose(); part.material?.dispose(); });
      });
      gliders.length = 0;
    },
  };
}
