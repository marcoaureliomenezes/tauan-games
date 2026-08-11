---
title: "Aero Fighters: flight, combat & FX experience overhaul"
status: picked
opened: 2026-07-15
origin: operator demand 2026-07-15 (post-serra session — flight/combat/FX experience)
target_release: v0.2.12
description: >-
  Operator demand, verbatim scope (6 points, all mandatory): landing experience +
  airport design; player plane design + propulsion + turbine sound; takeoff
  experience; missile flight experience + range-independent 80% hit rule; nuclear
  explosion overhaul; new rod kinetic missiles. Final acceptance = operator plays
  the game locally with all improvements.
intents:
  - subject:
      kind: catalog
      ref: aero-strike-flight
    change: >-
      Flight/combat/FX overhaul (6 mandatory points): (1) clear runway + taxiway
      layout with natural touchdown → roll-out → taxi flow on paved surfaces; (2)
      better player jet model, finer throttle staging, improved propulsion
      jet/afterburner, turbine (not propeller) engine sound; (3) smooth realistic
      takeoff (acceleration, rotation, climb-out); (4) visible curved missile
      pursuit trajectories + always-80% hit chance regardless of launch range; (5)
      nuclear fireball overhaul (flash, growth, buoyant rise, mushroom, shockwave)
      + larger destruction radius; (6) new rod kinetic missiles (2× speed, pierce
      and continue, maneuvering, 3-kill guarantee within nuke action radius).
---

# Backlog — Aero Fighters: flight, combat & FX experience overhaul

Operator demand, verbatim scope (6 points, all mandatory, each to be researched,
understood, specified, implemented, tested and validated; final acceptance =
operator plays the game locally with all improvements):

## 1. Landing experience + airport design
Landing today "doesn't seem like a real landing". Problems: the airport is not
well designed; the *pista de pouso* (runway) is not visually clear; post-landing
taxi movements are not natural/smooth — on touchdown the plane is immediately
control-captured and moves OUTSIDE the runway/taxiway surfaces. Wanted: clear,
well-designed runway + taxiway layout; a natural touchdown → roll-out →
smooth taxi flow that stays on paved surfaces.

## 2. Player plane design + propulsion + sound
The player jet model can be better designed. Wanted: more velocity levels
(finer throttle/speed staging) and an improved propulsion jet (visual exhaust/
afterburner). The engine SOUND currently reads as a propeller plane ("hélice");
it must sound like the turbine of a strike jet.

## 3. Takeoff experience
Current takeoff movement is strange/unreal. Wanted: smooth realistic
acceleration down the runway, rotation, and a rising climb-out.

## 4. Missile flight experience + range-independent hit rule
Wanted: a better experience watching launched missiles fly to the target —
visible curved pursuit trajectories. Hit rule change: a launched missile must
ALWAYS have an 80% chance of hitting its target regardless of launch range
(today long-range launches systematically miss — that is wrong by design).

## 5. Nuclear explosion overhaul
The nuke fireball currently behaves strangely and effects are limited relative
to the explosion's size. Wanted: improved fireball look + rise behavior
(reference real nuclear-explosion phenomenology — flash, fireball growth,
buoyant rise, mushroom/cap, shockwave), and a LARGER destruction radius (ground
destruction is currently far too small for the visual size).

## 6. New weapon: rod kinetic missiles
New missile class "rod missiles" — kinetic penetrators: 2× the speed of current
missiles; they PIERCE enemies and continue to the next; they maneuver; one
launch always kills 3 enemies when 3 targets exist within an action radius equal
to the nuclear bomb's action radius.

## Constraints
- Same stack principles: no build step, no external runtime assets, procedural
  audio (existing synthesized-audio system), vendored Three.js r169.
- Terrain/Inhaúma serra work (previous release) must not regress; airport works
  on the new valley-shelf airport.
- Full SDD: research → SPEC → PLAN → TASKS → implement → test → validate;
  operator validates by playing locally (dev server up + registered at the end).

## Disposition
To be promoted to release `v0.2.12` after the serra
release ships (operator mandate 2026-07-15: full autonomous execution).

## Curadoria (2026-08-11, project-manager)

Normalização BL-SCHEMA: frontmatter canônico, status `OPEN` → `picked` (a release
`specs/releases/aero-fighters-flight-combat-v1/` existe — promovido; sem CLOSURE, logo
não marcado `delivered`), e `intents[]` retro-vinculado à âncora de catálogo
`aero-strike-flight`. Conteúdo original preservado.
