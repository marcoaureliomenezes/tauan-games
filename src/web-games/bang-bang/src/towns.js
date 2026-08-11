// towns.js — Western towns: false-front buildings along a main street, NPC
// walkers strolling between waypoints, and a horse-drawn wagon on a loop route.
// Exports: spawnTowns, updateTowns. To change layout/densities, edit TOWN in config.js.

import * as THREE from '../../vendor/three.module.min.js';
import { WORLD, TOWN, COLLISION } from './config.js';
import { game } from './state.js';
import { makeActor, moveToward } from './actors.js';
import { makeBuilding } from './buildings.js';
import { registerCollider } from './collision.js';
import { mulberry32 } from './noise.js';

const BUILDING_DEFS = [
  { name: 'saloon', color: 0x9a5a30, w: 7, h: 4.2, d: 9 },
  { name: 'bank', color: 0xb0a890, w: 6, h: 4.0, d: 7 },
  { name: 'hotel', color: 0x7a6a8a, w: 7, h: 5.0, d: 9 },
  { name: 'store', color: 0x8a7a4a, w: 6, h: 3.6, d: 8 },
  { name: 'sheriff', color: 0x6a7a8a, w: 5, h: 3.4, d: 6 },
];

/** Procedural horse-drawn wagon (cargo box + wheels + a simple horse shape). */
function makeWagonTeam() {
  const g = new THREE.Group();
  const wood = 0x7a5a30;
  const cargo = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.7, 3), new THREE.MeshLambertMaterial({ color: wood }));
  cargo.position.set(0, 0.85, -1.2);
  g.add(cargo);
  const canvas = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.7, 2.4), new THREE.MeshLambertMaterial({ color: 0xd8cfb8 }));
  canvas.position.set(0, 1.5, -1.2);
  g.add(canvas);
  const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.1, 10);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x4a3018 });
  for (const [wx, wz] of [[-0.95, -2.2], [0.95, -2.2], [-0.95, -0.2], [0.95, -0.2]]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.z = Math.PI / 2;
    w.position.set(wx, 0.42, wz);
    g.add(w);
  }
  // Simple horse ahead (matches the procedural fallback style)
  const horseMat = new THREE.MeshLambertMaterial({ color: 0x6b4a2a });
  const horseBody = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.65, 1.6), horseMat);
  horseBody.position.set(0, 1.15, 1.6);
  g.add(horseBody);
  const horseHead = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.55, 0.6), horseBody.material);
  horseHead.position.set(0, 1.65, 2.4);
  g.add(horseHead);
  for (const [lx, lz] of [[-0.18, 1.1], [0.18, 1.1], [-0.18, 2.1], [0.18, 2.1]]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.05, 0.85, 5), new THREE.MeshLambertMaterial({ color: 0x4a3018 }));
    leg.position.set(lx, 0.43, lz);
    g.add(leg);
  }
  g.traverse((m) => { if (m.isMesh) m.castShadow = true; });
  return g;
}

/** Places the 5 buildings along the main street of one town site. */
function buildStreet(scene, site) {
  const fx = Math.sin(site.yaw), fz = Math.cos(site.yaw);
  const px = fz, pz = -fx; // street perpendicular
  BUILDING_DEFS.forEach((def, i) => {
    const side = i % 2 === 0 ? 1 : -1;
    const along = (i - 2) * (TOWN.STREET_LEN / 4);
    const bx = site.x + fx * along + px * side * 9;
    const bz = site.z + fz * along + pz * side * 9;
    const b = makeBuilding(def);
    const by = game.world.heightAt(bx, bz);
    b.position.set(bx, by, bz);
    b.rotation.y = site.yaw + (side > 0 ? -Math.PI / 2 : Math.PI / 2);
    scene.add(b);
    registerCollider(bx, bz, COLLISION.BUILDING_RADIUS, by + def.h + 2);
  });
}

/**
 * Builds both towns and registers them in game.entities.towns.
 * @param {THREE.Scene} scene @param {Array} sites from pickSites()
 */
export function spawnTowns(scene, sites) {
  const rng = mulberry32(WORLD.SEED + 555);
  for (const site of sites) {
    const town = { position: { x: site.x, z: site.z }, radius: site.radius, npcs: [], wagons: [], fx: Math.sin(site.yaw), fz: Math.cos(site.yaw) };
    buildStreet(scene, site);

    for (let i = 0; i < TOWN.NPCS_PER_TOWN; i++) {
      const key = i % 2 === 0 ? 'woman' : 'cowboy';
      const actor = makeActor(key, 1.7);
      const along = (rng() * 2 - 1) * TOWN.STREET_LEN / 2;
      actor.group.position.set(site.x + town.fx * along, 0, site.z + town.fz * along);
      actor.group.position.y = game.world.heightAt(actor.group.position.x, actor.group.position.z);
      scene.add(actor.group);
      actor.play('Walk');
      town.npcs.push({
        actor,
        dir: rng() < 0.5 ? -1 : 1, // which street end it's walking to
        wait: rng() * TOWN.NPC_WAIT_MAX,
      });
    }

    for (let w = 0; w < TOWN.WAGONS_PER_TOWN; w++) {
      const mesh = makeWagonTeam();
      scene.add(mesh);
      town.wagons.push({ mesh, angle: rng() * Math.PI * 2, cx: site.x, cz: site.z });
    }
    // CONTRACT: writer of game.entities.towns
    game.entities.towns.push(town);
  }
}

/** Per-frame town update: NPC strolls + wagon loops. @param {number} dt seconds */
export function updateTowns(dt) {
  for (const town of game.entities.towns) {
    for (const npc of town.npcs) {
      if (npc.wait > 0) {
        npc.wait -= dt;
        npc.actor.tick(dt);
        continue;
      }
      const along = npc.dir * TOWN.STREET_LEN / 2;
      const tx = town.position.x + town.fx * along;
      const tz = town.position.z + town.fz * along;
      if (moveToward(npc.actor, tx, tz, TOWN.NPC_WALK_SPD, dt)) {
        npc.dir = -npc.dir;
        npc.wait = Math.random() * TOWN.NPC_WAIT_MAX;
      }
      npc.actor.tick(dt);
    }
    for (const wagon of town.wagons) {
      wagon.angle += (TOWN.WAGON_SPD / TOWN.WAGON_LOOP_R) * dt;
      const x = wagon.cx + Math.cos(wagon.angle) * TOWN.WAGON_LOOP_R;
      const z = wagon.cz + Math.sin(wagon.angle) * TOWN.WAGON_LOOP_R;
      wagon.mesh.position.set(x, game.world.heightAt(x, z), z);
      wagon.mesh.rotation.y = Math.atan2(-Math.sin(wagon.angle), Math.cos(wagon.angle)) + Math.PI / 2;
    }
  }
}
