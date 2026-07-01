// ship.js — Nave do jogador: malha, voo 6-DOF newtoniano, throttle, decolagem
// da Terra (com horizonte que se curva), atmosfera e câmera de perseguição.

import * as THREE from '../../vendor/three.module.min.js';
import { scene, camera } from './scene.js';
import { SHIP, ATMO } from './config.js';
import { game } from './state.js';
import { computeGravity, surfaceContact } from './gravity.js';
import { input, consumeMouse } from './input.js';
import { currentTarget } from './nav.js';

let mesh, engineGlow, sideGlows = [];
const accelG = new THREE.Vector3();
const tmp = new THREE.Vector3();
const fwd = new THREE.Vector3();
const desiredV = new THREE.Vector3();
const dvV = new THREE.Vector3();
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _up = new THREE.Vector3(0, 1, 0);
const camOffset = new THREE.Vector3(0, 3.4, 13);
const camTarget = new THREE.Vector3();
const lastEarthPos = new THREE.Vector3();
let earthBody = null;
let launchAngle = 0;

export function buildShip() {
  mesh = new THREE.Group();
  // Nariz aponta para -Z. Caça espacial: fuselagem afilada, canopy, asas delta, naceles.
  const hull = new THREE.MeshStandardMaterial({ color: 0xc4ccd6, metalness: 0.8, roughness: 0.32 });
  const hullDark = new THREE.MeshStandardMaterial({ color: 0x59636f, metalness: 0.85, roughness: 0.4 });
  const accent = new THREE.MeshStandardMaterial({ color: 0xff6a3d, metalness: 0.5, roughness: 0.5, emissive: 0x331005, emissiveIntensity: 0.6 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x35c8ff, metalness: 0.3, roughness: 0.1, emissive: 0x0a2740, emissiveIntensity: 0.8 });

  // Fuselagem central (cone alongado, nariz em -Z)
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.42, 2.8, 16), hull);
  body.rotation.x = -Math.PI / 2; body.position.z = 0.1;
  mesh.add(body);
  // Bico afiado
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.9, 16), hull);
  nose.rotation.x = -Math.PI / 2; nose.position.z = -1.75;
  mesh.add(nose);
  // Canopy (cabine de vidro)
  const canopy = new THREE.Mesh(new THREE.SphereGeometry(0.26, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2), glass);
  canopy.rotation.x = -Math.PI / 2.2; canopy.position.set(0, 0.2, -0.5); canopy.scale.set(1, 1.6, 0.9);
  mesh.add(canopy);
  // Listra de acento no dorso
  const spine = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.06, 1.8), accent);
  spine.position.set(0, 0.22, 0.2);
  mesh.add(spine);

  // Asas delta enflechadas + naceles de motor nas pontas
  for (const s of [-1, 1]) {
    const wing = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.05, 1.1), hull);
    wing.position.set(s * 0.95, -0.02, 0.55); wing.rotation.z = s * 0.12; wing.rotation.y = s * -0.34;
    mesh.add(wing);
    const tip = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.05, 0.5), accent);
    tip.position.set(s * 1.55, 0.0, 0.75); tip.rotation.y = s * -0.34;
    mesh.add(tip);
    // nacele de motor
    const nac = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.18, 0.9, 12), hullDark);
    nac.rotation.x = Math.PI / 2; nac.position.set(s * 0.55, -0.05, 1.0);
    mesh.add(nac);
  }
  // Empenagem dupla (caudas em V)
  for (const s of [-1, 1]) {
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.55, 0.5), hull);
    tail.position.set(s * 0.28, 0.28, 1.15); tail.rotation.z = s * 0.5;
    mesh.add(tail);
  }

  // Motores / glow (twin + central). Os twins são sutis e ligados ao throttle.
  engineGlow = makeGlow();
  engineGlow.position.set(0, -0.02, 1.6);
  mesh.add(engineGlow);
  sideGlows = [];
  for (const s of [-1, 1]) {
    const g2 = makeGlow(); g2.scale.setScalar(0.5); g2.material.opacity = 0.35;
    g2.position.set(s * 0.55, -0.05, 1.5);
    mesh.add(g2); sideGlows.push(g2);
  }

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
  engineGlow.material.opacity = Math.min(0.85, 0.18 + thr * 0.5);
  for (const g of sideGlows) {
    g.scale.setScalar(0.32 + thr * 0.45);
    g.material.opacity = Math.min(0.7, 0.12 + thr * 0.45);
  }

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
  pitch += -dy * SHIP.mouseSens;
  yaw += -dx * SHIP.mouseSens;
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

  // --- Gravidade de N-corpos (aceleração REAL, calculada ANTES do motor) ---
  // Calculada primeiro e somada DEPOIS do motor, sem ser "lavada": é isto que faz
  // todo corpo (Saturno inclusive) puxar de verdade.
  const g = computeGravity(s.pos, accelG);

  // --- Propulsão ---
  fwd.set(0, 0, -1).applyQuaternion(s.quat);
  const boost = s.boost ? SHIP.boostMultiplier : 1;
  if (s.flightAssist) {
    // NAVEGAÇÃO RESPONSIVA (Set-Speed / fly-by-wire): a velocidade é continuamente
    // DIRECIONADA para o nariz, na intensidade do throttle. Virar a nave vira o seu
    // movimento → você VAI PARA ONDE APONTA. throttle 0 desacelera; [X] freia rápido.
    // A gravidade entra por cima: onde ela é forte (Sol, buraco negro) ela vence e te
    // puxa/prende; no espaço normal ela é fraca e não atrapalha a navegação.
    const targetSpeed = s.throttle * SHIP.cruiseSpeed * boost;
    desiredV.copy(fwd).multiplyScalar(targetSpeed);
    s.vel.lerp(desiredV, Math.min(1, SHIP.assistSteer * dt));
    if (input.brake) {                             // freio = parada rápida
      s.throttle = 0;
      s.vel.multiplyScalar(Math.max(0, 1 - SHIP.stopRate * dt));
    }
  } else {
    // NEWTONIANO puro (assist desligado com [Z]) — inércia real, sem limite.
    s.vel.addScaledVector(fwd, s.throttle * SHIP.maxThrustAccel * boost * dt);
    if (input.brake) {
      const sp = s.vel.length();
      if (sp > 0.1) s.vel.addScaledVector(dvV.copy(s.vel).multiplyScalar(1 / sp), -Math.min(sp, SHIP.brakeAccel * dt));
    }
  }

  // --- Gravidade entra SEMPRE por cima do motor (nunca é lavada) ---
  s.vel.addScaledVector(accelG, dt);
  s.dominant = g.dominant; s.gravMag = g.gravMag; s.noReturn = g.noReturn;
  s.altitude = g.altitude; s.escapeVel = g.escapeVel; s.canEscape = g.canEscape;
  s.circVel = g.circVel;

  // --- Atmosfera + REENTRADA (qualquer corpo com atmosfera) ---
  // Entrar rápido na atmosfera aquece o casco (brilho na tela + dano); o arrasto freia.
  const dom = g.dominant;
  const hasAtmo = dom && dom.def.hasAtmo;
  const atmoThick = hasAtmo ? dom.def.radius * ATMO.thicknessFactor : 0;
  s.inAtmosphere = hasAtmo && g.altitude < atmoThick && g.altitude > -dom.def.radius;
  if (s.inAtmosphere) {
    const depth = Math.max(0, Math.min(1, 1 - g.altitude / atmoThick));   // 0 borda → 1 chão
    const dragF = ATMO.drag * depth;
    s.vel.multiplyScalar(Math.max(0, 1 - dragF * dt));
    s.speed = s.vel.length();
    // aquecimento: quanto mais rápido + denso, mais o casco esquenta (reentrada)
    const heating = Math.max(0, (s.speed - ATMO.burnSpeed) / 2600) * (0.35 + depth);
    s.heat = Math.min(1, (s.heat || 0) + heating * dt * 2.2 - dt * 0.5);
    if (heating > 0.04) s.hp -= ATMO.burnDamage * heating * dt;
    s.atmoBody = dom;
  } else {
    s.heat = Math.max(0, (s.heat || 0) - dt * 0.9);
    s.atmoBody = null;
  }

  // --- Integra posição ---
  s.pos.addScaledVector(s.vel, dt);
  s.speed = s.vel.length();

  // --- Colisão com superfície / horizonte ---
  const hit = surfaceContact(s.pos, SHIP.size * 0.5);
  if (hit) {
    const kind = hit.body.def.kind;
    if (kind === 'blackhole') {
      s.hp = 0; s.killedBy = 'blackhole';                    // horizonte de eventos
    } else if (kind === 'neutron') {
      s.hp = 0; s.killedBy = 'neutron';                      // maré + radiação esmagam
    } else if (kind === 'gas' || kind === 'ice') {
      s.hp = 0; s.killedBy = 'gas';                          // afundou no gigante gasoso — esmagado
    } else if (hit.body.isSun) {
      s.hp = 0; s.killedBy = 'sun';                          // incinerado no Sol
    } else {
      const n = tmp.copy(s.pos).sub(hit.body.worldPos).normalize();
      s.pos.addScaledVector(n, hit.depth + 0.01);
      const vn = s.vel.dot(n);
      if (vn < 0) s.vel.addScaledVector(n, -vn);      // remove componente para dentro
      const impact = -vn;
      if (hit.body.def.ocean && (impact > 90 || s.heat > 0.45)) {
        s.hp = 0; s.killedBy = 'sea';                        // caiu no mar em chamas
      } else if (impact > 300) {
        s.hp -= (impact - 300) * 0.12;                       // batida forte = dano
      }
      s.vel.multiplyScalar(0.9);                            // atrito de superfície
    }
  }
}

function updateCamera(s, dt) {
  // Câmera de perseguição PRÓXIMA e firme atrás da nave (mantém a nave centralizada).
  tmp.copy(camOffset).applyQuaternion(s.quat).add(s.pos);
  camera.position.lerp(tmp, Math.min(1, 14 * dt));        // segue rápido → nave não "foge" da tela
  camTarget.copy(fwd.set(0, 0, -10).applyQuaternion(s.quat)).add(s.pos);
  camera.lookAt(camTarget);
  const upv = new THREE.Vector3(0, 1, 0).applyQuaternion(s.quat);
  camera.up.lerp(upv, Math.min(1, 10 * dt));
}

export function shipForward(out) { return out.set(0, 0, -1).applyQuaternion(game.ship.quat); }
export function shipMesh() { return mesh; }
