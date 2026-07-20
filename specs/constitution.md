---
specs_pattern_version: 4
---
# Constitution: tauan-games

> Leis imutáveis. Todo agente de IA trabalhando neste projeto DEVE seguir estas regras.
> Nunca implemente sem um SPEC.md aprovado. Nunca avance de fase sem aprovação humana explícita.

---

## Propósito do Projeto

Repositório de jogos e experimentos interativos desenvolvidos por Tauan e Marco.
Espaço de aprendizado e experimentação com desenvolvimento de jogos. Existe **uma
única spec** — esta, na raiz do repo tauan-games — e ela cobre o projeto inteiro,
com **todos** os jogos.

---

## Idioma

- **pt-BR é o idioma canônico do projeto**: UI dos jogos, HUD, textos de menu,
  nomes de fases/mapas, READMEs novos, specs, backlog e memória são escritos em
  português do Brasil.
- Código (identificadores, nomes de arquivos) permanece em inglês; comentários
  podem ser pt-BR.
- Documentos legados em inglês são migrados para pt-BR quando tocados.

---

## Estrutura do Repositório (lei estrutural)

Os jogos são classificados **por tecnologia** em dois grupos dentro de `src/`:

```
tauan-games/
  index.html            ← hub público: um card por jogo web
  src/
    web-games/          ← jogos de BROWSER (Three.js / Phaser / DOM puro)
      aero-fighters/    ← combate aéreo F-35 (Three.js)
      far-west/         ← faroeste open-world (Three.js)
      james-bond/       ← FPS de espionagem (Three.js)
      memoria-bichos/   ← jogo da memória infantil (HTML/CSS/JS puro)
      speed-run/        ← corrida arcade estilo Cruis'n (Three.js)
      tauan-trex/       ← clone do Chrome Dino (Phaser vendorizado)
    godot/              ← jogos DESKTOP nativos (Godot 4)
      aero-fighters-v2/ ← combate aéreo cel-shaded sobre Inhaúma-MG
      speed-run/        ← corrida com física VehicleBody3D
  space-war/            ← ⚠ MIGRAÇÃO PENDENTE → src/web-games/space-war
                          (aguarda sessão concorrente encerrar edições)
  vendor/               ← libs e assets de terceiros vendorizados (offline)
  tests/                ← suíte Playwright transversal (uma pasta por jogo web)
  specs/                ← ESTA spec única (constitution, memory, backlog, releases)
  img/                  ← imagens do hub
  .github/workflows/    ← CI + deploy GitHub Pages
```

Regras estruturais:

1. **Jogo novo em Godot → `src/godot/<jogo>/`. Jogo novo web → `src/web-games/<jogo>/`.**
   Nenhum jogo novo nasce na raiz.
2. Cada jogo é uma pasta **isolada e independente**; proibido um jogo importar
   código de outro jogo.
3. Infraestrutura transversal (permitida fora de `src/`): `vendor/`, `tests/`,
   `package.json`, `index.html` (hub), `.github/`.
4. `specs/` é única e central — jogos não têm `specs/` próprias. Documentos por
   jogo (`README.md`, opcionais `ARCHITECTURE.md`/`AGENTS.md`) vivem na pasta do
   jogo.

---

## Aspectos herdados por TODOS os jogos

Todo jogo do portfólio, em qualquer tecnologia, herda estas obrigações:

1. **Offline-first** — sem CDN, sem fetch externo em runtime. Libs e modelos 3D
   são vendorizados em `vendor/` (web) ou embutidos no projeto (Godot).
2. **Assets de terceiros só com licença clara** — CC0/CC-BY documentada em
   `vendor/models/LICENSES.md` (ou equivalente). Nunca assets de jogos comerciais.
3. **README pt-BR** com instruções de execução e tabela de controles.
4. **Testável por agente** — jogos web expõem estado de debug em `window`
   (ex.: `window.game`, `window.__corrida`); jogos Godot aceitam modo de teste
   headless por variável de ambiente (ex.: `CORRIDA_TEST=1`) com exit code.
5. **Ao menos um smoke test** — Playwright em `tests/<jogo>/` (web) ou cena/env
   de teste headless (Godot) validando que o jogo abre e joga sem erros.
6. **Roda no hardware do operador** — Ubuntu + Intel Iris Xe (iGPU). Efeitos que
   exigem GPU dedicada são proibidos ou degradam automaticamente.
7. **Controles descobríveis em segundos** — mapeamento exibido no jogo ou no menu.
8. **Física com suporte na realidade** — leis documentadas no código quando o
   jogo simula fenômenos reais (gravitação, relatividade, dinâmica veicular).

---

## Princípios de Desenvolvimento

1. **Simplicidade primeiro** — sem over-engineering; o objetivo é aprender e se divertir.
2. **Componentes de terceiros antes de reinventar** — bom gosto e fontes confiáveis
   (Quaternius/poly.pizza CC0, física nativa da engine) em vez de criar tudo de cabeça.
3. **Causa raiz, nunca workaround** — bug se reproduz, se mede (sondas empíricas
   como `tests/probe.gd`) e se corrige na origem.
4. **Qualidade visual mínima**: era PS1/N64 como piso para jogos 3D — low-poly é
   aceitável, sem textura/iluminação não é.

---

## Ladder de Engines

| Degrau | Tecnologia | Grupo | Jogos |
|--------|-----------|-------|-------|
| 0 | HTML/CSS/JS puro (DOM) | `src/web-games/` | memoria-bichos |
| 1 | Phaser 3 (vendor) | `src/web-games/` | tauan-trex |
| 2 | Three.js r165 (vendor, ES modules, sem build) | `src/web-games/` | aero-fighters, far-west, james-bond, space-war, speed-run |
| 3 | Godot 4.7 (GDScript, cenas texto, headless CLI) | `src/godot/` | aero-fighters-v2, speed-run |
| 4 | Unreal Engine 5 | — | reservado (bloqueado por hardware) |

A ladder é didática. Introduzir engine nova exige decisão explícita do operador.
Decisão 2026-07-18: corridas migram para Godot 4 (Degrau 3) por física de veículo
e gráficos de engine real; a versão Three.js do speed-run permanece como jogo web.

---

## Fluxo SDD (Spec-Driven Development)

```
SPEC.md [Aprovado] → PLAN.md [Aprovado] → TASKS.md [Aprovado] → Implementação
```

Cada seta requer aprovação humana explícita. Releases em `specs/releases/`,
backlog em `specs/backlog/`, bugs em `specs/bugs/` (ledger JSONL, hotfix na hora —
nunca release para bug). Memória de produto em `specs/memory/`.
