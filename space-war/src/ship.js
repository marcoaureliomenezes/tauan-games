// ship.js — Nave do jogador: malha, voo 6-DOF newtoniano, throttle, decolagem
// da Terra (com horizonte que se curva), atmosfera e câmera de perseguição.

import * as THREE from '../../vendor/three.module.min.js';
import { scene, camera } from './scene.js';
import { SHIP, ATMO } from './config.js';
import { game } from './state.js';
import { computeGravity, surfaceContact } from './gravity.js';
import { input, consumeMouse } from './input.js';
import { currentTarget } from './nav.js';

let mesh, engineGlow;
const accelG = new THREE.Vector3();
const tmp = new THREE.Vector3();
const fwd = new THREE.Vector3();
const desiredV = new THREE.Vector3();
const dvV = new THREE.Vector3();
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _up = new THREE.Vector3(0, 1, 0);
const camOffset = new THREE.Vector3(0, 6, 26);
const camTarget = new THREE.Vector3();
const lastEarthPos = new THREE.Vector3();
let earthBody = null;
let launchAngle = 0;

export function buildShip() {
  mesh = new THREE.Group();
  // Fuselagem
  const body = new THREE.Mesh(
    new THREE.ConeGeometry(0.5, 2.4, 12),
    new THREE.MeshStandardMaterial({ color: 0xccd6e0, metalness: 0.7, roughness: 0.35 }),
  );
  body.rotation.x = -Math.PI / 2;
  mesh.add(body);
  // Cabine
  const cabin = new THREE.Mesh(
    new THREE.SphereGeometry(0.32, 12, 12, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: 0x44ddff, metalness: 0.4, roughness: 0.15, emissive: 0x113344 }),
  );
  cabin.rotation.x = -Math.PI / 2; cabin.position.set(0, 0.18, -0.2);
  mesh.add(cabin);
  // Asas
  const wingMat = new THREE.MeshStandardMaterial({ color: 0x9aa6b2, metalness: 0.6, roughness: 0.4, side: THREE.DoubleSide });
  for (const s of [-1, 1]) {
    const wing = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.06, 0.9), wingMat);
    wing.position.set(s * 0.9, -0.05, 0.4); wing.rotation.z = s * 0.18;
    mesh.add(wing);
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.5, 0.5), wingMat);
    fin.position.set(s * 0.5, 0.25, 0.7);
    mesh.add(fin);
  }
  // Motor / glow
  const eng = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.4, 0.4, 12),
    new THREE.MeshStandardMaterial({ color: 0x333a44, metalness: 0.8, roughness: 0.4 }));
  eng.rotation.x = Math.PI / 2; eng.position.set(0, 0, 1.2);
  mesh.add(eng);
  engineGlow = makeGlow();
  engineGlow.position.set(0, 0, 1.6);
  mesh.add(engineGlow);

  mesh.scale.setScalar(SHIP.size);
  scene.add(mesh);

  // Estado inicial — pousada na Terra.
  game.ship.pos = new THREE.Vector3();
  game.ship.vel = new THREE.Vector3();
  game.ship.quat = new THREE.Quaternion();
  game.ship.landed = true;
  game.ship.throttle = 0;
  earthBody = game.bodies.find((b) => b.def.key === 'earth');
  lastEarthPos.copy(earthBody.worldPos);
  return mesh;
}

function makeGlow() {
  const cv = document.createElement('canvas'); cv.width = 64; cv.height = 64;
  const ctx = cv.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 2, 32, 32, 32);
  g.addColorStop(0, 'rgba(180,230,255,1)'); g.addColorStop(0.4, 'rgba(90,180,255,0.6)'); g.addColorStop(1, 'rgba(40,120,255,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(cv);
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
  sp.scale.setScalar(1.6);
  return sp;
}

export function updateShip(dt) {
  const s = game.ship;

  // --- Velocidade da Terra (diferença finita) p/ acompanhar a órbita ao decolar ---
  tmp.copy(earthBody.worldPos).sub(lastEarthPos);
  const earthVel = tmp.clone().multiplyScalar(dt > 0 ? 1 / dt : 0);
  lastEarthPos.copy(earthBody.worldPos);

  // --- Throttle ---
  if (input.throttleUp) s.throttle = Math.min(1, s.throttle + dt * 1.2);
  if (input.throttleDown) s.throttle = Math.max(0, s.throttle - dt * 1.1);
  s.boost = input.boost;

  if (s.landed) {
    updateLanded(s, dt, earthVel);
  } else {
    updateFlight(s, dt);
  }

  // --- Aplica transform ---
  mesh.position.copy(s.pos);
  mesh.quaternion.copy(s.quat);
  // glow do motor proporcional ao throttle (sutil — não pode cobrir a nave)
  const thr = s.throttle * (s.boost ? 1.5 : 1);
  engineGlow.scale.setScalar(0.5 + thr * 0.7);
  engineGlow.material.opacity = Math.min(0.85, 0.3 + thr * 0.4);

  updateCamera(s, dt);
}

function updateLanded(s, dt, earthVel) {
  // Presa à superfície da Terra, girando com ela; nariz radialmente para fora.
  launchAngle += ((Math.PI * 2) / earthBody.def.spin) * dt;
  const up = new THREE.Vector3(Math.cos(launchAngle), 0.35, Math.sin(launchAngle)).normalize();
  s.pos.copy(earthBody.worldPos).addScaledVector(up, earthBody.def.radius + SHIP.startAltitude);
  // orientar nariz (-Z) para "up"
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, -1), up);
  s.quat.copy(q);
  s.vel.copy(earthVel);
  s.altitude = SHIP.startAltitude;
  s.dominant = earthBody;
  s.gravMag = 0;

  // Decolar quando throttle passa do limiar.
  if (s.throttle > 0.45) {
    s.landed = false;
    s.spawnGrace = 6;                                 // 6s de proteção pós-decolagem
    s.vel.copy(earthVel).addScaledVector(up, 300);    // empurrão inicial para sair do solo
  }
}

function updateFlight(s, dt) {
  if (s.spawnGrace > 0) s.spawnGrace -= dt;       // proteção inicial expira em voo
  // --- Rotação (teclado + mouse) ---
  const { dx, dy } = consumeMouse();
  let pitch = 0, yaw = 0, roll = 0;
  if (input.pitchUp) pitch += SHIP.pitchRate * dt;
  if (input.pitchDown) pitch -= SHIP.pitchRate * dt;
  if (input.yawLeft) yaw += SHIP.yawRate * dt;
  if (input.yawRight) yaw -= SHIP.yawRate * dt;
  if (input.rollLeft) roll += SHIP.rollRate * dt;
  if (input.rollRight) roll -= SHIP.rollRate * dt;
  pitch += -dy * 0.0022;
  yaw += -dx * 0.0022;
  const manual = pitch || yaw || roll;
  if (manual) s.aligning = false;       // controlar manualmente cancela o piloto automático

  if (s.aligning) {
    // --- Piloto automático de mira: gira o nariz para o alvo de navegação ---
    const t = currentTarget();
    if (t) {
      _m.lookAt(s.pos, t.pos, _up);
      _q.setFromRotationMatrix(_m);
      s.quat.slerp(_q, Math.min(1, SHIP.alignRate * dt));
      if (s.quat.angleTo(_q) < 0.02) s.aligning = false;
    } else s.aligning = false;
  } else if (manual) {
    s.quat.multiply(_q.setFromEuler(new THREE.Euler(pitch, yaw, roll, 'XYZ')));
  }
  s.quat.normalize();
  game.nav.aligning = s.aligning;

  // --- Empuxo newtoniano ao longo do nariz (inércia real → dá pra orbitar) ---
  fwd.set(0, 0, -1).applyQuaternion(s.quat);
  const boost = s.boost ? SHIP.boostMultiplier : 1;
  s.vel.addScaledVector(fwd, s.throttle * SHIP.maxThrustAccel * boost * dt);

  // --- Freio (X): empuxo contra a velocidade atual ---
  if (input.brake) {
    const sp = s.vel.length();
    if (sp > 0.1) s.vel.addScaledVector(dvV.copy(s.vel).multiplyScalar(1 / sp), -Math.min(sp, SHIP.brakeAccel * dt));
  }

  // --- Gravidade (SOI dominante, por cima do empuxo) ---
  const g = computeGravity(s.pos, accelG);
  s.vel.addScaledVector(accelG, dt);
  s.dominant = g.dominant; s.gravMag = g.gravMag; s.noReturn = g.noReturn;
  s.altitude = g.altitude;

  // --- Atmosfera (perto da Terra): arrasto ---
  s.inAtmosphere = g.dominant === earthBody && g.altitude < ATMO.thickness && g.altitude > -1;
  if (s.inAtmosphere) {
    const dragF = ATMO.drag * (1 - g.altitude / ATMO.thickness);
    s.vel.multiplyScalar(1 - dragF * dt);
  }

  // --- Integra posição ---
  s.pos.addScaledVector(s.vel, dt);
  s.speed = s.vel.length();

  // --- Colisão com superfície ---
  const hit = surfaceContact(s.pos, SHIP.size * 0.5);
  if (hit) {
    const n = tmp.copy(s.pos).sub(hit.body.worldPos).normalize();
    s.pos.addScaledVector(n, hit.depth + 0.01);
    const vn = s.vel.dot(n);
    if (vn < 0) s.vel.addScaledVector(n, -vn);      // remove componente para dentro
    const impact = -vn;
    if (impact > 300) { s.hp -= (impact - 300) * 0.12; }  // batida forte = dano
    s.vel.multiplyScalar(0.9);                            // atrito de superfície
  }
}

function updateCamera(s, dt) {
  // Câmera de perseguição suave atrás da nave.
  tmp.copy(camOffset).applyQuaternion(s.quat).add(s.pos);
  camera.position.lerp(tmp, 1 - Math.pow(0.0001, dt));
  camTarget.copy(fwd.set(0, 0, -6).applyQuaternion(s.quat)).add(s.pos);
  camera.lookAt(camTarget);
  const upv = new THREE.Vector3(0, 1, 0).applyQuaternion(s.quat);
  camera.up.lerp(upv, 1 - Math.pow(0.001, dt));
}

export function shipForward(out) { return out.set(0, 0, -1).applyQuaternion(game.ship.quat); }
export function shipMesh() { return mesh; }
