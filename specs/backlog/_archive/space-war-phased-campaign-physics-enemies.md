---
title: Space War phased campaign, physics, and enemy overhaul
status: delivered
opened: 2026-07-03
release: space-war-campaign-v1
delivered: 2026-07-03 — PR #11 (8ae4b75); CLOSURE em specs/_archive/releases/space-war-campaign-v1/
description: Convert Space War from a fully open five-system sandbox into an ordered campaign that starts in the Solar System, unlocks the remaining systems in sequence, improves Solar System scale and gravity, and makes enemies, bases, bombs, and mission progression physically credible.
intents:
  - subject:
      kind: catalog
      ref: games-catalog
    change: "space-war: ordered 5-phase campaign (solar→betelgeuse→binary→chaotic→core) with per-system missions and unlock gating; enemy overhaul (body-relative frames, roles, gravity-ballistic bombs); reloadable nukes; campaign-aware map/HUD; solar lens-flare made local (bug space-war-solar-flare-universe-overlay)."
  - subject:
      kind: doc
      ref: memory/architecture.md#Camadas
    change: "Add a space-war campaign layer (campaign.js phase data + mission executor) above the celestial component library; enemies move in body-relative frames and heavy ordnance shares the ship's gravity field."
---

# Space War phased campaign, physics, and enemy overhaul

## Current State Found

- `space-war/` is a Three.js r165 browser game with no build step, exposing `window.__spaceWar`.
- The game already has five stellar systems in `src/config.js`: Solar System, Betelgeuse, black-hole + neutron-star binary, chaotic binary (`Azurak`/`Karvon`), and Galactic Core / Sagittarius A*.
- Navigation is open: `src/nav.js` lets the player target the five primaries and local bodies, and `src/ship.js` uses interstellar overdrive outside strong gravity.
- Current missions in `src/missions.js` are Solar-System-only: Moon base, Mars fighters, Mars bases, Io fortress. Completing them wins with "Sistema Solar libertado"; there is no ordered five-system campaign yet.
- Gravity in `src/gravity.js` acts on the player ship through patched-conics plus tidal perturbations, with summed N-body behavior for the chaotic system.
- Player nukes in `src/weapons.js` already receive gravity and can be captured into orbital/spiral motion. Laser bolts and enemy shots do not; enemy fire is currently straight-line laser projectiles.
- Enemies in `src/enemies.js` are simple anchored patrol/pursuit actors near Mars, Jupiter, and Saturn. They do not have gravity-aware flight, bomb weapons, phase roles, or base-defense doctrine.
- Solar scale has already been changed once (`src/config.js` applies large body scaling and orbit-distance scaling), but the operator's latest playtest says the planets/moons/stars still need a harder realism pass.
- A visual bug was registered separately: `space-war-solar-flare-universe-overlay` in `specs/bugs/20260703T15Z-00.jsonl`.

## Desired Product Direction

The game should stop feeling like a flat open-universe playground and become a phased space-war campaign. The player starts bound to the Solar System, completes missions across planets, moons, and comets, then unlocks Betelgeuse, the black-hole/neutron-star binary, the chaotic binary, and finally Sagittarius A*. Each phase should have body-scale, gravity, enemies, bases, weapons, and mission logic that make the local system feel physically large and dangerous.

## Scope Candidate

- Campaign progression:
  - Start in the Solar System; other systems are visible/navigation-known but not mission-unlocked until the current phase is complete.
  - Use the inferred order: Solar System -> Betelgeuse -> black-hole + neutron-star binary -> chaotic binary -> Sagittarius A*.
  - Each system has a mission set, briefing/debriefing text, unlock criteria, and clear HUD/map state.
- Solar System realism pass:
  - Add comets ("cometas") as Solar System bodies or hazards with visible tails and mission relevance.
  - Recalibrate Solar distances from the current implementation; operator target is at least 2x more separation than the current feel while preserving playable travel through assists/overdrive.
  - Recalibrate planet, moon, and star perceived scale; operator target is bodies at least 10x more convincing in close approach, with distance perspective preserved so they are small far away and overwhelming near the surface.
  - Stars, planets, moons, black holes, and neutron stars must pull the ship and gravity-affected ordnance.
- Weapons and physics:
  - Player bombs/nukes are unlimited or mission-limited by cooldown/reload rather than a hard small ammo count.
  - Bombs/nukes remain ballistic entities affected by gravity from relevant bodies.
  - Decide whether lasers stay straight energy weapons or become short-lived physical bolts; do not leave bombs/gravity behavior ambiguous.
- Enemy overhaul:
  - Enemies fire bombs or heavy ordnance that also receive gravity.
  - Enemy ships should patrol/orbit/defend in body-relative frames instead of simple world-position lerp only.
  - Enemy behavior should support bases, escorts, interceptors, and mission defenders across phases.
  - Enemy fire should respect gravity, range, body occlusion, and player protection/start safety.
- Bases and surface scale:
  - Alien bases on moons/planets must be small surface installations, not moon-sized objects.
  - A base footprint must occupy no more than 3% of the host body's surface area; close approach reveals details instead of increasing base size unrealistically.
  - Bases remain attached to rotating/orbiting bodies and are legible only when the player gets close enough.
- Map/HUD:
  - The map must become campaign-aware: current phase, unlocked systems, locked future systems, mission targets, and local body/comet navigation.
  - Gravity and weapon HUD should explain when bombs are being bent/captured by a body.
- Bug integration:
  - The solar lens-flare overlay bug must be fixed in the same release or as a prerequisite hotfix before evaluating Solar/System scale visuals.

## Acceptance Criteria Draft

- AC-01 The player starts in a Solar System phase and cannot accidentally skip straight to later system missions.
- AC-02 Completing the Solar mission chain unlocks Betelgeuse; completing each phase unlocks the next, ending at Sagittarius A*.
- AC-03 Solar System includes planets, major moons, and comets, with bodies visibly small at distance and world-scale near the surface.
- AC-04 Gravity affects the player ship and all bomb/nuke entities fired by the player or enemies.
- AC-05 Player bombs/nukes are effectively unlimited through cooldown/reload or explicit mission design.
- AC-06 Enemy ships and bases use body-relative positioning and credible scale; bases never exceed the 3% surface-area cap.
- AC-07 Enemies can launch gravity-affected bombs/heavy ordnance and defend phase mission targets.
- AC-08 The sun flare/glare no longer appears as a universe-wide overlay when the player is far from the Sun or looking toward non-solar targets.
- AC-09 Playwright coverage includes campaign gating, gravity-affected player/enemy bombs, base footprint scale, Solar flare regression, and a smoke path for `space-war/`.

## Open Decisions for Release Definition

- Exact mission list per planet/moon/comet in the Solar phase.
- Which special weapons exist besides laser and nuke, and which missions require each weapon.
- Whether later systems are physically unreachable before unlock or reachable but mission-locked.
- Final numeric scale multipliers for current bodies and distances after visual probes.
- Whether enemy fighters themselves must be fully gravity-integrated actors or can use body-relative rails with gravity-aware ordnance.
