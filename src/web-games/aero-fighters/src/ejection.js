import * as THREE from '../../../../vendor/three.module.min.js';

export function createEjectionState() {
  return { active: false, pilotState: 'IN_AIRCRAFT', elapsed: 0, descentY: 0, saved: false };
}

export function requestEjection(state, aircraftPosition) {
  if (state.active) return false;
  state.active = true;
  state.pilotState = 'PARACHUTE';
  state.elapsed = 0;
  state.descentY = Math.max(aircraftPosition?.y ?? 80, 30);
  state.saved = false;
  return true;
}

export function updateEjection(state, dt) {
  if (!state.active) return false;
  state.elapsed += dt;
  state.descentY = Math.max(0, state.descentY - 9 * dt);
  if (state.descentY <= 0) {
    state.active = false;
    state.pilotState = 'SURVIVED';
    state.saved = true;
    return true;
  }
  return false;
}

export function createPilotVisual(scene) {
  const group = new THREE.Group();
  group.visible = false;
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.8, 10, 8), new THREE.MeshBasicMaterial({ color: 0x1c57ff }));
  const canopy = new THREE.Mesh(new THREE.ConeGeometry(4.5, 1.2, 16), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 }));
  canopy.position.y = 3.0;
  group.add(body, canopy);
  scene.add(group);
  return group;
}
