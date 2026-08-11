# PLAN — v0.3.7

- Status: [x] Aprovado (operador, 2026-07-19)
- Release: `v0.3.7` · SPEC: `./SPEC.md`

## 1. Estratégia

Paridade funcional com o jogo web (`src/web-games/bang-bag/`) + salto de qualidade
visual/personagem, construído sobre **componentes maduros do ecossistema Godot** —
zero terreno/vegetação/água bespoke onde a comunidade já resolveu. Desktop Linux
primeiro (Godot 4.7.1 já instalado no ambiente); GDScript puro (sem compilação).

Projeto: `src/godot/bang-bag/` (mesmo padrão do `src/godot/aero-fighters-v2` —
project.godot na raiz, `scenes/`, `scripts/`, `assets/`, `addons/`, `docs/`, `Tests/`).

## 2. Componentes de terceiros (pinados, com licença)

| Componente | Uso | Fonte / licença |
|---|---|---|
| **Terrain3D** (GDExtension) | terreno 2048×2048, LOD clipmap, splat 32 tex, colisão | TokisanGames, MIT — v1.0.x estável, Godot 4.4+ |
| **ProtonScatter** | dispersão de árvores/rochas/capim por regras (bioma, declive, altitude) | HungryProton, MIT |
| Packs CC0 **Quaternius/Kenney** (já vendorados em `src/web-games/vendor/models/`) | animais (veado, cobra, águia), NPCs, prédios, props, peças do trem | CC0 — copiar para `assets/models/` |
| Shader de água maduro (Godot docs + ajuste próprio) | rios (fita com fluxo/espuma) e lago (plano reflexivo) | base pública documentada |
| Blender (pipeline offline) | montagem do GLB único homem-a-cavalo a partir de peças CC0 | ferramenta de autoria, não runtime |

Dependências externas ficam em `addons/` e `assets/` **vendoradas no repo** —
runtime 100% offline (lei do repo).

## 3. Arquitetura de cenas e scripts

```
Main (Node)                      — boot, loop, estados (playing/gameover/victory/paused)
├─ World/
│  ├─ Terrain (Terrain3D)        — heightmap importado + splat + colisão
│  ├─ WaterRivers (ribbons)      — leito escavado, shader de fluxo, vaus
│  ├─ Lake (MeshInstance+shader) — plano reflexivo
│  ├─ SkyDayNight                — DirectionalLight + WorldEnvironment + fog, 600 s
│  ├─ Scatter (ProtonScatter)    — florestas/rochas/capim por bioma
│  ├─ Settlements/               — 2 cidades, 2 aldeias, acampamento (cenas autoradas)
│  └─ Railway/                   — trilhos instanciados + Train (PathFollow3D)
├─ Player/
│  ├─ HorseRider (CharacterBody3D) — locomoção, estamina, salto, colisão
│  ├─ HorsemanRig (GLB único)    — AnimationTree: gaits + camada de mira do braço
│  └─ Cameras (Cam1P no osso da cabeça / Cam3P SpringArm3D) — toggle [V]
├─ Combat/                       — revólver (hitscan 8/3s), espingarda (pelotes em cone)
├─ Entities/                     — bandits, deer, snakes, eagles, archers, town NPCs, wagon
├─ Systems/                      — health/hunger/camp, capture, death/respawn, victory
├─ UI/                           — HUD, mapa fullscreen, minimapa, overlays (start/death/victory)
└─ Audio/                        — buses + players posicionais (fogueira, trem, vento)
```

**Contrato de estado:** `scripts/state.gd` (autoload `Game`) como fonte única —
mesmo padrão `window.game` da web, com comentários `CONTRATO: writer de Game.x`.

## 4. Personagem — o trabalho central (P-01..P-06)

1. **Autoria offline (Blender)**: montar UM GLB `horseman.glb` — cavalo CC0 +
   cela detalhada + cowboy CC0 (chapéu, coldre, casaco) — com esqueleto UNIFICADO
   (ossos do cavalo + ossos do rider parentados à sela). Importar como
   `assets/models/horseman.glb`. É o fim do "homem deformado de 2 componentes".
2. **AnimationTree** (Godot): state machine de andaduras (idle/walk/trot/gallop/
   jump com crossfade) + **camada de mira** (additive): ossos do braço da arma
   apontam para o pitch da câmera; tronco inclina com a velocidade.
3. **Câmeras**: `Cam1P` parentada ao osso da cabeça (olhos do cowboy — vê
   rédeas/cabeça do cavalo/braço ao atirar); `Cam3P` em `SpringArm3D` atrás e
   acima com colisão de câmera. Toggle [V].
4. **Aceitação**: cena de galeria (`Tests/gallery.tscn`) que renderiza o rig nas
   4 poses × 2 câmeras × 4 ângulos e exporta screenshots — revisão do operador.

## 5. Mundo

1. **Heightmap offline**: script `tools/gen_heightmap.gd` (roda com
   `godot --headless -s`) gera o heightfield 2048×2048 (mesma família de ruído da
   web — fBm vale + ridged rim norte, rios escavados monotonicamente, lago) e
   exporta `assets/terrain/heightmap.exr` + `splatmaps`. Seed fixa → mundo
   determinístico e diff-able.
2. **Terrain3D**: import do heightmap; splat (grama/terra/rocha/neve); colisão
   nativa alimenta o cavalo e os projéteis — fim do contrato bespoke `heightAt`.
3. **Florestas (ProtonScatter)**: regras por bioma — pinheiros densos nas
   encostas úmidas, folhosas no vale, secas nas zonas áridas; clusters com
   ruído de agrupamento, variação de escala/rotação/tinta; clareiras. 3+ espécies
   de modelos distintos (não 1 árvore repetida — o defeito "Minecraft" da web).
4. **Água**: ribbons de rio seguindo o leito escavado (shader de fluxo + espuma
   nos vaus); lago com plano reflexivo; `water_info(x,z)` expõe vau/profundo para
   a locomoção (vaus −45%, profundo bloqueia) e `bridge_at` para as 2 pontes.
5. **Ferrovia**: `Path3D` fechado (evita cidades/lago) com trilhos/dormentes
   instanciados; `Train` (locomotiva a vapor detalhada + 3 vagões) em
   `PathFollow3D` a 12 m/s, fumaça de chaminé (GPUParticles) e apito posicional.
6. **Assentamentos**: cenas autoradas à mão (não só scatter): fachadas
   nomeadas com props (tambores, cartazes, cercas), carroça em rota, NPCs
   passeando; aldeias com tendas/totem/fogueira; acampamento com fogueira animada.

## 6. Combate

- Módulo `combat.gd` com registro de alvos (`damageable`). Todos os disparos saem
  do centro da câmera ativa (ray do `Camera3D`), nunca do quadril — fim do bug
  mira↔impacto da web.
- **Revólver**: `PhysicsRayQueryParameters3D` hitscan, 8 balas, recarga infinita
  3,0 s, tracer + flash; mira precisa [F] (zoom FOV 70→46).
- **Espingarda**: 7 pelotes/disparo em cone (ângulo fixo de dispersão → raio de
  impacto ∝ distância, como pedido), dano 12/pelote com queda, infinita, 0,9 s.
- Teste de coerência mira↔impacto (<0,5 m a 30 m, parado e galopando de lado).

## 7. Entidades e sistemas

State machines pequenas por entidade (mesmos comportamentos da web, números da
SPEC): bandidos (wander→flee→surrender→captured), veados (graze→flee→carcass),
cobras (strike cooldown), arqueiros (aggro/flecha balística), NPCs de cidade
(passeio), carroça, trem, águias. Sistemas: health/hunger, camp regen, captura,
**morte → game over → respawn no acampamento**, **5/5 → tela de vitória**.

## 8. QA

- `Tests/` com GUT-style scripts rodando via `godot --headless`: coerência de
  mira, espalhamento da espingarda ∝ distância, recarga 3 s do revólver, gaits e
  estamina, captura, morte/respawn, vitória, vaus/pontes, layout do mundo
  (rios monotônicos, 2 cidades, 2 aldeias, acampamento, trem).
- **Protocolo visual**: cenas de galeria (personagem, floresta, rio+ponte, trem,
  cidade) renderizadas para PNG; aprovação do operador é gate de fechamento.
- Convenções herdadas do aero-fighters-v2: gdlint, módulos pequenos, README.

## 9. Sequência (workstreams → tasks)

| WS | Conteúdo | Tasks |
|---|---|---|
| W1 | scaffold Godot + Terrain3D + heightmap do layout | T-BB-01, T-BB-02 |
| W2 | cavalo + rig único + câmeras + galeria visual | T-BB-03, T-BB-04 |
| W3 | controles CS + combate (revólver + espingarda) | T-BB-05 |
| W4 | florestas + água + céu | T-BB-06 |
| W5 | ferrovia + trem detalhado | T-BB-07 |
| W6 | assentamentos + entidades | T-BB-08 |
| W7 | sistemas (sobrevivência, captura, morte, vitória) + HUD/mapa/áudio | T-BB-09 |
| W8 | QA headless + screenshots de aceitação + docs | T-BB-10 |
