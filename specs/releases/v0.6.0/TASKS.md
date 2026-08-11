# TASKS — Release: v0.6.0

> **Status:** Aprovado
> **Release ID:** v0.6.0
> **Spec:** `SPEC.md` · **Plan:** `PLAN.md`

---

## T-01 — Deletar memoria-bichos, tauan-trex, demolition-ball-fable-5 [x]

- **Owner:** software-engineer
- **Evidência:** dirs de código + `tests/memoria-bichos` + `tests/trex` removidos;
  cards do hub, `test:trex` no package.json, atoms de memória, linhas de
  tech-stack/architecture/quality-assurance/constitution limpos; backlog
  `memoria-bichos-v1` → rejected; release v0.2.10 → `releases/legacy/`;
  candidatos `tauan-trex-mobile-controls` e `aero-fighters-ue5-migration` removidos.

## T-02 — Audit aero-fighters web [x]

- **Owner:** project-auditor (subagente)
- **Entrega:** inventário completo (21k ln, 76 E2E + 17 sims, Inhauma DEM, nuke/
  firestorm, defense, campanha, kaiju, áudio synth); drift de memória registrado.

## T-03 — Audit aero-fighters-v2 + identificar src/godot/aero-fighters [x]

- **Owner:** project-auditor (subagente)
- **Entrega:** v2 = esqueleto parado (2.233 ln, canhão-only, terreno plano, sem
  áudio, docs stale). `src/godot/aero-fighters/` = port Godot 4.7 do web game,
  burst 07-19..22, SEM histórico git, incompleto (sem kaiju/mapas legado).

## T-04 — Transferir pipeline geo do v2 [x]

- **Owner:** software-engineer
- **Evidência:** `Content/World/*` → `src/web-games/aero-fighters/assets/geo/`;
  `inhauma-data-fetch.py` + `requirements.txt` → `tools/`; paths atualizados em
  `extract-osm-roads.{sh,mjs}`, `inhauma-osm-roads.js`, `metadata.js`,
  `inhauma-data-fetch.py`.

## T-05 — Deletar v2 e o port (com backup) [x]

- **Owner:** software-engineer
- **Evidência:** v2 + `aero-v2-godot-ci.yml` + `aero-v2-runner-healthcheck.yml` +
  `.gitattributes` (LFS do v2) removidos (git-tracked → recuperável). Port
  não-commitado: backup `../../.dadaia/tmp/aero-port-backup/src-godot-aero-
  fighters-port-20260810.tar.gz` (12 MB, sem `.godot/`) ANTES do `rm -rf`.
  `godot-ci.yml` agora cobre todos os projetos sem exclusão.
- **REVERSÃO (operador, 2026-08-10):** o port foi restaurado do tarball e
  commitado (441 arquivos) — vive rastreado em `src/godot/aero-fighters/`.
  Ver git history (74b2108). DELEÇÃO FINAL (operador, mesmo dia): port reprovado em playtest ("pure trash") e deletado de novo; recuperável via git history.

## T-06 — Sync de memória e specs [x]

- **Owner:** product-engineer
- **Evidência:** atom `product/godot/aero-fighters-v2/` removido; games-catalog
  (6 jogos catalogados), tech-stack, architecture, quality-assurance,
  constitution, overview, README, ideas, candidates, backlog-future; nota de
  unificação no atom aero-strike; catalog regenerado (13 features).
- **PENDENTE (bloqueado pelo gate):** `repos/tauan-games/AGENTS.md` é law-file
  operador-only — a tabela "Games" ainda lista Tauan T-Rex e o port Godot
  deletado. Operador deve remover as duas linhas da tabela à mão (a linha
  `| Tauan T-Rex | ... |` e a linha `| Aero Fighters (Godot) | ... |`).

## T-07 — Verificação final [x]

- **Owner:** qa-reviewer
- **Evidência:** `dadaia specs doctor --context tauan-games` → 0 errors, 0 warnings.
