# TASKS — Release: space-war-ballistic-war-v1

> **Status:** Aprovado — 2026-07-03 · **SPEC:** [Aprovado] · **PLAN:** [Aprovado]

## Write set

`space-war/src/{ballistics,ship,weapons,nav,campaign,missions,enemies,fx,state,hud}.js`,
`tests/space-war/**`, `package.json` (script), esta release. **PROIBIDO:** gravity.js,
orbits.js, config.js, universe.js, celestial/*.

## Tasks

- [x] T-BW-01 `ballistics.js` solver + `tests/space-war/tools/test-ballistics-unit.js`
      (campo central analítico: acerta alvo orbital, arco curva). **AC-02(node), AC-06.**
- [x] T-BW-02 C=solução (ship.js) + arco no HUD (nav.js) + launch `aimed` gravidade
      pura (weapons.js) + `game.nav.solution` (state.js). **AC-01, AC-02.**
- [x] T-BW-03 Caçada sequencial (campaign.js hunt N + missions.js fila + retarget +
      escoltas enemies.js). Contagens 5/7/9/11/13. **AC-03.**
- [x] T-BW-04 Base v2 legível + nave capital orbitante (missions.js meshes). **AC-04.**
- [x] T-BW-05 `nukeMushroom` + duplo flash vácuo (fx.js/weapons.js). **AC-05.**
- [x] T-BW-06 e2e (solução/curva/caçada/contagens) + smoke+campanha adaptada verdes +
      QA + security + push/PR/CI. **AC-06.**
- [x] T-BW-07 Skybox uplift (demanda do operador mid-release, fotos em
      bug-space-war/): galeria de galáxias em destaque (espirais inclinadas, JATOS
      polares + lóbulo vermelho, discos edge-on com faixa de poeira), +9k estrelas
      de fundo — mais matéria-prima para a lente gravitacional esticar em arcos.
- [x] T-BW-08 Fix bug space-war-solar-system-key-drift (nav/map 'home'→'solar').
