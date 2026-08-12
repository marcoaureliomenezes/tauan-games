// test-sw-journey-unit.js — Invariante de imunidade da queima interestelar +
// varredura do perfil trapezoidal. Roda em node puro:
//   node --experimental-default-type=module tests/space-war/tools/test-sw-journey-unit.js
//
// journey.js NÃO importa limpo em Node: importa nav.js, que importa
// `{ camera } from './scene.js'` — e scene.js tem WebGLRenderer/câmera em
// escopo de módulo (o mesmo bloqueador documentado no anexo de demoção §3).
// journey.js é só uma FACHADA sobre a lei pura (celestial/physics.js —
// journeyProfileTrapezoid, já importada e testada em test-physics-unit.js);
// a única coisa que journey.js adiciona por cima é o campo `immune: true`,
// hardcoded, nunca computado. Não dá pra executar journeyToggle() em Node, mas
// dá pra provar que a fonte real do jogo carrega esse invariante literal — o
// mesmo padrão de drift-guard por leitura de fonte que test-aero-unit.js usa
// para a atribuição DEM (AC-09).
//
// T-02 (demotion-map anexo §3): rebaixa journey-experience.spec.js AC-05
// ("sem colisão durante a viagem — queima nunca aborta no corredor").

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { journeyProfileTrapezoid } from '../../../space-war/src/celestial/physics.js';

test('invariante de imunidade: journey.js grava journey.immune = true na queima (drift guard de fonte)', () => {
  const src = readFileSync(
    fileURLToPath(new URL('../../../space-war/src/journey.js', import.meta.url)),
    'utf8',
  );
  // journeyToggle() monta o objeto `game.journey` com `immune: true` — nunca
  // condicional (reverte o abort-por-impacto do rc-1 por ordem do operador,
  // AC-05 da jexp). Se alguém remover/condicionar essa linha, este teste falha.
  assert.match(src, /immune:\s*true,?\s*\/\/\s*sem colisão durante a queima/,
    'journey.js precisa continuar gravando immune:true incondicionalmente em journeyToggle()');
});

test('perfil trapezoidal: a queima inteira produz um estado VÁLIDO em todo o corredor (sem lacuna)', () => {
  // Mesma escala do bug space-war-interstellar-experience-flat (D grande,
  // T típico de uma viagem): sweep fino de s∈(0,1) — em NENHUM ponto a fase
  // fica indefinida ou a velocidade sai de [0, vMax] — é essa continuidade
  // física que sustenta a imunidade (não existe "buraco" no meio do voo onde
  // uma colisão faria sentido interromper o autopilot).
  const D = 20_000_000, T = 300;
  const vMax = D / (0.7 * T);
  const samples = [0.02, 0.1, 0.15, 0.3, 0.5, 0.7, 0.85, 0.9, 0.97, 0.999];
  let lastX = -1;
  for (const sNorm of samples) {
    const t = sNorm * T;
    const p = journeyProfileTrapezoid(D, T, t);
    assert.ok(['accel', 'coast', 'decel'].includes(p.phase), `fase inválida em s=${sNorm}: ${p.phase}`);
    assert.ok(Number.isFinite(p.v) && p.v >= -1e-6, `velocidade não-finita/negativa em s=${sNorm}: ${p.v}`);
    assert.ok(p.v <= vMax * 1.001, `velocidade ${p.v} excede vMax ${vMax} em s=${sNorm}`);
    assert.ok(Number.isFinite(p.x) && p.x >= lastX - 1e-6, `posição não-monótona em s=${sNorm}`);
    lastX = p.x;
  }
  // ativa (v>0) em todo o interior do corredor — a queima nunca "para" sozinha
  // antes da chegada, reforçando que não há janela de vulnerabilidade a cobrir.
  for (const sNorm of [0.1, 0.5, 0.9]) {
    const p = journeyProfileTrapezoid(D, T, sNorm * T);
    assert.ok(p.v > 0, `queima devia seguir ativa (v>0) em s=${sNorm}`);
  }
});
