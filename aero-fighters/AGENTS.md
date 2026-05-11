# Aero Strike — Repo Context (agentes)

> Carregado por Claude Code, OpenCode, Codex quando trabalhando em `aero-fighters/`.
> Complementa `tauan-games/AGENTS.md` (workspace) com conhecimento de domínio do jogo.

## Propósito

Jogo 3D de ataque ao solo no browser. Player pilota um F-35 Lightning II destruindo alvos militares estáticos (bases, fábricas, prédios, comboios, canhões AA) em um arquipélago. Three.js puro, sem bundler, sem TypeScript — abre direto via `python3 -m http.server`.

Audiência: filho do operador (Tauan, 4 anos) joga; futuramente (8-12 anos) aprenderá programação editando `config.js` e `missions.js`.

## Documentos de leitura obrigatória antes de qualquer mudança

1. `aero-fighters/ARCHITECTURE.md` — auditoria + arquitetura modular alvo
2. `aero-fighters/CONVENTIONS.md` — regras práticas
3. `aero-fighters/README.md` — visão de usuário
4. Workspace root: `/home/ubuntu/workspace/repos/tauan-games/specs/constitution.md`

## Stop Conditions

- **NÃO** introduzir build step (vite, webpack, esbuild). Constituição: "abre HTTP server e roda".
- **NÃO** introduzir TypeScript. JSDoc é o limite.
- **NÃO** quebrar o contrato `window.game` (tests dependem). Adicionar campos OK; remover/renomear não.
- **NÃO** importar `entities` cruzados além das exceções documentadas em `CONVENTIONS.md`.
- **NÃO** editar `vendor/three.module.min.js`.
- **NÃO** adicionar lib externa sem aprovação do operador.

## Paths importantes

- `src/main.js` — entry point. Carregado por `index.html` como `<script type="module">`.
- `src/config.js` — **único** lugar para magic numbers (velocidades, HP, cores, ranges).
- `src/state.js` — `game` object + `resetState()`. Fonte da verdade.
- `tests/aero-fighters/smoke.spec.js` — Playwright suite. Roda com `npx playwright test`.

## Comandos

```bash
# Servir o jogo
cd /home/ubuntu/workspace/repos/tauan-games && python3 -m http.server 8080
# abrir http://localhost:8080/aero-fighters/

# Rodar tests
cd /home/ubuntu/workspace/repos/tauan-games && npx playwright test tests/aero-fighters/

# Syntax check de um módulo
node --check --input-type=module < aero-fighters/src/<file>.js
```

## Padrões obrigatórios

- Pools de Three.js Mesh para tudo que spawna/recicla (balas, partículas, debris, smoke).
- Quaternion-based rotation (player.js usa). Não use Euler.
- `dt` (delta time) em segundos passado como primeiro parâmetro a updates.
- Funções puras quando possível. `islandHeightAt(isl, dx, dz)` é exemplo bom.
- `_v1, _v2, _v3` (THREE.Vector3) reutilizáveis em escopo de módulo; não alocar Vector3 dentro de loop.

## Onde vai cada feature nova

Ver `CONVENTIONS.md` (tabela "Onde vai cada coisa nova").

## Feature pipeline atual

1. ✅ Modularização (este trabalho)
2. ⏳ Balística + mira: crosshair fixo no centro, reticle de míssil móvel com lock-on (cone ±15°, beep, dispara só com lock)
3. (futuro) Mais missões, novos tipos de alvo, possibilidade de cenários alternativos

## Ao terminar uma feature

- `npx playwright test tests/aero-fighters/` deve passar.
- Smoke-test manual: jogar 60s, verificar visualmente que nada quebrou.
- Atualizar `README.md` se a feature for visível ao usuário.
- Commit isolado por feature, mensagem em português.
