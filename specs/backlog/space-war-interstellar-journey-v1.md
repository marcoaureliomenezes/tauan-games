---
title: Space War interstellar journey — travel the galaxy between systems (operator 2026-07-04)
status: candidate
opened: 2026-07-04
release: space-war-interstellar-journey-v1
description: Operator demand (verbatim intent): navigating between systems today is "into the nothing". New flow — [T] target another system, [O] orient to it, [Z] engage the interstellar burn (context-sensitive Z: cross-system target = journey, in-system = assist toggle, operator-approved). Journey is a BRACHISTOCHRONE, accelerate to midpoint then decelerate symmetrically, time-normalized ~3:00-6:00 min proportional to distance. The galaxy must EXIST between systems: thousands of stars streaming past with PARALLAX that intensifies with speed (some near, some far), star systems and nebulae (Ha red / OIII teal / reflection blue) crossed en route, the galactic-bulge star cloud visible when pointing at Sagittarius A*, and REALISTIC relativistic visuals at peak speed (aberration bunching stars forward, Doppler blue/redshift — operator picked realistic over cinematic). Also ship visibility - stronger plasma engine jet, red wingtip lights, reflex/rim so the ship reads on screen.
intents:
  - subject:
      kind: catalog
      ref: games-catalog
    change: "space-war: interstellar journey (T/O/Z brachistochrone autopilot between systems, 3-6 min time-normalized), parallax starfield corridor (thousands of streaming stars + nebulae), galactic-bulge cloud toward Sgr A*, realistic relativistic aberration/Doppler at peak speed, ship visibility pass (plasma jet, red wingtip lights)."
  - subject:
      kind: doc
      ref: memory/architecture.md#Camadas
    change: "Space War Degrau 2: journey autopilot module + chunked interstellar starfield layer + relativistic screen-space pass documented in the celestial/postfx stack."
---

# Space War interstellar journey

Demand verbatim (operator, 2026-07-04): to navigate to another system, point with [T],
orient with [O], accelerate with [Z] at extreme velocities; cross MANY stars en route
(some close — parallax effect, increasingly aggressive as speed rises), see nebulae and
gas clouds, the famous Milky-Way-center cloud when heading to Sgr A*; accelerate to the
middle of the journey then decelerate at the same rate, visual effects smoothing back
down until arrival at the target system; travel measured in TIME (choose 3:00-6:00 min
range, proportional between systems); relativistic length/aberration effects as speed
increases. "It's really a hard physical simulation that we are trying to do here." Also:
the spaceship is hard to see — improve the propulsion plasma jet, add red wing lights
with reflex.

Physics grounding: brachistochrone a = 4D/T²; relativistic aberration
cos θ' = (cos θ − β)/(1 − β cos θ) + Doppler ν' = νγ(1 + β cos θ) (headlight effect);
research brief at .dadaia/tmp/claude/20260704/physics-brief-interstellar-travel.md.
Operator decisions (2026-07-04 AskUserQuestion): ship physics-fidelity-v1 first;
context-sensitive [Z]; realistic (not cinematic) relativity.
