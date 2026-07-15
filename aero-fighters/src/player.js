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
import { explosion, megaExplosion, spawnMissileSmoke, spawnScorchMark } from './fx.js';
import { checkTerrainCollision, surfaceInfoAt } from './world.js';
import { classifyGroundContact, airportSurface } from './landing-zones.js';
import { getAirportForMap } from './airport.js';
import { syncFlightGroundDiagnostics, updateGroundRoll } from './ground-physics.js';
import { SortieEvent, SortieState, GROUND_STATES, transitionSortie, relaunchSortie } from './sortie-state.js';
import { canHandoffToGuidedTaxi } from './taxi-core.js';

// ─── Mesh do F-35 ────────────────────────────────────────────────────────────
function buildJet() {
  const g = new THREE.Group();
  // PBR (MeshStandardMaterial) para o corpo — responde a luz, projeta sombra
  const grey      = new THREE.MeshStandardMaterial({ color: COLORS.jetGrey, metalness: 0.55, roughness: 0.42 });
  const darkGrey  = new THREE.MeshStandardMaterial({ color: COLORS.jetDark, metalness: 0.55, roughness: 0.42 });
  const panel     = new THREE.MeshStandardMaterial({ color: COLORS.jetPanel, metalness: 0.65, roughness: 0.45 });
  const canopy    = new THREE.MeshStandardMaterial({ color: COLORS.jetCanopy, metalness: 0.2, roughness: 0.15 });
  // Vidro do canopy: ainda translúcido (Basic + opacidade)
  const canopyR   = new THREE.MeshBasicMaterial({ color: COLORS.jetCanopyGlass, transparent: true, opacity: 0.85 });
  // Materiais emissivos do exhaust permanecem Basic (não respondem a luz)
  const exhaustO  = new THREE.MeshBasicMaterial({ color: COLORS.exhaustOrange, transparent: true, opacity: 0.9 });
  const flameY    = new THREE.MeshBasicMaterial({ color: COLORS.flameYellow, transparent: true, opacity: 0.95 });
  // Asas com DoubleSide (BufferGeometry trapezoidal espelha normal por sinal)
  const wingMat   = new THREE.MeshStandardMaterial({ color: COLORS.jetGrey, metalness: 0.55, roughness: 0.42, side: THREE.DoubleSide });
  const wingDark  = new THREE.MeshStandardMaterial({ color: COLORS.jetDark, metalness: 0.55, roughness: 0.42, side: THREE.DoubleSide });

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

  // Trem de pouso (WS-4): 3 pernas com roda — retrai/estende por altura
  const gear = new THREE.Group();
  const strutMat = new THREE.MeshLambertMaterial({ color: 0x9aa0a8 });
  const tireMat  = new THREE.MeshLambertMaterial({ color: 0x101012 });
  const makeLeg = (x, z, len) => {
    const leg = new THREE.Group();
    const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.055, len, 6), strutMat);
    strut.position.y = -len / 2;
    leg.add(strut);
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.12, 10), tireMat);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.y = -len;
    leg.add(wheel);
    leg.position.set(x, -0.22, z);
    return leg;
  };
  gear.add(makeLeg(0, -1.0, 0.52));     // nariz
  gear.add(makeLeg(-0.55, 0.6, 0.55));  // principal esquerda
  gear.add(makeLeg(0.55, 0.6, 0.55));   // principal direita
  gear.userData.k = 1;                  // 1 = baixado, 0 = recolhido
  g.add(gear);
  g.userData.gear = gear;

  return g;
}

/** Anima o trem de pouso: baixa no chão/aproximação, recolhe em voo. */
function updateGearVisual(wantDeployed, dt) {
  const gear = jet.userData.gear;
  if (!gear) return;
  const target = wantDeployed ? 1 : 0;
  gear.userData.k += (target - gear.userData.k) * Math.min(1, dt * 3.2);
  const k = gear.userData.k;
  gear.scale.y = Math.max(0.04, k);
  gear.position.y = (1 - k) * 0.34; // pernas recolhem para dentro da fuselagem
  gear.visible = k > 0.07;
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
const _attitudeEuler = new THREE.Euler(0, 0, 0, 'YXZ');
const _lPitch = new THREE.Vector3(1, 0, 0);
const _lRoll  = new THREE.Vector3(0, 0, 1);
const _worldUp = new THREE.Vector3(0, 1, 0);
const _v1 = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _maydayPos = new THREE.Vector3();

// Velocidade vertical REAL (dy/dt) — única fonte para a lógica de pouso.
// (Antes o pouso usava fwd.y*speed - GRAVITY, que ignorava a sustentação e dava
//  sempre ~-14 m/s em voo nivelado → todo pouso era classificado "inseguro" → explosão.)
let _prevAltY = null;

// Continuidade de decolagem: momento vertical herdado da rotação, decaindo em ~1 s
// após a troca para a física AIRBORNE (elimina o "soluço" de subida no liftoff).
let _liftoffCarry = 0;
export function setLiftoffCarry(v) { _liftoffCarry = Math.max(0, v || 0); }

function clampPitchAttitude() {
  _attitudeEuler.setFromQuaternion(jet.quaternion, 'YXZ');
  _attitudeEuler.x = Math.max(PLAYER.PITCH_DOWN_LIMIT, Math.min(PLAYER.PITCH_UP_LIMIT, _attitudeEuler.x));
  jet.quaternion.setFromEuler(_attitudeEuler);
}

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
  if (mr?.enabled && sortie && GROUND_STATES.has(sortie.state)) {
    const contact = classifyGroundContact({ x: jet.position.x, y: jet.position.y, z: jet.position.z }, game.activeMap, 0);
    mr.groundContact = contact;
    mr.landingZoneStatus = contact;
    updateGroundRoll(mr.ground, input, dt, contact.type, game.player.throttle);
    if (input.throttleUp) game.player.throttle = Math.min(1, game.player.throttle + dt * PLAYER.THROTTLE_UP_RATE);
    if (input.throttleDown) game.player.throttle = Math.max(0.02, game.player.throttle - dt * PLAYER.THROTTLE_DN_RATE);
    game.player.speed = mr.ground.groundSpeed;

    // Rolagem de pouso: sem input, o throttle decai para idle suavemente (spool-down)
    // — a rolagem desacelera de forma natural em vez de corte seco no toque.
    if ((sortie.state === SortieState.LANDING_ROLL || sortie.state === SortieState.TAXI_IN) &&
        !input.throttleUp && game.player.throttle > 0.05) {
      game.player.throttle += (0.05 - game.player.throttle) * Math.min(1, dt * 1.5);
    }

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
    const movedContact = classifyGroundContact({ x: jet.position.x, y: jet.position.y, z: jet.position.z }, game.activeMap, 0);
    const movedSurface = surfaceInfoAt(jet.position.x, jet.position.z);
    const hardFloor = Math.max(movedContact.height, movedSurface.height) + 0.9;
    // Assentamento suave no solo (nunca abaixo do piso): a altura CONVERGE para o
    // piso em ~0.3 s — o toque comprime como amortecedor de trem de pouso, em vez
    // de snap instantâneo. Só quando NÃO está em rotação ativa de decolagem.
    if (!sortie.liftoffVsp || sortie.liftoffVsp <= 0) {
      const settle = 1 - Math.exp(-dt * 7);
      jet.position.y = Math.max(hardFloor, jet.position.y + (hardFloor - jet.position.y) * settle);
    }

    if (sortie.state === SortieState.TAXI_OUT && contact.type === 'runway') {
      transitionSortie(sortie, SortieEvent.TAXI_TO_RUNWAY, {}, game.time);
    }
    if (sortie.state === SortieState.TAKEOFF_ROLL && game.player.speed >= 38) {
      transitionSortie(sortie, SortieEvent.TAKEOFF_SPEED_REACHED, {}, game.time);
    }
    // Re-decolagem após pouso oportunista: throttle alto + velocidade de roll
    if (sortie.state === SortieState.LANDING_ROLL && game.player.throttle > 0.8 && game.player.speed >= 38) {
      transitionSortie(sortie, SortieEvent.TAKEOFF_SPEED_REACHED, {}, game.time);
    }
    // T-05/D-4: guided taxi arms ONLY once ground speed has decayed to the handoff
    // threshold AND the aircraft sits on pavement — never in the same frame as
    // TOUCHDOWN_SAFE (that was the "cuts across grass at landing speed" bug). Until
    // this fires the player keeps full yaw/rudder + throttle/brake authority in this
    // same ground block — that IS the roll-out phase, no separate FSM state needed.
    if (sortie.state === SortieState.LANDING_ROLL && !mr.autoTaxi.active &&
        canHandoffToGuidedTaxi(game.player.speed, movedContact.type, PLAYER.TAXI_HANDOFF_SPEED)) {
      mr.autoTaxi.active = true;
      mr.autoTaxi.phase = 'taxi_service';
      mr.autoTaxi.t = 0;
      mr.autoTaxi.wpIndex = 0;
    }
    // Smooth liftoff: V_ROTATE speed + rotation input. Applies ROTATE_LIFT force
    // gradually; no teleport. Transitions to AIRBORNE only when height > 4m above
    // ground AND vertical speed > 0.
    // ADR-U1: no solo a intenção "subir" é inequívoca — ↑ OU ↓ rotacionam.
    // FIX preso-no-chão (2026-07-02): exigir contact.type==='runway' criava um
    // estado PERMANENTE de TAKEOFF_ROLL — quem passava do fim da pista rolava
    // pelo campo para sempre, sem NUNCA poder rotacionar (nariz derrotado a 0,
    // LIFTOFF inalcançável). Rotação agora vale de qualquer solo (decolagem de
    // gramado), só não d'água.
    if (sortie.state === SortieState.TAKEOFF_ROLL &&
        contact.type !== 'water' &&
        game.player.speed >= PLAYER.V_ROTATE &&
        (input.pitchDown || input.pitchUp)) {
      if (!sortie.liftoffVsp) sortie.liftoffVsp = 0;
      _pitchQ.setFromAxisAngle(_lPitch, PLAYER.PITCH_RATE * 0.35 * dt);
      jet.quaternion.multiply(_pitchQ);
      clampPitchAttitude();
      sortie.liftoffVsp += PLAYER.ROTATE_LIFT * dt;
      jet.position.y += sortie.liftoffVsp * dt;
      // Spool suave até a velocidade de subida (45 m/s) — sem salto 32→45 num frame.
      sortie.rotateSpool = Math.min(13, (sortie.rotateSpool || 0) + 26 * dt);
      game.player.speed = Math.max(game.player.speed, Math.min(45, game.player.speed + sortie.rotateSpool));
      const altAbove = jet.position.y - contact.height;
      if (altAbove > 4 && sortie.liftoffVsp > 0) {
        // Continuidade: o vsp da rotação decai suavemente já na física AIRBORNE.
        _liftoffCarry = sortie.liftoffVsp;
        transitionSortie(sortie, SortieEvent.LIFTOFF, {}, game.time);
        // Zera o estado de decolagem para a próxima surtida sair limpa (evita
        // liftoffVsp residual pular o snap-ao-chão do próximo taxiamento).
        sortie.liftoffVsp = 0;
        sortie.rotateSpool = 0;
        sortie._autoSpeedFlagged = false;
      }
    }
    // Per-frame floor clamp: never let the jet go underground while in ground states
    // or when sitting on an airport surface.
    const floorClampHeight = hardFloor;
    if (GROUND_STATES.has(sortie.state) || airportSurface({ x: jet.position.x, z: jet.position.z }, game.activeMap) !== 'none') {
      jet.position.y = Math.max(jet.position.y, floorClampHeight);
    } else {
      // Still clamp to runway height if we're just barely off the ground during liftoff rotation
      jet.position.y = Math.max(jet.position.y, contact.height + 0.9);
    }
    // Derrotação graciosa: no solo sem input de pitch, nariz e asas nivelam
    // suavemente (pós-toque/pós-flare), em vez de congelar a atitude do pouso.
    if (!input.pitchUp && !input.pitchDown) {
      _attitudeEuler.setFromQuaternion(jet.quaternion, 'YXZ');
      if (Math.abs(_attitudeEuler.x) > 0.002 || Math.abs(_attitudeEuler.z) > 0.002) {
        const decay = Math.max(0, 1 - 2.6 * dt);
        _attitudeEuler.x *= decay;
        _attitudeEuler.z *= decay;
        jet.quaternion.setFromEuler(_attitudeEuler);
      }
    }

    if ((sortie.state === SortieState.LANDING_ROLL || sortie.state === SortieState.TAXI_IN) && movedContact.type === 'service' && game.player.speed < 10) {
      transitionSortie(sortie, SortieEvent.SERVICE_ZONE_REACHED, {}, game.time);
    }

    updateGearVisual(true, dt);
    // Rumble + poeira de roda na corrida de decolagem (T-U-10)
    if (sortie.state === SortieState.TAKEOFF_ROLL && game.player.speed > 15) {
      game.flags.cameraShake = { intensity: Math.min(0.55, game.player.speed / 110), duration: 0.08 };
      jet.userData._dustT = (jet.userData._dustT || 0) - dt;
      if (jet.userData._dustT <= 0) {
        jet.userData._dustT = 0.14;
        firePosition(_maydayPos, -2.6);
        _maydayPos.y = contact.height + 0.4;
        spawnMissileSmoke(_maydayPos);
      }
    }

    game.player.x = jet.position.x;
    game.player.y = jet.position.y;
    game.player.pz = jet.position.z;
    game.player.pitch = jet.rotation.x;
    // T-08 follow-up: this ground block (roll-out/taxi-out/takeoff-roll) used to
    // return before ever reaching the AIRBORNE branch's audio.setEngineRPM call, so
    // the turbine never spooled on the ground — a silent gap through the whole
    // roll-out/rotation. Now every ground frame updates it too.
    audio.setEngineRPM(game.player.speed, game.player.throttle);
    return;
  }

  // Afundando (WS-5): impacto na água — nariz mergulha, avião some sob a superfície
  if (game.flags.sinking > 0) {
    game.flags.sinking -= dt;
    game.player.speed = Math.max(0, game.player.speed - 28 * dt);
    const fwdW = _v1.set(0, 0, -1).applyQuaternion(jet.quaternion);
    jet.position.addScaledVector(fwdW, game.player.speed * dt * 0.35);
    jet.position.y = Math.max(jet.position.y - 1.1 * dt, -3.4);
    jet.rotateX(0.10 * dt); // nariz afundando primeiro
    if (Math.random() < 0.25) {
      firePosition(_maydayPos, -1.5);
      _maydayPos.y = 0.7;
      spawnMissileSmoke(_maydayPos); // vapor/spray na superfície
    }
    if (game.flags.sinking <= 0) jet.visible = false;
    game.player.x = jet.position.x;
    game.player.y = jet.position.y;
    game.player.pz = jet.position.z;
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
    // Sem tunneling: ao alcançar o chão antes dos 2 s mínimos de queda (T-BF04),
    // o avião DESLIZA em chamas na superfície até o timer liberar a explosão.
    const _maydaySurf = surfaceInfoAt(jet.position.x, jet.position.z);
    let _maydayGrounded = false;
    if (jet.position.y <= _maydaySurf.height + 0.6) {
      jet.position.y = _maydaySurf.height + 0.6;
      _maydayGrounded = true;
      game.player.speed = Math.max(6, game.player.speed - 35 * dt); // atrito do skid
    }
    game.player.y = jet.position.y;
    // Impacto no solo — mega explosão e então ejeção/respawn.
    // Mínimo de 2 s de queda visível antes de disparar o crash (T-BF04).
    // jet.visible permanece true durante toda a queda; ocultado dentro de _ejectAndRespawn.
    game.flags.maydayTimer = (game.flags.maydayTimer || 0) + dt;
    const impact = checkTerrainCollision(jet.position) || _maydayGrounded;
    if (impact && game.flags.maydayTimer >= 2.0) {
      megaExplosion(jet.position.clone(), 'crash');
      const _scPos = jet.position.clone(); _scPos.y = _maydaySurf.height;
      spawnScorchMark(_scPos, 13);
      _ejectAndRespawn(onCrash);
    }
    return;
  }

  // CONTRATO: writer de game.player.throttle / speed / stalled — atualizados PRIMEIRO
  if (input.throttleUp)   game.player.throttle = Math.min(1.0, game.player.throttle + dt * PLAYER.THROTTLE_UP_RATE);
  if (input.throttleDown) game.player.throttle = Math.max(0.05, game.player.throttle - dt * PLAYER.THROTTLE_DN_RATE);

  // WS-3: MODELO DE ENERGIA — subir drena velocidade, mergulhar devolve;
  // empuxo cai acima do teto prático; stall derruba o nariz e amolece comandos.
  const fwdPre = _v1.set(0, 0, -1).applyQuaternion(jet.quaternion);
  let tgtSpd = PLAYER.MIN_SPD + game.player.throttle * (PLAYER.MAX_SPD - PLAYER.MIN_SPD);
  // Só cobra energia quando a subida é muito íngreme. Antes qualquer nariz
  // positivo drenava velocidade, deixando o avião ruim de subir em qualquer altitude.
  tgtSpd -= Math.max(0, fwdPre.y - 0.18) * PLAYER.CLIMB_TRADE;
  if (jet.position.y > PLAYER.CEILING) {
    tgtSpd *= Math.max(0.35, 1 - (jet.position.y - PLAYER.CEILING) / 2500);
  }
  tgtSpd = Math.min(tgtSpd, PLAYER.MAX_SPD * PLAYER.DIVE_OVERSPEED);
  game.player.speed += (tgtSpd - game.player.speed) * Math.min(1, dt * PLAYER.CONVERGE_RATE);
  game.player.speed = Math.max(2, game.player.speed);
  game.player.stalled = game.player.speed < PLAYER.STALL_SPD;

  // Stall: nariz cai sozinho até o mergulho devolver velocidade
  const ctl = game.player.stalled ? PLAYER.STALL_CTL : 1;
  if (game.player.stalled) {
    _pitchQ.setFromAxisAngle(_lPitch, -PLAYER.STALL_NOSE_DROP * dt);
    jet.quaternion.multiply(_pitchQ);
    clampPitchAttitude();
  }

  // Pitch INVERTIDO (estilo simulador)
  if (input.pitchUp)   { _pitchQ.setFromAxisAngle(_lPitch, -PLAYER.PITCH_RATE * ctl * dt); jet.quaternion.multiply(_pitchQ); }
  if (input.pitchDown) { _pitchQ.setFromAxisAngle(_lPitch,  PLAYER.PITCH_RATE * ctl * dt); jet.quaternion.multiply(_pitchQ); }
  if (input.pitchUp || input.pitchDown) clampPitchAttitude();

  // Auto-trim (WS-3): sem input de pitch, a atitude decai suavemente para nivelado —
  // elimina o "sobe para sempre" de atitude residual.
  if (!input.pitchUp && !input.pitchDown && !game.player.stalled && game.flags.rollTimer <= 0) {
    _attitudeEuler.setFromQuaternion(jet.quaternion, 'YXZ');
    if (Math.abs(_attitudeEuler.x) > 0.005) {
      _attitudeEuler.x *= Math.max(0, 1 - PLAYER.TRIM_RATE * dt);
      jet.quaternion.setFromEuler(_attitudeEuler);
    }
  }

  // Roll + yaw coordenado
  if (input.rollLeft) {
    _rollQ.setFromAxisAngle(_lRoll, PLAYER.ROLL_RATE * ctl * dt);  jet.quaternion.multiply(_rollQ);
    _yawQ.setFromAxisAngle(_worldUp, PLAYER.YAW_RATE * ctl * dt);  jet.quaternion.premultiply(_yawQ);
  }
  if (input.rollRight) {
    _rollQ.setFromAxisAngle(_lRoll, -PLAYER.ROLL_RATE * ctl * dt); jet.quaternion.multiply(_rollQ);
    _yawQ.setFromAxisAngle(_worldUp, -PLAYER.YAW_RATE * ctl * dt); jet.quaternion.premultiply(_yawQ);
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
    // Sustentação base + componente de climb: nariz para cima deve realmente subir,
    // sem precisar "roubar" velocidade em qualquer altitude.
    jet.position.y += PLAYER.GRAVITY * liftFactor * dt;
    jet.position.y += Math.max(0, fwd.y) * game.player.speed * 0.42 * dt;
  }
  // Continuidade de decolagem: o momento vertical da rotação decai em ~1 s em vez
  // de sumir no frame da transição TAKEOFF_ROLL → AIRBORNE (subida sem soluço).
  if (_liftoffCarry > 0.01) {
    jet.position.y += _liftoffCarry * dt;
    _liftoffCarry = Math.max(0, _liftoffCarry - 11 * dt);
  }

  // Crash
  const crash = checkTerrainCollision(jet.position);
  if (crash) {
    if (mr?.enabled && crash === 'MOUNTAIN') {
      transitionSortie(mr.sortie, SortieEvent.MOUNTAIN_CONTACT, {}, game.time);
      game.flags.mayday = true;
      game.flags.maydayTimer = 0;
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

  // Trem de pouso: estende abaixo de 16 m sobre a superfície local (WS-4)
  const _gearSurf = surfaceInfoAt(jet.position.x, jet.position.z);
  updateGearVisual(jet.position.y - _gearSurf.height < 16, dt);

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

  // CONTRATO: writer de game.player.x/y/pitch/pz — escritos POR ÚLTIMO (após movimento do frame)
  // Intencional: refletem posição final do frame; HUD e tests sempre lêem valor corrente.
  game.player.x = jet.position.x;
  game.player.y = jet.position.y;
  game.player.pz = jet.position.z;
  game.player.pitch = jet.rotation.x;
  if (mr?.enabled) {
    const contact = classifyGroundContact({ x: jet.position.x, y: jet.position.y, z: jet.position.z }, game.activeMap, 0);
    const altitudeAboveGround = jet.position.y - contact.height;
    // Velocidade vertical REAL = variação de altura por segundo (não a fórmula antiga
    // que ignorava sustentação). Negativo = descendo; positivo = subindo.
    const hadPrev = _prevAltY !== null;
    const realVsp = (hadPrev && dt > 0) ? (jet.position.y - _prevAltY) / dt : 0;
    _prevAltY = jet.position.y;
    syncFlightGroundDiagnostics(mr.ground, {
      speed: game.player.speed,
      throttle: game.player.throttle,
      pitch: jet.rotation.x,
      roll: jet.rotation.z,
      verticalSpeed: realVsp,
      surface: contact.type,
      contact,
      altitudeAboveGround,
    });
    mr.groundContact = contact;
    mr.landingZoneStatus = contact;
    // MÁQUINA DE CONTATO — pouso na pista é SEMPRE seguro (jogo para criança).
    // Tocar QUALQUER pavimento (runway/taxiway/service) descendo em velocidade de pouso
    // dentro da janela de toque é um pouso bem-sucedido: snap suave + corta throttle, sem
    // dano. Um mergulho a toda velocidade (≳ LAND_MAX_SPD) sobre a pista NÃO é pouso — o
    // avião passa reto. Só uma queda catastrófica (invertido e despencando) também não conta.
    const onPavement = contact.type === 'runway' || contact.type === 'taxiway' || contact.type === 'service';
    // Só estados DE VOO tentam touchdown — sem isto, o gatilho de contato
    // assentado (abaixo) dispararia durante TAKEOFF_ROLL/TAXI e o auto-taxi
    // sequestraria a decolagem.
    const inFlightState = mr.sortie.state === SortieState.AIRBORNE ||
      mr.sortie.state === SortieState.MISSION_ACTIVE ||
      mr.sortie.state === SortieState.RETURN_TO_BASE;
    if (onPavement && inFlightState && altitudeAboveGround < PLAYER.FLARE_HI) {
      const lastTD = mr.sortie.lastTouchdownTime ?? -Infinity;
      const debounceOk = (game.time - lastTD) > PLAYER.TOUCHDOWN_DEBOUNCE;
      // FIX pouso-negado (2026-07-01): exigir vsp<-0.5 criava DEADLOCK — o clamp
      // anti-atravessar (abaixo) segura o avião a 0.9 u do pavimento, o vsp vira ~0
      // e 'descending' nunca mais disparava: o avião deslizava pela pista inteira
      // proibido de pousar (idem chegando rápido demais: ao desacelerar, vsp já era
      // 0). Avião JÁ ASSENTADO na janela de toque É toque.
      const settled = altitudeAboveGround < 1.05;
      const descending = (hadPrev && realVsp < -0.5) || settled;
      const landingSpeed = game.player.speed <= PLAYER.LAND_MAX_SPD; // não "pousa" num mergulho a 80 m/s
      const bossBlocking = game.flags.bossActive === true; // monstro vivo trava o pouso
      const catastrophic = Math.abs(jet.rotation.z) > 1.4 || realVsp < PLAYER.SINK_HARD;
      if (altitudeAboveGround < PLAYER.FLARE_LO && descending && landingSpeed && !bossBlocking && debounceOk && !catastrophic) {
        // Touchdown suave: a altura ASSENTA nos próximos frames (ground settle) e o
        // throttle decai para idle na rolagem — sem snap de altura nem corte seco.
        mr.ground.groundSpeed = game.player.speed;
        _liftoffCarry = 0;
        mr.sortie.lastTouchdownTime = game.time;
        for (let i = 0; i < 4; i++) {
          firePosition(_maydayPos, 1.2 - i * 0.8);
          _maydayPos.y = contact.height + 0.4;
          spawnMissileSmoke(_maydayPos);
        }
        transitionSortie(mr.sortie, SortieEvent.TOUCHDOWN_SAFE, {}, game.time);
        // T-05/D-4 (root-cause fix — the operator's #1 complaint): touchdown no
        // longer arms auto-taxi in the SAME frame. The plane is still doing landing
        // speed here; instantly cutting to auto-taxi's waypoint-seeking drove it off
        // the runway axis toward the service zone at full speed ("cuts across
        // grass"). Instead the sortie stays LANDING_ROLL and this ground block's
        // handoff check (above, guarded by canHandoffToGuidedTaxi) arms auto-taxi
        // once ground speed has actually decayed to TAXI_HANDOFF_SPEED on pavement —
        // the player keeps yaw/rudder + brake control for the roll-out in between.
      } else if (altitudeAboveGround < 0) {
        // Nunca atravessar o pavimento (mantém o avião sobre a pista).
        jet.position.y = contact.height + 0.9;
        game.player.y = jet.position.y;
      }
    }
    const localSurface = surfaceInfoAt(jet.position.x, jet.position.z);
    if (!onPavement && altitudeAboveGround < 0 && jet.position.y < localSurface.height + 0.9) {
      // Última defesa contra tunneling em frame longo: o avião nunca atravessa
      // chão, morro ou construção. Se bateu forte, vira crash; se só raspou,
      // fica apoiado na superfície.
      jet.position.y = localSurface.height + 0.9;
      game.player.y = jet.position.y;
      if (localSurface.kind === 'structure' || realVsp < PLAYER.SINK_MAX) onCrash('GROUND');
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
  game.flags.invincibility = 3.0;
  game.flags.shakeTime = 0;
  respawnAndRelaunch();
  audio.explosion(0.5);
}

// Recoloca o avião no aeroporto E rearma a decolagem automática. Chamado ao voltar
// à base depois de um mayday (crash no solo OU ejeção manual). Sem isto, o avião
// reaparecia no aeroporto mas a máquina de surtida ficava presa fora de um estado de
// solo e o auto-taxi nunca era armado — o avião não decolava mais ("bug do avião
// parado no aeroporto"). Aqui: respawn na zona de serviço → reset da surtida para
// TAXI_OUT → auto-taxi na fase 'taxi_runway' (taxia até a pista e decola sozinho).
export function respawnAndRelaunch() {
  respawnJet();
  const mr = game.missionRealism;
  if (!mr?.enabled || !mr.sortie) return;
  relaunchSortie(mr.sortie, game.time);
  game.player.hp = 3;
  game.player.missiles = 100;
  game.player.heavyMissiles = 10;
  game.player.nuclearMissiles = 3;
  game.flags.mayday = false;
  game.flags.maydayTimer = 0;
  if (mr.autoTaxi) { mr.autoTaxi.active = true; mr.autoTaxi.phase = 'taxi_runway'; mr.autoTaxi.t = 0; }
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
    game.flags.maydayTimer = 0;
    if (game.missionRealism?.enabled) transitionSortie(game.missionRealism.sortie, SortieEvent.CRITICAL_DAMAGE, {}, game.time);
    game.flags.invincibility = 0;
    explosion(jet.position.clone(), 1.6, COLORS.playerHitOrange);
    audio.mayday();
  }
}

/** Reseta o avião para o estado inicial (chamado por restartGame). */
export function respawnJet() {
  if (game.missionRealism?.enabled) {
    const airport = getAirportForMap(game.activeMap);
    jet.position.set(airport.serviceZone.center.x, airport.elevation + 0.9, airport.serviceZone.center.z);
    // Zera o estado de decolagem/surtida ao renascer (restart ou pós-mayday) —
    // senão liftoffVsp/_autoSpeedFlagged residuais bagunçam a próxima decolagem.
    const sortie = game.missionRealism.sortie;
    if (sortie) { sortie.liftoffVsp = 0; sortie._autoSpeedFlagged = false; }
  } else {
    jet.position.set(0, PLAYER.START_HEIGHT, 0);
  }
  jet.quaternion.set(0, 0, 0, 1);
  jet.visible = true;
  _prevAltY = null; // zera o histórico de velocidade vertical (evita pouso/crash falso)
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
