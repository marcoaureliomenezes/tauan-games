---
title: Space War physics fidelity + gravitational arsenal (review round 2026-07-04)
status: delivered
delivered_in: space-war-physics-fidelity-v1
opened: 2026-07-04
release: space-war-physics-fidelity-v1
description: Operator goal 2026-07-04 following the literature-grounded physics review (report 2026-07-04T005415Z): apply ALL P1 violations fixes (NS must SHINE, NS mass under TOV, SMBH mass hierarchy, accretion stream direction) and ALL P2 upgrades (Paczynski-Wiita ISCO, disk inner edge 3rs, photon ring 2.6rs, tidal shred zone, stronger Doppler beaming, Betelgeuse companion mass, L~M^3.5 lights, assist fade in planet SOIs); add TWO new gravity-coupled weapons besides nukes — infinite luminous GRAVITATIONAL TRACER BOMBS (ballistic probes with visible trail to validate the field) and the HIGGS BOSON BOMB (temporary massive gravity well for seconds; destabilizes stars: 70% plasma extraction — arms/tendrils of plasma pulled out then re-absorbed when the well dies; 30% SUPERNOVA, guaranteed if the bomb plunges into the star before its pull ends; supernova = wonderful multicolor plasma explosion); and DYNAMIC APPROACH SCALE — bodies grow >=10x as the ship approaches so the horizon flattens to a straight line before contact (planets AND stars).
intents:
  - subject:
      kind: catalog
      ref: games-catalog
    change: "space-war: physics-fidelity round (literature-grounded compact-object fixes: shining pulsar, TOV-respecting masses, SMBH hierarchy, Paczynski-Wiita ISCO, tidal shred zones) + gravitational arsenal (tracer bombs [G] infinite/luminous, Higgs boson bomb [H] with plasma-arm extraction and multicolor supernova) + dynamic approach scale (flat-horizon walls on close approach)."
  - subject:
      kind: doc
      ref: memory/architecture.md#Camadas
    change: "Space War Degrau 2: gravity.js gains Paczynski-Wiita pseudo-potential for compact bodies and transient gravity wells (game.wells) consumed by ship/projectiles/plasma; document the mass/scale gauge (mu proportional to scale factor preserves surface speeds, T proportional to factor)."
---

# Space War physics fidelity + gravitational arsenal

Demand verbatim (operator /goal 2026-07-04): apply P1-1..P1-4 and P2 from the physics
review; don't stop until nukes + 2 more bomb types exist — gravitational bombs
(infinite, luminous, launched to validate gravitational pull behaviors) and the Higgs
boson bomb (huge gravitational pull for seconds; 30% supernova / 70% plasma arms pulled
from the star and re-absorbed when the pull stops; plunge into the star before the pull
ends = guaranteed supernova; supernova = wonderful multicolor plasma explosion); all 3
weapons interact with gravitational fields. Planets/stars must grow >=10x on approach
(flat-horizon wall; "orbiting tangent, the arc becomes a straight line"). Research
first, then apply. Whole workflow (definition/implementation/review) on the main
Fable 5 agent.

Physics grounding: literature briefs at .dadaia/tmp/claude/20260704/physics-brief-
{blackholes,neutron-stars,orbital-dynamics}.md + HTML review report (30+ refs). The
Higgs bomb's plasma-arm mechanic is tidal (Roche-lobe) mass extraction toward a
transient well; the supernova spectacle follows Crab-remnant multicolor filaments
(H red, O green-blue, S yellow).
