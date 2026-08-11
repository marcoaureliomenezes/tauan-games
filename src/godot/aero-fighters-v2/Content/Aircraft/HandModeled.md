# aero-fighters-v2 — Generic Delta-Wing Fighter (Hand-Modeled Spec)

> Closes T-003 (release `aero-fighters-v2-photorealistic-inhauma-v1`).
> Author: game-developer (designer hat) — 2026-05-17
> Path: hand-modeled (CC0 source not located after prior agent search; rationale below)

## Rationale for hand-model path

A prior agent searched Sketchfab CC0, PolyHaven, OpenGameArt, and Kenney sources
exhaustively (82 tool uses). Candidates found were either:

- Real-world aircraft likeness (F-35/MiG/Su-27 variants) — rejected per FR-V2-04 and §4 Non-Goals
- Wrong format (`.blend` only, no direct UE5 `.fbx`/`.glb` import path) — rejected per the asset format constraint
- License-ambiguous (CC-BY or "free for personal use" instead of CC0 1.0) — rejected per §7

Hand-modeling avoids all three failure modes and gives full IP-likeness control.
Wave 3's `game-developer` will assemble the mesh inside UE5 from BP primitives.

## Geometry overview (top-down sketch, cm units)

All dimensions are in centimeters (UE5 default Unreal Unit = 1 cm).
Origin at aircraft center of mass (between wings, just behind cockpit).
+X forward, +Y right, +Z up.

```
              nose (Z+ slight)
                ▲
                │  80 cm cone
                │
        ┌───────┴───────┐
        │   canopy 120  │  cockpit bubble
        │   x 100 x 50  │
        │   (semi-       │
        │    transparent)│
   ┌────┴───────────────┴────┐
   │                          │  ← delta body, 600 cm wingspan
   │      delta body          │     900 cm length (root chord)
   │      (single triangle)   │     thickness 50 cm at root,
   │                          │     thinning to 10 cm at tips
   └──────┬───────────┬───────┘
          │           │
       150│           │150   ← horizontal stabilizers
       cm │   tail    │ cm        (mini-deltas, 80x40 cm)
          │  fin      │
          │  ┌─┐      │
          │  │ │      │  ← vertical fin
          │  │ │         (single, 150 cm tall, 100 cm chord)
          │  └─┘
```

## Primitive list (6 components)

| # | Component | UE5 BP primitive | Approx dimensions (cm) | Material slot | Notes |
|---|---|---|---|---|---|
| 1 | Delta body | Static Mesh from Box + Triangle CSG, OR scaled Cone with custom UVs | 900 (L) × 600 (W) × 50→10 (H, root→tip) | M_AircraftBody | Flat-bottom, slight upper camber. Single piece for collision simplicity. |
| 2 | Canopy | Sphere scaled to ellipsoid | 120 (L) × 100 (W) × 50 (H) | M_Canopy_Translucent | Translucent material; sits on top of body, 200 cm forward of center |
| 3 | Nose cone | Cone (12 sides) | 80 (L) × 60 (base diam) | M_AircraftBody | Forward of body root by 80 cm; serves as cannon muzzle anchor (`Socket_Muzzle`) |
| 4 | Vertical fin | Wedge (Box scaled) | 150 (H) × 100 (chord) × 8 (thick) | M_AircraftBody | Single, centered on tail, vertical |
| 5 | Left horizontal stabilizer | Mini delta (small Triangle) | 80 (L) × 40 (W) × 5 (thick) | M_AircraftBody | Mounted to body, -Y direction from tail |
| 6 | Right horizontal stabilizer | Mini delta (small Triangle) | 80 (L) × 40 (W) × 5 (thick) | M_AircraftBody | Mirror of #5 on +Y side |

## Sockets (required for Wave 3 + 4)

| Socket name | Parent | Local position (cm) | Purpose |
|---|---|---|---|
| `Socket_Muzzle` | Nose cone | (0, 0, 0) at cone tip | Cannon muzzle for FR-V2-06 (Wave 4) |
| `Socket_ChaseCam` | Body | (-400, 0, 150) | Spring-arm anchor for chase camera (FR-V2-09) |
| `Socket_CockpitCam` | Canopy | (0, 0, 30) inside canopy | Cockpit camera (FR-V2-09) |
| `Socket_EngineFX` | Body | (-450, 0, 0) at body tail | MetaSound engine drone + future exhaust Niagara (FR-V2-12) |

## Material slots

- `M_AircraftBody` — flat-shaded metal (Wave 3 will create from UE5 default material; no external textures)
- `M_Canopy_Translucent` — translucent blue-gray (Wave 3, blend mode Translucent, opacity 0.4)

No external texture imports. All materials are procedural/parametric per CV-08
(no external assets rule).

## Polycount estimate

| Component | Approx tris |
|---|---:|
| Delta body | ~800 |
| Canopy | ~400 |
| Nose cone | ~96 |
| Vertical fin | ~24 |
| 2× horizontal stabilizers | ~96 |
| **Total** | **~1,416 tris** |

Within the 2,000–15,000 triangle target band; leaves headroom for Wave 4 detail
additions if needed.

## Wave 3 acceptance criteria (for the game-developer who will build this)

- All 6 primitives present as named components on `BP_PlayerPawn`
- All 4 sockets named exactly as listed (Wave 4 cannon and camera code will look them up by name)
- Static Mesh assets named `SM_DeltaWing_Body`, `SM_DeltaWing_Canopy`, `SM_DeltaWing_Nose`, `SM_DeltaWing_VFin`, `SM_DeltaWing_HStab`
- Materials `M_AircraftBody` and `M_Canopy_Translucent` created in `Content/Aircraft/Materials/`
- Pawn fits a 9 m × 6 m × 2 m bounding box (sanity assertion)

## Future asset additions (out of scope for T-003)

The audit table for Niagara FX (cannon muzzle flash, hit explosion, bullet
trail) and CC0 audio (cannon WAV, hit WAV, explosion WAV, MetaSound jet engine
drone) will be appended to this file by Wave 4 (`game-designer` hat) when those
assets land.
