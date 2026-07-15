# SPEC — Release: aero-fighters-flight-combat-v1

**Status:** Aprovado
**Aprovação:** 2026-07-15 — operator demand + full-autonomous execution mandate (see D-0).
The operator recorded the 6-point scope verbatim on 2026-07-15 and mandated autonomous
execution through release definition and implementation. The operator's wording is the
grill outcome (mandatory `dadaia-release-definition` grill satisfied — D-0).
**Release ID:** aero-fighters-flight-combat-v1
**Owner:** product-engineer
**Opened:** 2026-07-15
**Consumes:** `specs/backlog/aero-fighters-flight-combat-v1.md`
**Depends on:** `aero-fighters-inhauma-serra-v1` (must ship first — this release designs
landing/taxi against the serra valley-shelf airport at `(-560, 320)`). No memory /
ACTIVE.md repoint happens here; the serra release remains active until it ships.

---

## 1. Problem and context

Aero Strike (`aero-fighters/`, memory atoms `aero-strike-flight`, `aero-strike-combat`,
`aero-strike-fx`) has a mature realistic-sortie loop, but six parts of the flight/combat/FX
experience read as unfinished:

1. **Landing "doesn't feel like a real landing".** On touchdown the plane is
   **immediately control-captured**: `player.js` fires `TOUCHDOWN_SAFE` and in the SAME
   frame sets `mr.autoTaxi.active = true`; `main.js` then routes to `updateAutoTaxi` instead
   of `updatePlayer`. Auto-taxi's `_driveTo` drives straight-line toward the service-zone
   waypoint (`z=475`, off the runway axis), so the aircraft **cuts across non-paved ground**
   right after touchdown. There is no roll-out phase where the player keeps control. The
   Inhaúma runway itself (`createInhaumaAirport`) is a bare dark plane: it hand-rolls a few
   edge lights + centerline boxes and never calls the shared `addRunwayFurniture`; there are
   no threshold stripes, aiming-point/touchdown-zone markings, or taxiway centerline.
2. **Plane / propulsion / sound.** `buildJet()` is a decent procedural F-35 but the
   silhouette can be sharper; throttle is a bare continuous `0.05..1.0` with no staging or
   detents; the afterburner is only a small exhaust-cone scale. Worst of all the engine
   **sounds like a propeller** — `audio.startEngine()` layers a sawtooth@80 + square@38
   through a 700 Hz lowpass (low chug), not a turbine.
3. **Takeoff feels unreal** — the rotation/climb has residual step-like transitions
   (`rotateSpool`, `liftoffVsp`, the AIRBORNE hand-off) that read as teleport-y.
4. **Missiles miss at range by design.** `updateMissiles` homes with a finite `LIFE`
   (6 s / 8 s) and turn rate, so long launches run out of life or overshoot — long-range
   shots "systematically miss". There is no probabilistic hit model.
5. **Nuke fireball misbehaves and under-destroys.** `nuclear-fx.js` grows the fireball with
   `fireRise = 30 + t²·6` (super-linear overshoot) decoupled from the plume top; there is no
   double flash; and `MISSILES_NUCLEAR.BLAST_RADIUS = 400` while the visual ground shockwave
   sweeps to **750 m** — the destruction radius is far smaller than the spectacle.
6. **No kinetic "rod" weapon.** The arsenal is cannon + light/heavy/nuclear missiles; there
   is no fast piercing multi-kill weapon.

These are the current implementation facts this release changes; the product truth is in
`specs/memory/product/aero-strike-flight.md`, `aero-strike-combat.md`, `aero-strike-fx.md`.

---

## 2. Objective

Make the Aero Strike flight/combat/FX experience read as real: a legible runway with a
natural touchdown → roll-out → guided-taxi flow that stays on pavement; a sharper jet with
staged throttle, visible afterburner, and a synthesized **turbine** sound; a smooth takeoff;
missiles that visibly pursue with a deterministic **80% range-independent** hit rule; a
corrected, larger-destruction nuke; and a new **rod kinetic** multi-kill weapon — all with
no build step, 100% synthesized audio, vendored Three.js, and zero regression to the serra
terrain or the other three maps.

---

## 3. Scope

The 6 demand points become the acceptance criteria below. Each is a hard gate for closure
and is written to be concretely testable (Node deterministic sim for mechanics; Playwright
for visual/audio smoke).

### AC-01 — Real landing: legible runway + roll-out that keeps the player on pavement
- Inhaúma's shelf airport gets an explicit runway: **threshold stripes, centerline dashes,
  a touchdown-zone / aiming-point marking, edge lights, and a taxiway centerline** to the
  apron. Shared furniture helpers are used so the other 3 maps inherit the clarity for free.
- Touchdown **does not instantly capture control**. On `TOUCHDOWN_SAFE` the aircraft enters
  a **roll-out** in which the player retains directional (yaw / rudder) + brake control
  while decelerating along the runway axis. **Guided taxi engages only** once ground speed
  ≤ `TAXI_HANDOFF_SPEED` AND the aircraft is on a paved surface.
- Guided taxi follows paved centerline waypoints with a **speed clamp and turn-rate limit**
  so the path never leaves pavement.
- **Test:** a scripted landing → roll-out → taxi-to-apron sim samples the aircraft ground
  position every frame from touchdown to the service zone; `airportSurface(pos)` is one of
  `{runway, taxiway, service}` (never `none`) at every sample. Control is not captured
  (auto-taxi inactive) while ground speed > `TAXI_HANDOFF_SPEED`.

### AC-02 — Sharper jet, staged throttle, visible afterburner
- `buildJet()` silhouette is improved (still procedural geometry — no external assets).
- Throttle is a continuous `0..1` curve with **≥4 named detents**: idle / taxi / military /
  afterburner (D-6). A pure `throttleStage(t)` mapping returns the stage for boundary values.
- A visible afterburner exhaust plume appears at military+ and is largest at afterburner.
- **Test:** unit test on `throttleStage` boundaries; e2e visual smoke asserts the afterburner
  plume mesh scale at afterburner > at idle.

### AC-03 — Turbine engine sound (100% synthesized)
- `audio.startEngine` / `setEngineRPM` are replaced with a **jet turbine** synth: a
  filtered-noise spool whose band sweeps with RPM + a high-frequency whine layer
  (shepard-ish stacked oscillators), lowpass-shaped and following `speed`/`throttle`
  continuously. The propeller-like sawtooth+square chug is removed.
- Audio stays **100% synthesized** — no audio files, no network fetch.
- **Test:** e2e asserts, after first input, the engine graph exists with the turbine
  composition (whine oscillator layer + swept bandpass noise) and no file/network request.

### AC-04 — Smooth takeoff
- Acceleration down the runway is a smooth curve; rotation begins at `Vr`; climb-out eases
  pitch; there are no teleport-y position/altitude jumps across the TAKEOFF_ROLL → AIRBORNE
  hand-off. Tied to the throttle stages (D-6).
- **Test:** takeoff sim asserts (a) per-frame altitude/position delta stays below a jump
  threshold across the whole roll+rotation+liftoff, (b) rotation starts at `Vr`, (c) pitch
  increases monotonically without a single-frame step.

### AC-05 — Missile pursuit + 80% range-independent hit rule
- Each launched **guided** missile (light and heavy) resolves to HIT with fixed probability
  **0.80** via a **deterministic seeded roll per launch** (`game.rng`), **independent of
  launch range** (D-1).
- A HIT-rolled missile flies a curved proportional-navigation pursuit and **always** reaches
  and damages the locked target (its life is guaranteed sufficient for terminal intercept).
- A MISS-rolled missile flies a plausible **near-miss** curve past the target and
  self-destructs **without damage**.
- Trail FX and the existing lock/ammo UX are preserved.
- **Test:** sim runs 100 seeded launches in each of ≥3 range buckets (near / mid / far);
  measured hit rate = **80% ± 2%** in **every** bucket; every HIT-rolled launch damages the
  target; no MISS-rolled launch damages it.

### AC-06 — Nuke: corrected fireball + double flash + larger destruction
- Fireball growth/positioning/buoyant rise is corrected: the fireball tracks the plume top
  with an eased rise (no `t²` overshoot), proper cap/stem proportions retained.
- A **double flash** (two flash pulses ~0.12–0.18 s apart) is added; the ground scorch decal
  is retained and sized to the new radius (condensation rings already exist).
- **Destruction radius increased**: `MISSILES_NUCLEAR.BLAST_RADIUS` rises `400 → 760`
  (≈ the visual ground shockwave of 750 m, ~1.9×) so the ground kill radius matches the
  spectacle (D-8). Player kill/damage radii are re-tuned to stay fair.
- **Test:** sim asserts every ground target within the new `BLAST_RADIUS` is destroyed by one
  nuke and a target just outside is not; `nuclearFxState` exposes the full
  `flash→fireball→mushroom→dissipating` timeline; fireball rise stays within bounds (no
  overshoot past plume top). e2e visual smoke of the sequence; headless guard respected.

### AC-07 — Rod kinetic missiles (new weapon)
- New weapon slot **rod** on key `R`, ammo `game.player.rodMissiles` (limited stock like
  HVY/NUK — **4**), shown on the HUD as `ROD` (D-3).
- Speed **2× the standard (light) missile**; **kinetic** — no warhead FX, only an impact
  flash on each kill.
- **Pierces**: after each kill it keeps maneuvering to the next target. One launch guarantees
  **exactly up to 3 kills** when ≥3 valid targets exist within an **action radius equal to
  the nuke's action radius** (`MISSILES_NUCLEAR.BLAST_RADIUS`, reused). With fewer than 3
  valid targets in radius it kills what exists and then expends.
- **Test:** sim with 3 clustered targets inside the action radius → exactly 3 kills in one
  launch; with 2 → 2 kills then expend; a 4th target outside the action radius is never
  chained.

### AC-08 — No regressions; tests green
- `npm run test:aero:qa` (validate:aero-map + unit + sim + e2e) passes, plus the new weapons
  sim, taxi-containment sim, and Playwright smoke for the 6 points.
- No regression to `inhauma` serra terrain or to `desert`, `rio`, `islands`.
- Pooled FX and the `HEADLESS`/`webdriver` guards are respected (no per-frame allocations in
  new FX; nuke plume stays 1 draw call). No build step; vendored Three.js r169; audio 100%
  synthesized.

---

## 4. Out of scope

- **Enemy fighters that engage the player** — remains backlog `aero-air-combat-v1`. The
  allied-war front is unchanged.
- **New maps or terrain changes.** The serra terrain (`aero-fighters-inhauma-serra-v1`) is
  frozen; this release only reads its airport shelf. Other maps get the runway-marking
  clarity pass only where the shared furniture code makes it free.
- **PBR overhaul** beyond the existing jet materials; **no LOD system**; **no build step /
  bundler / TypeScript**; **no external runtime assets or audio files**.
- **Free manual taxi steering everywhere** — guided taxi remains guided; the change is the
  roll-out phase + staying on pavement, not full manual ground driving.
- **Lock-on cone / crosshair semantics** unchanged except where a point requires it (rod
  target seeding).
- **Nuke as a lock-required weapon** — it still fires without lock.

---

## 5. Decisions (ADRs)

### D-0 — Mandatory grill satisfied by the operator demand + autonomous mandate
The `dadaia-release-definition` mandatory `dadaia-grill-me` is satisfied by the operator's
verbatim 6-point demand (`specs/backlog/aero-fighters-flight-combat-v1.md`, recorded
2026-07-15) plus the explicit full-autonomous execution mandate. No open bug or audit
contends for this release. Where mechanics were underspecified the reasonable design
decisions are encoded as D-1..D-10 below rather than left as gaps.

### D-1 — 80% hit via deterministic seeded roll, range-independent
Each guided-missile launch draws one deterministic roll from `game.rng` (`random() < 0.80`
⇒ HIT). Independent of range. A HIT missile is guaranteed terminal intercept (life extended
so it cannot expire before reaching the target; guidance clamped to converge); a MISS missile
is scripted to fly a near-miss curve past the target and expire without damage. This replaces
the emergent range-dependent miss behavior the operator flagged as "wrong by design".

### D-2 — Pure Node-safe `weapons-core.js` for testable weapon math
The hit-roll decision and the rod target-selection/chain logic live in a new pure module
`aero-fighters/src/weapons-core.js` (no DOM, no THREE), mirroring `physics-core.js`, so the
Node sim validates them directly. `projectiles.js` and `rod-missiles.js` consume it.

### D-3 — Rod = new weapon (key R, ammo 4, kinetic, chain ≤3 in nuke radius)
New module `aero-fighters/src/rod-missiles.js`: pool + pierce chain. Key `R` (`KeyR`),
ammo `game.player.rodMissiles` (initial 4, refilled at service like other missiles), HUD
`ROD`. Speed = 2× light (`INITIAL 160 / TRACKING 260`). Kinetic: impact flash only, no
`explosion()`/warhead FX. Action radius = `MISSILES_NUCLEAR.BLAST_RADIUS` (reused constant).
Fires without a required lock: seeds on the current lock if present, else the nearest valid
target, then chains to the next-nearest valid targets within the action radius, up to 3 kills.

### D-4 — Roll-out phase before guided taxi; taxi stays on pavement
`TOUCHDOWN_SAFE` no longer arms auto-taxi in the same frame. A roll-out sub-state keeps the
player in directional + brake control while decelerating along the runway. Guided taxi
(`auto-taxi.js`) engages only when ground speed ≤ `TAXI_HANDOFF_SPEED` (34 m/s) and the
aircraft is on pavement; its waypoint path is constrained to paved surfaces (runway → taxiway
→ service) with a speed clamp and turn-rate limit, so it never cuts across non-paved ground.
The existing post-mayday relaunch / auto-decolagem recovery path is preserved.

### D-5 — Shared runway-furniture clarity pass
`createInhaumaAirport` (and the shared builder path) uses the `addRunwayFurniture` family
extended with threshold stripes, aiming-point/touchdown-zone markings, and a taxiway
centerline. Applied to Inhaúma; the other maps inherit via the shared helper where already
wired. Markings are procedural geometry (no textures beyond the existing canvas label).

### D-6 — Throttle staging with 4 detents + afterburner gate
Throttle remains continuous `0..1`; a pure `throttleStage(t)` maps to `idle`(≤0.10) /
`taxi`(≤0.35) / `military`(≤0.80) / `afterburner`(>0.80). The afterburner visual plume is
gated at ≥ military and scales to afterburner. Ground/flight physics keep reading the
continuous value; the stages drive UX + FX only.

### D-7 — Turbine engine synth
Replace the engine oscillators with a turbine model: a looped noise source through a bandpass
whose center frequency sweeps with normalized RPM (spool) + a stacked high-frequency whine
(2–3 detuned oscillators, shepard-ish) + lowpass shaping; gains follow `speed`/`throttle`.
Continuous graph, muteable, 100% synthesized. `startEngine`/`stopEngine`/`setEngineRPM`
signatures preserved so callers (`player.js`) are untouched.

### D-8 — Nuke destruction radius raised to match the spectacle
`MISSILES_NUCLEAR.BLAST_RADIUS 400 → 760` (~1.9×, ≈ the 750 m visual ground shockwave).
`PLAYER_KILL_RADIUS 200 → 300`, `PLAYER_DAMAGE_RADIUS 450 → 680` re-tuned to stay fair and
proportional. Scorch decal radii and `deformTerrainNuclear` use the new `BLAST_RADIUS`.

### D-9 — Fireball rise fix + double flash
Fireball rise eased to track the plume top (replace `30 + t²·6` with an eased curve clamped to
`plumeH`); cap/stem proportions retained. A double flash (two `#nuke-flash` / core pulses
~0.12–0.18 s apart) is added in `fx.js#nuclearExplosion`. Keep `depthWrite:false` on additive
materials; **do not** combine the additive fireball with a sprite + logarithmic-depth + bloom
stack (known NaN-mip trap) — validate headless stability.

### D-10 — Node-safe taxi/roll-out kinematics for containment testing
The roll-out + guided-taxi path kinematics are expressed through a pure helper (new
`taxi-core.js` or extended `ground-physics.js`) so the containment sim can validate that the
path stays on pavement without instantiating THREE/jet.

---

## 6. Dependencies and risks

### Dependencies
- **`aero-fighters-inhauma-serra-v1` ships first** — landing/taxi is designed against the
  serra valley-shelf airport `(-560, 320)`. This release does not modify serra terrain.
- Existing seams: `sortie-state.js` FSM, `landing-zones.js` classification,
  `auto-taxi.js`, `ground-physics.js`, `player.js` ground block, `projectiles.js`,
  `nuclear-fx.js` / `fx.js`, `audio.js`, `crosshair.js` lock, `game.rng`, and the Node test
  harness (`test:aero:sim`, `test:aero:unit`, `validate:aero-map`, Playwright e2e).

### Risks

| # | Risk | Likelihood | Impact | Mitigation |
|---|------|-----------|--------|------------|
| R-1 | `player.js` is a hotspot (points 1,2,3, rod mesh) — parallel edits collide | High | Med | Lane A owns **all** of `player.js`; other lanes never write it (see PLAN write-sets). |
| R-2 | `projectiles.js` shared by nuke (Lane B) and missiles (Lane C) | Med | Med | Disjoint **function** write-sets (Lane B: `applyNuclearShockwave`/`updateNuclears`; Lane C: `spawnMissile`/`updateMissiles`); rod extracted to `rod-missiles.js`. |
| R-3 | Additive fireball NaN-mip trap (memory gotcha) | Med | High | D-9: no sprite+logdepth+bloom stack; `depthWrite:false`; headless smoke asserts finite state. |
| R-4 | Range-independent guaranteed hit breaks legacy missile tests that assumed range miss | Med | Med | Update legacy expectations; hit-rule lives in pure `weapons-core.js` with its own seeded stats test. |
| R-5 | Roll-out hand-off reintroduces the "stuck plane at airport" bug | Med | High | Preserve `respawnAndRelaunch`/`relaunchSortie`; taxi-containment + auto-decolagem sim must stay green. |
| R-6 | Bigger nuke radius over-kills / unfair to player | Low | Med | D-8 re-tunes player radii; sim asserts target kill radius; playtest at closure. |
| R-7 | Turbine synth regresses audio smoke / autoplay lazy-init | Low | Med | Keep `startEngine`/`setEngineRPM` signatures + lazy-init contract; e2e node-composition assert. |
| R-8 | `config.js` edited by all 3 lanes | Med | Low | Disjoint constant blocks (PLAYER / MISSILES_NUCLEAR / MISSILES_* ) — git-mergeable; declared in TASKS. |
