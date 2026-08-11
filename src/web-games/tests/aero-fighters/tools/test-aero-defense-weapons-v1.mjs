// test-aero-defense-weapons-v1.mjs — Validador Node da release
// v0.3.9 (T-W-01..T-W-08).
//
// Prova, sem browser (lógica PURA em src/defense/weapons-v1.js,
// turret-player.js e defense-director.js):
//   T-W-08 (ADENDO playtest-2 — SUBSTITUI T-W-01): mira por fases — amarelo
//     1,5 s (50%) → vermelho 1,5 s (80%) → amarelo 1,5 s (50%), solta no fim
//     do ciclo ou no 5º míssil; quebra de feixe CONGELA o timer na carência
//     AA_LOCK_HOLD; acerto estatístico do roll (50%/80% em N tiros seedados);
//     fila de disparo do X com cap;
//   T-W-02 tiers: X avaria (dano 4 → 3 hits em FIGHTER_HP 8-12, cadência 2/s),
//     B abate (1 hit, 1/2s), estoques ∞;
//   T-W-03 míssil órfão retargeta ao vivo mais próximo no cone à frente;
//   T-W-04 rod a 3× a velocidade do X perfura e encadeia até 3 kills;
//   T-W-05 horda: agenda seedada (1ª em HORDE_FIRST_S, ciclo HORDE_CYCLE_S),
//     janela = DIST/SPEED, chegada = −30% cidade; nuke: estoque 3, raio 150 m,
//     arco balístico com gravidade e ponto de mira no terreno;
//   T-W-06 seleção de arma: scroll cicla mg → X → B → T → R (e volta);
//   T-W-07 nightFactor (chama noturna) — mesma curva do sky.js.
//   + guards de FONTE: weapons-v1 puro; horda NUNCA entra em game.targets
//     (defense-mode não chama registerAsTargets); script registrado no
//     package.json.
//
// Roda com: node --experimental-default-type=module tests/aero-fighters/tools/test-aero-defense-weapons-v1.mjs

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { AA_DEFENSE } from '../../../aero-fighters/src/config.js';
import {
  createTurretPlayer, selectWeapon, cycleWeapon, TURRET_WEAPONS, WEAPON_LABELS,
} from '../../../aero-fighters/src/defense/turret-player.js';
import {
  noteLockShot, stepLockPhase, lockPhase, resetLock, rollLockHit, enqueueAaShot,
  consumeTier, stepTierCooldowns,
  pickRetarget, rodCfg, stepRod, stepNukeArc, stepNukeGuided, groundAimPoint,
  nightFactor,
} from '../../../aero-fighters/src/defense/weapons-v1.js';
import {
  createDefenseDirector, stepHorde, registerHordeArrival, registerHordeKill,
  resetDirector,
} from '../../../aero-fighters/src/defense/defense-director.js';

const SRC = fileURLToPath(new URL('../../../aero-fighters/', import.meta.url));
const read = (rel) => readFileSync(SRC + rel, 'utf8');

/** rng determinístico (mulberry32) — estatística do roll de acerto. */
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const mkTurret = () =>
  createTurretPlayer({ x: -760, y: 100, z: -400, lookAt: { x: -250, y: 6, z: 250 } });

// ─── T-W-08: mira por fases (SUBSTITUI T-W-01) ───────────────────────────────

test('T-W-08: ciclo amarelo 1,5s (50%) → vermelho 1,5s (80%) → amarelo 1,5s (50%) → solta', () => {
  const lock = { idx: -1, phaseT: 0, shotsFired: 0, holdT: 0 };
  const dt = 1 / 120;
  // aquisição: o quadrado aparece AMARELO no 1º frame (sem tracking prévio)
  stepLockPhase(lock, 2, dt);
  assert.equal(lock.idx, 2);
  assert.deepEqual(
    (({ index, color, hitP }) => ({ index, color, hitP }))(lockPhase(lock)),
    { index: 0, color: 'yellow', hitP: AA_DEFENSE.LOCK_HIT_P[0] });
  assert.equal(AA_DEFENSE.LOCK_HIT_P[0], 0.5);
  // 1,5 s: fase VERMELHA (80%)
  for (let i = 0; i < 120 * AA_DEFENSE.LOCK_PHASE_S + 2; i++) stepLockPhase(lock, 2, dt);
  assert.deepEqual(
    (({ index, color, hitP }) => ({ index, color, hitP }))(lockPhase(lock)),
    { index: 1, color: 'red', hitP: AA_DEFENSE.LOCK_HIT_P[1] });
  assert.equal(AA_DEFENSE.LOCK_HIT_P[1], 0.8);
  // 3,0 s: AMARELO de novo (50%)
  for (let i = 0; i < 120 * AA_DEFENSE.LOCK_PHASE_S + 2; i++) stepLockPhase(lock, 2, dt);
  assert.deepEqual(
    (({ index, color, hitP }) => ({ index, color, hitP }))(lockPhase(lock)),
    { index: 2, color: 'yellow', hitP: AA_DEFENSE.LOCK_HIT_P[2] });
  // 4,5 s (ciclo completo): a mira SOLTA — o frame seguinte re-trava do zero
  // (o retículo continua sobre o alvo: release + re-aquisição amarela)
  let total = 1 + 2 * (120 * AA_DEFENSE.LOCK_PHASE_S + 2); // frames desde a aquisição
  let releasedAt = null;
  for (let i = 0; i < 120 * AA_DEFENSE.LOCK_PHASE_S * 2; i++) {
    total++;
    stepLockPhase(lock, 2, dt);
    if (lock.idx === -1) { releasedAt = total * dt; break; }
  }
  assert.ok(releasedAt !== null, 'mira nunca soltou');
  assert.ok(Math.abs(releasedAt - 3 * AA_DEFENSE.LOCK_PHASE_S) < 0.3,
    `soltou fora do ciclo: ${releasedAt.toFixed(2)} s`);
  stepLockPhase(lock, 2, dt);
  assert.equal(lockPhase(lock).index, 0, 're-trava não reiniciou na fase amarela');
});

test('T-W-08: a mira some no 5º míssil lançado no mesmo inimigo', () => {
  const lock = { idx: -1, phaseT: 0, shotsFired: 0, holdT: 0 };
  const dt = 1 / 60;
  stepLockPhase(lock, 1, dt);
  assert.equal(AA_DEFENSE.LOCK_MAX_SHOTS, 5);
  for (let s = 0; s < 4; s++) { noteLockShot(lock); stepLockPhase(lock, 1, dt); }
  assert.ok(lock.idx === 1, 'soltou antes do 5º míssil');
  noteLockShot(lock); // 5º
  stepLockPhase(lock, 1, dt);
  assert.equal(lock.idx, -1, 'não soltou no 5º míssil');
  assert.equal(lock.shotsFired, 0, 'contador não zerou ao soltar');
});

test('T-W-08: quebra de feixe CONGELA a fase na carência; depois reinicia o ciclo', () => {
  const lock = { idx: -1, phaseT: 0, shotsFired: 0, holdT: 0 };
  const dt = 1 / 60;
  // 1 s de fase amarela no alvo 3
  for (let i = 0; i < 60; i++) stepLockPhase(lock, 3, dt);
  const t0 = lock.phaseT;
  assert.ok(t0 > 0.9 && t0 < 1.1);
  // feixe quebra (candidate -1): timer CONGELA por até AA_LOCK_HOLD s
  for (let i = 0; i < Math.floor(60 * (AA_DEFENSE.AA_LOCK_HOLD - 0.5)); i++) stepLockPhase(lock, -1, dt);
  assert.equal(lock.idx, 3, 'carência derrubou a mira');
  assert.ok(Math.abs(lock.phaseT - t0) < 1e-9, 'timer da fase não congelou na carência');
  // feixe volta a tempo: a fase RETOMA de onde parou
  stepLockPhase(lock, 3, dt);
  assert.ok(lock.phaseT > t0, 'fase não retomou após o feixe voltar');
  // nova quebra além da carência: ciclo REINICIA no novo candidato
  for (let i = 0; i < 60 * (AA_DEFENSE.AA_LOCK_HOLD + 0.2); i++) stepLockPhase(lock, -1, dt);
  assert.equal(lock.idx, -1, 'mira não soltou após a carência');
  assert.equal(lock.phaseT, 0);
});

test('T-W-08: acerto estatístico — 50% na amarela, 80% na vermelha (N seedados)', () => {
  const N = 4000;
  const freq = (p, seed) => {
    const rng = mulberry32(seed);
    let hits = 0;
    for (let i = 0; i < N; i++) if (rollLockHit(rng, p)) hits++;
    return hits / N;
  };
  const f50 = freq(0.5, 1234);
  const f80 = freq(0.8, 987);
  assert.ok(f50 > 0.45 && f50 < 0.55, `50% fora: ${(f50 * 100).toFixed(1)}%`);
  assert.ok(f80 > 0.75 && f80 < 0.85, `80% fora: ${(f80 * 100).toFixed(1)}%`);
  // mesma seed → mesma sequência (determinismo)
  assert.equal(freq(0.5, 42), freq(0.5, 42));
});

test('T-W-08: fila de disparo do X respeita o cap (anti input-lag)', () => {
  const t = mkTurret();
  assert.equal(t.fireQueue, 0);
  for (let i = 0; i < AA_DEFENSE.AA_QUEUE_CAP; i++) {
    assert.ok(enqueueAaShot(t), `recusou o ${i + 1}º enfileirado`);
  }
  assert.equal(t.fireQueue, AA_DEFENSE.AA_QUEUE_CAP);
  assert.equal(enqueueAaShot(t), false, 'fila passou do cap');
  assert.equal(t.fireQueue, AA_DEFENSE.AA_QUEUE_CAP);
  // resetLock zera a mira (usado na morte do alvo / restart)
  resetLock(t.lock);
  assert.equal(t.lock.idx, -1);
  assert.equal(t.lock.shotsFired, 0);
});

// ─── T-W-02: tiers de dano e cadência ────────────────────────────────────────

test('T-W-02: X avaria (3 hits no pior HP), B abate em 1, taxas 2/s e 1/2s', () => {
  const [hpMin, hpMax] = AA_DEFENSE.FIGHTER_HP;
  // X: dano 4 → 8 HP cai em 2, 12 HP em 3 — lê como "3 acertos derrubam"
  assert.ok(AA_DEFENSE.AA_X_DAMAGE < hpMin, 'X não pode abater em 1 hit');
  assert.ok(AA_DEFENSE.AA_X_DAMAGE * 2 < hpMax, 'X abate em 2 hits no HP máximo');
  assert.ok(AA_DEFENSE.AA_X_DAMAGE * 3 >= hpMax, 'X precisa de 3 hits no HP máximo');
  // B: overkill garantido em qualquer HP da faixa
  assert.ok(AA_DEFENSE.AA_B_DAMAGE >= hpMax, 'B não abate em 1 hit');
  // cadências: X = 2/s (0.5 s), B = 1 a cada 2 s
  assert.equal(AA_DEFENSE.AA_FIRE_INTERVAL, 0.5);
  assert.equal(AA_DEFENSE.AA_B_INTERVAL, 2.0);
  // estoques infinitos
  assert.equal(AA_DEFENSE.AA_STOCK, Infinity);
  const t = mkTurret();
  assert.equal(t.ammo.aa, Infinity);
  assert.equal(t.nukes, AA_DEFENSE.NUKE_STOCK);
  // consumeTier honra o cooldown por slot, independente entre tiers
  assert.ok(consumeTier(t, 'bCooldown', AA_DEFENSE.AA_B_INTERVAL));
  assert.equal(consumeTier(t, 'bCooldown', AA_DEFENSE.AA_B_INTERVAL), false, 'B repetiu em cooldown');
  assert.ok(consumeTier(t, 'aaCooldown', AA_DEFENSE.AA_FIRE_INTERVAL), 'X bloqueado pelo cooldown do B');
  stepTierCooldowns(t, 1.0);
  assert.equal(consumeTier(t, 'bCooldown', AA_DEFENSE.AA_B_INTERVAL), false, 'B liberou antes de 2 s');
  stepTierCooldowns(t, 1.1);
  assert.ok(consumeTier(t, 'bCooldown', AA_DEFENSE.AA_B_INTERVAL), 'B não liberou após 2 s');
});

// ─── T-W-03: retarget de míssil órfão ────────────────────────────────────────

test('T-W-03: retarget pega o vivo mais próximo no cone à frente; ignora mortos e os de trás', () => {
  const m = { x: 0, y: 200, z: 0, vx: 0, vy: 0, vz: -220 }; // voando para -z
  const near = { x: 5, y: 200, z: -300, dead: false };
  const far = { x: 10, y: 200, z: -600, dead: false };
  const deadT = { x: 1, y: 200, z: -100, dead: true };       // morto: ignorado
  const behind = { x: 2, y: 200, z: 300, dead: false };      // fora do cone (atrás)
  const t = pickRetarget(m, [far, deadT, behind, near]);
  assert.equal(t, near, 'não pegou o vivo mais próximo à frente');
  // sem vivos no cone → null (segue balístico)
  assert.equal(pickRetarget(m, [deadT, behind]), null);
  assert.equal(pickRetarget(m, []), null);
});

// ─── T-W-04: rod perfurante ──────────────────────────────────────────────────

test('T-W-04: rod voa a 3× o míssil fraco e encadeia até 3 kills', () => {
  const rc = rodCfg();
  assert.equal(rc.AA_SPEED, AA_DEFENSE.AA_SPEED * AA_DEFENSE.ROD_SPEED_MULT);
  assert.equal(AA_DEFENSE.ROD_SPEED_MULT, 3);
  assert.equal(AA_DEFENSE.ROD_PIERCE, 3);
  assert.equal(AA_DEFENSE.ROD_INTERVAL, 5.0); // 1 a cada 5 s

  // Cadeia de 4 alvos quase na linha de tiro: o rod deve perfurar 3 e parar.
  const targets = [
    { x: 2, y: 200, z: -320, vx: 0, vy: 0, vz: 0, dead: false },
    { x: -4, y: 200, z: -640, vx: 0, vy: 0, vz: 0, dead: false },
    { x: 5, y: 200, z: -960, vx: 0, vy: 0, vz: 0, dead: false },
    { x: 0, y: 200, z: -1280, vx: 0, vy: 0, vz: 0, dead: false },
  ];
  const rod = {
    x: 0, y: 200, z: 0, vx: 0, vy: 0, vz: -rc.AA_SPEED,
    target: targets[0], life: AA_DEFENSE.ROD_LIFE,
  };
  let kills = 0;
  const dt = 1 / 120;
  for (let step = 0; step < 120 * AA_DEFENSE.ROD_LIFE && kills < 4; step++) {
    const ev = stepRod(rod, dt);
    if (ev === 'hit') {
      rod.target.dead = true; // o caller mata
      kills += 1;
      if (kills >= AA_DEFENSE.ROD_PIERCE) break; // rod gasto após o 3º kill
      rod.target = pickRetarget(rod, targets);
      if (!rod.target) break;
    } else if (ev === 'expired') break;
  }
  assert.equal(kills, AA_DEFENSE.ROD_PIERCE, `rod encadeou ${kills} kills (esperado 3)`);
  assert.ok(targets[3].dead === false, '4º alvo morreu — pierce passou de 3');
});

test('T-W-04: perfuração é swept — passo de frame grande não atravessa sem contar', () => {
  // a 660 m/s um frame de 0.1 s anda 66 m — muito além do raio de acerto;
  // o teste de segmento (prev→new) ainda registra a perfuração.
  const t = { x: 3, y: 200, z: -33, vx: 0, vy: 0, vz: 0, dead: false }; // no meio do passo
  const r = { x: 0, y: 200, z: 0, vx: 0, vy: 0, vz: -660, target: t, life: 8 };
  assert.equal(stepRod(r, 0.1), 'hit', 'passo de 66 m pulou o alvo (túnel)');
});

// ─── T-W-05: horda (boss) + nuke tática ──────────────────────────────────────

test('T-W-05: horda é seedada (1ª em HORDE_FIRST_S, ciclo HORDE_CYCLE_S)', () => {
  const d1 = createDefenseDirector('w1');
  const d2 = createDefenseDirector('w1');
  // antes da janela: nada
  assert.deepEqual(stepHorde(d1, AA_DEFENSE.HORDE_FIRST_S - 1), []);
  // cruzando a janela: evento de spawn com direção de bússola
  const e1 = stepHorde(d1, 1.5);
  assert.equal(e1.length, 1);
  assert.equal(e1[0].type, 'horde-spawn');
  assert.ok(e1[0].dir >= 0 && e1[0].dir <= Math.PI * 2);
  // ciclo: próxima só depois de HORDE_CYCLE_S
  assert.deepEqual(stepHorde(d1, AA_DEFENSE.HORDE_CYCLE_S - 1), []);
  assert.equal(stepHorde(d1, 1.5).length, 1);
  // determinismo: mesma seed → mesmas direções
  const a1 = stepHorde(d2, AA_DEFENSE.HORDE_FIRST_S + 0.5)[0];
  const a2 = stepHorde(createDefenseDirector('w1'), AA_DEFENSE.HORDE_FIRST_S + 0.5)[0];
  assert.equal(a1.dir, a2.dir, 'direção da horda não é seedada');
  // derrota congela a agenda
  const d3 = createDefenseDirector('w1');
  d3.defeated = 'city';
  assert.deepEqual(stepHorde(d3, 9999), []);
  // reset rearma a primeira janela
  resetDirector(d1);
  assert.equal(d1.hordeT, AA_DEFENSE.HORDE_FIRST_S);
});

test('T-W-05: chegada da horda = −30% de cidade; janela de marcha é jogável', () => {
  const d = createDefenseDirector('w1');
  const r = registerHordeArrival(d);
  assert.equal(r.integrity, 100 - AA_DEFENSE.HORDE_CITY_DAMAGE);
  assert.equal(AA_DEFENSE.HORDE_CITY_DAMAGE, 30);
  registerHordeArrival(d); registerHordeArrival(d);
  const r4 = registerHordeArrival(d); // 100 − 30×4 = 0 → derrota
  assert.equal(r4.integrity, 0);
  assert.equal(r4.defeated, 'city');
  // janela de tempo = distância / marcha — entre 60 e 120 s (contagem no HUD)
  const window = AA_DEFENSE.HORDE_DIST / AA_DEFENSE.HORDE_SPEED;
  assert.ok(window >= 60 && window <= 120, `janela fora: ${window.toFixed(0)}s`);
  // score por unidade da horda (nuke varre ~18)
  const s0 = d.score;
  registerHordeKill(d, 18);
  assert.equal(d.score, s0 + 18 * AA_DEFENSE.HORDE_KILL_SCORE);
});

test('T-W-05: nuke — estoque 3 sem recarga, raio 150 m, arco com gravidade', () => {
  assert.equal(AA_DEFENSE.NUKE_STOCK, 3);
  assert.equal(AA_DEFENSE.NUKE_RADIUS, 150);
  const t = mkTurret();
  assert.equal(t.nukes, 3);
  // arco balístico: vy cai com a gravidade, posição integra
  const n = { x: 0, y: 100, z: 0, vx: 60, vy: 70, vz: -60, life: 25 };
  const vy0 = n.vy;
  stepNukeArc(n, 0.5);
  assert.ok(Math.abs(n.vy - (vy0 - AA_DEFENSE.NUKE_GRAVITY * 0.5)) < 1e-9);
  assert.ok(n.x > 0 && n.z < 0 && n.life === 24.5);
  // ponto de mira: raio contra o terreno plano y=0 → cruza no tempo certo
  const aim = groundAimPoint({ x: 0, y: 100, z: 0 }, { x: 0, y: -0.5, z: -0.866 }, () => 0);
  assert.ok(aim.dist > 150 && aim.dist < 250, `mira cruzou o chão em ${aim.dist} m`);
  // mira para o céu: capa no maxDist
  const sky = groundAimPoint({ x: 0, y: 100, z: 0 }, { x: 0, y: 1, z: 0 }, () => 0, 500);
  assert.equal(sky.dist, 500);
  // arco + glide (cruzeiro alto + mergulho terminal): cai sobre a mira a 1.5 km
  const aim2 = { x: 0, y: 0, z: -1500, vx: 0, vy: 0, vz: 0 };
  const nk = {
    x: 0, y: 100, z: 0, vx: 0, vy: AA_DEFENSE.NUKE_ARC_LIFT * AA_DEFENSE.NUKE_SPEED,
    vz: -AA_DEFENSE.NUKE_SPEED, aim: aim2, arcT: AA_DEFENSE.NUKE_ARC_S, life: AA_DEFENSE.NUKE_LIFE,
  };
  const dt2 = 1 / 120;
  let impact = null, maxY = 0;
  for (let s = 0; s < 120 * AA_DEFENSE.NUKE_LIFE && !impact; s++) {
    if (nk.arcT > 0) { nk.arcT -= dt2; stepNukeArc(nk, dt2); }
    else stepNukeGuided(nk, dt2);
    if (nk.y > maxY) maxY = nk.y;
    if (nk.y <= 0) impact = { x: nk.x, z: nk.z };
  }
  assert.ok(impact, 'nuke nunca tocou o chão');
  const miss = Math.hypot(impact.x - aim2.x, impact.z - aim2.z);
  assert.ok(miss < 60, `nuke caiu a ${miss.toFixed(0)} m do ponto de mira`);
  // cruzeiro alto: passa bem acima do terreno no meio do caminho (sem clipping)
  assert.ok(maxY > AA_DEFENSE.NUKE_CRUISE_ALT, `glide não subiu ao cruzeiro (${maxY.toFixed(0)} m)`);
});

// ─── T-W-06: seleção de arma ─────────────────────────────────────────────────

test('T-W-06: scroll cicla mg → X → B → T → R (e volta); labels completos', () => {
  assert.deepEqual(TURRET_WEAPONS, ['mg', 'aa', 'b', 'nuke', 'rod']);
  for (const w of TURRET_WEAPONS) assert.ok(WEAPON_LABELS[w], `sem label para ${w}`);
  const t = mkTurret();
  assert.equal(t.weapon, 'mg');
  const forward = [];
  for (let i = 0; i < 5; i++) forward.push(cycleWeapon(t, 1));
  assert.deepEqual(forward, ['aa', 'b', 'nuke', 'rod', 'mg']);
  const back = [];
  for (let i = 0; i < 5; i++) back.push(cycleWeapon(t, -1));
  assert.deepEqual(back, ['rod', 'nuke', 'b', 'aa', 'mg']);
  // slots diretos válidos; inválido ignorado
  for (const w of TURRET_WEAPONS) assert.equal(selectWeapon(t, w), w);
  assert.equal(selectWeapon(t, 'laser'), 'rod'); // slot inválido ignorado (fica o último)
});

// ─── Guards de FONTE ─────────────────────────────────────────────────────────

test('T-W-07: nightFactor segue a curva do sky.js (1 à noite, 0 de dia)', () => {
  assert.equal(nightFactor(0.03), 1.0, 'madrugada deveria ser noite cheia');
  assert.equal(nightFactor(0.0), 1.0);
  assert.equal(nightFactor(0.5), 0.0, 'meio-dia deveria ser dia cheio');
  assert.equal(nightFactor(0.35), 0.0);
  assert.ok(nightFactor(0.15) > 0 && nightFactor(0.15) < 1, 'amanhecer deveria ser transição');
  assert.equal(nightFactor(0.95), 1.0);
});

test('WEAPONS-V1: weapons-v1 é puro e a horda NUNCA entra em game.targets', () => {
  const w = read('src/defense/weapons-v1.js');
  assert.ok(!/from\s+['"][^'"]*three/i.test(w), 'weapons-v1.js não pode importar three');
  assert.ok(!/document\.|window\./.test(w), 'weapons-v1.js não pode tocar DOM');
  const dm = read('src/defense/defense-mode.js');
  assert.ok(!/registerAsTargets\(/.test(dm),
    'horda NÃO pode entrar em game.targets (entidade local do modo defesa)');
  assert.match(dm, /createFormation/, 'defense-mode deveria reusar createFormation p/ a horda');
  assert.match(dm, /stepLockPhase/, 'T-W-08: stepLockPhase ausente do update');
  assert.match(dm, /enqueueAaShot/, 'T-W-08: fila do X ausente');
  assert.match(dm, /onAction\('heavyMissile'/, 'tecla direta B ausente');
  assert.match(dm, /onAction\('nuclearMissile'/, 'tecla direta T ausente');
  assert.match(dm, /onAction\('rodMissile'/, 'tecla direta R ausente');
});

test('WEAPONS-V1: constantes no AA_DEFENSE e script registrado no package.json', () => {
  const cfg = read('src/config.js');
  for (const k of ['LOCK_PHASE_S', 'LOCK_HIT_P', 'LOCK_MAX_SHOTS', 'LOCK_MISS_OFFSET',
    'AA_QUEUE_CAP', 'AA_X_DAMAGE', 'AA_B_DAMAGE',
    'AA_B_INTERVAL', 'RETARGET_CONE', 'ROD_INTERVAL', 'ROD_SPEED_MULT', 'ROD_PIERCE',
    'HORDE_FIRST_S', 'HORDE_CYCLE_S', 'HORDE_SIZE', 'HORDE_DIST', 'HORDE_CITY_DAMAGE',
    'NUKE_STOCK', 'NUKE_RADIUS']) {
    assert.ok(cfg.includes(k), `constante ${k} ausente do AA_DEFENSE`);
  }
  const pkg = JSON.parse(read('../package.json'));
  assert.ok(pkg.scripts['test:aero:defense-weapons-v1'], 'script test:aero:defense-weapons-v1 ausente');
  assert.ok(pkg.scripts['test:aero:sim'].includes('test-aero-defense-weapons-v1.mjs'),
    'v1 não está na cadeia test:aero:sim');
});
