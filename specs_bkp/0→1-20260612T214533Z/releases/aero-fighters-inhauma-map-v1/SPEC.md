# SPEC: Aero Fighters — Mapa Inhauma

> **Status:** Aprovado — 2026-05-16 (aprovado pelo operador: "Aprovado.")
> **Author:** Codex / dadaia Labs
> **Created:** 2026-05-16
> **Depends on:** `specs/features/aero-fighters/SPEC.md` [x] Approved

---

## 1. Overview

Adicionar um novo mapa jogavel chamado `inhauma` ao Aero Strike / Aero Fighters.

O mapa deve representar a regiao de Inhauma-MG com foco visual e geografico em Inhauma, usando como referencia as imagens coletadas em `aero-fighters/img/`. As imagens nao entram no runtime como textura ou asset: elas servem apenas para guiar topografia, malha urbana, estradas, marcos, fazendas, vegetacao e distribuicao visual.

O mapa deve espelhar as capacidades ja existentes do mapa `desert`:

- selecao por `map=inhauma`;
- aeroporto/aerodromo jogavel para decolagem, pouso e service zone;
- alvos militares estaticos;
- AA guns como defesa hostil;
- validacao de altura/grounding dos alvos;
- diagnosticos Playwright via `window.__aeroDebug`.

Prioridade de fidelidade: **Inhauma ultra**. Inhauma deve ser detalhada; Cachoeira da Prata e Sete Lagoas devem existir e ser reconheciveis em escala comprimida para jogabilidade.

---

## 2. Reference Inputs

As referencias visuais obrigatorias sao os screenshots em:

```text
aero-fighters/img/
```

Eles cobrem:

- vista satelite detalhada de Inhauma, malha de ruas, bairros, vegetacao e fazendas;
- vista obliqua da cidade com campo, casas, igreja e relevo ao fundo;
- imagem da igreja com torre triangular e praca;
- mapas de relevo/terrain com curvas de nivel e morros em torno de Inhauma;
- rota e relevo entre Inhauma e Cachoeira da Prata;
- conexao regional ate Sete Lagoas, incluindo MG-238 e areas de serra/lagoas.

As referencias devem ser traduzidas para geometria procedural Three.js, nao copiadas como imagens.

---

## 3. Functional Requirements

### FR-01 — Map Identity

- Novo map key: `inhauma`.
- Label visivel: `Inhauma`.
- Deve carregar por URL `aero-fighters/index.html?map=inhauma`.
- Deve ser incluido no seletor de mapas se houver menu visual.
- Deve aparecer nos diagnosticos de mapa como `activeMap: "inhauma"`.

### FR-02 — Geographic Composition

O mapa deve conter obrigatoriamente:

- Inhauma como cidade central e mais detalhada;
- Cachoeira da Prata a oeste/sudoeste de Inhauma;
- Sete Lagoas a leste/nordeste de Inhauma;
- conexao principal por MG-238 em escala comprimida;
- estrada AMG-0360 saindo de Inhauma;
- Rod. Mun. Inhauma e estradas rurais locais;
- fazendas, sitios, pastos, manchas de mata, morros e vales ao redor.

A escala deve preservar a relacao espacial geral, mas pode comprimir distancias para manter voo e combate divertidos.

### FR-03 — Inhauma Ultra Detail

Inhauma deve ter o maior nivel de detalhe do mapa:

- malha urbana com ruas curvas e quarteiroes irregulares;
- casas baixas com telhados terracota/cinza;
- igreja principal com torre triangular alta, nave clara e praca arborizada;
- campo de futebol visivel;
- Area de Lazer da Manga;
- pracas centrais;
- saidas/avenidas principais conectadas as estradas rurais;
- bairros periféricos mais espaçados;
- vegetacao densa em bordas de morro e corredores verdes.

### FR-04 — Relevo Realista

O relevo e parte essencial do mapa.

- Deve haver morros e ondulacoes em torno de Inhauma, com encostas visiveis de voo baixo e vista aerea.
- Regioes de serra/alto relevo devem aparecer entre Inhauma e Sete Lagoas.
- A area de Cachoeira da Prata deve ter relevo/vale e cursos d'agua/lagoas simplificados.
- A funcao `inhaumaHeightAt(region, dx, dz)` deve corresponder ao relevo visual usado na mesh.
- O aerodromo deve ser nivelado sem intrusoes de terreno na pista, taxiway ou service zone.

### FR-05 — Aerodromo De Inhauma

O mapa deve ter aerodromo ficcional em fazenda proxima, fora do centro urbano.

- Deve suportar decolagem, pouso e service zone como o aeroporto do deserto.
- Deve ter pista plana, taxiway, area de servico e marcacoes visiveis.
- Deve preservar a cidade de Inhauma como area detalhada, sem pista atravessando bairros.
- Deve aparecer nos diagnosticos de aeroporto quando `activeMap === "inhauma"`.

### FR-06 — Targets And Mission Flow

O mapa deve usar as mecanicas atuais de ground strike:

- alvos validos: `base`, `factory`, `building`, `convoy`, `aaGun`;
- AA guns devem defender pontos altos ou marcos estrategicos;
- comboios devem seguir estradas principais/rurais;
- bases/factories/buildings devem ficar aterrados no relevo correto;
- missao 1 deve ter alvos suficientes para gameplay imediato;
- missoes posteriores podem usar mais alvos do mesmo layout, respeitando `MISSION.WAVE_SIZES`.

### FR-07 — Procedural/Offline Constraint

- Nao adicionar `.gltf`, `.obj`, imagens de textura ou chamadas de rede.
- Nao depender de Google Maps no runtime.
- Todo visual deve ser feito com primitivos Three.js, materiais, vertex colors, `CanvasTexture` gerada em runtime ou `InstancedMesh`.

### FR-08 — Performance

- O mapa deve manter a suite Playwright existente sem regressao.
- Casas, arvores, postes e predios repetidos devem usar `InstancedMesh`.
- O detalhe urbano deve ser concentrado em Inhauma; Sete Lagoas e Cachoeira da Prata podem ser simplificadas.
- A cena deve evitar explosao de draw calls por microdetalhe.

---

## 4. Non-Functional Requirements

- Sem build step.
- Sem novas dependencias npm.
- Sem alteracao de `vendor/`.
- Sem quebrar os mapas `islands`, `desert` e `rio`.
- Sem alterar contratos existentes de `window.game` usados por testes.
- Compatibilidade com test mode e diagnosticos atuais.

---

## 5. Acceptance Criteria

| ID | Criterion |
|---|---|
| AC-IH-01 | `?map=inhauma&testMode=1` carrega sem `console.error` e renderiza canvas nao vazio. |
| AC-IH-02 | `window.__aeroDebug.getMapDiagnostics().activeMap === "inhauma"`. |
| AC-IH-03 | O mapa contem Inhauma, Cachoeira da Prata e Sete Lagoas em regioes distintas e reconheciveis. |
| AC-IH-04 | Inhauma contem igreja, campo, Area de Lazer da Manga, pracas, casas, ruas e saidas principais. |
| AC-IH-05 | O relevo de Inhauma e arredores e visivel e `getTerrainHeightAt(x, z)` retorna valores finitos nas amostras principais. |
| AC-IH-06 | O aerodromo de Inhauma permite decolagem/pouso/service zone e sua pista e plana. |
| AC-IH-07 | A missao spawna alvos no mapa `inhauma`; todos os alvos ficam grounded dentro da tolerancia de QA. |
| AC-IH-08 | `npm run validate:aero-map` passa incluindo `inhauma`. |
| AC-IH-09 | `npm run test:aero:qa` passa sem regressao dos mapas existentes. |

---

## 6. Out of Scope

- Usar screenshots do Google Maps como textura no jogo.
- Precisao cartografica metro-a-metro.
- Recriar todos os predios reais de Sete Lagoas.
- Multiplayer, novas armas ou novos tipos de alvo.
- Mudancas de motor grafico, build step ou dependencias.

---

## 7. Implementation Notes

O PLAN deve decidir os arquivos exatos, mas a implementacao provavelmente tocara:

- `aero-fighters/src/maps/inhauma.js`;
- `aero-fighters/src/maps/index.js`;
- `aero-fighters/src/config.js`;
- `aero-fighters/src/airport.js`;
- `aero-fighters/src/landing-zones.js`;
- `aero-fighters/src/map-validation.js`;
- `aero-fighters/src/debug.js`;
- testes em `tests/aero-fighters/`.

Antes de qualquer codigo de producao, o PLAN e o TASKS desta feature precisam estar aprovados.
