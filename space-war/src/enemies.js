// enemies.js — Frota inimiga da CAMPANHA: frames BODY-RELATIVOS (o inimigo co-move
// com o corpo que ele guarda — offset local, não posição absoluta), papéis
// (fighter patrulha/persegue · interceptor caça de longe · station fixa · bomber
// lança BOMBAS balísticas sob gravidade), spawn POR FASE e fogo com OCLUSÃO do
// corpo-âncora + zona segura da Terra.

import * as THREE from '../../vendor/three.module.min.js';
import { scene } from './scene.js';
import { game } from './state.js';
import { enemyFire, enemyBomb } from './weapons.js';
import { higgsWellAccel } from './celestial/physics.js';

const _to = new THREE.Vector3();
const _side = new THREE.Vector3();
const _ab = new THREE.Vector3();
const _ap = new THREE.Vector3();
const _cl = new THREE.Vector3();

const ESCALE = 14;   // escala das naves inimigas (mundo é grande)

function fighterMesh(color = 0x551122, eye = 0xff3322) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.OctahedronGeometry(2.2, 0),
    new THREE.MeshStandardMaterial({ color, emissive: 0x330011, metalness: 0.6, roughness: 0.4 }));
  body.scale.set(1, 0.5, 1.4); g.add(body);
  const e = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 8),
    new THREE.MeshBasicMaterial({ color: eye }));
  e.position.set(0, 0, -1.6); g.add(e);
  g.scale.setScalar(ESCALE);
  return g;
}
function bomberMesh() {
  const g = fighterMesh(0x4a3311, 0xffaa33);
  g.scale.setScalar(ESCALE * 1.5);   // mais gordo — lê como bombardeiro
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

// ── Spawn body-relativo: guarda o OFFSET local (ângulo/raio/altura) — a posição
// mundial é derivada do worldPos do âncora a cada frame (co-move de graça). ──
function spawnNear(body, count, opts = {}) {
  if (!body) return;
  const R = body.def.radius;
  for (let i = 0; i < count; i++) {
    const role = opts.station && i === 0 ? 'station'
      : (opts.bombers && i < (opts.station ? 1 : 0) + opts.bombers) ? 'bomber'
      : 'fighter';
    const g = role === 'station' ? stationMesh() : role === 'bomber' ? bomberMesh() : fighterMesh();
    const e = {
      group: g, dead: false, role, anchor: body, phaseKey: opts.phaseKey || 'solar',
      hp: role === 'station' ? 220 : role === 'bomber' ? 90 : 50,
      radius: role === 'station' ? ESCALE * 9 : ESCALE * 3,
      a: Math.random() * Math.PI * 2,                       // ângulo local
      r: R * (1.3 + Math.random() * 0.9),                   // raio local (1.3–2.2 R)
      y: (Math.random() - 0.5) * R * 0.5,                   // altura local
      spd: role === 'station' ? 0 : dtRate(role),           // taxa angular da patrulha
      cd: Math.random() * 2,
      chasing: false,
    };
    localToWorld(e, g.position);
    scene.add(g);
    game.enemies.push(e);
  }
}
function dtRate(role) { return role === 'bomber' ? 0.16 : 0.3; }
function localToWorld(e, out) {
  const b = e.anchor;
  return out.set(
    b.worldPos.x + Math.cos(e.a) * e.r,
    b.worldPos.y + e.y,
    b.worldPos.z + Math.sin(e.a) * e.r,
  );
}

// ── Spawns por fase da campanha (chamado por missions.startMissions/advance) ──
const PHASE_SPAWNS = {
  solar: [
    { key: 'mars', n: 4 },
    { key: 'jupiter', n: 6, station: true, bombers: 2 },
    { key: 'saturn', n: 4 },
  ],
  betelgeuse: [
    { key: 'brasa', n: 6, bombers: 2 },
    { key: 'fuligem', n: 4, station: true },
  ],
  binary: [
    { key: 'blackhole', n: 4, station: true, bombers: 1 },
    { key: 'devorada', n: 2, station: true },
  ],
  pulsar: [
    { key: 'neutron', n: 2, station: true },
    { key: 'sentinela', n: 4, bombers: 1 },
  ],
  core: [
    { key: 's6', n: 5, station: true, bombers: 2 },
    { key: 'err1', n: 3 },
  ],
};

const byKey = (k) => game.bodies.find((b) => b.def.key === k);

export function spawnPhase(phaseKey) {
  const specs = PHASE_SPAWNS[phaseKey] || [];
  for (const s of specs) spawnNear(byKey(s.key), s.n, { ...s, phaseKey });
}

// Escolta de alvo da caçada: 3 caças nascem junto com cada base/nave capital.
export function spawnEscort(body, phaseKey) { spawnNear(body, 3, { phaseKey }); }

// FASES (T-PR-06): inimigos são ancorados em corpos do sistema — morrem com a
// fase no unload (era o vazamento "inimigos de fases antigas atualizam p/ sempre").
export function clearEnemies() {
  for (const e of game.enemies) {
    scene.remove(e.group);
    e.group.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) o.material.dispose();
    });
  }
  game.enemies.length = 0;
}

// ── Oclusão analítica: o segmento inimigo→nave cruza a esfera do corpo-âncora? ──
// (o âncora é de longe o oclusor dominante — planetas vizinhos raramente alinham)
function occluded(e, shipPos) {
  const b = e.anchor;
  _ab.copy(shipPos).sub(e.group.position);
  const len2 = _ab.lengthSq();
  if (len2 < 1e-6) return false;
  _ap.copy(b.worldPos).sub(e.group.position);
  const t = Math.max(0, Math.min(1, _ap.dot(_ab) / len2));
  _cl.copy(e.group.position).addScaledVector(_ab, t);
  return _cl.distanceTo(b.worldPos) < b.def.radius * 0.98;
}

// O jogador só é engajável voando, fora da proteção e perto da região defendida.
function canEngage(e, distToShip) {
  const s = game.ship;
  if (s.landed || s.spawnGrace > 0) return false;
  const range = e.role === 'station' ? 1400 : e.role === 'bomber' ? 3000 : 1100;
  if (distToShip > range) return false;
  return !occluded(e, s.pos);
}

const _wellPull = new THREE.Vector3();
// POLISH (audit T-PR-09): inimigos SENTEM os poços de Higgs. A IA cinemática
// compensa a gravidade dos corpos com empuxo (crível), mas um poço TRANSIENTE
// de 600 u/s² ninguém compensa — sem isto, o poço vergava todo projétil da
// cena e deixava os caças parados (quebra visível da fantasia "todos sentem").
// Bias por deslocamento: o offset local não muda; a posição desenhada desloca.
function applyWellBias(e, dt) {
  if (!game.wells || !game.wells.length) return;
  for (const w of game.wells) {
    if (game.time > w.until) continue;
    _wellPull.copy(w.pos).sub(e.group.position);
    const d = _wellPull.length();
    const a = higgsWellAccel(d, w);
    if (a <= 0) continue;
    // deslocamento ~½·a·dt² acumulado como arrasto direto (IA sem velocidade
    // própria): desloca rumo ao poço proporcional à força
    e.group.position.addScaledVector(_wellPull.normalize(), a * dt * dt * 18);
  }
}

export function updateEnemies(dt) {
  const ship = game.ship;
  for (const e of game.enemies) {
    if (e.dead) continue;

    if (e.role === 'station') {
      // estação: offset local FIXO — co-move e gira
      localToWorld(e, e.group.position);
      e.group.rotation.z += dt * 0.4;
      applyWellBias(e, dt);
    } else {
      const distToShip = e.group.position.distanceTo(ship.pos);
      e.chasing = e.role !== 'bomber' && distToShip < 2500;
      if (e.chasing) {
        // perseguição: lerp até o jogador + arrasto do frame do âncora
        _to.copy(ship.pos);
        e.group.position.lerp(_to, dt * 0.35);
      } else {
        // patrulha body-relativa: o offset gira; a posição é DERIVADA do âncora
        e.a += dt * e.spd;
        localToWorld(e, _to);
        e.group.position.lerp(_to, dt * 2.5);   // suaviza transição pós-perseguição
      }
      applyWellBias(e, dt);
      e.group.lookAt(ship.pos);
    }

    // fogo por papel
    const distToShip = e.group.position.distanceTo(ship.pos);
    if (!canEngage(e, distToShip)) continue;
    e.cd -= dt;
    if (e.cd > 0) continue;
    if (e.role === 'bomber') {
      e.cd = 4.5 + Math.random() * 2;
      // bomba balística: arremessada na direção do jogador, herdando a
      // velocidade do frame do âncora — a GRAVIDADE curva o resto do caminho.
      _side.copy(ship.pos).sub(e.group.position).normalize();
      const v = _side.multiplyScalar(520);
      if (e.anchor.worldVel) v.add(e.anchor.worldVel);
      enemyBomb(e.group.position.clone().addScaledVector(_side, 4), v);
    } else if (e.role === 'station') {
      e.cd = 1.3;
      _side.copy(ship.pos).sub(e.group.position).normalize();
      // POLISH (T-PR-09): o laser herda a velocidade do FRAME do âncora — como
      // as bombas do bomber já faziam; sem isto, perto de corpos railed
      // rápidos, os bolts atrasavam sistematicamente atrás do atirador.
      enemyFire(e.group.position.clone().addScaledVector(_side, 9), _side, e.anchor.worldVel);
    } else {
      e.cd = 1.6 + Math.random();
      _side.copy(ship.pos).sub(e.group.position).normalize();
      enemyFire(e.group.position.clone().addScaledVector(_side, 3), _side, e.anchor.worldVel);
    }
  }
}
