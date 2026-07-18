// rod-missiles.js — Míssil "rod" cinético (R): 2x mais rápido que o leve, perfura em
// cadeia até 3 alvos dentro do raio de ação da nuke, matando cada um instantaneamente
// (sem warhead/splash — só um flash de impacto por kill). D-3.
// Exporta: spawnRodMissile, updateRodMissiles, clearRodMissiles.
//
// D-2/D-3: a seleção da cadeia de alvos usa `selectRodTargets` (weapons-core.js, pura,
// Node-testável); este módulo é o pool visual/homing runtime (DOM/THREE), como
// projectiles.js é para os mísseis leve/pesado.

import * as THREE from '../../../../vendor/three.module.min.js';
import { scene } from './scene.js';
import { audio } from './audio.js';
import { game } from './state.js';
import { MISSILES_ROD, MISSILES_NUCLEAR } from './config.js';
import { spawnMuzzleFlash, spawnMissileSmoke } from './fx.js';
import { damageTarget } from './targets.js';
import { selectRodTargets } from './weapons-core.js';

const rods = [];
const _rdDir = new THREE.Vector3();

// Margem de vida garantida por perna do chain (mesmo princípio do T-02, sem hit-roll —
// o rod SEMPRE perfura os alvos já selecionados na cadeia, não há resultado MISS).
const LIFE_MARGIN_FACTOR = 1.4;
const LIFE_MARGIN_SECONDS = 2.0;
const HIT_RADIUS_MULT = 2.5; // mesmo multiplicador de raio de impacto usado em projectiles.js

function legLife(fromPos, toPos) {
  const dist = fromPos.distanceTo(toPos);
  return Math.max(0.2, (dist / MISSILES_ROD.TRACKING_SPD) * LIFE_MARGIN_FACTOR + LIFE_MARGIN_SECONDS);
}

/** Constrói o mesh do rod: haste fina e alongada (silhueta cinética, sem ogiva). */
function buildRodMesh() {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color: 0xd8d8de });
  const finMat = new THREE.MeshLambertMaterial({ color: 0x8a8a92 });

  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 1.6, 8), bodyMat);
  body.rotation.x = Math.PI / 2;
  g.add(body);

  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.28, 8), bodyMat);
  nose.rotation.x = -Math.PI / 2;
  nose.position.z = -0.94;
  g.add(nose);

  for (let i = 0; i < 4; i++) {
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.24, 0.26), finMat);
    fin.rotation.z = (i * Math.PI) / 2;
    fin.position.z = 0.68;
    g.add(fin);
  }

  return g;
}

/** Seleciona a cadeia de até 3 alvos válidos e lança o rod.
 * @param orig posição de disparo (THREE.Vector3-like)
 * @param seedTarget alvo travado no momento do disparo, ou null (sem lock)
 * @param jetQuat quaternion do jato no disparo (direção inicial) */
export function spawnRodMissile(orig, seedTarget, jetQuat) {
  if (game.player.rodMissiles <= 0) return;

  const actionRadius = MISSILES_NUCLEAR.BLAST_RADIUS; // D-3: reusa a constante, não copia
  const r2 = actionRadius * actionRadius;
  const validSeed = seedTarget && !seedTarget.dead &&
    orig.distanceToSquared(seedTarget.mesh.position) <= r2 ? seedTarget : null;

  const pool = validSeed ? game.targets.filter((t) => t !== validSeed) : game.targets;
  const rest = selectRodTargets(pool, orig, actionRadius, validSeed ? 2 : 3);
  const chain = validSeed ? [validSeed, ...rest] : rest;
  if (chain.length === 0) return; // nenhum alvo válido no raio — não gasta munição

  // CONTRATO: writer de game.player.rodMissiles
  game.player.rodMissiles -= 1;

  const mesh = buildRodMesh();
  mesh.position.copy(orig);
  mesh.quaternion.copy(jetQuat);
  scene.add(mesh);
  const vel = new THREE.Vector3(0, 0, -1).applyQuaternion(jetQuat).multiplyScalar(MISSILES_ROD.INITIAL_SPD);

  rods.push({
    mesh,
    velocity: vel,
    chain,       // fila de alvos restantes — chain[0] é o alvo perseguido agora
    kills: 0,
    life: legLife(orig, chain[0].mesh.position),
    smokeTimer: 0,
  });
  audio.missile();
}

/** Atualiza rods: homing agressivo (sempre converge) + perfuração em cadeia. */
export function updateRodMissiles(dt) {
  for (let i = rods.length - 1; i >= 0; i--) {
    const r = rods[i];
    r.life -= dt;

    // Descarta da cadeia alvos já mortos por outra arma antes de perseguir.
    while (r.chain.length && r.chain[0].dead) r.chain.shift();
    if (r.chain.length === 0) { scene.remove(r.mesh); rods.splice(i, 1); continue; }

    const target = r.chain[0];
    _rdDir.subVectors(target.mesh.position, r.mesh.position).normalize().multiplyScalar(MISSILES_ROD.TRACKING_SPD);
    r.velocity.lerp(_rdDir, MISSILES_ROD.TURN_RATE);
    r.mesh.position.addScaledVector(r.velocity, dt);

    if (r.velocity.lengthSq() > 0.01) {
      _rdDir.copy(r.velocity).normalize();
      r.mesh.lookAt(
        r.mesh.position.x + _rdDir.x,
        r.mesh.position.y + _rdDir.y,
        r.mesh.position.z + _rdDir.z,
      );
    }

    r.smokeTimer -= dt;
    if (r.smokeTimer <= 0) { r.smokeTimer = 0.05; spawnMissileSmoke(r.mesh.position); }

    const hr2 = target.hr2 * HIT_RADIUS_MULT;
    const inRange = r.mesh.position.distanceToSquared(target.mesh.position) < hr2;
    // Garantia de perfuração (D-3): a margem de vida calculada por perna deve tornar a
    // colisão natural o caminho comum; se a vida está prestes a esgotar sem impacto
    // natural, força o impacto agora — mesma rede de segurança do T-02.
    if (inRange || r.life <= 0) {
      // Cinético: SEM explosion()/warhead FX — só o flash de impacto pooled.
      spawnMuzzleFlash(r.mesh.position);
      damageTarget(target, MISSILES_ROD.DAMAGE);
      r.kills += 1;
      r.chain.shift();

      if (r.chain.length > 0) {
        // Reabastece vida para a próxima perna do chain (nova distância) e segue.
        r.life = legLife(r.mesh.position, r.chain[0].mesh.position);
      } else {
        scene.remove(r.mesh);
        rods.splice(i, 1);
      }
    }
  }
}

/** Limpa todos os rods (para restartGame). */
export function clearRodMissiles() {
  for (const r of rods) if (r.mesh?.parent) scene.remove(r.mesh);
  rods.length = 0;
}
