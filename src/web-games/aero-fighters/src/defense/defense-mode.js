// defense/defense-mode.js — Orquestrador do modo 'inhauma-defense' (jogado DO
// CHÃO). create: esconde o jato e a mira de voo, ancora o artilheiro no morro
// (DEM real), instala câmera/pointer lock e cria o DIRETOR (T-D-09: spawn
// infinito escalando por kills, score/kills, integridade da cidade, derrotas
// com overlay + restart no Espaço). dispose: restaura tudo e limpa pools.
// SEM física de voo/campanha/waves — main.js despacha para cá quando
// game.activeMap === 'inhauma-defense' (isDefenseMapKey).
// Exporta: createDefenseMode, updateDefenseMode, updateDefenseCamera,
//   startDefenseRun, disposeDefenseMode, defenseAnchor.
// Ondas: D1 fundação · D2 armas · D3 caças/ordenança/baterias · D4 diretor
//   (defense-director.js, puro) + queda cinematográfica (startDying/stepDying
//   em enemy-fighters.js; FX aqui e em fx.js) · WEAPONS-V1 (weapons-v1.js,
//   puro): lock persistente 3 s/3 tiros, tiers X/B, retarget, rod R, horda
//   (reuso src/formations — entidade local, NUNCA game.targets) + nuke T.

import * as THREE from '../../../vendor/three.module.min.js';
import { game } from '../state.js';
import { AA_DEFENSE } from '../config.js';
import { createTurretPlayer, selectWeapon, cycleWeapon, WEAPON_LABELS } from './turret-player.js';
import { createTurretCameraState, updateTurretCamera, gimbalForward } from './turret-camera.js';
import {
  mgFireTick, mgSpreadDir, pickLockTarget, stepAaRecharge,
} from './turret-weapons.js';
import {
  noteLockShot, stepLockPhase, lockPhase, resetLock, rollLockHit, enqueueAaShot,
  consumeTier, stepTierCooldowns, groundAimPoint, nightFactor,
} from './weapons-v1.js';
import { spawnFighter, stepFighter, startDying, stepDying } from './enemy-fighters.js';
import {
  createDefenseDirector, stepDirector, registerKill, registerInterception,
  registerCityImpact, registerPlayerDown, resetDirector, directorTelemetry,
  stepHorde, registerHordeArrival, registerHordeKill,
} from './defense-director.js';
import {
  spawnAgMissile, stepAgMissile, spawnEnemyTracer, stepEnemyTracer, tryIntercept,
} from './enemy-ordnance.js';
import {
  placeAlliedBatteries, stepBattery, stepAllyMissile, damageBattery,
} from './allied-batteries.js';
import { input, consumeMouseDeltas, requestPointerLock, exitPointerLock, onAction } from '../input.js';
import { showOverlay, hideOverlay } from '../hud.js';
import {
  inhaumaVisualSurfaceHeight, getInhaumaStructures, TOWN_SHELF,
} from '../maps/inhauma-scene.js';
import { inhaumaAirport } from '../airport.js';
import { createRng } from '../rng.js';
import {
  spawnMgBullet, updateMgBullets, clearMgBullets,
  spawnAaMissile, updateAaMissiles, clearAaMissiles,
  spawnRodDart, updateRodDarts, clearRodDarts,
  spawnDefenseNuke, updateDefenseNukes, clearDefenseNukes,
} from '../projectiles.js';
import { createFormation, updateFormations } from '../formations/formation.js';
import {
  spawnMuzzleFlash, spawnMissileSmoke, spawnDustPuff, explosion, spawnFlash,
  spawnScorchMark, megaExplosion, spawnShockwave, spawnFallTrail,
  spawnSmokeColumn, spawnShedDebris, clearFallFx,
  makeDefenseBatteryMesh, makeEnemyFighterMesh, makeAgMissileMesh,
  spawnEnemyTracerMesh, spawnAllyTracerMesh,
} from '../fx.js';
import { spawnPropFire, clearPropFires } from '../prop-fire.js';
import { addSmokeEmitter, removeSmokeEmittersOf } from '../factory-fx.js';
import {
  createParachutePool, spawnPoolParachute, updatePoolParachutes, clearParachutePool,
} from '../ejection.js';
import { audio } from '../audio.js';

let _turret = null;
let _camState = null;
let _sceneRef = null;
let _battery = null;      // mesh da bateria do jogador (Onda D1)
let _rng = null;          // rng derivado da seed da sessão (':defense-d3')
let _director = null;     // T-D-09: diretor (spawn/score/cidade/derrota) — puro
// T-D-06/07/08: entidades vivas da Onda D3
let _fighters = [];       // caças inimigos (registros de enemy-fighters.js)
let _agMissiles = [];     // mísseis ar-solo inimigos (enemy-ordnance.js)
let _enemyTracers = [];   // tracers da rajada anti-jogador
let _batteries = [];      // baterias AA aliadas (allied-batteries.js)
let _allyTracers = [];    // tracers das baterias aliadas
let _allyMissiles = [];   // mísseis ocasionais das baterias aliadas
let _cityTargets = [];    // estruturas da TOWN_SHELF (alvos 'city')
let _baseTargets = [];    // pontos da base militar (alvos 'base')
let _basePos = null;      // centro da pista (re-semear baterias no restart)
let _falling = [];        // T-D-10: caças caindo COM trilha (cap FALL_MAX_TRAILS)
let _paras = null;        // T-D-10: pool de paraquedas da ejeção (ejection.js)
let _alarmT = 0;          // throttle do alarme de míssil anti-jogador
let _sinceDamage = 99;    // s desde o último dano (regen de HP fora de combate)
let _regenT = 0;
let _lockHandler = null;
let _clickHandler = null;
let _beepT = 0;           // timer do beep de lock (acelera com o tracking)
let _horde = null;        // WEAPONS-V1 (T-W-05): { formation, alarmT } | null
let _stashSupplies = null; // supplies do jato suspensos enquanto o modo dura
// Flags de mouse do frame — consumidas 1x por frame em updateDefenseMode e
// reutilizadas por updateDefenseCamera (que roda depois, no mesmo tick).
const _frameMouse = { dx: 0, dy: 0, wheel: 0, left: false, right: false };

const _fwd = {};
const _muzzle = new THREE.Vector3();
const _v3 = new THREE.Vector3();
const _proj = new THREE.Vector3();
// T-W-07: trilha discreta da ordenança inimiga (~1 s de fade, puffs menores)
const AG_TRAIL_OPTS = { life: 1.0, opacity: 0.4, scale: 0.3, maxScale: 2.0 };

// Builders de mesh da bateria/caça/ordenança/tracers: fx.js (T-D-09/10 —
// extraídos para o orquestrador ficar enxuto; são 100% visuais).

// ─── T-D-06/T-D-09/T-D-10: caças ─────────────────────────────────────────────

/** Conjuntos de alvos vivos para a seleção seedada (45/30/15/10). */
function currentTargetSets() {
  return {
    city: _cityTargets,
    base: _baseTargets,
    battery: _batteries.filter((b) => !b.dead),
    player: { x: _turret.x, y: _turret.y + AA_DEFENSE.EYE_HEIGHT, z: _turret.z },
  };
}

/** Spawna um caça seedado (debug hook em game.defense). dirAngle = bússola
 *  da esquadrilha sorteada pelo diretor (T-D-09: entram pela MESMA direção). */
function spawnOneFighter(dirAngle = null) {
  const f = spawnFighter(_rng.random, {
    center: AA_DEFENSE.LOOK_AT,
    heightAt: inhaumaVisualSurfaceHeight,
    targetSets: currentTargetSets(),
  });
  if (dirAngle != null) {
    const cx = AA_DEFENSE.LOOK_AT.x, cz = AA_DEFENSE.LOOK_AT.z;
    const d = Math.hypot(f.x - cx, f.z - cz);
    f.x = cx + Math.cos(dirAngle) * d;
    f.z = cz + Math.sin(dirAngle) * d;
    f.yaw = Math.atan2(-(f.target.x - f.x), -(f.target.z - f.z));
  }
  f.mesh = makeEnemyFighterMesh();
  f.mesh.position.set(f.x, f.y, f.z);
  _sceneRef.add(f.mesh);
  _fighters.push(f);
  return f;
}

/** T-D-10: caça abatido (qualquer fonte) — explosão inicial + 'dying';
 *  score/kills consolidados no diretor (T-D-09). */
function killFighter(f, boomScale, source = 'mg') {
  if (f.dead) return;
  startDying(f, _rng.random); // estilo spiral/glide/dive + ejeção por RNG
  explosion(_v3.set(f.x, f.y, f.z), boomScale, 0xffaa33);
  audio.explosion(0.7, _v3);
  audio.fallWhistle(_v3); // assobio da queda (T-D-10)
  const st = registerKill(_director, source);
  if (st) showOverlay(`SEQUÊNCIA ${st.streak}`, `${st.streak} abates — Inhaúma resiste`, 2600);
  // Trilha densa: pool bounded — no cap, a queda mais antiga PERDE a trilha
  if (_falling.length >= AA_DEFENSE.FALL_MAX_TRAILS) _falling.shift().smokeOn = false;
  f.smokeOn = true;
  f.trailT = 0;
  _falling.push(f);
  // T-D-10: ejeção (20%) — paraquedas à deriva (pool de ejection.js, máx 2)
  if (f.eject) spawnPoolParachute(_paras, f.x, f.y + 2, f.z, _rng.random() * Math.PI * 2);
  if (_turret.lock.idx === _fighters.indexOf(f)) resetLock(_turret.lock); // T-W-08
}

/** T-D-10: impacto real no terreno — megaExplosion + shockwave + scorch +
 *  coluna persistente; o caça sai de cena. */
function impactFighter(f, e, idx) {
  const pos = _v3.set(e.x, e.y, e.z);
  megaExplosion(pos, 'crash');
  spawnShockwave(pos, 110, 0xffddaa);
  spawnScorchMark(pos, 15, 0.6);
  spawnSmokeColumn(pos, AA_DEFENSE.FALL_COLUMN_S);
  game.flags.cameraShake = { intensity: 4, duration: 0.4 };
  if (f.mesh) _sceneRef.remove(f.mesh);
  const ti = _falling.indexOf(f);
  if (ti >= 0) _falling.splice(ti, 1);
  _fighters.splice(idx, 1);
}

/** Impacto de bala .50: intercepta míssil anti-jogador ou dano no caça. */
function onMgHit(t, b) {
  if (t.isOrdnance) { tryIntercept(b, t); return; } // bônus aplicado no update
  spawnMuzzleFlash(_v3.set(b.x, b.y, b.z));
  audio.hit();
  t.hp -= AA_DEFENSE.MG_DAMAGE;
  if (t.hp <= 0) killFighter(t, 0.8, 'mg');
}

/** Eventos do caça: release de míssil AG, rajada, chaff/flare, despawn. */
function handleFighterEvents(f, events) {
  for (const e of events) {
    if (e.type === 'release') {
      const m = spawnAgMissile(e, e.dir, e.target, _rng.random);
      m.mesh = makeAgMissileMesh();
      m.mesh.position.set(m.x, m.y, m.z);
      _sceneRef.add(m.mesh);
      _agMissiles.push(m);
      audio.missileWhoosh(_v3.set(m.x, m.y, m.z));
    } else if (e.type === 'gun') {
      const t = spawnEnemyTracer(e, {
        x: _turret.x, y: _turret.y + AA_DEFENSE.EYE_HEIGHT, z: _turret.z,
      }, _rng.random);
      spawnEnemyTracerMesh(_enemyTracers, t, { x: t.vx, y: t.vy, z: t.vz }, t.life);
      audio.aaFire(_v3.set(e.x, e.y, e.z));
    } else if (e.type === 'chaff') {
      // Chaff/flare visual ao ser travado (a evasão dura é da máquina de estados)
      spawnFlash(_v3.set(e.x, e.y, e.z), 2.5);
      spawnFlash(_v3.set(e.x + 3, e.y - 1, e.z + 2), 1.8);
      spawnMissileSmoke(_v3.set(e.x, e.y - 1, e.z));
    } else if (e.type === 'despawn') {
      if (f.mesh) _sceneRef.remove(f.mesh);
      const i = _fighters.indexOf(f);
      if (i >= 0) _fighters.splice(i, 1);
      if (_turret.lock.idx === i) resetLock(_turret.lock); // T-W-08
    }
  }
}

/** Step dos caças: vivos (máquina de estados) e caindo (queda cinematográfica). */
function updateFighters(dt) {
  const ctx = {
    heightAt: inhaumaVisualSurfaceHeight,
    rng: _rng.random,
    targetSets: currentTargetSets(),
    center: AA_DEFENSE.LOOK_AT,
  };
  for (let i = _fighters.length - 1; i >= 0; i--) {
    const f = _fighters[i];
    if (f.dead) {
      // T-D-10: kinemática pura da queda (stepDying); aqui só os FX visuais
      const evs = stepDying(f, dt, ctx);
      if (f.falling && f.smokeOn) {
        f.trailT -= dt;
        if (f.trailT <= 0) {
          f.trailT = AA_DEFENSE.FALL_TRAIL_S;
          spawnFallTrail(_v3.set(f.x, f.y, f.z));
        }
      }
      if (f.mesh) {
        f.mesh.position.set(f.x, f.y, f.z);
        f.mesh.rotation.set(f.pitch, f.yaw, f.roll, 'YXZ');
      }
      for (const e of evs) {
        if (e.type === 'shed') spawnShedDebris(e, e);
        else if (e.type === 'impact') impactFighter(f, e, i);
      }
      continue;
    }
    handleFighterEvents(f, stepFighter(f, dt, ctx));
    // Flyby doppler fake: 1x por passagem perto do morro
    const pd = Math.hypot(f.x - _turret.x, f.y - _turret.y, f.z - _turret.z);
    if (pd < 150 && !f.flybyPlayed) { f.flybyPlayed = true; audio.flyby(_v3.set(f.x, f.y, f.z)); }
    else if (pd > 450) f.flybyPlayed = false;
    if (!f.mesh) continue;
    f.mesh.position.set(f.x, f.y, f.z);
    f.mesh.rotation.set(f.pitch, f.yaw, f.evadeT > 0 ? -f.evadeDir * 0.9 : 0, 'YXZ');
  }
}

// ─── T-D-07: ordenança inimiga ───────────────────────────────────────────────

/** T-D-09: derrota final — overlay + restart no Espaço (startDefenseRun). */
function triggerDefeat(reason) {
  if (!game.defense || game.defense.defeated) return;
  game.defense.defeated = reason;
  game.flags.paused = true;
  exitPointerLock();
  if (reason === 'city') {
    showOverlay('INHAÚMA CAIU', 'a cidade foi destruída — ESPAÇO para defender de novo', 0);
  } else {
    showOverlay('BATERIA DESTRUÍDA', 'o artilheiro caiu — ESPAÇO para tentar de novo', 0);
  }
}

/** Dano no artilheiro + regen fora de combate; sem vidas = derrota 'battery'. */
function playerHit(dmg) {
  _turret.hp -= dmg;
  _sinceDamage = 0;
  audio.hit();
  game.flags.cameraShake = { intensity: 5, duration: 0.5 };
  if (_turret.hp > 0) return;
  _turret.lives -= 1;
  _turret.hp = AA_DEFENSE.HP;
  explosion(_v3.set(_turret.x, _turret.y + 2, _turret.z), 1.6, 0xffaa33);
  audio.explosion(1.0, _v3);
  if (_turret.lives <= 0) {
    registerPlayerDown(_director); // T-D-09: derrota consolidada no diretor
    triggerDefeat('battery');
  }
}

/** Bateria aliada destruída: explosão + carcaça fumegante (emissor persistente). */
function wreckBattery(b) {
  explosion(_v3.set(b.x, b.y + 1.5, b.z), 1.5, 0xff8833);
  audio.explosion(0.8, _v3);
  addSmokeEmitter(b.x, b.y + 2.2, b.z, b.mesh); // wreck fumegante persistente
  if (b.mesh) {
    b.mesh.traverse((o) => { if (o.material?.color) o.material.color.setHex(0x1a1a1a); });
    if (b.mesh.userData.barrel) b.mesh.userData.barrel.rotation.x = 0.9; // cano caído
  }
}

/** Impacto real do míssil AG: explosão + scorch + dano por tipo de alvo. */
function resolveAgImpact(m, imp) {
  const pos = _v3.set(imp.x, imp.y, imp.z);
  explosion(pos, 1.4, 0xffaa33);
  spawnScorchMark(pos, 9, 0.5);
  const pd = Math.hypot(imp.x - _turret.x, imp.y - _turret.y, imp.z - _turret.z);
  if (pd < 420) audio.explosion(0.9, pos); else audio.explosionFar(pos); // perto vs. distante
  const t = m.target;
  if (t.kind === 'city') {
    // T-D-09: o dano na cidade passa pelo DIRETOR (barra + derrota consistentes)
    const r = registerCityImpact(_director);
    if (t.ref) spawnPropFire(t.ref.x, (t.ref.topY || 6) * 0.6, t.ref.z, 1.8, 34);
    if (r.defeated) triggerDefeat('city');
  } else if (t.kind === 'base') {
    spawnPropFire(imp.x, imp.y + 2, imp.z, 1.4, 22);
  } else if (t.kind === 'battery') {
    if (t.ref && !t.ref.dead && imp.dist < 25 && damageBattery(t.ref, AA_DEFENSE.AG_BATT_DAMAGE)) {
      wreckBattery(t.ref);
    }
  } else if (t.kind === 'player' && pd < AA_DEFENSE.PLAYER_HIT_R) {
    playerHit(1);
  }
}

/** Step dos mísseis AG: arco/terminal dive, fumaça, interceptação, telegraph. */
function updateAgMissiles(dt) {
  // T-W-07: trilha discreta ~1 s + glow de propulsão à noite (ordenança inimiga)
  const night = nightFactor(game.timeOfDay ?? 0.35) > 0.3;
  for (let i = _agMissiles.length - 1; i >= 0; i--) {
    const m = _agMissiles[i];
    const ev = m.dead ? null : stepAgMissile(m, dt, { heightAt: inhaumaVisualSurfaceHeight });
    if (m.dead) {
      // Interceptado pela .50 no ar — bônus de interceptação (via diretor, T-D-09)
      explosion(_v3.set(m.x, m.y, m.z), 1.0, 0xffee99);
      audio.explosion(0.6, _v3);
      registerInterception(_director);
    } else {
      if (m.mesh?.userData.nightGlow) m.mesh.userData.nightGlow.visible = night;
      m.smokeT -= dt;
      if (m.smokeT <= 0) {
        m.smokeT = 0.05;
        spawnMissileSmoke(_v3.set(m.x, m.y, m.z), AG_TRAIL_OPTS);
      }
    }
    if (ev?.impact) resolveAgImpact(m, ev.impact);
    if (m.dead || ev) {
      if (m.mesh) _sceneRef.remove(m.mesh);
      _agMissiles.splice(i, 1);
      continue;
    }
    if (m.mesh) {
      m.mesh.position.set(m.x, m.y, m.z);
      m.mesh.lookAt(m.x + m.vx, m.y + m.vy, m.z + m.vz);
    }
  }
  // Telegraph do míssil anti-jogador: alarme + marcador #def-alert (hud.js)
  const alert = _agMissiles.some((m) => m.atPlayer && !m.dead);
  game.defense.alert = alert;
  if (alert) {
    _alarmT -= dt;
    if (_alarmT <= 0) { _alarmT = 0.9; audio.incomingAlarm(); }
  } else {
    _alarmT = 0;
  }
}

/** Step das rajadas inimigas: tracers + poeira no terreno + acerto no jogador. */
function updateEnemyTracers(dt) {
  for (let i = _enemyTracers.length - 1; i >= 0; i--) {
    const t = _enemyTracers[i];
    const ev = stepEnemyTracer(t, dt, {
      heightAt: inhaumaVisualSurfaceHeight,
      player: { x: _turret.x, y: _turret.y + AA_DEFENSE.EYE_HEIGHT, z: _turret.z },
    });
    if (ev?.impact) spawnDustPuff(_v3.set(ev.impact.x, ev.impact.y, ev.impact.z));
    if (ev?.playerHit) playerHit(1);
    if (ev) { _sceneRef.remove(t.mesh); _enemyTracers.splice(i, 1); continue; }
    t.mesh.position.set(t.x, t.y, t.z);
  }
}

// ─── T-D-08: baterias aliadas ────────────────────────────────────────────────

/** Fogo autônomo das baterias + mísseis ocasionais (eficácia baixa). */
function updateBatteries(dt) {
  for (const b of _batteries) {
    const events = stepBattery(b, dt, { rng: _rng.random, fighters: _fighters });
    for (const e of events) {
      if (e.type === 'tracer') {
        spawnAllyTracerMesh(_allyTracers, e.from,
          { x: e.dir.x * e.speed, y: e.dir.y * e.speed, z: e.dir.z * e.speed }, 4.0);
        audio.aaFire(_v3.set(e.from.x, e.from.y, e.from.z));
      } else if (e.type === 'missile') {
        const m = {
          x: e.from.x, y: e.from.y, z: e.from.z,
          vx: 0, vy: AA_DEFENSE.ALLY_BATT_MSL_SPEED * 0.7, vz: 0,
          target: e.target, willHit: e.willHit, life: 6.0, smokeT: 0,
          mesh: makeAgMissileMesh(),
        };
        m.mesh.position.set(m.x, m.y, m.z);
        _sceneRef.add(m.mesh);
        _allyMissiles.push(m);
        audio.missileWhoosh(_v3.set(m.x, m.y, m.z));
      }
    }
    // cano acompanha o alvo engajado (cosmético)
    if (!b.dead && b.mesh && events.length) {
      let best = null, bd = Infinity;
      for (const f of _fighters) {
        if (f.dead) continue;
        const d2 = (f.x - b.x) ** 2 + (f.z - b.z) ** 2;
        if (d2 < bd) { bd = d2; best = f; }
      }
      if (best) b.mesh.rotation.y = Math.atan2(-(best.x - b.x), -(best.z - b.z));
    }
  }
}

/** Tracers aliados: balística simples + poeira no terreno (sem dano — o
 *  dano real das baterias é só o míssil ocasional com willHit rolado). */
function updateAllyTracers(dt) {
  for (let i = _allyTracers.length - 1; i >= 0; i--) {
    const t = _allyTracers[i];
    t.life -= dt;
    t.x += t.vx * dt; t.y += t.vy * dt; t.z += t.vz * dt;
    if (t.life <= 0 || t.y <= inhaumaVisualSurfaceHeight(t.x, t.z)) {
      _sceneRef.remove(t.mesh); _allyTracers.splice(i, 1); continue;
    }
    t.mesh.position.set(t.x, t.y, t.z);
  }
}

/** Mísseis aliados: homing simples; acerto (willHit) drena HP do caça. */
function updateAllyMissiles(dt) {
  for (let i = _allyMissiles.length - 1; i >= 0; i--) {
    const m = _allyMissiles[i];
    const ev = stepAllyMissile(m, dt, { heightAt: inhaumaVisualSurfaceHeight });
    m.smokeT -= dt;
    if (!ev && m.smokeT <= 0) { m.smokeT = 0.06; spawnMissileSmoke(_v3.set(m.x, m.y, m.z)); }
    if (ev) {
      if (ev.hit && ev.target && !ev.target.dead) {
        ev.target.hp -= AA_DEFENSE.ALLY_BATT_MSL_DMG;
        if (ev.target.hp <= 0) killFighter(ev.target, 0.9, 'ally');
      }
      explosion(_v3.set(ev.impact.x, ev.impact.y, ev.impact.z), ev.hit ? 0.9 : 0.5, 0xffdd88);
      if (m.mesh) _sceneRef.remove(m.mesh);
      _allyMissiles.splice(i, 1);
      continue;
    }
    if (m.mesh) {
      m.mesh.position.set(m.x, m.y, m.z);
      m.mesh.lookAt(m.x + m.vx, m.y + m.vy, m.z + m.vz);
    }
  }
}

// ─── WEAPONS-V1 (T-W-05): horda no horizonte + nuke tática ──────────────────

/** Centroide das unidades VIVAS da horda (mira da nuke / telemetria), ou null. */
function hordeCentroid() {
  if (!_horde) return null;
  let n = 0, x = 0, y = 0, z = 0;
  for (const m of _horde.formation.members) {
    if (!m.alive) continue;
    x += m.pos.x; y += m.pos.y; z += m.pos.z; n++;
  }
  return n ? { x: x / n, y: y / n, z: z / n } : null;
}

/** Monta a horda no horizonte (borda do vale, ~2 km) marchando para Inhaúma.
 *  ENTIDADE LOCAL do modo defesa — NUNCA entra em game.targets (reuso direto
 *  de createFormation, sem registerAsTargets). */
function spawnHorde(dir) {
  const c = AA_DEFENSE.LOOK_AT;
  for (let k = 0; k < 6 && !_horde; k++) {
    const a = dir + k * (Math.PI / 3); // fallback angular se o path for rejeitado
    const f = createFormation({
      type: AA_DEFENSE.HORDE_TYPE,
      size: AA_DEFENSE.HORDE_SIZE,
      path: [
        { x: c.x + Math.cos(a) * AA_DEFENSE.HORDE_DIST, z: c.z + Math.sin(a) * AA_DEFENSE.HORDE_DIST },
        { x: c.x, z: c.z },
      ],
      deps: { rng: _rng, heightAt: inhaumaVisualSurfaceHeight, exclusions: [], riverPolyline: null },
    });
    if (!f) continue;
    f.speed = AA_DEFENSE.HORDE_SPEED; // marcha de boss — janela ≈ DIST/SPEED
    _sceneRef.add(f.group);
    _horde = { formation: f, alarmT: 0 };
  }
  if (_horde) {
    showOverlay('HORDA NO HORIZONTE', 'destrua antes que chegue a Inhaúma — NUKE no T', 3500);
    audio.hordeAlarm();
  }
}

/** Unidade da horda destruída (nuke): vira wreck congelado + explosão. */
function killHordeMember(m) {
  m.alive = false;
  registerHordeKill(_director);
  explosion(_v3.set(m.pos.x, m.pos.y + 1.5, m.pos.z), 0.8, 0xffaa33);
}

/** Marcha da horda: alarme periódico, wipe (sem vivos) ou chegada (−30% cidade). */
function updateHorde(dt) {
  if (!_horde) return;
  const f = _horde.formation;
  updateFormations(dt, [f], f.deps);
  _horde.alarmT -= dt;
  if (_horde.alarmT <= 0) { _horde.alarmT = 4.5; audio.hordeAlarm(); }
  const alive = f.members.reduce((n, m) => n + (m.alive ? 1 : 0), 0);
  if (alive === 0) {
    _sceneRef.remove(f.group); // varrida pela nuke — sem wreck de 18 unidades
    _horde = null;
    showOverlay('HORDA VARRIDA', 'Inhaúma resiste', 2200);
    return;
  }
  if (f.state === 'arrived') {
    const r = registerHordeArrival(_director);
    const c = hordeCentroid() ?? { x: AA_DEFENSE.LOOK_AT.x, y: 6, z: AA_DEFENSE.LOOK_AT.z };
    megaExplosion(_v3.set(c.x, c.y, c.z), 'crash');
    spawnPropFire(c.x, c.y + 4, c.z, 2.0, 34);
    audio.explosion(1.4, _v3);
    _sceneRef.remove(f.group);
    _horde = null;
    showOverlay('A HORDA ENTROU EM INHAÚMA', `integridade −${AA_DEFENSE.HORDE_CITY_DAMAGE}%`, 3000);
    if (r.defeated) triggerDefeat('city');
  }
}

/** Impacto da nuke tática: megaExplosion + shockwave + scorch + wipe por raio
 *  (caças no ar e unidades da horda no chão dentro de NUKE_RADIUS). */
function onNukeImpact(n) {
  const pos = _v3.set(n.x, n.y, n.z);
  megaExplosion(pos, 'crash');
  spawnShockwave(pos, AA_DEFENSE.NUKE_RADIUS * 1.2, 0xfff2cc);
  spawnScorchMark(pos, AA_DEFENSE.NUKE_RADIUS * 0.6, 0.7);
  audio.megaExplosion(pos);
  game.flags.cameraShake = { intensity: 8, duration: 1.2 };
  const R2 = AA_DEFENSE.NUKE_RADIUS * AA_DEFENSE.NUKE_RADIUS;
  for (const f of [..._fighters]) {
    if (f.dead) continue;
    const dx = f.x - n.x, dy = f.y - n.y, dz = f.z - n.z;
    if (dx * dx + dy * dy + dz * dz < R2) killFighter(f, 1.4, 'nuke');
  }
  if (_horde) {
    for (const m of _horde.formation.members) {
      if (!m.alive) continue;
      const dx = m.pos.x - n.x, dy = m.pos.y - n.y, dz = m.pos.z - n.z;
      if (dx * dx + dy * dy + dz * dz < R2) killHordeMember(m);
    }
  }
}

/** Beep da mira: ritmo por fase (vermelha = rápido), tom agudo na vermelha. */
function updateLockBeeps(dt) {
  const lk = _turret.lock;
  if (lk.idx < 0) { _beepT = 0; return; }
  _beepT -= dt;
  if (_beepT <= 0) {
    const red = lockPhase(lk)?.index === 1; // T-W-08
    audio.lockBeep(red);
    _beepT = red ? 0.22 : 0.42;
  }
}

// ─── WEAPONS-V1: disparo das armas da bateria (T-W-01..T-W-06) ───────────────
// T-D-05: o míssil AA ficou no X porque o botão direito já é o ZOOM do
// turret-camera (T-D-03). Registrado 1x no load; o guard de _turret/
// game.defense o torna inerte fora do modo. WEAPONS-V1 estende: teclas diretas
// X/B/T/R (mesmo mapa de ações do caça) + scroll/dígitos ciclando o slot.

/** Modo defesa ativo e jogando (guard comum dos handlers de tecla). */
function defenseActive() {
  return _turret && game.defense && game.running && !game.flags.paused;
}

/** Boca do tubo do lançador (z≈-3,6 no mesh) ao longo da mira. */
function launcherMuzzle(dir) {
  _muzzle.set(
    _turret.x + dir.x * 3.8,
    _turret.y + AA_DEFENSE.EYE_HEIGHT + dir.y * 3.8,
    _turret.z + dir.z * 3.8,
  );
  return _muzzle;
}

/** T-W-02: míssil AA homing — tier 'x' (fraco, 3 hits, 2/s) ou 'b' (forte,
 *  1 hit, 1/2s). Exige alvo na mira (qualquer fase). T-W-08: o acerto sai do
 *  ROLL da fase (amarelo 50% / vermelho 80%) — HIT = PN normal, MISS = offset
 *  terminal seedado; cada disparo conta 1 dos 5 mísseis que a mira sustenta.
 *  @returns {'fired'|'cooldown'|'nolock'} — 'cooldown' alimenta a fila do X. */
function fireAaTier(tier) {
  if (!defenseActive()) return 'nolock';
  const lk = _turret.lock;
  const f = lk.idx >= 0 ? _fighters[lk.idx] : null;
  const ph = lockPhase(lk);
  if (!f || f.dead || !ph) { audio.overheatClick(); return 'nolock'; }
  const b = tier === 'b';
  if (!consumeTier(_turret, b ? 'bCooldown' : 'aaCooldown',
      b ? AA_DEFENSE.AA_B_INTERVAL : AA_DEFENSE.AA_FIRE_INTERVAL)) return 'cooldown';
  const dir = gimbalForward(_turret.yaw, _turret.pitch, _fwd);
  spawnAaMissile(launcherMuzzle(dir), dir, f, {
    damage: b ? AA_DEFENSE.AA_B_DAMAGE : AA_DEFENSE.AA_X_DAMAGE,
    tier,
    willHit: rollLockHit(_rng.random, ph.hitP), // T-W-08: 50%/80% por fase
  });
  noteLockShot(lk); // T-W-08: o 5º míssil no alvo solta a mira (stepLockPhase)
  selectWeapon(_turret, b ? 'b' : 'aa'); // HUD acompanha a tecla direta
  return 'fired';
}

/** T-W-04: rod cinético (R) — sem exigir lock (semeia no lock ou no mais
 *  próximo do cone do retículo); perfura e encadeia até 3 kills. */
function fireDefenseRod() {
  if (!defenseActive()) return;
  if (!consumeTier(_turret, 'rodCooldown', AA_DEFENSE.ROD_INTERVAL)) {
    audio.overheatClick();
    return;
  }
  const eye = { x: _turret.x, y: _turret.y + AA_DEFENSE.EYE_HEIGHT, z: _turret.z };
  const dir = gimbalForward(_turret.yaw, _turret.pitch, _fwd);
  const lk = _turret.lock;
  let target = lk.idx >= 0 ? _fighters[lk.idx] : null; // T-W-08: mira em qualquer fase
  if (!target || target.dead) {
    const idx = pickLockTarget(eye, dir, _fighters);
    target = idx >= 0 ? _fighters[idx] : null;
  }
  spawnRodDart(launcherMuzzle(dir), dir, target);
  selectWeapon(_turret, 'rod');
}

/** T-W-05: nuke tática (T) — arco alto ao ponto de mira no terreno (ou
 *  direto na horda, se a mira cair perto dela). Estoque 3, sem recarga. */
function fireDefenseNuke() {
  if (!defenseActive()) return;
  if (_turret.nukes <= 0 ||
      !consumeTier(_turret, 'nukeCooldown', AA_DEFENSE.NUKE_COOLDOWN)) {
    audio.overheatClick();
    return;
  }
  const eye = { x: _turret.x, y: _turret.y + AA_DEFENSE.EYE_HEIGHT, z: _turret.z };
  const dir = gimbalForward(_turret.yaw, _turret.pitch, _fwd);
  let aim = groundAimPoint(eye, dir, inhaumaVisualSurfaceHeight);
  const hc = hordeCentroid();
  if (hc) {
    // Mira na horda se a LINHA do raio passa perto dela (não o ponto de chão:
    // o relevo do vale pode cortar o raio muito antes dos 2 km da horda).
    const rx = hc.x - eye.x, ry = hc.y - eye.y, rz = hc.z - eye.z;
    const along = rx * dir.x + ry * dir.y + rz * dir.z;
    if (along > 0) {
      const px = eye.x + dir.x * along, py = eye.y + dir.y * along, pz = eye.z + dir.z * along;
      if (Math.hypot(hc.x - px, hc.y - py, hc.z - pz) < 250) {
        // LEAD: a horda marcha ~HORDE_SPEED m/s para a cidade durante o voo
        // (arco + glide ≈ dist/NUKE_SPEED) — a nuke cai na frente dela.
        const c = AA_DEFENSE.LOOK_AT;
        const dx = c.x - hc.x, dz = c.z - hc.z;
        const dl = Math.hypot(dx, dz) || 1e-9;
        const flightT = AA_DEFENSE.NUKE_ARC_S + dl / AA_DEFENSE.NUKE_SPEED;
        const lead = AA_DEFENSE.HORDE_SPEED * flightT;
        aim = { x: hc.x + (dx / dl) * lead, y: hc.y, z: hc.z + (dz / dl) * lead, dist: dl };
      }
    }
  }
  _turret.nukes -= 1;
  spawnDefenseNuke(launcherMuzzle(dir), dir, aim);
  selectWeapon(_turret, 'nuke');
}

// T-W-08: disparo seguido — cada pressão no X = 1 míssil; pressão dentro da
// cadência ENFILEIRA (cap AA_QUEUE_CAP, não se perde); segurar o X repete na
// cadência (flag missileHeld no update — e.repeat não enfileira).
onAction('missile', (e) => {
  if (!defenseActive() || e?.repeat) return; // segurar = auto-fogo no update
  if (fireAaTier('x') === 'cooldown') enqueueAaShot(_turret);
});
onAction('heavyMissile', () => fireAaTier('b'));   // B — míssil forte (1/2s)
onAction('nuclearMissile', fireDefenseNuke);       // T — nuke tática (3, sem recarga)
onAction('rodMissile', fireDefenseRod);            // R — rod cinético (1/5s)
// Slots diretos 1-5 (mesma ordem do scroll): mg · X · B · T · R
const _SLOT_KEYS = ['mg', 'aa', 'b', 'nuke', 'rod'];
for (let i = 0; i < _SLOT_KEYS.length; i++) {
  onAction('slot' + (i + 1), () => { if (defenseActive()) selectWeapon(_turret, _SLOT_KEYS[i]); });
}

/** Cria o modo defesa. Chamado por main.js#selectMap após o create do mapa. */
export function createDefenseMode({ scene, jet }) {
  _sceneRef = scene;
  _rng = createRng((game.rng?.seed ?? 'aero-default-seed') + ':defense-d3');
  _director = createDefenseDirector(game.rng?.seed ?? 'aero-default-seed'); // T-D-09
  const { x, z } = AA_DEFENSE.SOLDIER_POS;
  const groundY = inhaumaVisualSurfaceHeight(x, z);
  const townY = inhaumaVisualSurfaceHeight(AA_DEFENSE.LOOK_AT.x, AA_DEFENSE.LOOK_AT.z);
  _turret = createTurretPlayer({
    x, y: groundY, z,
    lookAt: { x: AA_DEFENSE.LOOK_AT.x, y: townY + 4, z: AA_DEFENSE.LOOK_AT.z },
  });
  _camState = createTurretCameraState();
  _paras = createParachutePool(_sceneRef, 2); // T-D-10: ejeções (bounded)
  // CONTRATO: writer de game.defense — telemetria do diretor (T-D-09: score,
  // kills, cityIntegrity, spawnInterval, squadSize, alive, queued, defeated)
  // é re-sincronizada a cada frame em updateDefenseMode.
  game.defense = {
    turret: _turret,
    cityIntegrity: 100, score: 0, kills: 0, defeated: null,
    spawnInterval: AA_DEFENSE.DIR_BASE_INTERVAL, squadSize: 1, alive: 0, queued: 0,
    heat: 0, overheat: false,                 // T-D-04: calor da .50 (0..1)
    missiles: _turret.ammo.aa, aaRechargeFrac: 0, // T-D-05: estoque + recarga
    lockFrac: 0, locked: false,               // T-D-05: tracking/lock do AA
    lockVisible: false, lockX: 0, lockY: 0,   // T-D-05: quadrado de lock (px)
    alert: false,                             // T-D-07: míssil anti-jogador inbound
    // WEAPONS-V1: slot ativo, cooldowns por tier, estoque de nukes, horda
    weaponLabel: WEAPON_LABELS.mg,
    cdX: 0, cdB: 0, cdRod: 0,
    nukes: _turret.nukes,
    hordeEta: null,                           // s até a horda chegar (null = sem horda)
  };
  // WEAPONS-V1: suspende os supplies do JATO enquanto o modo dura — as teclas
  // B/T/R chegam também aos handlers de voo (main.js) e sem isto disparariam
  // mísseis do jato escondido. Restaurado no dispose.
  _stashSupplies = {
    heavy: game.player.heavyMissiles,
    nuke: game.player.nuclearMissiles,
    rod: game.player.rodMissiles,
  };
  game.player.heavyMissiles = 0;
  game.player.nuclearMissiles = 0;
  game.player.rodMissiles = 0;
  jet.visible = false;    // sem jato neste modo — nem mesh, nem física

  // Esconde a mira SVG do voo — a defesa tem retículo próprio no HUD.
  const crosshairEl = document.getElementById('crosshair');
  if (crosshairEl) crosshairEl.style.display = 'none';

  _battery = makeDefenseBatteryMesh();
  _battery.position.set(x, groundY, z);
  _battery.rotation.y = _turret.yaw;
  // estado inicial da troca de arma: .50 ativa, lançador recolhido (gira 90°)
  if (_battery.userData.barrelAa) _battery.userData.barrelAa.rotation.y = Math.PI / 2;
  scene.add(_battery);

  // T-D-06: alvos 'city' (estruturas da TOWN_SHELF) e 'base' (aeródromo).
  _cityTargets = getInhaumaStructures()
    .filter((s) => s.x >= TOWN_SHELF.minX - 40 && s.x <= TOWN_SHELF.maxX + 40 &&
      s.z >= TOWN_SHELF.minZ - 40 && s.z <= TOWN_SHELF.maxZ + 40)
    .map((s) => ({ x: s.x, z: s.z, topY: s.topY, ref: s }));
  const ap = inhaumaAirport;
  _baseTargets = [
    { x: ap.runway.center.x, y: inhaumaVisualSurfaceHeight(ap.runway.center.x, ap.runway.center.z) + 2, z: ap.runway.center.z },
    { x: ap.serviceZone.center.x, y: inhaumaVisualSurfaceHeight(ap.serviceZone.center.x, ap.serviceZone.center.z) + 2, z: ap.serviceZone.center.z },
  ];
  _basePos = { x: ap.runway.center.x, z: ap.runway.center.z };

  // T-D-08: baterias AA aliadas (morro + base, seedadas, ancoradas no DEM)
  placeBatteries(scene);

  // T-D-09: o diretor agenda as esquadrilhas (sem maintainer de contagem fixa)
  _fighters = [];
  game.defense.fighters = _fighters;        // handle de debug/telemetria
  game.defense.spawnFighter = spawnOneFighter; // debug hook (smoke tests)
  game.defense.director = _director;        // debug hook (smoke tests)
  // T-D-09/10: hooks de smoke — forçam abate e impacto na cidade (screenshots)
  game.defense.killFighter = (f) => killFighter(f ?? _fighters.find((x) => !x.dead), 1.0, 'mg');
  game.defense.debugCityHit = () => {
    const r = registerCityImpact(_director);
    if (r.defeated) triggerDefeat('city');
  };
  // WEAPONS-V1: hooks de smoke — força a horda e lê o estado dela
  game.defense.forceHorde = (dir = null) => spawnHorde(dir ?? _rng.random() * Math.PI * 2);
  game.defense.hordeState = () => (_horde ? {
    alive: _horde.formation.members.filter((m) => m.alive).length,
    state: _horde.formation.state,
    centroid: hordeCentroid(),
  } : null);

  // Pointer lock: sair do lock com o jogo rodando = pausa. Lê
  // document.pointerLockElement DIRETO (não o flag de input.js — instalado
  // depois; bug pego no smoke da Onda D1). Clique re-trava a mira.
  _lockHandler = () => {
    if (!document.pointerLockElement && game.running && !game.flags.paused) pauseDefense();
  };
  document.addEventListener('pointerlockchange', _lockHandler);
  // Clique re-trava a mira (gesto do usuário) quando destravado
  _clickHandler = () => {
    if (game.running && !game.flags.paused && !input.pointerLocked) {
      requestPointerLock(document.body);
    }
  };
  document.addEventListener('click', _clickHandler);
}

/** T-D-08: semeia as baterias aliadas (usado no create e no restart da D4). */
function placeBatteries(scene) {
  _batteries = placeAlliedBatteries(_rng.random, {
    heightAt: inhaumaVisualSurfaceHeight,
    soldier: AA_DEFENSE.SOLDIER_POS,
    base: _basePos,
  });
  for (const b of _batteries) {
    b.mesh = makeDefenseBatteryMesh();
    b.mesh.position.set(b.x, b.y, b.z);
    b.mesh.rotation.y = b.yaw;
    scene.add(b.mesh);
  }
}

function pauseDefense() {
  game.flags.paused = true;
  showOverlay('PAUSADO', 'pressione P para continuar', 0);
}

/** Remove os meshes de uma lista de entidades da cena e devolve lista vazia. */
function removeMeshes(list) {
  for (const it of list) if (it.mesh) _sceneRef.remove(it.mesh);
  return [];
}

/** T-D-09: reseta o run pós-derrota (Espaço no overlay de derrota). */
function resetDefenseRun() {
  resetDirector(_director);
  _turret.hp = AA_DEFENSE.HP;
  _turret.lives = AA_DEFENSE.LIVES;
  _turret.ammo.aa = AA_DEFENSE.AA_STOCK;
  _turret.aaRecharge = 0;
  _turret.mg.heat = 0; _turret.mg.overheated = false; _turret.mg.acc = 0;
  resetLock(_turret.lock); // T-W-08: mira por fases
  _turret.fireQueue = 0;
  // WEAPONS-V1: nukes no estoque inicial, cooldowns zerados, horda removida
  _turret.nukes = AA_DEFENSE.NUKE_STOCK;
  _turret.aaCooldown = 0; _turret.bCooldown = 0;
  _turret.rodCooldown = 0; _turret.nukeCooldown = 0;
  if (_horde) { _sceneRef.remove(_horde.formation.group); _horde = null; }
  _sinceDamage = 99; _regenT = 0;
  // Entidades: remove caças (vivos e caindo), ordenança e tracers
  _fighters = removeMeshes(_fighters);
  _falling = [];
  _agMissiles = removeMeshes(_agMissiles);
  _enemyTracers = removeMeshes(_enemyTracers);
  _allyTracers = removeMeshes(_allyTracers);
  _allyMissiles = removeMeshes(_allyMissiles);
  for (const p of _paras.active) { p.mesh.visible = false; _paras.free.push(p); }
  _paras.active = [];
  clearFallFx();
  clearPropFires();
  clearMgBullets();
  clearAaMissiles();
  clearRodDarts();
  clearDefenseNukes();
  // Baterias aliadas: re-semeia (wrecks voltam à vida no novo run)
  for (const b of _batteries) {
    if (b.wreck) removeSmokeEmittersOf(b.mesh);
    if (b.mesh) _sceneRef.remove(b.mesh);
  }
  placeBatteries(_sceneRef);
  game.defense.defeated = null;
}

/** Espaço/Enter no modo defesa: inicia a partida — ou REINICIA após a derrota. */
export function startDefenseRun() {
  if (game.defense?.defeated) resetDefenseRun();
  else if (game.running || game.flags.paused) return;
  // CONTRATO: writer de game.running
  game.running = true;
  game.flags.paused = false;
  hideOverlay();
  consumeMouseDeltas(); // descarta deltas acumulados antes do início
  requestPointerLock(document.body);
}

/** Update por frame (só com game.running e sem pausa — chamado pelo main tick). */
export function updateDefenseMode(dt) {
  if (!_turret) return;
  const m = consumeMouseDeltas();
  _frameMouse.dx = m.dx;
  _frameMouse.dy = m.dy;
  _frameMouse.wheel = m.wheel;
  _frameMouse.left = input.mouse.left;
  _frameMouse.right = input.mouse.right;
  // Scroll cicla a arma (mg → X → B → T → R)
  if (m.wheel !== 0) cycleWeapon(_turret, m.wheel > 0 ? 1 : -1);
  // Visual: a bateria acompanha o gimbal + troca de arma animada (upgrade
  // operador 2026-07-19): o cano ativo fica a 0° e o inativo gira 90° para o
  // lado (some da tela), com lerp suave entre os estados.
  if (_battery) {
    _battery.rotation.y = _turret.yaw;
    if (_battery.userData.barrel) _battery.userData.barrel.rotation.x = _turret.pitch;
    const mgW = _turret.weapon === 'mg';
    const k = Math.min(1, dt * 5); // ~0,2 s de giro
    if (_battery.userData.barrelMg) {
      const cur = _battery.userData.barrelMg.rotation.y;
      _battery.userData.barrelMg.rotation.y = cur + ((mgW ? 0 : Math.PI / 2) - cur) * k;
    }
    if (_battery.userData.barrelAa) {
      const cur = _battery.userData.barrelAa.rotation.y;
      _battery.userData.barrelAa.rotation.y = cur + ((mgW ? Math.PI / 2 : 0) - cur) * k;
    }
  }

  // ── T-D-04: .50 (LMB segurado, só com pointer lock; testMode permite o
  // smoke headless sem lock). Balística real — os tracers voam de verdade. ──
  const eye = { x: _turret.x, y: _turret.y + AA_DEFENSE.EYE_HEIGHT, z: _turret.z };
  const f = gimbalForward(_turret.yaw, _turret.pitch, _fwd);
  const wantMg = _frameMouse.left && _turret.weapon === 'mg' &&
    (input.pointerLocked || game.runtime?.testMode);
  const wasOverheated = _turret.mg.overheated;
  const shots = mgFireTick(_turret.mg, dt, wantMg);
  if (!wasOverheated && _turret.mg.overheated) audio.overheatClick();
  for (let s = 0; s < shots; s++) {
    const dir = mgSpreadDir(f, () => game.rng.random());
    // boca do cano longo da .50 (ponta em z≈-6,1 no mesh — upgrade operador)
    _muzzle.set(eye.x + dir.x * 6.2, eye.y + dir.y * 6.2, eye.z + dir.z * 6.2);
    spawnMgBullet(_muzzle, dir);
    spawnMuzzleFlash(_muzzle);
    audio.fiftyCal();
  }

  // ── T-W-08: mira por FASES no alvo do cone do retículo (amarelo 1,5 s →
  // vermelho 1,5 s → amarelo 1,5 s; solta no fim do ciclo ou no 5º míssil) ──
  stepLockPhase(_turret.lock, pickLockTarget(eye, f, _fighters), dt);
  updateLockBeeps(dt);
  stepAaRecharge(_turret, dt);
  stepTierCooldowns(_turret, dt); // WEAPONS-V1: cadências por tier (X/B/T/R)
  // T-W-08: segurar X = auto-fogo na cadência; a fila das pressões na cadência
  // drena 1 por cadência; sem mira, a fila morre (míssil é homing — precisa de alvo)
  if (input.missileHeld) fireAaTier('x');
  while ((_turret.fireQueue ?? 0) > 0) {
    if (fireAaTier('x') !== 'fired') break;
    _turret.fireQueue -= 1;
  }
  if (_turret.lock.idx < 0) _turret.fireQueue = 0;
  // T-D-06: caça na fase VERMELHA dispara chaff/flare + evasão dura (miss da PN)
  const _ph = lockPhase(_turret.lock);
  const lf = _turret.lock.idx >= 0 ? _fighters[_turret.lock.idx] : null;
  if (lf && !lf.dead && _ph?.index === 1) lf.locked = true;

  // ── T-D-09: diretor — esquadrilhas escalando por kills (fila no cap) ──
  const alive = _fighters.reduce((n, ft) => n + (ft.dead ? 0 : 1), 0);
  for (const e of stepDirector(_director, dt, alive)) {
    if (e.type === 'spawn') for (let k = 0; k < e.count; k++) spawnOneFighter(e.dir);
  }
  // ── T-W-05: agenda da horda (seedada, no diretor) — 1 horda ativa por vez ──
  if (!_horde) {
    for (const e of stepHorde(_director, dt)) {
      if (e.type === 'horde-spawn') spawnHorde(e.dir);
    }
  }
  updateHorde(dt);

  // ── Onda D3/D4: caças (vivos + queda cinematográfica), ordenança, baterias ──
  updateFighters(dt);
  updatePoolParachutes(_paras, dt, inhaumaVisualSurfaceHeight,
    AA_DEFENSE.PARA_SINK, AA_DEFENSE.PARA_DRIFT);
  updateAgMissiles(dt);
  updateEnemyTracers(dt);
  updateBatteries(dt);
  updateAllyTracers(dt);
  updateAllyMissiles(dt);

  // HP regen fora de combate
  _sinceDamage += dt;
  if (_sinceDamage > 8 && _turret.hp < AA_DEFENSE.HP) {
    _regenT += dt;
    if (_regenT >= 4) { _regenT = 0; _turret.hp += 1; }
  }

  // ── Projéteis do jogador (.50 alveja caças E mísseis anti-jogador) ──
  const mgTargets = [];
  for (const ft of _fighters) if (!ft.dead) mgTargets.push(ft);
  for (const am of _agMissiles) if (am.atPlayer && !am.dead) mgTargets.push(am);
  updateMgBullets(dt, {
    heightAt: inhaumaVisualSurfaceHeight,
    targets: mgTargets,
    onTargetHit: onMgHit,
    onTerrainHit: (b) => spawnDustPuff(_v3.set(b.x, b.y, b.z)),
  });
  updateAaMissiles(dt, {
    heightAt: inhaumaVisualSurfaceHeight,
    targets: _fighters, // T-W-03: retarget de míssil órfão ao vivo mais próximo
    onKill: (t) => killFighter(t, 1.2, 'aa'),
    onHit: (t) => { spawnFlash(_v3.set(t.x, t.y, t.z), 2.0); audio.hit(); }, // T-W-02: avaria do X
  });
  // T-W-04/T-W-05: rod perfurante e nuke tática
  updateRodDarts(dt, {
    heightAt: inhaumaVisualSurfaceHeight,
    targets: _fighters,
    onRodKill: (t) => killFighter(t, 1.0, 'rod'),
  });
  updateDefenseNukes(dt, { heightAt: inhaumaVisualSurfaceHeight, onImpact: onNukeImpact });

  // ── HUD (diff-render em hud.js) + telemetria do diretor (T-D-09) ──
  Object.assign(game.defense, directorTelemetry(_director, alive));
  game.defense.heat = _turret.mg.heat;
  game.defense.overheat = _turret.mg.overheated;
  game.defense.missiles = _turret.ammo.aa;
  game.defense.aaRechargeFrac =
    _turret.ammo.aa >= AA_DEFENSE.AA_STOCK ? 0 : _turret.aaRecharge / AA_DEFENSE.AA_RECHARGE_S;
  // T-W-08: 'locked' no HUD = fase VERMELHA; lockFrac = progresso do ciclo
  const _phHud = lockPhase(_turret.lock);
  game.defense.locked = _phHud?.index === 1;
  game.defense.lockFrac = _phHud ? _phHud.cycleFrac : 0;
  // WEAPONS-V1: slot ativo, cooldowns por tier, nukes e janela da horda
  game.defense.weaponLabel = WEAPON_LABELS[_turret.weapon] ?? WEAPON_LABELS.mg;
  game.defense.cdX = _turret.aaCooldown ?? 0;
  game.defense.cdB = _turret.bCooldown ?? 0;
  game.defense.cdRod = _turret.rodCooldown ?? 0;
  game.defense.nukes = _turret.nukes;
  if (_horde) {
    const f = _horde.formation;
    game.defense.hordeEta = Math.max(0, (f.pathLength + f.maxBack - f.progress) / (f.speed || 1));
  } else {
    game.defense.hordeEta = null;
  }
}

/** Câmera do modo defesa (chamada pelo updateCamera do main em TODO frame). */
export function updateDefenseCamera(dt, camera) {
  if (!_turret) return;
  const active = game.running && !game.flags.paused;
  updateTurretCamera(active ? dt : 0, camera, _turret, _camState, active ? _frameMouse : _NO_MOUSE);
  // Nunca deixa a câmera entrar no morro (ela recua morro acima)
  const gh = inhaumaVisualSurfaceHeight(camera.position.x, camera.position.z);
  if (camera.position.y < gh + 0.6) camera.position.y = gh + 0.6;
  // T-D-05: projeta o alvo do lock para o HUD (quadrado fechando sobre o caça)
  if (game.defense) {
    const lk = _turret.lock;
    const ft = lk.idx >= 0 ? _fighters[lk.idx] : null;
    if (active && ft && !ft.dead && lk.idx >= 0) { // T-W-08: qualquer fase
      _proj.set(ft.x, ft.y, ft.z).project(camera);
      game.defense.lockX = (_proj.x * 0.5 + 0.5) * window.innerWidth;
      game.defense.lockY = (-_proj.y * 0.5 + 0.5) * window.innerHeight;
      game.defense.lockVisible = _proj.z < 1;
    } else {
      game.defense.lockVisible = false;
    }
  }
  return gimbalForward(_turret.yaw, _turret.pitch, _fwd);
}

const _NO_MOUSE = { dx: 0, dy: 0, wheel: 0, left: false, right: false };

/** Posição-âncora do soldado — o terreno infinito recentra nela, não no jato. */
export function defenseAnchor() {
  return _turret ?? { x: AA_DEFENSE.SOLDIER_POS.x, y: 0, z: AA_DEFENSE.SOLDIER_POS.z };
}

/** Desfaz o modo (troca de mapa): devolve jato, mira de voo e limpa estado. */
export function disposeDefenseMode({ scene, jet }) {
  exitPointerLock();
  if (_lockHandler) document.removeEventListener('pointerlockchange', _lockHandler);
  if (_clickHandler) document.removeEventListener('click', _clickHandler);
  _lockHandler = null;
  _clickHandler = null;
  if (_battery) scene.remove(_battery);
  _battery = null;
  // Onda D3/D4: limpa caças, ordenança, baterias, paraquedas e FX da queda
  _fighters = removeMeshes(_fighters);
  _falling = [];
  _agMissiles = removeMeshes(_agMissiles);
  _enemyTracers = removeMeshes(_enemyTracers);
  _allyTracers = removeMeshes(_allyTracers);
  _allyMissiles = removeMeshes(_allyMissiles);
  if (_paras) { clearParachutePool(_paras); _paras = null; }
  for (const b of _batteries) {
    if (b.wreck) removeSmokeEmittersOf(b.mesh);
    if (b.mesh) scene.remove(b.mesh);
  }
  _batteries = [];
  _cityTargets = [];
  _baseTargets = [];
  if (_horde) { scene.remove(_horde.formation.group); _horde = null; }
  // WEAPONS-V1: devolve os supplies do jato (suspensos no create)
  if (_stashSupplies) {
    game.player.heavyMissiles = _stashSupplies.heavy;
    game.player.nuclearMissiles = _stashSupplies.nuke;
    game.player.rodMissiles = _stashSupplies.rod;
    _stashSupplies = null;
  }
  _sceneRef = null;
  _rng = null;
  _director = null;
  clearPropFires();
  clearFallFx();
  clearMgBullets();
  clearAaMissiles();
  clearRodDarts();
  clearDefenseNukes();
  const crosshairEl = document.getElementById('crosshair');
  if (crosshairEl) crosshairEl.style.display = '';
  jet.visible = true;
  // CONTRATO: writer de game.defense
  game.defense = null;
  _turret = null;
  _camState = null;
}
