# TASKS — Release: aero-fighters-flight-combat-v1

**Status:** Aprovado
**Release ID:** aero-fighters-flight-combat-v1
**Owner:** product-engineer
**Depends on:** `SPEC.md` (Aprovado), `PLAN.md` (Aprovado)

Markers: `[ ]` OPEN · `[-]` IN PROGRESS · `[x]` DONE.
Owner of all implementation tasks: **software-engineer**. Final gate: **qa-engineer**.

## Parallelism model

Three lanes run concurrently — **A (Ground & Airframe)**, **B (Audio & Nuke)**,
**C (Weapons)** — with the disjoint write-sets below. Per the workspace-protocol §1, this
TASKS file **explicitly declares safe parallel tasks with disjoint write sets**, so more
than one `[-]` may be active at once **provided** each active task is in a different lane and
touches only its declared write-set. Within a lane, tasks are **sequential** (they share
files). One `[-]` per lane at a time.

**Shared files, partitioned (never edit outside your declared region):**
- `config.js` — Lane A: `PLAYER` block only. Lane B: `MISSILES_NUCLEAR` block only. Lane C:
  `MISSILES_LIGHT`/`MISSILES_HEAVY`/new `MISSILES_ROD` blocks only.
- `projectiles.js` — Lane B: `buildNuclearMesh`/`applyNuclearShockwave`/`updateNuclears`
  only. Lane C: `buildMissileMesh`/`spawnMissile`/`updateMissiles` only.
- `main.js` — Lane A: the landing/taxi loop region (~L378-402) only. Lane C: fire functions
  + action listeners (~L246-314) only.
- `player.js` — **Lane A only**. No other lane writes it.
- `state.js` — **Lane C only** (single small add in T-03).

---

## Lane C — Weapons

### T-01 — Pure `weapons-core.js` (hit-roll + rod selection) + sim tests
- [x] **Owner:** software-engineer · **Lane:** C · **Write-set:** `aero-fighters/src/weapons-core.js` (new); `tests/aero-fighters/tools/test-aero-weapons-sim.js` (new); `package.json` (add to `test:aero:sim` chain).
- **Preconditions:** none (foundation).
- **Do:** pure, Node-safe (no DOM/THREE): `rollMissileHit(rng)` (p=0.80); `selectRodTargets(targets, origin, actionRadius, max=3)` → nearest-first ≤3 valid, in-radius targets.
- **Done when:** 100-seeded-launch stats give 80% ± 2% in ≥3 range buckets (range-independent); rod selection returns exactly 3 for ≥3 clustered in radius, all for <3, none outside radius; wired into `npm run test:aero:sim` and green.

### T-02 — Wire 80% range-independent hit-rule into guided missiles
- [x] **Owner:** software-engineer · **Lane:** C · **Write-set:** `projectiles.js`[`buildMissileMesh`/`spawnMissile`/`updateMissiles` only]; `config.js`[`MISSILES_LIGHT`/`MISSILES_HEAVY`]; existing missile sim/unit tests as needed.
- **Preconditions:** T-01 DONE.
- **Do:** stamp `willHit = rollMissileHit(game.rng)` per launch; HIT ⇒ guaranteed terminal intercept (clamp life so it cannot expire before reaching target; PN converge); MISS ⇒ near-miss curve past target then expire without damage. Preserve trail FX, lock, ammo UX.
- **Done when:** sim shows 80% ± 2% hits at every range bucket; every HIT damages, no MISS damages; light + heavy behave per rule; curved pursuit + trail visible (e2e smoke); no per-frame allocations added.

### T-03 — Rod kinetic weapon (new slot, pierce ≤3 in nuke radius)
- [ ] **Owner:** software-engineer · **Lane:** C · **Write-set:** `aero-fighters/src/rod-missiles.js` (new); `config.js`[new `MISSILES_ROD`]; `input.js`[`KeyR → 'rodMissile'`]; `main.js`[fire fns + listeners region only — add `fireRodMissile` + `onAction('rodMissile', …)`]; `hud.js`[`ROD` count]; `state.js`[`player.rodMissiles` init 4 + service refill].
- **Preconditions:** T-01 DONE (uses `selectRodTargets`). May run parallel to T-02 only if `projectiles.js` is untouched here (it is — rod lives in `rod-missiles.js`); otherwise sequence after T-02.
- **Do:** key `R`; ammo 4 (refilled at service like HVY/NUK); speed 2× light (`INITIAL 160`/`TRACKING 260`); kinetic — impact flash only, no `explosion()`/warhead FX; pierce to next selected target; action radius = `MISSILES_NUCLEAR.BLAST_RADIUS`; guarantees ≤3 kills, expends after. Seeds on current lock if present, else nearest valid.
- **Done when:** sim — 3 clustered targets in radius → exactly 3 kills one launch; 2 → 2 then expend; 4th outside radius never chained; HUD shows `ROD`; e2e fire smoke passes.

---

## Lane A — Ground & Airframe

### T-04 — Runway/taxiway visual clarity pass
- [-] **Owner:** software-engineer · **Lane:** A · **Write-set:** `airport.js`.
- **Preconditions:** serra release shipped (airport at `(-560, 320)`); none within this release.
- **Do:** extend the shared `addRunwayFurniture` family with threshold stripes, aiming-point / touchdown-zone markings, taxiway centerline; make `createInhaumaAirport` use the shared furniture. Procedural geometry only; other maps inherit via the shared helper.
- **Done when:** Inhaúma runway shows threshold + centerline + touchdown-zone markings + edge lights + taxiway centerline; `getAirportDiagnostics` still valid; `validate:aero-map` + e2e green; no regression to other maps' airports.

### T-05 — Roll-out phase + guided-taxi-on-pavement
- [ ] **Owner:** software-engineer · **Lane:** A · **Write-set:** `sortie-state.js`; `landing-zones.js`; `auto-taxi.js`; `ground-physics.js`; `player.js`[ground-state block + touchdown site]; `config.js`[`PLAYER` — add `TAXI_HANDOFF_SPEED 34`]; `main.js`[landing/taxi loop region ~L378-402]; `aero-fighters/src/taxi-core.js` (new, pure); `tests/aero-fighters/tools/test-aero-taxi-sim.js` (new) + wire into `test:aero:sim`.
- **Preconditions:** T-04 DONE.
- **Do:** on `TOUCHDOWN_SAFE` do NOT arm auto-taxi same-frame; keep player yaw/rudder + brake control in a roll-out decel along the runway axis; engage guided taxi only when `groundSpeed ≤ TAXI_HANDOFF_SPEED` AND on pavement; move waypoint-follow kinematics (accel/brake clamp, turn-rate limit, drive-along-nose) into pure `taxi-core.js`; constrain the path to runway→taxiway→service. Preserve `respawnAndRelaunch`/`relaunchSortie` recovery + auto-decolagem.
- **Done when:** taxi-containment sim — every sampled position touchdown→apron is on pavement (`airportSurface !== 'none'`); no capture while `speed > TAXI_HANDOFF_SPEED`; existing `landing`/`sortie`/`auto-sortie`/`service` specs stay green; no "stuck plane" regression.

### T-06 — Smooth takeoff
- [ ] **Owner:** software-engineer · **Lane:** A · **Write-set:** `player.js`[ground block]; `auto-taxi.js`[`takeoff` phase]; `config.js`[`PLAYER`]; `tests/aero-fighters/tools/test-aero-sortie-sim.js` (extend).
- **Preconditions:** T-05 DONE.
- **Do:** smooth roll accel curve; rotation at `Vr`; ease pitch on climb-out; remove step transitions across TAKEOFF_ROLL → AIRBORNE (`liftoffVsp`/`rotateSpool`/`_liftoffCarry` continuity); tie thresholds to throttle stages.
- **Done when:** takeoff sim — per-frame altitude/position delta bounded (no jump), rotation begins at `Vr`, pitch monotonic without a single-frame step; manual + auto takeoff both smooth; e2e green.

### T-07 — Sharper jet silhouette + throttle stages + afterburner FX
- [ ] **Owner:** software-engineer · **Lane:** A · **Write-set:** `player.js`[`buildJet` + afterburner visual + optional rod wing-mesh]; `config.js`[`PLAYER` throttle detents]; `aero-fighters/src/throttle-stage.js` (new pure) OR pure fn in `physics-core.js`; `tests/aero-fighters/tools/test-aero-unit.js` (extend).
- **Preconditions:** T-06 DONE.
- **Do:** improve procedural silhouette (no external assets); pure `throttleStage(t)` → idle/taxi/military/afterburner; visible afterburner plume cone gated ≥ military, largest at afterburner; (optional) rod wing-mesh on the loadout.
- **Done when:** `throttleStage` boundary unit test passes; afterburner plume scale at afterburner > idle (e2e visual smoke); silhouette renders without shadow/NaN issues; no physics regression (physics reads continuous throttle).

---

## Lane B — Audio & Nuke

### T-08 — Turbine engine synth (100% synthesized)
- [ ] **Owner:** software-engineer · **Lane:** B · **Write-set:** `audio.js`[`startEngine`/`stopEngine`/`setEngineRPM` internals + node fields].
- **Preconditions:** none (fully disjoint).
- **Do:** replace propeller-like oscillators with a turbine model — swept-bandpass noise spool (center freq follows normalized RPM) + stacked high-freq whine (2–3 detuned oscillators, shepard-ish) + lowpass shaping; gains follow `speed`/`throttle`. Preserve public signatures + lazy-init + mute.
- **Done when:** e2e — after first input the engine graph exists with turbine composition (whine oscillator layer + swept bandpass noise); no file/network fetch; mute works; `player.js` callers unchanged; audio-touching e2e green.

### T-09 — Nuke: fireball/rise fix + double flash + larger destruction
- [ ] **Owner:** software-engineer · **Lane:** B · **Write-set:** `nuclear-fx.js`; `fx.js`[`nuclearExplosion` — add double flash]; `config.js`[`MISSILES_NUCLEAR` block]; `projectiles.js`[`applyNuclearShockwave`/`updateNuclears`/`buildNuclearMesh` only — scorch/deform to new radius]; `tests/aero-fighters/tools/test-aero-sim.js` + `nuclear-fx.spec.js` (extend).
- **Preconditions:** none within lane (disjoint from A & C; `projectiles.js`/`config.js` regions are B-only).
- **Do:** ease `fireRise` to track `plumeH` (drop `t²` overshoot), retain cap/stem/skirt + 60 s timeline; add double flash (~0.12–0.18 s apart) in `nuclearExplosion`; set `BLAST_RADIUS 760`, `PLAYER_KILL_RADIUS 300`, `PLAYER_DAMAGE_RADIUS 680`; scorch decal + `deformTerrainNuclear` use new radius. Keep `depthWrite:false`; no sprite+logdepth+bloom stack (NaN-mip trap); respect headless guards.
- **Done when:** sim — targets within `BLAST_RADIUS` destroyed by one nuke, just-outside survives; `nuclearFxState` exposes full timeline; fireball rise ≤ plume top across timeline (no overshoot); headless finite-state assert passes; e2e nuke smoke green.

---

## Final gate

### T-10 — Full QA gate + operator local-play validation setup
- [ ] **Owner:** qa-engineer · **Write-set:** `tests/aero-fighters/**` (fixtures/specs as needed); no production `src/` writes.
- **Preconditions:** T-01..T-09 DONE.
- **Do:** run `npm run test:aero:qa` (validate:aero-map + unit + sim + e2e) green including the new weapons, taxi-containment, takeoff, throttle, and nuke assertions; Playwright visual/audio smoke covering all 6 points; confirm no regression to serra `inhauma` terrain or `desert`/`rio`/`islands`; bring the dev server up and **register it** (`dadaia server register`) so the operator can play locally and validate all 6 improvements.
- **Done when:** all suites green; 6-point smoke passes; no regressions; dev server up + registered; operator local-play validation ready. This unblocks CLOSURE.
