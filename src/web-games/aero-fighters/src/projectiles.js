// projectiles.js — Balas, mísseis homing e pickups (drops de munição).
// Exporta: spawnBullet, recycleBullet, updateBullets, spawnMissile, updateMissiles,
//   spawnPickup, updatePickups, spawnMgBullet, updateMgBullets, clearMgBullets,
//   spawnAaMissile, updateAaMissiles, clearAaMissiles,
//   spawnRodDart, updateRodDarts, clearRodDarts,
//   spawnDefenseNuke, updateDefenseNukes, clearDefenseNukes.
// Para adicionar projétil novo (foguete, bomba): novo pool aqui ou módulo dedicado.
//
// Acoplamento intencional: importa damageTarget de targets.js (exceção α — ver CONVENTIONS).

import * as THREE from '../../vendor/three.module.min.js';
import { scene } from './scene.js';
import { audio } from './audio.js';
import { game } from './state.js';
import { CANNON, MISSILES_LIGHT, MISSILES_HEAVY, MISSILES_NUCLEAR, COLORS, AA_DEFENSE } from './config.js';
import { explosion, spawnMissileSmoke, nuclearExplosion, spawnScorchMark, scheduleDelayed as fxDelay } from './fx.js';
import { spawnNuclearFx } from './nuclear-fx.js';
import { spawnFirestorm } from './firestorm.js';
import { damageTarget } from './targets.js';
import { deformTerrainNuclear, surfaceInfoAt } from './world.js';
import { addSmokeEmitter, removeSmokeEmittersOf } from './factory-fx.js';
import { transitionSortie, SortieEvent } from './sortie-state.js';
import { shaveCooldown } from './weapon-cooldowns.js';
import { rollMissileHit } from './weapons-core.js';
import { mgStepBullet, pnStep } from './defense/turret-weapons.js'; // T-D-04/T-D-05
import { pickRetarget, stepRod, stepNukeArc, stepNukeGuided, nightFactor } from './defense/weapons-v1.js'; // WEAPONS-V1

// ─── Balas ───────────────────────────────────────────────────────────────────
// Tracer estilo M61 Vulcan: cilindro alongado amarelo brilhante, trilhando atrás da bala
const BULLET_GEOM = new THREE.CylinderGeometry(0.06, 0.06, 2.0, 6);
BULLET_GEOM.rotateX(Math.PI / 2);
const BULLET_MAT  = new THREE.MeshBasicMaterial({ color: 0xfff080 });
const ENEMY_B_MAT = new THREE.MeshBasicMaterial({ color: COLORS.bulletEnemy });

const bulletPoolPlayer = [], bulletPoolEnemy = [];

/** Spawna uma bala. @param orig posição inicial @param dir direção normalizada
 *  @param opts (T-C-10) override de speed/life para o fogo de formação de Inhaúma
 *  (80 m/s desviável) — sem opts o inimigo legado segue a 56 m/s (demais mapas). */
export function spawnBullet(orig, dir, isEnemy = false, opts = null) {
  const pool = isEnemy ? bulletPoolEnemy : bulletPoolPlayer;
  let mesh = pool.pop();
  if (!mesh) mesh = new THREE.Mesh(BULLET_GEOM, isEnemy ? ENEMY_B_MAT : BULLET_MAT);
  mesh.position.copy(orig);
  // Aponta o tracer ao longo da direção de voo (cilindro estende-se atrás da bala)
  mesh.lookAt(orig.x + dir.x * 10, orig.y + dir.y * 10, orig.z + dir.z * 10);
  mesh.visible = true; scene.add(mesh);
  const spd = isEnemy ? (opts?.speed ?? 56) : CANNON.BULLET_SPD;
  // CONTRATO: writer de game.projectiles
  game.projectiles.push({
    mesh,
    velocity: new THREE.Vector3(dir.x * spd, dir.y * spd, dir.z * spd),
    life: opts?.life ?? CANNON.BULLET_LIFE,
    isEnemy,
  });
}

export function recycleBullet(p) {
  scene.remove(p.mesh); p.mesh.visible = false;
  (p.isEnemy ? bulletPoolEnemy : bulletPoolPlayer).push(p.mesh);
}

/** Atualiza todas as balas: move, checa hit em alvos (player) ou no jato (inimigo). */
export function updateBullets(dt, jetPos, onPlayerHit, wingmen = []) {
  const jx = jetPos.x, jy = jetPos.y, jz = jetPos.z;
  for (let i = game.projectiles.length - 1; i >= 0; i--) {
    const p = game.projectiles[i];
    p.mesh.position.x += p.velocity.x * dt;
    p.mesh.position.y += p.velocity.y * dt;
    p.mesh.position.z += p.velocity.z * dt;
    p.life -= dt;
    let consumed = false;
    if (!p.isEnemy) {
      for (const e of game.targets) {
        if (e.dead) continue;
        if (p.mesh.position.distanceToSquared(e.mesh.position) < e.hr2) {
          damageTarget(e, 1); consumed = true; break;
        }
      }
    } else if (game.flags.invincibility <= 0 && game.flags.rollTimer <= 0) {
      const dx = p.mesh.position.x - jx, dy = p.mesh.position.y - jy, dz = p.mesh.position.z - jz;
      const d2 = dx * dx + dy * dy + dz * dz;
      if (d2 < 4) { onPlayerHit(); consumed = true; }
      else if (d2 < 64) { audio.closeMiss(); }
      else {
        for (const wm of wingmen) {
          if (wm.dead || wm.falling) continue;
          const wx = p.mesh.position.x - wm.mesh.position.x;
          const wy = p.mesh.position.y - wm.mesh.position.y;
          const wz = p.mesh.position.z - wm.mesh.position.z;
          if (wx * wx + wy * wy + wz * wz < 9) {
            wm.hp -= 1;
            if (wm.hp <= 0) { wm.falling = true; wm.fallTimer = 3.0; }
            audio.hit();
            consumed = true;
            break;
          }
        }
      }
    }
    if (consumed || p.life <= 0) { recycleBullet(p); game.projectiles.splice(i, 1); }
  }
}

// ─── .50 da bateria antiaérea (T-D-04, modo inhauma-defense) ─────────────────
// Pool PRÓPRIO de tracers: a .50 tem balística real (queda leve, cap de
// alcance, impacto no terreno) — diferente das balas do jato (retas). EXTENSÃO
// aditiva: nenhum caller existente é tocado. A matemática (mgStepBullet) é
// pura em defense/turret-weapons.js; quem orquestra é o defense-mode.
const MG_TRACER_GEOM = new THREE.CylinderGeometry(0.27, 0.27, 11.9, 6); // calibre +70% (operador 2026-07-19)
MG_TRACER_GEOM.rotateX(Math.PI / 2);
const MG_TRACER_MAT = new THREE.MeshBasicMaterial({ color: 0xffe27a }); // tracer claro
// Mistura 1-em-4 (padrão real de fita .50): a cada 4 tiros um tracer maior e
// mais quente — lê bem de trás da bateria (os demais foreshortenam a pontos).
const MG_TRACER_BIG_GEOM = new THREE.CylinderGeometry(0.51, 0.51, 18.7, 6);
MG_TRACER_BIG_GEOM.rotateX(Math.PI / 2);
const MG_TRACER_BIG_MAT = new THREE.MeshBasicMaterial({ color: 0xffa133 });
const mgTracerPool = [], mgTracerBigPool = [], mgTracers = [];
let _mgShotCount = 0;

/** Spawna um tracer da .50 a partir da boca do cano. */
export function spawnMgBullet(orig, dir) {
  const big = (_mgShotCount++ % 4) === 3;
  const pool = big ? mgTracerBigPool : mgTracerPool;
  let mesh = pool.pop();
  if (!mesh) mesh = new THREE.Mesh(big ? MG_TRACER_BIG_GEOM : MG_TRACER_GEOM, big ? MG_TRACER_BIG_MAT : MG_TRACER_MAT);
  mesh.position.copy(orig);
  mesh.lookAt(orig.x + dir.x * 10, orig.y + dir.y * 10, orig.z + dir.z * 10);
  mesh.visible = true; scene.add(mesh);
  const s = AA_DEFENSE.MG_SPEED;
  mgTracers.push({
    mesh, big,
    x: orig.x, y: orig.y, z: orig.z,
    vx: dir.x * s, vy: dir.y * s, vz: dir.z * s,
    dist: 0,
  });
}

/** Atualiza os tracers da .50: balística real + alvos + terreno + cap de
 *  alcance. @param ctx {heightAt(x,z)?, targets[]?, onTargetHit(t, b)?, onTerrainHit(b)?} */
export function updateMgBullets(dt, ctx = {}) {
  for (let i = mgTracers.length - 1; i >= 0; i--) {
    const b = mgTracers[i];
    mgStepBullet(b, dt);
    b.mesh.position.set(b.x, b.y, b.z);
    let dead = b.dist >= AA_DEFENSE.MG_RANGE;
    if (!dead && ctx.targets) {
      for (const t of ctx.targets) {
        if (t.dead) continue;
        const dx = b.x - t.x, dy = b.y - t.y, dz = b.z - t.z;
        if (dx * dx + dy * dy + dz * dz < t.hr2) { ctx.onTargetHit?.(t, b); dead = true; break; }
      }
    }
    if (!dead && ctx.heightAt && b.y <= ctx.heightAt(b.x, b.z)) {
      ctx.onTerrainHit?.(b);
      dead = true;
    }
    if (dead) {
      scene.remove(b.mesh); b.mesh.visible = false;
      (b.big ? mgTracerBigPool : mgTracerPool).push(b.mesh);
      mgTracers.splice(i, 1);
    }
  }
}

/** Limpa os tracers da .50 (dispose do modo defesa). */
export function clearMgBullets() {
  for (const b of mgTracers) {
    scene.remove(b.mesh); b.mesh.visible = false;
    (b.big ? mgTracerBigPool : mgTracerPool).push(b.mesh);
  }
  mgTracers.length = 0;
}

// ─── Míssil AA da bateria (T-D-05, modo inhauma-defense) ─────────────────────
// Homing por navegação proporcional simplificada (pnStep, pura/Node-testável):
// velocidade > alvo, aceleração lateral capada, vida finita (autodestruição =
// miss documentado). Sem hit-roll: acerta/errado pela GEOMETRIA do envelope —
// EXCETO o roll de fase do T-W-08 (willHit=false ⇒ offset terminal seedado).
const aaMissiles = [];

// T-W-07: trilha discreta (~1 s de fade) + glow de propulsão noturno
const TRAIL_OPTS = { life: 1.0, opacity: 0.4, scale: 0.3, maxScale: 2.0 };
const NIGHT_GLOW_GEOM = new THREE.SphereGeometry(0.55, 6, 6);
const NIGHT_GLOW_MAT = new THREE.MeshBasicMaterial({
  color: 0xffaa33, transparent: true, opacity: 0.9,
  blending: THREE.AdditiveBlending, depthWrite: false,
});
/** Anexa o glow noturno (nasce invisível — o update liga à noite). */
function attachNightGlow(mesh, z, scale = 1) {
  const g = new THREE.Mesh(NIGHT_GLOW_GEOM, NIGHT_GLOW_MAT);
  g.position.z = z; g.scale.setScalar(scale); g.visible = false;
  mesh.add(g);
  return g;
}
const _nightNow = () => nightFactor(game.timeOfDay ?? 0.35) > 0.3;

/** Lança um míssil AA travado num alvo {x,y,z,vx,vy,vz,dead}.
 *  WEAPONS-V1: opts {damage, tier} — tier 'b' (forte, 1-hit) usa o mesh heavy;
 *  sem opts o dano default é letal (contrato anterior: 1-hit kill).
 *  T-W-08: opts.willHit — roll da fase da mira; false ⇒ offset terminal
 *  seedado (o míssil passa a poucos metros do alvo, sem dano). */
export function spawnAaMissile(orig, dir, target, opts = {}) {
  const mesh = buildMissileMesh(opts.tier === 'b' ? 'heavy' : 'light');
  mesh.position.copy(orig);
  scene.add(mesh);
  const s = AA_DEFENSE.AA_INITIAL_SPD;
  const m = {
    mesh, target,
    damage: opts.damage ?? Infinity, // default = contrato antigo (kill em 1 hit)
    willHit: opts.willHit ?? true,
    missOffset: null,
    x: orig.x, y: orig.y, z: orig.z,
    vx: dir.x * s, vy: dir.y * s, vz: dir.z * s,
    life: AA_DEFENSE.AA_LIFE, smokeTimer: 0,
    glow: attachNightGlow(mesh, 0.95, opts.tier === 'b' ? 1.5 : 1), // T-W-07
  };
  // T-W-08: MISS rolado — offset perpendicular seedado (LOCK_MISS_OFFSET m)
  if (m.willHit === false && target) {
    const tx = target.x - orig.x, tz = target.z - orig.z;
    let px = -tz, pz = tx; // perpendicular horizontal à linha de tiro
    const pl = Math.hypot(px, pz);
    if (pl < 1e-4) { px = 1; pz = 0; } else { px /= pl; pz /= pl; }
    const [oMin, oMax] = AA_DEFENSE.LOCK_MISS_OFFSET;
    const mag = oMin + game.rng.random() * (oMax - oMin);
    const side = game.rng.random() < 0.5 ? -1 : 1;
    m.missOffset = {
      x: px * mag * side,
      y: (game.rng.random() - 0.3) * mag * 0.6,
      z: pz * mag * side,
    };
  }
  aaMissiles.push(m);
  audio.missile();
}

const _aaAim = { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0 }; // scratch (offset MISS)

/** Atualiza os mísseis AA: PN + smoke trail + espoleta de proximidade.
 *  WEAPONS-V1: alvo morto em voo → RETARGET ao vivo mais próximo no cone à
 *  frente (ctx.targets); impacto aplica m.damage no HP do alvo (onHit por
 *  acerto não-letal, onKill quando zera). Sem ctx.targets o comportamento é o
 *  legado (balístico ao perder o alvo; kill direto na espoleta com dano ∞).
 *  T-W-08: willHit=false ⇒ PN mira no ponto deslocado (missOffset), o gate de
 *  dano nunca dispara e, ao passar do alvo, a vida encurta p/ o "quase acerto".
 *  @param ctx {heightAt(x,z)?, targets[]?, onKill(target)?, onHit(target)?} */
export function updateAaMissiles(dt, ctx = {}) {
  const fuse2 = AA_DEFENSE.AA_PROX_FUSE * AA_DEFENSE.AA_PROX_FUSE;
  const night = _nightNow(); // T-W-07
  for (let i = aaMissiles.length - 1; i >= 0; i--) {
    const m = aaMissiles[i];
    m.life -= dt;
    // T-W-03: órfão (alvo morreu) → retarget ao vivo mais próximo no cone.
    // O roll/offset era contra o alvo original: no novo alvo o homing é limpo.
    if (m.target && m.target.dead && ctx.targets) {
      m.target = pickRetarget(m, ctx.targets);
      if (m.target) { m.willHit = true; m.missOffset = null; }
    }
    if (m.target && !m.target.dead) {
      let aim = m.target;
      if (m.missOffset) { // T-W-08: MISS mira o ponto deslocado
        _aaAim.x = m.target.x + m.missOffset.x;
        _aaAim.y = m.target.y + m.missOffset.y;
        _aaAim.z = m.target.z + m.missOffset.z;
        _aaAim.vx = m.target.vx; _aaAim.vy = m.target.vy; _aaAim.vz = m.target.vz;
        aim = _aaAim;
      }
      pnStep(m, aim, dt);
      // T-W-08: MISS que já passou do alvo (afastando) encurta a vida —
      // "quase acerto" visível seguido de autodestruição
      if (m.willHit === false && m.life > 0.6) {
        const dx = m.target.x - m.x, dy = m.target.y - m.y, dz = m.target.z - m.z;
        if (dx * m.vx + dy * m.vy + dz * m.vz < 0) m.life = 0.6;
      }
    } else { m.x += m.vx * dt; m.y += m.vy * dt; m.z += m.vz * dt; } // sem alvo: balístico
    m.mesh.position.set(m.x, m.y, m.z);
    if (m.vx * m.vx + m.vy * m.vy + m.vz * m.vz > 0.01) {
      m.mesh.lookAt(m.x + m.vx, m.y + m.vy, m.z + m.vz);
    }
    if (m.glow) m.glow.visible = night; // T-W-07: chama só à noite
    m.smokeTimer -= dt;
    if (m.smokeTimer <= 0) { m.smokeTimer = 0.05; spawnMissileSmoke(m.mesh.position, TRAIL_OPTS); }

    let kill = false;
    // T-W-08: um MISS rolado NUNCA entra no gate de dano
    if (m.target && !m.target.dead && m.willHit !== false) {
      const dx = m.x - m.target.x, dy = m.y - m.target.y, dz = m.z - m.target.z;
      kill = dx * dx + dy * dy + dz * dz < fuse2;
    }
    const ground = ctx.heightAt && m.y <= ctx.heightAt(m.x, m.z);
    if (kill || ground || m.life <= 0) {
      explosion(m.mesh.position, kill ? 1.2 : 0.6, COLORS.fireYellow);
      audio.explosion(kill ? 0.8 : 0.4, m.mesh.position);
      if (kill) {
        // T-W-02: dano por tier (X avaria; B/default abate)
        m.target.hp -= m.damage;
        if (m.target.hp <= 0) ctx.onKill?.(m.target);
        else ctx.onHit?.(m.target);
      }
      scene.remove(m.mesh);
      aaMissiles.splice(i, 1);
    }
  }
}

/** Limpa os mísseis AA (dispose do modo defesa). */
export function clearAaMissiles() {
  for (const m of aaMissiles) if (m.mesh?.parent) scene.remove(m.mesh);
  aaMissiles.length = 0;
}

// ─── Rod cinético da bateria (T-W-04, weapons-v1) ────────────────────────────
// Dardo perfurante: 3× a velocidade do míssil fraco, PN direto, atravessa o
// caça abatido e retargeta ao vivo mais próximo — até ROD_PIERCE kills.
// Visual: tracer-dart fino e brilhante + trilha de fumaça curta.
const rodDarts = [];
const ROD_GEOM = new THREE.CylinderGeometry(0.16, 0.16, 7.5, 6);
ROD_GEOM.rotateX(Math.PI / 2);
const ROD_MAT = new THREE.MeshBasicMaterial({ color: 0xeaf6ff }); // dart branco-azulado

/** Lança um rod. @param target alvo inicial (lock ou mais próximo no cone) — pode ser null. */
export function spawnRodDart(orig, dir, target) {
  const mesh = new THREE.Mesh(ROD_GEOM, ROD_MAT);
  mesh.position.copy(orig);
  mesh.lookAt(orig.x + dir.x * 10, orig.y + dir.y * 10, orig.z + dir.z * 10);
  scene.add(mesh);
  const s = AA_DEFENSE.AA_SPEED * AA_DEFENSE.ROD_SPEED_MULT;
  rodDarts.push({
    mesh, target,
    x: orig.x, y: orig.y, z: orig.z,
    vx: dir.x * s, vy: dir.y * s, vz: dir.z * s,
    life: AA_DEFENSE.ROD_LIFE, pierceLeft: AA_DEFENSE.ROD_PIERCE, kills: 0, smokeTimer: 0,
    glow: attachNightGlow(mesh, 0, 1.2), // T-W-07
  });
  audio.missile();
}

/** Atualiza os rods: PN + perfuração em cadeia + retarget.
 *  @param ctx {heightAt(x,z)?, targets[]?, onRodKill(target, rod)?} */
export function updateRodDarts(dt, ctx = {}) {
  const night = _nightNow(); // T-W-07
  for (let i = rodDarts.length - 1; i >= 0; i--) {
    const r = rodDarts[i];
    // alvo morreu em voo (outra arma) → retarget; sem vivos → balístico
    if (r.target && r.target.dead) r.target = ctx.targets ? pickRetarget(r, ctx.targets) : null;
    const ev = stepRod(r, dt);
    let dead = ev === 'expired';
    if (ev === 'hit' && r.target && !r.target.dead) {
      const t = r.target;
      explosion(new THREE.Vector3(r.x, r.y, r.z), 0.7, COLORS.fireYellow);
      ctx.onRodKill?.(t, r); // o caller aplica o kill real (marca t.dead)
      r.kills += 1;
      r.pierceLeft -= 1;
      if (r.pierceLeft <= 0) dead = true; // 3 kills: rod gasto
      else r.target = ctx.targets ? pickRetarget(r, ctx.targets) : null; // atravessa → próximo
    }
    if (!dead && ctx.heightAt && r.y <= ctx.heightAt(r.x, r.z)) {
      explosion(new THREE.Vector3(r.x, r.y, r.z), 0.5, COLORS.fireYellow);
      dead = true; // dart cinético enterra no terreno
    }
    if (dead) {
      scene.remove(r.mesh);
      rodDarts.splice(i, 1);
      continue;
    }
    r.mesh.position.set(r.x, r.y, r.z);
    if (r.vx * r.vx + r.vy * r.vy + r.vz * r.vz > 0.01) {
      r.mesh.lookAt(r.x + r.vx, r.y + r.vy, r.z + r.vz);
    }
    if (r.glow) r.glow.visible = night; // T-W-07
    r.smokeTimer -= dt;
    if (r.smokeTimer <= 0) { r.smokeTimer = 0.04; spawnMissileSmoke(r.mesh.position, TRAIL_OPTS); }
  }
}

/** Limpa os rods (dispose do modo defesa). */
export function clearRodDarts() {
  for (const r of rodDarts) if (r.mesh?.parent) scene.remove(r.mesh);
  rodDarts.length = 0;
}

// ─── Nuke tática da bateria (T-W-05, weapons-v1) ─────────────────────────────
// Projétil pesado em arco alto balístico; o impacto (megaExplosion + wipe por
// raio) é resolvido pelo caller via ctx.onImpact — defense-mode aplica o wipe
// em caças e na horda.
const defNukes = [];

/** Lança a nuke tática: arco balístico curto (NUKE_ARC_S) + glide guiado por
 *  PN sobre o ponto de mira — cai ONDE o artilheiro mirou (±uns metros). */
export function spawnDefenseNuke(orig, dir, aimPoint) {
  const mesh = buildMissileMesh('heavy');
  mesh.scale.set(2.4, 2.4, 2.4); // projétil pesado
  mesh.position.copy(orig);
  scene.add(mesh);
  // Velocidade na direção do ponto de mira + lift (arco alto)
  const dx = aimPoint.x - orig.x, dy = aimPoint.y - orig.y, dz = aimPoint.z - orig.z;
  const dl = Math.hypot(dx, dy, dz) || 1e-9;
  const s = AA_DEFENSE.NUKE_SPEED;
  defNukes.push({
    mesh,
    x: orig.x, y: orig.y, z: orig.z,
    vx: (dx / dl) * s, vy: (dy / dl) * s + AA_DEFENSE.NUKE_ARC_LIFT * s, vz: (dz / dl) * s,
    aim: { x: aimPoint.x, y: aimPoint.y, z: aimPoint.z, vx: 0, vy: 0, vz: 0 },
    arcT: AA_DEFENSE.NUKE_ARC_S,
    life: AA_DEFENSE.NUKE_LIFE, smokeTimer: 0,
    glow: attachNightGlow(mesh, 0.95, 2.4), // T-W-07
  });
  audio.missile();
}

/** Atualiza as nukes: arco (balístico) → glide (PN ao ponto de mira) + trilha;
 *  impacto no terreno (ou cap de vida) dispara ctx.onImpact(n) — o wipe por
 *  raio é do caller. @param ctx {heightAt(x,z)?, onImpact(nuke)?} */
export function updateDefenseNukes(dt, ctx = {}) {
  const night = _nightNow(); // T-W-07
  for (let i = defNukes.length - 1; i >= 0; i--) {
    const n = defNukes[i];
    if (n.arcT > 0) { n.arcT -= dt; stepNukeArc(n, dt); }
    else stepNukeGuided(n, dt); // cruzeiro alto + mergulho terminal sobre a mira
    n.mesh.position.set(n.x, n.y, n.z);
    if (n.vx * n.vx + n.vy * n.vy + n.vz * n.vz > 0.01) {
      n.mesh.lookAt(n.x + n.vx, n.y + n.vy, n.z + n.vz);
    }
    if (n.glow) n.glow.visible = night; // T-W-07
    n.smokeTimer -= dt;
    if (n.smokeTimer <= 0) { n.smokeTimer = 0.04; spawnMissileSmoke(n.mesh.position, TRAIL_OPTS); }
    const ground = ctx.heightAt && n.y <= ctx.heightAt(n.x, n.z);
    if (ground || n.life <= 0) {
      if (ground && ctx.heightAt) n.y = ctx.heightAt(n.x, n.z);
      ctx.onImpact?.(n);
      scene.remove(n.mesh);
      defNukes.splice(i, 1);
    }
  }
}

/** Limpa as nukes táticas (dispose do modo defesa). */
export function clearDefenseNukes() {
  for (const n of defNukes) if (n.mesh?.parent) scene.remove(n.mesh);
  defNukes.length = 0;
}

// ─── Mísseis ─────────────────────────────────────────────────────────────────
// AC-05/D-1: cada míssil teleguiado (light/heavy) resolve HIT/MISS num roll seeded
// único no disparo (`willHit`), independente de alcance. HIT ⇒ vida estendida o
// suficiente para garantir intercepção terminal + homing agressivo (CLOSE_TURN_RATE o
// tempo todo). MISS ⇒ mira num ponto deslocado lateralmente além do raio de impacto do
// alvo, garantindo uma curva de "quase acerto" plausível; o gate de dano abaixo NUNCA
// aplica damageTarget quando willHit é false, não importa a geometria.
const missiles = [];
const _msDir = new THREE.Vector3();
const _msAimPoint = new THREE.Vector3();
const _msToTarget = new THREE.Vector3();

// Vida extra (D-1 "guaranteed terminal intercept"): multiplicador de margem sobre o
// tempo de voo em linha reta (distância/TRACKING_SPD) + folga fixa em segundos para
// cobrir a convergência inicial do homing e alvos lentos móveis.
const HIT_LIFE_MARGIN_FACTOR = 1.4;
const HIT_LIFE_MARGIN_SECONDS = 2.5;
// Deslocamento lateral do "quase acerto" (D-1): múltiplo do raio de impacto do alvo
// (sqrt(hr2)) para garantir que o míssil MISS nunca entra no gate de colisão
// (hr2 * HIT_RADIUS_MULT abaixo).
const MISS_OFFSET_MIN_MULT = 2.5;
const MISS_OFFSET_RANGE_MULT = 2.5;
const HIT_RADIUS_MULT = 2.5; // mesmo multiplicador do gate de colisão original

/** Constrói o mesh de um míssil (nose cone + body + 4 fins + flame trail). */
function buildMissileMesh(kind) {
  const g = new THREE.Group();
  const isHeavy = kind === 'heavy';
  const bodyColor = isHeavy ? 0x4a4a52 : 0x9aa0aa;
  const finColor = isHeavy ? 0x2a2a32 : 0x666c78;
  const flameColor = isHeavy ? 0xffaa20 : 0xffeebb;

  const bodyMat = new THREE.MeshLambertMaterial({ color: bodyColor });
  const finMat = new THREE.MeshLambertMaterial({ color: finColor });
  const flameMat = new THREE.MeshBasicMaterial({ color: flameColor, transparent: true, opacity: 0.95 });

  // Corpo cilíndrico
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.10, 0.10, 1.2, 8), bodyMat);
  body.rotation.x = Math.PI / 2;
  body.position.z = 0;
  g.add(body);
  // Nose cone
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.10, 0.35, 8), bodyMat);
  nose.rotation.x = -Math.PI / 2;
  nose.position.z = -0.78;
  g.add(nose);
  // 4 aletas estabilizadoras na traseira (cruz)
  for (let i = 0; i < 4; i++) {
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.35, 0.4), finMat);
    fin.rotation.z = (i * Math.PI) / 2;
    fin.position.z = 0.45;
    g.add(fin);
  }
  // Chama de propulsão atrás
  const flame = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.5, 8), flameMat);
  flame.rotation.x = -Math.PI / 2;
  flame.position.z = 0.95;
  g.add(flame);

  if (isHeavy) g.scale.set(1.5, 1.5, 1.5);
  return g;
}

/** Lança um míssil em direção a um alvo (homing). @param kind 'light'|'heavy' */
export function spawnMissile(orig, target, jetQuat, kind = 'light', opts = {}) {
  const cfg = kind === 'heavy' ? MISSILES_HEAVY : MISSILES_LIGHT;
  const mesh = buildMissileMesh(kind);
  mesh.position.copy(orig);
  // Orienta o míssil no momento do disparo para apontar para frente do jato
  mesh.quaternion.copy(jetQuat);
  scene.add(mesh);
  const vel = new THREE.Vector3(0, 0, -1).applyQuaternion(jetQuat).multiplyScalar(cfg.INITIAL_SPD);

  // AC-05/D-1: roll seeded único por disparo — determina o destino do míssil.
  const willHit = opts.willHit ?? rollMissileHit(game.rng);
  let life = opts.life ?? cfg.LIFE;
  let missOffset = null;
  if (target) {
    if (willHit) {
      // Vida garantida para intercepção terminal, independente do alcance de disparo.
      const dist0 = orig.distanceTo(target.mesh.position);
      const guaranteedLife = (dist0 / cfg.TRACKING_SPD) * HIT_LIFE_MARGIN_FACTOR + HIT_LIFE_MARGIN_SECONDS;
      life = Math.max(life, guaranteedLife);
    } else {
      // Ponto de mira deslocado lateralmente além do raio de impacto — curva de
      // "quase acerto" plausível que nunca entra no gate de colisão (ver updateMissiles).
      const hr = Math.sqrt(target.hr2 ?? 25);
      const toTarget = new THREE.Vector3().subVectors(target.mesh.position, orig);
      const perp = new THREE.Vector3().crossVectors(toTarget, new THREE.Vector3(0, 1, 0));
      if (perp.lengthSq() < 1e-6) perp.set(1, 0, 0); else perp.normalize();
      const mag = hr * (MISS_OFFSET_MIN_MULT + game.rng.random() * MISS_OFFSET_RANGE_MULT);
      const side = game.rng.random() < 0.5 ? -1 : 1;
      missOffset = perp.multiplyScalar(mag * side);
    }
  }

  missiles.push({
    mesh,
    target,
    velocity: vel,
    life,
    smokeTimer: 0,
    cfg,
    kind,
    damage: opts.damage ?? cfg.DAMAGE,
    explosionScale: opts.explosionScale,
    support: opts.support === true,
    willHit,
    missOffset,
  });
  audio.missile();
}

/** Atualiza mísseis: re-targeting + homing + impacto. */
export function updateMissiles(dt) {
  for (let i = missiles.length - 1; i >= 0; i--) {
    const m = missiles[i]; m.life -= dt;
    if (!m.target || m.target.dead) {
      let near = null, nd = Infinity;
      for (const e of game.targets) {
        if (e.dead) continue;
        const d = m.mesh.position.distanceToSquared(e.mesh.position);
        if (d < nd) { nd = d; near = e; }
      }
      // Alvo trocou (re-target) — o missOffset antigo era relativo à posição do alvo
      // anterior e não se aplica mais.
      if (near !== m.target) m.missOffset = null;
      m.target = near;
    }
    if (m.target) {
      const dist = m.mesh.position.distanceTo(m.target.mesh.position);
      // AC-05/D-1: HIT-rolled sempre usa o turn mais agressivo (garante convergência
      // terminal, independente do alcance). MISS-rolled mantém o proximity-boost
      // original (curva plausível, sem garantia de intercepção).
      const turn = m.willHit ? m.cfg.CLOSE_TURN_RATE : (dist < 40 ? m.cfg.CLOSE_TURN_RATE : m.cfg.TURN_RATE);
      _msAimPoint.copy(m.target.mesh.position);
      if (m.missOffset) _msAimPoint.add(m.missOffset);
      _msDir.subVectors(_msAimPoint, m.mesh.position).normalize().multiplyScalar(m.cfg.TRACKING_SPD);
      m.velocity.lerp(_msDir, turn);

      // MISS-rolled: uma vez que o míssil já passou do alvo (afastando-se dele),
      // encurta a vida restante para um "quase acerto" visível seguido de
      // autodestruição — em vez de vagar pelo mapa pelo LIFE inteiro (6-8s).
      if (!m.willHit) {
        _msToTarget.subVectors(m.target.mesh.position, m.mesh.position);
        const approaching = _msToTarget.dot(m.velocity) > 0;
        if (!approaching && m.life > 0.6) m.life = 0.6;
      }
    }
    m.mesh.position.addScaledVector(m.velocity, dt);

    // Orienta o mesh ao longo da velocidade (visual realista)
    if (m.velocity.lengthSq() > 0.01) {
      _msDir.copy(m.velocity).normalize();
      m.mesh.lookAt(
        m.mesh.position.x + _msDir.x,
        m.mesh.position.y + _msDir.y,
        m.mesh.position.z + _msDir.z,
      );
    }

    // Trilha de fumaça atrás do míssil — heavy tem trilha mais densa
    m.smokeTimer -= dt;
    if (m.smokeTimer <= 0) {
      m.smokeTimer = m.kind === 'heavy' ? 0.04 : 0.06;
      spawnMissileSmoke(m.mesh.position);
    }

    let hit = false;
    if (m.target && !m.target.dead) {
      const hr2 = m.target.hr2 * HIT_RADIUS_MULT;   // raio de impacto generoso
      // D-1: dano só é aplicado a mísseis HIT-rolled. Um MISS-rolled nunca chega
      // aqui na prática (o missOffset garante a trajetória de "quase acerto"), mas o
      // gate abaixo é incondicional — a decisão de dano nunca depende só da geometria.
      if (m.willHit && m.mesh.position.distanceToSquared(m.target.mesh.position) < hr2) {
        damageTarget(m.target, m.damage);
        hit = true;
      }
    }
    // Garantia de intercepção terminal (D-1): rede de segurança — se a vida está
    // prestes a expirar e o míssil HIT-rolled ainda não acertou um alvo vivo, força o
    // impacto agora. A margem de vida calculada no disparo deve tornar este caminho
    // raro/nunca necessário na prática.
    if (!hit && m.willHit && m.life <= 0 && m.target && !m.target.dead) {
      damageTarget(m.target, m.damage);
      hit = true;
    }
    if (hit || m.life <= 0) {
      const scale = m.explosionScale ?? (m.kind === 'heavy' ? 1.5 : 0.9);
      explosion(m.mesh.position, scale, COLORS.fireYellow);
      audio.explosion(m.kind === 'heavy' || m.support ? 1.2 : 0.5, m.mesh.position);
      scene.remove(m.mesh);
      missiles.splice(i, 1);
    }
  }
}

/** Limpa todos os mísseis (para restartGame). */
export function clearMissiles() {
  for (const m of missiles) if (m.mesh?.parent) scene.remove(m.mesh);
  missiles.length = 0;
}

// ─── Pickups (resupply de mísseis) ───────────────────────────────────────────
const pickups = [];

// T-C-08 (inhauma-campaign-v1): míssil leve é INFINITO — pickups não dão mais
// munição leve. A mesa de drops foi re-tabelada: heavy (comum) ou nuke (raro,
// ≤5%). O tipo é sorteado no SPAWN com game.rng (seedado — determinístico).
const PICKUP_NUKE_CHANCE = 0.05;

export function spawnPickup(pos) {
  const kind = game.rng.random() < PICKUP_NUKE_CHANCE ? 'nuke' : 'heavy';
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.7, 8, 8),
    new THREE.MeshBasicMaterial({ color: kind === 'nuke' ? 0x44ddff : COLORS.pickup }),
  );
  mesh.position.copy(pos); mesh.position.y += 4; scene.add(mesh);
  pickups.push({ mesh, kind, life: 18.0 });
}

export function updatePickups(dt, jetPos) {
  for (let i = pickups.length - 1; i >= 0; i--) {
    const p = pickups[i]; p.life -= dt;
    p.mesh.position.y += Math.sin(performance.now() * 0.005) * dt * 0.5;
    if (p.mesh.position.distanceTo(jetPos) < 3) {
      // 2026-08-11: pickups viraram RECARGA — encurtam o cooldown corrente
      // (weapon-cooldowns.js). Nuke (raro) zera a recarga da nuclear; o comum
      // zera as armas táticas (heavy/rod/light).
      const cd = game.player.weaponCooldowns;
      if (p.kind === 'nuke') {
        shaveCooldown(cd, 'nuclear', Infinity);
      } else {
        shaveCooldown(cd, 'heavy', Infinity);
        shaveCooldown(cd, 'rod', Infinity);
        shaveCooldown(cd, 'light', Infinity);
      }
      scene.remove(p.mesh); pickups.splice(i, 1); continue;
    }
    if (p.life <= 0) { scene.remove(p.mesh); pickups.splice(i, 1); }
  }
}

export function clearPickups() {
  for (const p of pickups) if (p.mesh?.parent) scene.remove(p.mesh);
  pickups.length = 0;
}

// ─── Mísseis nucleares ───────────────────────────────────────────────────────
const nukes = [];

/** Constrói o mesh do míssil nuclear. */
function buildNuclearMesh() {
  const g = new THREE.Group();
  // Corpo principal
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.18, 0.20, 2.0, 8),
    new THREE.MeshLambertMaterial({ color: 0x1a1a22 }),
  );
  body.rotation.x = Math.PI / 2;
  g.add(body);
  // Nose cone
  const nose = new THREE.Mesh(
    new THREE.ConeGeometry(0.18, 0.7, 8),
    new THREE.MeshLambertMaterial({ color: 0x2a1a1a }),
  );
  nose.rotation.x = -Math.PI / 2;
  nose.position.z = -1.2;
  g.add(nose);
  // Faixa verde de aviso
  const stripe = new THREE.Mesh(
    new THREE.CylinderGeometry(0.19, 0.19, 0.15, 8),
    new THREE.MeshBasicMaterial({ color: 0x00cc22 }),
  );
  stripe.rotation.x = Math.PI / 2;
  stripe.position.z = 0.3;
  g.add(stripe);
  return g;
}

/** Lança um míssil nuclear. 2026-08-11: sem munição — a cadência (1/min) é
 * controlada pelo cooldown no caller (main.js / weapon-cooldowns.js). */
export function spawnNuclearMissile(orig, target, jetQuat) {
  const mesh = buildNuclearMesh();
  mesh.position.copy(orig);
  mesh.quaternion.copy(jetQuat);
  scene.add(mesh);
  const vel = new THREE.Vector3(0, 0, -MISSILES_NUCLEAR.INITIAL_SPD).applyQuaternion(jetQuat);
  nukes.push({ mesh, target, vel, life: MISSILES_NUCLEAR.LIFE });
  audio.missile();
}

function applyNuclearShockwave(epicenter) {
  for (const t of game.targets) {
    if (t.dead) continue;
    const dist = epicenter.distanceTo(t.mesh.position);
    if (dist < MISSILES_NUCLEAR.BLAST_RADIUS) {
      const dmg = MISSILES_NUCLEAR.DAMAGE * Math.max(0, 1 - dist / MISSILES_NUCLEAR.BLAST_RADIUS);
      damageTarget(t, dmg);
    }
  }
  // Player damage check — use MAYDAY for dramatic visual instead of instant life deduction
  const playerPos = new THREE.Vector3(game.player.x, game.player.y, game.player.pz || 0);
  const pd = epicenter.distanceTo(playerPos);
  if (pd < MISSILES_NUCLEAR.PLAYER_DAMAGE_RADIUS && !game.flags.mayday) {
    if (pd < MISSILES_NUCLEAR.PLAYER_KILL_RADIUS) {
      // Lethal range → force MAYDAY (plane falls on fire, then instant death after timer)
      game.flags.mayday = true;
      game.flags.maydayTimer = 0;
      game.player.hp = 0;
      game.player.lives = 1; // will be decremented to 0 in _ejectAndRespawn
      if (game.missionRealism?.enabled) {
        transitionSortie(game.missionRealism.sortie, SortieEvent.CRITICAL_DAMAGE, {}, game.time);
      }
      audio.explosion(1.5, epicenter);
    } else {
      // Damage range → lose 1 life; if already dead, trigger MAYDAY
      game.player.lives = Math.max(0, game.player.lives - 1);
    }
  }
  // Shake forte em toda a área de dano (proporcional à distância)
  if (pd < MISSILES_NUCLEAR.PLAYER_DAMAGE_RADIUS) {
    const shakeFactor = Math.max(0.2, 1 - pd / MISSILES_NUCLEAR.PLAYER_DAMAGE_RADIUS);
    game.flags.cameraShake = { intensity: 14.0 * shakeFactor, duration: 5.0 };
  }

  // Deforma o terreno — cria cratera nas ilhas/montanhas dentro do raio
  deformTerrainNuclear(epicenter, MISSILES_NUCLEAR.BLAST_RADIUS);
}

/** Atualiza mísseis nucleares: homing + impacto + explosão. */
export function updateNuclears(dt) {
  for (let i = nukes.length - 1; i >= 0; i--) {
    const n = nukes[i];
    n.life -= dt;

    // Homing
    if (n.target && !n.target.dead) {
      const dist = n.mesh.position.distanceTo(n.target.mesh.position);
      const tr = dist < 40 ? MISSILES_NUCLEAR.CLOSE_TURN_RATE : MISSILES_NUCLEAR.TURN_RATE;
      const desired = n.target.mesh.position.clone().sub(n.mesh.position).normalize().multiplyScalar(MISSILES_NUCLEAR.TRACKING_SPD);
      n.vel.lerp(desired, tr);
    } else if (!n.target || n.target.dead) {
      // Re-target
      let near = null, nd = Infinity;
      for (const e of game.targets) {
        if (e.dead) continue;
        const d = n.mesh.position.distanceToSquared(e.mesh.position);
        if (d < nd) { nd = d; near = e; }
      }
      n.target = near;
    }

    n.mesh.position.addScaledVector(n.vel, dt);
    if (n.vel.lengthSq() > 0.01) {
      const lookDir = n.mesh.position.clone().add(n.vel);
      n.mesh.lookAt(lookDir);
    }

    // Trilha de fumaça
    if (!n._smokeTimer) n._smokeTimer = 0;
    n._smokeTimer -= dt;
    if (n._smokeTimer <= 0) { n._smokeTimer = 0.04; spawnMissileSmoke(n.mesh.position); }

    // Impacto
    const hitTarget = n.target && !n.target.dead &&
      n.mesh.position.distanceTo(n.target.mesh.position) < 10;
    const groundHit = n.mesh.position.y <= 1;
    const expired = n.life <= 0;

    if (hitTarget || groundHit || expired) {
      const ep = n.mesh.position.clone();
      nuclearExplosion(ep.clone());
      spawnNuclearFx(ep.clone(), scene);
      // Decisão do operador (2026-07-01): SEM câmera cinematográfica na detonação —
      // o jogador assiste ao cogumelo da câmera normal (shake + flash mantidos).
      applyNuclearShockwave(ep.clone());

      // T-N-02: firestorm — todo inflamável em 260 m (2× fireball) pega fogo:
      // 60 s de chamas → 120 s de fumaça → carbonizado permanente (firestorm.js).
      spawnFirestorm(ep);

      // ADR-U4: slow-mo global 0.35× por 1.5 s — nunca em testMode/webdriver
      const _headless = typeof navigator !== 'undefined' && navigator.webdriver === true;
      if (!game.runtime?.testMode && !_headless) game.flags.nukeSlowmo = 1.5;

      // WS-6: onda de choque chega à câmera com delay físico (dist / 340 m/s)
      const _pPos = new THREE.Vector3(game.player.x, game.player.y, game.player.pz || 0);
      const _pd = ep.distanceTo(_pPos);
      game.flags.nukeShockArrival = {
        t: _pd / 340,
        intensity: Math.max(2.5, 16 * Math.max(0.15, 1 - _pd / 1600)),
      };

      // WS-6: cratera/cicatriz em QUALQUER piso (não só deformação de ilhas)
      const _surf = surfaceInfoAt(ep.x, ep.z);
      const _gPos = ep.clone(); _gPos.y = Math.max(_surf.height, 0);
      // D-8: scorch radii scale with BLAST_RADIUS (pre-D-8 ratios preserved: 120/400
      // = 0.30, 210/400 = 0.525 -> now 228/399 at BLAST_RADIUS=760).
      spawnScorchMark(_gPos, MISSILES_NUCLEAR.BLAST_RADIUS * 0.30, 0.62);
      spawnScorchMark(_gPos, MISSILES_NUCLEAR.BLAST_RADIUS * 0.525, 0.24);

      // WS-6: coluna de fumaça residual por 60 s no epicentro
      const _smokeOwner = { isNukeResidual: true };
      addSmokeEmitter(ep.x, _gPos.y + 10, ep.z, _smokeOwner);
      fxDelay(60, () => removeSmokeEmittersOf(_smokeOwner));

      audio.explosion(1.5, ep);
      scene.remove(n.mesh);
      nukes.splice(i, 1);
    }
  }
}

/** Limpa mísseis nucleares (para restartGame). */
export function clearNuclears() {
  for (const n of nukes) if (n.mesh?.parent) scene.remove(n.mesh);
  nukes.length = 0;
}
