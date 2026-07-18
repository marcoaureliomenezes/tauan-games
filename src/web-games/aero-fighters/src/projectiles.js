// projectiles.js — Balas, mísseis homing e pickups (drops de munição).
// Exporta: spawnBullet, recycleBullet, updateBullets, spawnMissile, updateMissiles,
//   spawnPickup, updatePickups.
// Para adicionar projétil novo (foguete, bomba): novo pool aqui ou módulo dedicado.
//
// Acoplamento intencional: importa damageTarget de targets.js (exceção α — ver CONVENTIONS).

import * as THREE from '../../../../vendor/three.module.min.js';
import { scene } from './scene.js';
import { audio } from './audio.js';
import { game } from './state.js';
import { CANNON, MISSILES_LIGHT, MISSILES_HEAVY, MISSILES_NUCLEAR, COLORS } from './config.js';
import { explosion, spawnMissileSmoke, nuclearExplosion, spawnScorchMark, scheduleDelayed as fxDelay } from './fx.js';
import { spawnNuclearFx } from './nuclear-fx.js';
import { spawnPropFire } from './prop-fire.js';
import { inhaumaTrees, getInhaumaStructures } from './maps/inhauma-scene.js';
import { damageTarget } from './targets.js';
import { deformTerrainNuclear, surfaceInfoAt } from './world.js';
import { addSmokeEmitter, removeSmokeEmittersOf } from './factory-fx.js';
import { transitionSortie, SortieEvent } from './sortie-state.js';
import { rollMissileHit } from './weapons-core.js';

// ─── Balas ───────────────────────────────────────────────────────────────────
// Tracer estilo M61 Vulcan: cilindro alongado amarelo brilhante, trilhando atrás da bala
const BULLET_GEOM = new THREE.CylinderGeometry(0.06, 0.06, 2.0, 6);
BULLET_GEOM.rotateX(Math.PI / 2);
const BULLET_MAT  = new THREE.MeshBasicMaterial({ color: 0xfff080 });
const ENEMY_B_MAT = new THREE.MeshBasicMaterial({ color: COLORS.bulletEnemy });

const bulletPoolPlayer = [], bulletPoolEnemy = [];

/** Spawna uma bala. @param orig posição inicial @param dir direção normalizada */
export function spawnBullet(orig, dir, isEnemy = false) {
  const pool = isEnemy ? bulletPoolEnemy : bulletPoolPlayer;
  let mesh = pool.pop();
  if (!mesh) mesh = new THREE.Mesh(BULLET_GEOM, isEnemy ? ENEMY_B_MAT : BULLET_MAT);
  mesh.position.copy(orig);
  // Aponta o tracer ao longo da direção de voo (cilindro estende-se atrás da bala)
  mesh.lookAt(orig.x + dir.x * 10, orig.y + dir.y * 10, orig.z + dir.z * 10);
  mesh.visible = true; scene.add(mesh);
  const spd = isEnemy ? 56 : CANNON.BULLET_SPD;
  // CONTRATO: writer de game.projectiles
  game.projectiles.push({
    mesh,
    velocity: new THREE.Vector3(dir.x * spd, dir.y * spd, dir.z * spd),
    life: CANNON.BULLET_LIFE,
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

export function spawnPickup(pos) {
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.7, 8, 8),
    new THREE.MeshBasicMaterial({ color: COLORS.pickup }),
  );
  mesh.position.copy(pos); mesh.position.y += 4; scene.add(mesh);
  pickups.push({ mesh, life: 18.0 });
}

export function updatePickups(dt, jetPos) {
  for (let i = pickups.length - 1; i >= 0; i--) {
    const p = pickups[i]; p.life -= dt;
    p.mesh.position.y += Math.sin(performance.now() * 0.005) * dt * 0.5;
    if (p.mesh.position.distanceTo(jetPos) < 3) {
      // CONTRATO: writer de game.player.missiles
      game.player.missiles = Math.min(game.player.missiles + 10, MISSILES_LIGHT.MAX);
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

/** Lança um míssil nuclear. */
export function spawnNuclearMissile(orig, target, jetQuat) {
  if (game.player.nuclearMissiles <= 0) return;
  game.player.nuclearMissiles--;
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

// WS-5: incendiar árvores e casas dentro do raio da nuke (só o mapa inhauma tem esse
// cenário rico). Cap rígido de focos + amostragem probabilística longe do epicentro para
// proteger FPS; spawnPropFire já ignora headless/testMode.
const NUKE_IGNITE_CAP = 42;
function igniteNearbyProps(ep) {
  if (game.activeMap !== 'inhauma') return;
  const R = MISSILES_NUCLEAR.BLAST_RADIUS;
  const R2 = R * R, near2 = R2 * 0.25;
  let lit = 0;
  for (const tr of inhaumaTrees) {
    if (lit >= NUKE_IGNITE_CAP) break;
    const dx = tr.x - ep.x, dz = tr.z - ep.z;
    const d2 = dx * dx + dz * dz;
    if (d2 > R2) continue;
    if (d2 > near2 && Math.random() > 0.35) continue; // longe: amostra
    spawnPropFire(tr.x, tr.y + 3, tr.z, 1.0, 24);
    lit++;
  }
  for (const s of getInhaumaStructures()) {
    if (lit >= NUKE_IGNITE_CAP) break;
    const dx = s.x - ep.x, dz = s.z - ep.z;
    if (dx * dx + dz * dz > R2) continue;
    spawnPropFire(s.x, (s.topY || 6) * 0.6, s.z, 1.8, 34);
    lit++;
  }
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

      // WS-5: árvores e casas próximas ao epicentro pegam fogo (cap + guarda headless).
      igniteNearbyProps(ep);

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
