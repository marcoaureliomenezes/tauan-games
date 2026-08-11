# TASKS — v0.3.9

> **Status:** Aprovado
> **Aprovação:** 2026-07-19 — operador (diretiva de playtest).
> **Owner:** sessão coordenadora kimi.
> Markers: `[ ]` OPEN · `[-]` IN PROGRESS · `[x]` DONE

## Onda única — armas da bateria + boss

- [x] T-W-01: lock persistente — 3 s OU 3 disparos no alvo (o que vier primeiro);
      lock deixa de ser gasto no 1º tiro. Write set: `src/defense/turret-weapons.js`,
      `src/defense/defense-mode.js`, `src/config.js`
- [x] T-W-02: dois tiers de míssil AA — `X` fraco (3 hits, 2/s, ∞) e `B` forte
      (1 hit, 1/2s, ∞); dano/taxa em AA_DEFENSE; HUD mostra arma ativa + cooldown.
      Write set: `src/defense/turret-weapons.js`, `src/projectiles.js`,
      `src/defense/defense-mode.js`, `src/hud.js`, `src/config.js`, `src/input.js`
- [x] T-W-03: retargeting — míssil cujo alvo morre passa a perseguir o inimigo
      vivo mais próximo (campo de visão). Write set: `src/projectiles.js`,
      `src/defense/turret-weapons.js`
- [x] T-W-04: rod cinético (`R`) — 1/5s, velocidade 3×, perfura e encadeia até 3
      kills (retarget ao mais próximo). Write set: `src/projectiles.js`,
      `src/defense/turret-weapons.js`, `src/defense/defense-mode.js`,
      `src/config.js`, `src/hud.js`
- [x] T-W-05: boss — formação de tropas monta no horizonte (reuso src/formations/),
      aviso + janela de tempo no HUD, chegada = dano pesado na cidade; 3 nukes
      táticas (`T`) com megaExplosion em raio. Write set:
      `src/defense/defense-director.js`, `src/defense/defense-mode.js`,
      `src/projectiles.js`, `src/hud.js`, `src/config.js`, `src/audio.js`
- [x] T-W-06: seleção de arma completa (scroll cicla mg→X→B→T→R + teclas diretas
      X/B/T/R), testes Node novos/adaptados verdes, evidência visual (lock
      persistente, 2 tiers, rod perfurando 3, boss + nuke), zero regressão.
      Write set: `src/input.js`, `src/hud.js`,
      `tests/aero-fighters/tools/test-aero-defense-weapons.mjs`,
      novo `tests/aero-fighters/tools/test-aero-defense-weapons-v1.mjs`,
      `src/web-games/package.json`
- [x] T-W-07: escudo de proteção −70% (feito pelo coordenador: fx.js) + rastro dos
      mísseis — fumaça discreta de propulsão que desaparece em ~1 s deixando a
      trajetória curva visível; chama de propulsão à noite.
      Write set: `src/fx.js`, `src/projectiles.js`, `src/defense/enemy-ordnance.js`
- [x] T-W-08: ADENDO playtest-2 — mira por fases (amarelo 1,5s 50% → vermelho 1,5s
      80% → amarelo 1,5s 50%), some após 5 mísseis no alvo; disparo seguido (5
      pressões = 5 mísseis, enfileiradas na cadência); nuke T sai do cano com
      trajetória visível até o alvo travado (nunca queda instantânea).
      Write set: `src/defense/turret-weapons.js`, `src/defense/defense-mode.js`,
      `src/projectiles.js`, `src/hud.js`, `src/config.js`
