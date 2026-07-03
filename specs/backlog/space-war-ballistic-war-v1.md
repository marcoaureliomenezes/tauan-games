---
title: Space War ballistic strike warfare (playtest round 2026-07-03)
status: candidate
opened: 2026-07-03
release: space-war-ballistic-war-v1
description: Operator playtest demand: C computes a BALLISTIC firing solution (aim where to launch, not at the target — the nuke curves under the real gravity field of the componentized bodies into the target); launched ordnance follows honest gravity arcs; target hunt chain across different moons/capital ships (5/7/9/11/13 per phase, next target appears when one dies); legible enemy base anatomy + big capital ships; realistic nuke explosion (mushroom on surfaces).
intents:
  - subject:
      kind: catalog
      ref: games-catalog
    change: "space-war: ballistic firing solution on C (gravity-curved nuke arcs via the celestial component field), sequential hunt-chain targets across moons/capital ships (5+2 per phase), redesigned legible bases + capital ships, realistic nuke explosion VFX."
  - subject:
      kind: doc
      ref: memory/architecture.md#Camadas
    change: "Add ballistics.js (gravity-field firing-solution solver consuming computeGravity) to the space-war Degrau 2 structure."
---

# Space War ballistic strike warfare

Demand verbatim (operator, 2026-07-03 playtest): explosion must be realistic like a
nuke; C must aim WHERE TO LAUNCH so the bomb follows the gravity pull (curved
trajectory, body or combination of bodies — we have components now, apply the physics
seriously but not strictly); after destroying a target another must appear on another
moon (none appeared); enemies 5, 7, 9… +2 per phase, on bases on different moons or on
big spaceships orbiting celestial bodies; review enemy base anatomy (illegible today).
