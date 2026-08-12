import * as THREE from '../../vendor/three.module.min.js';
import { CONFIG } from './config.js';

const forward = new THREE.Vector3();
const right = new THREE.Vector3();
const desired = new THREE.Vector3();

export function createPlayer(game, physics, camera, input, audio) {
  let moving = false;
  let vy = 0;
  let grounded = true;
  let climbing = false;

  function spawn(position, lookAt) {
    physics.createPlayer(position);
    camera.position.set(position.x, position.y + 0.68, position.z);
    camera.lookAt(lookAt);
    game.player.position = { x: position.x, y: position.y, z: position.z };
    game.player.speed = 0;
    game.player.sprinting = false;
    vy = 0;
    grounded = true;
  }

  function update(dt) {
    camera.getWorldDirection(forward);
    forward.y = 0;
    forward.normalize();
    right.crossVectors(forward, camera.up).normalize();
    const x = Number(input.held('KeyD')) - Number(input.held('KeyA'));
    const z = Number(input.held('KeyW')) - Number(input.held('KeyS'));
    // Shift abaixa (estilo CS); sem sprint
    game.player.crouched = input.held('ShiftLeft') || input.held('ShiftRight') || input.held('KeyC');
    const speed = game.player.crouched ? CONFIG.crouchSpeed : CONFIG.playerSpeed;
    // Escada: dentro do volume, W sobe e S desce, sem gravidade. Deliberadamente
    // simples — o alvo é uma criança aprendendo os controles, então evitamos
    // depender do ângulo de visão para decidir a direção da subida.
    const position0 = physics.position();
    climbing = physics.onLadder(position0.x, position0.z, position0.y - 1);
    if (climbing) {
      if (input.consume('Space')) {
        vy = CONFIG.jumpSpeed;
        climbing = false;
        grounded = false;
        audio.jump();
      } else {
        vy = 0;
        desired.set(0, z * CONFIG.climbSpeed * dt, 0);
        if (x || z) {
          desired.addScaledVector(forward, 0);
          desired.addScaledVector(right, x * speed * 0.45 * dt);
        }
        moving = Math.abs(z) > 0;
        game.player.speed = moving ? CONFIG.climbSpeed : 0;
        game.player.climbing = true;
        physics.movePlayer(desired);
        const climbPosition = physics.position();
        camera.position.set(climbPosition.x, climbPosition.y + CONFIG.eyeHeight - 1, climbPosition.z);
        game.player.position = { x: climbPosition.x, y: climbPosition.y, z: climbPosition.z };
        game.player.grounded = false;
        audio.footsteps(dt, moving, false, camera.position);
        return;
      }
    }
    game.player.climbing = false;
    if (grounded && input.consume('Space')) {
      vy = CONFIG.jumpSpeed;
      grounded = false;
      audio.jump();
    }
    vy = grounded ? -7.5 : vy - CONFIG.gravity * dt;
    desired.set(0, vy * dt, 0);
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
    game.player.sprinting = false;
    physics.movePlayer(desired);
    const position = physics.position();
    // "No chão" agora é relativo ao andar sob os pés, não à altura fixa 1 —
    // senão o jogador nunca readquire o pulo em cima de um mezanino.
    const support = physics.supportHeight(position.x, position.z, position.y - 1);
    if (position.y <= support + 1.0001 && vy <= 0) grounded = true;
    game.player.grounded = grounded;
    game.player.floorY = support;
    const eye = game.player.crouched ? 1.25 : CONFIG.eyeHeight;
    camera.position.set(position.x, position.y + eye - 1, position.z);
    game.player.position = { x: position.x, y: position.y, z: position.z };
    game.player.yaw = camera.rotation.y;
    audio.footsteps(dt, moving && grounded, false, camera.position);
  }

  return {
    spawn,
    update,
    get moving() { return moving; },
    get grounded() { return grounded; },
    get climbing() { return climbing; },
  };
}
