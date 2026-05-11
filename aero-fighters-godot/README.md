# Aero Fighters Godot

Port of the Three.js Aero Fighters game to Godot Engine 4.x (GDScript).

## How to Open

1. Install Godot 4.4.x from https://godotengine.org/download
2. Launch the Godot editor: `godot4 --editor`
3. File > Open Project > select this directory (`aero-fighters-godot/`)
4. Press F5 or the Play button to run

## Controls

| Key | Action |
|---|---|
| Arrow Up / Down | Pitch (nose up / down) |
| Arrow Left / Right | Roll + coordinated yaw |
| Q / E | Rudder (pure yaw) |
| W / S | Throttle up / down |
| Space | Fire cannon |
| X | Fire light missile |
| N | Fire nuclear missile |
| Shift | Barrel roll |
| Escape | Pause |

## Export to HTML5

1. Install export templates: Editor > Manage Export Templates > Download
2. Project > Export > HTML5 > Export Project
3. Files saved to `export/`
4. Serve locally:

```bash
cd /home/ubuntu/workspace/repos/tauan-games
python3 -m http.server 8082
```

5. Open: http://localhost:8082/aero-fighters-godot/export/

## Architecture

```
project.godot          -- project config, input map, autoloads
scripts/
  config.gd            -- all constants (mirrors Three.js config.js)
  game_state.gd        -- autoload singleton, all mutable state
  mission_manager.gd   -- autoload: target spawning, terrain queries
  player.gd            -- CharacterBody3D + manual 6DOF flight physics
  target_*.gd          -- 5 target types (base, factory, building, convoy, aaGun)
  bullet.gd            -- fast cannon round (110 m/s, 2s life)
  missile.gd           -- homing missile (light + heavy variants)
  nuclear.gd           -- nuclear missile (180m AoE blast)
  world/
    island_generator.gd -- procedural islands via SurfaceTool dome formula
    ocean.gd            -- animated 64x64 wave mesh
    sky_controller.gd   -- day/night cycle (5-min full cycle)
    cloud_system.gd     -- 60 drifting procedural clouds
  ui/
    hud.gd              -- speed/altitude/throttle/score labels
    minimap.gd          -- radar with player + target dots
  main.gd               -- scene root, camera rig, game flow
scenes/
  Main.tscn             -- root scene
  Player.tscn           -- F-35 player
  targets/              -- Base, Factory, Building, Convoy, AAGun
  weapons/              -- Bullet, Missile, Nuclear
  maps/                 -- Islands, Desert, Rio
```

## Maps

- **Islands** (default): 18 procedural islands with dome terrain, ocean, 19 targets
- **Desert**: mesa terrain with dust floor, 12 targets
- **Rio**: Guanabara Bay setting, mixed morros and sea targets

## No Build Step

No npm, no bundler. Open `project.godot` in the Godot editor directly.
