import { MISSILES_HEAVY, MISSILES_NUCLEAR, MISSILES_ROD } from './config.js';
import { resetWeaponCooldowns } from './weapon-cooldowns.js';

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
    // 2026-08-11: rearm no mundo dos cooldowns — o serviço zera TODAS as
    // recargas (inclusive a nuclear de 60 s). Os campos de munição viraram
    // constantes de visual; mantidos no MAX por compatibilidade de asa/debug.
    player.heavyMissiles = MISSILES_HEAVY.MAX;
    player.nuclearMissiles = MISSILES_NUCLEAR.MAX;
    player.rodMissiles = MISSILES_ROD.MAX;
    if (player.weaponCooldowns) resetWeaponCooldowns(player.weaponCooldowns);
    service.active = false;
    service.phase = 'complete';
    return true;
  }
  return false;
}
