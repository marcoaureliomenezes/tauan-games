# SPEC — aero-fighters-inhauma-campaign-v1

> **Status:** Aprovado
> **Aprovação:** 2026-07-18 — operador, diretiva detalhada em sessão ("now me must work
> hard on the map inhauma... pense bem nessa re-arquitetura").
> **Criado:** 2026-07-18
> **Base:** recon de arquitetura (targets/missions/boss/wingmen/traffic/service) +
> release anterior `aero-fighters-inhauma-visual-uplift-v1` (concluída).
> **Escopo:** SOMENTE o mapa Inhaúma (`src/web-games/aero-fighters/`). Demais mapas
> seguem o loop arcade atual intocado.

## Demanda do operador (condensada)

Fim das waves de inimigos soltos e do monstro. Em lugar disso, uma **campanha com
enredo**: Cachoeira da Prata foi **ocupada** pelo exército inimigo; Inhaúma está
**sob ataque** — colunas de tanques/blindados/caminhões/tropas avançam de Cachoeira
pela MG-060 e pelo terreno para dominar Inhaúma, enquanto baterias de artilharia
bombardeiam os prédios da cidade (fogo, fumaça, caos). O jogador é o caça que
**salva Inhaúma** (Ato 1) e depois **liberta Cachoeira da Prata** (Ato 2). O
aeroporto é a base: sem waves — o mundo continua vivo; quando armas/combustível
acabam, o jogador volta, rearma e retoma. Formações dimensionadas (5, 8, 10, 12,
15, 20, 25 unidades) para justificar armas estratégicas (nuke). Míssil leve passa
a ser infinito. Inimigos atacam de volta com projéteis em linha reta, velocidade
desviável; AA com modelo de acerto por distância (80% a <50 m). Design visual dos
inimigos, wingmen e do F-35 melhorado. Componentes reutilizáveis por tipo.

## Arquitetura nova

### A. Componentes reutilizáveis (`src/formations/` — módulos novos, ≤250 linhas)

- `units.js` — builders de unidade reutilizáveis (mesh + stats): `tank`, `apc`
  (blindado), `truck` (caminhão de suprimento), `troops` (pelotão de infantaria),
  `artillery` (obuseiro), `sam` (lança-mísseis — substitui o boss como "agrupamento
  que lança mísseis"), `aaGun` (redesenhado), `helicopter`, `zeppelin` (redesenhados).
  Padrão InstancedMesh por lote quando >5 unidades iguais (template: inhauma-traffic).
- `formation.js` — controlador: path por polyline de estrada OU waypoints de terreno;
  offsets de formação (coluna/linha/cunha); velocidade; snap de altura + alinhamento
  de pitch ao terreno; **exclusões duras**: nunca dentro de TOWN_SHELF das cidades,
  do rio, das zonas do aeroporto (validador Node obrigatório); rng seedado
  (`game.rng`) em tudo — determinismo é contrato.
- Tipos de formação: `supplyConvoy`, `tankPlatoon`, `armoredColumn`, `troopColumn`,
  `mixedBattlegroup`, `artilleryBattery` (semi-estática: desloca, posiciona, dispara),
  `encampment` (estático misto — alvo de nuke), `samSite`, `aaNest` (montanhas).
- Unidades entram em `game.targets` (barramento único de dano/homing/nuke/score) com
  metadado de formação; o contador de wave morre — progresso passa a ser por ATO.

### B. Segunda cidade + ocupação (Onda 2)

- Cachoeira da Prata construída de verdade no vale `vale-cachoeira-prata` (cx≈-940,
  cz≈520): shelf próprio (menor que Inhaúma), keep-outs de árvores/rio/estrada,
  `registerStructure` p/ colisão+fogo, casas com telhado (reuso de `inhauma-city.js`).
- Guarnição de ocupação: zeppelins, helicópteros, aaNests nas montanhas ao redor,
  blindados circulando na cidade, QG (objetivo final do Ato 2).
- Sincronizar metadata `INHAUMA_CITIES/LANDMARKS` (drift já mordeu antes — validar).

### C. Diretor de campanha (`src/campaign.js` — substitui o loop de waves)

- **Ato 1 — Salvar Inhaúma:** baterias de artilharia (2-3 posições) bombardeiam
  prédios de Inhaúma; colunas (tamanhos 5→8→10→12) partem da região de Cachoeira
  pela MG-060 e por rotas de terreno em direção a Inhaúma. Objetivo: destruir todas
  as baterias + colunas do ato.
- **Ato 2 — Libertar Cachoeira:** reforços da guarnição + o QG (formações 15→20→25,
  samSites). Objetivo: destruir QG e guarnição → cidade libertada → vitória.
- Spawn-over-time seedado (sem tela de "MISSÃO N"); mundo segue vivo durante o
  serviço no aeroporto; RTB é decisão do jogador (armas/fuel), não obrigação de wave.
- **Boss removido**: `boss.js` e todo o contrato de flags (`bossActive/bossHp`/
  `bossSpawned`, gate de pouso, barra no HUD) sai do jogo. Nenhum teste o referencia.
- Míssil leve **infinito** (HUD mostra ∞); heavy/nuke/rod finitos, recarga só no
  serviço; pickups passam a dropar heavy/nuke ocasionalmente.
- HP/dificuldade escala por tempo de campanha e por ato, não por "cycle".

### D. Guerra urbana (`src/city-war.js` — novo)

- Baterias de artilharia escolhem prédios de Inhaúma (via `getInhaumaStructures`),
  disparam projétil balístico visível; impacto → explosão + `spawnPropFire` +
  `addSmokeEmitter` no prédio; fogo persiste enquanto a bateria existir. Scorch.
- Fogo inimigo no jogador: modelo por distância — AA 80% de acerto a <50 m,
  decaindo com a distância até o range máx; unidades de chão engajam a ≤200-220 m;
  projéteis SEMPRE em linha reta com velocidade desviável (~70-90 m/s, sem lead
  ou lead fraco); tracers visíveis.
- Tráfego da MG-060: civis (existe) + caminhões militares inimigos em direção a
  Inhaúma (integra ao supplyConvoy).

### E. Design visual (Onda 5)

- Redesign procedural multi-parte: tank (chassi+torre+canhão+esteiras), apc, truck
  (cabine+carreta+lona), troops (soldadinhos em grupo), artillery (obuseiro+base),
  sam (lançador+radar), aaGun, helicopter, zeppelin, wingmen e o F-35 do jogador.
- Wingmen: voam em FORMAÇÃO com o jogador (offsets de ala) e engajam inimigos do
  jogador (hoje só combatem allyEnemies).

### F. Contrato de testes (reescrito nesta release)

- Node sims passam a validar: pathing de formações fora de cidade/rio/aeroporto,
  spawn seedado estável, progressão de atos, fogo de artilharia→prédio.
- Specs browser que codificam o fluxo antigo (smoke AC-3/11/12/13, diagnostics,
  map, review-fixes, uplift U-AC-8, flight-combat, service/auto-sortie,
  test-aero-sim layout) são reescritos para o contrato de campanha — com comentário
  citando esta SPEC. `game.targets`, `targetsTotal/Destroyed`, `score`, `running`,
  `player.*` permanecem (contrato preservado; semântica de "total" = objetivo do ato).

## Restrições

- Sem build/TS/assets externos; offline; vendor compartilhado intacto.
- Módulos ≤250 linhas; funções ≤60; pools para tudo que spawna; `game.rng` seedado.
- Performance: formações grandes em InstancedMesh; pools de FX revistos (batalhas
  maiores) — shockwave/flash/scorch entram em pool ou ficam capados.
- Não tocar nos outros mapas/jogos nem no trabalho da sessão concorrente.

## Critérios de aceite

1. Node sims/validators verdes (novos + adaptados); `node --check` em tudo.
2. Ato 1 completo→Ato 2→vitória jogáveis de ponta a ponta (smoke browser).
3. Evidência visual (prints): cada tipo de formação em movimento, artilharia
   bombardeando prédio em chamas, Cachoeira ocupada, wingmen em formação, redesenhos.
4. Nenhuma formação dentro de cidade/rio/aeroporto (validador Node + prints).
5. Budget: ≤450 draw calls / ≤800k tris em batalha cheia (medido).
6. Boss e waves removidos; grep `spawnBoss|bossAlive` sem ocorrências em src/.
