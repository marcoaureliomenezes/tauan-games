# PLAN — Release: v0.6.0

> **Status:** Aprovado
> **Release ID:** v0.6.0
> **Spec:** `SPEC.md`

---

1. Deleção dos 3 web games + varredura de referências (hub, package.json, tests,
   memory, constitution, backlog).
2. Dois audits paralelos (subagentes explore): web aero-fighters e Godot v2 +
   identificação do diretório não-rastreado `src/godot/aero-fighters/`.
3. Decisão documentada: web sobrevive (mais avançado, mais testado, canônico);
   v2 é o stale; port não-commitado é substancial mas incompleto e sem histórico.
4. Transferência da pipeline geo (R-03) → delete v2 (R-04) → backup+delete port
   (R-05).
5. Sync de memória/specs + regeneração de catálogo + doctor 0/0.

## Evidência-chave da decisão (dos audits)

| Critério | web aero-fighters | godot v2 | godot port (untracked) |
|---|---|---|---|
| Linhas de código | ~21k (60 módulos) | 2.233 | ~600 K scripts (3 dias) |
| Testes | 76 E2E + 17 sims Node | lint-only CI | nenhum commitado |
| Features | 4 mapas+DEM, nuke, firestorm, defense, campanha, kaiju, áudio synth | 1 mapa plano, canhão only, sem áudio | campanha, defense, nuke, 15 WAVs, DEM; sem kaiju/mapas legado |
| Investimento recente | 5 releases (v0.3.4–v0.3.10) | pausado 2026-06-12 | burst 07-19..22, idle 3 sem |
| Estado git | tracked | tracked | **untracked** |

`v0.3.10/PORT-GODOT.md` trata o código web como fonte canônica de fórmulas e
constantes — o port derivava dele e estava atrás.
