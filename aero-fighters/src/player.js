// player.js — F-35 Lightning II: mesh + física de voo + detecção de crash.
// Exporta: jet (Group), updatePlayer, playerHit, barrelRoll, respawnJet, firePosition.
// Para trocar o avião: edite o builder buildJet() abaixo.
// Para ajustar manobra: edite PLAYER em config.js.
//
// Decisão arquitetural: speed/throttle/stalled vivem ÚNICOS em game.player.
// (Antes existiam duplicados em variáveis de módulo — bug latente eliminado.)

import * as THREE from '../../vendor/three.module.min.js';
import { scene } from './scene.js';
import { audio } from './audio.js';
import { game } from './state.js';
import { PLAYER, ROLL, COLORS } from './config.js';
import { explosion, megaExplosion, spawnMissileSmoke } from './fx.js';
import { checkTerrainCollision } from './world.js';
import { classifyGroundContact, airportSurface } from './landing-zones.js';
import { syncFlightGroundDiagnostics, updateGroundRoll } from './ground-physics.js';
import { SortieEvent, SortieState, transitionSortie } from './sortie-state.js';

// ─── Mesh do F-35 ────────────────────────────────────────────────────────────
function buildJet() {
  const g = new THREE.Group();
  // PBR (MeshStandardMaterial) para o corpo — responde a luz, projeta sombra
  const grey      = new THREE.MeshStandardMaterial({ color: COLORS.jetGrey, metalness: 0.75, roughness: 0.35 });
  const darkGrey  = new THREE.MeshStandardMaterial({ color: COLORS.jetDark, metalness: 0.75, roughness: 0.35 });
  const panel     = new THREE.MeshStandardMaterial({ color: COLORS.jetPanel, metalness: 0.65, roughness: 0.45 });
  const canopy    = new THREE.MeshStandardMaterial({ color: COLORS.jetCanopy, metalness: 0.2, roughness: 0.15 });
  // Vidro do canopy: ainda translúcido (Basic + opacidade)
  const canopyR   = new THREE.MeshBasicMaterial({ color: COLORS.jetCanopyGlass, transparent: true, opacity: 0.85 });
  // Materiais emissivos do exhaust permanecem Basic (não respondem a luz)
  const exhaustO  = new THREE.MeshBasicMaterial({ color: COLORS.exhaustOrange, transparent: true, opacity: 0.9 });
  const flameY    = new THREE.MeshBasicMaterial({ color: COLORS.flameYellow, transparent: true, opacity: 0.95 });
  // Asas com DoubleSide (BufferGeometry trapezoidal espelha normal por sinal)
  const wingMat   = new THREE.MeshStandardMaterial({ color: COLORS.jetGrey, metalness: 0.75, roughness: 0.35, side: THREE.DoubleSide });
  const wingDark  = new THREE.MeshStandardMaterial({ color: COLORS.jetDark, metalness: 0.75, roughness: 0.35, side: THREE.DoubleSide });

  // Nariz facetado — 8 lados para perfil mais suave
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.34, 1.4, 8), grey);
  nose.rotation.x = -Math.PI / 2;
  nose.position.set(0, 0, -1.55); g.add(nose);

  // Fuselagem dianteira
  const fwd = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.45, 1.2), panel);
  fwd.position.set(0, 0, -0.55); g.add(fwd);

  // Canopy
  const canopyFrame = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.05, 0.78), darkGrey);
  canopyFrame.position.set(0, 0.18, -0.65); g.add(canopyFrame);
  const canopyGlass = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.22, 0.68), canopyR);
  canopyGlass.position.set(0, 0.30, -0.65); g.add(canopyGlass);
  const canopyDark = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.18, 0.6), canopy);
  canopyDark.position.set(0, 0.30, -0.65); g.add(canopyDark);

  // Centro
  const mid = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.52, 1.4), grey);
  mid.position.set(0, 0, 0.45); g.add(mid);

  // Cauda
  const aft = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.45, 0.85), darkGrey);
  aft.position.set(0, 0, 1.5); g.add(aft);

  // Asas trapezoidais (custom BufferGeometry)
  const wingShape = (sign) => {
    const wg = new THREE.BufferGeometry();
    const x = sign;
    const v = new Float32Array([
      0,        0, -0.4,
      1.8 * x,  0,  0.45,
      1.8 * x,  0,  0.95,
      0,        0,  0.9,
    ]);
    wg.setAttribute('position', new THREE.BufferAttribute(v, 3));
    wg.setIndex([0, 1, 2, 0, 2, 3]);
    wg.computeVertexNormals();
    return wg;
  };
  const wingL = new THREE.Mesh(wingShape(-1), wingMat);
  wingL.position.set(0, -0.04, 0.35); g.add(wingL);
  const wingR = new THREE.Mesh(wingShape(1), wingMat);
  wingR.position.set(0, -0.04, 0.35); g.add(wingR);
  const wingLb = new THREE.Mesh(wingShape(-1), wingDark);
  wingLb.position.set(0, -0.12, 0.35); g.add(wingLb);
  const wingRb = new THREE.Mesh(wingShape(1), wingDark);
  wingRb.position.set(0, -0.12, 0.35); g.add(wingRb);

  // V-tails canted
  const tailL = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.7, 0.65), grey);
  tailL.position.set(-0.30, 0.32, 1.45); tailL.rotation.z = 0.35; g.add(tailL);
  const tailR = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.7, 0.65), grey);
  tailR.position.set(0.30, 0.32, 1.45); tailR.rotation.z = -0.35; g.add(tailR);

  // Stabilators horizontais
  const stabShape = (sign) => {
    const wg = new THREE.BufferGeometry();
    const x = sign;
    const v = new Float32Array([
      0,       0, 1.4,
      0.85*x,  0, 1.7,
      0.85*x,  0, 2.05,
      0,       0, 1.95,
    ]);
    wg.setAttribute('position', new THREE.BufferAttribute(v, 3));
    wg.setIndex([0, 1, 2, 0, 2, 3]);
    wg.computeVertexNormals();
    return wg;
  };
  const stabL = new THREE.Mesh(stabShape(-1), wingDark);
  stabL.position.set(0, 0.05, 0); g.add(stabL);
  const stabR = new THREE.Mesh(stabShape(1), wingDark);
  stabR.position.set(0, 0.05, 0); g.add(stabR);

  // Exhaust (referências expostas via userData para afterburner dinâmico)
  const exhRing = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.30, 0.45, 16), darkGrey);
  exhRing.rotation.x = Math.PI / 2; exhRing.position.set(0, 0, 2.05); g.add(exhRing);
  const exhGlow = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.25, 0.35, 12), exhaustO);
  exhGlow.rotation.x = Math.PI / 2; exhGlow.position.set(0, 0, 2.1); g.add(exhGlow);
  const exhFlame = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.18, 0.25, 8), flameY);
  exhFlame.rotation.x = Math.PI / 2; exhFlame.position.set(0, 0, 2.15); g.add(exhFlame);
  g.userData.exhGlow = exhGlow;
  g.userData.exhFlame = exhFlame;
  // Todos os meshes do jato projetam sombra
  g.traverse((obj) => { if (obj.isMesh) obj.castShadow = true; });

  // Intake ventral
  const intake = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.18, 0.55), darkGrey);
  intake.position.set(0, -0.32, -0.25); g.add(intake);

  // Wingtip pylons
  for (const sx of [-1.65, 1.65]) {
    const pyl = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.12, 0.6), darkGrey);
    pyl.position.set(sx, -0.08, 0.7); g.add(pyl);
  }

  // Luzes de navegação (MeshBasicMaterial piscante — sem custo de shadow)
  const navGreenMat = new THREE.MeshBasicMaterial({ color: 0x00ff44 });
  const navRedMat   = new THREE.MeshBasicMaterial({ color: 0xff2200 });
  const strobeMatW  = new THREE.MeshBasicMaterial({ color: 0xffffff });

  const navGreen = new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 6), navGreenMat);
  navGreen.position.set(-2.0, 0, 0.4); // wingtip estibordo
  g.add(navGreen);

  const navRed = new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 6), navRedMat);
  navRed.position.set(2.0, 0, 0.4); // wingtip bombordo
  g.add(navRed);

  const strobe = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 6), strobeMatW);
  strobe.position.set(0, 0.12, 1.1); // tail
  g.add(strobe);

  // Guardar referências em jet.userData
  g.userData.navGreen = navGreen;
  g.userData.navRed   = navRed;
  g.userData.strobe   = strobe;

  return g;
}

/** Cria meshes visuais de mísseis nas asas e sob fuselagem. */
function buildWingLoadout(jet) {
  const lightMat  = new THREE.MeshLambertMaterial({ color: 0x888ea0 });
  const heavyMat  = new THREE.MeshLambertMaterial({ color: 0x4a4a52 });
  const nucMat    = new THREE.MeshBasicMaterial({ color: 0x1a3a12 });
  const finMat    = new THREE.MeshLambertMaterial({ color: 0x6a6e7a, side: THREE.DoubleSide });
  const seekerMat = new THREE.MeshBasicMaterial({ color: 0x112233, transparent: true, opacity: 0.92 });
  const warnMat   = new THREE.MeshBasicMaterial({ color: 0xff2200 });
  const pylonMat  = new THREE.MeshLambertMaterial({ color: 0x3a3a42 });

  // Adds nosecone + cruciform fins + optional IR seeker dome to a missile body
  function addDetail(mx, my, mz, halfLen, bodyR, mat, withSeeker) {
    const nH = halfLen * 0.48;
    const noseG = new THREE.ConeGeometry(bodyR * 1.05, nH, 6);
    noseG.rotateX(-Math.PI / 2); // tip → -Z (forward in jet space)
    const nose = new THREE.Mesh(noseG, mat);
    nose.position.set(mx, my, mz - halfLen - nH / 2);
    jet.add(nose);

    if (withSeeker) {
      const dome = new THREE.Mesh(new THREE.SphereGeometry(bodyR * 0.72, 8, 6), seekerMat);
      dome.position.set(mx, my, mz - halfLen - nH - bodyR * 0.25);
      jet.add(dome);
    }

    // Cruciform fins: horizontal + vertical box pair at tail
    const fL = halfLen * 0.52;
    const fS = bodyR * 3.8;
    const tailZ = mz + halfLen - fL / 2;
    const hFin = new THREE.Mesh(new THREE.BoxGeometry(fS, 0.024, fL), finMat);
    hFin.position.set(mx, my, tailZ);
    jet.add(hFin);
    const vFin = new THREE.Mesh(new THREE.BoxGeometry(0.024, fS, fL), finMat);
    vFin.position.set(mx, my, tailZ);
    jet.add(vFin);
  }

  // — Light missiles (4): 2 per wing, inner & outer pylon station —
  const lG = new THREE.CylinderGeometry(0.06, 0.07, 0.9, 6);
  lG.rotateX(Math.PI / 2);
  const lightPositions = [
    [-0.9, -0.15, 0.4],
    [-1.5, -0.12, 0.3],
    [ 0.9, -0.15, 0.4],
    [ 1.5, -0.12, 0.3],
  ];
  const lightMeshes = [];
  for (const [mx, my, mz] of lightPositions) {
    const m = new THREE.Mesh(lG, lightMat);
    m.position.set(mx, my, mz);
    jet.add(m);
    lightMeshes.push(m);

    const pyl = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.11, 0.05), pylonMat);
    pyl.position.set(mx, my + 0.08, mz);
    jet.add(pyl);

    addDetail(mx, my, mz, 0.45, 0.065, lightMat, true);
  }

  // — Heavy missiles (2): mid-wing station —
  const hG = new THREE.CylinderGeometry(0.09, 0.10, 1.2, 6);
  hG.rotateX(Math.PI / 2);
  const heavyMeshes = [];
  const heavyPositions = [[-1.1, -0.18, 0.55], [1.1, -0.18, 0.55]];
  for (const [mx, my, mz] of heavyPositions) {
    const m = new THREE.Mesh(hG, heavyMat);
    m.position.set(mx, my, mz);
    jet.add(m);
    heavyMeshes.push(m);

    const pyl = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.12, 0.06), pylonMat);
    pyl.position.set(mx, my + 0.09, mz);
    jet.add(pyl);

    addDetail(mx, my, mz, 0.60, 0.095, heavyMat, false);
  }

  // — Nuclear missile (1): centerline belly mount —
  const nG = new THREE.CylinderGeometry(0.14, 0.14, 1.5, 6);
  nG.rotateX(Math.PI / 2);
  const [nmx, nmy, nmz] = [0, -0.35, 0.5];
  const nucMesh = new THREE.Mesh(nG, nucMat);
  nucMesh.position.set(nmx, nmy, nmz);
  jet.add(nucMesh);

  // Red warning band
  const wbG = new THREE.CylinderGeometry(0.156, 0.156, 0.09, 12);
  wbG.rotateX(Math.PI / 2);
  const warnBand = new THREE.Mesh(wbG, warnMat);
  warnBand.position.set(nmx, nmy, nmz - 0.14);
  jet.add(warnBand);

  // Short fuselage strut
  const nucPyl = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.10, 0.14), pylonMat);
  nucPyl.position.set(nmx, nmy + 0.21, nmz);
  jet.add(nucPyl);

  addDetail(nmx, nmy, nmz, 0.75, 0.14, nucMat, false);

  jet.userData.wepMeshes = { light: lightMeshes, heavy: heavyMeshes, nuclear: nucMesh };
}

export const jet = buildJet();
jet.scale.set(1.4, 1.4, 1.4);
buildWingLoadout(jet);
jet.position.set(game.player.x, game.player.y, game.player.pz || 0);
scene.add(jet);

// ─── Estado de física ────────────────────────────────────────────────────────
// Inicializa flags de roll em game.flags (criado por state.js sem rollTimer)
game.flags.rollTimer = 0;
game.flags.rollCooldown = 0;
game.flags.rollDir = 1;

const _pitchQ = new THREE.Quaternion();
const _rollQ  = new THREE.Quaternion();
const _yawQ   = new THREE.Quaternion();
const _lPitch = new THREE.Vector3(1, 0, 0);
const _lRoll  = new THREE.Vector3(0, 0, 1);
const _worldUp = new THREE.Vector3(0, 1, 0);
const _v1 = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _maydayPos = new THREE.Vector3();

/** Inicia um barrel roll (se cooldown permitir). */
export function barrelRoll() {
  if (game.flags.rollTimer > 0 || game.flags.rollCooldown > 0) return;
  game.flags.rollTimer = ROLL.DUR;
  game.flags.rollCooldown = ROLL.COOLDOWN;
  game.flags.rollDir *= -1;
}

/** Atualiza física e controle. @param dt segundos @param input flags semânticas
 *  @param onCrash callback(reason: 'SEA'|'MOUNTAIN') quando colide com terreno
 *
 *  ORDERING CONTRACT (dual-state fix):
 *  1. game.player.throttle / speed / stalled — atualizados PRIMEIRO, no início do frame.
 *     Qualquer módulo que ler game.player.speed neste frame já lê o valor corrente.
 *  2. game.player.x / y / pitch — atualizados POR ÚLTIMO, após o movimento do frame.
 *     Isso é intencional: x/y/pitch refletem a posição FINAL do frame (HUD e tests
 *     lêem sempre a posição mais recente, nunca a do frame anterior).
 */
export function updatePlayer(dt, input, onCrash) {
  if (!game.running || game.flags.paused) return;
  const mr = game.missionRealism;
  const sortie = mr?.sortie;
  const groundStates = new Set([
    SortieState.TAXI_OUT,
    SortieState.TAKEOFF_ROLL,
    SortieState.LANDING_ROLL,
    SortieState.TAXI_IN,
    SortieState.NEXT_SORTIE_READY,
  ]);
  if (mr?.enabled && sortie && groundStates.has(sortie.state)) {
    const contact = classifyGroundContact({ x: jet.position.x, y: jet.position.y, z: jet.position.z }, game.activeMap, 0);
    mr.groundContact = contact;
    mr.landingZoneStatus = contact;
    updateGroundRoll(mr.ground, input, dt, contact.type, game.player.throttle);
    if (input.throttleUp) game.player.throttle = Math.min(1, game.player.throttle + dt * PLAYER.THROTTLE_UP_RATE);
    if (input.throttleDown) game.player.throttle = Math.max(0.02, game.player.throttle - dt * PLAYER.THROTTLE_DN_RATE);
    game.player.speed = mr.ground.groundSpeed;

    if (input.rollLeft || input.yawLeft) {
      _yawQ.setFromAxisAngle(_worldUp, PLAYER.YAW_RATE * 0.55 * dt);
      jet.quaternion.premultiply(_yawQ);
    }
    if (input.rollRight || input.yawRight) {
      _yawQ.setFromAxisAngle(_worldUp, -PLAYER.YAW_RATE * 0.55 * dt);
      jet.quaternion.premultiply(_yawQ);
    }
    const fwdG = _v1.set(0, 0, -1).applyQuaternion(jet.quaternion);
    jet.position.addScaledVector(fwdG, game.player.speed * dt);
    jet.position.y = contact.height + 0.9;

    if (sortie.state === SortieState.TAXI_OUT && contact.type === 'runway') {
      transitionSortie(sortie, SortieEvent.TAXI_TO_RUNWAY, {}, game.time);
    }
    if (sortie.state === SortieState.TAKEOFF_ROLL && game.player.speed >= 38) {
      transitionSortie(sortie, SortieEvent.TAKEOFF_SPEED_REACHED, {}, game.time);
    }
    // Smooth liftoff: gate on runway contact + V_ROTATE speed + rotation input.
    // Applies ROTATE_LIFT force gradually; no teleport. Transitions to AIRBORNE
    // only when height > 4m above airport elevation AND vertical speed > 0.
    if (sortie.state === SortieState.TAKEOFF_ROLL &&
        contact.type === 'runway' &&
        game.player.speed >= PLAYER.V_ROTATE &&
        (input.pitchDown || input.pitchUp)) {
      if (!sortie.liftoffVsp) sortie.liftoffVsp = 0;
      sortie.liftoffVsp += PLAYER.ROTATE_LIFT * dt;
      jet.position.y += sortie.liftoffVsp * dt;
      game.player.speed = Math.max(game.player.speed, 45);
      const altAbove = jet.position.y - contact.height;
      if (altAbove > 4 && sortie.liftoffVsp > 0) {
        transitionSortie(sortie, SortieEvent.LIFTOFF, {}, game.time);
      }
    }
    // Per-frame floor clamp: never let the jet go underground while in ground states
    // or when sitting on an airport surface.
    const floorClampHeight = contact.height + 0.9;
    if (GROUND_STATES.has(sortie.state) || airportSurface({ x: jet.position.x, z: jet.position.z }) !== 'none') {
      jet.position.y = Math.max(jet.position.y, floorClampHeight);
    } else {
      // Still clamp to runway height if we're just barely off the ground during liftoff rotation
      jet.position.y = Math.max(jet.position.y, contact.height + 0.9);
    }
    if ((sortie.state === SortieState.LANDING_ROLL || sortie.state === SortieState.TAXI_IN) && contact.type === 'service' && game.player.speed < 10) {
      transitionSortie(sortie, SortieEvent.SERVICE_ZONE_REACHED, {}, game.time);
    }

    game.player.x = jet.position.x;
    game.player.y = jet.position.y;
    game.player.pz = jet.position.z;
    game.player.pitch = jet.rotation.x;
    return;
  }

  // Mayday: sem controle — cai com wobble e fogo até impactar o solo
  if (game.flags.mayday) {
    game.flags.damageSmoke -= dt;
    if (game.flags.damageSmoke <= 0) {
      game.flags.damageSmoke = 0.06;
      firePosition(_maydayPos, -2.2);
      spawnMissileSmoke(_maydayPos);
      if (Math.random() < 0.4) explosion(_maydayPos.clone(), 0.3, COLORS.fireOrange);
    }
    // Tumble progressivamente mais rápido conforme perde altitude
    const spin = 0.8 + Math.max(0, (80 - jet.position.y) / 80) * 1.8;
    jet.rotateX(((Math.random() - 0.4) * spin) * dt);
    jet.rotateZ(((Math.random() - 0.5) * spin) * dt);
    // Freia motores, gravidade aumentada
    game.player.speed = Math.max(8, game.player.speed - 20 * dt);
    const fwdM = _v1.set(0, 0, -1).applyQuaternion(jet.quaternion);
    jet.position.addScaledVector(fwdM, game.player.speed * dt);
    jet.position.y -= (PLAYER.GRAVITY * 4.0) * dt;
    game.player.y = jet.position.y;
    // Impacto no solo — mega explosão e então ejeção/respawn
    // jet.visible permanece true durante toda a queda (T-BF04)
    // só é ocultado dentro de _ejectAndRespawn, após a explosão
    const impact = checkTerrainCollision(jet.position);
    if (impact) {
      megaExplosion(jet.position.clone(), 'crash');
      _ejectAndRespawn(onCrash);
    }
    return;
  }

  // CONTRATO: writer de game.player.throttle / speed / stalled — atualizados PRIMEIRO
  if (input.throttleUp)   game.player.throttle = Math.min(1.0, game.player.throttle + dt * PLAYER.THROTTLE_UP_RATE);
  if (input.throttleDown) game.player.throttle = Math.max(0.05, game.player.throttle - dt * PLAYER.THROTTLE_DN_RATE);

  // Speed converge — usa game.player.throttle já atualizado acima
  const tgtSpd = PLAYER.MIN_SPD + game.player.throttle * (PLAYER.MAX_SPD - PLAYER.MIN_SPD);
  game.player.speed += (tgtSpd - game.player.speed) * Math.min(1, dt * PLAYER.CONVERGE_RATE);
  game.player.speed = Math.max(2, game.player.speed);
  game.player.stalled = game.player.speed < PLAYER.STALL_SPD;

  // Pitch INVERTIDO (estilo simulador)
  if (input.pitchUp)   { _pitchQ.setFromAxisAngle(_lPitch, -PLAYER.PITCH_RATE * dt); jet.quaternion.multiply(_pitchQ); }
  if (input.pitchDown) { _pitchQ.setFromAxisAngle(_lPitch,  PLAYER.PITCH_RATE * dt); jet.quaternion.multiply(_pitchQ); }

  // Roll + yaw coordenado
  if (input.rollLeft) {
    _rollQ.setFromAxisAngle(_lRoll, PLAYER.ROLL_RATE * dt);  jet.quaternion.multiply(_rollQ);
    _yawQ.setFromAxisAngle(_worldUp, PLAYER.YAW_RATE * dt);  jet.quaternion.premultiply(_yawQ);
  }
  if (input.rollRight) {
    _rollQ.setFromAxisAngle(_lRoll, -PLAYER.ROLL_RATE * dt); jet.quaternion.multiply(_rollQ);
    _yawQ.setFromAxisAngle(_worldUp, -PLAYER.YAW_RATE * dt); jet.quaternion.premultiply(_yawQ);
  }
  // Rudder (yaw puro)
  if (input.yawLeft)  { _yawQ.setFromAxisAngle(_worldUp,  PLAYER.YAW_RATE * PLAYER.RUDDER_FACTOR * dt); jet.quaternion.premultiply(_yawQ); }
  if (input.yawRight) { _yawQ.setFromAxisAngle(_worldUp, -PLAYER.YAW_RATE * PLAYER.RUDDER_FACTOR * dt); jet.quaternion.premultiply(_yawQ); }
  // Barrel roll
  if (game.flags.rollTimer > 0) {
    _rollQ.setFromAxisAngle(_lRoll, (Math.PI * 2 / ROLL.DUR) * dt * game.flags.rollDir);
    jet.quaternion.multiply(_rollQ);
  }

  // Movimento
  const fwd = _v1.set(0, 0, -1).applyQuaternion(jet.quaternion);
  jet.position.addScaledVector(fwd, game.player.speed * dt);
  jet.position.y -= PLAYER.GRAVITY * dt;
  if (!game.player.stalled) {
    const liftFactor = Math.min(game.player.speed / (PLAYER.MIN_SPD * 2.5), 1.0);
    const up = _v2.set(0, 1, 0).applyQuaternion(jet.quaternion);
    jet.position.addScaledVector(up, PLAYER.GRAVITY * liftFactor * dt);
  }

  // Crash
  const crash = checkTerrainCollision(jet.position);
  if (crash) {
    if (mr?.enabled && crash === 'MOUNTAIN') {
      transitionSortie(mr.sortie, SortieEvent.MOUNTAIN_CONTACT, {}, game.time);
      game.flags.mayday = true;
      game.flags.invincibility = 0;
      explosion(jet.position.clone(), 1.6, COLORS.playerHitOrange);
      audio.mayday();
      return;
    }
    onCrash(crash);
    return;
  }

  // Light smoke trail from engine when hull is at 1 HP
  if (game.player.hp === 1) {
    game.flags.damageSmoke -= dt;
    if (game.flags.damageSmoke <= 0) {
      game.flags.damageSmoke = 0.18;
      firePosition(_maydayPos, -2.2);
      spawnMissileSmoke(_maydayPos);
    }
  }

  audio.setEngineRPM(game.player.speed, game.player.throttle);

  // Afterburner: glow + flame escalam com throttle (0.6x parado, 1.6x full)
  const burn = 0.55 + game.player.throttle * 1.05;
  if (jet.userData.exhGlow)  jet.userData.exhGlow.scale.set(burn, burn, burn);
  if (jet.userData.exhFlame) jet.userData.exhFlame.scale.set(burn, burn, burn * (0.9 + Math.random() * 0.2));

  // Luzes de navegação: nav sempre ligadas, strobe pisca a 1.2 Hz
  game.time = (game.time || 0) + dt;
  if (jet.userData.navGreen) jet.userData.navGreen.visible = true;
  if (jet.userData.navRed)   jet.userData.navRed.visible   = true;
  if (jet.userData.strobe)   jet.userData.strobe.visible   = Math.sin(game.time * Math.PI * 2 * 1.2) > 0.8;

  // Atualizar visibilidade dos mísseis nas asas a cada 30 frames
  if (!game._wepFrame) game._wepFrame = 0;
  game._wepFrame++;
  if (game._wepFrame % 30 === 0) {
    const wep = jet.userData.wepMeshes;
    if (wep) {
      const lCount = game.player.missiles;
      wep.light.forEach((m, i) => { m.visible = i < Math.ceil(lCount / 25); });
      const hCount = game.player.heavyMissiles;
      wep.heavy.forEach((m, i) => { m.visible = i < Math.ceil(hCount / 5); });
      if (wep.nuclear) wep.nuclear.visible = game.player.nuclearMissiles > 0;
    }
  }

  // Per-frame floor clamp (airborne physics path):
  // If the jet is over an airport surface, ensure y never goes below contact.height + 0.9.
  // This guard prevents the one-frame underground clip when gravity drives y < terrain.
  if (mr?.enabled) {
    const _floorContact = classifyGroundContact(
      { x: jet.position.x, y: jet.position.y, z: jet.position.z }, game.activeMap, 0);
    const _onAirportSurface = airportSurface({ x: jet.position.x, z: jet.position.z }) !== 'none';
    const _inGroundState = GROUND_STATES.has(mr?.sortie?.state);
    if (_inGroundState || _onAirportSurface) {
      jet.position.y = Math.max(jet.position.y, _floorContact.height + 0.9);
    }
  }

  // CONTRATO: writer de game.player.x/y/pitch/pz — escritos POR ÚLTIMO (após movimento do frame)
  // Intencional: refletem posição final do frame; HUD e tests sempre lêem valor corrente.
  game.player.x = jet.position.x;
  game.player.y = jet.position.y;
  game.player.pz = jet.position.z;
  game.player.pitch = jet.rotation.x;
  if (mr?.enabled) {
    const contact = classifyGroundContact({ x: jet.position.x, y: jet.position.y, z: jet.position.z }, game.activeMap, 0);
    const altitudeAboveGround = jet.position.y - contact.height;
    syncFlightGroundDiagnostics(mr.ground, {
      speed: game.player.speed,
      throttle: game.player.throttle,
      pitch: jet.rotation.x,
      roll: jet.rotation.z,
      verticalSpeed: fwd.y * game.player.speed - PLAYER.GRAVITY,
      surface: contact.type,
      contact,
      altitudeAboveGround,
    });
    mr.groundContact = contact;
    mr.landingZoneStatus = contact;
    if (altitudeAboveGround < 3 && contact.safe && mr.ground.landingEnvelope.safe && mr.sortie.state === SortieState.RETURN_TO_BASE) {
      jet.position.y = contact.height + 0.9;
      mr.ground.groundSpeed = Math.max(12, game.player.speed * 0.62);
      transitionSortie(mr.sortie, SortieEvent.TOUCHDOWN_SAFE, {}, game.time);
    } else if (altitudeAboveGround < 2 && !contact.safe && mr.sortie.state === SortieState.RETURN_TO_BASE) {
      transitionSortie(mr.sortie, SortieEvent.TOUCHDOWN_UNSAFE, {}, game.time);
      onCrash(contact.reason);
    }
  }
}

function _ejectAndRespawn(onGameOver) {
  // Ocultar o jet somente aqui, após a explosão de impacto (T-BF04)
  // Durante todo o mayday o avião estava visível caindo fisicamente
  jet.visible = false;
  game.flags.mayday = false;
  game.flags.maydayTimer = 0;
  game.player.lives -= 1;
  if (game.player.lives <= 0) {
    onGameOver('MAYDAY — AERONAVE PERDIDA');
    return;
  }
  game.player.hp = 3;
  game.flags.invincibility = 3.0;
  game.flags.shakeTime = 0;
  respawnJet();
  audio.explosion(0.5);
}

/** Aplica dano ao HP; 3 hits por vida antes de entrar em mayday. */
export function playerHit() {
  if (game.flags.invincibility > 0 || game.flags.rollTimer > 0 || game.flags.mayday) return;
  game.player.hp -= 1;
  if (game.player.hp > 0) {
    game.flags.invincibility = 1.4;
    game.flags.shakeTime = 0.45;
    explosion(jet.position.clone(), 0.7, COLORS.playerHitOrange);
    audio.explosion(0.4);
  } else {
    game.player.hp = 0;
    game.flags.mayday = true;
    if (game.missionRealism?.enabled) transitionSortie(game.missionRealism.sortie, SortieEvent.CRITICAL_DAMAGE, {}, game.time);
    game.flags.invincibility = 0;
    explosion(jet.position.clone(), 1.6, COLORS.playerHitOrange);
    audio.mayday();
  }
}

/** Reseta o avião para o estado inicial (chamado por restartGame). */
export function respawnJet() {
  if (game.missionRealism?.enabled) {
    jet.position.set(-160, 0.9, 350);
  } else {
    jet.position.set(0, PLAYER.START_HEIGHT, 0);
  }
  jet.quaternion.set(0, 0, 0, 1);
  jet.visible = true;
  game.player.speed = game.missionRealism?.enabled ? 0 : 25;
  game.player.throttle = game.missionRealism?.enabled ? 0.05 : 0.5;
  game.player.stalled = false;
  game.player.x = jet.position.x;
  game.player.y = jet.position.y;
  game.player.pz = jet.position.z;
}

/** Vetor "forward" do jato + posição do bico (para spawnar projéteis). */
export function firePosition(out, offset = 2.0) {
  const fwd = _v1.set(0, 0, -1).applyQuaternion(jet.quaternion);
  out.copy(jet.position).addScaledVector(fwd, offset);
  return fwd;
}
