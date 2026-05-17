# Backlog — Agent Orchestration

Notas sobre coordenação dos agentes que atuam neste repositório. Não é spec — é um
documento vivo para registrar atritos, decisões de orquestração e ajustes de matriz de
autoridade observados durante releases.

## Agentes autorizados em `repos/tauan-games/`

| Agente | Sub-domínio | Escreve |
|---|---|---|
| `game-developer` | Lógica | C++/JS/Blueprints (gameplay), IA, física, balística, mecânicas |
| `game-designer` | Design | Assets estáticos/procedurais, materiais, mapas, áudio, scripts de pipeline |
| `game-tester` | Testes | Scripts Playwright/UE5 automation, reports HTML com evidências |

Demais agentes (`product-engineer`, `software-architect`, `software-engineer`,
`devops-engineer`, etc.) podem **ler** arquivos deste repo para contexto mas **não
escrevem**. Exceção: o `product-engineer` é o guardião exclusivo de `specs/` e pode
editar specs/PLAN/TASKS deste repo, sem tocar em código de jogo.

## Tie-breakers conhecidos

- Decisões UE5-específicas: `game-developer` vence sobre `software-architect`.
- Conflito entre `game-developer` e `game-designer` em assets que afetam gameplay (ex.:
  hitbox de inimigo, layout de mapa que afeta missão): `product-engineer` decide.
- Critério "Tauan-friendly" (criança consegue jogar): autoridade final de `game-tester`,
  porque ele tem o teste automatizado.

## Atritos registrados

(vazio — popular conforme ocorrer)
