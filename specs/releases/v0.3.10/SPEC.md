# SPEC — v0.3.10

> **Status:** Aprovado
> **Aprovação:** 2026-07-20 — operador, diretiva detalhada em sessão (playtest do
> mapa `inhauma` e do modo `inhauma-defense`): "trabalhar melhor a explosão da bomba
> atômica... dentro de um raio de 2x o tamanho da bola de fogo tudo comece a pegar
> fogo... o fogo durará 1 minuto após a explosão e mais 2 minutos de fumaça... em
> seguida tudo afetado pelo fogo fica preto (queimado)... trabalhe melhor essa bola
> de fogo... bateria antiaérea: eu deveria estar num ponto mais alto... a colina do
> meio da cidade deve ter elevação 2.5x maior... inimigos vêm pelas 4 direções mas
> minha retaguarda é protegida por outra bateria antiaérea... cachoeira da prata e
> inhauma estão muito próximos".
> **Criado:** 2026-07-20
> **Escopo:** SOMENTE o jogo web (`src/web-games/aero-fighters/`). O port Godot
> (`src/godot/aero-fighters/`) NÃO é tocado nesta release; `PORT-GODOT.md` documenta
> as mudanças para o port futuro.

## Demanda do operador (condensada)

### A. Nuke (modo voo, mapa `inhauma`)

1. **Bola de fogo melhor** — o cogumelo, a fumaça e a onda de choque já estão bons;
   a bola de fogo precisa de rework visual (mantendo o contrato dos testes: raio
   máx ≤ 131 m, estágios `flash→fireball→mushroom`, curvas puras exportadas).
2. **Incêndio generalizado (firestorm)** — dentro de um raio de **2× o raio da bola
   de fogo** (2 × 130 = **260 m** do epicentro), todo objeto inflamável começa a
   pegar fogo: casas/prédios, blindados/veículos, inimigos e árvores.
3. **Ciclo do fogo** — chamas por **60 s** após a explosão; em seguida as chamas se
   apagam e resta **só fumaça por +120 s**; quando a fumaça some, o objeto afetado
   permanece **preto/carbonizado** permanentemente (árvore, construção, inimigo).

### B. Modo defesa (`inhauma-defense`)

4. **Morro da bateria 2.5×** — a bateria do jogador fica na colina; a elevação deve
   ser **≥ 2.5×** a atual (cota ~101 m → ~250 m), com o monte podendo ocupar mais
   área (e a cidade crescer) para ficar natural. Do topo o jogador deve ver o
   horizonte claro em **2 direções** e enxergar as tropas se formando (horda) e os
   caças se aproximando.
5. **4 frentes + retaguarda coberta** — esquadrilhas inimigas vêm de **4 direções**
   (setores quantizados), mas a **retaguarda do jogador é coberta por uma bateria
   antiaérea aliada** efetiva (hoje inimigos chegam pelas costas o tempo todo — a
   cobertura aliada atual é decorativa: 7% de acerto).
6. **Cachoeira da Prata × Inhaúma mais distantes** — hoje ~876 m centro-a-centro
   (bordas a ~310 m); afastar para ~2× ou mais, migrando rotas de campanha e
   demais acoplamentos.

## Arquitetura

### A. Nuke / firestorm

- **Bola de fogo**: rework dos shaders `FIRE_VERT`/`FIRE_FRAG` e do mesh em
  `src/nuclear-fx.js` — núcleo branco-quente mais definido, turbulência FBM mais
  rica, borda incandescente; manter `fireballGrowthAt ≤ 130`, `fireballFadeAt`,
  `fireballRiseAt`, estágios e exports puros (T-09 espelha as curvas).
- **Firestorm**: novo módulo `src/firestorm.js` (padrão prop-fire.js/city-war.js,
  ≤250 linhas): registro de emissores por objeto com fases
  `fire (60 s) → smoke (120 s) → charred (permanente)`; chamas via puffs aditivos
  (pool próprio dimensionado), fumaça via emissores de `factory-fx.js`
  (owner-keyed) ou pool próprio; tick em `main.js` junto a `updatePropFires`.
- **Ignição**: `igniteNearbyProps` (`src/projectiles.js`) passa a usar raio
  `NUKE_FIRESTORM_RADIUS = 2 × FIREBALL_R_MAX = 260` (constante em `config.js`,
  derivada de `nuclear-fx.js`) e cobre também `game.targets` (tanques, comboios,
  helicópteros, artilharia, infantaria) — hoje só árvores e estruturas.
- **Carbonização**:
  - prédios/árvores (InstancedMesh) → `setColorAt` preto; exige mapa
    estrutura→instância em `buildTownCluster`/`buildCityMeshes`
    (`src/maps/inhauma-city.js`) e índice por árvore em `buildForests`
    (`src/maps/inhauma-scene.js`);
  - veículos/inimigos (Group) → clonar materiais compartilhados (`units.js` usa
    cache `mat()`) e escurecer progressivamente durante o fogo, preto total ao fim
    das chamas;
  - escurecimento progressivo durante a fase de fogo, preto integral a partir de
    60 s, permanente.
- **Guardas**: respeitar `HEADLESS_FX`/`testMode`; cap de emissores para não
  explodir a pool em centro urbano denso (amostragem por proximidade ao epicentro).

### B. Defesa

- **Morro**: nova contribuição de relevo suave em `inhaumaBaseHeight`
  (`src/maps/inhauma-scene.js`, junto a `portalMoundContribution`) centrada em
  `AA_DEFENSE.HILL_POS` com raio amplo (monte natural, ~300–400 m de base) e topo
  ~2.5× a proeminência atual (~96 m → ~240–250 m sobre o piso da cidade);
  `SOLDIER_POS` vai para o topo. A cidade pode crescer (TOWN_SHELF) para abraçar o
  monte; quarteirões terraceiam pela cadeia de altura existente. Impacta o modo de
  voo (mapa compartilhado) — aceito e documentado.
- **4 frentes**: diretor quantiza a direção da esquadrilha em 4 setores
  (`defense-director.js`); setores relativos ao eixo SOLDIER→LOOK_AT.
- **Retaguarda**: uma bateria aliada dedicada posicionada no setor traseiro em
  `placeAlliedBatteries`, com engajamento efetivo (setor-alvo traseiro + hit
  chance alta, ex. ≥ 0.5, alcance cobrindo as aproximações traseiras) — a
  retaguarda deixa de ser via sacrifício.
- **Cachoeira**: mover `CACHOEIRA_SHELF`/`CACHOEIRA_TOWN_CENTER`/`CACHOEIRA_CHURCH`/
  `CACHOEIRA_PRACA` (~2 km do centro de Inhaúma), re-sondar DEM no novo retângulo
  (seco, plano, fora de estrada/rio), migrar `columnRoutes`/`artilleryRoutes`/
  `roadWindow` em `config.js`, guarnição e metadados.

## Testes

- Node: `test-aero-sim.js` (T-09 curvas nuke), `test-aero-defense-mode.mjs`
  (re-escrever asserts de SOLDIER_POS/elevação para o novo morro),
  `test-aero-defense-director.mjs` (setores), `test-aero-cachoeira.mjs`,
  `test-aero-campaign.mjs` (rotas migradas), `test-aero-weapons-sim.js`.
- Playwright: `nuclear-fx.spec.js` (bounds inalterados), smoke geral.
- `PORT-GODOT.md` na raiz desta release documenta tudo para o port Godot.
