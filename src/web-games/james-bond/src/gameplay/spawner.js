// Web game package: james-bond.
//
// Motor PURO do spawner de reforço (F3). Não conhece THREE nem a cena — o
// agendamento é feito no relógio de jogo (soma `dt`, nunca `setTimeout`) e a
// escolha de célula opera sobre descrições planas `{x, z, interior,
// edgeDistance, distanceToPlayer, visible}`. Mesmo padrão de
// gameplay/ballistics.js: testável em node.
//
// Modelo: uma missão tem uma GUARNIÇÃO inicial (o roster atual, tile a tile)
// e um teto de vivos simultâneos (`maxAlive`). O spawner só REPÕE — nunca
// eleva a contagem acima do teto, e nunca decide vitória/derrota (isso
// continua 100% em gameplay/mission-rules.js, por objetivo, intocado).

/** Reforços por minuto quando a missão não declara `spawnRate`. */
export const DEFAULT_SPAWN_RATE = 5;
/** Teto de inimigos vivos simultâneos quando a missão não declara `maxAlive`. */
export const DEFAULT_MAX_ALIVE = 16;
/** Folga de slots além do teto — cobre cadáveres ainda não reclamáveis, para
 * o spawner não ficar refém do tempo de assentamento de UM corpo específico. */
export const SPAWN_POOL_MARGIN = 3;
/** Segundos que um cadáver fica no chão antes de poder ser reciclado. */
export const CORPSE_LINGER = 6;
/** Distância mínima (metros) do jogador para uma célula ser candidata a nascimento. */
export const SPAWN_MIN_DISTANCE = 16;

/** Converte "por minuto" em segundos entre disparos; taxa inválida = nunca dispara. */
export function spawnIntervalSeconds(spawnRatePerMinute) {
  const rate = Number(spawnRatePerMinute);
  if (!Number.isFinite(rate) || rate <= 0) return Infinity;
  return 60 / rate;
}

/**
 * Agendador em relógio de jogo. `tick(dt)` soma o passo fixo e diz se um
 * disparo está devido; o chamador decide o que fazer (spawnar ou não) e
 * então `schedule`/`retry` o próximo prazo — o agendador nunca assume que o
 * disparo teve sucesso.
 */
export function createSpawnScheduler(spawnRatePerMinute) {
  let remaining = spawnIntervalSeconds(spawnRatePerMinute);
  return {
    tick(dt) {
      remaining -= dt;
      return remaining <= 0;
    },
    /** Reagenda para o próximo intervalo cheio — usado após um spawn bem-sucedido. */
    schedule(rate) {
      remaining = spawnIntervalSeconds(rate);
    },
    /** Tenta de novo em breve — usado quando o teto de vivos bloqueou o spawn. */
    retry(seconds = 0.5) {
      remaining = seconds;
    },
    get remaining() { return remaining; },
  };
}

/**
 * Pontuação de uma célula candidata: fora de linha de visão pesa mais que
 * tudo (o reforço não pode nascer debaixo do nariz do jogador), depois
 * interior de construção, depois borda do mapa, depois distância pura.
 */
export function scoreSpawnCell(cell) {
  let score = 0;
  if (!cell.visible) score += 100;
  if (cell.interior) score += 20;
  if (Number.isFinite(cell.edgeDistance)) score += Math.max(0, 10 - cell.edgeDistance);
  score += Math.min(30, cell.distanceToPlayer / 4);
  return score;
}

/**
 * Escolhe a célula de nascimento entre candidatas. Primeiro filtra por
 * distância mínima + fora de LOS; se isso esvaziar o conjunto (mapa pequeno
 * demais, jogador cobrindo tudo), cai para todas as candidatas — o spawner
 * nunca trava por falta de opção "perfeita".
 *
 * @param {Array<{x:number,z:number,interior:boolean,edgeDistance:number,
 *   distanceToPlayer:number,visible:boolean}>} candidates
 * @param {() => number} rng em [0,1) — Math.random no jogo, determinístico em teste
 */
export function pickSpawnCell(candidates, rng = Math.random) {
  if (!candidates.length) return null;
  const eligible = candidates.filter((cell) => cell.distanceToPlayer >= SPAWN_MIN_DISTANCE && !cell.visible);
  const pool = eligible.length ? eligible : candidates;
  const scored = pool.map((cell) => ({ cell, score: scoreSpawnCell(cell) }));
  const best = Math.max(...scored.map((entry) => entry.score));
  // Empates dentro de 5 pontos do melhor: variedade de local sem abrir mão
  // da preferência (senão o reforço nasce sempre exatamente no mesmo canto).
  const top = scored.filter((entry) => entry.score >= best - 5);
  const index = Math.min(top.length - 1, Math.floor(rng() * top.length));
  return top[index].cell;
}

/**
 * Bounds de pool para um nível: quantos slots (guarnição inicial + reserva)
 * este spawner precisa para nunca criar um rig além do combinado. Usado só
 * para o nível 'ground' — reforço não nasce no mezanino (ver ai/guards.js).
 */
export function groundPoolSize(initialGroundCount, maxAlive) {
  return Math.max(initialGroundCount, maxAlive) + SPAWN_POOL_MARGIN;
}

/** Valida os campos de spawner de uma missão — usado pelos testes de unidade. */
export function validateSpawnConfig(mission) {
  const errors = [];
  if (!Number.isFinite(mission.spawnRate) || mission.spawnRate <= 0) errors.push('spawnRate deve ser um número positivo');
  if (!Number.isInteger(mission.maxAlive) || mission.maxAlive <= 0) errors.push('maxAlive deve ser um inteiro positivo');
  return errors;
}
