# PLAN — Release: aero-fighters-flight-combat-v1

**Status:** Aprovado
**Release ID:** aero-fighters-flight-combat-v1
**Owner:** product-engineer
**Depends on SPEC:** `SPEC.md` (Status: Aprovado)

---

## 1. Strategy

Three parallel implementation lanes, chosen so their **write-sets are maximally disjoint**
(2–3 software-engineers can run concurrently). `player.js` is single-owned by Lane A; the
few shared files (`config.js`, `projectiles.js`, `main.js`) are partitioned at
**function/section** granularity and those partitions are declared in TASKS.

| Lane | Theme (SPEC points) | Primary files (owned) |
|------|---------------------|------------------------|
| **A — Ground & Airframe** | 1 (landing/taxi), 3 (takeoff), 2-visual (silhouette/throttle/afterburner) | `airport.js`, `landing-zones.js`, `auto-taxi.js`, `ground-physics.js`, `sortie-state.js`, `player.js`, **new** `taxi-core.js`, `config.js`[PLAYER], `main.js`[landing/taxi loop ~378-402] |
| **B — Audio & Nuke** | 2-audio (turbine), 5 (nuke) | `audio.js`, `nuclear-fx.js`, `fx.js`[nuclearExplosion], `config.js`[MISSILES_NUCLEAR], `projectiles.js`[applyNuclearShockwave/updateNuclears/buildNuclearMesh] |
| **C — Weapons** | 4 (80% hit), 6 (rod) | **new** `weapons-core.js`, **new** `rod-missiles.js`, `projectiles.js`[spawnMissile/updateMissiles/buildMissileMesh], `config.js`[MISSILES_LIGHT/HEAVY/ROD], `main.js`[fire fns + listeners ~246-314], `input.js`, `hud.js`, `crosshair.js` |

Purity discipline (mirrors existing `physics-core.js`): all new **decision math**
(hit-roll, rod target-selection/chain, roll-out/taxi kinematics, throttle-stage mapping)
lives in **Node-safe pure modules** so the deterministic sim tests import them without DOM
or THREE.

---

## 2. Layers affected & approach, per SPEC point

### Point 1 — Landing + airport (Lane A) → AC-01
- **Runway clarity** (`airport.js`): extend `addRunwayFurniture` with threshold stripes,
  aiming-point / touchdown-zone markings, and a taxiway centerline; make
  `createInhaumaAirport` call the shared furniture (today it hand-rolls a subset and skips
  `addRunwayFurniture`). Procedural geometry only. Other maps inherit via the shared helper.
- **Roll-out phase** (`sortie-state.js`, `player.js`, `landing-zones.js`, `ground-physics.js`,
  `config.js`[PLAYER]): on `TOUCHDOWN_SAFE` do **not** arm auto-taxi in the same frame
  (remove the inline `mr.autoTaxi.active = true` at the touchdown site). Enter roll-out where
  the ground block keeps yaw/rudder + brake authority and decelerates along the runway axis.
  Add `TAXI_HANDOFF_SPEED` (34) to PLAYER.
- **Guided taxi on pavement** (`auto-taxi.js`, new `taxi-core.js`, `main.js`): arm guided
  taxi only when `groundSpeed ≤ TAXI_HANDOFF_SPEED` AND `airportSurface(pos) !== 'none'`.
  Move the waypoint-follow kinematics (accel/brake clamp, turn-rate limit, drive-along-nose)
  into pure `taxi-core.js`; path waypoints constrained to runway→taxiway→service so the
  clamped path never leaves pavement.

### Point 2 — Plane design + propulsion + sound → AC-02, AC-03
- **Silhouette + afterburner** (Lane A, `player.js` `buildJet`): sharpen nose/wing/tail
  proportions (procedural); add a visible afterburner plume cone gated by throttle stage.
- **Throttle staging** (Lane A, `config.js`[PLAYER] + pure `throttleStage`): add the 4
  detents (idle/taxi/military/afterburner); `throttleStage(t)` pure and unit-tested; drives
  afterburner FX + HUD only (physics still reads continuous throttle).
- **Turbine synth** (Lane B, `audio.js`): rewrite `startEngine`/`setEngineRPM` internals to
  a swept-bandpass noise spool + stacked whine layer; keep public signatures + lazy-init.

### Point 3 — Takeoff (Lane A) → AC-04
- Smooth the roll acceleration curve and rotation in `player.js` ground block +
  `auto-taxi.js` `takeoff` phase; ease pitch at rotation; remove step transitions across
  TAKEOFF_ROLL → AIRBORNE (`liftoffVsp`/`rotateSpool`/`_liftoffCarry` continuity). Tie
  thresholds to throttle stages (D-6). Constants in `config.js`[PLAYER].

### Point 4 — Missiles + 80% hit (Lane C) → AC-05
- **Hit-roll** (pure `weapons-core.js`): `rollMissileHit(rng) → boolean` at p=0.80.
- **Guidance** (`projectiles.js` `spawnMissile`/`updateMissiles`): stamp `willHit` per launch;
  HIT ⇒ guaranteed terminal intercept (life clamp so it cannot expire pre-intercept; PN
  converge); MISS ⇒ near-miss curve past target then expire w/o damage. Preserve trail FX,
  lock, ammo. `config.js`[MISSILES_LIGHT/HEAVY] tune only if needed for terminal guarantee.

### Point 5 — Nuke overhaul (Lane B) → AC-06
- **Fireball/rise** (`nuclear-fx.js`): ease `fireRise` to track `plumeH` (drop the `t²`
  overshoot); keep cap/stem/skirt proportions and the 60 s timeline; `nuclearFxState`
  unchanged shape.
- **Double flash** (`fx.js` `nuclearExplosion`): two flash/core pulses ~0.12–0.18 s apart.
- **Radius** (`config.js`[MISSILES_NUCLEAR], `projectiles.js` `applyNuclearShockwave`):
  `BLAST_RADIUS 760`, `PLAYER_KILL_RADIUS 300`, `PLAYER_DAMAGE_RADIUS 680`; scorch decal +
  `deformTerrainNuclear` use new radius. Headless guards preserved.

### Point 6 — Rod kinetic missiles (Lane C) → AC-07
- **Selection/chain** (pure `weapons-core.js`): `selectRodTargets(targets, origin,
  actionRadius, max=3)` → ordered ≤3 valid targets within radius (nearest-first chain).
- **Weapon** (new `rod-missiles.js`): pool, 2× speed, kinetic impact flash only, pierce to
  next selected target, expends after ≤3 kills / when list exhausted. Action radius =
  `MISSILES_NUCLEAR.BLAST_RADIUS`.
- **Wiring**: `config.js`[MISSILES_ROD], `input.js` `KeyR → 'rodMissile'`, `main.js`
  `fireRodMissile()` + listener, `hud.js` `ROD` count, `state.js` `player.rodMissiles`
  (initial 4) + service refill. Rod wing-mesh on the jet is **Lane A** (owns `player.js`) —
  optional, may be deferred without blocking AC-07.

---

## 3. Execution order

1. **T-01** (C) `weapons-core.js` pure hit-roll + rod-selection + their sim tests. *(No
   THREE; unblocks C.)*
2. Parallel after T-01 is merged-or-branched:
   - **Lane A:** T-04 runway furniture → T-05 roll-out + guided-taxi-on-pavement → T-06
     takeoff smoothing → T-07 silhouette + throttle stages + afterburner. *(Sequential within
     A — all touch `player.js`.)*
   - **Lane B:** T-08 turbine synth → T-09 nuke fireball/flash/radius. *(Disjoint from A & C.)*
   - **Lane C:** T-02 wire 80% hit-rule → T-03 rod weapon. *(Disjoint from A & B except the
     declared `projectiles.js`/`config.js`/`main.js` partitions.)*
3. **T-10** final gate (qa-engineer): full `test:aero:qa` + Playwright 6-point smoke + no
   regression + dev server up & registered for operator local play.

State.js note: `player.rodMissiles` field + refill is a tiny shared add owned by Lane C in
T-03 (state.js is otherwise untouched).

---

## 4. Test strategy

**Node deterministic sim** (`node:test`, extends `test:aero:sim`; new tool file(s) under
`tests/aero-fighters/tools/`):
- **Hit-rule stats** (AC-05): 100 seeded `rollMissileHit` per range bucket (near/mid/far) →
  80% ± 2% every bucket; HIT always damages, MISS never damages (drive `updateMissiles`
  headlessly against a stub target array, or test the pure decision + a thin harness).
- **Rod pierce** (AC-07): `selectRodTargets` with 3 clustered in radius → 3; with 2 → 2; a
  4th outside radius never selected; end-to-end pool run kills exactly the selected set.
- **Taxi containment** (AC-01): scripted landing→roll-out→taxi via `taxi-core.js` +
  `landing-zones.airportSurface` → every sampled position on pavement; no capture while
  `speed > TAXI_HANDOFF_SPEED`.
- **Takeoff smoothness** (AC-04): per-frame delta bounded; rotation at `Vr`; pitch monotonic.
- **Throttle stage** (AC-02): `throttleStage` boundary values.
- **Nuke radius** (AC-06): targets within `BLAST_RADIUS` destroyed, just-outside survives;
  fireball rise ≤ plume top across timeline.

**Playwright e2e** (`test:aero:e2e`): boot smoke per point — turbine engine graph present
(AC-03), afterburner plume visible (AC-02), missiles fly curved with trails (AC-05), nuke
sequence + double flash + scorch (AC-06), rod fires + multi-kill (AC-07), landing roll-out
smoke (AC-01). All under the existing `HEADLESS`/`webdriver` guards.

**Regression:** `validate:aero-map` + existing sim/unit/e2e stay green; `desert`, `rio`,
`islands`, and serra `inhauma` terrain unaffected.

---

## 5. Technical risks & validation

- **player.js hotspot** — Lane A serializes T-04..T-07; no other lane writes `player.js`.
- **projectiles.js shared** — Lane B and Lane C edit disjoint functions; rod isolated in
  `rod-missiles.js`; TASKS declares the function-level write-sets (safe parallel).
- **Additive fireball NaN-mips** — D-9 constraints; headless sim asserts finite
  `nuclearFxState`.
- **Perf** — new FX reuse existing pools (`spawnMissileSmoke`, muzzle/impact-flash pool,
  nuke 1-draw-call plume); **no per-frame allocations** in hot paths; afterburner + impact
  flash reuse pooled meshes; verify no new `new THREE.*` inside update loops.
- **Determinism** — all mechanic tests seed `game.rng` (`createRng(seed)`); no wall-clock or
  `Math.random` in tested decision paths (rod ignite/spread may keep `Math.random` only in
  non-asserted visual-only paths).

---

## 6. Out of scope for PLAN
Implementation detail beyond module/function targeting lives in code + TASKS acceptance;
memory updates happen only at CLOSURE (`aero-strike-flight.md`, `aero-strike-combat.md`,
`aero-strike-fx.md`).
