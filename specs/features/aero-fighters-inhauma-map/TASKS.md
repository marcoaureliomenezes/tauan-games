# TASKS: Aero Fighters — Mapa Inhauma

> **Status:** Aprovado — 2026-05-16 (aprovado pelo operador: "Aprovado. Executar")
> **SPEC:** `specs/features/aero-fighters-inhauma-map/SPEC.md` [Aprovado]
> **PLAN:** `specs/features/aero-fighters-inhauma-map/PLAN.md` [Aprovado]
> **Created:** 2026-05-16

---

## Pre-implementation Checklist

- [x] SPEC.md aprovado
- [x] PLAN.md aprovado
- [x] TASKS.md aprovado
- [ ] Nenhuma task em progresso duplicada neste arquivo

---

## Task Protocol

Antes de tocar codigo de producao em `aero-fighters/`:

1. Escolher uma task `[ ]`.
2. Trocar para `[-]`.
3. Commitar somente essa reserva: `chore(tasks): start <task-id>`.
4. Implementar.
5. Verificar criterios da task.
6. Trocar `[-]` para `[x]` no commit final da task.

---

## Tasks

### [x] T01 — QA-first: criar suite de fidelidade Inhauma

**Owner:** `qa-engineer`

Criar `tests/aero-fighters/inhauma-fidelity.spec.js` com testes inicialmente falhando para:

- `map=inhauma` carrega sem `console.error`;
- `getMapDiagnostics().activeMap === "inhauma"`;
- diagnostico contem `cities`, `landmarks`, `roads`, `terrainRegions`, `airport`;
- cidades obrigatorias: `inhauma`, `cachoeira-da-prata`, `sete-lagoas`;
- landmarks obrigatorios: `igreja-inhauma`, `campo-inhauma`, `area-lazer-manga`, `praca-central-inhauma`, `aerodromo-inhauma`;
- vias obrigatorias: `mg-238`, `amg-0360`, `rod-mun-inhauma`;
- regioes de relevo obrigatorias: `serra-sete-lagoas`, `morros-oeste-inhauma`, `vale-cachoeira-prata`, `morro-norte-inhauma`.

**Verify:**

```bash
npx playwright test tests/aero-fighters/inhauma-fidelity.spec.js --config=tests/playwright.config.js --reporter=list
```

O teste deve falhar antes da implementacao do mapa e passar ao final da feature.

---

### [x] T02 — QA: expandir validadores existentes para inhauma

**Owner:** `qa-engineer`

Atualizar:

- `tests/aero-fighters/map.spec.js`;
- `tests/aero-fighters/tools/validate-aero-map.js`;
- `tests/aero-fighters/tools/test-aero-sim.js`.

Adicionar `inhauma` aos mapas obrigatorios, com checks de:

- targets grounded;
- terrain samples finitos;
- diagnostico identifica mapa;
- runway/taxiway/service flat sweep;
- nenhum target dentro do aeroporto;
- nenhum target sobre landmarks civis principais.

**Verify:**

```bash
npm run validate:aero-map
npm run test:aero:sim
npm run test:aero:e2e
```

No inicio, os checks de `inhauma` podem falhar por mapa ausente; ao final devem passar.

---

### [-] T03 — Game-dev: registrar map key e skeleton do mapa Inhauma

**Owner:** `game-developer`

Implementar o skeleton minimo:

- criar `aero-fighters/src/maps/inhauma.js`;
- exportar `createInhaumaWorld`, `updateInhaumaWorld`, `inhaumaHeightAt`;
- adicionar `inhauma` em `MAP_KEYS`, `MAP_LABELS` e `MAPS`;
- adicionar `TARGET_LAYOUT_INHAUMA` temporario/minimo;
- adicionar `MAP_VALIDATION_DEFS.inhauma`;
- atualizar diagnostics para `mapsCovered` incluir `inhauma`.

**Verify:**

```bash
npm run validate:aero-map
npx playwright test tests/aero-fighters/map.spec.js --config=tests/playwright.config.js --grep "inhauma"
```

---

### [ ] T04 — Game-dev: implementar relevo procedural fiel

**Owner:** `game-developer`

Implementar no `inhauma.js`:

- base rural grande;
- `INHAUMA_TERRAIN_DEFS` com regioes nomeadas;
- `roundedHill`, `ridge`, `valley`, `urbanRise`;
- morros oeste/norte/sudeste de Inhauma;
- serra entre Inhauma e Sete Lagoas;
- vale de Cachoeira da Prata;
- vertex colors para pasto, mata, solo exposto e rocha;
- `inhaumaHeightAt` em paridade com a malha visual.

Atualizar `map-validation.js` com a mesma definicao/funcoes puras.

**Verify:**

```bash
npm run validate:aero-map
npx playwright test tests/aero-fighters/inhauma-fidelity.spec.js --config=tests/playwright.config.js --grep "terrain|relevo"
```

---

### [ ] T05 — Game-dev: estradas e orientacao geografica

**Owner:** `game-developer`

Implementar:

- `cities` diagnosticas para Inhauma, Cachoeira da Prata e Sete Lagoas;
- `addRoadPolyline` ou helper equivalente;
- MG-238 conectando Cachoeira -> sul/sudeste de Inhauma -> Sete Lagoas;
- AMG-0360 saindo sul/sudoeste;
- Rod. Mun. Inhauma saindo norte/nordeste;
- ruas urbanas principais em Inhauma;
- estradas rurais para fazendas/sitios.

**Verify:**

```bash
npx playwright test tests/aero-fighters/inhauma-fidelity.spec.js --config=tests/playwright.config.js --grep "orientation|geographic|road"
```

---

### [ ] T06 — Game-dev: Inhauma ultra detail

**Owner:** `game-developer`

Adicionar detalhe urbano principal:

- ruas curvas e quarteiroes irregulares;
- casas baixas via `InstancedMesh`;
- igreja com torre triangular, nave clara e praca arborizada;
- campo de futebol com linhas e traves;
- Area de Lazer da Manga;
- praca central;
- bairros perifericos;
- vegetacao de encostas e bordas urbanas;
- diagnostics de landmarks com posicao, kind, height e radius.

**Verify:**

```bash
npx playwright test tests/aero-fighters/inhauma-fidelity.spec.js --config=tests/playwright.config.js --grep "landmark|Inhauma"
```

---

### [ ] T07 — Game-dev: Cachoeira da Prata, Sete Lagoas e fazendas

**Owner:** `game-developer`

Adicionar periferia:

- Cachoeira da Prata com malha pequena, vale, curso d'agua/lagoa e casas;
- Sete Lagoas com area urbana maior simplificada, lagoas e area industrial;
- fazendas, galpoes, currais, pastos e areas circulares de plantio;
- manchas de mata e solo exposto/mineracao conforme referencias.

**Verify:**

```bash
npx playwright test tests/aero-fighters/inhauma-fidelity.spec.js --config=tests/playwright.config.js --grep "Cachoeira|Sete|rural"
```

---

### [ ] T08 — Game-dev: aerodromo de Inhauma e landing zones por mapa

**Owner:** `game-developer`

Generalizar aeroporto:

- manter comportamento do `desert`;
- adicionar `inhaumaAirport` e `createInhaumaAirport`;
- criar helper de aeroporto ativo por mapa;
- atualizar `landing-zones.js` para runway/taxiway/service por mapa;
- atualizar diagnostics do aeroporto ativo;
- nivelar pista/taxiway/service em `inhaumaHeightAt`;
- adicionar hangares rurais e label `AERODROMO INHAUMA`.

**Verify:**

```bash
npm run test:aero:sim
npx playwright test tests/aero-fighters/landing.spec.js tests/aero-fighters/sortie.spec.js --config=tests/playwright.config.js
npx playwright test tests/aero-fighters/inhauma-fidelity.spec.js --config=tests/playwright.config.js --grep "airport|runway|aerodromo"
```

---

### [ ] T09 — Game-dev: targets e gameplay do mapa

**Owner:** `game-developer`

Finalizar `TARGET_LAYOUT_INHAUMA`:

- pelo menos 20 entradas;
- AA guns em morros/serra e periferia de Sete Lagoas;
- comboios na MG-238 e estradas rurais;
- bases/factories em areas perifericas, industriais ou rurais;
- buildings fora dos landmarks civis;
- todos aterrados no relevo correto;
- nenhum target no aerodromo.

**Verify:**

```bash
npm run validate:aero-map
npx playwright test tests/aero-fighters/map.spec.js tests/aero-fighters/inhauma-fidelity.spec.js --config=tests/playwright.config.js --reporter=list
```

---

### [ ] T10 — QA: visual smoke e regressao completa

**Owner:** `qa-engineer`

Executar validacao final:

- screenshot Playwright de `map=inhauma`;
- checar canvas nao vazio e variedade de cores;
- checar renderer stats;
- checar sem `console.error`;
- rodar suite completa;
- registrar qualquer gap de fidelidade visual encontrado para ajuste antes de fechar.

**Verify:**

```bash
npm run test:aero:qa
```

---

## Completion Criteria

- [ ] Todos os checks de `inhauma-fidelity.spec.js` passam.
- [ ] `npm run validate:aero-map` passa.
- [ ] `npm run test:aero:qa` passa.
- [ ] Inhauma, Cachoeira da Prata e Sete Lagoas aparecem orientadas corretamente.
- [ ] Igreja, campo, Area de Lazer da Manga, praca, estradas, fazendas e relevo estao representados.
- [ ] Aerodromo de Inhauma funciona sem quebrar o aeroporto do deserto.
