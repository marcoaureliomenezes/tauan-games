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
import { explosion } from './fx.js';
import { checkTerrainCollision } from './world.js';

// ─── Mesh do F-35 ────────────────────────────────────────────────────────────
function buildJet() {
  const g = new THREE.Group();
  // PBR (MeshStandardMaterial) para o corpo — responde a luz, projeta sombra
  const grey      = new THREE.MeshStandardMaterial({ color: COLORS.jetGrey, metalness: 0.6, roughness: 0.45 });
  const darkGrey  = new THREE.MeshStandardMaterial({ color: COLORS.jetDark, metalness: 0.7, roughness: 0.4 });
  const panel     = new THREE.MeshStandardMaterial({ color: COLORS.jetPanel, metalness: 0.5, roughness: 0.55 });
  const canopy    = new THREE.MeshStandardMaterial({ color: COLORS.jetCanopy, metalness: 0.2, roughness: 0.15 });
  // Vidro do canopy: ainda translúcido (Basic + opacidade)
  const canopyR   = new THREE.MeshBasicMaterial({ color: COLORS.jetCanopyGlass, transparent: true, opacity: 0.85 });
  // Materiais emissivos do exhaust permanecem Basic (não respondem a luz)
  const exhaustO  = new THREE.MeshBasicMaterial({ color: COLORS.exhaustOrange, transparent: true, opacity: 0.9 });
  const flameY    = new THREE.MeshBasicMaterial({ color: COLORS.flameYellow, transparent: true, opacity: 0.95 });
  // Asas com DoubleSide (BufferGeometry trapezoidal espelha normal por sinal)
  const wingMat   = new THREE.MeshStandardMaterial({ color: COLORS.jetGrey, metalness: 0.6, roughness: 0.45, side: THREE.DoubleSide });
  const wingDark  = new THREE.MeshStandardMaterial({ color: COLORS.jetDark, metalness: 0.7, roughness: 0.4, side: THREE.DoubleSide });

  // Nariz facetado
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.34, 1.4, 5), grey);
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
  const exhRing = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.30, 0.45, 12), darkGrey);
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
  return g;
}

export const jet = buildJet();
jet.position.set(0, PLAYER.START_HEIGHT, 0);
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
  if (crash) { onCrash(crash); return; }

  audio.setEngineRPM(game.player.speed, game.player.throttle);

  // Afterburner: glow + flame escalam com throttle (0.6x parado, 1.6x full)
  const burn = 0.55 + game.player.throttle * 1.05;
  if (jet.userData.exhGlow)  jet.userData.exhGlow.scale.set(burn, burn, burn);
  if (jet.userData.exhFlame) jet.userData.exhFlame.scale.set(burn, burn, burn * (0.9 + Math.random() * 0.2));

  // CONTRATO: writer de game.player.x/y/pitch — escritos POR ÚLTIMO (após movimento do frame)
  // Intencional: refletem posição final do frame; HUD e tests sempre lêem valor corrente.
  game.player.x = jet.position.x;
  game.player.y = jet.position.y;
  game.player.pitch = jet.rotation.x;
}

/** Aplica dano (perde 1 vida + invencibilidade temporária). */
export function playerHit() {
  if (game.flags.invincibility > 0 || game.flags.rollTimer > 0) return;
  // CONTRATO: writer de game.player.lives
  game.player.lives -= 1;
  game.flags.invincibility = 1.8;
  game.flags.shakeTime = 0.35;
  explosion(jet.position.clone(), 0.7, COLORS.playerHitOrange);
  audio.explosion(0.4);
}

/** Reseta o avião para o estado inicial (chamado por restartGame). */
export function respawnJet() {
  jet.position.set(0, PLAYER.START_HEIGHT, 0);
  jet.quaternion.set(0, 0, 0, 1);
  jet.visible = true;
  game.player.speed = 25;
  game.player.throttle = 0.5;
  game.player.stalled = false;
}

/** Vetor "forward" do jato + posição do bico (para spawnar projéteis). */
export function firePosition(out, offset = 2.0) {
  const fwd = _v1.set(0, 0, -1).applyQuaternion(jet.quaternion);
  out.copy(jet.position).addScaledVector(fwd, offset);
  return fwd;
}
