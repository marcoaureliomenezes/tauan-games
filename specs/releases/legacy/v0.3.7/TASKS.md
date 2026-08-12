# TASKS — v0.3.7

- Status: [x] Aprovado (operador, 2026-07-19)
- Release: `v0.3.7` · SPEC: `./SPEC.md` · PLAN: `./PLAN.md`
- Regra: só implementar com SPEC+PLAN+TASKS **Aprovados** pelo operador.
- Role de produção: `game-developer` (executado por software-engineer atuando como
  game-developer, restrito ao Write set da task reservada — ver AGENTS.md do repo).

Marcadores: [ ] OPEN · [-] IN PROGRESS · [x] DONE

---

## T-BB-01 — Scaffold do projeto Godot

- [x] **Escopo:** projeto Godot 4.7 funcional em `src/godot/bang-bag/` (mesmo layout de `src/godot/aero-fighters-v2/`): `project.godot` (renderer Forward+, física 60 Hz, input map completo da SPEC §3), estrutura `scenes/ scripts/ assets/ addons/ docs/ Tests/`, autoload `Game` (state.gd com contratos), Main minimalista com overlay de start, README.
- **Deps:** Terrain3D + ProtonScatter vendorados em `addons/` (pin de versão + licenças em `docs/VENDORS.md`).
- **Write set:** `src/godot/bang-bag/**`
- **AC:** `godot --headless --path src/godot/bang-bag --quit` sem erros; projeto abre no editor; input map contém todas as ações (move_f/b/l/r, gallop, jump, fire, ads, reload, weapon_1, weapon_2, interact, map, camera_toggle, pause).

## T-BB-02 — Terreno Terrain3D com o layout de referência

- [x] **Escopo:** `tools/gen_heightmap.gd` (headless) gerando heightmap 2048×2048 da família de ruído da web (vale fBm, anel ridged com viés norte, 2 leitos de rio monotônicos escavados → 1 lago, linha de neve) com seed fixa; export `assets/terrain/*.exr`+splat; cena `World/Terrain` com Terrain3D importado, splat 4 texturas, colisão ativa.
- **Write set:** `src/godot/bang-bag/tools/`, `src/godot/bang-bag/scenes/world/`, `src/godot/bang-bag/assets/terrain/`, `src/godot/bang-bag/scripts/world/`
- **AC:** alturas determinísticas (2 runs ⇒ hash idêntico); rios monotônicos a jusante; lago no ponto mais baixo comum; FPS ≥ 60 com LOD clipmap; navegação física sobre a colisão nativa.

## T-BB-03 — Rig único homem-a-cavalo (fim do personagem deformado)

- [x] **Escopo:** pipeline Blender → `assets/models/horseman.glb`: cavalo CC0 + cela detalhada (arreios) + cowboy CC0 (chapéu, coldre, casaco) com **esqueleto unificado**; `AnimationTree` (idle/walk/trot/gallop/jump crossfade) + camada additive de mira do braço (pitch da câmera); lean do tronco ∝ velocidade.
- **Implementado (desvio do plano original):** o merge das 2 armaduras no Blender corrompia os clips; a solução final é `assets/models/horseman.tscn` (cena única instanciada — cavalo + cowboy montado via `RiderFollow` no osso Torso2, escala do cavalo 0.55, pose de montaria empírica nas pernas, clips de braço/mira do pack original sem spikes). O AC funcional (1 componente, zero deformação) é atendido; AnimationTree/additive ficou como 2 AnimationPlayers com ossos disjuntos.
- **Write set:** `src/godot/bang-bag/assets/models/`, `src/godot/bang-bag/scenes/player/`, `src/godot/bang-bag/scripts/player/`
- **AC:** um único GLB instanciado (nenhum cowboy separado); braço aponta para o pitch da mira; screenshots da galeria (`Tests/gallery.tscn`, 4 poses × 4 ângulos) **aprovados pelo operador** — zero clipping/deformação.

## T-BB-04 — Locomoção do cavalo + câmeras

- [x] **Escopo:** `HorseRider` (CharacterBody3D): gaits 2,2/6,0/14,0 m/s com aceleração suave, estamina (100, 22/s, 9/s, trava 25), inclinação ao declive, salto balístico 1,6 m (Space, 5 STA), colisão push-out+deslize com árvores/rochas/construções; água rasa −45%, profunda bloqueia, pontes liberam. Câmeras: `Cam1P` no osso da cabeça (rédeas/cabeça do cavalo/braço visíveis), `Cam3P` SpringArm3D com colisão; toggle [V]; FOV kick + shake sutil no galope; poeira de casco.
- **Write set:** `src/godot/bang-bag/scripts/player/`, `src/godot/bang-bag/scenes/player/`
- **AC:** empurrar 5 s contra rocha ⇒ zero penetração, sem travar; vaus/pontes respeitam as regras; transição 1ª/3ª pessoa instantânea e estável; screenshots das 2 câmeras aprovados.

## T-BB-05 — Controles CS + combate (revólver + espingarda)

- [x] **Escopo:** input CS final (WASD move cavalo — W/S frente/ré, A/D giro; mouse mira independente; LMB fogo; R recarga; 1/2 troca arma; F mira precisa; E interage; M mapa; Esc pausa/libera mouse). `combat.gd`: revólver hitscan (8 balas, recarga infinita 3,0 s, 34 dano, 220 m, tracer+flash, zoom 70→46 em F) e espingarda (7 pelotes em cone — raio de impacto ∝ distância — 12/pelote com queda, infinita, 0,9 s); registro `damageable`; teste mira↔impacto.
- **Write set:** `src/godot/bang-bag/scripts/combat/`, `src/godot/bang-bag/scenes/combat/`, `src/godot/bang-bag/Tests/`
- **AC:** tiro sai do centro da câmera ativa (erro <0,5 m a 30 m, parado e galopando de lado); tambor 8 + recarga 3,0±0,1 s infinita; leque da espingarda medido crescente com a distância; troca 1/2 instantânea.

## T-BB-06 — Florestas, água e céu (anti-Minecraft)

- [x] **Escopo:** ProtonScatter com regras de bioma (pinheiros em encosta úmida, folhosas no vale, secas em árido; clusters + variação escala/rotação/tinta; clareiras); 3+ modelos de árvore distintos; capim/arbustos no vale; rios em ribbon com shader de fluxo + espuma nos vaus; lago reflexivo; `water_info`/`bridge_at` para a locomoção; dia/noite 600 s (sol com sombras, névoa por horário, pôr-do-sol).
- **Write set:** `src/godot/bang-bag/scenes/world/`, `src/godot/bang-bag/scripts/world/`, `src/godot/bang-bag/assets/models/vegetation/`, `src/godot/bang-bag/shaders/`
- **AC:** screenshots de floresta/rio/lago aprovados (densidade natural, sem distribuição uniforme); vaus atravessáveis e profundos bloqueantes conforme `water_info`; 2 pontes atravessáveis.

## T-BB-07 — Ferrovia e trem de produção

- [x] **Escopo:** `Path3D` fechado (evita cidades/lago); trilhos + dormentes + lastro instanciados; locomotiva a vapor detalhada (chaminé com GPUParticles de fumaça, rodas/campo) + 3 vagões em `PathFollow3D` a 12 m/s; apito posicional + chug; passagem de nível sinalizada.
- **Write set:** `src/godot/bang-bag/scenes/world/railway/`, `src/godot/bang-bag/scripts/world/`, `src/godot/bang-bag/assets/models/train/`
- **AC:** loop completo estável por ≥5 min sem falhas; screenshot do trem aprovado (detalhe, sem anomalias de material); apito audível com atenuação por distância.

## T-BB-08 — Assentamentos e entidades

- [x] **Escopo:** 2 cidades autoradas (5 fachadas nomeadas com props, 4 NPCs passeando, carroça em rota); 2 aldeias (5 tendas + totem + fogueira, 8 arqueiros com aggro/flecha balística 6 dano); acampamento (fogueira animada com luz, tenda, caixotes); 5 bandidos (wander→flee→surrender→captured); 3 bandos de veados; 12 cobras; 4 águias; posicionamento determinístico (SPEC §6).
- **Write set:** `src/godot/bang-bag/scenes/settlements/`, `src/godot/bang-bag/scenes/entities/`, `src/godot/bang-bag/scripts/entities/`
- **AC:** entidades presentes e comportando-se por SPEC; 1 tiro rende bandido, [E] ≤4 m captura (contador); veado abatido vira carcaça carregável; arqueiros acertam/erram com balística real.

## T-BB-09 — Sistemas: sobrevivência, captura, MORTE, VITÓRIA, HUD/mapa/áudio

- [x] **Escopo:** HP/comida (0,14/s, fome −1 HP/s), entrega de caça (+40), acampamento (cura +5 HP/s); **morte → tela de game over → respawn no acampamento** (revólver carregado, comida 50); **5/5 → tela de vitória + continuar**; HUD completo; mapa fullscreen [M] com relevo + marcadores vivos; minimapa; áudio por buses (casco, disparos por arma, recarga, flechas, fogueira, trem, vento).
- **Write set:** `src/godot/bang-bag/scripts/systems/`, `src/godot/bang-bag/scenes/ui/`, `src/godot/bang-bag/scripts/ui/`, `src/godot/bang-bag/audio/`
- **AC:** HP→0 dispara game over e respawn funciona; 5/5 dispara vitória; HUD/mapa com marcadores vivos corretos; mute toggle.

## T-BB-10 — QA headless, aceitação visual e documentação

- [ ] **Escopo:** suite `Tests/` (headless): mira, espingarda ∝ distância, recarga, gaits/estamina, captura, morte/respawn, vitória, vaus/pontes, layout do mundo; galeria de screenshots (personagem, florestas, rios, trem, cidades) exportada para revisão; README do projeto; atualização do catálogo de jogos (bang-bag-godot como "em desenvolvimento").
- **Write set:** `src/godot/bang-bag/Tests/`, `src/godot/bang-bag/README.md`, `src/godot/bang-bag/docs/`
- **AC:** suite verde via `godot --headless`; pacote de screenshots **aprovado pelo operador**; zero erro/warning de boot.
