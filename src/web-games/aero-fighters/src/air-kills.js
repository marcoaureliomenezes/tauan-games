// air-kills.js — queda cinematográfica dos inimigos AÉREOS no modo voo
// (2026-08-11): helicóptero, dirigível e variantes de formação não somem mais
// numa explosão instantânea — entram em queda (parafuso/planeio/pique) com
// trilha de fumaça+fogo, debris se soltando e impacto no terreno real.
//
// REUSO deliberado: a física da queda é a MESMA do modo defesa —
// startDying/stepDying de defense/enemy-fighters.js (puras, Node-testáveis).
// Este módulo só adapta o formato alvo-de-voo (t.mesh) ao registro de queda e
// orquestra os FX de fx.js (spawnFallTrail/spawnShedDebris/spawnSmokeColumn).
//
// Dirigível (patrolAir/fZeppelin): flutuante — cai SEM parafuso, em colapso
// lento (cfg próprio com sink reduzido), ardendo.
//
// Exporta: beginAirKillFall, updateAirKills, clearAirKills, activeAirFalls.

import { game } from './state.js';
import { scene } from './scene.js';
import { audio } from './audio.js';
import { AA_DEFENSE } from './config.js';
import { startDying, stepDying } from './defense/enemy-fighters.js';
import { explosion, spawnShockwave, spawnFallTrail, spawnShedDebris, spawnSmokeColumn } from './fx.js';
import { getActiveHeightFn } from './world.js';
import { syncMemberMatrix } from './formations/formation.js';

/** Tipos de game.targets que caem em vez de evaporar. */
export const AIR_KILL_TYPES = new Set(['helicopter', 'patrolAir', 'fHelicopter', 'fZeppelin']);

/** Cfg de queda do dirigível: colapso lento e pesado, sem pique. */
const ZEPPELIN_FALL_CFG = {
  ...AA_DEFENSE,
  FALL_GRAVITY: 9,
  FALL_SINK: { spiral: [10, 18], glide: [8, 14], dive: [12, 20] },
  FALL_DEBRIS: [3, 5],
};

const HORIZONTAL_SPEED = { helicopter: 14, fHelicopter: 14, patrolAir: 7, fZeppelin: 5 };

const fallers = [];

/** Entrega um alvo aéreo recém-morto à queda. O mesh continua na cena (ou no
 *  grupo da formação) e é animado até o impacto. Retorna o registro (teste). */
export function beginAirKillFall(t, rng = null) {
  const rngFn = rng || (() => game.rng.random());
  const isZep = t.type === 'patrolAir' || t.type === 'fZeppelin';
  const p = t.mesh.position;
  const f = {
    x: p.x, y: p.y, z: p.z,
    yaw: t.mesh.rotation.y,
    pitch: 0, roll: 0,
    speed: HORIZONTAL_SPEED[t.type] ?? 12,
    vx: 0, vy: 0, vz: 0,
  };
  const cfg = isZep ? ZEPPELIN_FALL_CFG : AA_DEFENSE;
  startDying(f, rngFn, cfg);
  if (isZep) f.fallStyle = 'glide'; // dirigível nunca faz parafuso/pique
  const rec = { t, f, cfg, trailT: 0, impacted: false };
  fallers.push(rec);
  audio.hit();
  return rec;
}

/** Um passo de todas as quedas ativas. Chamado pelo tick de main.js. */
export function updateAirKills(dt) {
  if (!fallers.length) return;
  const heightAt = getActiveHeightFn();
  const ctx = { heightAt: (x, z) => heightAt(x, z), rng: () => game.rng.random() };
  for (let i = fallers.length - 1; i >= 0; i--) {
    const rec = fallers[i];
    const { t, f } = rec;
    const events = stepDying(f, dt, ctx, rec.cfg);
    // Aplica o estado da queda ao mesh (mundo == local: grupos na origem).
    t.mesh.position.set(f.x, f.y, f.z);
    t.mesh.rotation.set(f.pitch, f.yaw, f.roll);
    if (t.member) syncMemberMatrix(t.member); // membro instanciado (batch)
    // Trilha de fumaça+fogo densa durante a queda.
    rec.trailT -= dt;
    if (rec.trailT <= 0) {
      rec.trailT = rec.cfg.FALL_TRAIL_S;
      spawnFallTrail(t.mesh.position);
    }
    for (const ev of events) {
      if (ev.type === 'shed') {
        spawnShedDebris({ x: ev.x, y: ev.y, z: ev.z }, { x: ev.vx, y: ev.vy, z: ev.vz });
      } else if (ev.type === 'impact') {
        // Impacto: explosão + onda + coluna de fumaça; o wreck fica no chão,
        // adernado e chamuscado (não remove o mesh — destroço narrativo).
        explosion(t.mesh.position, t.type === 'patrolAir' || t.type === 'fZeppelin' ? 2.4 : 1.8);
        spawnShockwave(t.mesh.position, 20);
        spawnSmokeColumn(t.mesh.position, rec.cfg.FALL_COLUMN_S);
        audio.explosion();
        t.mesh.rotation.set(0.12, f.yaw, 0.5 * (f.spinDir || 1));
        if (t.member) syncMemberMatrix(t.member);
        darkenWreck(t.mesh);
        rec.impacted = true;
      }
    }
    if (rec.impacted) fallers.splice(i, 1);
  }
}

/** Escurece o wreck (chamuscado) sem tocar materiais compartilhados de batch. */
function darkenWreck(mesh) {
  mesh.traverse?.((o) => {
    if (o.isMesh && o.material && !o.material._wreckCloned) {
      o.material = o.material.clone();
      o.material._wreckCloned = true;
      if (o.material.color) o.material.color.multiplyScalar(0.35);
    }
  });
}

/** Nº de quedas ativas (HUD/debug/testes). */
export function activeAirFalls() {
  return fallers.length;
}

/** Limpa todas as quedas (restartGame): remove meshes soltos da cena. */
export function clearAirKills() {
  for (const rec of fallers) {
    if (rec.t.mesh?.parent === scene) scene.remove(rec.t.mesh);
  }
  fallers.length = 0;
}
