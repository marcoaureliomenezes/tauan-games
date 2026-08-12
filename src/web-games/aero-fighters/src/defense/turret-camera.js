// defense/turret-camera.js — Câmera over-shoulder do modo 'inhauma-defense',
// dirigida pelo gimbal do artilheiro (mouse → yaw/pitch; pitch clamp -10°..+85°;
// zoom FOV com RMB). Escrita contra a API genérica de câmera (position/rotation/
// up/fov/updateProjectionMatrix) — SEM import de Three.js, Node-testável com stub.
// Exporta: createTurretCameraState, updateTurretCamera, gimbalForward.
// Para ajustar recuo/FOV/sensibilidade, edite AA_DEFENSE em config.js.

import { AA_DEFENSE } from '../config.js';
import { applyMouseLook } from './turret-player.js';

/** Estado por-sessão da câmera do turret (hoje vazio — zoom é lerp direto no FOV). */
export function createTurretCameraState() {
  return {};
}

/** Vetor forward do gimbal (yaw/pitch, rad) — {x, y, z} normalizado, sem alocar
 *  THREE.Vector3 (mantém o módulo puro). */
export function gimbalForward(yaw, pitch, out = {}) {
  const cp = Math.cos(pitch);
  out.x = -Math.sin(yaw) * cp;
  out.y = Math.sin(pitch);
  out.z = -Math.cos(yaw) * cp;
  return out;
}

const _fwd = {};

/**
 * Atualiza a câmera a partir do gimbal + flags de mouse do frame.
 * @param {number} dt segundos desde o último frame
 * @param {object} camera câmera (THREE.PerspectiveCamera ou stub com a mesma API)
 * @param {object} turret estado do artilheiro (turret-player.js)
 * @param {object} _camState estado de createTurretCameraState()
 * @param {{dx:number, dy:number, left:boolean, right:boolean}} mouse flags do frame
 */
export function updateTurretCamera(dt, camera, turret, _camState, mouse) {
  applyMouseLook(turret, mouse.dx, mouse.dy);
  const f = gimbalForward(turret.yaw, turret.pitch, _fwd);
  const eyeY = turret.y + AA_DEFENSE.EYE_HEIGHT;
  // Over-shoulder: recua ao longo do forward invertido + elevação extra — a
  // bateria fica visível na parte baixa do quadro (defense-mode clampa no chão).
  camera.position.set(
    turret.x - f.x * AA_DEFENSE.CAM_BACK,
    eyeY - f.y * AA_DEFENSE.CAM_BACK + AA_DEFENSE.CAM_UP,
    turret.z - f.z * AA_DEFENSE.CAM_BACK,
  );
  camera.up.set(0, 1, 0);
  camera.rotation.order = 'YXZ';
  camera.rotation.set(turret.pitch, turret.yaw, 0);
  // Zoom RMB (lerp exponencial, independente de fps)
  const targetFov = mouse.right ? AA_DEFENSE.ZOOM_FOV : AA_DEFENSE.FOV;
  const k = Math.min(1, AA_DEFENSE.ZOOM_SPEED * dt);
  camera.fov += (targetFov - camera.fov) * k;
  camera.updateProjectionMatrix();
}
