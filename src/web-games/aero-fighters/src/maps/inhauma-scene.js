// maps/inhauma-scene.js — Construção do mapa Inhauma REALISTA.
// Relevo contínuo (FBM) + rio entalhado + represa/reservatório + usina nuclear +
// fábricas + florestas + estradas com carros + cidade. Sem assets externos.
//
// Verdade de superfície única: inhaumaContinuousHeight(x,z) alimenta TANTO a malha
// visual QUANTO a colisão (via a região gigante registrada em game.islands).

import * as THREE from '../../../vendor/three.module.min.js';
import { game } from '../state.js';
import { applyAirportClearing } from '../landing-zones.js';
import { fbm2D, ridgedFbm2D } from './noise.js';
import { applyInhaumaRoadBed, nearAnyRoad } from './inhauma-roads.js';
import { getPortalMounds } from './inhauma-road-defs.js';
import { updateRoadTraffic } from './inhauma-traffic.js';
import { updateWaterSurfaces, createReflectiveWater } from '../environment/water-surface.js';
import { loadInhaumaDem, sampleDemHeight, demSlopeAt } from './heightmap-sampler.js';
import { AA_DEFENSE } from '../config.js';
import { createInhaumaBackdrop, updateInhaumaBackdrop } from './inhauma-backdrop.js';
import { createInhaumaTerrainTextures } from './inhauma-terrain-texture.js';
import { buildInhaumaRiver } from './inhauma-river-ribbon.js';
import {
  distanceToRiver,
  riverCarveAt,
  riverSurfaceInfoAt,
  RIVER_HALF_WIDTH_M,
  RIVER_CARVE_DEPTH_M,
  getInhaumaRiverPolyline,
  riverBankHeightAt,
  riverWaterLevelAt,
} from './inhauma-river.js';
import { bridgeDeckHeightAt, buildInhaumaBridges, computeInhaumaBridgeCrossings } from './inhauma-bridges.js';
import { mergeGeometries } from '../../../vendor/jsm/utils/BufferGeometryUtils.js';
// T-V-12/T-V-13 (inhauma-visual-uplift-v1): tipologias/fachadas da cidade.
// T-C-04 (inhauma-campaign-v1): placement genérico das duas cidades (buildTownCluster).
import { buildCityMeshes, updateInhaumaCityLights, buildTownCluster, makeInhaumaTypology, makeCachoeiraTypology } from './inhauma-city.js';
// T-C-05 (inhauma-campaign-v1): driver por frame da guarnição de ocupação.
import { updateFormations } from '../formations/formation.js';

// sky.js importa scene.js (que toca window no escopo de módulo) — carga LAZY para
// este módulo continuar importável em Node (validate:aero-map).
let _getSunData = null;
if (typeof window !== 'undefined') {
  import('../sky.js').then((m) => { _getSunData = m.getSunData; }).catch(() => {});
}

// Detecta ambiente automatizado (Playwright/headless) SEM importar scene.js (que
// toca window/document/<canvas> no escopo de módulo e quebraria a importabilidade
// em Node — mesmo motivo do carregamento lazy de sky.js acima). Mesmo padrão
// self-contained já usado por prop-fire.js/nuclear-fx.js/fx.js para reduzir/pular
// detalhe puramente decorativo sob automação — nunca instanciado em Node
// (`navigator` não existe lá), então test-aero-sim.js/test-aero-cachoeira.mjs (que
// rodam em Node puro) continuam vendo a densidade de floresta INTEGRAL.
const HEADLESS = typeof navigator !== 'undefined' && navigator.webdriver === true;

// DEM vendorizado (T-01/T-02) — verdade de superfície de base do vale
// (v0.2.11). Top-level await: qualquer módulo que importe
// (direta ou transitivamente) este arquivo só termina de avaliar depois que o asset
// estiver carregado — inhaumaBaseHeight/inhaumaContinuousHeight nunca são chamadas
// antes disso (create() dos mapas é síncrono hoje; ver maps/index.js). Sem
// `window`/`document`/`<canvas>` aqui — loadInhaumaDem() é Node-safe (fs) e
// browser-safe (fetch) pela mesma função, então o top-level await funciona nos dois
// runtimes (validate:aero-map/test:aero:sim em Node, index.html no browser).
await loadInhaumaDem();

// ─── Geografia ────────────────────────────────────────────────────────────────
export const WATER_LEVEL = 4.5;     // m — cota "genérica" (represa/praia/biome); o RIO
                                     // usa sua própria cota local via riverWaterLevelAt
                                     // (o vale real tem desnível de centenas de metros
                                     // ao longo do traçado — uma cota global não serve).
// RIO (v0.2.11 T-05): o polyline autoral RIVER da era FBM
// (v0.2.0) foi APOSENTADO — o traçado agora vem da drenagem do DEM real
// (maps/inhauma-river.js#getInhaumaRiverPolyline, T-05). Nenhuma coordenada de rio é
// digitada à mão aqui; ver o cabeçalho daquele módulo para o algoritmo de traçado.
// DAM/RESERVOIR (represa/reservatório) — DEVIATION APROVADA PELO ORQUESTRADOR (T-09).
// As posições HERDADAS da era FBM (barragem em (320,470), lago em (60,350)) ficaram
// 400-700 m longe do traçado real do rio (T-05, drenagem do DEM) — o rio novo nem
// passa perto delas. Duas saídas possíveis: (a) reposicionar a barragem sobre o canal
// real num ponto estreito, com o reservatório a montante, usando a API do rio
// (riverBankHeightAt/riverWaterLevelAt/getInhaumaRiverPolyline); ou (b) aposentar
// limpo. ESCOLHIDA: (b) aposentar. Razão: (a) exigiria reconstruir a hidrologia da
// represa do zero — achar um trecho estreito e coerente do canal real, redimensionar
// o reservatório para não colidir com a travessia da MG-238 (T-06, ~(125,-14)) nem
// com os corredores de estrada, e manter os níveis d'água consistentes com
// riverWaterLevelAt (que já varia centenas de metros ao longo do traçado) — trabalho
// de escopo comparável a uma sub-tarefa de hidrologia própria, arriscado de acertar
// nos detalhes dentro do orçamento de T-09. (b) é MENOS INVASIVA (só remove código
// desta mesma seção, sem tocar o carve do rio nem os corredores de estrada) e
// VISUALMENTE COERENTE (um vale alpino real não depende de uma represa artificial
// para ler como "acidentado" — o rio, as pontes e o relevo já carregam isso; uma
// represa flutuando longe do canal real seria pior para a fidelidade DEM do que
// nenhuma represa). A usina nuclear (buildNuclearPlant) e as fábricas
// (buildFactories) NÃO fazem parte desta decisão — só DAM/RESERVOIR foram sinalizadas
// pelo orquestrador; ficam como estão (fora do escopo desta tarefa).
const structures = [];

// Features nomeadas — v0.2.0 FBM: geravam relevo (featureContribution). A partir de
// v0.2.11 o relevo vem do DEM (sampleDemHeight) — a lista NÃO
// contribui mais para a altura (D-2: "INHAUMA_FEATURES contribution removed"). Mantida
// (neutralizada) só como metadado de posição/rótulo para os diagnostics existentes
// (game.missionRealism.inhaumaMap.terrainRegions, consumidos por inhauma.js/testes de
// fidelidade) — esses nomes/posições apontavam para morros autorais que já não existem;
// T-04..T-10 (roads/city/QA) devem revisá-los contra o relevo real do DEM.
export const INHAUMA_FEATURES = [
  { id: 'urban-rise-inhauma', cx: 0, cz: 0, radius: 360, peakHeight: 14, type: 'urbanRise' },
  { id: 'morros-oeste-inhauma', cx: -380, cz: 40, radius: 300, peakHeight: 58, type: 'roundedHill' },
  { id: 'morro-norte-inhauma', cx: -40, cz: -330, radius: 250, peakHeight: 50, type: 'roundedHill' },
  { id: 'serra-sete-lagoas', cx: 760, cz: -300, radius: 460, peakHeight: 96, type: 'ridge' },
  // 2026-08-11: move junto com CACHOEIRA_TOWN_CENTER (distância +50%).
  { id: 'vale-cachoeira-prata', cx: -2400, cz: 2200, radius: 260, peakHeight: 16, type: 'valley' },
  { id: 'morros-sudeste-inhauma', cx: 330, cz: 330, radius: 240, peakHeight: 44, type: 'roundedHill' },
  { id: 'serra-leste-inhauma', cx: 1300, cz: 120, radius: 380, peakHeight: 70, type: 'ridge' },
].map((d, index) => ({ ...d, index }));

// WS-2: colinas de portal de túnel — geradas das pontas de estrada (inhauma-road-defs).
// Somadas ao relevo para que TODA estrada aberta fure uma encosta real, nunca pare no ar.
const PORTAL_MOUNDS = getPortalMounds();
function portalMoundContribution(x, z) {
  let h = 0;
  for (const m of PORTAL_MOUNDS) {
    const t = Math.hypot(x - m.x, z - m.z) / m.radius;
    if (t < 1) h += m.peak * Math.max(0, 1 - t * t * 1.3); // mesma curva de roundedHill
  }
  return h;
}

// T-D-01 (release v0.3.10): o MORRO DA BATERIA —
// "a colina do meio da cidade deve ter elevação 2.5x maior" (operador 2026-07-20).
// Perfil COSENO elíptico (RX 340 × RZ 540 m, alongado no eixo do vale) centrado
// em AA_DEFENSE.HILL_POS, com topo largo e bordas suaves — a MG-060 margeia a
// encosta e a curva quadrática das portal mounds cravava nela um degrau >13 m
// (guard ROAD_BED_P99 ≤ 8 do validate:aero-map); com o cosseno o p99 medido é
// 6,6 (probe 2026-07-20). Topo ~250 m ≈ 2,5× a proeminência anterior (~96 m
// sobre o piso da cidade → ~242 m). A cidade fica intacta: o ponto da
// TOWN_SHELF mais próximo do centro fica a ~434 m — além do zero da curva no
// flanco leste (~298 m) — e o keep-out HILL_TOWN_KEEPOUT_M em buildTown é a
// trava de segurança para crescimentos futuros do shelf.
function hillContribution(x, z) {
  const t = Math.hypot(
    (x - AA_DEFENSE.HILL_POS.x) / AA_DEFENSE.HILL_RADIUS_X_M,
    (z - AA_DEFENSE.HILL_POS.z) / AA_DEFENSE.HILL_RADIUS_Z_M,
  );
  if (t >= 1) return 0;
  return AA_DEFENSE.HILL_PEAK_M * (1 + Math.cos(Math.PI * t)) / 2;
}

// Ruído de detalhe de alta frequência sobre o DEM (13 m/px) — evita o look "liso de
// vinil" de perto sem alterar o relevo macro (vale/cristas). Amplitude pequena
// (±3 m) e frequência alta (~1/22 m) — bem abaixo da escala das feições do DEM.
// Coordenadas deslocadas para não correlacionar com outros usos de fbm2D no jogo.
function inhaumaDetailNoise(x, z) {
  return (fbm2D(x + 8000, z - 5000, { freq: 0.045, oct: 3 }) - 0.5) * 6;
}

// Cristas ríspidas (T-07 polish, visual QA fix-forward 2026-07-15; ROUND 2
// 2026-07-15: a rodada anterior — 30 m de amplitude, 280 m de comprimento de onda,
// grade de 48 m/vértice — ainda lia como "domo liso" na revisão de screenshot do
// orquestrador. A malha de 48 m amostra um comprimento de onda de 280 m a ~5-6
// amostras/onda — resolve a ondulação macro mas não gera uma silhueta serrilhada
// reconhecível; e uma única oitava de baixa frequência produz uma curva suave demais
// mesmo bem amostrada.) Dois termos de detalhe ridged sobre o DEM, escalados pela
// MESMA rampa de altitude — sem isso o silhueta dos cumes lê como "domo liso" mesmo
// com o DEM real por baixo. Amplitude RAMPEIA de 0 em CREST_RAMP_START_M até o pico em
// CREST_RAMP_PEAK_M — o piso do vale, estradas, rio, cidade terraceada (T-09) e a
// clareira do aeroporto ficam TODOS bem abaixo da rampa (< 20 m), então nenhum é
// tocado. Os dois termos só SOMAM (ridgedFbm2D ∈ [0,1), nunca negativo) — nunca abaixam
// um ponto, então não podem fechar a passagem voável (AC-01/AC-02, MIN_PASS_WIDTH) nem
// submergir nada; a rampa usa a altura CRUA do DEM (antes de qualquer entalhe local)
// como driver, para não haver realimentação com o próprio termo. Passa PELA verdade de
// superfície única (D-2/WS-1) — colisão acompanha de graça.
//   - Termo primário: ~200 m de comprimento de onda, amplitude até CREST_MAX_AMP_M
//     (55-75 m pedido) — na grade de 48 m já dá ~4 amostras/onda (melhor que antes);
//     na grade mais fina do lever 1 (TERR.chunkSize, abaixo) sobe para ~6.
//   - Termo secundário (serrilhado fino): ~90 m de comprimento de onda, amplitude
//     CREST_DETAIL2_AMP_M — deliberadamente perto do limite de Nyquist na grade antiga
//     de 48 m (quase invisível lá, por isso o lever 1 encolhe TERR.chunkSize), mas
//     resolve como dentes/lascas visíveis na grade mais fina. Frequência 2.2× a
//     primária (não 2× exato) e coordenadas deslocadas de forma independente — evita
//     alinhamento periódico entre as duas oitavas (que criaria um padrão repetitivo
//     em vez de uma silhueta irregular).
// WS-1 (mesh==collision, bound <15 m) e o benchmark de custo de rebuild (D-6) foram
// re-checados com estes valores — ver o handoff desta rodada.
const CREST_RAMP_START_M = 480;  // = ROCK_LINE_M (T-07) — cristas só onde a rocha já aparece
const CREST_RAMP_PEAK_M = 1100;  // perto do pico do DEM (~1281 m) — rampa total antes do topo
const CREST_MAX_AMP_M = 65;         // dentro da faixa 55-75 m pedida (ROUND 2)
const CREST_DETAIL2_AMP_M = 15;     // 2º oitava de serrilhado fino — faixa ~15 m pedida
function ridgedCrestDetailAt(x, z, demH) {
  const t = Math.max(0, Math.min(1, (demH - CREST_RAMP_START_M) / (CREST_RAMP_PEAK_M - CREST_RAMP_START_M)));
  if (t <= 0) return 0;
  const ramp = t * t * (3 - 2 * t); // smoothstep — rampa sem dobra em CREST_RAMP_START_M
  const ridge = ridgedFbm2D(x + 44000, z - 38000, { freq: 1 / 200, oct: 4 });
  const ridge2 = ridgedFbm2D(x - 91000, z + 27000, { freq: 1 / 90, oct: 3 });
  return ramp * (ridge * CREST_MAX_AMP_M + ridge2 * CREST_DETAIL2_AMP_M);
}

// ─── Cachoeira da Prata — shelf urbano (T-C-04, release v0.3.4) ──
// A segunda cidade fica no vale sudoeste, na continuação do corredor da osm-mg-060
// (a estrada termina em (-688,1556), ~560 m a nordeste — o trecho final é vicinal).
// T-D-04 (release v0.3.10, operador 2026-07-20:
// "cachoeira da prata e inhauma estão muito próximos"): REPOSICIONADA de
// (-1080,530) para (-950,2050) — 876 m → 1931 m centro-a-centro com Inhaúma
// (2,2×). O retângulo foi escolhido por varredura do heightmap (probe Node,
// 2026-07-20): seco (DEM 53-85 m, média ~71 m, longe do traçado do rio), sem
// estrada dentro nem na penumbra, e com morros de 85-145 m no anel leste
// (300-800 m) para os ninhos de AA da guarnição. O shelf é NIVELADO na cadeia de
// altura (mesmo padrão applyAirportClearing): interior plano em CACHOEIRA_SHELF_H
// e penumbra smoothstep de CACHOEIRA_FEATHER_M emendando com o relevo natural.
// A rota de invasão/campanha desce o vale até a ponte da osm-mg-060 em
// (-1275,870) e contorna a TOWN_SHELF pelo norte — ver CAMPAIGN em config.js.
// 2026-08-11 (operador: "coloque a distância pelo menos 50% maior"):
// REPOSICIONADA de (-950,2050) para (-2400,2200) — 1931 m → 2903 m
// centro-a-centro com Inhaúma (+50,3%), seguindo o MESMO corredor sudoeste.
// Sítio re-sondado no DEM (probe Node 2026-08-11, anel 2850-3250 m completo):
// planície de várzea a leste do rio (spread 28 m, média ~6 m — o prolongamento
// direto do eixo antigo cai na serra, spread ≥131 m, e a malha de LOD distante
// não resolve a penumbra do aterro lá; ver WS-1). Cota do aterro re-baixada
// para 12 m (acima de WATER_LEVEL 4.5 + margem); montanhas no anel oeste/sul
// mantêm os ninhos de AA da guarnição. Rotas partem do novo vale sem cruzar o
// rio (mesma margem; probe distanceToRiver ao longo do prefixo).
export const CACHOEIRA_SHELF = { minX: -2520, maxX: -2280, minZ: 2110, maxZ: 2290 };
export const CACHOEIRA_TOWN_CENTER = { x: -2400, z: 2200 }; // centro do shelf
export const CACHOEIRA_CHURCH = { x: -2378, z: 2168 };      // igrejinha (marco)
export const CACHOEIRA_PRACA = { x: -2412, z: 2222 };       // praça (marco)
const CACHOEIRA_SHELF_H = 12;   // cota do aterro urbano (várzea ~6 m sondada 2026-08-11 + margem sobre WATER_LEVEL)
const CACHOEIRA_FEATHER_M = 45; // penumbra de emenda com o relevo
const CACHOEIRA_SHELF_KEEP_MARGIN = 20; // margem extra p/ floresta não invadir a cidade

function cachoeiraShelfLevel(x, z, h) {
  const dx = Math.max(CACHOEIRA_SHELF.minX - x, 0, x - CACHOEIRA_SHELF.maxX);
  const dz = Math.max(CACHOEIRA_SHELF.minZ - z, 0, z - CACHOEIRA_SHELF.maxZ);
  const d = Math.hypot(dx, dz);
  if (d >= CACHOEIRA_FEATHER_M) return h;
  const t = 1 - d / CACHOEIRA_FEATHER_M;
  const s = t * t * (3 - 2 * t); // smoothstep — sem dobra na borda da penumbra
  return h + (CACHOEIRA_SHELF_H - h) * s;
}

/** Verdadeiro dentro do shelf de Cachoeira (+margem) — keep-out de floresta (T-C-04). */
function insideCachoeiraShelf(x, z) {
  const m = CACHOEIRA_SHELF_KEEP_MARGIN;
  return x >= CACHOEIRA_SHELF.minX - m && x <= CACHOEIRA_SHELF.maxX + m &&
    z >= CACHOEIRA_SHELF.minZ - m && z <= CACHOEIRA_SHELF.maxZ + m;
}

/** Altura base do terreno em coords de mundo, antes de cortes de estrada. */
function inhaumaBaseHeight(x, z) {
  // DEM real (Chamonix U-valley, T-01/T-02) + micro-relevo de alta frequência.
  const demH = sampleDemHeight(x, z);
  let h = demH + inhaumaDetailNoise(x, z);

  // Cristas ríspidas acima da linha de rocha (T-07 polish) — ver nota acima.
  h += ridgedCrestDetailAt(x, z, demH);

  // Colinas de portal de túnel (WS-2) — encostas onde as estradas entram em túnel.
  h += portalMoundContribution(x, z);

  // Morro da bateria AA (T-D-01) — a colina da cidade, 2.5× (ver nota acima).
  h += hillContribution(x, z);

  // Entalhe do rio (T-05): canal derivado da drenagem real do DEM, com margens
  // suaves — substitui o carve autoral acima (mesma posição na cadeia: depois dos
  // portais, antes da bacia do reservatório e da clareira do aeroporto).
  h = riverCarveAt(x, z, h);
  // (T-09 DEVIATION: a bacia artificial do reservatório — herdada da era FBM, longe
  // do traçado real do rio — foi removida daqui junto com a represa; ver a nota acima
  // de DAM/RESERVOIR. O relevo natural do DEM aparece sem entalhe extra nesta área.)

  // Piso em 0: leito do rio/lago fica em 0 e a lâmina d'água (WATER_LEVEL) cobre.
  // Mantém colisão (max(0,h)) idêntica ao diagnostics (alvos sempre aterrados).
  h = Math.max(h, 0);
  // T-C-04: aterro nivelado do shelf urbano de Cachoeira da Prata (ver a nota da
  // constante acima) — depois do entalhe do rio (o shelf fica >55 m fora da margem,
  // não interfere no canal) e antes da clareira do aeroporto (regiões disjuntas).
  h = cachoeiraShelfLevel(x, z, h);
  // Clareira do aeroporto (pista plana, sem morro)
  return applyAirportClearing(h, x, z, 'inhauma');
}

/** Altura contínua final. A estrada gerada assenta o terreno para evitar fitas flutuando.
 *  T-06: perto de um cruzamento rio×estrada, `bridgeDeckHeightAt` segura a altura no
 *  nível do tabuleiro DEPOIS do leito de estrada — sem isso o leito de estrada
 *  simplesmente reproduziria o entalhe do rio e a "estrada" mergulharia na água na
 *  travessia (o próprio bug que a ponte existe para resolver). */
export function inhaumaContinuousHeight(x, z) {
  const base = inhaumaBaseHeight(x, z);
  const roadBed = applyInhaumaRoadBed(x, z, base, inhaumaBaseHeight);
  return bridgeDeckHeightAt(x, z, roadBed);
}

// ─── Materiais utilitários ──────────────────────────────────────────────────
const _mc = new Map();
function lmat(color, opts) {
  const key = color + JSON.stringify(opts || 0);
  if (!_mc.has(key)) _mc.set(key, new THREE.MeshLambertMaterial({ color, ...opts }));
  return _mc.get(key);
}
// Lambert (não PBR) para evitar compilação de shader cara no warmup → FPS na decolagem.
function smat(color) {
  return lmat(color);
}

// ─── Biomas (T-07: altitude + inclinação) ─────────────────────────────────────
// O pico do DEM vendorizado (heightRange.max no bake, T-01/assets/inhauma-dem/
// heightmap.json) é ≈1281 m. Linha de neve alvo em ~62% do pico (faixa 55-70%
// pedida pela release, D-3 — neve estilizada aceita conscientemente num mapa de
// nome brasileiro). Linha de rocha bem abaixo dela: encostas expostas já aparecem
// antes da neve, e encostas íngremes expõem rocha em QUALQUER cota (inclusive nos
// morros baixos, onde um flanco muito íngreme não sustenta mata fechada).
const SNOW_LINE_M = 800;           // ≈62% de 1281 m
const SNOW_LINE_JITTER_M = 90;     // T-V-11: 55 → 90 — borda da neve mais irregular
                                   // (a faixa reta lia como "mancha branca", auditoria)
const SNOW_SLOPE_LIFT_M = 140;     // T-V-11: sobe a linha de neve com a inclinação —
                                   // encosta íngreme sustenta menos neve
const SNOW_EDGE_BAND_M = 70;       // T-V-11: faixa de transição suave (~2 vértices na
                                   // grade de 39 m) em vez de corte duro por cota
const ROCK_LINE_M = 480;           // acima disso, rocha nua mesmo em terreno raso
const STEEP_SLOPE = 0.45;          // ~24° (dh/dm) — encosta íngrime o bastante p/ expor rocha
const VERY_STEEP_SLOPE = 0.8;      // ~39° — rocha nua mesmo ACIMA da linha de neve (D-4/AC-04)
// T-07 polish (visual QA fix-forward, 2026-07-15; ROUND 2 2026-07-15: patch coverage
// widened and jitter strengthened — the first round's rock patches still read too
// faint/sparse to break up the crest silhouette in color once the geometry got
// craggier, per the orchestrator's follow-up screenshot review). Abaixo do limiar de
// inclinação STEEP_SLOPE, um ruído de "patch" ainda pode furar rocha nas encostas já
// MODERADAMENTE íngremes — sem isso o corte era uma linha lisa e as cristas liam como
// "domo pintado de um tom só". Só EMPURRA para rocha (nunca suprime uma encosta
// genuinamente íngreme) e nunca age abaixo de ROCK_PATCH_MIN_SLOPE — o piso do vale
// (quase plano) nunca ganha afloramento por acidente.
const ROCK_PATCH_MIN_SLOPE = 0.16;  // ROUND 2: down from 0.20 — more of the newly-serrated
                                     // slope range (lever 2 above) is eligible for a rock patch
const ROCK_PATCH_JITTER = 0.30;     // ROUND 2: up from 0.22 — patches trigger more readily

// Ruído de baixa frequência (feições de centenas de metros, não um granulado de
// pixel) que quebra a borda reta da linha de neve — coordenadas deslocadas para não
// correlacionar com `inhaumaDetailNoise` nem com nenhum outro uso de fbm2D no jogo.
// Determinístico (mesma (x,z) sempre a mesma jitter — sem RNG).
function snowLineJitterAt(x, z) {
  return (fbm2D(x - 20000, z + 15000, { freq: 0.0009, oct: 3 }) - 0.5) * 2 * SNOW_LINE_JITTER_M;
}

// Ruído de "patch" de rocha (T-07 polish) — escala de dezenas/poucas centenas de
// metros (freq maior que snowLineJitter, que é uma feição de centenas de metros;
// menor que inhaumaDetailNoise, que é granulado de perto). Coordenadas deslocadas
// (não correlaciona com nenhum outro canal de ruído do arquivo).
function rockPatchNoiseAt(x, z) {
  return fbm2D(x + 71000, z - 63000, { freq: 0.006, oct: 3 }); // [0,1)
}

/** Verdadeiro se o ponto deve ler como rocha exposta: já rocha por inclinação/cota
 *  (regra original, sem ruído — nunca suprimida), OU uma encosta já moderadamente
 *  íngreme que o ruído de patch empurra sobre o limiar (T-07 polish). */
function isExposedRock(h, slope, x, z) {
  if (slope >= STEEP_SLOPE || h > ROCK_LINE_M) return true;
  if (slope < ROCK_PATCH_MIN_SLOPE) return false;
  const patch = rockPatchNoiseAt(x, z);
  return slope + patch * ROCK_PATCH_JITTER >= STEEP_SLOPE;
}

// Ruído de alta frequência (T-07 polish; ROUND 2: amplitude ampliada de ±0.04 para
// ±0.06 — a rocha ainda lia "plana" nos closeups pós-lever-2) só para DITHER de cor —
// quebra o banding de grandes faces planas de rocha de uma cor só (mesma escala
// aproximada de `inhaumaDetailNoise`, coordenadas deslocadas para não correlacionar).
function rockDitherAt(x, z) {
  return (fbm2D(x + 61000, z + 52000, { freq: 0.05, oct: 2 }) - 0.5) * 0.12; // ±0.06
}

/** Cor de bioma por vértice: altitude + inclinação local (T-07, AC-04; polish T-07
 *  fix-forward; snowline T-V-11). Ordem: base sem neve (rocha exposta → bandas de
 *  vegetação por cota) e depois a neve BLENDADA por cima — a máscara de neve tem
 *  jitter de cota por (x,z), sobe com a inclinação (mais íngreme = menos neve) e
 *  transiciona suavemente numa faixa de SNOW_EDGE_BAND_M, em vez do corte duro por
 *  altitude que virava mancha branca (shots 02/05/13 da auditoria). Paredão
 *  (slope ≥ VERY_STEEP_SLOPE) nunca recebe neve (regra original, D-4/AC-04).
 *  Lambert vertex-colored (sem PBR) preservado; estrutura de 6 bandas mantida.
 *  Exportado (sem THREE) para teste direto em Node — ver AC-04 em test-aero-unit.js. */
export function biomeColor(h, slope, x, z, out, i) {
  let r, g, b;
  if (isExposedRock(h, slope, x, z)) {
    // Rocha exposta — cinza-marrom escuro (mais escuro/saturado que antes, para
    // contrastar com a neve quase branca e o verde do vale); mais escura em
    // paredões muito íngremes; dither por vértice quebra o banding de faces grandes.
    const dark = slope >= VERY_STEEP_SLOPE ? 0.78 : 1;
    const dither = rockDitherAt(x, z);
    r = (0.40 + dither) * dark; g = (0.35 + dither) * dark; b = (0.30 + dither) * dark;
  } else if (h < WATER_LEVEL + 1.5) { r = 0.74; g = 0.68; b = 0.46; }       // areia/margem
  else if (h < 18) { r = 0.16; g = 0.55; b = 0.16; }                        // campo verde (vale) — verde vivo, não oliva
  else if (h < 48) { r = 0.12; g = 0.40; b = 0.14; }                        // mata densa (piso da floresta) — mais escura/distinta do campo
  else if (h < 180) { r = 0.24; g = 0.37; b = 0.19; }                       // mata rala / subalpina
  else { r = 0.34; g = 0.38; b = 0.25; }                                   // campo alpino/rocha esparsa

  // T-V-11: máscara de neve suave por cima da base. snowLine sobe com a inclinação
  // (a neve "escorrega" de encostas) além do jitter de (x,z) — borda irregular e
  // sensível a slope, não uma faixa por altitude.
  const snowLine = SNOW_LINE_M + snowLineJitterAt(x, z) + slope * SNOW_SLOPE_LIFT_M;
  let snowT = (h - snowLine) / SNOW_EDGE_BAND_M + 0.5;
  snowT = Math.max(0, Math.min(1, snowT));
  snowT = snowT * snowT * (3 - 2 * snowT); // smoothstep — sem degrau de cor
  if (slope >= VERY_STEEP_SLOPE) snowT = 0; // neve não cola em paredão
  if (snowT > 0) {
    // Neve — quase branca no plano (≈0.93,0.95,0.97, paridade com a neve do mapa de
    // ilhas — world.js#createIslands), um pouco mais fria/acinzentada nas encostas
    // moderadas (a neve "escorrega" e fica mais fina perto do limite sustentável).
    const t = Math.min(1, slope / STEEP_SLOPE);
    const sr = 0.93 - t * 0.09, sg = 0.95 - t * 0.08, sb = 0.97 - t * 0.04;
    r += (sr - r) * snowT; g += (sg - g) * snowT; b += (sb - b) * snowT;
  }
  out[i] = Math.min(1, Math.max(0, r));
  out[i + 1] = Math.min(1, Math.max(0, g));
  out[i + 2] = Math.min(1, Math.max(0, b));
}

// ─── Terreno infinito visual (chunks reciclados) ─────────────────────────────
// T-07 (D-6): `seg` bump acima de 54 avaliado e REJEITADO — benchmark de Node do
// custo real de rebuild (amostragem da cadeia inhaumaContinuousHeight + o gradiente
// local de inclinação do bioma, T-07, sobre 5 posições de chunk incluindo terreno
// plano e flancos íngremes): seg=54 já custa ~11-22 ms por rebuild (a fila amortizada
// de updateInfiniteTerrain assume ~16 ms/chunk); seg=72 sobe para ~18-30 ms, seg=80
// para ~23-37 ms, seg=96 para ~31-47 ms — 2-3× mais caro, estourando claramente o
// orçamento de "no máximo 1 rebuild por frame" mesmo no caso médio. `seg` permanece
// 54, como a release permite quando o orçamento não se sustenta.
//
// T-07 polish ROUND 2 (2026-07-15): `chunkSize` 2600 -> 2100 (grid step 48.1 m ->
// 38.9 m, same seg=54 so IDENTICAL per-chunk rebuild cost — the D-6 budget above is
// untouched). Two alternatives were evaluated and rejected instead of the literal
// 2600->1800 suggestion:
//   - `radius: 2` (5x5=25 chunks) to compensate for a smaller chunkSize's shrunken
//     streaming window: REJECTED — deterministic triangle-budget blowout, not a
//     borderline call. Terrain alone would cost 25*(54*54*2)=145800 triangles
//     (vs 9*5832=52488 today), a +93312 delta that alone exceeds the entire ~52-54k
//     headroom under the e2e "renderer budget" test's 200000 cap (measured baseline
//     146276-147860, tests/aero-fighters/inhauma-fidelity.spec.js) — no empirical run
//     needed, the arithmetic is exact and chunk count/seg are fixed. Reverted per the
//     task's own fallback ("if it exceeds, revert to 3x3").
//   - `chunkSize: 1800` at `radius: 1` (the literal ask): the streamed window's
//     worst-case forward coverage right before a chunk-boundary recycle is
//     `radius*chunkSize` (proven geometrically: the window is re-centered on the
//     NEAREST chunk to the player, so coverage decays from (radius+1)*chunkSize just
//     after a recycle down to radius*chunkSize just before the next one — this is
//     NOT the "window width / 2" naive estimate, which is the BEST case, not the
//     worst case). At chunkSize=1800: worst case = 1800 m < sceneFog.far (2600 m,
//     aero-fighters/src/maps/inhauma.js) for a full 800 m / 1800 m (44%) of every
//     chunk traversal — a real, non-transient pop-in risk, not a one-frame hitch
//     (confirmed empirically: hiding every non-terrain-chunk scene object and
//     re-rendering shows the streamed chunks alone are what silhouettes the crest in
//     every far vantage; the coverage math applies to real flight, not just statics).
// 2100 m keeps the SAME safety property the current 2600 has today at a meaningfully
// finer grid: worst case coverage = 2100 m, only 500 m short of fogFar — at that
// distance THREE.Fog's linear blend is already ~71% toward the fog color (900 near /
// 2600 far), so the residual gap reads as a soft continuation of the existing fog
// falloff rather than a hard edge.
//
// CORREÇÃO (T-V-04, inhauma-visual-uplift-v1): a versão anterior deste comentário
// afirmava que "a faixa de horizonte do sky dome é assada na MESMA cor exata do fog
// (0xb6d0c4 — confirmado por pixel sampling)" — FALSO: o dome antigo era um
// gradiente de 2 paradas descolado do fog, e à noite o horizonte brilhava contra o
// céu escuro (bug com screenshot na auditoria). Após T-V-04/T-V-05 a sincronia é
// DINÂMICA e contínua: sky.js expõe getSkyColor() (cor real do horizonte do dome
// Preetham, amostrada por espelho JS do shader) e main.js faz, a cada frame e em
// TODOS os mapas, scene.fog.color = lerp(cor base do mapa ↔ horizonte do céu,
// fator de noite) — a base diurna deste mapa continua 0xb6d0c4 (inhauma.js).
// `radius` stays 1 (9 chunks, unchanged triangle/draw-call cost).
const TERR = { chunkSize: 2100, radius: 1, seg: 54 };
const TERRAIN_COLLISION_RADIUS = 1e9;
// Passo (m) da grade do mesh — usado pelo bloco de gradiente local (biomeColor, T-07)
// e por inhaumaVisualSurfaceHeight (WS-1) abaixo. Movido para cima de
// updateTerrainChunkGeometry para os dois consumidores compartilharem a mesma
// constante sem duplicar a fórmula.
const TERR_STEP = TERR.chunkSize / TERR.seg;

// T-N-03: `extra` opcional carrega ponteiros de renderização para a carbonização
// do firestorm (firestorm.js): { block } nos quarteirões (buildTownCluster anexa
// charRefs de instância nele) ou { charRoot: Object3D } nos marcos construídos
// como Meshes soltos (usina, fábricas, igrejas — materiais lmat são
// COMPARTILHADOS via cache _mc: o firestorm clona antes de escurecer).
function registerStructure(id, x, z, halfX, halfZ, topY, extra = null) {
  structures.push({ id, x, z, halfX, halfZ, topY, ...(extra || {}) });
}

// T-05: `world.js#surfaceInfoAt` já chama esta função (única "verdade de superfície"
// injetável para o mapa 'inhauma' sem alterar world.js — fora do write-set de T-05) e
// devolve o resultado direto quando truthy. Reaproveitamos esse mesmo gancho para
// reportar `kind:'water'` dentro do canal do rio: estruturas (pontes, prédios) SEMPRE
// vencem sobre água (mesmo padrão de precedência de "feição especial vence terreno
// genérico" já usado por road-bed/clareira do aeroporto na cadeia de altura).
export function inhaumaStructureInfoAt(x, z) {
  let hit = null;
  for (const s of structures) {
    if (Math.abs(x - s.x) <= s.halfX && Math.abs(z - s.z) <= s.halfZ) {
      if (!hit || s.topY > hit.height) hit = { height: s.topY, kind: 'structure', id: s.id };
    }
  }
  if (hit) return hit;
  return riverSurfaceInfoAt(x, z);
}

// Lista de estruturas (casas/prédios/fábricas) em coords de mundo — exposto para a nuke
// incendiar cenário (WS-5) e para o firestorm carbonizar (T-N-03). Cada item:
// {id, x, z, halfX, halfZ, topY, block?, charRoot?} — block.charRefs (quarteirões
// instanciados) ou charRoot (Meshes soltos) são os ponteiros de carbonização.
export function getInhaumaStructures() {
  return structures;
}

function updateTerrainChunkGeometry(chunk, gridX, gridZ) {
  const centerX = gridX * TERR.chunkSize;
  const centerZ = gridZ * TERR.chunkSize;
  const pos = chunk.geometry.attributes.position;
  const col = chunk.geometry.attributes.color;
  const cols = TERR.seg + 1;

  // Passo 1: altura por vértice — EXATAMENTE a mesma amostra de sempre. O bioma por
  // inclinação (T-07) não adiciona nenhuma chamada extra de altura/DEM aqui.
  const heights = new Float32Array(pos.count);
  for (let i = 0; i < pos.count; i++) {
    const wx = centerX + pos.getX(i);
    const wz = centerZ + pos.getZ(i);
    const h = inhaumaContinuousHeight(wx, wz);
    heights[i] = h;
    pos.setY(i, h);
  }

  // Passo 2: inclinação local por GRADIENTE DA MALHA (diferença central sobre as
  // alturas já amostradas no passo 1 — "o que o loop de vértices computa barato",
  // T-07: zero amostras extra de altura, só leituras de array). Índice → (linha,
  // coluna) segue a ordem de THREE.PlaneGeometry (TERR.seg+1 colunas por linha).
  for (let i = 0; i < pos.count; i++) {
    const row = Math.floor(i / cols);
    const colIdx = i % cols;
    const hasXPrev = colIdx > 0, hasXNext = colIdx < cols - 1;
    const dhdx = hasXPrev && hasXNext
      ? (heights[i + 1] - heights[i - 1]) / (2 * TERR_STEP)
      : hasXNext ? (heights[i + 1] - heights[i]) / TERR_STEP
      : hasXPrev ? (heights[i] - heights[i - 1]) / TERR_STEP : 0;
    const hasZPrev = row > 0, hasZNext = row < cols - 1;
    const dhdz = hasZPrev && hasZNext
      ? (heights[i + cols] - heights[i - cols]) / (2 * TERR_STEP)
      : hasZNext ? (heights[i + cols] - heights[i]) / TERR_STEP
      : hasZPrev ? (heights[i] - heights[i - cols]) / TERR_STEP : 0;
    const slope = Math.hypot(dhdx, dhdz);
    const wx = centerX + pos.getX(i);
    const wz = centerZ + pos.getZ(i);
    biomeColor(heights[i], slope, wx, wz, col.array, i * 3);
  }

  pos.needsUpdate = true;
  col.needsUpdate = true;
  chunk.geometry.computeVertexNormals();
  chunk.position.set(centerX, 0, centerZ);
  chunk.userData.gridX = gridX;
  chunk.userData.gridZ = gridZ;
  // Evita costura visível de frustum em chunk grande.
  chunk.frustumCulled = false;
}

function createTerrainChunk(gridX, gridZ, material) {
  const geo = new THREE.PlaneGeometry(TERR.chunkSize, TERR.chunkSize, TERR.seg, TERR.seg);
  geo.rotateX(-Math.PI / 2);
  geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(geo.attributes.position.count * 3), 3));
  const mesh = new THREE.Mesh(geo, material);
  mesh.receiveShadow = true;
  updateTerrainChunkGeometry(mesh, gridX, gridZ);
  return mesh;
}

// FIX lag-de-voo (2026-07-01): cruzar uma borda de célula reconstruía os 9 chunks
// NO MESMO FRAME (9 × 55×55 amostras de altura FBM+estradas + 9 computeVertexNormals
// + 9 uploads de geometria) — um congelamento periódico a cada ~2.6 km de voo. Agora:
//  - chunks cujo grid continua dentro da janela 3×3 são REUTILIZADOS como estão;
//  - só os que saíram são re-gerados, no MÁXIMO 1 POR FRAME (fila amortizada).
// Mover 1 célula = 3 rebuilds espalhados em 3 frames (~16 ms cada) em vez de 9 num só.
export function updateInfiniteTerrain(playerPos, terrain, drainAll = false) {
  if (!terrain || !playerPos) return;
  const baseX = Math.round(playerPos.x / TERR.chunkSize);
  const baseZ = Math.round(playerPos.z / TERR.chunkSize);
  if (baseX !== terrain.baseX || baseZ !== terrain.baseZ) {
    terrain.baseX = baseX;
    terrain.baseZ = baseZ;
    const wanted = [];
    for (let gx = baseX - TERR.radius; gx <= baseX + TERR.radius; gx++) {
      for (let gz = baseZ - TERR.radius; gz <= baseZ + TERR.radius; gz++) wanted.push([gx, gz]);
    }
    const claimed = new Set();
    const free = [];
    for (const chunk of terrain.chunks) {
      const key = chunk.userData.gridX + ':' + chunk.userData.gridZ;
      const inWindow = wanted.some(([gx, gz]) => gx + ':' + gz === key);
      if (inWindow && !claimed.has(key)) claimed.add(key);
      else free.push(chunk);
    }
    terrain.queue = [];
    for (const [gx, gz] of wanted) {
      if (claimed.has(gx + ':' + gz)) continue;
      terrain.queue.push({ chunk: free.pop(), gx, gz });
    }
  }
  if (terrain.queue?.length) {
    do {
      const job = terrain.queue.shift();
      updateTerrainChunkGeometry(job.chunk, job.gx, job.gz);
    } while (drainAll && terrain.queue.length);
  }
}

export function buildInhaumaTerrain(scene) {
  const material = new THREE.MeshLambertMaterial({ vertexColors: true });
  // T-V-11: textura de detalhe + normal map procedurais (canvas) — geradas UMA vez
  // aqui, nunca por rebuild de chunk. Só no browser: test:aero:sim roda esta função
  // em Node sem DOM (`document` não existe) — lá o material fica sem mapa, ok.
  if (typeof document !== 'undefined') {
    const { detailMap, normalMap } = createInhaumaTerrainTextures();
    material.map = detailMap;
    material.normalMap = normalMap;
    material.normalScale.set(0.4, 0.4); // sutil — relevo de perto, sem "emborrachar"
  }
  const terrain = { chunks: [], baseX: null, baseZ: null };
  for (let i = 0; i < (TERR.radius * 2 + 1) ** 2; i++) {
    const mesh = createTerrainChunk(0, 0, material);
    terrain.chunks.push(mesh);
    scene.add(mesh);
  }
  // Boot é momento de carga: constrói a janela 3×3 inteira de uma vez (drainAll).
  updateInfiniteTerrain({ x: 0, z: 0 }, terrain, true);

  // T-V-09: anel de montanhas de fundo (backdrop) — 3 anéis ridged-FBM a 3,5-5,8 km,
  // recentrados no jogador a cada frame (updateInhaumaScene). Puramente visual:
  // sem colisão, fora de heightAt. Node-safe (só THREE puro, sem DOM).
  terrain.backdrop = createInhaumaBackdrop(scene);

  // Registra UMA região virtual gigante: colisão/HUD usam a função contínua,
  // enquanto a malha visual é reciclada em chunks ao redor do avião.
  game.islands.length = 0;
  structures.length = 0;
  game.islands.push({
    cx: 0, cz: 0, radius: TERRAIN_COLLISION_RADIUS, peakHeight: 120, type: 'inhauma-continuous', mesh: terrain.chunks[4],
  });
  // T-06: tabuleiro + pilares nos cruzamentos rio×estrada, registrados como
  // estruturas (colisão via inhaumaStructureInfoAt). `inhaumaBaseHeight` (o leito
  // natural do rio, ANTES do leito de estrada/tabuleiro) é passado para os pilares
  // descerem até o relevo real sob a ponte, nunca até a altura segurada do tabuleiro.
  buildInhaumaBridges(scene, registerStructure, inhaumaBaseHeight);
  return terrain;
}

// Altura da SUPERFÍCIE RENDERIZADA do terreno: amostra a MESMA grade dos chunks
// (espaçamento chunkSize/seg, TERR_STEP declarado acima de updateTerrainChunkGeometry)
// e interpola bilinearmente. Objetos e colisão assentam no que é DESENHADO, não no
// pico contínuo sub-amostrado — elimina o "float" de ~7-9 m nos cumes agudos das
// serras (WS-1 / bug aero-inhauma-invisible-mountains).
export function inhaumaVisualSurfaceHeight(x, z) {
  const x0 = Math.floor(x / TERR_STEP) * TERR_STEP;
  const z0 = Math.floor(z / TERR_STEP) * TERR_STEP;
  const tx = (x - x0) / TERR_STEP;
  const tz = (z - z0) / TERR_STEP;
  const h00 = inhaumaContinuousHeight(x0, z0);
  const h10 = inhaumaContinuousHeight(x0 + TERR_STEP, z0);
  const h01 = inhaumaContinuousHeight(x0, z0 + TERR_STEP);
  const h11 = inhaumaContinuousHeight(x0 + TERR_STEP, z0 + TERR_STEP);
  const h0 = h00 + (h10 - h00) * tx;
  const h1 = h01 + (h11 - h01) * tx;
  return h0 + (h1 - h0) * tz;
}

/** Height-fn registrada (assinatura compatível com world.js: (isl, dx, dz)).
 *  Usa a superfície RENDERIZADA para grounding/colisão casarem com o mesh visível. */
export function inhaumaHeightAt(isl, dx, dz) {
  return inhaumaVisualSurfaceHeight(isl.cx + dx, isl.cz + dz);
}

// ─── Água (rio), animada ──────────────────────────────────────────────────────
// T-09 DEVIATION: o lago reflexivo do reservatório (examples/jsm Water) foi removido
// daqui junto com a represa — ver a nota de DAM/RESERVOIR mais acima. O rio (T-05)
// continua normalmente: shader de fluxo compartilhado (environment/water-surface.js
// — reutilizável pelos outros mapas).
// T-V-15 (inhauma-visual-uplift-v1, auditoria §2.5): o render em "escada" de ~30
// planos separados de 280 m (largura fixa, costuras visíveis, ~20-40 draw calls) foi
// substituído por UM ribbon contínuo + fita de margem (2 draw calls) — ver
// maps/inhauma-river-ribbon.js. O traçado/entalhe do rio (inhauma-river.js) não muda.
export function buildInhaumaWater(scene) {
  const river = buildInhaumaRiver(scene, inhaumaContinuousHeight);
  buildRiverRocks(scene);
  return river;
}

// 2026-08-11 (operador: "trabalhe melhor nos rios"): pedras de margem — um
// InstancedMesh de icosaedros low-poly semeado ao longo do traçado real, nas
// duas margens, fora das zonas de ponte. Jitter por HASH do índice (não consome
// o stream do game.rng — determinístico e imune a reordenação de builders).
function buildRiverRocks(scene) {
  const poly = getInhaumaRiverPolyline();
  if (!poly || poly.length < 4) return null;
  const crossings = computeInhaumaBridgeCrossings();
  const h = (i, k) => {
    const s = Math.sin(i * 127.1 + k * 311.7) * 43758.5453;
    return s - Math.floor(s); // [0,1) estável
  };
  const mats = [];
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new THREE.Vector3();
  for (let i = 1; i < poly.length - 1; i += 1) {
    const p = poly[i];
    if (Math.abs(p.x) > 2600 || Math.abs(p.z) > 2600) continue;
    if (crossings.some((c) => Math.hypot(p.x - c.midX, p.z - c.midZ) < c.halfLength + 26)) continue;
    const q = poly[i + 1];
    const len = Math.hypot(q.x - p.x, q.z - p.z) || 1;
    const nx = -(q.z - p.z) / len, nz = (q.x - p.x) / len; // normal lateral
    for (const side of [-1, 1]) {
      const n = Math.floor(h(i, side) * 3); // 0-2 pedras por lado
      for (let k = 0; k < n; k++) {
        const lat = RIVER_HALF_WIDTH_M + 3 + h(i, side * 10 + k) * 16;
        const along = (h(i, side * 20 + k) - 0.5) * len;
        const x = p.x + nx * lat * side + ((q.x - p.x) / len) * along;
        const z = p.z + nz * lat * side + ((q.z - p.z) / len) * along;
        const y = riverBankHeightAt(x, z);
        if (!Number.isFinite(y)) continue;
        const sc = 0.9 + h(i, side * 30 + k) * 2.6;
        _e.set(h(i, 41 + k) * Math.PI, h(i, 43 + k) * Math.PI * 2, h(i, 47 + k) * Math.PI);
        _q.setFromEuler(_e);
        _s.set(sc, sc * (0.6 + h(i, 53 + k) * 0.5), sc);
        _m.compose(new THREE.Vector3(x, y - 0.4, z), _q, _s);
        mats.push(_m.clone());
      }
    }
  }
  if (!mats.length) return null;
  const inst = new THREE.InstancedMesh(
    new THREE.IcosahedronGeometry(1, 0),
    smat(0x8d8a80, { roughness: 0.95 }),
    mats.length,
  );
  for (let i = 0; i < mats.length; i++) inst.setMatrixAt(i, mats[i]);
  inst.instanceMatrix.needsUpdate = true;
  inst.castShadow = false;
  inst.receiveShadow = true;
  scene.add(inst);
  return inst;
}

// ─── Barragem (represa) — RECONSTRUÍDA sobre o canal REAL (2026-08-11) ────────
// A deviation T-09 aposentou a represa herdada da era FBM porque ela flutuava
// 400-700 m longe do rio real. O operador ordenou o retorno ("uma represa de
// água") — esta é a opção (a) daquela nota: sítio ESCOLHIDO EM RUNTIME sobre a
// polilinha do rio (drenagem do DEM), longe de pontes e da usina, com muro no
// canal, vertedouro, torres de controle e lago de reservatório a montante
// (shader de fluxo compartilhado — mesmo material do rio). Níveis d'água vêm
// da API do rio (riverBankHeightAt/riverWaterLevelAt) — nada digitado à mão.
export function buildDam(scene) {
  const poly = getInhaumaRiverPolyline();
  if (!poly || poly.length < 8) return null;
  const crossings = computeInhaumaBridgeCrossings();
  const NUKE_PLANT = { x: 620, z: 640 };
  // Sítio: varre o trecho central da polilinha e pega o 1º ponto ≥260 m de
  // qualquer ponte, ≥320 m da usina e dentro do foco jogável (|x|,|z| ≤ 2400).
  let site = null, dir = null;
  for (let i = Math.floor(poly.length * 0.30); i < Math.floor(poly.length * 0.80); i++) {
    const p = poly[i], q = poly[i + 1];
    if (!q) break;
    if (Math.abs(p.x) > 2400 || Math.abs(p.z) > 2400) continue;
    if (Math.hypot(p.x - NUKE_PLANT.x, p.z - NUKE_PLANT.z) < 320) continue;
    if (crossings.some((c) => Math.hypot(p.x - c.midX, p.z - c.midZ) < 260)) continue;
    site = p;
    const len = Math.hypot(q.x - p.x, q.z - p.z) || 1;
    dir = { x: (q.x - p.x) / len, z: (q.z - p.z) / len }; // sentido do fluxo
    break;
  }
  if (!site) return null;
  const perp = { x: -dir.z, z: dir.x };
  const bank = riverBankHeightAt(site.x, site.z);
  const water = riverWaterLevelAt(site.x, site.z) ?? bank - 1.5;
  const bedY = water - RIVER_CARVE_DEPTH_M - 2;
  const crestY = bank + 14;                 // crista acima das margens
  const wallH = crestY - bedY;
  const wallLen = RIVER_HALF_WIDTH_M * 2 + 56; // canal + ancoragem nas margens
  const yaw = Math.atan2(perp.x, perp.z);

  const g = new THREE.Group();
  const concrete = smat(0xb9b6ad, { roughness: 0.9 });
  const darkConcrete = smat(0x8e8b83, { roughness: 0.95 });

  // Muro de gravidade: 3 segmentos em arco suave abrindo para a jusante.
  for (const [off, bow] of [[-wallLen / 3, 4], [0, 0], [wallLen / 3, 4]]) {
    const seg = new THREE.Mesh(new THREE.BoxGeometry(wallLen / 3 + 2, wallH, 12), concrete);
    seg.position.set(
      site.x + perp.x * off + dir.x * bow,
      bedY + wallH / 2,
      site.z + perp.z * off + dir.z * bow,
    );
    seg.rotation.y = yaw;
    seg.receiveShadow = true;
    g.add(seg);
  }
  registerStructure('represa-inhauma', site.x, site.z, wallLen / 2, 14, crestY, { charRoot: g });

  // Vertedouro central (calha rebaixada) + espuma na base a jusante.
  const spill = new THREE.Mesh(new THREE.BoxGeometry(18, wallH * 0.55, 13.5), darkConcrete);
  spill.position.set(site.x, bedY + wallH * 0.275, site.z);
  spill.rotation.y = yaw;
  g.add(spill);
  const foam = new THREE.Mesh(
    new THREE.CircleGeometry(14, 16),
    new THREE.MeshBasicMaterial({ color: 0xe8f4f8, transparent: true, opacity: 0.55 }),
  );
  foam.rotation.x = -Math.PI / 2;
  foam.position.set(site.x + dir.x * 16, water - 1.2, site.z + dir.z * 16);
  g.add(foam);

  // Torres de controle nas ombreiras.
  for (const s of [-1, 1]) {
    const tx = site.x + perp.x * (wallLen / 2 - 6);
    const tz = site.z + perp.z * (wallLen / 2 - 6);
    const x = s === 1 ? tx : site.x - perp.x * (wallLen / 2 - 6);
    const z = s === 1 ? tz : site.z - perp.z * (wallLen / 2 - 6);
    const tower = new THREE.Mesh(new THREE.CylinderGeometry(4, 4.6, 12, 10), concrete);
    tower.position.set(x, crestY + 6, z);
    g.add(tower);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(5, 3, 10), darkConcrete);
    roof.position.set(x, crestY + 13.5, z);
    g.add(roof);
    registerStructure(`torre-represa-${s}`, x, z, 5, 5, crestY + 15, { charRoot: tower });
  }

  // Lago do reservatório A MONTANTE: elipse alongada no eixo do fluxo, lâmina
  // um pouco acima do nível natural (a barragem "encheu" o vale). Água
  // REFLEXIVA (jsm Water) — o único lago do mapa, uso previsto pelo módulo
  // compartilhado (o passe de reflexo já é throttled/distância-gated lá).
  // Geometria em XY: createReflectiveWater aplica o flip -90°; a orientação
  // in-plane (eixo do fluxo) entra como rotateZ ANTES do flip. Browser-only:
  // o jsm Water toca `document` (canvas de normais) — em Node (sims/validador)
  // a represa existe sem lâmina, e o teste valida sítio/estruturas.
  if (typeof document !== 'undefined') {
    const lakeGeom = new THREE.CircleGeometry(85, 28);
    lakeGeom.scale(1.0, 1.7, 1);
    lakeGeom.rotateZ(-yaw);
    const lake = createReflectiveWater(lakeGeom, {});
    lake.position.set(site.x - dir.x * 120, water + 3.2, site.z - dir.z * 120);
    g.add(lake);
  }

  scene.add(g);
  return { group: g, site: { x: site.x, z: site.z }, crestY, waterY: water + 3.2 };
}

// ─── Usina nuclear (torres de resfriamento + cúpula + vapor) ──────────────────
export function buildNuclearPlant(scene) {
  const px = 620, pz = 640; // a jusante, perto do rio
  const baseY = inhaumaContinuousHeight(px, pz);
  const g = new THREE.Group();
  const towerMat = smat(0xd8d8d2, { roughness: 0.85 });
  const steamEmitters = [];

  // 2 torres hiperbólicas (perfil estreitado no meio via LatheGeometry)
  for (const ox of [-55, 55]) {
    const pts = [];
    for (let i = 0; i <= 10; i++) {
      const t = i / 10;
      const r = 34 - Math.sin(t * Math.PI) * 13;   // cintura estreita
      pts.push(new THREE.Vector2(r, t * 70));
    }
    const tower = new THREE.Mesh(new THREE.LatheGeometry(pts, 24), towerMat);
    tower.position.set(px + ox, baseY, pz);
    tower.castShadow = false; tower.receiveShadow = true;
    g.add(tower);
    registerStructure(`torre-resfriamento-${ox}`, px + ox, pz, 34, 34, baseY + 70, { charRoot: tower });
    steamEmitters.push({ x: px + ox, y: baseY + 70, z: pz });
  }
  // Cúpula do reator
  const dome = new THREE.Mesh(new THREE.SphereGeometry(20, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2), smat(0xcfd3d6, { metalness: 0.3, roughness: 0.5 }));
  dome.position.set(px, baseY, pz - 80); g.add(dome);
  registerStructure('cupula-reator-inhauma', px, pz - 80, 24, 24, baseY + 22, { charRoot: dome });
  const reactorBase = new THREE.Mesh(new THREE.CylinderGeometry(22, 22, 14, 16), towerMat);
  reactorBase.position.set(px, baseY + 7, pz - 80); g.add(reactorBase);
  // Prédios auxiliares
  for (const [bx, bz, w] of [[px - 90, pz - 30, 30], [px + 95, pz - 40, 26], [px, pz + 70, 40]]) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, 16, w * 0.7), smat(0x9aa0a6));
    b.position.set(bx, baseY + 8, bz); b.castShadow = false; g.add(b);
    registerStructure('predio-usina-inhauma', bx, bz, w / 2, w * 0.35, baseY + 16, { charRoot: b });
  }
  scene.add(g);
  return { group: g, steamEmitters };
}

// ─── Fábricas (zona industrial + chaminés) ───────────────────────────────────
export function buildFactories(scene) {
  // 2026-08-11 (operador): parque industrial AO REDOR DA USINA nuclear — 3 zonas
  // novas anelando (620,640) além das 3 legadas. Guarda de rio: zona a <70 m do
  // canal real é descartada (a usina fica "perto do rio" de propósito; galpão
  // dentro d'água não).
  const zones = [
    [1180, -260], [1080, -120], [-820, 300],
    [800, 520], [460, 830], [830, 760],
  ].filter(([zx, zz]) => distanceToRiver(zx, zz) > 70 && !nearAnyRoad(zx, zz, 42));
  const smoke = [];
  const g = new THREE.Group();
  for (const [zx, zz] of zones) {
    const by = inhaumaContinuousHeight(zx, zz);
    const shed = new THREE.Mesh(new THREE.BoxGeometry(70, 22, 44), smat(0x7d7468));
    shed.position.set(zx, by + 11, zz); shed.castShadow = false; g.add(shed);
    registerStructure('fabrica-inhauma', zx, zz, 35, 22, by + 24, { charRoot: shed });
    const roof = new THREE.Mesh(new THREE.BoxGeometry(74, 3, 48), smat(0x4a4640));
    roof.position.set(zx, by + 23, zz); g.add(roof);
    for (let i = -1; i <= 1; i++) {
      const ch = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 4, 30, 10), smat(0x8a3b2a));
      ch.position.set(zx + i * 14, by + 30, zz - 16); ch.castShadow = false; g.add(ch);
      registerStructure('chamine-inhauma', zx + i * 14, zz - 16, 5, 5, by + 45, { charRoot: ch });
      smoke.push({ x: zx + i * 14, y: by + 46, z: zz - 16 });
    }
    // tanques
    for (const [tx, tz] of [[zx - 44, zz + 10], [zx - 44, zz - 14]]) {
      const tank = new THREE.Mesh(new THREE.CylinderGeometry(9, 9, 16, 14), smat(0xc8ccce, { metalness: 0.3 }));
      tank.position.set(tx, by + 8, tz); g.add(tank);
      registerStructure('tanque-industrial-inhauma', tx, tz, 10, 10, by + 16, { charRoot: tank });
    }
  }
  scene.add(g);
  return { group: g, smoke };
}

// ─── Florestas (árvores instanciadas por cota + inclinação + proximidade do rio) ──
// Fichas de árvore em coords de mundo — exposto para a nuke/firestorm (WS-5/T-N-03).
// Cada item: {x, y, z, crown?, trunk?, ci?} — crown/trunk são os InstancedMesh da
// espécie e ci o índice da instância (ponteiros de carbonização, preenchidos ao
// fim de buildForests; ausentes se buildForests ainda não rodou).
export const inhaumaTrees = [];

// T-08 (AC-05): linha de árvore ABAIXO da linha de neve (SNOW_LINE_M=800, T-07) — em
// ~48% do pico do DEM (1281 m), dentro da faixa 45-55% pedida pela release. Acima
// dela, o biome já lê rocha/alpino (T-07) mesmo sem nenhuma árvore ali.
const TREE_LINE_M = 620;
// Inclinação máxima (dh/dm, mesma unidade de demSlopeAt) — ~31°, dentro da faixa
// 30-35° pedida. Encostas mais íngremes que isso não sustentam mata fechada.
const MAX_TREE_SLOPE = 0.6;
// Reforço de densidade perto do rio (AC-05) — dentro deste raio da polilinha
// derivada da drenagem (T-05), a probabilidade de aceitar o candidato sobe.
const RIVER_DENSITY_BOOST_RADIUS_M = 220;
const RIVER_DENSITY_BOOST_MULT = 1.6;

// T-08/T-09: zona reservada da "prateleira" de vale onde a cidade terraceada (T-09)
// vai ficar — perto do aeroporto e ao longo do piso do vale, entre a origem e o
// aeródromo (-560,320). Compartilhada com buildTown (T-09) para as duas tarefas
// concordarem sobre onde NÃO plantar árvore / onde construir. Retângulo generoso de
// propósito (mais barato manter árvore fora de mais terreno do que arriscar overlap).
// T-C-05: exportada — exclusão DURA das formações da campanha (formation.js).
export const TOWN_SHELF = { minX: -650, maxX: 150, minZ: -60, maxZ: 560 };
function insideTownShelf(x, z) {
  return x >= TOWN_SHELF.minX && x <= TOWN_SHELF.maxX && z >= TOWN_SHELF.minZ && z <= TOWN_SHELF.maxZ;
}

// Espécies de árvore (WS-3): geometrias/cores distintas por banda de altitude, cada uma
// um par de InstancedMesh (tronco+copa) com jitter de cor por instância. Copa usa base
// branca (lmat(0xffffff)) × instanceColor para a cor sair exata (padrão buildTown).
// T-08: bandas remapeadas para o novo regime de altitude do DEM (pico ~1281 m, no
// lugar dos ~140 m da era FBM) — espécie de vale (baixa cota) → subalpina perto da
// linha de árvore (cota alta), como a release pediu.
const TREE_SPECIES = [
  // key,       band,       trunk[rTop,rBot,h,seg]|null, trunkCol,  crown['cone'|'ico'|'sphere', ...args], crownCol,   sMin,sMax
  { key: 'pine',      band: [70, 420],        trunk: [0.5, 0.8, 7, 5], trunkCol: 0x4a3520, crown: ['cone', 2.4, 11, 6], crownCol: 0x1f4d1c, sMin: 0.8, sMax: 1.6 },
  { key: 'broadleaf', band: [10, 110],        trunk: [0.9, 1.2, 4, 6], trunkCol: 0x5b3f2a, crown: ['ico', 3.6],         crownCol: 0x3a7a2f, sMin: 0.8, sMax: 1.7 },
  { key: 'bush',      band: [7, 60],          trunk: null,             trunkCol: 0,        crown: ['sphere', 2.4, 7, 5], crownCol: 0x5a7a30, sMin: 0.7, sMax: 1.3 },
  { key: 'dry',       band: [300, TREE_LINE_M], trunk: [0.5, 0.9, 6, 5], trunkCol: 0x6a5a3a, crown: ['cone', 2.4, 7, 6],  crownCol: 0x8a7a40, sMin: 0.7, sMax: 1.2 },
];

// T-V-14: copas COMPOSTAS — 2-3 primitivas deslocadas/escaladas mescladas em UMA
// geometria via BufferGeometryUtils.mergeGeometries (padrão world.js#makeCloudGeometry).
// Continua 1 InstancedMesh por espécie (buildForests mantém exatamente 7 draw calls —
// invariante medido por inhauma-fidelity.spec.js) e cada copa ≤ ~110 tris.
function makeCrownGeo(spec) {
  const c = spec.crown;
  const parts = [];
  if (c[0] === 'cone') {
    // Conífera/seca: cone principal + cone médio empilhado (pinheiro ganha uma 3ª
    // camada alta — silhueta em degraus típica de conífera).
    parts.push(new THREE.ConeGeometry(c[1], c[2], c[3]));
    const mid = new THREE.ConeGeometry(c[1] * 0.68, c[2] * 0.62, c[3]);
    mid.translate(c[1] * 0.12, c[2] * 0.42, -c[1] * 0.08);
    parts.push(mid);
    if (spec.key === 'pine') {
      const top = new THREE.ConeGeometry(c[1] * 0.42, c[2] * 0.45, c[3]);
      top.translate(-c[1] * 0.06, c[2] * 0.78, c[1] * 0.10);
      parts.push(top);
    }
  } else if (c[0] === 'ico') {
    // Broadleaf: copa principal + 2 "braços" icosaédricos deslocados (copa irregular).
    parts.push(new THREE.IcosahedronGeometry(c[1], 0));
    const armA = new THREE.IcosahedronGeometry(c[1] * 0.62, 0);
    armA.translate(c[1] * 0.55, c[1] * 0.35, c[1] * 0.20);
    parts.push(armA);
    const armB = new THREE.IcosahedronGeometry(c[1] * 0.50, 0);
    armB.translate(-c[1] * 0.50, c[1] * 0.18, -c[1] * 0.30);
    parts.push(armB);
  } else {
    // Bush: 2 esferas sobrepostas (segmentos reduzidos na secundária).
    parts.push(new THREE.SphereGeometry(c[1], c[2], c[3]));
    const s2 = new THREE.SphereGeometry(c[1] * 0.62, 6, 4);
    s2.translate(c[1] * 0.50, c[1] * 0.28, c[1] * 0.15);
    parts.push(s2);
  }
  const merged = mergeGeometries(parts, false);
  for (const p of parts) p.dispose();
  return merged;
}

// Candidatos sorteados antes dos filtros — calibrado empiricamente (ver relatório de
// T-08) para o total PLANTADO ficar na mesma ordem de grandeza de antes (~1500-2500,
// WS-3/perf) mesmo com a linha de árvore muito mais alta (620 m vs 70 m da era FBM).
//
// BUG FIX (auto-sortie takeoff regression): buildForests() never had a HEADLESS
// budget, unlike every sibling decorative-density system in this codebase (world.js
// ocean/cloud segment counts, nuclear-fx.js sphere segment counts, prop-fire.js/
// fx.js headless FX skip). ~1500-2500 individually-instanced trees (crown+trunk,
// ~44-55% of the whole inhauma scene's triangle count — profiled: this InstancedMesh
// pair set alone accounted for ~137k of ~311k triangles/frame) collapsed headless
// SwiftShader frame rate to ~2.5 fps regardless of game state (menu, flight, ground
// taxi — profiled uniformly slow). A pure-Node replay of the taxi_runway→line_up→
// takeoff state-machine leg (taxi-core.js/ground-physics.js, fixed dt=1/60, i.e. NO
// rendering at all) needs only ~16 simulated seconds — well inside the spec's 40s
// budget — proving the GAME LOGIC was never the problem; the render cost alone
// starved the test of wall-clock time to reach that many simulated seconds. HEADLESS
// (`navigator.webdriver`) is `false` in Node (no `navigator` global there), so
// test-aero-sim.js's `inhaumaTrees.length` 1500-2500 assertion and
// test-aero-cachoeira.mjs's >500 assertion keep seeing the FULL density; only real
// Playwright/CI browser runs get the reduced budget. inhauma-fidelity.spec.js's
// renderer-budget assertions are upper-bound-only (`toBeLessThan`), so a lower
// headless triangle count cannot regress them.
const FOREST_CANDIDATE_COUNT = HEADLESS ? 220 : 2800;

export function buildForests(scene) {
  inhaumaTrees.length = 0;
  const buckets = TREE_SPECIES.map(() => []);
  for (let i = 0; i < FOREST_CANDIDATE_COUNT; i++) {
    const range = TERR.chunkSize * 1.35;
    const x = game.rng.range(-range, range);
    const z = game.rng.range(-range, range);
    const h = inhaumaContinuousHeight(x, z);
    if (h < WATER_LEVEL + 3 || h > TREE_LINE_M) continue;      // sem árvore na água ou acima da linha de árvore
    if (demSlopeAt(x, z) > MAX_TREE_SLOPE) continue;            // sem mata fechada em encosta muito íngreme
    if (Math.abs(x + 560) < 360 && Math.abs(z - 320) < 360) continue; // longe do aeroporto
    if (insideTownShelf(x, z)) continue;                        // longe da prateleira da cidade (T-09)
    if (insideCachoeiraShelf(x, z)) continue;                   // longe da prateleira de Cachoeira (T-C-04)
    // T-D-01: sem árvore no topo do morro da bateria — a visada do artilheiro
    // (horizonte em 2 direções + horda no vale) fica desobstruída.
    if (Math.hypot(x - AA_DEFENSE.HILL_POS.x, z - AA_DEFENSE.HILL_POS.z) < AA_DEFENSE.HILL_FOREST_KEEPOUT_M) continue;
    const riverDist = distanceToRiver(x, z);
    if (riverDist < RIVER_HALF_WIDTH_M + 10) continue;          // nunca dentro do canal/margem molhada
    if (nearAnyRoad(x, z, 14)) continue;                        // sem árvore sobre a rodovia
    // Densidade base por cota (mais fechada na mata alta) + reforço perto do rio
    // (AC-05) — encostas ribeirinhas retêm mais umidade, mata mais densa.
    let density = h > 22 ? 0.85 : 0.35;
    if (riverDist < RIVER_DENSITY_BOOST_RADIUS_M) density = Math.min(0.97, density * RIVER_DENSITY_BOOST_MULT);
    if (game.rng.random() > density) continue;
    // Escolhe espécie pela banda de altitude; ~12% viram árvore seca/subalpina espalhada.
    const candidates = [];
    for (let s = 0; s < TREE_SPECIES.length; s++) {
      const [lo, hi] = TREE_SPECIES[s].band;
      if (h >= lo && h <= hi) candidates.push(s);
    }
    if (!candidates.length) continue;
    let si = candidates[Math.floor(game.rng.random() * candidates.length)];
    if (game.rng.random() < 0.12) si = 3; // dry
    const sc = game.rng.range(TREE_SPECIES[si].sMin, TREE_SPECIES[si].sMax);
    // T-N-03: rec é a ficha pública da árvore (inhaumaTrees); após os meshes
    // instanciados serem criados ela ganha os ponteiros de carbonização
    // (crown/trunk InstancedMesh + índice de instância ci) para o firestorm.
    const rec = { x, y: h, z };
    inhaumaTrees.push(rec);
    buckets[si].push({ x, y: h, z, s: sc, rec });
  }
  const dummy = new THREE.Object3D();
  const col = new THREE.Color();
  const meshes = [];
  TREE_SPECIES.forEach((spec, si) => {
    const items = buckets[si];
    if (!items.length) return;
    const crownMesh = new THREE.InstancedMesh(makeCrownGeo(spec), lmat(0xffffff), items.length);
    crownMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(items.length * 3), 3);
    crownMesh.frustumCulled = false; crownMesh.castShadow = false;
    let trunkMesh = null, trunkH = 0;
    if (spec.trunk) {
      trunkH = spec.trunk[2];
      trunkMesh = new THREE.InstancedMesh(new THREE.CylinderGeometry(spec.trunk[0], spec.trunk[1], spec.trunk[2], spec.trunk[3]), lmat(spec.trunkCol), items.length);
      trunkMesh.frustumCulled = false; trunkMesh.castShadow = false;
    }
    items.forEach((t, i) => {
      // T-N-03: ponteiros de carbonização na ficha pública da árvore.
      t.rec.crown = crownMesh; t.rec.ci = i;
      if (trunkMesh) t.rec.trunk = trunkMesh;
      if (trunkMesh) {
        dummy.position.set(t.x, t.y + trunkH * 0.5 * t.s, t.z);
        dummy.scale.set(t.s, t.s, t.s); dummy.rotation.set(0, 0, 0);
        dummy.updateMatrix(); trunkMesh.setMatrixAt(i, dummy.matrix);
      }
      const crownY = t.y + (spec.trunk ? trunkH * 0.9 : spec.crown[1] * 0.7) * t.s;
      // T-V-14: tilt leve + escala não-uniforme por instância (rng semeado, sorteio
      // só nesta etapa — posições de plantio e a sequência de rng dos filtros acima
      // ficam inalteradas). Quebra a silhueta "clone" sem mover a árvore do lugar.
      dummy.position.set(t.x, crownY, t.z);
      dummy.scale.set(
        t.s * game.rng.range(0.88, 1.18),
        t.s * game.rng.range(0.92, 1.12),
        t.s * game.rng.range(0.88, 1.18),
      );
      dummy.rotation.set(
        game.rng.range(-0.06, 0.06),
        (t.x * 0.7 + t.z * 0.3) % Math.PI,
        game.rng.range(-0.06, 0.06),
      );
      dummy.updateMatrix(); crownMesh.setMatrixAt(i, dummy.matrix);
      // Jitter de luminância por instância — mata o look de "clone".
      col.setHex(spec.crownCol);
      const j = game.rng.range(0.82, 1.16);
      crownMesh.instanceColor.setXYZ(i, Math.min(1, col.r * j), Math.min(1, col.g * j), Math.min(1, col.b * j));
    });
    if (trunkMesh) { scene.add(trunkMesh); meshes.push(trunkMesh); }
    scene.add(crownMesh); meshes.push(crownMesh);
  });
  return meshes.length ? { meshes } : null;
}

// ─── Cidade (downtown terraceado na prateleira do vale + igreja + campos + praça) ──
// T-09 (AC-07): relocada da grade plana na origem para a PRATELEIRA DE VALE perto do
// aeroporto (-560,320) — dentro do mesmo TOWN_SHELF que T-08 já reserva para
// buildForests não plantar árvore ali. Downtown fica na parte mais plana da
// prateleira (perto da origem, sul do aeroporto); a densidade afina conforme a
// inclinação sobe em direção ao aeroporto/serra (AC-07: "mais densa perto da
// prateleira mais plana, afinando morro acima"). Terraceamento: cada quarteirão
// amostra os 4 cantos do próprio footprint via inhaumaContinuousHeight e assenta
// numa base NIVELADA (média dos cantos) levemente AFUNDADA — sugere um pequeno corte
// de terraço sem precisar de uma malha de muro de arrimo separada (a release aceita
// explicitamente essa abordagem: "small retaining-wall look via slightly sunken
// bases is fine").
const DOWNTOWN_CENTER = { x: -370, z: -20 };
const DOWNTOWN_RADIUS_M = 160;
const CHURCH = { x: -330, z: -40 };
const CHURCH_TOWER = { x: -330, z: -70 };
const FIELDS = [{ x: -410, z: -60 }, { x: -250, z: -40 }];
const PLAZA = { x: -390, z: 0 };
// Raio da clareira REAL do aeroporto (~140 m, landing-zones.js#airportClearingFactor)
// + folga de meio-quarteirão — mais justo que o box de 360 m que buildForests usa
// (aquele existe para manter árvore/pouso longe da pista com folga generosa; um
// prédio só precisa ficar fora da clareira nivelada em si).
const AIRPORT_CENTER = { x: -560, z: 320 };
const AIRPORT_TOWN_KEEPOUT_M = 220;

function nearAnyLandmark(x, z) {
  if (Math.hypot(x - CHURCH.x, z - CHURCH.z) < 55) return true;
  if (Math.hypot(x - CHURCH_TOWER.x, z - CHURCH_TOWER.z) < 30) return true;
  if (Math.hypot(x - PLAZA.x, z - PLAZA.z) < 48) return true;
  for (const f of FIELDS) if (Math.hypot(x - f.x, z - f.z) < 75) return true;
  return false;
}

// T-C-04: o placement dos quarteirões (grade + keep-outs + terraceamento) vive em
// buildTownCluster (inhauma-city.js) — mesma ordem de checagens e mesmo consumo de
// rng do loop histórico que ficava aqui, então a saída de Inhaúma não muda.
export function buildTown(scene) {
  const g = new THREE.Group();
  const blocks = buildTownCluster({
    shelf: TOWN_SHELF, stepX: 30, stepZ: 26,
    typology: makeInhaumaTypology(DOWNTOWN_CENTER, DOWNTOWN_RADIUS_M),
    // T-D-01: keep-out do morro da bateria — nenhum quarteirão no topo/encosta
    // íngreme (hoje o shelf nem alcança a base; a trava protege crescimentos).
    circles: [
      { x: AIRPORT_CENTER.x, z: AIRPORT_CENTER.z, r: AIRPORT_TOWN_KEEPOUT_M },
      { x: AA_DEFENSE.HILL_POS.x, z: AA_DEFENSE.HILL_POS.z, r: AA_DEFENSE.HILL_TOWN_KEEPOUT_M },
    ],
    keepOut: nearAnyLandmark,
    deps: {
      rng: game.rng, heightAt: inhaumaContinuousHeight, slopeAt: demSlopeAt,
      nearRoad: nearAnyRoad, riverDist: distanceToRiver,
      riverKeepOut: RIVER_HALF_WIDTH_M + 15, minH: WATER_LEVEL + 1,
      registerStructure, structureId: 'predio-inhauma',
    },
  });
  // T-V-12/T-V-13: a cidade virou batches instanciados por tipologia (low/mid/torre
  // com setback + telhados de 2 águas) com textura canvas de janelas, emissiveMap
  // noturno e castShadow — era UM InstancedMesh de BoxGeometry(1,1,1) liso em 2 cores.
  g.add(buildCityMeshes(blocks));

  // Igreja (corpo + torre + pináculo) — reposicionada perto do novo downtown (T-09).
  const ghCh = inhaumaContinuousHeight(CHURCH.x, CHURCH.z);
  const church = new THREE.Mesh(new THREE.BoxGeometry(32, 14, 46), lmat(0xece3c8));
  church.position.set(CHURCH.x, ghCh + 7, CHURCH.z); g.add(church);
  registerStructure('igreja-inhauma', CHURCH.x, CHURCH.z, 16, 23, ghCh + 14, { charRoot: church });
  const ghTower = inhaumaContinuousHeight(CHURCH_TOWER.x, CHURCH_TOWER.z);
  const tower = new THREE.Mesh(new THREE.BoxGeometry(12, 22, 12), lmat(0xe2d8b8));
  tower.position.set(CHURCH_TOWER.x, ghTower + 11, CHURCH_TOWER.z); g.add(tower);
  registerStructure('torre-igreja-inhauma', CHURCH_TOWER.x, CHURCH_TOWER.z, 6, 6, ghTower + 29, { charRoot: tower });
  const spire = new THREE.Mesh(new THREE.ConeGeometry(8, 14, 4), lmat(0xb04a30));
  spire.position.set(CHURCH_TOWER.x, ghTower + 29, CHURCH_TOWER.z); spire.rotation.y = Math.PI / 4; g.add(spire);

  // Campos de futebol (gramado + linhas + gols) — repositionados na prateleira (T-09).
  for (const { x: fx, z: fz } of FIELDS) {
    const fy = inhaumaContinuousHeight(fx, fz) + 0.3;
    const field = new THREE.Mesh(new THREE.PlaneGeometry(105, 68), lmat(0x2f8c3a));
    field.rotation.x = -Math.PI / 2; field.position.set(fx, fy, fz); g.add(field);
    for (const gx of [-50, 50]) {
      const goal = new THREE.Mesh(new THREE.BoxGeometry(2, 5, 14), lmat(0xffffff));
      goal.position.set(fx + gx, fy + 2.5, fz); g.add(goal);
    }
  }
  // Praça central — repositionada junto ao novo downtown (T-09).
  const plazaY = inhaumaContinuousHeight(PLAZA.x, PLAZA.z) + 0.25;
  const plaza = new THREE.Mesh(new THREE.PlaneGeometry(64, 52), lmat(0x6f8d62));
  plaza.rotation.x = -Math.PI / 2; plaza.position.set(PLAZA.x, plazaY, PLAZA.z); g.add(plaza);

  // 2026-08-11 (operador: "torres, praças"): mobiliário urbano de Inhaúma —
  // coreto na praça, torre de rádio no downtown e 2 caixas d'água elevadas.
  // Coreto (base octogonal + colunas + telhado cônico) no centro da praça.
  const coretoBase = new THREE.Mesh(new THREE.CylinderGeometry(7, 7.5, 1.2, 8), lmat(0xcabfa4));
  coretoBase.position.set(PLAZA.x, plazaY + 0.6, PLAZA.z); g.add(coretoBase);
  for (let ci = 0; ci < 6; ci++) {
    const a = (ci / 6) * Math.PI * 2;
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 4.2, 6), lmat(0xf0e8d2));
    col.position.set(PLAZA.x + Math.cos(a) * 5.4, plazaY + 3.2, PLAZA.z + Math.sin(a) * 5.4);
    g.add(col);
  }
  const coretoRoof = new THREE.Mesh(new THREE.ConeGeometry(8.2, 3.4, 8), lmat(0x9c4a32));
  coretoRoof.position.set(PLAZA.x, plazaY + 7.0, PLAZA.z); g.add(coretoRoof);
  registerStructure('coreto-inhauma', PLAZA.x, PLAZA.z, 8, 8, plazaY + 8.7, { charRoot: coretoBase });

  // Torre de rádio treliçada no flanco do downtown (mastro + travessas + antena).
  const RADIO = { x: DOWNTOWN_CENTER.x + 96, z: DOWNTOWN_CENTER.z - 58 };
  const radioY = inhaumaContinuousHeight(RADIO.x, RADIO.z);
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 2.2, 46, 6), lmat(0xb8442e));
  mast.position.set(RADIO.x, radioY + 23, RADIO.z); g.add(mast);
  for (let s = 0; s < 4; s++) {
    const brace = new THREE.Mesh(new THREE.BoxGeometry(7 - s * 1.4, 0.5, 0.5), lmat(0xd8d8d8));
    brace.position.set(RADIO.x, radioY + 8 + s * 10, RADIO.z);
    brace.rotation.y = (s % 2) * Math.PI / 4;
    g.add(brace);
  }
  const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 10, 5), lmat(0xffffff));
  antenna.position.set(RADIO.x, radioY + 51, RADIO.z); g.add(antenna);
  registerStructure('torre-radio-inhauma', RADIO.x, RADIO.z, 4, 4, radioY + 56, { charRoot: mast });

  // Caixas d'água elevadas (tanque sobre pernas) perto dos campos.
  for (const [wi, wOff] of [[0, { x: 70, z: -34 }], [1, { x: -66, z: 26 }]]) {
    const wx = FIELDS[wi % FIELDS.length].x + wOff.x;
    const wz = FIELDS[wi % FIELDS.length].z + wOff.z;
    const wy = inhaumaContinuousHeight(wx, wz);
    const legs = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.6, 14, 6), lmat(0x8f8f8f));
    legs.position.set(wx, wy + 7, wz); g.add(legs);
    const tank = new THREE.Mesh(new THREE.CylinderGeometry(6, 6, 7, 12), lmat(0x74a8c4));
    tank.position.set(wx, wy + 17.5, wz); g.add(tank);
    const cap = new THREE.Mesh(new THREE.ConeGeometry(6.4, 2.2, 12), lmat(0x5c8399));
    cap.position.set(wx, wy + 22.1, wz); g.add(cap);
    registerStructure(`caixa-dagua-inhauma-${wi + 1}`, wx, wz, 7, 7, wy + 23, { charRoot: tank });
  }

  scene.add(g);
  return g;
}

// ─── Cachoeira da Prata — a segunda cidade, ocupada (T-C-04) ─────────────────
// Mesma pipeline de Inhaúma: buildTownCluster (placement) + buildCityMeshes
// (batches com fachada/telhado) + marcos (igrejinha + praça + ruas no padrão dos
// planos PLAZA/FIELDS de buildTown). O shelf é nivelado na cadeia de altura
// (CACHOEIRA_SHELF, nota no topo do arquivo) — as ruas/praça assentam planas.
const CACHOEIRA_STREET_W = 9; // largura das duas ruas centrais (asfalto)

export function buildCachoeira(scene) {
  const g = new THREE.Group();
  const blocks = buildTownCluster({
    shelf: CACHOEIRA_SHELF, stepX: 22, stepZ: 20,
    typology: makeCachoeiraTypology(CACHOEIRA_TOWN_CENTER),
    circles: [
      { x: CACHOEIRA_CHURCH.x, z: CACHOEIRA_CHURCH.z, r: 30 },
      { x: CACHOEIRA_PRACA.x, z: CACHOEIRA_PRACA.z, r: 26 },
    ],
    // Nenhum lote sobre as duas ruas centrais (mesmo traçado dos planos abaixo).
    keepOut: (x, z) => Math.abs(x - CACHOEIRA_TOWN_CENTER.x) < 8 || Math.abs(z - CACHOEIRA_PRACA.z) < 8,
    deps: {
      rng: game.rng, heightAt: inhaumaContinuousHeight, slopeAt: demSlopeAt,
      nearRoad: nearAnyRoad, riverDist: distanceToRiver,
      riverKeepOut: RIVER_HALF_WIDTH_M + 15, minH: WATER_LEVEL + 1,
      registerStructure, structureId: 'predio-cachoeira',
    },
  });
  g.add(buildCityMeshes(blocks));

  // Igrejinha (corpo + torre + pináculo — versão miúda da igreja de Inhaúma).
  const ghCh = inhaumaContinuousHeight(CACHOEIRA_CHURCH.x, CACHOEIRA_CHURCH.z);
  const church = new THREE.Mesh(new THREE.BoxGeometry(18, 8, 26), lmat(0xece3c8));
  church.position.set(CACHOEIRA_CHURCH.x, ghCh + 4, CACHOEIRA_CHURCH.z); g.add(church);
  registerStructure('igreja-cachoeira', CACHOEIRA_CHURCH.x, CACHOEIRA_CHURCH.z, 9, 13, ghCh + 8, { charRoot: church });
  const tower = new THREE.Mesh(new THREE.BoxGeometry(7, 14, 7), lmat(0xe2d8b8));
  tower.position.set(CACHOEIRA_CHURCH.x, ghCh + 7, CACHOEIRA_CHURCH.z - 17); g.add(tower);
  registerStructure('torre-igreja-cachoeira', CACHOEIRA_CHURCH.x, CACHOEIRA_CHURCH.z - 17, 3.5, 3.5, ghCh + 18, { charRoot: tower });
  const spire = new THREE.Mesh(new THREE.ConeGeometry(4.5, 8, 4), lmat(0xb04a30));
  spire.position.set(CACHOEIRA_CHURCH.x, ghCh + 18, CACHOEIRA_CHURCH.z - 17);
  spire.rotation.y = Math.PI / 4; g.add(spire);

  // Chão urbano: praça + duas ruas centrais cruzando o shelf (planos pavimentados,
  // mesma abordagem dos planos PLAZA/FIELDS de buildTown — leem como quarteirões).
  const pracaY = inhaumaContinuousHeight(CACHOEIRA_PRACA.x, CACHOEIRA_PRACA.z) + 0.22;
  const praca = new THREE.Mesh(new THREE.PlaneGeometry(40, 32), lmat(0x6f8d62));
  praca.rotation.x = -Math.PI / 2; praca.position.set(CACHOEIRA_PRACA.x, pracaY, CACHOEIRA_PRACA.z); g.add(praca);
  const streetMat = lmat(0x4a4a48);
  const cx = CACHOEIRA_TOWN_CENTER.x, cz = CACHOEIRA_TOWN_CENTER.z;
  const streetY = inhaumaContinuousHeight(cx, cz) + 0.18;
  const streetNS = new THREE.Mesh(
    new THREE.PlaneGeometry(CACHOEIRA_STREET_W, CACHOEIRA_SHELF.maxZ - CACHOEIRA_SHELF.minZ - 12), streetMat);
  streetNS.rotation.x = -Math.PI / 2; streetNS.position.set(cx, streetY, cz); g.add(streetNS);
  const streetEW = new THREE.Mesh(
    new THREE.PlaneGeometry(CACHOEIRA_SHELF.maxX - CACHOEIRA_SHELF.minX - 12, CACHOEIRA_STREET_W), streetMat);
  streetEW.rotation.x = -Math.PI / 2; streetEW.position.set(cx, streetY, CACHOEIRA_PRACA.z); g.add(streetEW);

  scene.add(g);
  return { group: g, blocks, center: CACHOEIRA_TOWN_CENTER };
}

// ─── Update (água + carros + vapor/fumaça + backdrop) ────────────────────────
export function updateInhaumaScene(dt, refs, playerPos) {
  updateInfiniteTerrain(playerPos, refs.terrain);
  // T-V-09: recentra o anel de montanhas no jogador e retinta pelo céu (dia/noite).
  if (refs.terrain?.backdrop) updateInhaumaBackdrop(refs.terrain.backdrop, playerPos);
  // T-V-12: janelas da cidade acendem à noite (mesmo nightFactor do sky.js).
  updateInhaumaCityLights(game.timeOfDay);
  // T-C-05: guarnição de ocupação de Cachoeira — patrulhas/colunas em movimento.
  if (refs.garrison) updateFormations(dt, refs.garrison.formations, refs.garrison.formationDeps);
  if (refs.water) updateWaterSurfaces(dt, _getSunData ? _getSunData().direction : undefined);
  if (refs.cars) {
    updateRoadTraffic(dt, refs.cars, inhaumaContinuousHeight);
    if (game.missionRealism?.inhaumaMap?.traffic) {
      game.missionRealism.inhaumaMap.traffic.active = refs.cars.diagnostics;
    }
  }
}
