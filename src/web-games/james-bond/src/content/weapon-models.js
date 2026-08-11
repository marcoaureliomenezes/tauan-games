import * as THREE from '../../../vendor/three.module.min.js';

// Shared gunsmith materials — blued steel, parkerized metal, polymer, wood, glove leather.
// Kept extra dark: the rig is lit by full scene lighting (hemisphere included),
// so real-world gunmetal values would wash out to plastic grey.
const steel = new THREE.MeshStandardMaterial({ color: 0x1b1e20, roughness: 0.42, metalness: 0.82 });
const darkMetal = new THREE.MeshStandardMaterial({ color: 0x121416, roughness: 0.5, metalness: 0.75 });
const polymer = new THREE.MeshStandardMaterial({ color: 0x15181b, roughness: 0.74, metalness: 0.12 });
const wood = new THREE.MeshStandardMaterial({ color: 0x332416, roughness: 0.7, metalness: 0.05 });
const glove = new THREE.MeshStandardMaterial({ color: 0x1c1a17, roughness: 0.92 });
const sleeveMat = new THREE.MeshStandardMaterial({ color: 0x161c1a, roughness: 0.9 });

export function buildWeaponModel(id) {
  const root = new THREE.Group();
  if (id === 'ak47') buildRifle(root);
  else if (id === 'knife') buildKnife(root);
  else if (id === 'rpg') buildLauncher(root);
  else if (id === 'grenade') buildGrenade(root);
  else buildDeagle(root);
  addHands(root, id);
  root.traverse((part) => { if (part.isMesh) part.userData.viewModel = true; });
  return root;
}

// Faca de combate tática, de perfil — lâmina clip-point de LÂMINA EM PÉ.
//
// A versão anterior deitava a lâmina (0.028 de largura × 0.012 de altura):
// vista em primeira pessoa aquilo era uma régua, não uma faca. Uma faca lê-se
// pelo PERFIL — folha alta e fina, fio inferior, ponta em clipe, guarda que
// avança e cabo com anéis. Aqui a folha tem 0.075 m de altura por 0.009 m de
// espessura, e a arma é segurada inclinada, à moda de quem vai golpear.
function buildKnife(root) {
  // Aço escovado, não espelho: a 40 cm da câmera um metalness de 0.98 devolvia
  // uma mancha branca em vez de uma lâmina. O brilho fica só no FIO.
  const blade = new THREE.MeshStandardMaterial({ color: 0x525a60, roughness: 0.42, metalness: 0.55 });
  const edge = new THREE.MeshStandardMaterial({ color: 0xc9d1d5, roughness: 0.12, metalness: 0.9 });
  const grip = new THREE.MeshStandardMaterial({ color: 0x191b1c, roughness: 0.95, metalness: 0.05 });

  const knife = new THREE.Group();
  // Folha principal: alta em Y, fina em X, longa em -Z.
  box(knife, [0, 0.035, -0.28], [0.009, 0.075, 0.36], blade);
  // Fio: bisel claro correndo pela aresta inferior da folha.
  box(knife, [0, -0.002, -0.28], [0.0055, 0.016, 0.36], edge);
  // Ponta em clipe: a folha afina e o dorso desce até a ponta.
  box(knife, [0, 0.028, -0.5], [0.008, 0.05, 0.1], blade, [0, 0, 0]);
  box(knife, [0, 0.048, -0.5], [0.0075, 0.03, 0.1], blade, [-0.34, 0, 0]);
  box(knife, [0, 0.004, -0.5], [0.005, 0.014, 0.1], edge, [0.12, 0, 0]);
  // Serrilha no dorso, junto da guarda — três dentes.
  for (let i = 0; i < 3; i += 1) box(knife, [0, 0.076, -0.14 - i * 0.045], [0.0092, 0.016, 0.022], blade, [0, 0, 0]);
  // Ricasso e guarda: a guarda AVANÇA sob a mão, é o que separa cabo de folha.
  box(knife, [0, 0.028, -0.09], [0.014, 0.058, 0.06], darkMetal);
  box(knife, [0, 0.0, -0.075], [0.016, 0.05, 0.022], darkMetal);      // quilhão inferior
  box(knife, [0, 0.075, -0.075], [0.015, 0.028, 0.02], darkMetal);    // quilhão superior
  // Cabo emborrachado com anéis para os dedos.
  box(knife, [0, 0.022, 0.03], [0.026, 0.05, 0.19], grip);
  for (let i = 0; i < 4; i += 1) box(knife, [0, 0.022, -0.03 + i * 0.045], [0.03, 0.056, 0.012], grip);
  // Pomo com furo de cordão.
  box(knife, [0, 0.022, 0.135], [0.03, 0.042, 0.04], darkMetal);

  // Punho de combate mostrando o PERFIL: com pouca guinada via-se só a
  // espessura da folha (9 mm) e a faca lia como um cano. Girada para fora, a
  // silhueta que aparece é a da folha inteira, com o fio virado para dentro.
  knife.rotation.set(0.1, 0.62, -0.46);
  knife.position.set(0.04, -0.03, -0.04);
  root.add(knife);
  root.userData.knifeBlade = knife;
}

// RPG-7: tubo com a cintura marcada, ogiva cônica com saia, escudo térmico de
// madeira, punho de pistola, gatilho e luneta lateral em cima.
//
// O modelo antigo era um cano liso com uma "ogiva" solta em cima — lia como
// um cano de PVC. O que faz um RPG ser reconhecível é a silhueta: cone à
// frente, cintura estreita no meio, sino de exaustão atrás e a luneta saindo
// pela esquerda.
function buildLauncher(root) {
  const tube = new THREE.MeshStandardMaterial({ color: 0x2f342c, roughness: 0.66, metalness: 0.5 });
  const warhead = new THREE.MeshStandardMaterial({ color: 0x7d3226, roughness: 0.5, metalness: 0.4 });
  const optic = new THREE.MeshStandardMaterial({ color: 0x0d0f10, roughness: 0.35, metalness: 0.6 });
  const lens = new THREE.MeshBasicMaterial({ color: 0x6fd7c0, toneMapped: false });

  // --- Tubo, da boca ao sino traseiro --------------------------------------
  cyl(root, [0, 0.02, -0.62], 0.062, 0.5, tube);                      // seção dianteira
  cyl(root, [0, 0.02, -0.2], 0.05, 0.36, tube);                       // cintura estreita
  cyl(root, [0, 0.02, 0.06], 0.07, 0.2, tube);                        // seção traseira
  cone(root, [0, 0.02, 0.22], 0.13, 0.075, 0.16, darkMetal);          // sino de exaustão (abre para trás)
  cyl(root, [0, 0.02, -0.88], 0.068, 0.06, darkMetal);                // aro da boca

  // --- Granada carregada: cone + corpo + saia estabilizadora ---------------
  cone(root, [0, 0.02, -1.28], 0.001, 0.072, 0.24, warhead, true);    // ponta cônica
  cyl(root, [0, 0.02, -1.09], 0.072, 0.16, warhead);                  // corpo da carga
  cone(root, [0, 0.02, -0.96], 0.05, 0.078, 0.12, darkMetal, true);   // saia estabilizadora (abre para trás)
  cyl(root, [0, 0.02, -0.93], 0.05, 0.08, tube);                      // haste até o tubo

  // --- Escudo térmico de madeira, com as duas cintas metálicas -------------
  box(root, [0, 0.02, -0.46], [0.135, 0.135, 0.3], wood, [0, 0, Math.PI / 4]);
  cyl(root, [0, 0.02, -0.6], 0.085, 0.028, darkMetal);
  cyl(root, [0, 0.02, -0.32], 0.085, 0.028, darkMetal);

  // --- Punhos, gatilho e ombreira -----------------------------------------
  box(root, [0, -0.15, -0.04], [0.05, 0.2, 0.09], polymer, [0.22, 0, 0]);   // punho de pistola
  box(root, [0, -0.06, -0.06], [0.035, 0.06, 0.11], darkMetal);             // caixa do gatilho
  box(root, [0, -0.085, -0.09], [0.014, 0.05, 0.02], steel, [-0.2, 0, 0]);  // gatilho
  box(root, [0, -0.13, -0.42], [0.045, 0.16, 0.08], wood, [0.2, 0, 0]);     // punho dianteiro
  box(root, [0, -0.02, 0.16], [0.09, 0.05, 0.12], polymer, [-0.25, 0, 0]);  // apoio de ombro

  // --- Luneta PGO-7 à esquerda, como no original ---------------------------
  box(root, [-0.085, 0.1, -0.26], [0.05, 0.09, 0.2], optic);
  cyl(root, [-0.085, 0.1, -0.37], 0.032, 0.06, optic);
  const glass = new THREE.Mesh(new THREE.CircleGeometry(0.028, 14), lens);
  glass.position.set(-0.085, 0.1, -0.401);
  glass.rotation.y = Math.PI;
  root.add(glass);
  box(root, [-0.085, 0.15, -0.2], [0.03, 0.03, 0.06], optic);        // torre de ajuste
  box(root, [-0.05, 0.06, -0.26], [0.04, 0.03, 0.05], darkMetal);    // suporte da luneta
}

// Granada de mão pronta para arremesso.
function buildGrenade(root) {
  const shell = new THREE.MeshStandardMaterial({ color: 0x334036, roughness: 0.62, metalness: 0.5 });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.085, 12, 10), shell);
  mesh.position.set(0, -0.02, -0.3);
  root.add(mesh);
  cyl(root, [0, 0.07, -0.3], 0.028, 0.06, darkMetal, [0, 0, 0]); // espoleta
  box(root, [0.03, 0.07, -0.3], [0.012, 0.05, 0.09], steel); // alavanca
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.028, 0.006, 6, 12), steel);
  ring.position.set(-0.04, 0.08, -0.3);
  ring.rotation.y = Math.PI / 2;
  root.add(ring); // pino
}

// Desert Eagle — canhão de mão pesado estilo CS 1.6
function buildDeagle(root) {
  box(root, [0, 0.05, -0.32], [0.1, 0.11, 0.58], steel); // slide pesado
  box(root, [0, 0.115, -0.34], [0.05, 0.035, 0.4], darkMetal); // rib do slide
  box(root, [0, -0.02, -0.26], [0.085, 0.06, 0.42], darkMetal); // frame
  cyl(root, [0, 0.05, -0.66], 0.028, 0.16, darkMetal); // cano
  box(root, [0, -0.18, 0.0], [0.08, 0.27, 0.14], polymer, [0.24, 0, 0]); // empunhadura
  box(root, [0, -0.1, -0.13], [0.018, 0.02, 0.13], darkMetal); // guarda-mato
  box(root, [0, -0.065, -0.13], [0.02, 0.06, 0.025], darkMetal); // gatilho
  box(root, [0, 0.125, -0.58], [0.016, 0.03, 0.02], darkMetal); // mira frontal
  box(root, [0, 0.128, -0.08], [0.055, 0.028, 0.026], darkMetal); // mira traseira
  box(root, [0, -0.3, 0.02], [0.07, 0.05, 0.12], steel, [0.24, 0, 0]); // base do pente
}

// AK/AR-style assault rifle
function buildRifle(root) {
  box(root, [0, 0, -0.05], [0.09, 0.13, 0.52], darkMetal); // receiver
  box(root, [0, 0.02, -0.52], [0.08, 0.095, 0.38], wood); // handguard
  cyl(root, [0, 0.03, -1.05], 0.018, 0.6, steel); // barrel
  cyl(root, [0, 0.03, -1.36], 0.03, 0.12, darkMetal); // muzzle brake
  box(root, [0, 0.1, -1.26], [0.018, 0.09, 0.02], steel); // front sight post
  box(root, [0, 0.065, -1.26], [0.05, 0.02, 0.04], steel); // sight base
  box(root, [0, 0.095, 0.0], [0.05, 0.055, 0.22], darkMetal); // rear sight block
  box(root, [0, -0.26, -0.1], [0.06, 0.34, 0.14], steel, [0.5, 0, 0]); // curved mag
  box(root, [0, -0.14, 0.13], [0.06, 0.18, 0.1], polymer, [0.3, 0, 0]); // pistol grip
  box(root, [0, -0.03, 0.38], [0.07, 0.115, 0.32], wood, [-0.06, 0, 0]); // stock
  box(root, [0, -0.06, 0.0], [0.07, 0.05, 0.1], darkMetal); // trigger housing
}

function addHands(root, id) {
  // A faca é empunhada em punho invertido, com a mão FECHADA sobre o cabo e o
  // polegar apoiado no pomo — mão genérica de arma de fogo não serve aqui.
  if (id === 'knife') {
    const fist = new THREE.Mesh(new THREE.CapsuleGeometry(0.048, 0.062, 4, 10), glove);
    fist.position.set(0.05, -0.03, 0.05);
    fist.rotation.set(1.34, 0.5, -0.3);
    const thumb = new THREE.Mesh(new THREE.CapsuleGeometry(0.018, 0.042, 4, 8), glove);
    thumb.position.set(0.028, 0.015, 0.0);
    thumb.rotation.set(1.5, 0.4, -0.35);
    const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.062, 0.078, 0.32, 10), sleeveMat);
    sleeve.position.set(0.12, -0.2, 0.26);
    sleeve.rotation.set(Math.PI / 2.6, 0, -0.35);
    root.add(fist, thumb, sleeve);
    return;
  }
  const longGun = id === 'ak47' || id === 'rpg';
  // right hand on the pistol grip
  const right = new THREE.Mesh(new THREE.CapsuleGeometry(0.055, 0.1, 4, 10), glove);
  right.position.set(0.01, -0.14, longGun ? 0.1 : -0.02);
  right.rotation.set(0.5, 0, -0.25);
  const rightSleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.09, 0.4, 10), sleeveMat);
  rightSleeve.position.set(0.1, -0.3, 0.28);
  rightSleeve.rotation.set(Math.PI / 2.5, 0, -0.35);
  root.add(right, rightSleeve);
  if (!longGun) return;
  // left hand under the handguard
  const left = new THREE.Mesh(new THREE.CapsuleGeometry(0.055, 0.1, 4, 10), glove);
  left.position.set(-0.01, -0.08, -0.5);
  left.rotation.set(Math.PI / 2.2, 0, 0.2);
  const leftSleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.085, 0.42, 10), sleeveMat);
  leftSleeve.position.set(-0.14, -0.32, -0.2);
  leftSleeve.rotation.set(Math.PI / 2.1, 0, 0.4);
  root.add(left, leftSleeve);
}

function box(root, position, size, material, rotation = [0, 0, 0]) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
  mesh.position.set(...position);
  mesh.rotation.set(...rotation);
  root.add(mesh);
  return mesh;
}

/** Tronco de cone deitado ao longo de -Z (ponta para a frente com `flip`). */
function cone(root, position, radiusTop, radiusBottom, height, material, flip = false) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radiusTop, radiusBottom, height, 16), material);
  mesh.position.set(...position);
  mesh.rotation.set(flip ? -Math.PI / 2 : Math.PI / 2, 0, 0);
  root.add(mesh);
  return mesh;
}

function cyl(root, position, radius, height, material, rotation = [Math.PI / 2, 0, 0]) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, height, 14), material);
  mesh.position.set(...position);
  mesh.rotation.set(...rotation);
  root.add(mesh);
  return mesh;
}
