// boss.js — BOSS KAIJU "GODZILLÃO": monstro gigante que nasce quando todas as
// fortificações inimigas da rodada são destruídas. Anda, colhe pedras gigantes do
// chão e as arremessa no avião. Só após matá-lo o pouso é liberado.
//
// Exporta: spawnBoss, updateBoss, bossAlive, clearBoss, getBoss.
//
// Integração:
//  - O boss entra em game.targets como { type:'boss' } → balas/mísseis/nuke já o
//    acertam e perseguem (homing) sem código extra. targets.js trata a morte como
//    caso especial (não conta no wave; dispara onDeath daqui).
//  - game.flags.bossActive = true enquanto vivo → player.js bloqueia o pouso.

import * as THREE from '../../vendor/three.module.min.js';
import { scene } from './scene.js';
import { game } from './state.js';
import { audio } from './audio.js';
import { explosion, megaExplosion, spawnShockwave, spawnMissileSmoke } from './fx.js';
import { surfaceInfoAt } from './world.js';

const BOSS = Object.freeze({
  HP: 200,            // resistência — exige fogo sustentado / mísseis pesados / 1 nuke
  HIT_R: 24,          // m — raio de acerto (boss é enorme); hr2 = HIT_R²
  WALK_SPD: 16,       // m/s — anda devagar em direção ao avião
  TORSO_Y: 38,        // m — altura do centro do torso (ponto de mira / homing)
  THROW_INTERVAL: 3.4,// s — cadência de arremesso de pedras
  WINDUP: 0.85,       // s — tempo de "armar" o braço antes de soltar
  THROW_RANGE: 1100,  // m — só arremessa se o avião estiver dentro disso
  ROCK_SPD: 150,      // m/s — velocidade base da pedra
  ROCK_HIT_R: 16,     // m — raio de dano da pedra no avião
  ROCK_GRAV: 26,      // m/s² — gravidade da pedra (arco balístico)
  SPAWN_AHEAD: 560,   // m — distância à frente do avião onde o monstro nasce
  RISE_TIME: 2.2,     // s — emerge do chão subindo
  SKIN: 0x3a7a3a, SKIN_DARK: 0x265226, BELLY: 0x93a35e,
  PLATE: 0xcdd6e0, CLAW: 0xe8e4d8, EYE: 0xffda44, MOUTH: 0x401010,
  ROCK: 0x6b6256, ROCK_DARK: 0x4a443a,
});

let boss = null;     // estado vivo do boss (ou null)

function gmat(color, opts = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0.05, ...opts });
}

/** Constrói o mesh do kaiju, origem nos PÉS (y=0 = chão). */
function buildKaiju() {
  const g = new THREE.Group();
  // Emissivo leve para o monstro nunca virar silhueta preta em contraluz / noite.
  const skin = gmat(BOSS.SKIN, { emissive: 0x0e2410, emissiveIntensity: 0.4 });
  const skinD = gmat(BOSS.SKIN_DARK, { emissive: 0x0a1c0a, emissiveIntensity: 0.35 });
  const belly = gmat(BOSS.BELLY, { emissive: 0x1a1e0a, emissiveIntensity: 0.3 });
  const plateM = gmat(BOSS.PLATE, { roughness: 0.55, metalness: 0.1, emissive: 0x101820, emissiveIntensity: 0.25 });
  const clawM = gmat(BOSS.CLAW, { roughness: 0.4 });
  const eyeM = new THREE.MeshBasicMaterial({ color: BOSS.EYE });
  const mouthM = gmat(BOSS.MOUTH, { roughness: 1 });

  const add = (parent, geo, mat, x, y, z) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = true; m.receiveShadow = true;
    parent.add(m);
    return m;
  };

  // ── Pernas (origem nos pés) ──
  const legGeo = new THREE.CylinderGeometry(4.2, 5.4, 22, 8);
  const footGeo = new THREE.BoxGeometry(9, 4, 13);
  const legs = [];
  for (const sx of [-6.5, 6.5]) {
    const leg = add(g, legGeo, skin, sx, 11, 0);
    add(g, footGeo, skinD, sx, 2, 2.5);
    // garras dos pés
    for (const cz of [-3.5, 0, 3.5]) add(g, new THREE.ConeGeometry(1.1, 3, 5), clawM, sx, 1.2, 8 + cz * 0.001 + 5).rotation.x = -Math.PI / 2;
    legs.push(leg);
  }

  // ── Torso (inclinado para frente, postura de kaiju) ──
  const torso = new THREE.Group();
  torso.position.set(0, 22, 0);
  g.add(torso);
  add(torso, new THREE.CylinderGeometry(9, 11, 26, 10), skin, 0, 11, 0);
  add(torso, new THREE.CylinderGeometry(7.4, 9.2, 22, 10), belly, 0, 10, 3.4); // barriga clara
  add(torso, new THREE.SphereGeometry(10, 12, 10), skin, 0, 22, -0.5); // peito alto

  // ── Cabeça + mandíbula ──
  const head = new THREE.Group();
  head.position.set(0, 30, 4);
  torso.add(head);
  add(head, new THREE.BoxGeometry(11, 9, 13), skin, 0, 2, 1);
  add(head, new THREE.BoxGeometry(9, 4.5, 7), mouthM, 0, -1.5, 6.5);   // boca aberta
  add(head, new THREE.BoxGeometry(10, 3.2, 8), skinD, 0, 3.2, 5);      // focinho topo
  for (const ex of [-3.2, 3.2]) {
    add(head, new THREE.SphereGeometry(1.5, 8, 8), eyeM, ex, 3, 7);
  }
  // dentes
  for (let i = -3; i <= 3; i++) {
    add(head, new THREE.ConeGeometry(0.55, 2.2, 4), clawM, i * 1.2, -0.3, 9).rotation.x = Math.PI;
  }

  // ── Braços (o direito arremessa) ──
  const arms = [];
  for (const side of [-1, 1]) {
    const arm = new THREE.Group();
    arm.position.set(side * 10, 38, 1.5);
    torso.add(arm);
    add(arm, new THREE.CylinderGeometry(2.6, 3.2, 14, 7), skin, side * 1, -6, 2).rotation.x = 0.5;
    const hand = new THREE.Group();
    hand.position.set(side * 1.5, -13, 5.5);
    arm.add(hand);
    add(hand, new THREE.SphereGeometry(3.2, 8, 8), skinD, 0, 0, 0);
    for (const cx of [-2, 0, 2]) add(hand, new THREE.ConeGeometry(0.8, 3, 4), clawM, cx, -2, 2).rotation.x = Math.PI / 2;
    arm.userData.hand = hand;
    arms.push(arm);
  }

  // ── Cauda (segmentada, atrás, descendo ao chão) ──
  const tail = new THREE.Group();
  tail.position.set(0, 20, -8);
  g.add(tail);
  let seg = tail;
  for (let i = 0; i < 6; i++) {
    const s = new THREE.Group();
    s.position.set(0, -1.6, -7);
    const r = 5 - i * 0.7;
    add(s, new THREE.CylinderGeometry(r * 0.7, r, 7, 7), skin, 0, 0, -3).rotation.x = Math.PI / 2;
    seg.add(s);
    seg = s;
  }

  // ── Placas dorsais (maple-leaf spines) na coluna e na cauda ──
  const plateGeo = new THREE.ConeGeometry(3.4, 7, 4);
  for (let i = 0; i < 7; i++) {
    const p = add(torso, plateGeo, plateM, 0, 4 + i * 4, -7 + i * 1.6);
    p.rotation.x = -0.2;
    p.scale.setScalar(1 - i * 0.06);
  }
  let tnode = tail;
  for (let i = 0; i < 5; i++) {
    tnode = tnode.children.find((c) => c.isGroup) || tnode;
    const p = add(tnode, plateGeo, plateM, 0, 3, -2);
    p.scale.setScalar(0.7 - i * 0.1);
  }

  g.scale.set(1.25, 1.25, 1.25); // GIGANTE
  g.userData = { legs, arms, head, tail, torso };
  return g;
}

/** Spawna o boss à frente do avião, emergindo do chão. */
export function spawnBoss(jetPos, jetForward) {
  if (boss) return boss;
  const fx = jetForward?.x ?? 0;
  const fz = jetForward?.z ?? -1;
  const flen = Math.hypot(fx, fz) || 1;
  const sx = jetPos.x + (fx / flen) * BOSS.SPAWN_AHEAD;
  const sz = jetPos.z + (fz / flen) * BOSS.SPAWN_AHEAD;
  const surf = surfaceInfoAt(sx, sz);
  const groundY = Math.max(surf.height, 0);

  const group = buildKaiju();
  group.position.set(sx, groundY, sz);
  scene.add(group);

  // Proxy de mira/colisão no torso (balas/mísseis usam .position do "mesh")
  const aim = new THREE.Object3D();
  aim.position.set(sx, groundY + BOSS.TORSO_Y, sz);
  scene.add(aim);

  // Entrada em game.targets — herda colisão de bala + homing de míssil de graça.
  const targetEntry = {
    type: 'boss', mesh: aim,
    hp: BOSS.HP, maxHp: BOSS.HP,
    hr2: BOSS.HIT_R * BOSS.HIT_R,
    score: 8000, dead: false,
    onDeath: () => killBoss(),
  };
  game.targets.push(targetEntry);

  boss = {
    group, aim, targetEntry, groundY,
    state: 'RISE', stateT: 0,
    throwT: BOSS.THROW_INTERVAL * 0.6,
    rocks: [],
    facing: 0, walkPhase: 0, dying: false, deadT: 0,
  };
  game.flags.bossActive = true;
  game.flags.bossHp = BOSS.HP; game.flags.bossMaxHp = BOSS.HP;

  // Nascimento dramático: do chão + rugido + tremor
  group.position.y = groundY - 60; // começa enterrado, sobe em RISE
  audio.explosion?.(1.4, group.position.clone());
  game.flags.cameraShake = { intensity: 6, duration: 1.4 };
  return boss;
}

export function bossAlive() {
  return !!boss && !boss.dying;
}

export function getBoss() {
  return boss;
}

/** Tira o rochedo: cria uma pedra gigante na mão e a arremessa em arco no avião. */
function throwRock(jetPos) {
  const hand = boss.group.userData.arms[1].userData.hand; // braço direito
  const hp = new THREE.Vector3();
  hand.getWorldPosition(hp);

  const geo = new THREE.IcosahedronGeometry(7 + Math.random() * 3, 0);
  const rock = new THREE.Mesh(geo, gmat(BOSS.ROCK, { flatShading: true }));
  rock.castShadow = true;
  rock.position.copy(hp);
  scene.add(rock);

  // Mira com lead (prevê posição futura do avião) + arco balístico.
  const dx = jetPos.x - hp.x, dz = jetPos.z - hp.z;
  const horiz = Math.hypot(dx, dz) || 1;
  const t = horiz / BOSS.ROCK_SPD; // tempo de voo estimado
  const vy = (jetPos.y - hp.y) / t + 0.5 * BOSS.ROCK_GRAV * t; // compensa gravidade
  const vel = new THREE.Vector3(
    (dx / horiz) * BOSS.ROCK_SPD,
    vy,
    (dz / horiz) * BOSS.ROCK_SPD,
  );
  boss.rocks.push({ mesh: rock, vel, life: 7, spin: new THREE.Vector3(Math.random(), Math.random(), Math.random()) });
  audio.explosion?.(0.4, hp);
}

function updateRocks(dt, jetPos, onPlayerHit) {
  for (let i = boss.rocks.length - 1; i >= 0; i--) {
    const r = boss.rocks[i];
    r.life -= dt;
    r.vel.y -= BOSS.ROCK_GRAV * dt;
    r.mesh.position.addScaledVector(r.vel, dt);
    r.mesh.rotation.x += r.spin.x * dt * 2;
    r.mesh.rotation.y += r.spin.y * dt * 2;
    spawnMissileSmoke?.(r.mesh.position);

    let done = false;
    // Acerto no avião
    if (game.flags.invincibility <= 0 && game.flags.rollTimer <= 0 &&
        r.mesh.position.distanceToSquared(jetPos) < BOSS.ROCK_HIT_R * BOSS.ROCK_HIT_R) {
      explosion(r.mesh.position.clone(), 1.6, 0xff7030);
      onPlayerHit();
      done = true;
    }
    // Acerto no chão
    const surf = surfaceInfoAt(r.mesh.position.x, r.mesh.position.z);
    if (!done && r.mesh.position.y <= Math.max(surf.height, 0) + 2) {
      explosion(r.mesh.position.clone(), 1.2, 0x9a8a6a);
      spawnShockwave?.(r.mesh.position.clone().setY(Math.max(surf.height, 0)), 16);
      done = true;
    }
    if (done || r.life <= 0) {
      scene.remove(r.mesh);
      boss.rocks.splice(i, 1);
    }
  }
}

/** Loop do boss: emerge, anda em direção ao avião, arremessa pedras, morre. */
export function updateBoss(dt, jetPos, onPlayerHit) {
  if (!boss) return;
  const g = boss.group;
  boss.stateT += dt;

  // Mantém HP espelhado para o HUD
  game.flags.bossHp = Math.max(0, boss.targetEntry.hp);

  // ── Morte ──
  if (boss.dying) {
    boss.deadT += dt;
    g.rotation.z = Math.min(Math.PI / 2, g.rotation.z + dt * 0.7); // tomba
    g.position.y -= dt * 6; // afunda
    if (Math.random() < 0.5) {
      const p = g.position.clone().add(new THREE.Vector3((Math.random() - 0.5) * 40, Math.random() * 50, (Math.random() - 0.5) * 40));
      explosion(p, 1.8, 0xff6020);
    }
    if (boss.deadT > 3.2) clearBoss();
    return;
  }

  // ── Nascimento (sobe do chão) ──
  if (boss.state === 'RISE') {
    g.position.y = boss.groundY - 60 + Math.min(60, (boss.stateT / BOSS.RISE_TIME) * 60);
    g.rotation.y = boss.facing;
    if (boss.stateT >= BOSS.RISE_TIME) {
      g.position.y = boss.groundY;
      boss.state = 'HUNT'; boss.stateT = 0;
      audio.mayday?.();
    }
    return;
  }

  // ── Caça: vira-se e anda em direção ao avião, mantendo-se no chão ──
  const dx = jetPos.x - g.position.x, dz = jetPos.z - g.position.z;
  const dist = Math.hypot(dx, dz);
  boss.facing = Math.atan2(dx, dz);
  g.rotation.y = boss.facing;

  if (dist > 90) {
    const step = Math.min(BOSS.WALK_SPD * dt, dist - 90);
    g.position.x += (dx / dist) * step;
    g.position.z += (dz / dist) * step;
    boss.walkPhase += dt * 3;
  }
  const surf = surfaceInfoAt(g.position.x, g.position.z);
  boss.groundY = Math.max(surf.height, 0);
  g.position.y = boss.groundY + Math.abs(Math.sin(boss.walkPhase)) * 1.5; // passada

  // Anima pernas / cauda
  const ud = g.userData;
  if (ud.legs) {
    ud.legs[0].rotation.x = Math.sin(boss.walkPhase) * 0.4;
    ud.legs[1].rotation.x = -Math.sin(boss.walkPhase) * 0.4;
  }
  if (ud.tail) ud.tail.rotation.y = Math.sin(boss.walkPhase * 0.5) * 0.3;

  // Sincroniza proxy de mira (torso)
  boss.aim.position.set(g.position.x, g.position.y + BOSS.TORSO_Y, g.position.z);

  // ── Arremesso de pedras ──
  const rightArm = ud.arms[1];
  if (boss.state === 'WINDUP') {
    rightArm.rotation.x = -1.6 * (boss.stateT / BOSS.WINDUP); // ergue o braço
    if (boss.stateT >= BOSS.WINDUP) {
      throwRock(jetPos);
      rightArm.rotation.x = 0.8; // chicoteia
      boss.state = 'HUNT'; boss.stateT = 0;
      boss.throwT = BOSS.THROW_INTERVAL;
    }
  } else {
    rightArm.rotation.x += (0 - rightArm.rotation.x) * Math.min(1, dt * 4); // relaxa
    boss.throwT -= dt;
    if (boss.throwT <= 0 && dist < BOSS.THROW_RANGE) {
      boss.state = 'WINDUP'; boss.stateT = 0;
      audio.explosion?.(0.5, g.position.clone());
    }
  }

  updateRocks(dt, jetPos, onPlayerHit);
}

/** Inicia a sequência de morte (chamado por targets.js killTarget no caso 'boss'). */
function killBoss() {
  if (!boss || boss.dying) return;
  boss.dying = true; boss.deadT = 0;
  game.flags.bossActive = false;
  game.score += 8000;
  megaExplosion(boss.aim.position.clone(), 'crash');
  if (boss.aim.parent) scene.remove(boss.aim);
  audio.mayday?.();
}

/** Remove tudo do boss da cena. */
export function clearBoss() {
  if (!boss) return;
  if (boss.group.parent) scene.remove(boss.group);
  if (boss.aim.parent) scene.remove(boss.aim);
  for (const r of boss.rocks) if (r.mesh.parent) scene.remove(r.mesh);
  // tira do registro de alvos se ainda estiver lá
  const idx = game.targets.indexOf(boss.targetEntry);
  if (idx >= 0) game.targets.splice(idx, 1);
  boss = null;
  game.flags.bossActive = false;
  game.flags.bossHp = 0; game.flags.bossMaxHp = 0;
}
