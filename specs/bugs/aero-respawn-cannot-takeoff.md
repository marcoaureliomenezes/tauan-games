---
name: aero-respawn-cannot-takeoff
status: Fixed
severity: HIGH
reported: 2026-07-01
surface: aero-fighters / sortie state machine (player.js, main.js, sortie-state.js)
session_id: null
release: aero-fighters-world-realism-v1
---

**Symptom:** Ao ser destruído (HP a zero → mayday → queda) e voltar ao aeroporto, o
avião ficava PARADO e não decolava mais. A surtida ficava travada.

**Repro:** Jogar `?map=inhauma`, tomar dano até o mayday, deixar cair/explodir (ou
ejetar com J). O avião reaparece no aeroporto mas não taxia nem decola.

**Root cause:** `_ejectAndRespawn()` (queda no solo) chamava `respawnJet()` para
recolocar o avião na zona de serviço, mas NÃO resetava a máquina de surtida — ela
permanecia em `MAYDAY`. O caminho de ejeção manual (main.js) deixava o avião em
`NEXT_SORTIE_READY` no ar. Em nenhum dos dois casos o `auto-taxi` era rearmado, então
a sequência automática táxi→decolagem nunca rodava. `MAYDAY` não é um `GROUND_STATE`,
então `updatePlayer` tratava o avião (parado no solo do aeroporto) como se estivesse
em voo — sem nunca reentrar no fluxo de decolagem.

**Expected:** Ao voltar à base depois de um abate (com vidas restantes), o avião
recoloca no aeroporto e RETOMA a decolagem — pode voar de novo.

**Fix:** Novo `relaunchSortie(machine)` (sortie-state.js) reseta a máquina para
`TAXI_OUT` a partir de QUALQUER estado (recuperação incondicional). Novo
`respawnAndRelaunch()` (player.js) faz respawn na zona de serviço → `relaunchSortie`
→ rearma `auto-taxi` na fase `taxi_runway` (taxia até a pista e decola sozinho) →
rearma munição/HP. Usado pelos DOIS caminhos (queda no solo e ejeção manual).

**Tests:** `test-aero-sortie-sim.js` — 2 regressões novas: relaunch recupera de
`MAYDAY` e da cadeia `EJECTION → NEXT_SORTIE_READY` para um estado de solo do qual a
decolagem automática realcança `AIRBORNE`. E2E `ejection`/`auto-sortie`/`sortie`/
`landing` verdes.
