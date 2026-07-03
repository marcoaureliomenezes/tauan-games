# PLAN — Release: space-war-campaign-v1

**Status:** Aprovado
**SPEC:** `specs/releases/space-war-campaign-v1/SPEC.md` [Aprovado]
**Created:** 2026-07-03

---

## 1. Arquitetura

```
space-war/src/
  campaign.js     ← NOVO: PHASES[] (dados), estado {phase, unlocked[], done[]},
                    tipos de missão bomb|clear|visit, avanço/desbloqueio, overlays
  missions.js     ← vira EXECUTOR da fase ativa (spawn de bases/alvos, completion),
                    consome PHASES de campaign.js; ganha tipo 'visit'
  enemies.js      ← frames body-relativos (offset local ancorado no worldPos do
                    corpo), papéis fighter|interceptor|station|bomber, spawn por
                    fase, oclusão (segmento-esfera vs corpo-âncora), bombas
  weapons.js      ← nuke: reserva+regen; enemyBomb(): balística sob computeGravity
                    (SEM guiagem orbital — só campo), dano em área no jogador
  state.js        ← game.campaign { phase, unlocked[], done[] }, ship.nukeRegen
  hud.js          ← fase no rótulo de missão, recarga de nuke, aviso 🔒
  map.js          ← estado ✔/▶/🔒 por sistema no mapa
  celestial/stars.js ← fx do flare: atenuação por distância + sunFlareVisible
  main.js         ← wiring: initCampaign() substitui startMissions()/spawnEnemies()
```

`gravity.js`/`orbits.js`/`config.js`: intocados. `universe.js`: intocado.

## 2. Dados da campanha (campaign.js)

```
PHASES = [
 { key:'solar',      sys:'solar',      name:'SISTEMA SOLAR',
   missions:[ lua(bomb), marte-caças(clear 5), marte-bases(bomb 2), io(bomb),
              halley(visit 2.2k) ] },
 { key:'betelgeuse', sys:'betelgeuse', name:'BETELGEUSE',
   missions:[ brasa-caças(clear 6), fuligem-bases(bomb 2), siwarha(visit 12k) ] },
 { key:'binary',     sys:'binary',     name:'BINÁRIO BN+PULSAR',
   missions:[ estações-remanescente(clear 2 stations+4), pulsar(visit 30k) ] },
 { key:'chaotic',    sys:'chaotic',    name:'BINÁRIO CAÓTICO',
   missions:[ vagante-II+IV bases(bomb 2), caças(clear 6) ] },
 { key:'core',       sys:'core',       name:'NÚCLEO DA GALÁXIA',
   missions:[ sgr-fotons(visit 22k), s-star fortaleza(clear station+6),
              errantes-bases(bomb 3) ] },
]
```
Missões `visit`: completar = distância nave↔corpo < limiar uma vez (toast de coleta).
Fase completa → toast + unlock da próxima + spawn dos inimigos dela. Última → WIN.

## 3. Inimigos (enemies.js)

- Registro: { role, anchor, localA/localR/localY (frame do corpo), hp, cd, phaseKey }.
- Posição por-frame: anchor.worldPos + offset girado (patrol) — co-move de graça;
  interceptor: persegue com velocidade finita SOMADA à worldVel do âncora;
  bomber: patrol largo, lança bomba quando alinhado; station: fixa em offset alto.
- Oclusão: segmento nave↔inimigo vs esfera do CORPO-ÂNCORA (analítico) — bloqueado
  não atira. Zona segura (landed/spawnGrace) mantida.
- Spawns por fase (spawnPhase(key)): solar = atual (Marte/Júpiter/Saturno) +
  bombers em Júpiter; demais fases conforme PHASES (alvos clear = os spawns da fase).

## 4. Armas (weapons.js)

- `launchNuke`: decrementa; `updateNukeRegen(dt)`: se nukes<4, regen 20 s → +1.
- `enemyBomb(pos, vel)`: projétil {isBomb} — gravidade pura (computeGravity),
  vida 30 s, detona a <140 do jogador (dano 22) ou contato de superfície; dano em
  área <400 (metade). Sem guiagem (D-4/D-5).
- Laser inalterado.

## 5. Flare (celestial/stars.js — bug fix)

No fx da estrela com `light.flare`: d = |camera − star|; fator = clamp(1 −
(d − R_near)/(R_fade), 0, 1) com R_near = 400k, corte total além de ~2.6M (1.1× raio
solar). Implementação: `flare.visible = d < 2.6M` + escala dos elementos ∝ fator.
Diagnóstico: `game.sunFlareVisible = flare.visible` a cada frame.

## 6. Testes (tests/space-war/campaign.spec.js)

- gating: fase 0 ativa, unlocked=[T,F,F,F,F]; missão de fase futura inexistente.
- unlock: __swDebug.campaignComplete Phase() (helper de teste) → unlocked[1] true.
- bomba inimiga: spawna via helper, amostra vel em t0/t1 perto da Terra → muda
  direção/magnitude (gravidade age) (AC-04).
- base cap: para cada alvo de missão bomb ativo: (4·scale)² / (4·R²) ≤ 0.03 (AC-08).
- flare: perto do Sol sunFlareVisible=true; teleporta p/ binário → false (AC-10).
- nuke regen: dispara 1, nukes==3, avança regen (helper acelera timer) → 4 (AC-05).
- Smoke 12/12 existente inalterado e verde.

## 7. Ondas

- **W1** T-CP-01 flare fix + regressão (bug primeiro — lei bug-always-solved)
- **W2** T-CP-02 campaign.js + missions.js (visit, fases) + state
- **W3** T-CP-03 enemies.js overhaul · T-CP-04 weapons (regen + bombas)
- **W4** T-CP-05 map/HUD campanha
- **W5** T-CP-06 campaign.spec.js + smoke verdes; QA; disposição do bug
  (`dadaia bugs append resolved`); security push-verdict; push; PR; CI verde.

Rollback: campaign.js é aditivo; missions.js mantém a fase solar como default —
reverter W2+ restaura o comportamento de 4 missões.
