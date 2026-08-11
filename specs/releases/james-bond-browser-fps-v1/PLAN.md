# PLAN - Release: james-bond-browser-fps-v1

> **Status:** Aprovado
> **Release ID:** james-bond-browser-fps-v1

## Estratégia

Construir uma engine FPS compacta sobre Three.js r165. A colisão do jogador usa AABBs
mescladas e determinísticas, adequadas aos mapas ortogonais sem custo de compilação WASM;
a IA usa conceitos e estruturas Yuka vendorizadas; Howler fica disponível para assets
futuros, enquanto a v1 gera áudio original por Web Audio sem samples externos.

## Arquitetura

- `src/state.js`, `config.js`, `random.js`: contratos e dados.
- `src/engine/`: render, input, colisão e áudio.
- `src/content/`: seis mapas e definições de armas/missões.
- `src/gameplay/`: jogador, armas, objetivos e progressão.
- `src/ai/`: percepção, estados e movimento dos guardas.
- `src/fx/`: impactos, explosões, decals e pools.
- `src/ui/`: HUD, radar, mapa, briefing e resultado.
- `src/main.js`: orquestração e loop fixo.

## Sequência

1. Vendor dedicado e scaffold.
2. Render, input, colisão, mapas e interação.
3. Armas, dano, IA, objetivos e progressão.
4. FX, áudio, radar e telas.
5. Simulações, Playwright e correções visuais.

## Testes

- Node: armas, objetivos, percepção, explosões e save.
- Playwright: boot offline, canvas, menu, controles, disparo, inimigo alertado,
  mapa, conclusão de objetivo e troca de fase.
- Capturas desktop 1440x900 e mobile 390x844; canvas-pixel não vazio.

## Riscos e mitigação

- Escopo de seis mapas: mapas são composições data-driven sobre peças reutilizáveis.
- Performance: geometrias simples, instancing, pools e limite de guardas/FX.
- Áudio bloqueado: inicialização somente após gesto do jogador.
- IA presa: rotas por waypoints, steering limitado e recovery por timeout.
- Vendor/WASM: adaptadores preservam boot e testes mesmo antes do carregamento assíncrono.
