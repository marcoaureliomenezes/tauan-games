# PLAN: Aero Fighters — Mapa Inhauma

> **Status:** Aprovado — 2026-05-16 (aprovado pelo operador: "Aproved")
> **SPEC:** `specs/features/aero-fighters-inhauma-map/SPEC.md` [Aprovado]
> **Created:** 2026-05-16

---

## 1. Goal And Operating Model

Adicionar o mapa `inhauma` ao Aero Strike com fidelidade suficiente para revisao detalhada do operador.

O mapa deve ser procedural/offline, usar as imagens em `aero-fighters/img/` apenas como referencia visual e manter as capacidades do mapa `desert`: aerodromo, decolagem/pouso, service zone, alvos, AA guns, heightmap, validacao e diagnosticos.

Modo de trabalho:

- `qa-engineer` define primeiro o contrato de diagnostico e os testes Playwright de fidelidade, inicialmente falhando para `inhauma`.
- `game-developer` implementa o mapa contra esse contrato, de forma incremental e testavel.
- `qa-engineer` fecha validacao com testes reais: landmarks, relevo, orientacao geografica, cidade, predios/pontos de referencia, pista e alvos.

---

## 2. Acceptance Contract

O mapa sera aceito somente se estes itens forem verificaveis por Playwright ou diagnostico:

| Area | Must Have |
|---|---|
| Identidade | `?map=inhauma` carrega, `activeMap === "inhauma"`, label `Inhauma`. |
| Geografia | Inhauma no centro, Cachoeira da Prata a oeste/sudoeste, Sete Lagoas a leste/nordeste. |
| Orientacao | MG-238 conecta oeste -> sul de Inhauma -> leste/nordeste; AMG-0360 sai ao sul/sudoeste; Rod. Mun. Inhauma sai ao norte/nordeste. |
| Inhauma ultra | Igreja, campo, Area de Lazer da Manga, praca central, casas, ruas curvas, bairros e saidas. |
| Relevo | Morros/serras ao redor, vale de Cachoeira da Prata, terreno mais alto entre Inhauma e Sete Lagoas, pista plana. |
| Gameplay | Aerodromo, decolagem/pouso/service, alvos, comboios, AA guns, grounding correto. |
| Performance | Sem explosao de draw calls; `npm run test:aero:qa` passa. |

---

## 3. Shared Diagnostic Interface

Antes do mapa final, implementar ou estender diagnosticos para QA validar conteudo sem depender de DOM ou screenshots fragilmente.

`window.__aeroDebug.getMapDiagnostics()` deve expor para `inhauma`:

```js
{
  activeMap: 'inhauma',
  mapsCovered: ['rio', 'desert', 'inhauma'],
  landmarks: [
    { id, kind, x, z, height, radius }
  ],
  roads: [
    { id, kind, points, width }
  ],
  cities: [
    { id, x, z, radius, role }
  ],
  terrainRegions: [
    { id, type, cx, cz, radius, peakHeight }
  ],
  airport: {
    id,
    map,
    runwayBounds,
    serviceZoneBounds,
    taxiwayBounds
  }
}
```

IDs obrigatorios:

- cidades: `inhauma`, `cachoeira-da-prata`, `sete-lagoas`;
- landmarks: `igreja-inhauma`, `campo-inhauma`, `area-lazer-manga`, `praca-central-inhauma`, `aerodromo-inhauma`;
- vias: `mg-238`, `amg-0360`, `rod-mun-inhauma`;
- relevo: pelo menos `serra-sete-lagoas`, `morros-oeste-inhauma`, `vale-cachoeira-prata`, `morro-norte-inhauma`.

Este contrato e parte do produto: ele permite que o `qa-engineer` detecte se o mapa perdeu fidelidade em refactors futuros.

---

## 4. Work Sequence

### Phase 1 — QA Contract First

Owner: `qa-engineer`

Criar testes que falham ate a implementacao existir:

- `tests/aero-fighters/inhauma-fidelity.spec.js`;
- atualizar `tests/aero-fighters/map.spec.js` para incluir `inhauma`;
- atualizar `tests/aero-fighters/tools/validate-aero-map.js` para validar `inhauma`;
- atualizar `tests/aero-fighters/tools/test-aero-sim.js` para incluir `inhauma` nos layouts obrigatorios.

Testes obrigatorios:

- carrega `map=inhauma` sem `console.error`;
- diagnostico contem cidades, vias, landmarks, terrainRegions e airport;
- orientacao geografica: Cachoeira a oeste/sudoeste de Inhauma, Sete Lagoas a leste/nordeste;
- vias conectam regioes esperadas por ordem de pontos;
- landmarks de Inhauma existem e ficam dentro/ao redor da cidade central;
- amostras de relevo sao finitas e coerentes;
- runway/taxiway/service sao planos;
- targets iniciais estao grounded.

### Phase 2 — Map Skeleton

Owner: `game-developer`

Adicionar a chave `inhauma` sem detalhe final ainda:

- `src/maps/inhauma.js` com exports `createInhaumaWorld`, `updateInhaumaWorld`, `inhaumaHeightAt`;
- `src/maps/index.js` com `MAP_KEYS`, `MAP_LABELS`, `MAPS.inhauma`;
- `config.js` com `TARGET_LAYOUT_INHAUMA`;
- `map-validation.js` com `MAP_VALIDATION_DEFS.inhauma`;
- `debug.js` com `mapsCovered` dinamico ou incluindo `inhauma`.

Saida esperada:

- `?map=inhauma&testMode=1` carrega;
- targets aparecem;
- validacao pura conhece o mapa.

### Phase 3 — Terrain And Heightmap

Owner: `game-developer`

Implementar relevo antes de detalhes urbanos:

- chao rural grande, sem oceano;
- regioes `INHAUMA_TERRAIN_DEFS` exportaveis ou espelhadas em `map-validation.js`;
- morros a oeste/norte/sudeste de Inhauma;
- serra/alto relevo no eixo para Sete Lagoas;
- vale/baixo relevo perto de Cachoeira da Prata;
- vertex colors por altitude: pasto seco, mata, solo exposto, rocha clara;
- `inhaumaHeightAt` usando a mesma matematica da malha.

Critério de QA:

- `getTerrainHeightAt` finito em pelo menos 12 pontos;
- serra > cidade;
- morros oeste/norte > centro urbano;
- vale de Cachoeira menor que morros proximos.

### Phase 4 — Geographic Roads And Cities

Owner: `game-developer`

Criar layout regional comprimido:

- Inhauma: `(0, 0)`, raio urbano aproximado `260`;
- Cachoeira da Prata: `(-900, 520)`, raio aproximado `170`;
- Sete Lagoas: `(1250, -420)`, raio aproximado `360`;
- MG-238 como polyline principal passando por Cachoeira, sul/sudeste de Inhauma e eixo de Sete Lagoas;
- AMG-0360 saindo ao sul/sudoeste de Inhauma;
- Rod. Mun. Inhauma saindo ao norte/nordeste;
- estradas de terra para fazendas, sitios e hotel/fazenda ao redor.

Implementacao:

- helper `addRoadPolyline(points, width, color, yOffset, id, kind)`;
- ruas urbanas como polylines menores dentro de Inhauma;
- rodovias mais largas e cinza claro;
- estradas rurais de terra.

Critério de QA:

- posicoes relativas das cidades batem;
- MG-238 tem ponto perto de Cachoeira, ponto ao sul de Inhauma e ponto perto de Sete Lagoas;
- AMG-0360 e Rod. Mun. Inhauma saem na orientacao correta.

### Phase 5 — Inhauma Ultra Detail

Owner: `game-developer`

Implementar a parte que sera revisada em detalhe:

- malha de ruas irregular, sem grade perfeita;
- casas baixas com telhados terracota/cinza via `InstancedMesh`;
- igreja com nave clara, torre triangular alta e praca arborizada;
- campo de futebol com gramado, linhas e traves;
- Area de Lazer da Manga como area verde/lazer com arvores e piso claro;
- praca central com arvores;
- bairros perifericos menos densos;
- vegetacao nas encostas e bordas da cidade;
- saidas para MG-238, AMG-0360 e Rod. Mun. Inhauma.

Critério de QA:

- diagnostico contem todos os landmarks;
- landmarks ficam dentro do raio de Inhauma;
- screenshot mostra variedade de cidade/campo/estrada/relevo;
- renderer stats permanecem dentro de budget.

### Phase 6 — Peripheral Features

Owner: `game-developer`

Adicionar contexto ao redor:

- Cachoeira da Prata com malha pequena, vale, curso d'agua/lagoa e poucas casas;
- Sete Lagoas com cidade maior simplificada, lagoas, bairro denso e area industrial;
- fazendas, galpoes, pastos, currais e areas circulares de plantio;
- manchas de mata escura e solo exposto/mineracao conforme referencias.

Critério de QA:

- cidades perifericas existem e sao distinguiveis;
- Sete Lagoas tem area urbana maior que Cachoeira da Prata;
- pelo menos uma lagoa em Sete Lagoas e agua/vale em Cachoeira da Prata.

### Phase 7 — Aerodrome And Landing Contract

Owner: `game-developer`

Generalizar aeroporto sem quebrar `desert`:

- manter `desertAirport` e `createDesertAirport`;
- adicionar `inhaumaAirport` e `createInhaumaAirport`;
- criar helper `getAirportForMap(mapKey)` ou equivalente;
- atualizar `landing-zones.js` para classificar runway/taxiway/service por mapa ativo;
- atualizar `debug.js` para diagnosticar aeroporto ativo;
- nivelar a area do aerodromo na `inhaumaHeightAt`.

Aerodromo de Inhauma:

- fazenda proxima fora do centro urbano, preferencialmente oeste/sudoeste;
- pista, taxiway, service zone, hangares rurais;
- label `AERODROMO INHAUMA`.

Critério de QA:

- runway plana em sweep;
- decolagem e pouso usam surface `runway`;
- service zone e taxiway aparecem no diagnostico;
- testes atuais de `desert` continuam passando.

### Phase 8 — Targets And Gameplay

Owner: `game-developer`

Adicionar `TARGET_LAYOUT_INHAUMA` com pelo menos 20 entradas:

- AA guns em morros/serra e periferia de Sete Lagoas;
- comboios na MG-238 e estradas rurais;
- bases/factories em areas perifericas, industriais ou rurais;
- buildings fora da igreja, campo, pracas e Area de Lazer da Manga.

Critério de QA:

- `npm run validate:aero-map` passa;
- `game.targets.length > 0` em mission 1;
- todos os targets grounded;
- nenhum target nasce dentro do aeroporto ou sobre landmarks civis principais.

### Phase 9 — Visual And Regression Pass

Owners: `game-developer` + `qa-engineer`

Validar:

- Playwright screenshot de Inhauma;
- canvas nao vazio e com variedade de cores;
- sem `console.error`;
- FPS headless aceitavel;
- suite completa sem regressao em `islands`, `desert`, `rio`.

---

## 5. Test Matrix

| Test | Owner | Purpose |
|---|---|---|
| `inhauma-fidelity.spec.js` | qa-engineer | Fidelidade: cidades, landmarks, orientacao, relevo. |
| `map.spec.js` | qa-engineer | Cobertura padrao de mapa para `inhauma`. |
| `validate-aero-map.js` | qa-engineer | Validacao pura: bounds, terrain, targets, airport flatten. |
| `test-aero-sim.js` | qa-engineer | Layout obrigatorio e regressao de mapas. |
| `sortie/landing existing specs` | qa-engineer | Garantir que generalizacao do aeroporto nao quebrou desert. |
| Visual manual + screenshot | game-developer + qa-engineer | Confirmar que o mapa parece Inhauma antes de entrega ao operador. |

Comandos em `repos/tauan-games`:

```bash
npm run validate:aero-map
npm run test:aero:unit
npm run test:aero:sim
npm run test:aero:e2e
npm run test:aero:qa
```

Teste visual local:

```bash
.dadaia/.venv/bin/python -m http.server 8080
```

Abrir:

```text
http://localhost:8080/aero-fighters/index.html?map=inhauma
```

---

## 6. Files Expected To Change

Production:

- `aero-fighters/src/maps/inhauma.js`
- `aero-fighters/src/maps/index.js`
- `aero-fighters/src/config.js`
- `aero-fighters/src/airport.js`
- `aero-fighters/src/landing-zones.js`
- `aero-fighters/src/map-validation.js`
- `aero-fighters/src/debug.js`
- `aero-fighters/index.html`, only if map select is hardcoded

Tests:

- `tests/aero-fighters/inhauma-fidelity.spec.js`
- `tests/aero-fighters/map.spec.js`
- `tests/aero-fighters/tools/validate-aero-map.js`
- `tests/aero-fighters/tools/test-aero-sim.js`

Docs/spec workflow:

- `specs/features/aero-fighters-inhauma-map/TASKS.md` after this PLAN is approved.

---

## 7. Risk Controls

| Risk | Control |
|---|---|
| Mapa bonito mas geograficamente errado | QA valida relacao espacial e orientacao via diagnosticos. |
| Landmark existe mas em lugar sem sentido | QA compara landmark contra cidade/estrada correspondente. |
| Relevo visual nao bate com colisao | Mesma funcao matematica para mesh e `heightAt`; validate samples. |
| Detalhe urbano derruba FPS | `InstancedMesh`, detail budget por zona, periferia simplificada. |
| Novo aeroporto quebra desert | Tests de landing/sortie continuam obrigatorios. |
| Tests superficiais demais | `inhauma-fidelity.spec.js` deve falhar se faltar igreja, campo, Area da Manga, cidades ou orientacao. |

---

## 8. Definition Of Done

- PLAN e TASKS aprovados antes de implementacao.
- Task reservada em `TASKS.md` com marker `[-]` antes de tocar producao.
- `map=inhauma` carrega e e jogavel.
- Inhauma, Cachoeira da Prata e Sete Lagoas sao reconheciveis e orientadas corretamente.
- Igreja, campo, Area de Lazer da Manga, praca, estradas, fazendas e relevo estao representados.
- Aerodromo permite ciclo equivalente ao deserto.
- QA Playwright valida fidelidade, nao apenas carregamento.
- `npm run test:aero:qa` passa sem regressao.
