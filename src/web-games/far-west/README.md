# Far West — Open-World Western

A 3D open-world western for the browser: a cowboy rides his horse across a
2048×2048 m procedural world — mountains framing the horizon, temperate forests,
two rivers descending to a lake — hunting deer, capturing bandits, crossing
fords and wooden bridges. Built with Three.js r165 (vendor-local, ES modules),
no build step, fully offline.

## How to run

From the **repo root** (one level up):

```bash
python3 -m http.server 8080
# or: npx serve
```

Open `http://localhost:8080/src/web-games/far-west/`.

## Controls (final mapping)

| Key | Action |
|-----|--------|
| W / A / S / D | move / steer (horse gaits: walk, trot) |
| Shift | gallop (drains stamina) |
| V | toggle first / third person camera |
| F | aim (slight zoom + accuracy) |
| Space | shoot revolver |
| R | reload |
| M | fullscreen map |
| E | interact (capture bandit / deliver game / eat) |

> Current build (T-FW-02/03): world foundation only. The camera is a temporary
> OrbitControls fly-around (marked TEMP in `src/main.js`) until the horse +
> player controller lands in T-FW-04.

## Architecture

Same pattern as `aero-fighters/`:

- `src/state.js` — `window.game`, single source of truth
  (`{ renderer, scene, camera, world, player, entities, ui, flags, time }`).
- `src/config.js` — ALL numeric constants (world, terrain, rivers, LOD, sky,
  biomes, player stats, palette). Tune here, never inside modules.
- `src/main.js` — boot + loop orchestration only.
- ES modules importing three via the relative path
  `../../vendor/three.module.min.js` — no import map, no build step, no runtime
  external fetches. Modules ≤ 250 lines.

### World pipeline (`buildWorld` in `src/world.js`)

1. `noise.js` — seeded noise: vendored `vendor/simplex-noise.js` when present,
   built-in seeded simplex fallback otherwise (always deterministic).
2. `rivers.js` — traces 2 river polylines downhill from mountain springs to one
   lake; monotonic bed profile; ford (≤1.2 m) / deep (≥2.5 m) classification.
3. `heightfield.js` — samples the analytic fBm + mountain-mask height function
   into a 2 m grid, then rasterizes the river carve into the grid BEFORE any
   mesh is built. Exports the shared contract: `heightAt(x, z)` (interpolates
   with the same triangle split as the chunk geometry — matches the rendered
   high-LOD mesh exactly), `normalAt`, `slopeAt`, `moistureAt`.
4. `terrain.js` — 8×8 chunk meshes, 2 LOD levels swapped by camera distance
   (high = 2 m grid near, low = 8 m far, built lazily), vertex colors by
   height/slope/moisture/riverbank (snow, rock, grass, dirt, sand).
5. `water.js` — animated river ribbons + lake surface; 2 wooden bridges with
   walkable deck query `bridgeAt(x, z)`; fords in `game.world.fords`.
6. `sky.js` — vendored Sky addon + sun (shadows) + hemisphere light + FogExp2 +
   600 s day/night cycle with warm sunsets. `updateSky(dt)`.
7. `vegetation.js` — InstancedMesh scatter by biome (pines high, broadleaf in
   moist valleys, bushes, rocks; nothing in riverbeds or on steep rock).

### Models

`src/assets.js` reads `../vendor/models/manifest.json` (semantic key → GLB) and
loads each model into a registry; `spawn(key)` returns a clone (skinned-aware).
**Every key has a procedural low-poly fallback** (`src/procedural.js`), so the
game works fully with zero GLBs vendored — missing manifest or missing key
falls back silently.

## Testing

Playwright smoke lives in `tests/far-west/` (T-FW-05). The world contract is
verified by raycasting the rendered mesh against `window.game.world.heightAt`
at random points (tolerance 0.1 m).
