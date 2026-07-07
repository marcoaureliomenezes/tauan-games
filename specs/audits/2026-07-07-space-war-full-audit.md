# Space War — Full Audit (physics, travel, weapons, systems, architecture)

**Date:** 2026-07-07 · **Auditor:** project-auditor fan-out (4 lanes: travel/starfield, weapons/gravity, celestial roster, architecture/phases) · **Scope:** `space-war/src/**` (~7.6k lines), read-only.

**Operator mandate driving this audit:**
1. Fix: stars streak past while still inside the origin system during interstellar travel.
2. Fix: bombs attracted by gravity in wrong-looking ways; audit tracer [G] and Higgs [H] weapons.
3. Replace the system roster: (1) Solar (keep), (2) Betelgeuse + companion, (3) black hole + companion red giant being visibly eaten (plasma hand), (4) neutron star orbiting a star, (5) Sagittarius A*.
4. Systems must become **phases**: only the active system is loaded/rendered; interstellar travel is the transition between phases.

---

## A. Root causes of the reported bugs

### A1. "Crossing stars inside the system" — CONFIRMED, exact root cause found

- The correct boundary gate already exists: `systemFade(pos)` (`src/starfield.js:254-262`) returns 0 inside `0.85×sys.radius`, ramping to 1 at `1.5×radius`.
- **But `src/starfield.js:270` overrides it during journey:** `fade = max(systemFade(cam), journey.active ? 0.85 : 0)`. The instant [Z] engages — while parked deep inside the origin system — the interstellar starfield (and nebulae, `starfield.js:298`) pop to 85% opacity and start streaking (streaks are speed-coupled via `uSpeed`, `starfield.js:116-117`, fed `j.v` at `starfield.js:283`).
- **Compounding cause:** β and all relativistic visuals are **time-gated, not boundary-gated**. `j.beta = 0.995·v/vMax` (`journey.js:112`) reaches cruise at 30% of T ≈ 15% of D ≈ 3M u — still inside Solar's 4.2M-u radius (`config.js:412`). Full aberration/δ⁴ beaming/postfx tint fire with the Sun and planets still around the ship.
- Asymmetry: Solar radius was rescaled to 4.2M but other systems stayed at 200k–420k, so the bug is dramatic departing Solar, nearly invisible elsewhere.

**Fix:** delete the 0.85 journey floor and let `systemFade` govern; scale visual β by the same boundary factor (`betaVis = j.beta · systemFade(ship.pos)`), shared with postfx. Derive a position-based presentation state machine: `departing` (inside origin radius: no streaks, bodies visible) → `cruise` (void: full show) → `arriving` (ramp down inside dest radius). All needed radius tests already exist (`system.js:55`, `starfield.js:259`, `starlod.js:107`) — unify their 4 divergent thresholds (1.15 / 0.9 / 1.1 / 0.85–1.5 ×radius) into one authority.

### A2. "Bombs attracted wrongly" — two concrete root causes

1. **Higgs well flat-force plateau (HIGH).** "Cap 600" is not a well count — it is a per-well acceleration cap in u/s² (`gravity.js:146`). With well μ = 5e11 (`higgs.js:22`), the cap binds out to d = √(5e11/600) ≈ **28,868 u**: a ~29k-u sphere of constant 600 u/s² (2× Earth surface gravity) with **zero falloff and no outer range cutoff** (bodies have a `gravReach` gate, `gravity.js:117`; wells have none — they perturb every `computeGravity` call universe-wide and contaminate the ballistic firing solver via `ballistics.js:65`). Nothing can orbit a constant-force field; everything inside veers in near-straight lines — exactly "bombs attracted wrongly."
   **Fix:** Plummer-softened profile `aW = μ_eff·d/(d²+soft²)^1.5` sized to ≈600 at d=soft, 1/r² beyond, tapering to 0 at a finite `wellReach` (~15–20k u).
2. **Nuke SOI capture guidance (HIGH).** Un-aimed nukes have velocity *replaced* by a lerp toward sub-circular Kepler flow with a 320 u/s speed floor whenever inside any planet/moon SOI (`weapons.js:246-277`). Hyperbolic flybys that should slingshot get captured and spiral in — reads as magnetic suction.
   **Fix:** gate capture on `|v_rel| < 1.5·v_esc(local)`; leave fast passes ballistic (the `aimed` path already proves pure gravity works).

**Tracer [G] is the reference weapon:** honest pure-gravity probe, correct FIFO cap 6 (`weapons.js:94-98`), correct 320-point ring trail. Only nits: magic-number duplication (320/319 literals vs `TRACER_TRAIL_N`), 1-frame 7th tracer.

Other weapon-physics findings (ranked): SOI-switch acceleration discontinuities (kinks in tracer trails — blend `worldAcc` over outer 10% of SOI); **enemies are exempt from all gravity** (kinematic AI, `enemies.js:150-167`) so Higgs wells bend every projectile but leave fighters parked; enemy lasers don't inherit shooter frame velocity (`weapons.js:67` vs bombs at `enemies.js:181`); solver dt=0.1 vs game ≤0.05; detonation margins smaller than mesh radii (bombs sink half-in before exploding). Lasers feel no gravity at all (acceptable stylization). Atmospheric drag applies to ship only — bombs punch through atmospheres.

---

## B. System roster — current vs requested (headline: most of it already exists)

Current universe has **6** systems (5 campaign + free-roam "Véu"), fully data-driven: `{def, bodies(), decorations()}` factories in `universe.js:54-63`, single builder `buildUniverse()` (`system.js:20-35`), pluggable motion (Pinned/KeplerRail/MoonRail/EllipseRail/BinaryPair/NBodyDynamic).

| # Requested | Status | Notes |
|---|---|---|
| 1. Solar (keep) | ✅ exists | zero work |
| 2. Betelgeuse + companion | ✅ **already exists** (S2) | `RedSupergiant` with convection cells + lumpy limb + dust plume; companion **Siwarha** already orbits it (`universe.js:107-108`). Optional: upgrade Pinned+rail to barycentric `BinaryPair`. |
| 3. BH + red giant being eaten | 🟡 ~60% reusable | Full `BlackHole` anatomy exists (ISCO 3rs disk, photon rings, jet, `stars.js:355-471`); `RedGiant` w/ pulsation exists; **Véu system is the exact precedent** — `accretionStream(giant, dwarf)` already tracks two moving bodies and terminates at the sink's disk (`system.js:71-101`). **Must build:** (a) directional tidal teardrop on the giant — current `uLump` is isotropic noise (`atoms.js:40-43`); add `uTideDir`/`uTideAmp` to `STAR_VERT`; (b) curved Roche-lobe stream — current stream is a straight additive cylinder, reads as a beam not a "plasma hand"; needs a ballistic arc from the L1 side wrapping into the disk plane + hot spot; (c) Roche/Eggleton lobe + L1 math in `physics.js` (pure, unit-testable). |
| 4. NS orbiting a star | ✅ ~95% pure data | Complete pulsar (`NeutronStar`: strobe, lighthouse, torus, jets) + any star + `BinaryPair` w/ derived barycentric radii/Kepler period — exact S3/S6 assembly pattern. Nothing to build. |
| 5. Sagittarius A* | ✅ **already exists** (S5) | SMBH literally named "Sagitário A✦" with 12 S-stars on exact Kepler ellipses + Hill SOIs + quiescent disk + no-tide SMBH physics. Keep as-is. |

**Deleted by the swap:** `chaotic` (only `NBodyDynamic` consumer — integrator goes dormant but keep it) and the old S3 BH+NS pairing (both bodies recycled into new #3/#4).

**Swap hazards (must sweep, or campaign/map/enemies silently break):** hardcoded system/body keys in `campaign.js:16-55` (visit keys `halley`/`siwarha`/`neutron`/`sgr`), `missions.js:124` (`'binary'` has no surfaces — the new roster has THREE low-surface systems), `enemies.js:96-97`, `map.js:112-120`, `starlod.js:38-44` (glow tints), `gravity.js:34` (`DYNAMIC_SYSTEMS`). Recommendation: move per-system campaign/spawn/tint data into the `SYSTEMS` registry.

**Config trap:** three stacked in-place mutation scale passes (`config.js:332-418`) — a def added before them gets ×4×8 centers; after (or in `universe.js` like Véu, deliberate dodge at `universe.js:29-31`) does not. Author new systems the Véu way, then long-term collapse the passes into final literals.

**Physics realism notes:** EllipseRail/BinaryPair are μ-consistent (use them for the new binaries); circular `KeplerRail` planet periods are gauge values decoupled from μ (Earth rail ~4× slower than vis-viva) — masked internally, but don't copy the pattern. Memory's "WALL SCALE ×10" is obsolete — replaced by the "PROPORÇÕES VERDADEIRAS" reform. `config.js:170` header still says 5 systems (there are 6).

---

## C. "Systems as phases" — architecture verdict

**Today: all 6 systems are instantiated into one `THREE.Scene` at boot** (`main.js:25-39` → `buildUniverse`, `system.js:22-27`), centers 16–27M u apart, and are **never disposed** — only visibility-culled at `1.15×radius` (`updateSOIView`, `system.js:52-65`). Simulation is never culled: every rail/ellipse/binary advances every frame (`orbits.js:106-207`), the chaotic system's velocity-Verlet integrates at 1/90s substeps even 25M u away, `updateFarStars` LODs every star every frame, and gravity does O(all-bodies) scans per ship+projectile per frame.

**Worst consequence — float32 precision:** system centers reach ~27M u; float32 quantizes above 16.7M u to ≥2-u steps — the ship is 2.0 u. GPU matrices/uniforms carry ship-sized jitter when playing in Betelgeuse/Véu/core. Log depth buffer fixes only z-fighting, not XY quantization. **A phase refactor that rebases the active system to the origin eliminates this class entirely.**

**Good news:** per-system instantiation is already factored as lazy factories; the campaign is already a linear system-ordered phase list (`campaign.js:16-55`); journey is already a modal state suspending flight; starfield (camera-modulo wrap) and skybox (camera-centered) are phase-ready.

**What must change for phases** (all-systems-in-one-world assumptions):
1. Nav primaries are live body records of all systems (`nav.js:28-36`) → become static `SYSTEMS` descriptors.
2. Journey re-resolves the live target body per tick (`journey.js:99-107`) → target a descriptor; arrival triggers the destination loader.
3. Gravity's interstellar fallback assumes far bodies exist (`gravity.js:57-74`) → explicit travel-phase regime.
4. Map projects all bodies galaxy-wide (`map.js`) → galaxy layer from `SYSTEMS` + local layer from loaded bodies.
5. Far-system glows are built from live star records (`starlod.js:88-97`) → static per-system luminosity in `SYSTEMS`.
6. Enemies/missions of old phases persist and update forever (`enemies.js:145-193`) → retire on phase unload (correctness + perf win).
7. Ship boot hard-binds Earth for landing/menu (`ship.js:198-199`, `main.js:42-45`) → parameterize by loaded system.
8. **Precondition #1:** there is no dispose discipline anywhere (only higgs.js ever disposes) and world state is smeared across module-private arrays (`bodyFx`, `_stars`, `_glows`, `primaryTargets`) + an untyped god `game` object. Introduce a `SystemRuntime` object owning bodies/dynBodies/fx/enemies/targets with an atomic `dispose()`.
9. **Precondition #2:** untangle the aliased in-place `config.js` scale passes (`BINARY.center = SYSTEMS[2].center` etc.) before any origin rebasing.
10. Naming collision: `game.phase` (UI FSM) vs campaign phase vs the new system-phase — rename (`game.screen`, `campaign.stage`) before the refactor.

Dead/vestigial code to sweep first: empty `spawnEnemies()` stub, `bodies.js` facade whose name lies, unused `'clear'` mission type, dead `NBodyDynamic.anchor` path, `game.started`/`sunFlareVisible` without writers, brahistochrone profile kept only as doc.

---

## D. Consolidated priority plan

**P0 — the two reported bugs (small, surgical):**
1. Starfield: remove the journey fade floor (`starfield.js:270`); boundary-gate visual β (starfield + postfx) by `systemFade(ship.pos)`; unify the 4 "inside a system" thresholds.
2. Higgs well: real force profile (Plummer + `wellReach`), keep 600 only as near-core safety cap.
3. Nuke: gate SOI capture guidance on relative speed vs local v_esc.

**P1 — foundations for the roster+phase work (do BEFORE the swap):**
4. Collapse the three `config.js` scale passes into final literals; de-alias shared center arrays.
5. Introduce `SystemRuntime` with `dispose()`; index bodies per system; sweep dead code; rename the phase/screen collision.
6. Move per-system campaign/spawn/tint/luminosity data into the `SYSTEMS` registry (single source of truth).

**P2 — phases (systems as levels):**
7. Load only the active system at phase entry (rebased to origin); dispose on exit; travel phase = starfield+skybox+glows+relativistic postfx only; arrival loads destination. Kills the float32 jitter, the off-system simulation tax, and enemy leakage in one move.
8. Position-based journey presentation state machine (departing/cruise/arriving).

**P3 — new roster:**
9. S2 Betelgeuse: optionally upgrade to barycentric BinaryPair (rest exists).
10. S3 BH + red giant: Roche/Eggleton + L1 math in `physics.js`; `uTideDir/uTideAmp` teardrop in `STAR_VERT`; curved ballistic stream (L1 → disk plane, hot spot) replacing the straight cylinder; assemble via `BinaryPair` + existing `BlackHole`/`RedGiant`.
11. S4 NS + star: pure data assembly (+ optional supernova remnant shell).
12. S5 Sgr A*: keep; rename entry.
13. Remap campaign/missions/enemies/map keys; re-check hunt-site fallback (3 low-surface systems); update menu pitch text (`main.js:49-66`) and the `config.js` header comment.

**P4 — polish:** enemy gravity bias (wells at minimum), enemy laser frame velocity, SOI-boundary accel blending, detonation margins ≥ mesh radius, skybox aberration (or at least gate the postfx pinch on the boundary factor), solver dt alignment.
