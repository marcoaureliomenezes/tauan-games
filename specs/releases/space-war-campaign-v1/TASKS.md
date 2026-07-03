# TASKS — Release: space-war-campaign-v1

> **Status:** Aprovado — 2026-07-03 (goal do operador: implementar todo o backlog do space-war)
> **SPEC:** `specs/releases/space-war-campaign-v1/SPEC.md` [Aprovado]
> **PLAN:** `specs/releases/space-war-campaign-v1/PLAN.md` [Aprovado]
> **Created:** 2026-07-03

---

## Pre-implementation Checklist

- [x] SPEC.md aprovado
- [x] PLAN.md aprovado
- [x] TASKS.md aprovado
- [x] Release ativada em `specs/releases/ACTIVE.md`
- [x] Backlog promovido (`release:` no frontmatter) + intents[] adicionados
- [x] Nenhuma task `[-]` duplicada

---

## Write set

`space-war/src/campaign.js` (novo), `space-war/src/{missions,enemies,weapons,state,hud,map,main}.js`,
`space-war/src/celestial/stars.js` (fx do flare), `tests/space-war/**`, esta release,
frontmatter do backlog entry. **PROIBIDO:** `gravity.js`, `orbits.js`, `config.js`,
`universe.js`, `orbits/atoms/body/motion/planets/system` do celestial.

---

## Tasks

### Wave 1 — Bug primeiro
- [x] T-CP-01 Flare solar local (atenuação+corte por distância no fx da estrela com
      flare; `game.sunFlareVisible`) + regressão near/far em campaign.spec.js.
      **AC-10; bug space-war-solar-flare-universe-overlay.**

### Wave 2 — Campanha
- [x] T-CP-02 `campaign.js` (PHASES dados, estado, unlock, overlays, WIN final) +
      `missions.js` executor por fase + tipo `visit` + `state.js` campaign/nukeRegen +
      `main.js` wiring. **AC-01, AC-02, AC-03.**

### Wave 3 — Inimigos e armas
- [x] T-CP-03 `enemies.js`: frames body-relativos, papéis (fighter/interceptor/
      station/bomber), spawn por fase, oclusão do âncora, zona segura. **AC-06.**
- [x] T-CP-04 `weapons.js`: recarga de nukes (4 + 1/20 s) e `enemyBomb` balística
      sob gravidade com dano em área. **AC-04, AC-05, AC-07.**

### Wave 4 — Superfícies de campanha
- [x] T-CP-05 `map.js` estado ✔/▶/🔒 por sistema; `hud.js` fase + recarga de nuke.
      **AC-09.**

### Wave 5 — Verificação e ship
- [-] T-CP-06 `tests/space-war/campaign.spec.js` (gating, unlock, bomba-gravidade,
      base ≤3%, flare, regen) verde + smoke 12/12 verde; QA review; disposição do
      bug (`resolved --release space-war-campaign-v1`); security push-verdict;
      push + PR + CI verde. **AC-08, AC-11.**

---

## Evidence

- Saída dos testes (campaign + smoke) na review de QA.
- `git diff --stat` vazio nos protegidos.
- Handoffs de QA e security com `metrics.commit_sha` do push.
