import { MISSILES_LIGHT, MISSILES_HEAVY, MISSILES_NUCLEAR, MISSILES_ROD } from './config.js';

export function createServiceState(testMode = false) {
  return {
    active: false,
    elapsed: 0,
    duration: testMode ? 5 : 35,
    progress: 0,
    phase: 'idle',
  };
}

export function startService(service) {
  service.active = true;
  service.elapsed = 0;
  service.progress = 0;
  service.phase = 'fuel';
}

export function updateService(service, dt, player) {
  if (!service.active) return false;
  service.elapsed = Math.min(service.duration, service.elapsed + dt);
  service.progress = service.duration > 0 ? service.elapsed / service.duration : 1;
  service.phase = service.progress < 0.35 ? 'fuel' : service.progress < 0.7 ? 'maintenance' : 'rearm';
  if (service.progress >= 1) {
    player.missiles = MISSILES_LIGHT.MAX;
    player.heavyMissiles = MISSILES_HEAVY.MAX;
    player.nuclearMissiles = MISSILES_NUCLEAR.MAX;
    player.rodMissiles = MISSILES_ROD.MAX; // T-03/D-3: rod refill at service like HVY/NUK
    service.active = false;
    service.phase = 'complete';
    return true;
  }
  return false;
}
