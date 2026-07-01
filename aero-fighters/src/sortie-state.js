export const SortieState = Object.freeze({
  MENU: 'MENU',
  TAXI_OUT: 'TAXI_OUT',
  TAKEOFF_ROLL: 'TAKEOFF_ROLL',
  AIRBORNE: 'AIRBORNE',
  MISSION_ACTIVE: 'MISSION_ACTIVE',
  RETURN_TO_BASE: 'RETURN_TO_BASE',
  LANDING_ROLL: 'LANDING_ROLL',
  TAXI_IN: 'TAXI_IN',
  SERVICE_SCENE: 'SERVICE_SCENE',
  NEXT_SORTIE_READY: 'NEXT_SORTIE_READY',
  MAYDAY: 'MAYDAY',
  EJECTION: 'EJECTION',
  CRASHED: 'CRASHED',
  MISSION_FAILED: 'MISSION_FAILED',
});

export const SortieEvent = Object.freeze({
  START: 'START',
  TAXI_TO_RUNWAY: 'TAXI_TO_RUNWAY',
  TAKEOFF_SPEED_REACHED: 'TAKEOFF_SPEED_REACHED',
  LIFTOFF: 'LIFTOFF',
  ALL_TARGETS_DESTROYED: 'ALL_TARGETS_DESTROYED',
  TOUCHDOWN_SAFE: 'TOUCHDOWN_SAFE',
  TOUCHDOWN_UNSAFE: 'TOUCHDOWN_UNSAFE',
  SERVICE_ZONE_REACHED: 'SERVICE_ZONE_REACHED',
  SERVICE_COMPLETE: 'SERVICE_COMPLETE',
  NEXT_SORTIE: 'NEXT_SORTIE',
  MOUNTAIN_CONTACT: 'MOUNTAIN_CONTACT',
  CRITICAL_DAMAGE: 'CRITICAL_DAMAGE',
  EJECT_REQUESTED: 'EJECT_REQUESTED',
  PILOT_LANDED: 'PILOT_LANDED',
  AIRCRAFT_IMPACT: 'AIRCRAFT_IMPACT',
  WATER_IMPACT: 'WATER_IMPACT',
});

const TRANSITIONS = new Map([
  [`${SortieState.MENU}:${SortieEvent.START}`, SortieState.TAXI_OUT],
  [`${SortieState.NEXT_SORTIE_READY}:${SortieEvent.NEXT_SORTIE}`, SortieState.TAXI_OUT],
  [`${SortieState.TAXI_OUT}:${SortieEvent.TAXI_TO_RUNWAY}`, SortieState.TAKEOFF_ROLL],
  [`${SortieState.TAKEOFF_ROLL}:${SortieEvent.TAKEOFF_SPEED_REACHED}`, SortieState.TAKEOFF_ROLL],
  [`${SortieState.TAKEOFF_ROLL}:${SortieEvent.LIFTOFF}`, SortieState.AIRBORNE],
  [`${SortieState.AIRBORNE}:${SortieEvent.START}`, SortieState.MISSION_ACTIVE],
  [`${SortieState.AIRBORNE}:${SortieEvent.ALL_TARGETS_DESTROYED}`, SortieState.RETURN_TO_BASE],
  [`${SortieState.MISSION_ACTIVE}:${SortieEvent.ALL_TARGETS_DESTROYED}`, SortieState.RETURN_TO_BASE],
  [`${SortieState.RETURN_TO_BASE}:${SortieEvent.TOUCHDOWN_SAFE}`, SortieState.LANDING_ROLL],
  // Touchdown oportunista (WS-1): pousar com envelope ok fora de RTB é pouso, não limbo
  [`${SortieState.AIRBORNE}:${SortieEvent.TOUCHDOWN_SAFE}`, SortieState.LANDING_ROLL],
  [`${SortieState.MISSION_ACTIVE}:${SortieEvent.TOUCHDOWN_SAFE}`, SortieState.LANDING_ROLL],
  // Re-decolagem após pouso oportunista: acelerar de novo re-entra em TAKEOFF_ROLL
  [`${SortieState.LANDING_ROLL}:${SortieEvent.TAKEOFF_SPEED_REACHED}`, SortieState.TAKEOFF_ROLL],
  [`${SortieState.LANDING_ROLL}:${SortieEvent.SERVICE_ZONE_REACHED}`, SortieState.TAXI_IN],
  [`${SortieState.TAXI_IN}:${SortieEvent.SERVICE_ZONE_REACHED}`, SortieState.SERVICE_SCENE],
  [`${SortieState.SERVICE_SCENE}:${SortieEvent.SERVICE_COMPLETE}`, SortieState.NEXT_SORTIE_READY],
  [`${SortieState.MAYDAY}:${SortieEvent.EJECT_REQUESTED}`, SortieState.EJECTION],
  [`${SortieState.EJECTION}:${SortieEvent.PILOT_LANDED}`, SortieState.NEXT_SORTIE_READY],
]);

const MAYDAY_EVENTS = new Set([SortieEvent.MOUNTAIN_CONTACT, SortieEvent.CRITICAL_DAMAGE]);
const CRASH_EVENTS = new Set([SortieEvent.TOUCHDOWN_UNSAFE, SortieEvent.AIRCRAFT_IMPACT, SortieEvent.WATER_IMPACT]);

export function createSortieMachine(initialState = SortieState.MENU) {
  return { state: initialState, history: [{ from: null, event: 'init', to: initialState, at: 0 }] };
}

export function transitionSortie(machine, event, guard = {}, at = 0) {
  const current = machine.state;
  let next = TRANSITIONS.get(`${current}:${event}`) || current;
  if (MAYDAY_EVENTS.has(event)) next = SortieState.MAYDAY;
  if (CRASH_EVENTS.has(event)) next = guard.survivableMayday ? SortieState.MAYDAY : SortieState.CRASHED;
  if (event === SortieEvent.AIRCRAFT_IMPACT && current === SortieState.MAYDAY) next = SortieState.CRASHED;
  if (next !== current) {
    machine.state = next;
    machine.history.push({ from: current, event, to: next, at, guard });
    if (machine.history.length > 32) machine.history.shift();
  }
  return machine.state;
}

export function isAirborneState(state) {
  return state === SortieState.AIRBORNE || state === SortieState.MISSION_ACTIVE || state === SortieState.RETURN_TO_BASE || state === SortieState.MAYDAY;
}

export const GROUND_STATES = new Set([
  SortieState.TAXI_OUT,
  SortieState.TAKEOFF_ROLL,
  SortieState.LANDING_ROLL,
  SortieState.TAXI_IN,
  SortieState.NEXT_SORTIE_READY,
]);
