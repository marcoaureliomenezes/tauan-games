// ship.js — Nave do jogador: malha, voo 6-DOF newtoniano, throttle, decolagem
// da Terra (com horizonte que se curva), atmosfera e câmera de perseguição.

import * as THREE from '../../vendor/three.module.min.js';
import { OrbitControls } from '../../vendor/jsm/controls/OrbitControls.js';
import { scene, camera, renderer } from './scene.js';
import { SHIP, ATMO, OVERDRIVE } from './config.js';
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
const _eul = new THREE.Euler();
const _up = new THREE.Vector3(0, 1, 0);
const camOffset = new THREE.Vector3(0, 3.4, 13);
const camTarget = new THREE.Vector3();
const lastEarthPos = new THREE.Vector3();
const _earthVel = new THREE.Vector3();
let earthBody = null;
let launchAngle = 0;

// Câmera de OBSERVAÇÃO ([V]): OrbitControls (three r165 vendorado) orbitando a
// nave em movimento — arrasta com o mouse para OLHAR/RODAR ao redor e ver os
// corpos celestes; [V] de novo (ou pointer-lock) volta à perseguição.
let _obsControls = null;
const _prevShipPos = new THREE.Vector3();
export function toggleObservationCamera() {
  const s = game.ship;
  s.obsMode = !s.obsMode;
  if (s.obsMode) {
    if (document.pointerLockElement) document.exitPointerLock?.();
    if (!_obsControls) {
      _obsControls = new OrbitControls(camera, renderer.domElement);
      _obsControls.enableDamping = true;
      _obsControls.dampingFactor = 0.08;
      _obsControls.minDistance = 6;
      _obsControls.maxDistance = 4000;
    }
    _obsControls.enabled = true;
    _obsControls.target.copy(s.pos);
    _prevShipPos.copy(s.pos);
  } else if (_obsControls) {
    _obsControls.enabled = false;
  }
  return s.obsMode;
}

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
  _earthVel.copy(earthBody.worldPos).sub(lastEarthPos).multiplyScalar(dt > 0 ? 1 / dt : 0);
  const earthVel = _earthVel;
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

const _landedUp = new THREE.Vector3();
const _noseAxis = new THREE.Vector3(0, 0, -1);
function updateLanded(s, dt, earthVel) {
  // Presa à superfície da Terra, girando com ela; nariz radialmente para fora.
  launchAngle += ((Math.PI * 2) / earthBody.def.spin) * dt;
  const up = _landedUp.set(Math.cos(launchAngle), 0.35, Math.sin(launchAngle)).normalize();
  s.pos.copy(earthBody.worldPos).addScaledVector(up, earthBody.def.radius + SHIP.startAltitude);
  // orientar nariz (-Z) para "up"
  s.quat.setFromUnitVectors(_noseAxis, up);
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
  if (manual) { s.aligning = false; s.approach = false; s.orbitAssist = false; }
  if (input.brake) { s.approach = false; s.orbitAssist = false; }
  if (input.throttleUp || input.throttleDown) s.orbitAssist = false;

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
    s.quat.multiply(_q.setFromEuler(_eul.set(pitch, yaw, roll, 'XYZ')));
  }
  s.quat.normalize();
  game.nav.aligning = s.aligning;
  game.nav.approach = s.approach === true;

  // --- Gravidade de N-corpos (aceleração REAL, calculada ANTES do motor) ---
  // Calculada primeiro e somada DEPOIS do motor, sem ser "lavada": é isto que faz
  // todo corpo (Saturno inclusive) puxar de verdade.
  const g = computeGravity(s.pos, accelG, s.vel);

  // --- MOTOR INTERESTELAR (overdrive): engaja onde a GRAVIDADE É FRACA (meio
  // interestelar de verdade — não "fora do SOI": os domínios dos sistemas quase
  // se tocam e nunca haveria corredor). Total abaixo de 10 u/s², zero acima de
  // 40 u/s², rampa suave — viagens entre sistemas caem para 1-3 min.
  const weakG = Math.max(0, Math.min(1, (40 - g.gravMag) / 30));
  if (weakG > (s.overdrive || 0)) s.overdrive = Math.min(weakG, (s.overdrive || 0) + dt / OVERDRIVE.rampIn);
  else s.overdrive = Math.max(weakG, (s.overdrive || 0) - dt / OVERDRIVE.rampOut);
  const odCruise = 1 + (OVERDRIVE.mult - 1) * s.overdrive;
  const odThrust = 1 + (OVERDRIVE.thrustMult - 1) * s.overdrive;

  // --- Propulsão ---
  fwd.set(0, 0, -1).applyQuaternion(s.quat);
  const boost = s.boost ? SHIP.boostMultiplier : 1;
  if (s.orbitAssist) {
    // --- ASSISTENTE DE ÓRBITA ([O]): circulariza em torno do corpo DOMINANTE ---
    // Alinha a velocidade com a tangente local (prograde) na magnitude v_circ=√(μ/r):
    // funciona para planeta, estrela, pulsar e buraco negro. Qualquer manche cancela.
    const dom = g.dominant;
    if (!dom) { s.orbitAssist = false; }
    else {
      // TUDO no frame CO-MÓVEL do corpo (planetas em trilho se movem — a órbita
      // é relativa ao corpo; no fim somamos a velocidade do corpo de volta).
      const bodyVel = dom.worldVel || null;
      tmp.copy(s.pos).sub(dom.worldPos);
      const d = tmp.length();
      tmp.multiplyScalar(1 / Math.max(1e-6, d));            // r̂
      // velocidade relativa ao corpo
      dvV.copy(s.vel);
      if (bodyVel) dvV.sub(bodyVel);
      // tangente: projeta a velocidade RELATIVA no plano ⊥ r̂ (mantém o sentido)
      desiredV.copy(dvV).addScaledVector(tmp, -dvV.dot(tmp));
      if (desiredV.lengthSq() < 1) desiredV.crossVectors(_up, tmp); // degenerado
      desiredV.normalize();
      const vCirc = Math.sqrt(dom.mu / Math.max(d, dom.def.radius));
      // nariz na prograde (a nave "deita" na órbita)
      _m.lookAt(s.pos, camTarget.copy(s.pos).addScaledVector(desiredV, 100), _up);
      _q.setFromRotationMatrix(_m);
      s.quat.slerp(_q, Math.min(1, SHIP.alignRate * 0.7 * dt));
      desiredV.multiplyScalar(vCirc);
      if (bodyVel) desiredV.add(bodyVel);                   // volta ao frame de mundo
      s.vel.lerp(desiredV, Math.min(1, SHIP.assistSteer * 0.75 * dt));
      s.throttle = Math.max(0.05, Math.min(1, vCirc / (SHIP.cruiseSpeed * odCruise)));
      if (s.vel.distanceTo(desiredV) < Math.max(8, vCirc * 0.025)) {
        s.orbitAssist = false;
        s.orbitLocked = 2.5;   // main.js mostra o toast "ÓRBITA CIRCULAR ESTABELECIDA"
      }
    }
  } else if (s.approach) {
    // --- AUTO-APROXIMAÇÃO ([N]): voa até o alvo e CHEGA devagar ---
    // Perfil de chegada: velocidade desejada = √(2·a·restante)·0.55 (desacelera a
    // tempo), limitada pelo cruzeiro; a velocidade é dirigida ao alvo (mata deriva
    // lateral). A gravidade continua entrando por cima — perto do buraco negro ela
    // pode vencer o autopiloto, e deve.
    const t = currentTarget();
    if (t) {
      tmp.copy(t.pos).sub(s.pos);
      const dist = tmp.length();
      const arriveR = (t.radius || 8) * 3 + 60;
      tmp.multiplyScalar(1 / Math.max(1e-6, dist));   // direção ao alvo
      _m.lookAt(s.pos, t.pos, _up);
      _q.setFromRotationMatrix(_m);
      s.quat.slerp(_q, Math.min(1, SHIP.alignRate * 0.8 * dt));
      const vArrive = Math.sqrt(2 * SHIP.assistThrust * Math.max(0, dist - arriveR)) * 0.55;
      const vDes = Math.min(vArrive, SHIP.cruiseSpeed * boost * odCruise);
      desiredV.copy(tmp).multiplyScalar(vDes);
      s.vel.lerp(desiredV, Math.min(1, SHIP.assistSteer * 0.8 * dt));
      s.throttle = Math.max(0.05, Math.min(1, vDes / SHIP.cruiseSpeed));
      if (dist < arriveR && s.vel.length() < 60) { s.approach = false; s.throttle = 0; }
    } else s.approach = false;
  } else if (s.flightAssist) {
    // NAVEGAÇÃO RESPONSIVA (Set-Speed / fly-by-wire): a velocidade é continuamente
    // DIRECIONADA para o nariz, na intensidade do throttle. Virar a nave vira o seu
    // movimento → você VAI PARA ONDE APONTA. [X] freia rápido.
    // FIX DE ÓRBITA (2026-07-01): throttle ~0 agora COASTA DE VERDADE — antes o
    // lerp puxava a velocidade para ZERO (freio disfarçado) e matava a componente
    // tangencial: era IMPOSSÍVEL manter órbita. Com coast honesto + gravidade por
    // cima, órbitas keplerianas fecham em torno de qualquer corpo.
    if (input.brake) {                             // freio = parada rápida
      s.throttle = 0;
      s.vel.multiplyScalar(Math.max(0, 1 - SHIP.stopRate * dt));
    } else if (s.throttle > 0.02) {
      const targetSpeed = s.throttle * SHIP.cruiseSpeed * boost * odCruise;
      desiredV.copy(fwd).multiplyScalar(targetSpeed);
      s.vel.lerp(desiredV, Math.min(1, SHIP.assistSteer * odThrust * dt));
    }
    // throttle 0 sem freio → coast: inércia + gravidade (essencial p/ orbitar)
  } else {
    // NEWTONIANO puro (assist desligado com [Z]) — inércia real, sem limite.
    s.vel.addScaledVector(fwd, s.throttle * SHIP.maxThrustAccel * boost * odThrust * dt);
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
  s.interstellar = g.interstellar;
  s.vTangential = g.vTangential; s.vRadial = g.vRadial;
  // Órbita "fechada": tangencial perto de v_circ e radial pequena → HUD marca ÓRBITA
  s.inOrbit = !g.interstellar && g.dominant &&
    Math.abs(g.vTangential - g.circVel) < g.circVel * 0.18 &&
    Math.abs(g.vRadial) < Math.max(20, g.circVel * 0.10) &&
    g.altitude > 0;
  if (s.orbitLocked > 0) s.orbitLocked -= dt;

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

// FIX câmera-fugitiva (2026-07-01): o lerp de POSIÇÃO absoluto tinha atraso de
// regime v/k — em overdrive (×4.5 cruzeiro) a câmera assentava MILHARES de
// unidades atrás da nave ("nave some da tela"). Agora a posição é ANCORADA
// RIGIDAMENTE na nave (deriva zero em qualquer velocidade) e a suavização fica
// só na ROTAÇÃO (slerp exponencial, independente de frame-rate).
const _camQuat = new THREE.Quaternion();
const _camUp = new THREE.Vector3(0, 1, 0);
function updateCamera(s, dt) {
  if (s.obsMode && _obsControls) {
    // OBSERVAÇÃO: a câmera orbita a NAVE EM MOVIMENTO — translada junto com ela
    // (delta do frame) e o OrbitControls cuida do olhar/zoom com o mouse.
    tmp.copy(s.pos).sub(_prevShipPos);
    camera.position.add(tmp);
    _prevShipPos.copy(s.pos);
    _obsControls.target.copy(s.pos);
    camera.up.set(0, 1, 0);
    _obsControls.update();
    _camQuat.copy(s.quat);   // ao voltar à perseguição, sem chicotada
    return;
  }
  const k = 1 - Math.exp(-9 * dt);
  _camQuat.slerp(s.quat, k);
  tmp.copy(camOffset).applyQuaternion(_camQuat).add(s.pos);
  camera.position.copy(tmp);
  camTarget.copy(fwd.set(0, 0, -10).applyQuaternion(s.quat)).add(s.pos);
  camera.up.copy(_camUp.set(0, 1, 0).applyQuaternion(_camQuat));
  camera.lookAt(camTarget);
}

export function shipForward(out) { return out.set(0, 0, -1).applyQuaternion(game.ship.quat); }
export function shipMesh() { return mesh; }
