# SPEC — aero-fighters-world-realism-v1

> **Status:** Aprovado
> **Aprovação:** 2026-07-01 — operador aprovou via diretiva `/goal` (texto integral
> registrado abaixo em "Demanda do operador"). Segue o precedente de `aero-fighters-uplift-v1`
> (operador aprova via `/goal`). Não implementar produção sem `**Status:** Aprovado`.
> **Criado:** 2026-07-01
> **Autor:** product-engineer (coordenado pelo agente Claude sob `/goal`)
> **Contexto:** Pivô de realismo + autoridade de spec sobre o jogo web `aero-fighters/`
> (Three.js, Degrau 2), mapa ativo de trabalho recente = `inhauma`.
> **Insumo:** reconhecimento read-only de 5 investigadores paralelos (game-design digest,
> montanhas invisíveis, estradas, explosões/nuke, inimigos/árvores/rio) sobre 100% do
> `src/` relevante — evidência em anchors file:line citados na PLAN.

---

## Relação com releases anteriores

- **Supersedes (parcial):** `v0.2.0` (Inhauma GIS Map Replacement). O course-correction
  de 2026-07-01 (T-GIS-13/14, commit 30a3d69) já abandonou a abordagem GIS-maximalista
  (dump OSM de 2169 arestas) em favor de estradas autorais por spline. As tasks GIS
  ainda `[ ]` de v0.2.0 (T-GIS-08 buildings OSM, T-GIS-09 foliage OSM, T-GIS-10 water
  OSM, T-GIS-11/12) ficam **superseded** por esta release, que entrega os mesmos
  objetivos (árvores variadas, rio visível) no **espírito autoral** aprovado pelo
  operador, não via OSM landuse.
- **Preserva:** todo o trabalho concluído de v0.2.0 (`[x]` T-GIS-13 estradas spline,
  T-GIS-14 auto-taxi) e de `aero-fighters-uplift-v1` (superfície/colisão, aeroportos,
  modelo de voo, mortes por superfície, nuke câmera dedicada).
- **Disposição de v0.2.0:** marcada como pausada/absorvida no `ACTIVE.md` desta release.
  Nenhum bug ou task de v0.2.0 é apagado (release-governance: nunca deletar).

## Demanda do operador (texto integral do `/goal` 2026-07-01)

> Review the aero-fighter game. Review mainly the specs for it. We really need to have it
> very well specified, aspects of the map, jogability, enemies, weapons, etc. We should be
> able to create the game again only using the memory and constitution of this game. Pay
> attention in the specs, mainly memory/*.
>
> 1. Mountains that are not visible — enemies fly on top of an invisible mountain (serious bug).
> 2. Roads end nowhere — should end (if they need to) in a tunnel; roads can be better.
> 3. Explosions need more fire. The nuke = flash + giant fireball → atomic mushroom +
>    shockwave; mushroom persists ~1 minute rising into the atmosphere; trees & houses
>    ignite in fire as in a real nuke. More fire colors. More realistic.
> 4. Enemies are good, but we need more mobile enemies that move slowly.
> 5. Trees are uniform — we must have different trees (3 to 5 types) + a river.

## Problema central (a razão desta release)

**A memória não descreve o jogo.** Os atoms em `specs/memory/` cobrem meta (ladder de
engines, QA, catálogo), mas `memory/product/feature.md` é um **template placeholder não
preenchido** e **não existe nenhum atom que especifique o design do jogo** (mapa, voo,
inimigos, armas, FX, ambiente). O documento de design real vive em
`aero-fighters/ARCHITECTURE.md` — que está **desatualizado** (descreve um refactor
proposto de um monólito `game.js` de 12 módulos; o `src/` real tem ~50 módulos / ~9.8k
LoC com 4 mapas, FSM de sortie, boss, wingmen, 3 classes de míssil + nuke, etc.). Logo,
hoje é **impossível recriar o jogo a partir de memory + constitution** — o pedido #1 do
operador.

## Workstreams

### WS-0 — Autoridade de Spec (memory atoms) — pedido #1

Autorar atoms de produto em `specs/memory/product/` que descrevem o jogo **como é hoje**,
com detalhe suficiente para reimplementação. Fonte: game-design digest + `config.js` +
código. Escopo (um atom por área, convenção de `memory/AGENTS.md`):

- `aero-strike.md` — identidade/loop/objetivo do jogo (substitui o propósito do
  placeholder `feature.md`).
- `aero-strike-world.md` — os 4 mapas, modelo de superfície (`surfaceInfoAt`), terreno
  (heightfield contínuo + chunks reciclados), água/rio, estradas, árvores, estruturas.
- `aero-strike-flight.md` — controles, modelo de energia de voo (constantes), FSM de
  sortie/aeroporto/auto-taxi, pouso/decolagem.
- `aero-strike-combat.md` — inimigos (8 tipos + boss + ally-war), armas (canhão + 3
  mísseis + nuke), lock-on, dano/HP/missões.
- `aero-strike-fx.md` — explosões, nuke, câmera, áudio, HUD.

Cada atom: frontmatter válido (slug/title/category/tldr/summary/tags/agent_tier/
token_estimate/last_updated/release_origin), headings curados, wikilinks `[[slug]]`,
**sem** seções de changelog/history. Regenerar `catalog.json`
(`dadaia memory catalog generate`). WS-0 roda na fase `DEFINITION`; refinamentos de
verdade-de-produto pós-implementação entram na fase `CLOSURE`.

### WS-1 — Montanhas visíveis (bug sério)

As serras/morros do mapa `inhauma` **não são meshes separados** — são `INHAUMA_FEATURES`
assados no heightfield contínuo e renderizados como **9 chunks de terreno 2600×2600
reciclados ao redor do player**. Alvos (AA na serra, helicópteros) são posicionados na
altura absoluta da montanha. Hipótese de causa-raiz: onde não há chunk renderizado (serra
distante fora do raio de chunks, ou lacuna/culling de chunk) o objeto aparece flutuando
sobre terreno "invisível". WS-1 garante que **onde há altura de montanha e um objeto
posicionado, há mesh de terreno visível** — cobertura de chunks/serra suficiente, sem
buraco entre a superfície de colisão e a superfície visual. (Root-cause exata confirmada
na PLAN após leitura de `buildInhaumaTerrain`/`updateInfiniteTerrain`.)

Bug registrado: `specs/bugs/aero-inhauma-invisible-mountains.md`.

### WS-2 — Terminação de estradas

As 4 corridas autorais de `inhauma` (mg-238, anel-inhauma [loop, ok], amg-0360, mg-060)
terminam no ar no último ponto de controle. WS-2 dá terminação graciosa:

- **Portal de túnel** reutilizável (`buildTunnelPortals` em `inhauma-road-props.js`,
  ligado em `addRoadDetailProps`) para pontas junto a um flanco de serra existente —
  **não requer novo mesh de montanha** (as serras já estão no heightfield; o portal senta
  no flanco ~25-40 m, respeitando a regra "sem pico"). Alvos: mg-238 NE → serra-leste;
  amg-0360 início → morro-norte.
- **Extensão a fronteira** para pontas sem serra próxima: estende o último ponto de
  controle ~200-300 m na mesma tangente para a estrada sumir no fog (mg-060 norte,
  amg-0360 norte). mg-060 sul termina em terra seca (não no vértice submerso do rio).
- Mudanças aditivas: campo `endcap/startcap` em `inhauma-road-defs.js` (passa por
  `buildRoadsFromDefs`, inócuo a grafo/tráfego/diagnóstico); preserva importabilidade
  Node de `inhauma-road-defs.js`.

### WS-3 — Riqueza de ambiente: árvores variadas + rio visível

- **Árvores (3-5 espécies):** hoje todas as árvores são 2 InstancedMesh (1 geo de tronco
  + 1 geo de copa, cor única) → clones. WS-3 adiciona uma tabela de espécies (ex.: pinho,
  folhosa/carvalho, arbusto, seca, palmeira), 1 par de InstancedMesh por espécie,
  bucketização por banda de altitude, e jitter de cor por instância (`instanceColor`,
  padrão de `buildTown`). Edita só `buildForests` (`inhauma-scene.js`); mantém instanciado
  (~8-10 draw calls) para performance (U-AC-8 é FPS-frágil).
- **Rio visível:** o `inhauma` já tem polyline de rio + vale escavado, mas o render da
  fita de água **pula todo segmento a montante da barragem** (`inhauma-scene.js:227`) →
  rio quase invisível. WS-3 remove o skip (renderiza a fita inteira), alarga `RIVER_W` e
  adiciona pontos ao polyline para meandro. Vale já escavado; sem mudança de terreno.
  Onde estrada cruza rio, rotear ao redor ou ponte (reuso de `buildDam`).

### WS-4 — Inimigos lentos e móveis

O seam já existe: `updatePathTarget(t, dt, speed, altitude)` (altitude 0 = solo, >0 = ar).
WS-4 adiciona ≥2 tipos lentos móveis via a receita de 7 pontos (MAKERS + TARGETS +
SLOW_TARGETS + spawnTarget + dispatch AI + killTarget FX + layouts):

- **`tank`** (solo, ~6 m/s) — segue estrada/patrulha (`pathNear`), dispara em rajada
  lenta (mirror de `armedConvoy`).
- **`patrolAir`** (ar, lento, altitude ~90) — dirigível/avião de patrulha lento; usa
  `pathNear` com spread largo (mirror de `helicopter`).

Distribuídos nos 4 layouts (`TARGET_LAYOUT*`). Lentos = valor de velocidade pequeno; não
há mínimo. Não tocar `ally-war.js` (front paralelo).

### WS-5 — Realismo de explosões e da nuke

Hoje a nuke dispara **DOIS** sistemas simultâneos (partículas `fx.js#nuclearExplosion` +
mesh `nuclear-fx.js#spawnNuclearFx`) → cogumelo duplo redundante, e o cogumelo some em
~7 s (mesh) / 13 s (partículas). Cores planas amarelo/laranja. Árvores/casas não pegam
fogo. WS-5:

1. **Consolidar** numa única autoridade (mesh `nuclear-fx.js`, já ticado todo frame;
   partículas `fx.js` viram burst inicial de poucos segundos + primitivos reutilizáveis).
2. **Flash** maior/mais longo (mantém DOM `#nuke-flash` + core branco-quente).
3. **Fireball multicor** por rampa de vida branco→amarelo→laranja→vermelho (padrão do
   ramp de fumaça); a fireball **sobe e afunila no talo** (vira o cogumelo, não é esfera
   separada).
4. **Cogumelo por ~60 s** subindo à atmosfera (retiming: remoção `t>60`; talo/copa sobem
   a ~1500-2500 m com alargamento do anvil e turbulência de `noise.js`; fade nos últimos
   ~15 s). Custo: manter a pluma persistente como **mesh** (≈4 meshes), nunca 100+
   partículas por 60 s.
5. **Shockwave** de solo dedicado, varrendo ~600-800 m em 2-4 s (RingGeometry, 1 draw).
6. **Ignitar árvores e casas** no raio: expor posições (lista de árvores + acessor de
   `structures[]`), novo pool de fogo em loop com cap rígido (≈40-60 slots reciclados,
   duração de queima 20-40 s), disparado no epicentro junto a `applyNuclearShockwave`;
   guarda headless (`HEADLESS_FX`) e cap para não derrubar FPS.
7. Retiming de `nuclearFxState` (debug HUD) para a timeline de 60 s.

## Critérios de aceite

| ID | Critério |
|----|----------|
| AC-W0-01 | Existem atoms de produto que descrevem mapa/voo/inimigos/armas/FX; um leitor recria o jogo a partir de `memory/` + `constitution.md` sem ler o código. |
| AC-W0-02 | `memory/product/feature.md` placeholder é substituído/removido; `catalog.json` regenerado; `dadaia specs doctor` sem erros novos introduzidos por esta release. |
| AC-W1-01 | Em `inhauma`, nenhum alvo (AA/helicóptero/etc.) aparece flutuando sobre terreno sem mesh; onde há altura de montanha há mesh visível de terreno. |
| AC-W1-02 | Probe Playwright: para cada alvo de morro do `TARGET_LAYOUT_INHAUMA`, há geometria de terreno renderizada sob ele (altura visual ≈ altura de colisão). |
| AC-W2-01 | Nenhuma estrada aberta termina abruptamente no ar: cada ponta ou entra em portal de túnel, ou se estende à fronteira (fog), ou termina em malha urbana/terra seca. |
| AC-W2-02 | Portais de túnel sentam no flanco de serra existente (sem pico), fora das zonas de exclusão do aeroporto; tráfego e diagnóstico de estrada inalterados. |
| AC-W3-01 | O mapa `inhauma` mostra ≥3 (meta 5) espécies visualmente distintas de árvore; instâncias da mesma espécie variam levemente de cor. |
| AC-W3-02 | O rio de `inhauma` é visível ao longo de todo o polyline (não só a jusante da barragem); largura perceptível de voo. |
| AC-W4-01 | Existe ≥1 novo inimigo lento móvel de solo e ≥1 de ar; ambos se movem (posição muda no tempo) a velocidade baixa e aparecem nos layouts. |
| AC-W5-01 | A nuke renderiza um único cogumelo (sem duplicação); estágios flash→fireball→cogumelo. |
| AC-W5-02 | O cogumelo persiste ~60 s subindo; a fireball usa múltiplas cores de fogo (branco→amarelo→laranja→vermelho). |
| AC-W5-03 | Há um shockwave de solo visível varrendo para fora; árvores/casas próximas ao epicentro pegam fogo por alguns segundos (com cap de contagem). |
| AC-W5-04 | Sem regressão de FPS abaixo do budget dos testes de fidelidade; guardas headless preservadas. |
| AC-QA-01 | `npm run test:aero:qa` verde (ou thresholds atualizados com evidência); novos ACs Playwright por WS onde aplicável. |

## Decisões abertas (grill leve — operador presente)

| OQ | Questão | Default proposto |
|----|---------|------------------|
| OQ-1 | Escopo de mapas para árvores/rio: só `inhauma` ou também outros? | Só `inhauma` (mapa de trabalho ativo); padrão reutilizável documentado para os demais. |
| OQ-2 | Duração exata do cogumelo | ~60 s (pedido do operador "1 minuto"). |
| OQ-3 | Ignitar casas: todas no raio ou cap? | Cap rígido (nearest ~30-50) por FPS; log do que foi descartado. |
| OQ-4 | Novos inimigos lentos: quais 2? | `tank` (solo) + `patrolAir` dirigível (ar). |

## Fora de escopo

- Caças inimigos que enfrentam o player (mantido em backlog `aero-air-combat-v1`,
  ADR-U3).
- Reescrever o sistema de missão/combate.
- Migrar o jogo web para Godot/UE5/bundler.
- Integração de mapas por rede/OSM em runtime (mantém offline, vendor local).

## Evidência requerida antes do fechamento

- Screenshots/Playwright do `inhauma`: montanhas visíveis sob alvos, estradas terminando
  em túnel/fronteira, ≥3 espécies de árvore, rio visível, e sequência da nuke
  (flash→fireball→cogumelo 60 s→ignição).
- `npm run test:aero:qa` verde (ou thresholds atualizados com justificativa).
- Atoms de memória revisados por `dadaia specs doctor`.
