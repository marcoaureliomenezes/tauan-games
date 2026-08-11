// maps/inhauma-defense.js — Mapa 'inhauma-defense': a MESMA cena de Inhaúma
// (terreno/rio/cidade/Cachoeira — mesmos builders de inhauma-scene.js, sem
// duplicar geometria), mas SEM a camada de voo: sem guarnição, sem campanha,
// sem guerra urbana e sem alvos legados. O gameplay do chão é do defense-mode.
// Exporta: createInhaumaDefenseWorld, updateInhaumaDefenseWorld, inhaumaHeightAt.
// Para ajustar a posição do soldado/câmera, edite AA_DEFENSE em config.js.

import * as THREE from '../../../vendor/three.module.min.js';
import { game } from '../state.js';
import {
  inhaumaContinuousHeight, inhaumaHeightAt, buildInhaumaTerrain,
  buildInhaumaWater, buildDam, buildNuclearPlant, buildFactories,
  buildForests, buildTown, buildCachoeira, updateInhaumaScene,
} from './inhauma-scene.js';
import { buildInhaumaRoadGraphAndTraffic } from './inhauma-road-render.js';

export { inhaumaHeightAt };

let _refs = null;

/** Cria a cena de Inhaúma para o modo defesa. Node-safe (sem áudio/FX/campanha):
 *  intencionalmente NÃO chama initCampaign/initCityWar/guarnição — o modo não
 *  toca game.targets nem inicia o loop de ondas legado (Onda D4 terá diretor
 *  próprio). */
export function createInhaumaDefenseWorld(scene) {
  // T-D-01 (nuke-firestorm-defense-v1): fog MAIS LONGO que o do mapa de voo
  // (900-2600) — do topo do morro (~250 m) o artilheiro precisa ver a horda se
  // formando na borda do vale (spawn a 2 km do LOOK_AT → até ~2890 m do soldado)
  // e os caças ingressando (2,3 km). near 1100 preserva a névoa de vale médio.
  scene.fog = new THREE.Fog(0xb6d0c4, 1100, 3400);

  const terrain = buildInhaumaTerrain(scene); // relevo + região virtual de colisão
  const water = buildInhaumaWater(scene);
  buildDam(scene);
  buildNuclearPlant(scene);
  buildFactories(scene);
  buildForests(scene);
  const cars = buildInhaumaRoadGraphAndTraffic(scene, inhaumaContinuousHeight);
  buildTown(scene);
  buildCachoeira(scene);

  // T-D-01: a faixa militar da MG-060 (T-C-11, campanha) registra caminhões em
  // game.targets — o modo defesa NÃO toca game.targets no boot (sem waves,
  // sem campanha): esconde a malha e retira os registros. O driver de tráfego
  // (updateMilitaryTraffic) early-returna com a lista vazia.
  if (cars.military?.length) {
    if (cars.militaryMesh) cars.militaryMesh.visible = false;
    for (const m of cars.military) {
      const i = game.targets.indexOf(m.target);
      if (i >= 0) game.targets.splice(i, 1);
    }
    cars.military.length = 0;
  }

  _refs = { terrain, water, cars, garrison: null };
}

/** Update da cena (recentra terreno infinito na POSIÇÃO DO SOLDADO, não do jato). */
export function updateInhaumaDefenseWorld(dt, playerPos) {
  if (_refs) updateInhaumaScene(dt, _refs, playerPos);
}
