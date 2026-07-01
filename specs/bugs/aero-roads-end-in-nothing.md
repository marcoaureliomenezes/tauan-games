---
name: aero-roads-end-in-nothing
status: Fixed
severity: MEDIUM
reported: 2026-07-01
surface: aero-fighters / inhauma roads (inhauma-road-defs.js, inhauma-scene.js, inhauma-road-props.js)
session_id: null
release: aero-fighters-world-realism-v1
---

**Symptom:** Estradas terminavam como um TOCO de fita em terreno plano — "acabavam no
nada". A primeira passada de túneis (WS-2) só cobriu 2 pontas; as demais paravam secas.
A ponta sul da MG-060 terminava DENTRO da água (represa), em altura 0.

**Repro:** `?map=inhauma`, seguir qualquer estrada não-anelar até a ponta: MG-238
(início SO), AMG-0360 (norte), MG-060 (as duas pontas) simplesmente paravam.

**Expected (operador):** Nenhuma estrada pode terminar no nada. Estradas são contínuas
e seguem o mapa; no pior caso, ENTRAM NUM TÚNEL numa encosta. O terreno de inhauma é
"infinito" (chunks reciclados seguem o jogador) → não há borda de mapa, então toda
ponta aberta precisa virar túnel numa encosta.

**Fix:** TODA ponta aberta agora entra num túnel. Onde a ponta cai em relevo REAL
(morros-oeste, serra-leste, morro-norte) o portal encosta na encosta existente. Onde
cai em rural plano, uma COLINA DE PORTAL sintética é gerada (`getPortalMounds`) na
direção de saída da estrada e somada ao campo de altura (visual + colisão), para o
túnel furar uma encosta de verdade. Mudanças:
- `inhauma-road-defs.js`: caps em todas as pontas; MG-238 estende o início para o
  flanco dos morros-oeste (túnel em relevo real); MG-060 teve a cauda molhada RECUADA
  de (-780,410) h=0 para (-795,20) em terra seca; `getPortalMounds()` gera 3 colinas.
- `inhauma-scene.js`: soma `portalMoundContribution` ao relevo.
- `inhauma-road-props.js`: garganta do portal recua SEMPRE para dentro da encosta
  (corrige o sentido invertido das pontas finais) e ficou mais funda.

**Verificação:** cada colina/portal validado contra o campo de altura real (seco,
> água+3, longe do aeroporto — `cf<0.02`, longe de alvos > 150 m). `validate:aero-map`
inhauma OK (grafo de estradas 4 arestas), fidelidade e2e verde.
