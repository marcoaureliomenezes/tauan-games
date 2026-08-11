import * as THREE from '../../vendor/three.module.min.js';
import { CONFIG } from './config.js';
import { WEAPONS, freshAmmo } from './content/weapons.js';
import { hasLineOfSight } from './world.js';
import { createViewModel } from './view-model.js';

const raycaster = new THREE.Raycaster();
const direction = new THREE.Vector3();
const origin = new THREE.Vector3();
const right = new THREE.Vector3();
const upv = new THREE.Vector3();
const muzzle = new THREE.Vector3();
const normal = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);
const X_AXIS = new THREE.Vector3(1, 0, 0);
const Y_AXIS = new THREE.Vector3(0, 1, 0);

export function createCombat(scene, camera, game, input, audio, fx, world, guards, damagePlayer, ui) {
  let cooldown = 0;
  let reloadTimer = 0;
  let reloadTotal = 0;
  let triggerReady = true;
  let bloom = 0;
  let recoverable = 0;
  let adsT = 0;
  const projectiles = [];
  let mine = null;
  game.ammo = freshAmmo();
  game.view = { adsT: 0, spread: 0, bloom: 0 };

  camera.layers.enable(1);
  const viewModel = createViewModel(camera);
  // flashlight stays on layer 0 so it never blows out the view model (layer 1)
  const flashlight = new THREE.SpotLight(0xe7f3ec, 30, 26, 0.46, 0.6, 1.8);
  const flashlightTarget = new THREE.Object3D();
  flashlight.position.set(0.18, -0.12, -0.2);
  flashlightTarget.position.set(0, -0.1, -8);
  flashlight.target = flashlightTarget;
  // soft fill so the weapon reads even in dark corridors — lights layer 1 only
  const fill = new THREE.PointLight(0xdfe8e2, 0.5, 2.6, 2);
  fill.layers.set(1);
  camera.add(flashlight, flashlightTarget, fill);

  function currentSpread() {
    const weapon = WEAPONS[game.currentWeapon];
    const speed = game.player.speed || 0;
    const moveFactor = speed > 5.5 ? 1.7 : speed > 0.5 ? 1.3 : 1;
    const crouchFactor = game.player.crouched ? 0.8 : 1;
    const adsFactor = 1 - adsT * 0.68;
    return weapon.spread * (1 + bloom) * moveFactor * crouchFactor * adsFactor;
  }

  function switchWeapon(id) {
    if (!WEAPONS[id] || reloadTimer > 0 || id === game.currentWeapon) return;
    game.currentWeapon = id;
    viewModel.setWeapon(id);
    cooldown = Math.max(cooldown, 0.32);
    audio.reload(0.32);
    ui.updateHud();
  }

  function cycleWeapon(directionValue) {
    const ids = Object.keys(WEAPONS).sort((a, b) => WEAPONS[a].slot - WEAPONS[b].slot);
    const index = ids.indexOf(game.currentWeapon);
    switchWeapon(ids[(index + directionValue + ids.length) % ids.length]);
  }

  function reload() {
    const ammo = game.ammo[game.currentWeapon];
    const weapon = WEAPONS[game.currentWeapon];
    if (reloadTimer > 0 || ammo.mag >= weapon.mag || ammo.reserve <= 0) return;
    reloadTimer = reloadTotal = weapon.reload;
    audio.reload(weapon.reload);
  }

  function completeReload() {
    const ammo = game.ammo[game.currentWeapon];
    const weapon = WEAPONS[game.currentWeapon];
    const amount = Math.min(weapon.mag - ammo.mag, ammo.reserve);
    ammo.mag += amount;
    ammo.reserve -= amount;
  }

  function shoot() {
    const weapon = WEAPONS[game.currentWeapon];
    const ammo = game.ammo[game.currentWeapon];
    if (ammo.mag <= 0) { audio.dry(); cooldown = 0.24; return; }
    ammo.mag -= 1;
    cooldown = weapon.cadence;
    game.shots += 1;
    audio.gun(weapon, camera.position);
    viewModel.onShoot();
    fx.muzzle(camera, Boolean(weapon.suppressed));
    guards.notifyNoise(camera.position, weapon.noise, game.time);
    bloom = Math.min(2.6, bloom + CONFIG.bloomPerShot * (weapon.pellets ? 1.9 : 1));
    const aimKick = weapon.recoil * (1 - adsT * 0.35) * (1 + bloom * 0.25);
    pitchCamera(aimKick);
    yawCamera((Math.random() - 0.5) * weapon.recoil * 0.5);
    recoverable += aimKick * 0.72;
    const pellets = weapon.pellets || 1;
    for (let i = 0; i < pellets; i += 1) fireRay(weapon, i > 0);
  }

  // Recoil must rotate in quaternion space: PointerLockControls composes YXZ euler,
  // and mixing euler orders here makes the camera drift. Local-axis quaternion kicks
  // are order-independent and get absorbed cleanly on the next mouse move.
  const kickQuat = new THREE.Quaternion();
  function pitchCamera(angle) {
    kickQuat.setFromAxisAngle(X_AXIS, angle);
    camera.quaternion.multiply(kickQuat);
  }
  function yawCamera(angle) {
    kickQuat.setFromAxisAngle(Y_AXIS, angle);
    camera.quaternion.multiply(kickQuat);
  }

  function fireRay(weapon, pellet) {
    camera.getWorldDirection(direction);
    right.crossVectors(direction, UP).normalize();
    upv.crossVectors(right, direction).normalize();
    const spread = currentSpread();
    const rx = (Math.random() + Math.random() - 1) * spread;
    const ry = (Math.random() + Math.random() - 1) * spread;
    direction.addScaledVector(right, rx).addScaledVector(upv, ry).normalize();
    raycaster.set(camera.position, direction);
    raycaster.far = 90;
    const hits = raycaster.intersectObjects(scene.children, true);
    const hit = hits.find((entry) => !entry.object.userData.viewModel && !entry.object.userData.fx
      && !entry.object.userData.noRay && entry.distance > 0.3);
    viewModel.muzzleWorld(muzzle);
    if (!hit) {
      fx.tracer(muzzle, temp.copy(camera.position).addScaledVector(direction, 90));
      return;
    }
    if (!pellet) fx.tracer(muzzle, hit.point);
    const enemy = hit.object.userData.enemy;
    if (enemy) {
      const zone = hit.object.userData.zone || 'torso';
      game.hits += 1;
      const killed = guards.damage(enemy, weapon.damage, zone);
      fx.blood(hit.point);
      audio.blood(hit.point);
      ui.hitmarker(killed, zone === 'head');
      return;
    }
    if (hit.object.userData.kind === 'barrel') {
      hit.object.userData.health -= weapon.damage;
      if (hit.object.userData.health <= 0) detonateBarrel(hit.object);
    }
    const metal = hit.object.material?.metalness > 0.4 || hit.object.userData.kind === 'barrel';
    if (hit.face) {
      normal.copy(hit.face.normal).transformDirection(hit.object.matrixWorld);
      fx.impact(hit.point, metal ? 0xffd277 : 0xcbb998, normal);
    } else {
      fx.impact(hit.point, metal ? 0xffd277 : 0xcbb998);
    }
    audio.impact(hit.point, metal);
    if (!metal && Math.random() < 0.18) audio.ricochet(hit.point);
  }

  const temp = new THREE.Vector3();

  function throwGrenade() {
    if (projectiles.length >= 2) return;
    camera.getWorldDirection(direction);
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 8), new THREE.MeshStandardMaterial({ color: 0x334036, metalness: 0.65 }));
    mesh.userData.fx = true;
    mesh.position.copy(camera.position).addScaledVector(direction, 0.8);
    scene.add(mesh);
    projectiles.push({ mesh, velocity: direction.clone().multiplyScalar(10).add(new THREE.Vector3(0, 3.2, 0)), fuse: 2.15 });
  }

  function useMine() {
    if (mine) { explode(mine.position.clone(), 6); scene.remove(mine); mine = null; return; }
    mine = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.08, 16), new THREE.MeshStandardMaterial({ color: 0x354438, emissive: 0x183c25 }));
    mine.userData.fx = true;
    mine.position.copy(camera.position).setY(0.08);
    scene.add(mine);
  }

  function detonateBarrel(barrel) {
    if (barrel.userData.exploded) return;
    barrel.userData.exploded = true;
    explode(barrel.position.clone(), 5.5);
    barrel.visible = false;
  }

  function explode(position, radius) {
    fx.explosion(position, radius);
    audio.explosion(position);
    guards.notifyNoise(position, radius * 5, game.time);
    guards.enemies.forEach((enemy) => {
      if (!enemy.alive) return;
      const distance = enemy.root.position.distanceTo(position);
      if (distance < radius && hasLineOfSight(world, position, enemy.root.position)) guards.damage(enemy, 120 * (1 - distance / radius), 'torso');
    });
    const playerDistance = camera.position.distanceTo(position);
    if (playerDistance < radius && hasLineOfSight(world, position, camera.position)) damagePlayer(72 * (1 - playerDistance / radius));
    world.barrelMeshes.forEach((barrel) => {
      if (!barrel.userData.exploded && barrel.position.distanceTo(position) < radius * 0.8) {
        window.setTimeout(() => detonateBarrel(barrel), 100 + Math.random() * 260);
      }
    });
  }

  function update(dt) {
    cooldown -= dt;
    if (reloadTimer > 0) {
      reloadTimer -= dt;
      if (reloadTimer <= 0) completeReload();
    }
    bloom = Math.max(0, bloom - dt * CONFIG.bloomDecay);
    if (recoverable > 0.0001) {
      const step = recoverable * Math.min(1, dt * CONFIG.recoilRecover);
      pitchCamera(-step);
      recoverable -= step;
    }
    const wantAds = input.aiming && reloadTimer <= 0 && !game.player.sprinting;
    adsT += ((wantAds ? 1 : 0) - adsT) * Math.min(1, dt * CONFIG.adsSpeed);
    if (!input.firing) triggerReady = true;
    const weapon = WEAPONS[game.currentWeapon];
    if (input.firing && cooldown <= 0 && reloadTimer <= 0 && (weapon.auto || triggerReady)) {
      shoot();
      triggerReady = false;
    }
    if (input.consume('KeyR')) reload();
    if (input.consume('KeyG')) throwGrenade();
    if (input.consume('KeyQ')) useMine();
    if (input.consume('WheelDown')) cycleWeapon(1);
    if (input.consume('WheelUp')) cycleWeapon(-1);
    ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5'].forEach((code, index) => {
      if (input.consume(code)) switchWeapon(Object.keys(WEAPONS).find((id) => WEAPONS[id].slot === index + 1));
    });
    const look = input.consumeLook();
    viewModel.update({
      dt, time: game.time, moving: playerMoving(), sprinting: Boolean(game.player.sprinting),
      adsT, lookX: look.x, lookY: look.y,
      reloadT: reloadTimer > 0 ? 1 - reloadTimer / reloadTotal : -1,
    });
    game.view.adsT = adsT;
    game.view.spread = currentSpread();
    game.view.bloom = bloom;
    ui.crosshair(game.view);
    for (let i = projectiles.length - 1; i >= 0; i -= 1) updateGrenade(projectiles[i], i, dt);
  }

  function playerMoving() {
    return input.held('KeyW') || input.held('KeyA') || input.held('KeyS') || input.held('KeyD');
  }

  function updateGrenade(grenade, index, dt) {
    grenade.fuse -= dt;
    grenade.velocity.y -= 12 * dt;
    origin.copy(grenade.mesh.position);
    grenade.mesh.position.addScaledVector(grenade.velocity, dt);
    if (grenade.mesh.position.y < 0.14) { grenade.mesh.position.y = 0.14; grenade.velocity.y *= -0.48; grenade.velocity.multiplyScalar(0.82); }
    const cell = world.toCell(grenade.mesh.position);
    if (!world.walkable(cell.x, cell.z)) { grenade.mesh.position.copy(origin); grenade.velocity.x *= -0.55; grenade.velocity.z *= -0.55; }
    if (grenade.fuse <= 0) {
      explode(grenade.mesh.position.clone(), 6.5);
      scene.remove(grenade.mesh);
      projectiles.splice(index, 1);
    }
  }

  return { update, switchWeapon, reload, explode, dispose() { viewModel.dispose(); camera.remove(flashlight, flashlightTarget, fill); projectiles.forEach(({ mesh }) => scene.remove(mesh)); if (mine) scene.remove(mine); } };
}
