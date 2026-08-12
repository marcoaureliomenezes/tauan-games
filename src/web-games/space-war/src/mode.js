// mode.js — MÁQUINA DE ESTADOS DE VOO (release space-war-three-states-v1).
//
// O jogo tem 3 estados/visões formais (pedido do operador 2026-07-18):
//
//   ORBIT  — ACOPLADO a um SISTEMA PLANETÁRIO (planeta + luas + estações).
//            O sistema planetário tem raio = 1.5 × órbita do satélite mais
//            distante (piso 2.5× raio do planeta). Regime de velocidade
//            ESCALADO AO SISTEMA: cruiseSpeed = raio/45 (Terra ≈ 230 u/s —
//            Terra–Lua ≈ 30s a 100%, ≈ 1:30 a 1/3 do throttle, pedido do
//            operador; corpos ×1.5/×2 GIGANTES no céu). É a "fase" planetária.
//   CRUISE — VIAGEM INTERPLANETÁRIA dentro do sistema estelar (e vazio
//            interestelar em voo livre, com overdrive). Regime clássico de
//            velocidades (SHIP.cruiseSpeed ×boost ×overdrive). NÃO desacelera
//            sozinho: quem não acopla colide a velocidades astronômicas.
//   JOURNEY— VIAGEM INTERESTELAR ([Z] com alvo de outro sistema): a queima
//            trapezoidal de journey.js domina; mode espelha journey.active.
//
// TRANSIÇÕES TRABALHADAS (bordas): cruzamento de borda com HISTERESE (entra a
// 1.0×R_sys, sai a 1.15×R_sys — sem flicker) + blend de ~2.6s dos parâmetros de
// voo (modeBlend 0→1) + banner. A desaceleração CRUISE→ORBIT é GRADUAL: a
// velocidade-alvo do assist interpola do regime cruise ao regime orbital.
//
// Módulo THREE-free (duck-typing em {x,y,z}) → testável em node puro.

import { game } from './state.js';
import { SHIP } from './config.js';

export const MODE = { ORBIT: 'orbit', CRUISE: 'cruise', JOURNEY: 'journey' };

const ENTER = 1.0;          // × raio do sistema planetário: acopla
const EXIT = 1.15;          // × raio: desacopla (histerese)
const TRANSITION_S = 2.6;   // duração do blend de regimes na troca de estado
const ORBIT_CROSS_S = 90;   // s p/ cruzar o sistema a 100% (Terra–Lua ≈ 30s
                            // a 100%, ≈ 1:30 a 1/3 do throttle — pedido do operador)
const ORBIT_MIN_CRUISE = 120;  // u/s — piso do regime orbital (sistemas minúsculos)

// Cruzeiro do regime ORBITAL de um sistema planetário (raio do sistema → u/s).
export function orbitCruiseOf(systemRadius) {
  return Math.max(systemRadius / ORBIT_CROSS_S, ORBIT_MIN_CRUISE);
}

function _dist(a, b) {
  const dx = a.x - b.x, dy = a.y - b.y, dz = a.z - b.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

// ── Registro dos sistemas planetários ────────────────────────────────────────
// Derivado dos corpos VIVOS (pós-scaling do config): cada planeta do solar ou
// de Betelgeuse vira um sistema planetário. Sistemas caóticos/binário/núcleo
// não ganham "fases" neste incremento (escopo do operador: Solar + Betelgeuse).
export function planetaryRadiusOf(planetRadius, moonOrbits) {
  let r = planetRadius * 2.5;
  for (const o of moonOrbits) r = Math.max(r, o * 1.5);
  return r;
}

export function buildPlanetarySystemsFrom(bodies) {
  const systems = [];
  for (const b of bodies) {
    if (b.isMoon || b.isSun || b.binaryPair || b.dynamic || b.ellipse) continue;
    if (b.system !== 'solar' && b.system !== 'betelgeuse') continue;
    // só PLANETAS (a companheira Siwarha — kind 'star' — não é sistema planetário)
    if (!['rock', 'ice', 'gas', 'earth', 'cloud'].includes(b.def.kind)) continue;
    if (!b.moons) continue;
    const radius = planetaryRadiusOf(b.def.radius, b.moons.map((m) => m.orbit));
    systems.push({ key: b.def.key, name: b.def.name, body: b, radius });
  }
  return systems;
}

export function buildPlanetarySystems() {
  game.planetarySystems = buildPlanetarySystemsFrom(game.bodies);
  return game.planetarySystems;
}

// Sistema planetário que CONTÉM a posição (raio de entrada). Sistemas não se
// sobrepõem por construção; se sobrepuser, o MENOR vence (mais local).
export function planetaryAt(pos, systems = game.planetarySystems) {
  let best = null;
  for (const ps of systems || []) {
    if (_dist(pos, ps.body.worldPos) <= ps.radius * ENTER && (!best || ps.radius < best.radius)) best = ps;
  }
  return best;
}

// Sistema planetário mais próximo até `factor` × raio da borda (HUD do CRUISE:
// "Terra a 12k — desacelere para acoplar").
export function nearestPlanetary(pos, factor = 2.2) {
  let best = null, bestD = Infinity;
  for (const ps of game.planetarySystems || []) {
    const d = _dist(pos, ps.body.worldPos) - ps.radius;      // distância à BORDA
    if (d < ps.radius * (factor - 1) && d < bestD) { best = ps; bestD = d; }
  }
  return best ? { system: best, edgeDist: Math.max(0, bestD) } : null;
}

// ── Parâmetros de voo por modo ───────────────────────────────────────────────
// Regime ATUAL (sem blend): ORBIT escala ao sistema; CRUISE/JOURNEY = clássico.
function _regimeParams() {
  if (game.mode === MODE.ORBIT && game.planetary) {
    const cruise = Math.max(game.planetary.radius / ORBIT_CROSS_S, ORBIT_MIN_CRUISE);
    return {
      cruiseSpeed: cruise,
      camX: 0, camY: 5.2, camZ: 18.5,      // câmera mais próxima: corpos GRANDES
    };
  }
  return { cruiseSpeed: SHIP.cruiseSpeed, camX: 0, camY: 6.5, camZ: 24 };
}

function _smooth(t) { return t * t * (3 - 2 * t); }

// Parâmetros EFETIVOS neste frame: interpola do regime anterior (modeFrom) ao
// regime atual durante a transição — é o que torna a troca de estado gradual.
export function modeParams() {
  const cur = _regimeParams();
  if (game.modeBlend >= 1 || !game.modeFrom) return cur;
  const t = _smooth(game.modeBlend);
  const f = game.modeFrom;
  return {
    cruiseSpeed: f.cruiseSpeed + (cur.cruiseSpeed - f.cruiseSpeed) * t,
    camX: f.camX + (cur.camX - f.camX) * t,
    camY: f.camY + (cur.camY - f.camY) * t,
    camZ: f.camZ + (cur.camZ - f.camZ) * t,
  };
}

// ── Freio de ACOPLAMENTO (CRUISE→ORBIT) ──────────────────────────────────────
// "Ao acoplar-se ao sistema planetário entramos em órbita nele. AUTOMATICA e
// GRADUALMENTE somos promovidos ao estado" (operador): durante o blend de
// entrada, a velocidade RELATIVA ao planeta é freada exponencialmente até o
// teto do regime orbital. Função pura (testável em node) — ship.js aplica.
// Escreve a nova velocidade de mundo em `out` ({x,y,z}) e devolve true se freou.
export function couplingBrake(shipVel, bodyVel, relSpeed, cap, dt, out) {
  if (relSpeed <= cap) return false;
  const f = Math.max(cap / relSpeed, 1 - 1.8 * dt);      // ~63%/s de freio exponencial
  const rx = shipVel.x - (bodyVel ? bodyVel.x : 0);
  const ry = shipVel.y - (bodyVel ? bodyVel.y : 0);
  const rz = shipVel.z - (bodyVel ? bodyVel.z : 0);
  out.x = rx * f + (bodyVel ? bodyVel.x : 0);
  out.y = ry * f + (bodyVel ? bodyVel.y : 0);
  out.z = rz * f + (bodyVel ? bodyVel.z : 0);
  return true;
}

// ── A máquina ────────────────────────────────────────────────────────────────
function _set(mode, planetary, hooks, silent = false) {
  if (game.mode === mode && game.planetary === planetary) return;
  game.modeFrom = _regimeParams();         // snapshot do regime que estamos deixando
  game.mode = mode;
  game.planetary = planetary;
  game.modeBlend = 0;
  if (silent || !hooks.toast) return;
  if (mode === MODE.ORBIT && planetary) {
    // regime-ALVO (modeParams ainda está no blend do regime anterior)
    const cruise = Math.max(planetary.radius / ORBIT_CROSS_S, ORBIT_MIN_CRUISE);
    hooks.toast(`◎ SISTEMA PLANETÁRIO: ${planetary.name} — órbita acoplada · cruzeiro reduzido a ${Math.round(cruise)} u/s`, 3200);
  } else if (mode === MODE.CRUISE) {
    hooks.toast('✦ VIAGEM INTERPLANETÁRIA — motores de cruzeiro plenos (não desaceleramos sozinhos!)', 3200);
  }
  // JOURNEY tem o próprio banner de journey.js.
}

export function updateMode(dt, hooks = {}) {
  const s = game.ship;
  if (!s.pos) return;
  if (game.modeBlend < 1) game.modeBlend = Math.min(1, game.modeBlend + dt / TRANSITION_S);

  // JOURNEY espelha a queima interestelar (engatada pelo [Z] de qualquer estado).
  if (game.journey && game.journey.active) { _set(MODE.JOURNEY, null, hooks, true); return; }

  // Boot: primeiro resolve é SILENCIOSO (a nave nasce acoplada à Terra).
  if (!game._modeInit) {
    game._modeInit = true;
    const here = planetaryAt(s.pos);
    game.mode = here ? MODE.ORBIT : MODE.CRUISE;
    game.planetary = here;
    game.modeBlend = 1;
    return;
  }

  const cur = game.planetary;
  let next = null;
  if (cur && _dist(s.pos, cur.body.worldPos) <= cur.radius * EXIT) next = cur;  // histerese
  if (!next) {
    const here = planetaryAt(s.pos);
    if (here && here !== cur) next = here;                                      // trocou de sistema
  }
  if (next) _set(MODE.ORBIT, next, hooks);
  else _set(MODE.CRUISE, null, hooks);
}
