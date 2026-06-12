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
  };
}

const _camSide = new THREE.Vector3();
const _camDesired = new THREE.Vector3();
const _toJet = new THREE.Vector3();

export function updateCameraRig(rig, dt, camera, jet, shake = null) {
  if (rig.cinematic?.active) {
    const c = rig.cinematic;
    c.elapsed += dt;
    const t = Math.min(1, c.elapsed / c.duration);
    const ep = c.explosionPos || jet.position;

    // WS-6/ADR: a cinematic SEMPRE assume — wide-shot lateral BAIXO, cogumelo
    // contra o céu, dolly-out conforme a nuvem cresce.
    if (!c._side) {
      _toJet.copy(jet.position).sub(ep);
      _toJet.y = 0;
      const d = Math.max(_toJet.length(), 150);
      c._dist = Math.min(520, Math.max(200, d * 0.9));
      // perpendicular ao eixo avião↔epicentro (vista lateral)
      if (_toJet.lengthSq() > 1) {
        c._side = new THREE.Vector3(-_toJet.z, 0, _toJet.x).normalize();
      } else {
        c._side = new THREE.Vector3(1, 0, 0);
      }
    }
    const r = c._dist * (1 + 0.35 * t); // dolly-out
    _camSide.copy(c._side).multiplyScalar(r);
    _camDesired.set(ep.x + _camSide.x, ep.y + r * 0.40, ep.z + _camSide.z); // ~22° de elevação
    camera.position.lerp(_camDesired, 0.14);
    // Look-at sobe acompanhando o cogumelo (plume cresce até ~125 m)
    const lookY = ep.y + 12 + 95 * Math.min(1, t * 1.4);
    camera.lookAt(ep.x, lookY, ep.z);
    camera.fov += (72 - camera.fov) * 0.06;
    camera.updateProjectionMatrix();
    if (t >= 1) c.active = false;
    return;
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
