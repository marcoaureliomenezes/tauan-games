# TASKS — v0.3.8

- **Status:** Aprovado
- Release: `v0.3.8`
- SPEC/PLAN: `specs/releases/v0.3.8/{SPEC,PLAN}.md`

## T1 — Release SDD

- [x] T1 Bind tauan-games + SPEC/PLAN/TASKS aprovados + ACTIVE.md
  - Write set: `specs/releases/v0.3.8/*`, `specs/releases/ACTIVE.md`
  - Evidência: artefatos criados com Status Aprovado; ACTIVE.md apontando a release.

## T2 — Scaffold do projeto Godot

- [x] T2 `project.godot` (4.7, Forward+, input map, autoloads), cena main, README
  pt-BR com controles, harness de testes (probe/smoke/shot por env var)
  - Write set: `src/godot/space-war/project.godot`, `src/godot/space-war/scenes/**`,
    `src/godot/space-war/scripts/core/game_state.gd`, `src/godot/space-war/tests/**`,
    `src/godot/space-war/README.md`, `src/godot/space-war/.gitignore`
  - Evidência: `SPACEWAR_TEST=1 godot4 --headless --path src/godot/space-war` exit 0.

## T3 — Extração de dados do web

- [x] T3 `tools/extract_config.mjs` executa o pipeline de `config.js` e grava
  `data/systems.json` (valores efetivos dos 6 sistemas); loaders `BodyDef`/`SystemDef`
  - Write set: `src/godot/space-war/tools/extract_config.mjs`,
    `src/godot/space-war/data/systems.json`, `src/godot/space-war/scripts/world/*def*.gd`
  - Evidência: probe valida 6 sistemas, 8 planetas solares, 12 luas, contagens por sistema.

## T4 — Kernel de física

- [-] T4 Integrador da nave, gravidade patched-conics + maré + Paczyński–Wiita,
  trilhos analíticos (circular/elíptico/binário) + N-corpos caótico, atmosfera/reentrada
  - Write set: `src/godot/space-war/scripts/core/gravity.gd`,
    `src/godot/space-war/scripts/core/ship_physics.gd`,
    `src/godot/space-war/scripts/world/rails.gd`,
    `src/godot/space-war/scripts/world/nbody.gd`,
    `src/godot/space-war/tests/probe*.gd`
  - Evidência: probes — órbita circular fecha (<1% erro/período); v_circ/v_esc
    corretos; ISCO em 3·rs; reentrada aquece.

## T5 — Máquina de frames e mundos

- [ ] T5 `FlightFrame` (LANDED/LAUNCH/ORBIT/CRUISE/JOURNEY), `PhaseWorld` (planeta
  fixo na origem, gravidade só planeta+luas), `GalaxyWorld`, transições com
  histerese (1,0/1,15×) e transformações de frame (saída 1,5×; captura T+O a 3×)
  - Write set: `src/godot/space-war/scripts/core/flight_frame.gd`,
    `src/godot/space-war/scripts/core/frames.gd`,
    `src/godot/space-war/scripts/world/phase_world.gd`,
    `src/godot/space-war/scripts/world/galaxy_world.gd`
  - Evidência: probe — sair da fase a 1,5× e reentrar via captura sem deriva;
    em fase, translação do planeta não afeta a nave.

## T6 — Sequência de decolagem

- [ ] T6 LANDED→LAUNCH→ORBIT: W mantido, câmera lateral com paisagem, subida ~20 s,
  gravity turn ~10 s, inserção a 100 km/27.000 km/h, planeta fixo embaixo
  - Write set: `src/godot/space-war/scripts/core/launch.gd`,
    `src/godot/space-war/scripts/core/ship.gd`,
    `src/godot/space-war/scripts/ui/camera_rig.gd`
  - Evidência: probe de decolagem atinge 100 km a 27.000 km/h; screenshot da subida.

## T7 — Voo na fase

- [ ] T7 Frame local-nível, acelerar→subir/desacelerar→descer, reentrada,
  aproximação e órbita da Lua, estações sem gravidade, HUD km/h (27k–72k,
  W/S a 300 km/h/s), assistente de órbita (O), auto-aproximação (N), auto-mira (C)
  - Write set: `src/godot/space-war/scripts/core/ship.gd`,
    `src/godot/space-war/scripts/core/assist.gd`,
    `src/godot/space-war/scripts/ui/nav_overlay.gd`
  - Evidência: probes de altitude vs. aceleração; órbita da Lua fecha; screenshots.

## T8 — CRUISE, JOURNEY e mapa

- [ ] T8 Voo interplanetário (visão do sistema em translação), viagem interestelar
  trapezoidal 180–360 s (Z), mapa 2D (galáctico log + local linear, tecla M)
  - Write set: `src/godot/space-war/scripts/core/journey.gd`,
    `src/godot/space-war/scripts/world/galaxy_world.gd`,
    `src/godot/space-war/scripts/ui/map_2d.gd`
  - Evidência: probe de journey (chegada no alvo com residual); screenshots do mapa.

## T9 — Visual dos corpos celestes

- [ ] T9 Skybox NASA/ESO, texturas CC-BY de planetas/luas, atmosfera (arco azul),
  Terra (nuvens + city lights), gigantes gasosos, anéis, sol/estrelas/coroa,
  pulsar, cometa, buracos negros + discos (custom), ATTRIBUTION.md
  - Write set: `src/godot/space-war/scripts/bodies/**`,
    `src/godot/space-war/shaders/**`, `src/godot/space-war/assets/**`,
    `src/godot/space-war/tools/fetch_assets.sh`
  - Evidência: screenshots de aceitação por corpo inspecionados; ATTRIBUTION.md completo.

## T10 — Seis sistemas completos

- [ ] T10 Todos os sistemas navegáveis com suas fases planetárias (solar 8 planetas,
  Betelgeuse 3, Caótico N-corpos, Núcleo com Sgr A✦ + 12 estrelas S, Binário BN+Pulsar, Véu)
  - Write set: `src/godot/space-war/scripts/world/**`,
    `src/godot/space-war/data/systems.json`
  - Evidência: smoke percorre os 6 sistemas; screenshots por sistema.

## T11 — HUD e menus

- [ ] T11 HUD completo (km/h, altitude, G, instrumento orbital, análise de fuga,
  alertas priorizados, toasts), menus (inicial/briefing/pausa/game-over)
  - Write set: `src/godot/space-war/scripts/ui/hud.gd`,
    `src/godot/space-war/scripts/ui/menus.gd`, `src/godot/space-war/scenes/ui/**`
  - Evidência: screenshots dos estados de UI; smoke atravessa menu→flight→pause.

## T12 — QA final

- [ ] T12 Smoke verde, probes verdes, 60 fps Iris Xe na fase terrestre,
  README/ARCHITECTURE atualizados
  - Write set: `src/godot/space-war/tests/**`, `src/godot/space-war/README.md`,
    `src/godot/space-war/ARCHITECTURE.md`
  - Evidência: suíte completa verde; medição de fps documentada.
