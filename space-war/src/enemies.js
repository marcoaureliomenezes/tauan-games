// enemies.js — Naves inimigas e estações perto de planetas/luas, com IA simples.

import * as THREE from '../../vendor/three.module.min.js';
import { scene } from './scene.js';
import { game } from './state.js';
import { enemyFire } from './weapons.js';

const _to = new THREE.Vector3();
const _side = new THREE.Vector3();

const ESCALE = 14;   // escala das naves inimigas (mundo é grande agora)

function fighterMesh() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.OctahedronGeometry(2.2, 0),
    new THREE.MeshStandardMaterial({ color: 0x551122, emissive: 0x330011, metalness: 0.6, roughness: 0.4 }));
  body.scale.set(1, 0.5, 1.4); g.add(body);
  const eye = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 8),
    new THREE.MeshBasicMaterial({ color: 0xff3322 }));
  eye.position.set(0, 0, -1.6); g.add(eye);
  g.scale.setScalar(ESCALE);
  return g;
}

function stationMesh() {
  const g = new THREE.Group();
  const ring = new THREE.Mesh(new THREE.TorusGeometry(8, 1.2, 10, 24),
    new THREE.MeshStandardMaterial({ color: 0x445566, metalness: 0.7, roughness: 0.4 }));
  g.add(ring);
  const core = new THREE.Mesh(new THREE.IcosahedronGeometry(3, 0),
    new THREE.MeshStandardMaterial({ color: 0x662233, emissive: 0x220011 }));
  g.add(core);
  g.scale.setScalar(ESCALE * 1.6);
  return g;
}

function spawnNear(body, count, opts = {}) {
  const R = body.def.radius;
  for (let i = 0; i < count; i++) {
    const isStation = opts.station && i === 0;
    const g = isStation ? stationMesh() : fighterMesh();
    const a = Math.random() * Math.PI * 2;
    const r = R * (1.3 + Math.random() * 0.9);          // patrulha a 1.3–2.2 raios do centro
    const pos = new THREE.Vector3(
      body.worldPos.x + Math.cos(a) * r,
      body.worldPos.y + (Math.random() - 0.5) * R * 0.5,
      body.worldPos.z + Math.sin(a) * r,
    );
    g.position.copy(pos);
    scene.add(g);
    game.enemies.push({
      group: g, hp: isStation ? 220 : 50, radius: isStation ? ESCALE * 9 : ESCALE * 3, dead: false,
      anchor: body, kind: isStation ? 'station' : 'fighter',
      orbitA: a, orbitR: r, cd: Math.random() * 2,
    });
  }
}

export function spawnEnemies() {
  const byKey = (k) => game.bodies.find((b) => b.def.key === k);
  // A vizinhança da Terra (incl. a Lua) é ZONA SEGURA — sem caças inimigos ali, senão
  // eles abatem a nave ainda na decolagem. Defensores ficam em corpos distantes.
  spawnNear(byKey('mars'), 4);
  spawnNear(byKey('jupiter'), 6, { station: true });
  spawnNear(byKey('saturn'), 4);
}

// O jogador só é "engajável" quando está voando, fora da proteção inicial e
// próximo do corpo-âncora do inimigo (chegou na região defendida).
function canEngage(e, distToShip) {
  const s = game.ship;
  if (s.landed || s.spawnGrace > 0) return false;
  return distToShip < (e.kind === 'station' ? 1400 : 1100);
}

export function updateEnemies(dt) {
  const ship = game.ship;
  for (const e of game.enemies) {
    if (e.dead) continue;
    if (e.kind === 'fighter') {
      // patrulha em torno do corpo-âncora
      e.orbitA += dt * 0.3;
      const b = e.anchor;
      _to.set(b.worldPos.x + Math.cos(e.orbitA) * e.orbitR, b.worldPos.y, b.worldPos.z + Math.sin(e.orbitA) * e.orbitR);
      const distToShip = e.group.position.distanceTo(ship.pos);
      if (distToShip < 2500) {
        // persegue o jogador
        _to.copy(ship.pos);
        e.group.position.lerp(_to, dt * 0.35);
      } else {
        e.group.position.lerp(_to, dt * 0.6);
      }
      e.group.lookAt(ship.pos);
      // atira se em alcance, mirando e o jogador estiver engajável
      if (canEngage(e, distToShip)) {
        e.cd -= dt;
        if (e.cd <= 0) {
          e.cd = 1.6 + Math.random();
          _side.copy(ship.pos).sub(e.group.position).normalize();
          enemyFire(e.group.position.clone().addScaledVector(_side, 3), _side);
        }
      }
    } else {
      // estação: gira e dispara em alcance maior
      e.group.rotation.z += dt * 0.4;
      const distToShip = e.group.position.distanceTo(ship.pos);
      if (canEngage(e, distToShip)) {
        e.cd -= dt;
        if (e.cd <= 0) {
          e.cd = 1.3;
          _side.copy(ship.pos).sub(e.group.position).normalize();
          enemyFire(e.group.position.clone().addScaledVector(_side, 9), _side);
        }
      }
    }
  }
}
