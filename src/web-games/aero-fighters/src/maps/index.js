// maps/index.js — Abstração de seleção de mapa.
// Exporta: MAP_KEYS, MAP_LABELS, getTargetLayout, MAPS.

import { createIslands, islandHeightAt, updateWorld } from '../world.js';
import { createDesertWorld, desertHeightAt, updateDesertWorld } from './desert.js';
import { createRioWorld, rioHeightAt, updateRioWorld } from './rio.js';
import { createInhaumaWorld, inhaumaHeightAt, updateInhaumaWorld } from './inhauma.js';
import { createInhaumaDefenseWorld, updateInhaumaDefenseWorld } from './inhauma-defense.js';
import { TARGET_LAYOUT, TARGET_LAYOUT_DESERT, TARGET_LAYOUT_RIO, TARGET_LAYOUT_INHAUMA } from '../config.js';

export const MAP_KEYS = ['islands', 'desert', 'rio', 'inhauma', 'inhauma-defense'];

export const MAP_LABELS = {
  islands: 'Mar do Sul',
  desert:  'Deserto',
  rio:     'Rio de Janeiro',
  inhauma: 'Inhauma',
  'inhauma-defense': 'Inhaúma — Bateria Antiaérea (Defesa)',
};

export const MAPS = {
  islands: {
    create:   (scene) => createIslands(),
    heightAt: islandHeightAt,
    update:   updateWorld,
    layout:   TARGET_LAYOUT,
    label:    'Mar do Sul',
  },
  desert: {
    create:   createDesertWorld,
    heightAt: desertHeightAt,
    update:   updateDesertWorld,
    layout:   TARGET_LAYOUT_DESERT,
    label:    'Deserto',
  },
  rio: {
    create:   createRioWorld,
    heightAt: rioHeightAt,
    update:   updateRioWorld,
    layout:   TARGET_LAYOUT_RIO,
    label:    'Rio de Janeiro',
  },
  inhauma: {
    create:   createInhaumaWorld,
    heightAt: inhaumaHeightAt,
    update:   updateInhaumaWorld,
    layout:   TARGET_LAYOUT_INHAUMA,
    label:    'Inhauma',
  },
  // T-D-01 (inhauma-defense-v1): modo jogado DO CHÃO na mesma cena de Inhaúma.
  // Sem layout de alvos — o modo não usa o loop de waves/missões (Onda D4
  // introduz o defense-director). O spawn do soldado/câmera é do defense-mode.
  'inhauma-defense': {
    create:   createInhaumaDefenseWorld,
    heightAt: inhaumaHeightAt,
    update:   updateInhaumaDefenseWorld,
    layout:   [],
    label:    'Inhaúma — Bateria Antiaérea (Defesa)',
  },
};

export function getTargetLayout(mapKey) {
  return MAPS[mapKey]?.layout ?? TARGET_LAYOUT;
}

export function getMapHeightFn(mapKey) {
  return MAPS[mapKey]?.heightAt ?? islandHeightAt;
}
