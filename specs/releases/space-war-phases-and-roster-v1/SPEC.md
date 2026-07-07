# SPEC — Release: space-war-phases-and-roster-v1

> **Status:** Aprovado — 2026-07-07 (operador: "/goal act to implement all
> improvements pointed on the audit")
> **Origem:** `specs/audits/2026-07-07-space-war-full-audit.md` (4-lane full audit:
> travel/starfield, weapons/gravity, celestial roster, architecture/phases).
> **Base:** origin/main (pós PR#19). **Segment:** rc-1

## 1. Objetivo

Implementar TODAS as melhorias do audit, em 5 ondas:

**P0 — bugs reportados (cirúrgico):**
1. Starfield: remover o floor 0.85 de journey (`starfield.js:270`); efeitos
   relativísticos (β visual, streaks, tint do postfx) gateados por POSIÇÃO
   (fronteira do sistema), não por tempo. Sequência real: partindo → cruzeiro
   → chegando. Unificar os 4 thresholds divergentes de "dentro do sistema".
2. Higgs [H]: perfil de força real (Plummer-softened, 1/r² além de `soft`,
   taper a 0 em `wellReach` finito). O cap 600 vira só segurança near-core.
   Sem platô de força constante de 29k u; sem perturbação cross-system.
3. Nuke [F]: captura orbital só engaja quando |v_rel| < 1.5·v_esc local;
   flybys hiperbólicos permanecem balísticos.

**P1 — fundações (pré-requisitos do refactor):**
4. `config.js`: colapsar as 3 passadas de mutação in-place em literais finais;
   de-aliasar arrays de centro compartilhados.
5. `SystemRuntime` com `dispose()` atômico: bodies/dynBodies/bodyFx/decorations/
   starLod de um sistema pertencem a um runtime descartável. Sweep de código
   morto (spawnEnemies stub, mission 'clear', anchor N-body, game.started etc.).
   Renomear a colisão `game.phase` (UI) → `game.screen`.
6. Registry `SYSTEMS` como fonte única: dados por sistema de campanha/spawn/
   tint/luminosidade migram para o registry.

**P2 — sistemas como FASES:**
7. Só o sistema ativo é construído, REBASEADO NA ORIGEM (mata o jitter float32
   de 27M u). Fase de viagem = starfield + skybox + glows + postfx relativístico,
   sem bodies. Chegada constrói o destino na origem. Dispose na saída (inimigos/
   alvos da fase anterior morrem com ela). Nav/map/journey/glows referenciam
   descritores estáticos de `SYSTEMS` (camada galáctica), não bodies vivos.

**P3 — novo roster (5 sistemas):**
8. (1) Solar — mantém. (2) Betelgeuse + Siwarha — upgrade para BinaryPair
   baricêntrico. (3) **Buraco negro + gigante vermelha sendo devorada** —
   NOVO: gigante com deformação tidal teardrop (uTideDir/uTideAmp no
   STAR_VERT), lóbulo de Roche/Eggleton + L1 em physics.js (puro, unit-testado),
   stream de plasma CURVO (arco balístico do lado L1 até o plano do disco, com
   hot spot) substituindo o cilindro reto. (4) Estrela de nêutrons orbitando
   estrela (pulsar existente + BinaryPair + remnant). (5) Sagittarius A* —
   mantém (S5 atual). Deletados: `chaotic` e o pareamento antigo BH+NS.
   Remapear campaign/missions/enemies/map/starlod/gravity keys; re-checar
   hunt-site fallback (3 sistemas com poucas superfícies); atualizar pitch do
   menu e header do config.

**P4 — polish:**
9. Inimigos sentem poços Higgs (bias); laser inimigo herda worldVel do frame;
   blending de aceleração na fronteira de SOI (sem kinks em trails); margem de
   detonação ≥ raio do mesh; pinch do skybox gateado pela fronteira; solver
   dt=0.05.

## 2. Acceptance Criteria

- **AC-01:** journey engajada dentro do sistema NÃO mostra starfield/streaks/
  tint (fade=systemFade puro); efeitos sobem só após cruzar a fronteira e
  descem antes de entrar no destino. e2e cobre "dentro → sem streaks".
- **AC-02:** poço Higgs: |a(d)| é monotônico decrescente para d>soft, ∝1/d²
  na faixa média, e =0 para d≥wellReach. Unit node com perfil amostrado.
- **AC-03:** nuke em flyby rápido (|v_rel|>1.5 v_esc) mantém trajetória
  balística (sem lerp de captura). Unit/sim.
- **AC-04:** `config.js` sem passadas de mutação; valores finais idênticos aos
  efetivos de hoje (snapshot antes/depois no teste unit).
- **AC-05:** trocar de sistema constrói APENAS o sistema ativo na origem;
  `game.bodies` contém só bodies do sistema ativo (+ ship); dispose libera
  geometrias/materiais (renderer.info sem crescimento monotônico entre fases).
- **AC-06:** roster novo: 5 sistemas conforme §1.8; sistema 3 mostra gigante
  teardrop apontando ao BH + stream curvo terminando no plano do disco.
  Roche/Eggleton + L1 unit-testados contra valores publicados.
- **AC-07:** campanha completa jogável nos 5 novos sistemas (hunt/visit
  remapeados); mapa e nav funcionam por descritores.
- **AC-08:** suíte completa verde: `npm run test:space-war:unit` +
  `npm run test:space-war` (+ demais suítes do repo intocadas).

## 3. Não-objetivos

- Física relativística exata no skybox (só gating/pinch melhorado).
- Persistência de estado inimigo entre fases (fases retiram inimigos antigos).
- Mudanças em aero-fighters/trex.
