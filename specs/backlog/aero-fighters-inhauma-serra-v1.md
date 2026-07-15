---
name: aero-fighters-inhauma-serra-v1
status: PROMOTED
created: 2026-07-14
origin: operator demand 2026-07-14 (deep-research session — maps concept change)
target_release: aero-fighters-inhauma-serra-v1
---

# Backlog — Aero Fighters: Inhaúma "Serra" mountain-chain concept

## Operator demand (2026-07-14)

The current Inhaúma map is "a plain with some mountains" — large flat fields with a
few isolated authored hills. That is not the concept. The operator wants a **change
of concept** for Inhaúma (other maps later): *terreno acidentado* — a realistic,
beautiful mountain-chain scenario:

1. **Mountain chains, not isolated hills** — connected ridgelines with crests,
   spurs and passes the player can fly through.
2. **Carved valleys between the chains** — valleys are the flight corridors.
3. **A river crossing between the mountain valleys**, following the terrain's
   drainage, not painted arbitrarily.
4. **Stony/rocky terrain together with snow on the mountains** — exposed rock on
   steep slopes, snow caps above a snow line, vegetated lower slopes.
5. **Styled trees, well positioned** — forest distribution driven by
   altitude/slope/river proximity (dense valleys → tree line), not uniform scatter.
6. **Positioned bridges** — real structures where roads cross the river.
7. **City better constructed on the mountain** — terraced into the valley/slopes,
   not a flat grid on a plain.

All layers must derive from ONE coherent terrain model (river follows valleys,
bridges follow road×river crossings, biomes follow altitude+slope).

## Research outcome (verified, 2026-07-14 deep-research run)

- Current maps are 100% in-code procedural; no external sources anywhere.
- Simple noise cannot produce valley networks; real DEM data or erosion gives the
  "acidentado" character.
- **AWS Terrain Tiles** (Terrarium PNG on S3, anonymous, attribution-only license)
  verified fetchable from the dev machine. Copernicus GLO-30 is the bulk alternative.
- Recommended pipeline (operator-approved): bake offline from a real mountain-chain
  DEM → vendor as a local asset (keeps "no runtime external loads" principle) →
  sample it in `inhaumaBaseHeight` behind the existing single surface-truth seam →
  altitude+slope biome colors (rock/snow) → river carved along the valley floor →
  bridges at road×river crossings → city on a flattened valley shelf.
- Zero-cost path (no paid tools) chosen. Attribution credits must ship in-game.

## Constraints

- Keep: no build step, no runtime external fetches (vendored asset like
  `waternormals.jpg` is fine), vertex-colored Lambert look, Node-importable terrain
  math (validate:aero-map sim tests), infinite chunk streaming, single surface-truth
  height function feeding mesh + collision, existing road/airport carving.
- Heightmap asset must decode identically in browser and Node (no canvas-only path).

## Disposition

Promoted to release `aero-fighters-inhauma-serra-v1` (same-day operator mandate:
"go ahead through release definition and implementation full").
