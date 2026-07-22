# Bang-Bang (Godot)

Velho Oeste aberto em **Godot 4.7** — cowboy montado caçando 5 bandidos foragidos.
Rebuild do jogo web (`src/web-games/bang-bag/`) com componentes de terceiros
(Terrain3D, ProtonScatter, packs CC0) — release `bang-bang-godot-v1`
(SPEC/PLAN/TASKS em `specs/releases/bang-bang-godot-v1/`).

## Rodar

```bash
godot4 --path src/godot/bang-bang            # editor
godot4 --headless --path src/godot/bang-bang # smoke headless (boot OK sem display)
```

## Estrutura

- `scenes/main.tscn` — entry point (overlay de start)
- `scripts/state.gd` — autoload `Game` (fonte única de verdade; contratos por campo)
- `addons/` — Terrain3D + ProtonScatter (pinados, ver `docs/VENDORS.md`)
- `tools/setup_input.gd` — grava o input map da SPEC em project.godot (rodado 1×)
- `Tests/` — suite headless (godot --headless)

## Controles (SPEC §3)

WASD cavalga · Shift galope · Space salto · mouse mira (independente) · LMB atira ·
1/2 ou Q troca arma · R recarga · F mira precisa · E interage · M mapa · V câmera ·
Esc pausa/libera o mouse.
