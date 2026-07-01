// auto-taxi.js — Loop de solo automático.
// Depois que o jogador POUSA, o avião é taxiado, reabastecido e recolocado para
// decolagem AUTOMATICAMENTE — o jogador não taxia na mão. O fluxo:
//   pouso → taxi até a área de serviço → reabastecimento → taxi até a cabeceira
//   → decolagem automática → próxima surtida.
// Exporta: armAutoTaxi, updateAutoTaxi, isAutoTaxiActive, cancelAutoTaxi.

import * as THREE from '../../vendor/three.module.min.js';
import { game } from './state.js';
import { jet, setLiftoffCarry } from './player.js';
import { getAirportForMap } from './airport.js';
import { SortieEvent, SortieState, transitionSortie } from './sortie-state.js';
import { spawnMission } from './missions.js';

const TAXI_SPEED = 34;      // m/s — velocidade de taxiamento
const TAKEOFF_SPEED = 56;   // m/s — velocidade na qual decola
const TAXI_TURN_RATE = 1.5; // rad/s — giro máximo do nariz no taxi
const TAXI_ACCEL = 8;       // m/s² — aceleração limitada no taxi
const TAXI_BRAKE = 12;      // m/s² — frenagem limitada (rolagem pós-pouso 62→34 sem degrau)

function _wrapAngle(a) {
  return ((a + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
}

function _state() { return game.missionRealism.autoTaxi; }

/** Arma o loop automático no momento do toque (chamado pela máquina de contato). */
export function armAutoTaxi() {
  const a = _state();
  a.active = true;
  a.phase = 'taxi_service';
  a.t = 0;
}

export function cancelAutoTaxi() {
  const a = _state();
  a.active = false;
  a.phase = 'idle';
}

export function isAutoTaxiActive() {
  return game.missionRealism?.enabled === true && _state().active === true;
}

function _airport() { return getAirportForMap(game.activeMap); }

/** Move o avião em direção a (tx,tz) no nível do pavimento. Devolve a distância restante.
 *  Suavizado: aceleração/frenagem limitadas (sem degrau de velocidade no pós-pouso),
 *  giro do nariz com taxa máxima, e o avião anda AO LONGO DO NARIZ — faz a curva
 *  como um veículo em vez de deslizar de lado até o waypoint. */
function _driveTo(tx, tz, dt, speed) {
  const ap = _airport();
  const dx = tx - jet.position.x;
  const dz = tz - jet.position.z;
  const dist = Math.hypot(dx, dz);
  // Desacelera perto do alvo para parar suave; delta de velocidade limitado por frame.
  const vTarget = dist > 0.5 ? Math.min(speed, Math.max(6, dist * 1.2)) : 0;
  const cur = game.player.speed || 0;
  const delta = vTarget - cur;
  const maxDelta = (delta > 0 ? TAXI_ACCEL : TAXI_BRAKE) * dt;
  const v = cur + Math.max(-maxDelta, Math.min(maxDelta, delta));
  if (dist > 0.5) {
    const ux = dx / dist, uz = dz / dist;
    // O nariz do jato é o eixo -Z local. Para apontá-lo ao destino:
    // forward = (-sinθ,0,-cosθ) = (ux,uz) → θ = atan2(-ux, -uz).
    const targetYaw = Math.atan2(-ux, -uz);
    const yawErr = _wrapAngle(targetYaw - jet.rotation.y);
    const maxTurn = TAXI_TURN_RATE * dt;
    const newYaw = jet.rotation.y + Math.max(-maxTurn, Math.min(maxTurn, yawErr));
    // Pitch/roll residuais do pouso decaem suavemente (derrotação no taxi).
    const att = Math.max(0, 1 - 2.6 * dt);
    jet.rotation.set(jet.rotation.x * att, newYaw, jet.rotation.z * att);
    const step = Math.min(dist, v * dt);
    jet.position.x += -Math.sin(newYaw) * step;
    jet.position.z += -Math.cos(newYaw) * step;
  }
  jet.position.y = ap.elevation + 0.9;
  game.player.speed = dist > 1 ? v : 0;
  game.missionRealism.ground.groundSpeed = game.player.speed;
  return dist;
}

function _mirror() {
  game.player.x = jet.position.x;
  game.player.y = jet.position.y;
  game.player.pz = jet.position.z;
  game.player.pitch = jet.rotation.x;
}

/** Avança o loop automático um frame. Só roda quando isAutoTaxiActive() e fora de serviço. */
export function updateAutoTaxi(dt) {
  const a = _state();
  const mr = game.missionRealism;
  const sortie = mr.sortie;
  const ap = _airport();
  a.t += dt;

  if (a.phase === 'taxi_service') {
    const s = ap.serviceZone;
    const dist = _driveTo(s.center.x, s.center.z, dt, TAXI_SPEED);
    // Avança a máquina de estado até a cena de serviço ao chegar na área.
    if (dist < 10) {
      if (sortie.state === SortieState.LANDING_ROLL) {
        transitionSortie(sortie, SortieEvent.SERVICE_ZONE_REACHED, {}, game.time); // → TAXI_IN
      }
      if (sortie.state === SortieState.TAXI_IN) {
        transitionSortie(sortie, SortieEvent.SERVICE_ZONE_REACHED, {}, game.time); // → SERVICE_SCENE
      }
      if (sortie.state === SortieState.SERVICE_SCENE) {
        a.phase = 'await_service';
      }
    }
    _mirror();
    return;
  }

  if (a.phase === 'await_service') {
    // O serviço (reabastecimento) roda no main.js enquanto estado == SERVICE_SCENE.
    // Quando termina, o estado vira NEXT_SORTIE_READY — então iniciamos a próxima surtida.
    game.player.speed = 0;
    if (sortie.state === SortieState.NEXT_SORTIE_READY) {
      const completed = game.targetsTotal > 0 && game.targetsDestroyed >= game.targetsTotal;
      transitionSortie(sortie, SortieEvent.NEXT_SORTIE, {}, game.time); // → TAXI_OUT
      game.flags.missionCompleteShown = false;
      mr.service.phase = 'idle';
      mr.service.active = false;
      if (completed) {
        game.cycle += 1;
        spawnMission(game.cycle);
      }
      a.phase = 'taxi_runway';
    }
    _mirror();
    return;
  }

  if (a.phase === 'taxi_runway') {
    // Cabeceira: ponta da pista oposta ao sentido de decolagem (rola no sentido -Z).
    const r = ap.runway;
    const tx = r.center.x;
    const tz = r.center.z + r.length / 2 - 40;
    const dist = _driveTo(tx, tz, dt, TAXI_SPEED);
    if (dist < 6) {
      a.phase = 'line_up';
      a.t = 0;
    }
    _mirror();
    return;
  }

  if (a.phase === 'line_up') {
    // Alinhamento suave com o eixo da pista: pivô no ponto até heading 0 e
    // centraliza no eixo — sem teleporte de rotação/posição.
    const r = ap.runway;
    const yawErr = _wrapAngle(0 - jet.rotation.y);
    const maxTurn = 1.2 * dt;
    const newYaw = jet.rotation.y + Math.max(-maxTurn, Math.min(maxTurn, yawErr));
    const att = Math.max(0, 1 - 2.6 * dt);
    jet.rotation.set(jet.rotation.x * att, newYaw, jet.rotation.z * att);
    jet.position.x += (r.center.x - jet.position.x) * Math.min(1, dt * 1.8);
    jet.position.y = ap.elevation + 0.9;
    game.player.speed = 0;
    mr.ground.groundSpeed = 0;
    if (Math.abs(_wrapAngle(newYaw)) < 0.02 && Math.abs(r.center.x - jet.position.x) < 0.5) {
      jet.rotation.set(0, 0, 0);
      jet.position.x = r.center.x;
      // Limpa estado residual da surtida anterior para a 2ª/3ª decolagem sair limpa.
      sortie._autoSpeedFlagged = false;
      sortie.liftoffVsp = 0;
      sortie.rotateSpool = 0;
      if (sortie.state === SortieState.TAXI_OUT) {
        transitionSortie(sortie, SortieEvent.TAXI_TO_RUNWAY, {}, game.time); // → TAKEOFF_ROLL
      }
      a.phase = 'takeoff';
      a.t = 0;
      a.vsp = 0;
    }
    _mirror();
    return;
  }

  if (a.phase === 'takeoff') {
    // Acelera na pista e levanta voo automaticamente (throttle spool, sem snap).
    game.player.throttle = Math.min(1, (game.player.throttle || 0.05) + dt * 1.4);
    const accel = 26;
    game.player.speed = Math.min(TAKEOFF_SPEED + 6, game.player.speed + accel * dt);
    mr.ground.groundSpeed = game.player.speed;
    const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(jet.quaternion);
    jet.position.addScaledVector(fwd, game.player.speed * dt);

    if (sortie.state === SortieState.TAKEOFF_ROLL && game.player.speed >= 38 && !sortie._autoSpeedFlagged) {
      sortie._autoSpeedFlagged = true;
      transitionSortie(sortie, SortieEvent.TAKEOFF_SPEED_REACHED, {}, game.time);
    }

    if (game.player.speed >= TAKEOFF_SPEED) {
      // Rotaciona o nariz e sobe — vsp cresce gradualmente (sem degrau 0→22)
      if (jet.rotation.x > -0.18) jet.rotateX(-0.5 * dt);
      a.vsp = Math.min(22, (a.vsp || 0) + 16 * dt);
      jet.position.y += a.vsp * dt;
    } else {
      a.vsp = 0;
      jet.position.y = ap.elevation + 0.9;
    }

    const altAbove = jet.position.y - ap.elevation;
    if (altAbove > 8) {
      setLiftoffCarry(a.vsp); // continuidade da subida na troca para a física normal
      transitionSortie(sortie, SortieEvent.LIFTOFF, {}, game.time); // → AIRBORNE
      sortie._autoSpeedFlagged = false;
      sortie.liftoffVsp = 0;
      sortie.rotateSpool = 0;
      cancelAutoTaxi();
    }
    _mirror();
    return;
  }
}
