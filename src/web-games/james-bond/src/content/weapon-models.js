import * as THREE from '../../../vendor/three.module.min.js';

// Shared gunsmith materials — blued steel, parkerized metal, polymer, wood, glove leather.
const steel = new THREE.MeshStandardMaterial({ color: 0x2e3234, roughness: 0.38, metalness: 0.85 });
const darkMetal = new THREE.MeshStandardMaterial({ color: 0x1d2122, roughness: 0.48, metalness: 0.78 });
const polymer = new THREE.MeshStandardMaterial({ color: 0x23262a, roughness: 0.72, metalness: 0.15 });
const wood = new THREE.MeshStandardMaterial({ color: 0x4c3620, roughness: 0.68, metalness: 0.05 });
const glove = new THREE.MeshStandardMaterial({ color: 0x2a2723, roughness: 0.92 });
const sleeveMat = new THREE.MeshStandardMaterial({ color: 0x1d2422, roughness: 0.9 });

export function buildWeaponModel(id) {
  const root = new THREE.Group();
  if (id === 'p7' || id === 'p7s') buildPistol(root, id === 'p7s');
  else if (id === 'smg') buildSmg(root);
  else if (id === 'rifle') buildRifle(root);
  else buildShotgun(root);
  addHands(root, id);
  root.traverse((part) => { if (part.isMesh) part.userData.viewModel = true; });
  return root;
}

// USP-style service pistol
function buildPistol(root, suppressed) {
  box(root, [0, 0.045, -0.3], [0.088, 0.095, 0.52], steel); // slide
  box(root, [0, -0.025, -0.26], [0.08, 0.06, 0.44], darkMetal); // frame
  cyl(root, [0, 0.045, -0.58], 0.024, 0.1, darkMetal); // barrel
  box(root, [0, -0.17, 0.0], [0.076, 0.25, 0.125], polymer, [0.22, 0, 0]); // grip
  box(root, [0, -0.095, -0.13], [0.018, 0.02, 0.13], darkMetal); // trigger guard bottom
  box(root, [0, -0.07, -0.2], [0.018, 0.07, 0.02], darkMetal, [-0.3, 0, 0]); // guard front
  box(root, [0, -0.06, -0.13], [0.02, 0.06, 0.025], darkMetal); // trigger
  box(root, [0, 0.108, -0.5], [0.014, 0.028, 0.02], darkMetal); // front sight
  box(root, [0, 0.108, -0.07], [0.05, 0.026, 0.024], darkMetal); // rear sight
  box(root, [0, 0.045, -0.028], [0.06, 0.05, 0.03], steel); // hammer area
  box(root, [0, -0.005, -0.47], [0.092, 0.03, 0.06], polymer); // dust cover rail
  if (suppressed) cyl(root, [0, 0.045, -0.82], 0.046, 0.56, polymer); // suppressor
}

// MP5-style SMG
function buildSmg(root) {
  box(root, [0, 0, -0.08], [0.1, 0.14, 0.56], darkMetal); // receiver
  cyl(root, [0, 0.01, -0.6], 0.042, 0.44, polymer); // barrel shroud
  cyl(root, [0, 0.01, -0.94], 0.02, 0.24, steel); // barrel
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.038, 0.008, 8, 18), steel);
  ring.position.set(0, 0.055, -0.88);
  root.add(ring); // front sight ring
  box(root, [0, 0.045, -0.88], [0.012, 0.05, 0.012], steel); // front post
  cyl(root, [0, 0.085, 0.1], 0.028, 0.03, darkMetal, [0, 0, Math.PI / 2]); // rear drum
  box(root, [0, -0.24, -0.14], [0.06, 0.32, 0.12], steel, [0.32, 0, 0]); // curved mag
  box(root, [0, -0.15, 0.08], [0.06, 0.19, 0.1], polymer, [0.28, 0, 0]); // pistol grip
  box(root, [0, -0.02, 0.34], [0.05, 0.085, 0.32], polymer); // stock
  box(root, [0, -0.06, -0.02], [0.07, 0.05, 0.1], polymer); // trigger housing
  cyl(root, [0, 0.055, -0.42], 0.014, 0.12, steel); // cocking tube
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

// Pump-action shotgun
function buildShotgun(root) {
  box(root, [0, 0, -0.02], [0.09, 0.12, 0.36], darkMetal); // receiver
  cyl(root, [0, 0.045, -0.72], 0.025, 1.04, steel); // barrel
  cyl(root, [0, -0.025, -0.58], 0.028, 0.62, steel); // magazine tube
  cyl(root, [0, -0.025, -0.66], 0.042, 0.24, wood); // pump
  box(root, [0, -0.055, 0.36], [0.08, 0.13, 0.42], wood, [-0.08, 0, 0]); // stock
  box(root, [0, 0.085, -1.22], [0.014, 0.02, 0.014], steel); // bead sight
  box(root, [0, -0.075, -0.02], [0.06, 0.05, 0.1], darkMetal); // trigger housing
  box(root, [0, 0.045, -0.2], [0.05, 0.02, 0.06], steel); // barrel clamp
}

function addHands(root, id) {
  const longGun = id === 'smg' || id === 'rifle' || id === 'shotgun';
  // right hand on the pistol grip
  const right = new THREE.Mesh(new THREE.CapsuleGeometry(0.055, 0.1, 4, 10), glove);
  right.position.set(0.01, -0.14, id === 'p7' || id === 'p7s' ? -0.02 : 0.1);
  right.rotation.set(0.5, 0, -0.25);
  const rightSleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.09, 0.4, 10), sleeveMat);
  rightSleeve.position.set(0.1, -0.3, 0.28);
  rightSleeve.rotation.set(Math.PI / 2.5, 0, -0.35);
  root.add(right, rightSleeve);
  if (!longGun) return;
  // left hand under the handguard / pump
  const left = new THREE.Mesh(new THREE.CapsuleGeometry(0.055, 0.1, 4, 10), glove);
  left.position.set(-0.01, -0.08, id === 'shotgun' ? -0.66 : -0.5);
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

function cyl(root, position, radius, height, material, rotation = [Math.PI / 2, 0, 0]) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, height, 14), material);
  mesh.position.set(...position);
  mesh.rotation.set(...rotation);
  root.add(mesh);
  return mesh;
}
