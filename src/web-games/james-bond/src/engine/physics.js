// Web game package: james-bond.
// Colisão AABB determinística com suporte a múltiplos andares.
//
// Convenção de altura: `player.y` é a altura dos PÉS + 1. A câmera é montada em
// `player.y + eyeHeight - 1`. O mundo térreo é a plataforma de topo 0, então um
// jogador no chão tem y = 1 (era o antigo `Math.max(1, ...)` fixo).
//
// Três tipos de volume:
//   box       — parede/obstáculo sólido, bloqueia movimento horizontal
//   platform  — superfície pisável (laje de andar, degrau, passarela)
//   ladder    — volume de gatilho: dentro dele o jogador sobe/desce livremente
import { CONFIG } from '../config.js';

const PLAYER_RADIUS = 0.34;
const PLAYER_HALF_HEIGHT = 0.92;
// Altura máxima de degrau que o jogador sobe sem pular. Acima disso a laje
// vira obstáculo e é preciso rampa/escada/ladder.
const STEP_UP = 0.62;

// PERF: broadphase em grade uniforme, na mesma célula do mundo que o resto do
// jogo já usa (`world.toCell`, CONFIG.cellSize). Toda consulta era uma
// varredura linear de TODOS os volumes (~300 num mapa cheio: calçada por
// célula, degraus de escada, parapeitos, paredes mescladas, colisores de
// props destrutíveis); `stepProjectile` chega a fazer 5 dessas por passo.
// Nenhuma volume tem margem maior que ~1.8 m acima da física real (raio do
// jogador 0.34 m, raio de projétil <=0.14 m) — bem menor que meia célula
// (CONFIG.cellSize/2 = 1.8 m) — então a vizinhança 3x3 ao redor da célula do
// ponto consultado sempre contém todo volume capaz de tocá-lo. Resultado é
// IDÊNTICO à varredura linear, só que O(vizinhança) em vez de O(total).
const GRID_CELL = CONFIG.cellSize;

function cellIndex(coord) {
  return Math.floor(coord / GRID_CELL);
}

function cellKey(cx, cz) {
  return `${cx},${cz}`;
}

/** Índice espacial genérico: guarda volumes com `{x,z,hx,hz}` num Map de baldes. */
function createSpatialIndex() {
  let cells = new Map();

  function reset() {
    cells = new Map();
  }

  function insert(volume) {
    const minCx = cellIndex(volume.x - volume.hx);
    const maxCx = cellIndex(volume.x + volume.hx);
    const minCz = cellIndex(volume.z - volume.hz);
    const maxCz = cellIndex(volume.z + volume.hz);
    const keys = [];
    for (let cx = minCx; cx <= maxCx; cx += 1) {
      for (let cz = minCz; cz <= maxCz; cz += 1) {
        const key = cellKey(cx, cz);
        let bucket = cells.get(key);
        if (!bucket) { bucket = new Set(); cells.set(key, bucket); }
        bucket.add(volume);
        keys.push(key);
      }
    }
    volume.__cellKeys = keys;
  }

  function remove(volume) {
    if (!volume.__cellKeys) return;
    for (const key of volume.__cellKeys) {
      const bucket = cells.get(key);
      if (!bucket) continue;
      bucket.delete(volume);
      if (bucket.size === 0) cells.delete(key);
    }
    volume.__cellKeys = null;
  }

  /** Todo volume cuja célula está na vizinhança 3x3 de (x, z) — sem duplicatas. */
  function query(x, z) {
    const cx = cellIndex(x);
    const cz = cellIndex(z);
    const found = new Set();
    for (let dx = -1; dx <= 1; dx += 1) {
      for (let dz = -1; dz <= 1; dz += 1) {
        const bucket = cells.get(cellKey(cx + dx, cz + dz));
        if (!bucket) continue;
        for (const volume of bucket) found.add(volume);
      }
    }
    return found;
  }

  return { reset, insert, remove, query };
}

export async function createPhysics() {
  let boxes = [];
  let platforms = [];
  let ladders = [];
  let player = { x: 0, y: 1, z: 0 };
  let playerReady = false;
  const boxIndex = createSpatialIndex();
  const platformIndex = createSpatialIndex();

  function reset() {
    boxes = [];
    platforms = [];
    ladders = [];
    boxIndex.reset();
    platformIndex.reset();
    playerReady = false;
  }

  function addBox(x, y, z, hx, hy, hz) {
    const box = { x, y, z, hx, hy, hz };
    boxes.push(box);
    boxIndex.insert(box);
    return box;
  }

  /**
   * Remove um volume sólido. É o que permite destruir cenário: quando o barril
   * explode ou o engradado se despedaça, o obstáculo tem de sumir da física
   * junto com o desenho — senão sobra uma parede invisível onde não há mais nada.
   */
  function removeBox(box) {
    const index = boxes.indexOf(box);
    if (index >= 0) { boxes.splice(index, 1); boxIndex.remove(box); }
    return index >= 0;
  }

  /**
   * Superfície pisável cujo topo fica em `topY` e cuja base fica em `baseY`.
   *
   * `baseY` é o que separa uma LAJE FLUTUANTE (mezanino: base alta, dá para
   * andar por baixo) de um MACIÇO (degrau de escada: base no chão, não se
   * atravessa por baixo nem por dentro). Sem esse dado a física tratava toda
   * plataforma muito acima dos pés como "teto" e liberava a passagem — era por
   * aí que o jogador entrava DENTRO da escadaria e ficava preso.
   * O padrão (`baseY = topY`) descreve uma superfície fina, sem volume.
   */
  function addPlatform(x, z, hx, hz, topY, baseY = topY) {
    const platform = { x, z, hx, hz, topY, baseY };
    platforms.push(platform);
    platformIndex.insert(platform);
    return platform;
  }

  /** Volume de escada: dentro dele o jogador ignora gravidade e sobe/desce. */
  function addLadder(x, z, hx, hz, baseY, topY) {
    const ladder = { x, z, hx, hz, baseY, topY };
    ladders.push(ladder);
    return ladder;
  }

  function createPlayer(position) {
    player = { x: position.x, y: position.y, z: position.z };
    playerReady = true;
  }

  function insideColumn(volume, x, z) {
    return Math.abs(x - volume.x) < volume.hx + PLAYER_RADIUS
      && Math.abs(z - volume.z) < volume.hz + PLAYER_RADIUS;
  }

  /**
   * Altura de apoio sob os pés em (x, z): o topo mais alto que o jogador
   * consegue pisar. Lajes acima de `feetY + STEP_UP` são teto, não chão, e
   * portanto ignoradas — senão o jogador "gruda" no andar de cima ao passar
   * por baixo dele.
   *
   * Topos de caixa (paredes, obstáculos) também sustentam: toda estrutura
   * sólida visível é pisável. Sem isto, cair sobre uma parede atravessava o
   * volume dela até o térreo e deixava o jogador preso DENTRO da parede.
   */
  function supportHeight(x, z, feetY) {
    let best = 0;
    for (const platform of platformIndex.query(x, z)) {
      if (platform.topY > feetY + STEP_UP) continue;
      if (platform.topY <= best) continue;
      if (insideColumn(platform, x, z)) best = platform.topY;
    }
    for (const box of boxIndex.query(x, z)) {
      const topY = box.y + box.hy;
      if (topY > feetY + STEP_UP) continue;
      if (topY <= best) continue;
      if (insideColumn(box, x, z)) best = topY;
    }
    return best;
  }

  /** True quando (x, z, feetY) está dentro de um volume de escada. */
  function onLadder(x, z, feetY) {
    return ladders.some((ladder) => feetY >= ladder.baseY - 0.6 && feetY <= ladder.topY + 0.4
      && insideColumn(ladder, x, z));
  }

  function movePlayer(desired) {
    if (!playerReady) return desired;
    const feetNow = player.y - 1;
    const floorY = supportHeight(player.x, player.z, feetNow);
    const nextY = Math.max(floorY + 1, player.y + desired.y);
    const nextX = player.x + desired.x;
    if (!collides(nextX, nextY, player.z)) player.x = nextX;
    const nextZ = player.z + desired.z;
    if (!collides(player.x, nextY, nextZ)) player.z = nextZ;
    player.y = nextY;
    return desired;
  }

  function collides(x, y, z) {
    const feet = y - 1;
    // Plataformas também são obstáculo lateral. Duas — e só duas — saídas:
    //   1. dá para SUBIR nela (topo dentro do passo automático);
    //   2. dá para passar POR BAIXO (base acima da cabeça).
    // Fora isso é parede. A regra antiga liberava qualquer plataforma "muito
    // acima dos pés", o que abria os degraus altos da escadaria e permitia
    // entrar dentro dela.
    for (const platform of platformIndex.query(x, z)) {
      if (platform.topY <= feet + STEP_UP) continue;
      if (platform.baseY >= feet + PLAYER_HALF_HEIGHT * 2) continue;
      if (insideColumn(platform, x, z)) return true;
    }
    for (const box of boxIndex.query(x, z)) {
      const vertical = y - PLAYER_HALF_HEIGHT < box.y + box.hy && y + PLAYER_HALF_HEIGHT > box.y - box.hy;
      if (vertical && Math.abs(x - box.x) < box.hx + PLAYER_RADIUS && Math.abs(z - box.z) < box.hz + PLAYER_RADIUS) return true;
    }
    return false;
  }

  /**
   * "Há sólido no ponto (x, y, z)?" — consulta de VOLUME, com altura real.
   *
   * É o que faltava aos projéteis: eles testavam a célula do grid em 2D
   * (`world.walkable`), então uma parede de 3.15 m bloqueava uma granada
   * passando a 5 m de altura (a "parede invisível" ao arremessar do mezanino)
   * e a laje do segundo andar — que não é célula de parede — não os segurava
   * (a granada atravessava o piso e caía no térreo).
   *
   * `radius` infla o volume pelo raio do projétil.
   */
  // No eixo vertical o teste usa o CENTRO do projétil, sem inflar pelo raio, e
  // é meio-aberto no topo (`y >= topo` já está fora). Sem isso um objeto
  // pousado sobre a superfície — que `surfaceBelow` acabou de apoiar ali — seria
  // relatado como "dentro do sólido" e ficaria quicando para sempre.
  function solidAt(x, y, z, radius = 0) {
    for (const box of boxIndex.query(x, z)) {
      if (y >= box.y + box.hy || y <= box.y - box.hy) continue;
      if (Math.abs(x - box.x) < box.hx + radius && Math.abs(z - box.z) < box.hz + radius) return true;
    }
    for (const platform of platformIndex.query(x, z)) {
      // Plataforma sem volume declarado (baseY === topY) é superfície fina: não
      // ocupa espaço, só sustenta — quem trata disso é `surfaceBelow`.
      if (platform.baseY >= platform.topY) continue;
      if (y >= platform.topY || y <= platform.baseY) continue;
      if (Math.abs(x - platform.x) < platform.hx + radius && Math.abs(z - platform.z) < platform.hz + radius) return true;
    }
    return false;
  }

  /**
   * Topo pisável mais alto em (x, z) que esteja em `fromY` ou abaixo — o chão
   * sobre o qual um objeto em queda vindo de `fromY` vai parar. Diferente de
   * `supportHeight`, que é do JOGADOR (limitada pelo passo automático): aqui
   * qualquer superfície segura, inclusive a laje do mezanino.
   */
  function surfaceBelow(x, z, fromY) {
    let best = -Infinity;
    for (const platform of platformIndex.query(x, z)) {
      if (platform.topY > fromY || platform.topY <= best) continue;
      if (Math.abs(x - platform.x) <= platform.hx && Math.abs(z - platform.z) <= platform.hz) best = platform.topY;
    }
    for (const box of boxIndex.query(x, z)) {
      const topY = box.y + box.hy;
      if (topY > fromY || topY <= best) continue;
      if (Math.abs(x - box.x) <= box.hx && Math.abs(z - box.z) <= box.hz) best = topY;
    }
    return best === -Infinity ? 0 : best;
  }

  reset();
  return {
    reset,
    addBox,
    removeBox,
    addPlatform,
    addLadder,
    createPlayer,
    movePlayer,
    supportHeight,
    // Consultas de volume usadas pelos projéteis (granada, foguete) e pela
    // linha de visão: são as ÚNICAS que enxergam altura de verdade.
    solidAt,
    surfaceBelow,
    onLadder,
    // Sonda de auditoria: "há sólido ocupando o volume do jogador aqui?".
    // É o mesmo teste usado pelo movimento — auditar com ele garante que a
    // auditoria mede a física real, não uma cópia que pode divergir.
    probe: (x, y, z) => collides(x, y, z),
    position: () => player,
    // Lista dos volumes sólidos, para auditar que cada um tem geometria
    // visível: nada sólido pode ser invisível.
    colliders: () => ({
      boxes: boxes.map((box) => ({ ...box, topY: box.y + box.hy })),
      platforms: platforms.map((platform) => ({ ...platform })),
    }),
    get staticColliderCount() { return boxes.length; },
    get platformCount() { return platforms.length; },
    get ladderCount() { return ladders.length; },
  };
}
