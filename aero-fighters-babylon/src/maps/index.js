// maps/index.js — Registro de mapas e seleção de layout de alvos.
// Exporta: MAP_KEYS, MAP_LABELS, MAPS, getTargetLayout.

import { createIslands, islandHeightAt, updateWorld } from '../world.js';
import { createDesertWorld, desertHeightAt, updateDesertWorld } from './desert.js';
import { createRioWorld, rioHeightAt, updateRioWorld } from './rio.js';
import { TARGET_LAYOUT, TARGET_LAYOUT_DESERT, TARGET_LAYOUT_RIO } from '../config.js';

export const MAP_KEYS = ['islands', 'desert', 'rio'];

export const MAP_LABELS = {
  islands: 'Mar do Sul',
  desert:  'Deserto',
  rio:     'Rio de Janeiro',
};

export const MAPS = {
  islands: {
    create:   () => createIslands(),
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
};

export function getTargetLayout(mapKey) {
  return MAPS[mapKey]?.layout ?? TARGET_LAYOUT;
}
