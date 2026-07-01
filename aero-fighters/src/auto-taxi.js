// auto-taxi.js — Loop de solo automático.
// Depois que o jogador POUSA, o avião é taxiado, reabastecido e recolocado para
// decolagem AUTOMATICAMENTE — o jogador não taxia na mão. O fluxo:
//   pouso → taxi até a área de serviço → reabastecimento → taxi até a cabeceira
//   → decolagem automática → próxima surtida.
// Exporta: armAutoTaxi, updateAutoTaxi, isAutoTaxiActive, cancelAutoTaxi.

import * as THREE from '../../vendor/three.module.min.js';
import { game } from './state.js';
import { jet } from './player.js';
import { getAirportForMap } from './airport.js';
import { SortieEvent, SortieState, transitionSortie } from './sortie-state.js';
import { spawnMission } from './missions.js';

const TAXI_SPEED = 34;     // m/s — velocidade de taxiamento
const TAKEOFF_SPEED = 56;  // m/s — velocidade na qual decola

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

/** Move o avião em direção a (tx,tz) no nível do pavimento. Devolve a distância restante. */
function _driveTo(tx, tz, dt, speed) {
  const ap = _airport();
  const dx = tx - jet.position.x;
  const dz = tz - jet.position.z;
  const dist = Math.hypot(dx, dz);
  // Desacelera perto do alvo para parar suave
  const v = Math.min(speed, Math.max(6, dist * 1.2));
  if (dist > 0.5) {
    const step = Math.min(dist, v * dt);
    const ux = dx / dist, uz = dz / dist;
    jet.position.x += ux * step;
    jet.position.z += uz * step;
    // O nariz do jato é o eixo -Z local. Para apontá-lo ao destino:
    // forward = (-sinθ,0,-cosθ) = (ux,uz) → θ = atan2(-ux, -uz).
    // (jet.lookAt aponta +Z ao alvo — convenção de objeto, não de câmera — o que
    //  antes deixava o nariz para trás e a decolagem descia a pista ao contrário.)
    jet.rotation.set(0, Math.atan2(-ux, -uz), 0);
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
      // Alinha EXATAMENTE com a pista: nariz (-Z) desce a pista (heading 0).
      // rotation.set sincroniza o quaternion automaticamente (Object3D).
      jet.rotation.set(0, 0, 0);
      jet.position.x = r.center.x; // centraliza na pista antes da corrida
      game.player.throttle = 1.0;
      // Limpa estado residual da surtida anterior para a 2ª/3ª decolagem sair limpa.
      sortie._autoSpeedFlagged = false;
      sortie.liftoffVsp = 0;
      if (sortie.state === SortieState.TAXI_OUT) {
        transitionSortie(sortie, SortieEvent.TAXI_TO_RUNWAY, {}, game.time); // → TAKEOFF_ROLL
      }
      a.phase = 'takeoff';
      a.t = 0;
    }
    _mirror();
    return;
  }

  if (a.phase === 'takeoff') {
    // Acelera na pista e levanta voo automaticamente.
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
      // Rotaciona o nariz e sobe
      if (jet.rotation.x > -0.18) jet.rotateX(-0.5 * dt);
      jet.position.y += 22 * dt;
    } else {
      jet.position.y = ap.elevation + 0.9;
    }

    const altAbove = jet.position.y - ap.elevation;
    if (altAbove > 8) {
      transitionSortie(sortie, SortieEvent.LIFTOFF, {}, game.time); // → AIRBORNE
      sortie._autoSpeedFlagged = false;
      sortie.liftoffVsp = 0;
      cancelAutoTaxi();
    }
    _mirror();
    return;
  }
}
