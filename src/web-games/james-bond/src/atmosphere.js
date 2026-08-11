import * as THREE from '../../vendor/three.module.min.js';
import { CONFIG } from './config.js';
import { WEAPONS } from './content/weapons.js';

// Per-mission sky, fog and light rig.
export function createAtmosphere(scene) {
  let lights = [];

  function apply(mission) {
    scene.background = new THREE.Color(mission.palette.sky);
    scene.fog = new THREE.FogExp2(mission.palette.fog, mission.code === 'OP-03' ? 0.018 : 0.011);
    lights.forEach((light) => scene.remove(light));
    const hemi = new THREE.HemisphereLight(mission.palette.sky, mission.palette.floor, 1.6);
    const ambient = new THREE.AmbientLight(0xb9c7be, mission.code === 'OP-02' ? 1.35 : 0.72);
    const sun = new THREE.DirectionalLight(0xfff3d6, 2.2);
    sun.position.set(18, 28, 12);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.left = -45;
    sun.shadow.camera.right = 45;
    sun.shadow.camera.top = 45;
    sun.shadow.camera.bottom = -45;
    lights = [hemi, ambient, sun];
    scene.add(...lights);
  }

  return { apply };
}

// ADS zoom + sprint FOV kick, smoothly interpolated.
export function createFovController(camera, game) {
  function update(dt) {
    const adsT = game.view?.adsT || 0;
    const sprint = game.player.sprinting && !adsT ? CONFIG.sprintFovBoost : 0;
    const target = (CONFIG.baseFov + sprint) * (1 - adsT) + (WEAPONS[game.currentWeapon]?.adsFov || 60) * adsT;
    if (Math.abs(camera.fov - target) > 0.05) {
      camera.fov += (target - camera.fov) * Math.min(1, dt * CONFIG.adsSpeed);
      camera.updateProjectionMatrix();
    }
  }

  function reset() {
    camera.fov = CONFIG.baseFov;
    camera.updateProjectionMatrix();
  }

  return { update, reset };
}
