// weapons.js — Laser do jogador, nukes e projéteis inimigos.

import * as THREE from '../../vendor/three.module.min.js';
import { scene } from './scene.js';
import { game } from './state.js';
import { COLORS } from './config.js';
import { shipForward } from './ship.js';
import { computeGravity, surfaceContact } from './gravity.js';
import { explosion, nukeBlast, nukeMushroom, vacuumDoubleFlash } from './fx.js';

const _f = new THREE.Vector3();
const _p = new THREE.Vector3();
const _gPull = new THREE.Vector3();
const _nR = new THREE.Vector3();
const _nH = new THREE.Vector3();
const _nT = new THREE.Vector3();
const _nV = new THREE.Vector3();
let cooldown = 0;

function boltMesh(color, len = 48) {
  const m = new THREE.Mesh(
    new THREE.CylinderGeometry(1.6, 1.6, len, 6),
    new THREE.MeshBasicMaterial({ color }),
  );
  m.rotation.x = Math.PI / 2;
  return m;
}

export function fireLaser(dt) {
  cooldown -= dt;
  if (cooldown > 0) return;
  cooldown = 0.12;
  const s = game.ship;
  shipForward(_f);
  const m = boltMesh(COLORS.playerLaser);
  m.position.copy(s.pos).addScaledVector(_f, 40);
  m.quaternion.copy(s.quat);
  scene.add(m);
  game.projectiles.push({ mesh: m, vel: _f.clone().multiplyScalar(2400).add(s.vel), life: 2.5, friendly: true, dmg: 34, isNuke: false });
}

export function launchNuke() {
  const s = game.ship;
  if (s.nukes <= 0 || s.landed) return false;
  s.nukes--;
  // Solução balística fresca (C): lança na DIREÇÃO DE TIRO — a nuke `aimed`
  // segue GRAVIDADE PURA (sem a guiagem de espiral) e o arco leva ao alvo.
  const sol = game.nav.solution;
  const aimed = !!(sol && sol.ok && game.time - sol.at < 1.2);
  if (aimed) _f.set(sol.dir.x, sol.dir.y, sol.dir.z);
  else shipForward(_f);
  const m = new THREE.Mesh(new THREE.SphereGeometry(12, 12, 12),
    new THREE.MeshBasicMaterial({ color: COLORS.nuke }));
  m.position.copy(s.pos).addScaledVector(_f, 40);
  scene.add(m);
  // life LONGA: a nuke agora é um corpo BALÍSTICO sob gravidade — dá para
  // lançá-la em órbita e vê-la dar voltas antes de cair (operador 2026-07-02).
  game.projectiles.push({ mesh: m, vel: _f.clone().multiplyScalar(1600).add(s.vel), life: 90, friendly: true, dmg: 0, isNuke: true, armed: 0.4, aimed });
  return true;
}

export function enemyFire(pos, dir) {
  const m = boltMesh(COLORS.enemyLaser);
  m.position.copy(pos);
  scene.add(m);
  game.projectiles.push({ mesh: m, vel: dir.clone().multiplyScalar(1500), life: 3, friendly: false, dmg: 6, isNuke: false });
}

// BOMBA inimiga (campanha): ordnance pesada BALÍSTICA — o mesmo campo gravitacional
// da nave/nukes a puxa (computeGravity), SEM guiagem orbital (D-4/D-5). Detona por
// proximidade do jogador ou contato de superfície, com dano em área.
export function enemyBomb(pos, vel) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(9, 10, 10),
    new THREE.MeshBasicMaterial({ color: 0xff7744 }));
  m.position.copy(pos);
  scene.add(m);
  game.projectiles.push({ mesh: m, vel: vel.clone(), life: 30, friendly: false, dmg: 22, isNuke: false, isBomb: true });
}

// Recarga de nukes (D-7): reserva máxima 4, +1 a cada 20 s — efetivamente ilimitadas
// sem tirar o custo tático do disparo (o decremento imediato é preservado).
export const NUKE_MAX = 4;
export const NUKE_REGEN_S = 20;
export function updateNukeRegen(dt) {
  const s = game.ship;
  if (s.nukes >= NUKE_MAX) { s.nukeRegen = 0; return; }
  s.nukeRegen += dt;
  if (s.nukeRegen >= NUKE_REGEN_S) {
    s.nukeRegen = 0;
    s.nukes++;
  }
}

export function updateProjectiles(dt) {
  updateNukeRegen(dt);
  const arr = game.projectiles;
  for (let i = arr.length - 1; i >= 0; i--) {
    const p = arr[i];
    p.life -= dt;
    // BOMBA inimiga: gravidade pura (sem a guiagem orbital das nukes do jogador).
    if (p.isBomb) {
      computeGravity(p.mesh.position, _gPull);
      p.vel.addScaledVector(_gPull, dt);
      if (surfaceContact(p.mesh.position, 6)) p.surfaceHit = true;
    }
    // NUKE SOB GRAVIDADE (operador 2026-07-02): a nuke é um corpo balístico —
    // o MESMO campo da nave (dominante + marés de todo corpo próximo) a puxa:
    // ela orbita, faz estilingue, e cai em ESPIRAL no disco de acreção.
    if (p.isNuke) {
      const g = computeGravity(p.mesh.position, _gPull);
      p.vel.addScaledVector(_gPull, dt);
      // ÓRBITA + ESPIRAL DA MORTE (pedido explícito): a nuke tem guiagem de
      // inserção orbital — dentro do domínio de um corpo a velocidade é puxada
      // p/ fluxo kepleriano SUB-circular com leve deriva p/ dentro. Resultado:
      // captura em órbita visível → apoápside decai volta a volta → impacto.
      //  · planeta/lua: captura suave dentro do SOI (a 1600 u/s ela jamais
      //    orbitaria sozinha — v_circ local ~140; a guiagem entrega a fantasia)
      //  · BN/pulsar: arrasto FORTE do disco de acreção/vento (como a nave)
      //  · estrela: perto dela (r < 6R) espirala ACELERANDO p/ dentro (física:
      //    espiral de decaimento ganha velocidade) até queimar na superfície
      // Nuke `aimed` (solução de tiro): GRAVIDADE PURA — o arco previsto é a
      // trajetória real; a guiagem de espiral fica só para o tiro livre.
      const dom = g.dominant;
      if (dom && !p.aimed) {
        const kind = dom.def.kind;
        const compact = kind === 'blackhole' || kind === 'neutron';
        const dk = compact ? dom.def.disk : null;
        const inDisk = dk && g.dist < dk.outer * 1.3;
        const isStar = dom.isSun || kind === 'star' || kind === 'redsupergiant';
        const nearStar = isStar && g.dist < dom.def.radius * 6;
        const capture = !compact && !isStar && g.dist < (dom.soi || 0);
        if (inDisk || capture || nearStar) {
          _nR.copy(p.mesh.position).sub(dom.worldPos);
          _nV.copy(p.vel);
          if (dom.worldVel) _nV.sub(dom.worldVel);          // frame co-móvel do corpo
          _nH.crossVectors(_nR, _nV);
          _nT.crossVectors(_nH, _nR).normalize();           // direção prograde
          // Piso de velocidade orbital de GAMEPLAY: v_circ real num planeta é
          // ~70-140 u/s (período de 20+ min — espiral invisível). A guiagem usa
          // max(vK, 320): loops de ~1 min com afundamento visível volta a volta.
          // (inw 0.30/rate 0.5: acima do v_circ real a centrífuga excedente
          //  empurra p/ FORA ~rate⁻¹·(v²/r−g) — a deriva p/ dentro tem que
          //  vencer isso, senão a nuke paira em vez de espiralar. Medido.)
          const vK = Math.max(Math.sqrt(dom.mu / Math.max(g.dist, 1)), inDisk ? 0 : 320);
          const sub = inDisk ? 0.93 : 0.92;
          const inw = inDisk ? 0.06 : 0.30;
          const rate = inDisk ? 0.45 : 0.5;
          _nR.normalize();
          _nT.multiplyScalar(vK * sub).addScaledVector(_nR, -vK * inw);
          _nV.lerp(_nT, Math.min(1, rate * dt));
          p.vel.copy(_nV);
          if (dom.worldVel) p.vel.add(dom.worldVel);
        }
      }
      // horizonte/superfície engole a nuke → detona no impacto
      const hit = surfaceContact(p.mesh.position, 6);
      if (hit) p.surfaceHit = true;
    }
    p.mesh.position.addScaledVector(p.vel, dt);
    if (p.isNuke && p.armed > 0) p.armed -= dt;

    let detonate = !!p.surfaceHit, hitPos = p.mesh.position;

    if (p.friendly) {
      // vs inimigos
      for (const e of game.enemies) {
        if (e.dead) continue;
        const d = e.group.position.distanceTo(p.mesh.position);
        if (d < (p.isNuke ? 2200 : e.radius + 40)) {
          if (p.isNuke) { detonate = true; }
          else { e.hp -= p.dmg; explosion(p.mesh.position, 0.5, 0xffcc44); detonate = true; }
          if (e.hp <= 0 && !e.dead) killEnemy(e);
          break;
        }
      }
      // nuke vs alvos de missão (bases) + proximidade de superfície
      if (p.isNuke && p.armed <= 0 && !detonate) {
        if (game.mission) for (const t of game.mission.targets) {
          if (t.destroyed) continue;
          if (t.obj.position.distanceTo(p.mesh.position) < 1800) { detonate = true; break; }
        }
      }
    } else if (p.isBomb) {
      // bomba: espoleta de proximidade contra o jogador (ou contato de superfície)
      if (p.surfaceHit || p.mesh.position.distanceTo(game.ship.pos) < 140) detonate = true;
      if (detonate) {
        const d = p.mesh.position.distanceTo(game.ship.pos);
        const protectedNow = game.ship.landed || game.ship.spawnGrace > 0;
        if (!protectedNow && d < 400) game.ship.hp -= p.dmg * (1 - d / 400);
        explosion(p.mesh.position, 1.6, 0xff7744);
      }
    } else {
      // inimigo vs jogador (sem dano enquanto pousado ou na proteção inicial)
      if (p.mesh.position.distanceTo(game.ship.pos) < 40) {
        const protectedNow = game.ship.landed || game.ship.spawnGrace > 0;
        if (!protectedNow) game.ship.hp -= p.dmg;
        explosion(p.mesh.position, 0.3, protectedNow ? 0x66ccff : 0xff5544);
        detonate = true;
      }
    }

    if (p.isNuke && detonate) {
      // Explosão realista (operador 2026-07-03): impacto em SUPERFÍCIE → cogumelo
      // orientado pela normal do corpo; detonação no VÁCUO → casca + duplo flash.
      const surf = surfaceContact(p.mesh.position, 40);
      if (surf) {
        _nR.copy(p.mesh.position).sub(surf.body.worldPos).normalize();
        nukeMushroom(p.mesh.position, _nR, Math.min(2.2, Math.max(0.7, surf.body.def.radius / 900)));
      } else {
        vacuumDoubleFlash();
      }
      nukeBlast(p.mesh.position);
      // dano em área: inimigos
      for (const e of game.enemies) {
        if (!e.dead && e.group.position.distanceTo(hitPos) < 2500) killEnemy(e);
      }
      // destrói bases de missão
      if (game.mission) for (const t of game.mission.targets) {
        if (!t.destroyed && t.obj.position.distanceTo(hitPos) < 2500) destroyTarget(t);
      }
    }

    if (detonate || p.life <= 0) { scene.remove(p.mesh); p.mesh.material.dispose(); arr.splice(i, 1); }
  }
}

function killEnemy(e) {
  e.dead = true; e.hp = 0;
  explosion(e.group.position, 1.4, 0xff8833);
  scene.remove(e.group);
  game.kills++; game.score += 150;
}

function destroyTarget(t) {
  t.destroyed = true;
  explosion(t.obj.position, 2.2, 0x66ff66);
  if (t.obj.parent) t.obj.parent.remove(t.obj);
  game.score += 500;
}
