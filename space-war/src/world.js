// world.js — Gestor de FASES do mundo (audit T-PR-06).
//
// O universo é um anel de DESCRITORES (config.SYSTEMS); só um sistema existe
// materializado por vez, na origem da cena. Este módulo decide, POR POSIÇÃO:
//   · carregado + |pos| > 1.7·raio  → descarrega (entra o vazio interestelar)
//   · vazio + galáctico < 1.5·raio de um sistema → rebaseia a origem no centro
//     dele e carrega (histerese 1.5/1.7 evita flapping na fronteira)
//   · vazio + |pos| > 1M → REBASE incremental: origin += pos; pos → 0. É o
//     "floating origin" que mata o jitter float32 da era mundo-único (nave de
//     2 u a 27M u quantizava em degraus de 2 u na GPU).
// A journey não carrega nada — só voa o corredor; quem troca a fase é este
// módulo. Um deslocamento (shift) da cena é propagado aos módulos que guardam
// coordenadas de cena via hooks registrados (nave/câmera, partículas, projéteis).

import * as THREE from '../../vendor/three.module.min.js';
import { SYSTEMS } from './config.js';
import { game } from './state.js';
import { loadSystem, unloadSystem, systemEntry } from './celestial/system.js';

const LOAD_F = 1.5;
const UNLOAD_F = 1.7;
const REBASE_LIMIT = 1_000_000;   // float32 a 1M: passo 0.125 u — invisível

const _g = new THREE.Vector3();
const _c = new THREE.Vector3();
const _shift = new THREE.Vector3();

const _shiftHooks = [];
// Registra um hook (shiftVector) → chamado quando a cena é rebaseada.
export function onWorldShift(fn) { _shiftHooks.push(fn); }

function applyShift(shift) {
  for (const fn of _shiftHooks) fn(shift);
}

// Posição galáctica da nave (origin + pos de cena).
export function galacticShipPos(out) {
  return out.copy(game.ship.pos).add(game.world.origin);
}

export function updateWorldPhase() {
  const w = game.world;
  const s = game.ship;
  if (!w.origin || !s.pos) return;

  if (w.systemKey) {
    const sys = systemEntry(w.systemKey);
    if (s.pos.length() <= sys.radius * UNLOAD_F) return;   // dentro: nada a fazer
    unloadSystem();                                        // saiu: vira vazio
  }

  // VAZIO: chegou perto de algum sistema? (6 descritores — barato)
  _g.copy(s.pos).add(w.origin);
  for (const sys of SYSTEMS) {
    _c.set(...sys.center);
    if (_g.distanceTo(_c) < sys.radius * LOAD_F) {
      // rebase da cena p/ o centro do sistema: cena_nova = cena_velha + (origin_velha − centro)
      _shift.copy(w.origin).sub(_c);
      if (_shift.lengthSq() > 0) applyShift(_shift);
      loadSystem(sys.key);                                 // seta origin = centro
      return;
    }
  }

  // rebase incremental do vazio (mantém a nave/câmera perto da origem)
  if (s.pos.length() > REBASE_LIMIT) {
    w.origin.add(s.pos);
    _shift.copy(s.pos).negate();
    applyShift(_shift);
  }
}
