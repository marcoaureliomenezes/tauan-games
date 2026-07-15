---
name: aero-fighters-flight-combat-v1
status: OPEN
created: 2026-07-15
origin: operator demand 2026-07-15 (post-serra session — flight/combat/FX experience)
target_release: aero-fighters-flight-combat-v1
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
To be promoted to release `aero-fighters-flight-combat-v1` after the serra
release ships (operator mandate 2026-07-15: full autonomous execution).
