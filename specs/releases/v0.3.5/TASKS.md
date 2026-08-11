# TASKS — v0.3.5

> **Status:** Aprovado
> **Aprovação:** 2026-07-18 — operador (diretiva "BATERIA ANTIAÉREA DE INHAÚMA").
> **Owner:** sessão coordenadora kimi — ondas sequenciais, write sets disjuntos.
> Markers: `[ ]` OPEN · `[-]` IN PROGRESS · `[x]` DONE

## Onda D1 — Fundação do modo (registry, gimbal, câmera, input, HUD base)

- [x] T-D-01: modo `'inhauma-defense'` em `src/maps/index.js` (MAP_KEYS/MAP_LABELS/
      MAPS) reutilizando a cena de Inhaúma; spawn do soldado em ponto alto real do
      DEM com vista para a TOWN_SHELF; bloco `AA_DEFENSE` em `config.js`.
      Write set: `src/maps/index.js`, `src/maps/inhauma.js`, `src/config.js`,
      `src/state.js`
- [x] T-D-02: `src/defense/turret-player.js` (posição fixa, gimbal yaw/pitch, HP,
      arma, munição) + `src/input.js` (flags semânticas de mouse: move/LMB/RMB/
      scroll, pointer lock state). Write set: `src/defense/turret-player.js`,
      `src/input.js`
- [x] T-D-03: `src/defense/turret-camera.js` (pointer lock, mouse mira, pitch
      -10°..+85°, zoom RMB) integrado a `camera-modes.js` sem quebrar voo; HUD base:
      retículo central + spans no index.html (padrão diff-render de hud.js).
      Write set: `src/defense/turret-camera.js`, `src/camera-modes.js`,
      `src/hud.js`, `index.html`, `src/main.js`

## Onda D2 — Armas da bateria

- [x] T-D-04: `.50` em `src/defense/turret-weapons.js` — projéteis rápidos com queda
      leve (não hitscan), 5-12/s, tracers, heat/superaquecimento, dano baixo;
      pool estendido de `projectiles.js`; áudio .50 em `audio.js`.
      Write set: `src/defense/turret-weapons.js`, `src/projectiles.js`,
      `src/audio.js`, `src/config.js`
- [x] T-D-05: míssil AA homing — lock no caça mais próximo do retículo (quadrado
      fechando + beep), PN simplificada (acel. lateral limitada, velocidade > caça,
      vida finita, erra se o caça manobrar), estoque limitado + recarga lenta;
      lógica pura Node-testável. Write set: `src/defense/turret-weapons.js`,
      `src/projectiles.js`, `src/hud.js`, `src/audio.js`

## Onda D3 — Caças inimigos e baterias aliadas

- [x] T-D-06: `src/defense/enemy-fighters.js` — mesh adaptado de ally-war; estados
      ingress→attack-run→egress→re-ingress; seleção de alvo com pesos 45/30/15/10;
      mergulho, 1-2 mísseis e/ou rajada; jinks; chaff/flare ao ser travado.
      Write set: `src/defense/enemy-fighters.js`, `src/config.js`
- [x] T-D-07: `src/defense/enemy-ordnance.js` — mísseis ar-solo (arco/terminal dive,
      smoke trail, impacto real + explosão + scorch), tracers inimigos com poeira,
      telegraph anti-jogador (som+marcador HUD), mísseis interceptáveis pela .50
      (bônus). Write set: `src/defense/enemy-ordnance.js`, `src/fx.js`,
      `src/hud.js`, `src/audio.js`
- [x] T-D-08: `src/defense/allied-batteries.js` — 3-5 baterias autônomas (tracers +
      mísseis ocasionais, eficácia baixa), destrutíveis com carcaça fumegante.
      Write set: `src/defense/allied-batteries.js`, `src/fx.js`

## Onda D4 — Diretor, queda cinematográfica, cidade sob fogo

- [x] T-D-09: `src/defense/defense-director.js` — spawn infinito com taxa escalando
      por kills (6s base, ×0.93/N, mín 1.5s; esquadrilha 1→4; direções variadas),
      integridade da cidade (~20 impactos), derrota (cidade 0% ou sem vidas),
      overlays; rng seedado; lógica pura Node-testável.
      Write set: `src/defense/defense-director.js`, `src/config.js`
- [x] T-D-10: queda cinematográfica — estado `dying` (spiral/pique/glide por RNG,
      fumaça preta+fogo com pool próprio, debris, megaExplosion+shockwave+scorch no
      impacto real do terreno, 20% ejeção). Write set: `src/defense/enemy-fighters.js`,
      `src/fx.js`, `src/config.js`

## Onda D5 — Verificação, balanceamento, evidências

- [x] T-D-11: `tests/aero-fighters/tools/test-aero-defense.mjs` (director, PN, heat,
      seleção de alvo, integridade) + registro em package.json; suites Node verdes;
      grep de não-regressão dos outros modos (smoke islands + inhauma voo).
      Write set: `tests/aero-fighters/tools/`, `src/web-games/package.json`
- [x] T-D-12: playtest por screenshots (mira/lock, .50 tracers, queda espiral com
      fumaça, impacto na cidade, baterias aliadas, HUD completo) + medição de
      calls/tris/fps em regime; balanceamento final em `AA_DEFENSE`; README.
