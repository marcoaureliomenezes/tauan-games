---
title: Space War celestial-body component library (simulation-first componentization)
status: candidate
opened: 2026-07-03
release: space-war-celestial-components-v1
description: Replace the hand-wired per-system celestial-body construction in space-war with a reusable, parametrized component library — a CelestialBody physics base, a Star superclass with NASA-taxonomy subclasses (main sequence, red dwarf, red giant, red supergiant, white dwarf, neutron star, black hole, brown dwarf), plus planets, moons and comets — so any body is instantiated by passing physical parameters (mass, angular velocity, orbit) and automatically interacts in systems, making new/refined systems (binaries, black holes, galactic cores) declarative instead of bespoke code.
intents:
  - subject:
      kind: catalog
      ref: games-catalog
    change: "space-war: componentize celestial bodies into a reusable parametrized library (Star superclass + NASA-taxonomy subclasses, planets, moons, comets, black holes, neutron stars) instantiated by physical parameters (mass, angular velocity, orbit) and interacting through the existing gravity/orbit regimes; the 5 systems become declarative data consumed by one generic builder."
  - subject:
      kind: doc
      ref: memory/architecture.md#Camadas
    change: "Add a space-war celestial-body component layer: typed body components + pluggable motion components (rail, ellipse, binary pair, N-body, pinned) consumed by a single declarative system builder, replacing the per-system bespoke construction in bodies.js."
---

# Space War celestial-body component library

## Operator Goal

Componentize the celestial bodies of `space-war/` so the game is treated as a
**simulation**: every star, planet, black hole, neutron star and comet is a reusable
component that can be **instantiated with parameters** (mass, angular velocity, radius
overrides, orbit) and, once instantiated, **interacts with the other bodies in its
system** through the existing gravity/orbit machinery. Refining the physics or the
appearance of a body *type* must propagate to **all** instances of that type, instead
of requiring per-element edits. This is the foundation for authoring richer maps with
interesting systems (binaries, black holes, neutron stars, galactic cores) at low
effort.

Reference mandated by the operator: NASA star taxonomy —
<https://science.nasa.gov/universe/stars/types/>. The library must model a `Star`
superclass with subclasses that inherit from it and add their own characteristics.

## Current State Found (inspection 2026-07-03)

The operator's suspicion of inefficiency is confirmed. Construction is hand-wired per
system, not componentized:

- `space-war/src/bodies.js` (1,193 lines) holds **all** body construction. There are
  good reusable *primitives* buried in it — `buildStar` (parametrized star shader:
  `cellScale`, `lumpyLimb`, color ramp + corona), `diskMaterial` (accretion disk
  shader, fire/synchrotron palettes), `buildBlackHole`, `buildNeutronStar`,
  `buildSupernovaRemnant`, `atmosphere`, `ringMesh`, procedural planet textures — but
  they are module-private functions, not components.
- Each of the 5 systems has its own bespoke assembly function (`buildSolarSystem`,
  `buildBetelgeuseSystem`, `buildBinarySystem`, `buildChaoticSystem`,
  `buildCoreSystem`) that hand-wires visuals, physics registration and motion regime.
  Adding or refining a system means writing/patching one of these bodies of code.
- A body "instance" is an **untyped object literal** assembled ad hoc in at least 5
  different places (`buildPlanetBody`, `registerStar`, the Betelgeuse companion, the
  core SMBH, the binary BH/NS pair), each with a slightly different field set
  (`binaryPair`, `ellipse`, `dynamic`, `orbitCenter`, `isMoon`, `isSun`…). There is no
  class hierarchy and no single constructor; nothing enforces the contract that
  `gravity.js`/`orbits.js` rely on.
- Physical parameters live in `config.js` as per-system literal blobs (`SUN`,
  `PLANETS`, `BINARY`, `BETELGEUSE`, `CHAOTIC`, `CORE`) where every body's `mu`,
  `radius`, `soi`, `spin`, colors and shader knobs are **hand-authored numbers**, then
  mutated in place at module load by two scaling passes (`approachScale` ×22/×9/×6 and
  the ×4 distance pass). Mass does not *determine* anything — color, size and SOI are
  all manually kept consistent by the author.
- Motion regimes are scattered across ad-hoc flags: `orbits.js` runs 5 regimes keyed
  off `binaryPair` / `ellipse` / `dynamic` / `orbitCenter` / `isMoon`, and
  `gravity.js` special-cases systems via a hard-coded `DYNAMIC_SYSTEMS` set.
- Some physics IS already principled and must be preserved as library laws: vis-viva
  for the chaotic pair, Kepler `T = 2π√(a³/μ)` for the binary, Hill-sphere SOI
  (`r_H = r_p·∛(μ*/3μ_BH)`) for the core S-stars, velocity-Verlet N-body integration,
  exact frame acceleration on rails.
- **No comets exist anywhere** (they are requested both by the operator's goal and by
  the sibling backlog entry `space-war-phased-campaign-physics-enemies`).

Net effect: instantiating "one more star" or "a second black-hole system" requires
new bespoke code, and refining the look/physics of a body type requires hunting every
hand-built instance.

## Desired Product Direction

A **celestial-body component library** with three contracts per body:

1. **Physics contract** — `CelestialBody` base: mass (in Earth-masses or solar
   masses; `μ = MU_EARTH · mass` keeps the game scale), radius, spin / angular
   velocity, SOI (derived: Hill sphere when a parent exists, `defaultGravReach`
   otherwise), collision surface. Every instance exposes the exact record
   `gravity.js` / `orbits.js` already consume — those modules keep working unchanged.
2. **Visual contract** — each type owns its appearance recipe built from the shared
   atoms (star shader, corona, disk shader, atmosphere, rings, jets, procedural
   textures) so a refinement to the type's recipe restyles **every** instance.
3. **Motion contract** — motion is a pluggable component attached at instantiation:
   `KeplerRail` (circular), `EllipseRail` (the existing `makeEllipse` law),
   `BinaryPair` (barycentric), `NBodyDynamic` (velocity-Verlet swarm), `Pinned`
   (system primary). Any body type can carry any motion component.

**Star hierarchy (NASA taxonomy, operator-mandated inheritance):**

- `Star` (superclass): convection shader, corona, point light, limb darkening; mass
  → temperature → color ramp and mass → radius defaults, so `new MainSequenceStar({
  mass: 0.2 })` *is* a red dwarf (orange, small, trillion-year steady burn) and
  `mass: 15` is a hot blue-white star — per NASA, main-sequence stars span ~0.1–200
  solar masses and ~90% of stars.
- Subclasses adding their own characteristics: `RedGiant` (< 8 M☉ evolved: inflated
  radius, orange, pulsation), `RedSupergiant` (Betelgeuse: giant convection cells
  `cellScale≈1.8`, lumpy limb, dust envelope + plume), `WhiteDwarf` (Earth-sized
  remnant, blue-white→red cooling, no fusion — optional debris disk), `NeutronStar`
  (city-sized, 8–20 M☉ supernova remnant; pulsar spin + lighthouse beams + synchrotron
  torus + dipole cage already exist as code; magnetar variant optional), `BlackHole`
  (> 20 M☉ collapse or SMBH: event horizon, photon ring, differential-rotation
  accretion disk, Doppler beaming, lensing billboard, optional relativistic jet),
  `BrownDwarf` (13–80 Jupiter masses, near-no visible light — optional, cheap once
  the ramp exists).
- Mass-determined fate as **library law**: the type ladder (< 8 M☉ → white dwarf,
  8–20 M☉ → neutron star, > 20 M☉ → black hole) documented in the library so authored
  systems stay astrophysically coherent (e.g. a supernova remnant shell belongs
  around a compact remnant, as the binary system already does).

**Non-stellar components:** `Planet` (kinds rock/gas/ice/earth/cloud with their
procedural textures, atmosphere, rings), `Moon` (parent-relative rail), `Comet`
(**new**: high-eccentricity `EllipseRail` + procedural coma and anti-sunward tail that
lengthens near periapsis).

**Declarative systems:** a star system becomes data — a list of component
instantiations (type + parameters + motion) — consumed by **one** generic system
builder. The 5 existing systems are re-expressed this way with zero gameplay/visual
regression; the 5 bespoke `buildXSystem` functions are deleted. Orbit-consistency math
(vis-viva insertion velocity, barycentric radii, Kepler periods, Hill SOI) is done by
the library, not by the system author.

## Scope Candidate

- Extract shared visual atoms (star/disk/remnant shaders, corona/radial sprites,
  atmosphere, rings, flares, procedural textures) into reusable modules.
- `CelestialBody` base + typed instantiation API (`new <Type>(params)`) with
  mass-derived defaults and explicit overrides; uniform body record for
  `gravity.js`/`orbits.js` (those two files should need little to no change — that is
  the proof the componentization is real).
- `Star` superclass + subclasses above; planets/moons/comets as components.
- Motion components unifying the 5 existing regimes; ad-hoc flags replaced by the
  attached component.
- One declarative system builder; migrate all 5 systems; delete the bespoke builders.
- Comet component + at least one comet placed in the Solar System (feeds the
  phased-campaign entry).
- A demonstration that the goal is met: author one **new** exotic system (e.g. red
  giant + white dwarf binary with a comet) purely declaratively.
- Tests: Playwright smoke parity for the 5 migrated systems (screenshots), plus
  derivation-law checks (mass→color/radius monotonicity, Hill SOI, vis-viva, Kepler
  period) run in the existing test harness.

## Acceptance Criteria Draft

- AC-01 Any celestial body is created through a typed component API by passing
  physical parameters (at minimum mass; optionally angular velocity/spin, radius or
  visual overrides, motion component) — no body is assembled as an ad-hoc literal.
- AC-02 `Star` is a superclass; each star type is a subclass that inherits from it
  and adds its own characteristics, following the NASA taxonomy (main sequence
  incl. red dwarf, red giant, red supergiant, white dwarf, neutron star/pulsar,
  black hole; brown dwarf optional).
- AC-03 For main-sequence stars, mass alone determines coherent defaults for color,
  radius and μ (0.2 M☉ reads as a red dwarf; 15 M☉ reads as a hot blue star).
- AC-04 Black holes, neutron stars, planets, moons and comets are instantiable
  components sharing the same base contract as stars.
- AC-05 Instantiated bodies interact in their system out of the box: ship gravity,
  body motion, SOI/HUD behavior and collisions work for any new instance **without
  editing `gravity.js` or `orbits.js`**.
- AC-06 Refining a type's physics or appearance in one place visibly propagates to
  all instances of that type (e.g. one edit restyles all main-sequence stars across
  solar, chaotic and core systems).
- AC-07 The 5 existing systems are rebuilt declaratively on the library with visual
  and physics parity (smoke + screenshot regression green; bespoke per-system builder
  functions removed).
- AC-08 A new exotic system can be added by data/instantiation only — demonstrated in
  the release with a red-giant + white-dwarf binary (or equivalent) including a comet.
- AC-09 Comets exist as first-class components with eccentric orbits and anti-sunward
  tails.
- AC-10 Derivation-law tests (mass→appearance, Hill SOI, vis-viva, Kepler period) and
  Playwright smoke for `space-war/` pass in CI.

## Relationship to Other Backlog

- `space-war-phased-campaign-physics-enemies` (candidate, 2026-07-03): that entry
  asks for comets, harder body realism and phase systems. **This library is its
  enabler** — campaign phases author systems; authoring systems cheaply requires the
  component library. Suggested order: component library first (or as the foundation
  release), campaign consumes it.

## Open Decisions for Release Definition

- Inheritance depth vs composition: classes for the star taxonomy (operator asked for
  inheritance) with motion/visual atoms as attached components is the working
  proposal — confirm at SPEC time.
- Units: keep game-scale μ (`MU_EARTH = 3.0e6`) with mass expressed in Earth/solar
  masses at the API, or introduce a scale layer; and whether the two load-time
  mutation passes (`approachScale`, ×4 distances) fold into the component defaults.
- File layout: `space-war/src/bodies/` package (one module per type + shared atoms)
  vs a flatter split; `bodies.js` today is 1,193 lines and must shrink to assembly
  glue.
- Whether Betelgeuse's dust envelope/plume and the supernova remnant shell become
  general-purpose components (`CircumstellarEnvelope`, `SupernovaRemnant`) or stay
  system-specific decorations in v1.
- Magnetar and brown-dwarf subclasses: in-scope for v1 or follow-up.
