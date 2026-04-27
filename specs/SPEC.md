# Spec: tauan-games

> **Status:** Aprovado
> **Versão:** 1.0
> **Autor:** Marco Menezes
> **Referências:** `specs/constitution.md`, `specs/memory/product.md`, `specs/foundation/SPEC.md`

---

## Contexto

tauan-games é um repositório de jogos casuais criados via Vibe Coding. O produto organiza jogos em duas arquiteturas distintas (HTML+CSS+JS vanilla para jogos simples, Golang para jogos complexos) e oferece uma estrutura padronizada de specs para que cada jogo seja implementado de forma consistente, sem débito técnico acumulado.

Cada jogo é auto-contido, funciona 100% offline e segue o workflow SDD: spec aprovada antes de qualquer implementação.

Esta spec define o comportamento do produto como um todo. Regras de arquitetura e detalhes por jogo ficam nas specs de `foundation/` e `features/`.

---

## Usuários e Goals

### US-001: Criar um novo jogo simples

- **Como** desenvolvedor usando Vibe Coding
- **Quero** seguir a arquitetura HTML+CSS+JS vanilla para criar um jogo
- **Para** ter um jogo que funciona no navegador sem dependências, offline e com estética própria

**Critérios de Aceite:**
- Dado que quero criar um novo jogo, quando sigo a arquitetura de jogos simples, então o jogo vive em `games/<jogo-name>/` com `index.html`, `style.css` e `game.js`
- Dado que o jogo segue a arquitetura canônica, quando abro `index.html` no navegador, então o jogo funciona sem dependências externas

### US-002: Especificar um jogo antes de implementar

- **Como** desenvolvedor ou agente de IA
- **Quero** escrever e aprovar specs de jogo antes de implementar
- **Para** garantir que o jogo tenha contrato claro de comportamento, visual e jogabilidade

**Critérios de Aceite:**
- Dado que quero criar um jogo, quando escrevo a spec em `specs/features/<jogo>/SPEC.md`, então a spec cobre game states, controles, obstáculos, pontuação, visual e parâmetros
- Dado que a spec está completa, quando ela é aprovada, então posso derivar PLAN.md e TASKS.md antes de implementar

### US-003: Jogar um jogo offline

- **Como** jogador casual
- **Quero** abrir um jogo no navegador e jogar sem internet
- **Para** me divertir sem dependências ou latência de rede

**Critérios de Aceite:**
- Dado que carreguei a página do jogo, quando estou offline, então o jogo funciona normalmente
- Dado que estou jogando, quando interajo com controles, então o jogo responde sem chamadas de rede

### US-004: Evoluir um jogo existente

- **Como** desenvolvedor
- **Quero** adicionar features a um jogo já implementado
- **Para** melhorar a experiência sem quebrar o que já funciona

**Critérios de Aceite:**
- Dado que quero adicionar uma feature, quando atualizo a spec do jogo primeiro, então a implementação segue o novo contrato sem ambiguidade
- Dado que a spec foi atualizada, quando a implementação diverge, então a spec prevalece e o código deve ser corrigido

---

## Requisitos Funcionais

- FR-001: Each game shall live in its own directory under `games/<jogo-name>/`.
- FR-002: Each game shall be executable by opening `games/<jogo-name>/index.html` in a modern browser.
- FR-003: No game shall import or reference code from another game.
- FR-004: Each game shall have a corresponding spec at `specs/features/<jogo-name>/SPEC.md` before implementation begins.
- FR-005: Simple games (HTML+CSS+JS) shall have zero external dependencies — no npm, no CDN, no frameworks.
- FR-006: All games shall be fully playable offline after initial page load.
- FR-007: The repository shall support two game architectures: simple (HTML+CSS+JS vanilla) and complex (Golang).
- FR-008: Each game shall follow the canonical file structure defined in `specs/memory/architecture.md`.
- FR-009: No game shall collect, transmit or store player data outside the browser's `localStorage`.
- FR-010: Each game shall implement at minimum the three canonical game states: `start`, `playing`, `gameOver`.

---

## Requisitos Não-Funcionais

- NFR-001: [Usabilidade] Games shall be immediately playable without configuration or installation beyond opening the HTML file.
- NFR-002: [Compatibilidade] Simple games shall work on Chrome 90+, Firefox 90+ and Safari 15+.
- NFR-003: [Segurança] No game shall make network requests during gameplay.
- NFR-004: [Manutenibilidade] All game behavior shall be traceable to a spec document.

---

## Fora de Escopo (v1.0)

- Infraestrutura de hosting ou deploy
- Leaderboard online ou multiplayer
- Framework de jogo reutilizável entre jogos (cada jogo é auto-contido)
- Jogos Golang (arquitetura definida mas sem jogos planejados)
- CI/CD ou automação de testes

---

## Questões Abertas

*Nenhuma bloqueante. Questões específicas de cada jogo ficam em suas respectivas specs de feature.*
