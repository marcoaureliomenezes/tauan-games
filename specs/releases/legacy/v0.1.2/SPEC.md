# Foundation: tauan-games

> **Status:** Aprovado
> **Versão:** 1.0
> **Escopo:** Princípios e substrato arquitetural permanentes do repositório `tauan-games`.
> **Não muda:** entre releases. Mudar este documento exige decisão explícita do operador.

---

## Propósito

Congelar o substrato do repositório: que engines são autorizadas, que agentes podem
escrever código, quais são as fronteiras de scope. Esta foundation impede que cada nova
release reabra decisões sobre stack, organização e autoridade.

**Problema central a evitar:** drift entre os três jogos por escolhas estruturais
divergentes ou por agentes não-autorizados modificando código de jogo.

---

## Ladder das quatro engines

Este repositório opera em quatro degraus de complexidade crescente. Um jogo nunca pode
saltar degraus sem decisão explícita do operador.

| Degrau | Engine | Jogo de referência | Tipo |
|--------|--------|---------------------|------|
| 1 | Phaser.js | `tauan-trex/` | 2D browser |
| 2 | Three.js | `aero-fighters/` (v1) | 3D browser |
| 3 | Godot 4 | `aero-fighters-v2/` | 3D desktop indie (NOVO 2026-05-18) |
| 4 | Unreal Engine 5 (Blueprints + C++) | reservado para futuro | 3D desktop AAA |

Justificativa da ladder: cada degrau ensina conceitos que o anterior não cobre
(loop/input/física 2D → modularização 3D + materiais PBR → scene-graph + scripting +
signals + export pipeline indie → pipeline industrial AAA). Jogos novos escolhem o
degrau adequado ao escopo, mas o repositório nunca terá um quinto degrau "flutuante" —
qualquer engine fora desta lista exige promoção via product-engineer.

> **Emenda 2026-05-18 (ADR-V2-G-02):** Ladder ampliada de 3 para 4 degraus para
> acomodar Godot 4 como ponto intermediário entre Three.js (3D browser puro) e
> UE5 (AAA desktop). Drive: incompatibilidade Ubuntu 24.04 + Iris Xe com o
> source-build do UE 5.5 (clang-18/libicu74 mismatches; bundled DotNet quebrado;
> GitDependencies droppando binários Linux x86_64 sistematicamente). UE5 não foi
> removido; foi deferido para futuro jogo/release quando hardware permitir
> (RTX 3060 ou cloud GPU rental). Decisão operador via product-engineer.
> Ver `.dadaia/reports/tauan-games/product-engineer/2026-05-18T005834Z-godot-pivot.html`.

---

## Princípios de produto

1. **Público-alvo é Tauan (criança).** Todo jogo deve ser imediatamente jogável: sem tela
   de loading visível, sem erros no console, controles simples e descobertos em segundos.
2. **Projetos independentes.** Cada jogo/experimento é uma pasta isolada na raiz do repo.
   Exceção: tooling de qualidade compartilhado — `package.json` e `tests/` na raiz são
   infraestrutura transversal, não lógica de jogo.
3. **Simplicidade primeiro.** Sem over-engineering. O objetivo é aprender e se divertir.
4. **Sem build step nos jogos web.** Phaser e Three.js operam diretamente sobre
   `index.html` + JS. Abre direto no browser.
5. **Sem assets externos em jogos web.** Sprites, sons e modelos 3D são todos procedurais/
   programáticos. Zero dependências de load externo que possam falhar. Vendor local
   commitado em `vendor/`.
6. **Documentação mínima.** README por jogo é obrigatório com instruções de como rodar.
   Documentos adicionais (`AGENTS.md`, `ARCHITECTURE.md`, `CONVENTIONS.md`) são opcionais
   quando o jogo cresce além de 1 arquivo.

---

## Agentes autorizados

Apenas três agentes têm autoridade para escrever em `repos/tauan-games/`:

| Agente | Sub-domínio | Escreve |
|---|---|---|
| `game-developer` | Lógica | C++, JS, Blueprints (gameplay), IA, física, balística, mecânicas, fixtures de teste |
| `game-designer` | Design | Assets estáticos/procedurais, materiais, mapas, áudio, scripts de pipeline, specs de assets, HDA |
| `game-tester` | Testes | Scripts Playwright/UE5 automation, reports HTML com evidências |

Demais agentes do workspace (`product-engineer`, `software-architect`, `software-engineer`,
`frontend-engineer`, `backend-engineer`, `qa-engineer`, `devops-engineer`) podem **ler**
arquivos deste repo para contexto mas **não escrevem**. Exceção exclusiva: o
`product-engineer` é o guardião absoluto de `specs/` neste e em todos os repos do
workspace, podendo editar specs/PLAN/TASKS sem nunca tocar em código de jogo.

A matriz completa de autoridade (incluindo tie-breakers) está em
`.claude/rules/game-agents-coordination.md` no workspace e em
`.claude/rules/game-developer-scope.md` em cada projeção de tool.

---

## Stack comprometida (não-foundational, ver `memory/tech-stack.html`)

Stacks ativas são listadas em `specs/memory/tech-stack.html`. Esta foundation **não**
duplica a lista — apenas afirma que a ladder das três engines é a única superfície
permitida e que mudanças exigem decisão do operador.

---

## Fluxo SDD

```
SPEC.md [Aprovado] → PLAN.md [Aprovado] → TASKS.md [Aprovado] → Implementação
```

Cada seta requer aprovação humana explícita. Cada release vive em
`specs/releases/<release-id>/` durante a fase ativa e migra para
`specs/_archive/releases/<release-id>/` ao chegar a CLOSURE.

O ponteiro do release ativo está em `specs/releases/ACTIVE.md` no formato:

```
release: <release-id>
phase: <draft|aprovado|in-progress|closure>
```

---

## Distribuição

- **Jogos web (Phaser, Three.js):** servidos por `npx serve` localmente; deploy alvo é
  GitHub Pages (branch `gh-pages`, cada jogo em subpasta).
- **Jogos UE5:** build pipeline ainda a definir; alvo é executável standalone linkado
  no README do projeto.

---

## Estrutura canônica do repositório

```
tauan-games/
├── README.md
├── AGENTS.md                       ← orientações para agentes (legado, opcional)
├── index.html                      ← landing page (lista jogos)
├── package.json                    ← infra de testes Playwright compartilhada
├── tests/                          ← Playwright smoke tests para todos os jogos
├── vendor/                         ← libs de terceiros versionadas (Phaser, Three.js)
├── <game-name>/                    ← uma pasta por jogo (tauan-trex, aero-fighters, ...)
│   ├── index.html
│   ├── README.md
│   └── (src/, assets/, ...)
└── specs/                          ← governance SDD (este diretório)
    ├── constitution.md
    ├── foundation/SPEC.md          ← este arquivo
    ├── memory/
    │   ├── architecture.html
    │   ├── tech-stack.html
    │   └── product/<concept>.html  ← atomic HTML, 1 conceito por arquivo
    ├── backlog/                    ← candidates/ideas/future/agent-orchestration
    ├── releases/                   ← release ativa + ACTIVE.md ponteiro
    └── _archive/releases/          ← releases encerradas (read-only)
```

---

## Critérios de aceite desta foundation

- Toda release nova respeita a ladder das três engines.
- Toda release nova é proposta e implementada exclusivamente pelos três agentes `game-*`.
- Nenhum jogo introduz build step, dependência externa de assets ou TypeScript sem
  alterar esta foundation primeiro.
- Toda release passa pela harness Playwright antes de ser considerada CLOSURE.
