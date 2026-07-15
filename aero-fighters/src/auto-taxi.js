// auto-taxi.js — Loop de solo automático.
// Depois que o jogador POUSA, o avião é taxiado, reabastecido e recolocado para
// decolagem AUTOMATICAMENTE — o jogador não taxia na mão. O fluxo:
//   pouso → taxi até a área de serviço → reabastecimento → taxi até a cabeceira
//   → decolagem automática → próxima surtida.
// Exporta: armAutoTaxi, updateAutoTaxi, isAutoTaxiActive, cancelAutoTaxi.

import * as THREE from '../../vendor/three.module.min.js';
import { game } from './state.js';
import { audio } from './audio.js';
import { jet, setLiftoffCarry } from './player.js';
import { getAirportForMap } from './airport.js';
import { PLAYER } from './config.js';
import { SortieEvent, SortieState, transitionSortie } from './sortie-state.js';
import { spawnMission } from './missions.js';
import { advancePathIndex, buildTaxiPathIn, stepTowardWaypoint, wrapAngle } from './taxi-core.js';

// T-05/D-4: TAXI_SPEED now mirrors PLAYER.TAXI_HANDOFF_SPEED (single source of
// truth) — guided taxi cruises at exactly the speed roll-out hands off at, so there
// is no speed-snap the instant auto-taxi arms.
const TAXI_SPEED = PLAYER.TAXI_HANDOFF_SPEED; // m/s — velocidade de taxiamento
const TAKEOFF_SPEED = 56;   // m/s — velocidade na qual decola
const TAXI_TURN_RATE = 1.5; // rad/s — giro máximo do nariz no taxi
const TAXI_ACCEL = 8;       // m/s² — aceleração limitada no taxi
const TAXI_BRAKE = 12;      // m/s² — frenagem limitada (rolagem pós-pouso 62→34 sem degrau)

function _state() { return game.missionRealism.autoTaxi; }

/** Arma o loop automático — chamado SOMENTE após o roll-out (player.js's ground
 *  block) confirmar `canHandoffToGuidedTaxi` (T-05/D-4): groundSpeed já decaiu ao
 *  handoff E o avião está sobre pavimento. Nunca mais no mesmo frame do toque. */
export function armAutoTaxi() {
  const a = _state();
  a.active = true;
  a.phase = 'taxi_service';
  a.t = 0;
  a.wpIndex = 0;
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
 *  como um veículo em vez de deslizar de lado até o waypoint.
 *  T-05: a cinemática em si foi extraída para `taxi-core.js#stepTowardWaypoint`
 *  (pura, testável em Node); esta função só traduz de/para o mesh THREE + game.player. */
function _driveTo(tx, tz, dt, speed) {
  const ap = _airport();
  const step = stepTowardWaypoint(
    { x: jet.position.x, z: jet.position.z, yaw: jet.rotation.y, speed: game.player.speed || 0 },
    { x: tx, z: tz },
    dt,
    { maxSpeed: speed, accel: TAXI_ACCEL, brake: TAXI_BRAKE, turnRate: TAXI_TURN_RATE, arriveRadius: 0.5 },
  );
  if (!step.arrived) {
    // Pitch/roll residuais do pouso decaem suavemente (derrotação no taxi).
    const att = Math.max(0, 1 - 2.6 * dt);
    jet.rotation.set(jet.rotation.x * att, step.yaw, jet.rotation.z * att);
  }
  jet.position.x = step.x;
  jet.position.z = step.z;
  jet.position.y = ap.elevation + 0.9;
  game.player.speed = step.speed;
  game.missionRealism.ground.groundSpeed = game.player.speed;
  return step.distance;
}

function _mirror() {
  game.player.x = jet.position.x;
  game.player.y = jet.position.y;
  game.player.pz = jet.position.z;
  game.player.pitch = jet.rotation.x;
  // T-08 follow-up: ground/roll-out/taxi/takeoff paths never reached
  // audio.setEngineRPM before (only the AIRBORNE branch of player.js did) — the
  // turbine now spools correctly through the whole guided-taxi/takeoff sequence too.
  audio.setEngineRPM(game.player.speed, game.player.throttle);
}

/** Avança o loop automático um frame. Só roda quando isAutoTaxiActive() e fora de serviço. */
export function updateAutoTaxi(dt) {
  const a = _state();
  const mr = game.missionRealism;
  const sortie = mr.sortie;
  const ap = _airport();
  a.t += dt;

  if (a.phase === 'taxi_service') {
    // T-05/D-4: follows an ORDERED waypoint path along the airport's own pavement
    // centerlines — runway (handoff point) → taxiway → apron — instead of a single
    // direct point straight at the service zone. `taxi-core.js#buildTaxiPathIn`
    // returns the waypoints; `a.wpIndex` (reset by armAutoTaxi) tracks progress so
    // the path never corner-cuts off pavement (validated by the taxi-containment sim).
    const path = buildTaxiPathIn(ap);
    if (a.wpIndex === undefined) a.wpIndex = 0;
    const target = path[a.wpIndex];
    const dist = _driveTo(target.x, target.z, dt, TAXI_SPEED);
    a.wpIndex = advancePathIndex(a.wpIndex, dist, path, 10);
    // Avança a máquina de estado só ao chegar no waypoint FINAL (apron/service).
    if (a.wpIndex === path.length - 1 && dist < 10) {
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
    const yawErr = wrapAngle(0 - jet.rotation.y);
    const maxTurn = 1.2 * dt;
    const newYaw = jet.rotation.y + Math.max(-maxTurn, Math.min(maxTurn, yawErr));
    const att = Math.max(0, 1 - 2.6 * dt);
    jet.rotation.set(jet.rotation.x * att, newYaw, jet.rotation.z * att);
    jet.position.x += (r.center.x - jet.position.x) * Math.min(1, dt * 1.8);
    jet.position.y = ap.elevation + 0.9;
    game.player.speed = 0;
    mr.ground.groundSpeed = 0;
    if (Math.abs(wrapAngle(newYaw)) < 0.02 && Math.abs(r.center.x - jet.position.x) < 0.5) {
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
