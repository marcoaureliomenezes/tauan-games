# Aero Fighters Unity

Unity 6 port of the Three.js Aero Fighters game. Complete F-35 flight combat with
18 procedural islands, 6 target types, 3 missile systems, AA guns, warships,
and a full day/night cycle.

---

## Setup Instructions

### 1. Install Unity Hub

Download from https://unity.com/download and run the installer.

### 2. Install Unity 6 LTS

Open Unity Hub. Click **Installs → Install Editor → Unity 6 (6000.x LTS)**.
During installation, add the **WebGL Build Support** module (required for browser play).

### 3. Open the Project

Unity Hub → **Projects → Add → select this folder** (`aero-fighters-unity/`).
Unity will import scripts and generate Library/ on first open (takes 1–3 min).

### 4. Configure URP

Edit → Project Settings → Graphics → Scriptable Render Pipeline Settings.
Click the circle picker and select the URP asset (create one if missing:
Assets → Create → Rendering → URP Asset with Universal Renderer).

### 5. Configure Scene References (Inspector wiring)

Open `Assets/Scenes/Main.unity`. In the Hierarchy, select each GameObject
and wire the Inspector references:

**GameManager:**
- `MissionManager.PlayerObject` → Player GameObject
- `MissionManager.GameHUD` → HUD Canvas → HUD component
- `MissionManager.IslandGen` → World → IslandGenerator component

**Player:**
- `CameraFollow.Target` on Main Camera → Player Transform

**World:**
- `SkyController.SunLight` → Directional Light
- `SkyController.SkyDomeRenderer` → create a sphere child named SkyDome,
  assign `Assets/Shaders/SkyDome.shader` as its material

**Ocean:**
Add a child GameObject to World named "Ocean", add `OceanAnimator` component.

### 6. Build for WebGL

File → Build Settings → WebGL → Switch Platform → Build.
Output folder: `Builds/WebGL/`

Recommended Player Settings for itch.io:
- Resolution: 1920×1080, allow fullscreen
- Compression Format: Gzip
- Enable Exceptions: None (reduces build size)

### 7. Serve Locally

```bash
cd repos/tauan-games
python3 -m http.server 8083
```

Open: http://localhost:8083/aero-fighters-unity/Builds/WebGL/

---

## Controls

| Key | Action |
|---|---|
| W / S | Throttle up / down |
| Arrow keys | Pitch and roll (simulator style: Up = pitch down) |
| Q / E | Rudder yaw left / right |
| Left Shift | Barrel roll (invincible during roll) |
| Space / Z | Cannon fire (hold for continuous) |
| X | Fire light homing missile |
| B | Fire heavy missile |
| N | Fire nuclear missile |
| P / Escape | Pause |

---

## Physics Comparison: Three.js vs Babylon.js vs Unity

| Feature | Three.js (original) | Babylon.js port | Unity 6 (this port) |
|---|---|---|---|
| Delta-time | requestAnimationFrame | engine.runRenderLoop | FixedUpdate (50Hz fixed) |
| Flight model | Manual Euler integration, quaternion rotation | Same model, Babylon Quaternion | Same model, Unity Quaternion |
| Collision | Distance squared check per frame | Same approach | Trigger colliders + MeshCollider |
| Ocean waves | Vertex shader loop (JS, 64×64) | Same | C# FixedUpdate, every 2nd frame |
| Island terrain | PlaneGeometry + dome formula | Same geometry | Unity Mesh API, MeshCollider |
| Physics fidelity | Arcade: no drag, simplified lift | Identical | Identical (no PhysX interference) |
| Frame-rate dep. | No — dt-capped at 50ms | No | No — FixedUpdate is decoupled |

Unity advantage: MeshCollider for islands enables exact terrain collision.
Three.js advantage: no build step, instant iteration.
Babylon.js advantage: Inspector debugger for runtime mesh visualization.

---

## Project Structure

```
Assets/
  Scripts/
    Core/        GameConfig.cs, GameState.cs, MissionManager.cs
    Player/      FlightController.cs, WeaponSystem.cs, BarrelRoll.cs
    Targets/     TargetBase.cs, TargetConvoy.cs, TargetAAGun.cs
    Weapons/     Bullet.cs, HomingMissile.cs, NuclearMissile.cs
    World/       IslandGenerator.cs, OceanAnimator.cs, SkyController.cs,
                 CloudSystem.cs, ExplosionSystem.cs
    UI/          HUD.cs, Minimap.cs
    Camera/      CameraFollow.cs
  Scenes/        Main.unity, MainMenu.unity
  Shaders/       SkyDome.shader
Packages/        manifest.json (URP 17.0.3, InputSystem 1.11.2)
ProjectSettings/ ProjectSettings.asset, InputManager.asset, TagManager.asset
```

---

## Extending the Game

**Add a target type:** create a new class extending `TargetBase`, override
`OnKilled()` for explosion FX, add a prefab, wire in `MissionManager.GetPrefabForType()`.

**Add a map:** duplicate `TARGET_LAYOUT` pattern in `GameConfig.cs`, define island
positions as `ISLAND_DEFS`, select map in `MissionManager.SpawnMission()`.

**Add a weapon:** extend `MissileKind` enum, add constants in `GameConfig`, add
fire logic in `WeaponSystem.Update()`.
