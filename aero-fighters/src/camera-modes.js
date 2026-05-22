import * as THREE from '../../vendor/three.module.min.js';

export const CameraModes = Object.freeze(['Chase', 'Wide Chase', 'Cockpit/Nose', 'Flyby/Cinematic', 'Orbit/Inspection']);

export function createCameraRig() {
  return { modeIndex: 0, mode: CameraModes[0], cinematic: null };
}

export function cycleCameraMode(rig) {
  rig.modeIndex = (rig.modeIndex + 1) % CameraModes.length;
  rig.mode = CameraModes[rig.modeIndex];
  return rig.mode;
}

export function startCinematicCamera(rig, explosionPos, jetPos, duration = 4) {
  rig.cinematic = {
    explosionPos: explosionPos?.clone ? explosionPos.clone() : explosionPos,
    jetStartPos: jetPos?.clone ? jetPos.clone() : jetPos,
    duration,
    elapsed: 0,
    active: true,
    _checked: false,
  };
}

const _frustum = new THREE.Frustum();
const _projMat = new THREE.Matrix4();
const _midpoint = new THREE.Vector3();

export function updateCameraRig(rig, dt, camera, jet, shake = null) {
  if (rig.cinematic?.active) {
    rig.cinematic.elapsed += dt;
    const t = Math.min(1, rig.cinematic.elapsed / rig.cinematic.duration);
    const ep = rig.cinematic.explosionPos || jet.position;

    // First frame: skip cinematic if explosion is already visible in current frustum
    if (!rig.cinematic._checked) {
      rig.cinematic._checked = true;
      _projMat.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
      _frustum.setFromProjectionMatrix(_projMat);
      if (_frustum.containsPoint(ep)) {
        // Explosion already visible — keep current camera, no mode switch
        rig.cinematic.active = false;
      }
    }

    if (rig.cinematic?.active) {
      // Frame both the current plane position and the explosion
      _midpoint.lerpVectors(ep, jet.position, 0.5);
      const dist = Math.max(60, ep.distanceTo(jet.position));
      const elevation = Math.max(35, dist * 0.35);
      const desired = new THREE.Vector3(_midpoint.x, _midpoint.y + elevation, _midpoint.z + dist * 0.4);
      camera.position.lerp(desired, 0.08);
      camera.lookAt(_midpoint.x, _midpoint.y + 10, _midpoint.z);
      // Widen FOV progressively
      camera.fov += (90 - camera.fov) * 0.06;
      camera.updateProjectionMatrix();
      if (t >= 1) rig.cinematic.active = false;
      return;
    }
  }

  const offsets = {
    'Chase': [0, 3, 5, 62],
    'Wide Chase': [0, 9, 16, 70],
    'Cockpit/Nose': [0, 0.6, -1.9, 58],
    'Flyby/Cinematic': [18, 7, 6, 64],
    'Orbit/Inspection': [14, 8, 14, 55],
  };
  const [x, y, z, fov] = offsets[rig.mode] || offsets.Chase;
  const local = new THREE.Vector3(x, y, z).applyQuaternion(jet.quaternion);
  const desired = jet.position.clone().add(local);
  if (shake) desired.add(new THREE.Vector3((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake, 0));
  camera.position.lerp(desired, rig.mode === 'Cockpit/Nose' ? 0.24 : 0.09);
  const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(jet.quaternion);
  camera.lookAt(jet.position.clone().addScaledVector(fwd, rig.mode === 'Cockpit/Nose' ? 140 : 34));
  camera.fov += (fov - camera.fov) * 0.05;
  camera.updateProjectionMatrix();
}
