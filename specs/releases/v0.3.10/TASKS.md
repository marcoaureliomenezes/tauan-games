# TASKS — v0.3.10

> **Status:** Aprovado
> **Aprovação:** 2026-07-20 — operador (diretiva de playtest; escopo SOMENTE web).
> **Owner:** sessão coordenadora kimi.
> Markers: `[ ]` OPEN · `[-]` IN PROGRESS · `[x]` DONE

## Onda 1 — nuke: bola de fogo + firestorm

- [x] T-N-01: rework visual da bola de fogo (shaders + mesh em nuclear-fx.js) —
      núcleo branco-quente, turbulência rica, borda incandescente; manter contrato
      de testes (raio ≤ 131, estágios, curvas puras). Write set:
      `src/nuclear-fx.js`
- [x] T-N-02: firestorm — novo `src/firestorm.js` com emissores faseados
      (fogo 60 s → fumaça 120 s → carbonizado permanente), ignição em raio 260 m
      (2× fireball) cobrindo árvores, estruturas e `game.targets`; constantes em
      config.js; tick em main.js. Write set: `src/firestorm.js` (novo),
      `src/projectiles.js`, `src/config.js`, `src/main.js`, `src/prop-fire.js`
- [x] T-N-03: carbonização — mapa estrutura→instância (inhauma-city.js), índice de
      árvores (inhauma-scene.js), clone+escurecimento de materiais de veículos
      (targets/units); `setColorAt` preto nos instanced meshes. Write set:
      `src/maps/inhauma-city.js`, `src/maps/inhauma-scene.js`, `src/firestorm.js`,
      `src/targets.js`, `src/formations/units.js`
- [x] T-N-04: testes da nuke — Node T-09 espelha novas curvas/raios; Playwright
      nuclear-fx.spec.js verde. Write set: `tests/aero-fighters/tools/test-aero-sim.js`,
      `tests/aero-fighters/nuclear-fx.spec.js`

## Onda 2 — defesa: morro, frentes, retaguarda, cidades

- [x] T-D-01: morro 2.5× — contribuição de relevo em inhaumaBaseHeight + HILL_POS,
      SOLDIER_POS ao topo, cidade acomoda o monte; horizonte claro em 2 direções.
      Write set: `src/maps/inhauma-scene.js`, `src/config.js`,
      `src/defense/defense-mode.js`
- [x] T-D-02: 4 frentes — diretor quantiza direção das esquadrilhas em 4 setores.
      Write set: `src/defense/defense-director.js`, `src/config.js`
- [x] T-D-03: retaguarda coberta — bateria aliada dedicada no setor traseiro com
      engajamento efetivo (hit chance alta, alvo preferencial no setor traseiro).
      Write set: `src/defense/allied-batteries.js`, `src/config.js`,
      `src/defense/defense-mode.js`
- [x] T-D-04: Cachoeira × Inhaúma — afastar (~2 km), re-sondar DEM, migrar rotas
      de campanha/guarnição/metadados. Write set: `src/maps/inhauma-scene.js`,
      `src/config.js`, `src/maps/inhauma.js`, `src/maps/inhauma-garrison.js`
- [x] T-D-05: testes da defesa — re-escrever asserts de SOLDIER_POS/elevação,
      setores do diretor, cachoeira/campanha no novo local. Write set:
      `tests/aero-fighters/tools/test-aero-defense-mode.mjs`,
      `tests/aero-fighters/tools/test-aero-defense-director.mjs`,
      `tests/aero-fighters/tools/test-aero-cachoeira.mjs`,
      `tests/aero-fighters/tools/test-aero-campaign.mjs`

## Onda 3 — documentação de port

- [x] T-P-01: `PORT-GODOT.md` — documentar todas as mudanças (constantes, fórmulas,
      módulos, fases do fogo, morro, setores, retaguarda, cidades) para o port ao
      `src/godot/aero-fighters/`. Write set:
      `specs/releases/v0.3.10/PORT-GODOT.md`
