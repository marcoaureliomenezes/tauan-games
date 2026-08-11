// Web game package: james-bond.
//
// VOCABULÁRIO DE TILE dos mapas.
//
// A primeira geração de mapas tinha três símbolos úteis (`#`, `.` e marcadores)
// e por isso só sabia desenhar uma coisa: labirinto de corredor de uma célula.
// O pedido — cenários no espírito de Medal of Honor, com ruas, calçadas,
// carros, prédios em que se entra e construções destruídas — é antes de tudo um
// problema de VOCABULÁRIO: sem tiles para rua, calçada, porta, janela e
// escombro, nenhum desenho de mapa consegue expressar uma quadra de cidade.
//
// Referência de desenho (Medal of Honor: Allied Assault / Frontline — ver
// "Yard by Yard" e "Arnhem Knights"): o combate urbano acontece por espaços
// residenciais e comerciais INTERLIGADOS, não por rua aberta. Entra-se numa
// casa, sobe-se ao andar de cima e atira-se para baixo, sobre a barricada da
// rua. Daí o par rua larga + prédio com mezanino sobre ela ser a unidade de
// composição destes mapas.
//
// Regra dura: um tile é SÓLIDO ou é ANDÁVEL, nunca os dois. Cada tile sólido
// declara a sua ALTURA, e essa altura é a mesma para o desenho, para o colisor
// e para a linha de visão. É o que permite atirar por cima de um carro e
// arremessar granada por cima de uma barricada.

/** @typedef {{ height:number, cover:boolean, label:string }} TileSpec */

export const WALL_CHAR = '#';

/**
 * Tiles sólidos: altura em metros e se são COBERTURA (baixos o bastante para o
 * jogador ver e atirar por cima, ficando protegido o corpo).
 */
// `inset` é a fração da célula que o volume ocupa. Ele existe porque o colisor
// e o DESENHO têm de descrever o mesmo bloco: um colisor de célula inteira sob
// uma carcaça de carro estreita é parede invisível, e a auditoria de sólidos
// (game.api.auditSolids) reprova exatamente isso.
export const SOLID_TILES = Object.freeze({
  '#': { height: 3.15, cover: false, inset: 1, label: 'parede/fachada' },
  n: { height: 3.15, cover: false, inset: 1, label: 'fachada com janela' },
  c: { height: 1.42, cover: true, inset: 0.56, label: 'carro destruído' },
  u: { height: 1.12, cover: true, inset: 0.86, label: 'monte de escombro' },
  b: { height: 1.0, cover: true, inset: 0.86, label: 'barricada de sacos de areia' },
  t: { height: 3.6, cover: false, inset: 0.22, label: 'poste' },
});

/** Fração da célula ocupada pelo volume sólido do tile. */
export function tileInset(char) {
  return SOLID_TILES[char]?.inset ?? 1;
}

/** Tiles andáveis puramente visuais (a superfície muda, a passagem não). */
export const GROUND_TILES = Object.freeze({
  '.': { label: 'piso interno' },
  '=': { label: 'asfalto' },
  ',': { label: 'calçada' },
  '+': { label: 'vão de porta' },
});

/** Marcadores de jogo — andáveis, tratados em world.js. */
export const MARKERS = 'SEGABCX';

export function isSolid(char) {
  return Boolean(SOLID_TILES[char]);
}

/** Altura sólida da célula em metros; 0 quando é passagem. */
export function tileHeight(char) {
  return SOLID_TILES[char]?.height || 0;
}

export function isCover(char) {
  return Boolean(SOLID_TILES[char]?.cover);
}

/** Um poste é sólido, mas fino: o colisor não ocupa a célula inteira. */
export const THIN_TILES = new Set(['t']);
