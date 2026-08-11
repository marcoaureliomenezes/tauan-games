# PLAN — v0.3.8

- **Status:** Aprovado
- Release: `v0.3.8`
- SPEC: `specs/releases/v0.3.8/SPEC.md`

## 1. Arquitetura

### 1.1 Decisão nº 1 — dois mundos de simulação (frames separados)

O web simulava tudo num frame global único (a nave "perdia" o empuxo do planeta
porque este translada). O Godot terá dois mundos:

- **`PhaseWorld`** (fase / `ORBIT`/`LAUNCH`/`LANDED`): frame **local co-móvel**
  com o planeta **fixo na origem**. Únicas fontes de gravidade: planeta + luas
  (+ transientes). Realiza o "frame fechado planetário" por construção e resolve
  precisão numérica (coordenadas pequenas). O cenário da fase (planeta, luas,
  estações) é instanciado por sistema planetário.
- **`GalaxyWorld`** (mapa / `CRUISE`/`JOURNEY`): frame galáctico com os 6
  sistemas em posições comprimidas, planetas em trilhos keplerianos — a visão
  atual do jogo web.

**Transição de mundo** (o "portal fase↔mapa"):
- Desacoplar (`ORBIT`→`CRUISE`, dist > 1,5× lua mais distante, com histerese de
  saída 1,15×): estado da nave transformado para o frame galáctico
  (`pos_gal = pos_planeta_trilho + R·pos_fase`, idem velocidade).
- Acoplar (`CRUISE`→`ORBIT`, alvo T + tecla O a ≤ 3× lua mais distante):
  trajetória automática de captura; ao cruzar a borda (1,0×), transforma-se para
  o frame do planeta e o `PhaseWorld` daquele planeta é instanciado.

### 1.2 Decisão nº 2 — física custom, sem RigidBody

Nave = `Node3D` com integrador próprio (Euler semi-implícito, double). Gravidade
analítica patched-conics + maré + Paczyński–Wiita. Trilhos celestes analíticos
(circular, elíptico, baricêntrico) + velocity-Verlet só no Caótico.

### 1.3 Decisão nº 3 — dados data-driven

`tools/extract_config.mjs` (Node, descartável) importa `config.js`/`universe.js`
do web, executa o pipeline de escalas e grava **valores efetivos** em
`data/systems.json`. `BodyDef`/`SystemDef` (Resources) carregam o JSON; sistema
novo = só dados.

### 1.4 Layout

```
src/godot/space-war/
  project.godot            # 4.7, Forward+, input map, autoloads, physics 120 tps
  scenes/main.tscn         # cena mínima; mundo construído em código
  scripts/
    core/                  # flight_frame.gd (máquina), ship.gd, gravity.gd, frames.gd
    world/                 # phase_world.gd, galaxy_world.gd, rails.gd, nbody.gd
    bodies/                # celestial_body.gd, planet_visual.gd, star_visual.gd,
                           # black_hole_visual.gd, rings_visual.gd, comet_visual.gd
    ui/                    # hud.gd, map_2d.gd, nav_overlay.gd, menus.gd
  shaders/                 # atmosphere.gdshader, star.gdshader, accretion_disk.gdshader,
                           # rings.gdshader, black_hole.gdshader
  data/systems.json
  assets/                  # texturas CC-BY + ATTRIBUTION.md
  tests/                   # probe.gd/.tscn, smoke.gd, shot.gd
  tools/extract_config.mjs
  README.md  ARCHITECTURE.md
```

Autoloads: `GameState` (menu/briefing/flight/pause/gameover), `FlightFrame`
(LANDED/LAUNCH/ORBIT/CRUISE/JOURNEY + transições), `Universe` (dados + mundos).

Input map (`project.godot`): `throttle_up (W)`, `throttle_down (S)`, `brake (X)`,
`pitch_up/down`, `yaw_left/right`, `roll_left (A)/roll_right (D)`, `fire`,
`target_next (T)`, `target_prev (Shift+T)`, `align (C)`, `auto_approach (N)`,
`orbit_action (O)`, `camera_view (V)`, `context_action (Z)`, `map (M)`,
`pause (P)`, `confirm (Enter)`.

### 1.5 Visual — componentes

| Necessidade | Solução | Licença |
|---|---|---|
| Atmosfera / arco azul | adaptação de `fbcosentino/godot-extremely-fast-atmosphere` (sem raymarch) | MIT |
| Skybox Via Láctea | NASA SVS Deep Star Maps 3895 (galáctico) ± ESO eso0932a | NASA credit / CC BY 4.0 |
| Texturas planetas/luas/anéis | Solar System Scope + NASA Visible Earth + normal maps Zenodo | CC BY 4.0 |
| Estrelas/coroa/pulsar/cometa | shaders custom (FBM + limb darkening + cones aditivos) | — |
| Buraco negro + disco | shader custom (técnica pública; Qhunliv13 é proprietário — não usar) | — |
| Anéis | malha + textura radial CC BY + sombra analítica no shader | — |
| Referência Kepler | I, Voyager (Apache-2.0) — leitura, não dependência | Apache-2.0 |

`assets/ATTRIBUTION.md` desde o início. Download de assets via script
`tools/fetch_assets.sh` com URLs e licenças fixas (offline-first depois do fetch).

### 1.6 Decolagem (detalhe central)

`LANDED`→`LAUNCH`: W mantido; câmera lateral; subida ~20 s; gravity turn ~10 s;
inserção a 100 km / 27.000 km/h → `ORBIT` com planeta fixo embaixo e arco azul
da atmosfera. Pilotado o tempo todo, com física real (gravidade + arrasto).

### 1.7 Velocidades

Na fase o HUD exibe km/h; o mapeamento mundo→km/h é calibrado para que a órbita
de entrada terrestre seja 27.000 km/h e o teto 72.000 km/h
(`ACCEL_RATE_KMH_S = 300`, constante tunável).

## 2. Plano de testes

- `tests/probe.gd`: órbita circular fecha (erro < 1% após 1 período); v_circ/v_esc
  corretos; ISCO em 3·rs; saída e reentrada de fase sem deriva; decolagem atinge
  100 km/27.000 km/h.
- `tests/smoke.gd`: boot headless + N frames de simulação, exit code 0/1
  (`SPACEWAR_TEST=1 godot4 --headless --path .`).
- `tests/shot.gd`: screenshots por frame/estado e corpo (`SPACEWAR_SHOT=1`).
- Comandos: `godot4 --headless --path src/godot/space-war` (sem editor GUI).

## 3. Sequência de execução

TASKS.md T1→T12 em ordem; T4/T5 são o núcleo (física + frames) e bloqueiam T6–T8;
T9/T10 (visual/sistemas) depois do núcleo validado; T11/T12 fecham.
