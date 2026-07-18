import * as THREE from '../../vendor/three.module.min.js';
import { CONFIG } from './config.js';

const forward = new THREE.Vector3();
const right = new THREE.Vector3();
const desired = new THREE.Vector3();

export function createPlayer(game, physics, camera, input, audio) {
  let moving = false;
  let sprinting = false;

  function spawn(position, lookAt) {
    physics.createPlayer(position);
    camera.position.set(position.x, position.y + 0.68, position.z);
    camera.lookAt(lookAt);
    game.player.position = { x: position.x, y: position.y, z: position.z };
    game.player.speed = 0;
    game.player.sprinting = false;
  }

  function update(dt) {
    camera.getWorldDirection(forward);
    forward.y = 0;
    forward.normalize();
    right.crossVectors(forward, camera.up).normalize();
    const x = Number(input.held('KeyD')) - Number(input.held('KeyA'));
    const z = Number(input.held('KeyW')) - Number(input.held('KeyS'));
    game.player.crouched = input.held('KeyC');
    sprinting = (input.held('ShiftLeft') || input.held('ShiftRight')) && z > 0 && !game.player.crouched;
    const speed = game.player.crouched ? CONFIG.crouchSpeed : sprinting ? CONFIG.sprintSpeed : CONFIG.playerSpeed;
    desired.set(0, -7.5 * dt, 0);
    if (x || z) {
      desired.addScaledVector(forward, z * speed * dt);
      desired.addScaledVector(right, x * speed * dt);
      if (Math.abs(x) + Math.abs(z) > 1) {
        desired.x *= 0.72;
        desired.z *= 0.72;
      }
    }
    const horizontal = Math.hypot(desired.x, desired.z);
    moving = horizontal > 0.001;
    game.player.speed = moving ? horizontal / dt : 0;
    game.player.sprinting = sprinting && moving;
    physics.movePlayer(desired);
    const position = physics.position();
    const eye = game.player.crouched ? 1.25 : CONFIG.eyeHeight;
    camera.position.set(position.x, position.y + eye - 1, position.z);
    game.player.position = { x: position.x, y: position.y, z: position.z };
    game.player.yaw = camera.rotation.y;
    audio.footsteps(dt, moving, sprinting, camera.position);
  }

  return { spawn, update, get moving() { return moving; }, get sprinting() { return sprinting; } };
}
