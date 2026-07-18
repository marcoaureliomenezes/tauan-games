import * as THREE from '../../../vendor/three.module.min.js';
import * as YUKA from '../../../vendor/james-bond/yuka-0.7.8.module.js';
import { CONFIG, DIFFICULTY } from '../config.js';
import { MISSIONS } from '../content/missions.js';
import { hasLineOfSight } from '../world.js';
import { buildSoldier } from './soldier-model.js';

const tempA = new THREE.Vector3();
const tempB = new THREE.Vector3();
const muzzleWorld = new THREE.Vector3();
const aimPoint = new THREE.Vector3();

function buildGraph(world) {
  const graph = new YUKA.Graph();
  const index = (x, z) => z * world.width + x;
  for (let z = 0; z < world.height; z += 1) {
    for (let x = 0; x < world.width; x += 1) {
      if (!world.walkable(x, z)) continue;
      graph.addNode(new YUKA.NavNode(index(x, z), world.toWorld({ x, z })));
    }
  }
  for (let z = 0; z < world.height; z += 1) {
    for (let x = 0; x < world.width; x += 1) {
      if (!world.walkable(x, z)) continue;
      [[1, 0], [0, 1]].forEach(([dx, dz]) => {
        if (world.walkable(x + dx, z + dz)) graph.addEdge(new YUKA.Edge(index(x, z), index(x + dx, z + dz), 1));
      });
    }
  }
  return { graph, index };
}

export function createGuards(scene, game, world, audio, damagePlayer, fx) {
  const nav = buildGraph(world);
  const difficulty = DIFFICULTY[game.difficulty];
  const eliteMission = MISSIONS[game.missionIndex]?.code === 'OP-06';
  const accents = [0x3d4a40, 0x42473c, 0x37413d, 0x453f38];
  const enemies = world.guards.map((position, id) => {
    const elite = eliteMission && id === 0;
    const visual = buildSoldier(accents[id % accents.length], elite);
    visual.root.position.copy(position);
    scene.add(visual.root);
    const enemy = {
      id, ...visual, elite, health: difficulty.enemyHealth * (elite ? 1.6 : 1), state: 'patrol', stateTime: 0,
      home: position.clone(), target: position.clone(), lastKnown: new YUKA.Vector3(),
      path: [], pathIndex: 0, repath: 0, fireCooldown: 1, burstLeft: 0, strafeDir: id % 2 ? 1 : -1,
      facing: new THREE.Vector3(0, 0, 1), alive: true, revealedUntil: 0, sightTime: 0,
      flinch: 0, deathT: -1, flashT: 0, moving: false,
    };
    visual.root.userData.enemy = enemy;
    visual.hitMeshes.forEach((part) => { part.userData.enemy = enemy; });
    return enemy;
  });
  game.enemies = enemies;
  game.telemetry.yukaReady = true;

  function plan(enemy, target) {
    const from = nearestCell(world.toCell(enemy.root.position));
    const to = nearestCell(world.toCell(target));
    if (!from || !to) { enemy.path = []; enemy.pathIndex = 0; return; }
    const search = new YUKA.AStar(nav.graph, nav.index(from.x, from.z), nav.index(to.x, to.z));
    search.search();
    enemy.path = search.getPath().slice(1)
      .map((node) => nav.graph.getNode(node))
      .filter(Boolean)
      .map((node) => node.position);
    enemy.pathIndex = 0;
  }

  // A* crashes when the goal cell is a wall (e.g. player hugging a wall): snap to the
  // nearest walkable cell in an expanding ring before searching.
  function nearestCell(cell) {
    if (world.walkable(cell.x, cell.z)) return cell;
    for (let radius = 1; radius <= 3; radius += 1) {
      for (let dz = -radius; dz <= radius; dz += 1) {
        for (let dx = -radius; dx <= radius; dx += 1) {
          if (Math.max(Math.abs(dx), Math.abs(dz)) !== radius) continue;
          if (world.walkable(cell.x + dx, cell.z + dz)) return { x: cell.x + dx, z: cell.z + dz };
        }
      }
    }
    return null;
  }

  function setState(enemy, state, playerPosition) {
    if (enemy.state === state) return;
    enemy.state = state;
    enemy.stateTime = 0;
    if (playerPosition) enemy.lastKnown.copy(playerPosition);
    if (state === 'engage') enemy.fireCooldown = Math.max(enemy.fireCooldown, difficulty.reaction);
    enemy.ring.material.opacity = state === 'engage' || state === 'pursue' ? 0.75 : state === 'investigate' ? 0.35 : 0;
  }

  function update(dt, now, playerPosition) {
    let alertCount = 0;
    let shooterTokens = CONFIG.maxShooters;
    enemies.forEach((enemy) => {
      if (!enemy.alive) { updateCorpse(enemy, dt); return; }
      enemy.stateTime += dt;
      enemy.fireCooldown -= dt;
      enemy.repath -= dt;
      enemy.flinch = Math.max(0, enemy.flinch - dt);
      enemy.flashT = Math.max(0, enemy.flashT - dt);
      enemy.flash.material.opacity = enemy.flashT > 0 ? 0.9 : 0;
      const distance = enemy.root.position.distanceTo(playerPosition);
      tempA.copy(playerPosition).sub(enemy.root.position).setY(0).normalize();
      const los = hasLineOfSight(world, enemy.root.position, playerPosition);
      const visible = distance < CONFIG.enemyVisionRange && enemy.facing.dot(tempA) > CONFIG.enemyVisionCos && los;

      if (visible) {
        enemy.sightTime += dt;
        enemy.lastKnown.set(playerPosition.x, playerPosition.y, playerPosition.z);
        if (enemy.sightTime > difficulty.reaction * 0.6 || ['engage', 'pursue'].includes(enemy.state)) {
          setState(enemy, distance < CONFIG.enemyFireRange ? 'engage' : 'pursue', playerPosition);
        }
      } else {
        enemy.sightTime = Math.max(0, enemy.sightTime - dt * 2.5);
        if (enemy.state === 'engage') setState(enemy, 'pursue');
      }

      if (['engage', 'pursue', 'investigate', 'search'].includes(enemy.state)) alertCount += 1;
      enemy.moving = false;
      if (enemy.state === 'engage') {
        enemy.facing.lerp(tempA, Math.min(1, dt * 8)).normalize();
        if (enemy.flinch <= 0 && los && enemy.fireCooldown <= 0) {
          if (shooterTokens > 0 && distance < CONFIG.enemyFireRange) {
            shooterTokens -= 1;
            fire(enemy, distance, playerPosition, now);
          } else if (enemy.stateTime > 2.5) {
            // no token: strafe to pressure instead of stacking damage
            tempB.crossVectors(tempA, enemy.root.up).multiplyScalar(enemy.strafeDir);
            const step = CONFIG.enemySpeed * 0.5 * dt;
            const cell = world.toCell(tempA.copy(enemy.root.position).addScaledVector(tempB, step));
            if (world.walkable(cell.x, cell.z)) {
              enemy.root.position.addScaledVector(tempB, step);
              enemy.moving = true;
            } else {
              enemy.strafeDir *= -1;
            }
            if (enemy.stateTime > 4.5) { enemy.stateTime = 2.6; enemy.strafeDir *= -1; }
          }
        }
      } else {
        let target = enemy.home;
        let speedFactor = 0.8;
        if (enemy.state === 'investigate' || enemy.state === 'search') { target = enemy.lastKnown; speedFactor = 1; }
        if (enemy.state === 'pursue') { target = enemy.lastKnown; speedFactor = 1.45; }
        if (enemy.state === 'patrol' && enemy.stateTime > 2.5) {
          const angle = (enemy.id * 2.3 + now * 0.07) % (Math.PI * 2);
          target = tempB.set(enemy.home.x + Math.cos(angle) * 6, 0, enemy.home.z + Math.sin(angle) * 6);
        }
        moveAlongPath(enemy, target, dt, speedFactor, plan);
        if (enemy.state === 'pursue' && enemy.root.position.distanceTo(enemy.lastKnown) < 1.4) setState(enemy, 'search');
        if ((enemy.state === 'search' || enemy.state === 'investigate') && enemy.stateTime > 5) setState(enemy, 'patrol');
      }
      enemy.root.rotation.y = Math.atan2(enemy.facing.x, enemy.facing.z);
      animate(enemy, dt, now);
    });
    game.alertLevel = Math.min(1, alertCount / 2);
  }

  // Burst fire with aim delay: reaction time before the first round, short bursts, pauses between them.
  function fire(enemy, distance, playerPosition, now) {
    if (enemy.burstLeft <= 0) {
      enemy.burstLeft = difficulty.burst[0] + Math.floor(Math.random() * (difficulty.burst[1] - difficulty.burst[0] + 1));
    }
    enemy.burstLeft -= 1;
    enemy.fireCooldown = enemy.burstLeft > 0
      ? 0.1 + Math.random() * 0.05
      : difficulty.burstGap + Math.random() * 0.5;
    enemy.revealedUntil = now + 4;
    enemy.flashT = 0.05;
    enemy.flash.rotation.z = Math.random() * Math.PI;
    audio.enemyGun(enemy.root.position);
    enemy.muzzleTip.getWorldPosition(muzzleWorld);
    const speed = game.player.speed || 0;
    const moveFactor = speed > 5.5 ? 0.6 : speed > 0.5 ? 0.82 : 1;
    const crouchFactor = game.player.crouched ? 1.1 : 1;
    const distanceFactor = THREE.MathUtils.clamp(1.2 - distance / CONFIG.enemyFireRange, 0.22, 1);
    const hitChance = difficulty.accuracy * distanceFactor * moveFactor * crouchFactor;
    aimPoint.copy(playerPosition);
    if (Math.random() < hitChance) {
      aimPoint.y -= 0.12 + Math.random() * 0.15;
      fx.tracer(muzzleWorld, aimPoint, 0xffb27a);
      damagePlayer(difficulty.damage);
    } else {
      // near miss: round cracks past the player and strikes the environment
      aimPoint.x += (Math.random() - 0.5) * 2.4;
      aimPoint.y += (Math.random() - 0.3) * 1.6;
      aimPoint.z += (Math.random() - 0.5) * 2.4;
      fx.tracer(muzzleWorld, aimPoint, 0xffb27a);
      fx.impact(aimPoint, 0xcbb998);
      audio.crack(aimPoint);
    }
  }

  function animate(enemy, dt, now) {
    const stride = enemy.moving ? Math.sin(now * 9 + enemy.id * 1.7) * 0.5 : 0;
    enemy.legL.rotation.x = stride;
    enemy.legR.rotation.x = -stride;
    const flinchTilt = enemy.flinch > 0 ? -0.3 * (enemy.flinch / 0.18) : 0;
    enemy.torso.rotation.x = flinchTilt;
    enemy.head.rotation.x = flinchTilt * 0.6;
  }

  function updateCorpse(enemy, dt) {
    if (enemy.deathT < 0 || enemy.deathT >= 1) return;
    enemy.deathT = Math.min(1, enemy.deathT + dt * 2.2);
    const ease = 1 - (1 - enemy.deathT) ** 2;
    enemy.root.rotation.z = enemy.fallDir * ease * Math.PI * 0.48;
    enemy.root.position.y = ease * 0.12;
    enemy.flash.material.opacity = 0;
  }

  function notifyNoise(position, radius, now) {
    enemies.forEach((enemy) => {
      if (!enemy.alive || enemy.root.position.distanceTo(position) > radius) return;
      enemy.lastKnown.set(position.x, position.y, position.z);
      enemy.revealedUntil = now + 4;
      setState(enemy, radius > 15 ? 'pursue' : 'investigate');
    });
  }

  function damage(enemy, amount, zone) {
    if (!enemy?.alive) return false;
    enemy.health -= amount * (zone === 'head' ? 2.4 : zone === 'limb' ? 0.65 : 1);
    setState(enemy, 'engage', game.camera.position);
    if (enemy.health > 0) {
      enemy.flinch = 0.18;
      enemy.burstLeft = 0;
      enemy.fireCooldown = Math.max(enemy.fireCooldown, 0.3);
      return false;
    }
    enemy.alive = false;
    enemy.state = 'down';
    enemy.deathT = 0;
    enemy.fallDir = Math.random() > 0.5 ? 1 : -1;
    enemy.ring.material.opacity = 0;
    game.kills += 1;
    return true;
  }

  return { enemies, update, notifyNoise, damage, dispose: () => enemies.forEach((enemy) => {
    scene.remove(enemy.root);
    enemy.root.traverse((part) => { part.geometry?.dispose(); part.material?.dispose(); });
  }) };
}

function moveAlongPath(enemy, target, dt, speedFactor, plan) {
  if (enemy.repath <= 0 || enemy.pathIndex >= enemy.path.length) {
    enemy.repath = 0.8;
    plan(enemy, target);
  }
  const waypoint = enemy.path[enemy.pathIndex];
  if (!waypoint) return;
  tempA.set(waypoint.x, 0, waypoint.z).sub(enemy.root.position).setY(0);
  if (tempA.length() < 0.35) { enemy.pathIndex += 1; return; }
  tempA.normalize();
  enemy.facing.lerp(tempA, Math.min(1, dt * 6)).normalize();
  enemy.root.position.addScaledVector(enemy.facing, CONFIG.enemySpeed * speedFactor * dt);
  enemy.moving = true;
}
