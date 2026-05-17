# PLAN: Security Baseline — tauan-games

> **Status:** [ ] In Review
> **SPEC:** `specs/security/SPEC.md` [ ] In Review
> **Created:** 2026-05-11

---

## Context

`tauan-games` é um repositório de jogos web 100% estáticos (HTML/JS puro, sem backend, sem build step, sem runtime de servidor). O risco de segurança é baixo *por design*, mas três vetores reais existem:

1. **Vazamento acidental de secrets** — qualquer agente IA (Claude/Codex/etc.) trabalhando no repo pode acidentalmente colar uma API key num arquivo de configuração ou no histórico
2. **Dependências de tooling vulneráveis** — `@playwright/test` e seus transitivos podem desenvolver CVEs entre instalações
3. **Ausência de gate automático** — o CI atual (`.github/workflows/ci.yml`) só roda Playwright; nada bloqueia merge se um secret for introduzido ou uma dep crítica vulnerar

Estado atual descoberto (verificado em 2026-05-11):

| Item | Estado |
|---|---|
| `.gitignore` | **Não existe** — `node_modules/`, `test-results/`, `tests/.server.pid`, `tests/screenshots/` não estão ignorados explicitamente (só não foram commitados ainda) |
| `.env` / `.env.example` | Nenhum existe — repo não tem secrets de runtime |
| `package.json` (root) | Existe; única devDep é `@playwright/test ^1.44.0` |
| `package-lock.json` | Existe; `npm audit --audit-level=high` = `found 0 vulnerabilities` |
| `.github/workflows/ci.yml` | Existe; roda Playwright em push/PR para `main`. **Sem step de security.** |
| Código de jogo | `aero-fighters/` e `tauan-trex/` — `grep -i "api_key\|secret\|token\|password"` retorna **vazio** |
| Remote | `https://github.com/marcoaureliomenezes/tauan-games.git` — pode usar GitHub Actions e GitHub Pages |
| Tracked files | Apenas 5 arquivos commitados (specs + README); restante é local-only ainda |

**Implicações de design:**
- FR-S03 (HTTPS) é trivial — GitHub Pages serve apenas HTTPS por default; basta documentar e validar URL pública quando publicar.
- FR-S04 (env template policy) é majoritariamente preventivo — não há `.env` real hoje, então a tarefa é instalar o gate antes que alguém crie um.
- FR-S05 (pipeline gate) é o trabalho central: estender `ci.yml` com 2 jobs novos (`secret-scan`, `dep-audit`) e garantir que ambos sejam *required checks* na branch `main`.

---

## Architecture Decisions

| Decisão | Razão |
|---|---|
| Estender o `ci.yml` existente em vez de criar workflow novo | Um único workflow facilita ver o gate completo na PR; jobs paralelos rodam rápido (NFR-S02 ≤ 5 min) |
| **Gitleaks** como secret scanner (não trufflehog) | Ação oficial `gitleaks/gitleaks-action@v2`, suporta allowlist via `.gitleaks.toml`, free para repos públicos, regex extensível |
| `npm audit --audit-level=high` (não `=critical`) | SPEC FR-S05/CA-S02 exige bloqueio em high/critical; `=high` cobre ambos |
| **Sem** scan SAST de código de jogo (ESLint security plugin, Semgrep) | Fora de escopo da SPEC; jogos são client-side puros sem manipulação de input externo sensível |
| `.gitignore` versionado, mas sem `vendor/` | `vendor/phaser.min.js` e `vendor/three.module.min.js` precisam estar commitados (decisão da `testing-infra` PLAN T08, NFR-02) |
| `.env.example` **commitado mas vazio** (placeholder) | Estabelece a convenção FR-S04 antes que alguém precise de secrets reais; documenta no README como referência |
| Allowlist de gitleaks num `.gitleaks.toml` versionado | Necessária para evitar falso positivo em hashes de integridade do `package-lock.json`, fingerprints SHA do `vendor/`, e qualquer string que pareça secret mas não é |
| Gate falha CI mas **não** bloqueia push direto | `tauan-games` é repo pessoal sem PR review obrigatório; o gate roda em `push` e `pull_request` — se vermelho no `main`, operador é notificado e reverte. Branch protection rules ficam fora desta SPEC (decisão GitHub, não de código) |

---

## Implementation Phases

### Phase 1 — Hygiene baseline (T01–T03)

Criar artefatos de configuração que estabelecem a convenção *antes* de habilitar gates automáticos.

- T01: criar `.gitignore` cobrindo `node_modules/`, `test-results/`, `tests/screenshots/`, `tests/.server.pid`, `.env`, `*.local`
- T02: criar `.env.example` placeholder vazio + nota no README explicando a política
- T03: criar `.gitleaks.toml` com allowlist mínima (lockfiles, vendor)

Verificação Phase 1: `git status` mostra os arquivos prontos para commit; `cat .gitignore` lista as entradas; `gitleaks detect --config=.gitleaks.toml --no-git` em local exit 0.

---

### Phase 2 — Secret scanning gate (T04–T05)

Adicionar job `secret-scan` ao `ci.yml` usando `gitleaks/gitleaks-action@v2`.

- T04: adicionar job ao workflow (paralelo a `playwright-tests`)
- T05: validar com PR teste contendo um fake secret — gate deve bloquear

Verificação Phase 2: `gh pr checks <pr>` mostra `secret-scan: failure` quando PR contém token; `success` quando limpo.

---

### Phase 3 — Dependency audit gate (T06–T07)

Adicionar job `dep-audit` ao `ci.yml` rodando `npm audit --audit-level=high`.

- T06: adicionar job ao workflow
- T07: validar localmente (`npm audit --audit-level=high; echo $?`) e no CI

Verificação Phase 3: `gh run view --job dep-audit` mostra step `npm audit` exit 0 hoje (baseline limpa). Se uma dep desenvolver CVE high, o job falha automaticamente.

---

### Phase 4 — HTTPS verification & docs (T08–T09)

FR-S03 é satisfeita por GitHub Pages, mas precisa ser documentada e checada uma vez.

- T08: documentar política HTTPS e env template no `AGENTS.md`/`README.md`
- T09: verificar a URL pública (quando deploy acontecer) — `curl -sI https://<user>.github.io/tauan-games/` retorna `200`; `curl -sI http://<user>.github.io/tauan-games/` redireciona para `https://`

Verificação Phase 4: docs commitadas; comando curl produz output esperado.

---

## Risk & Mitigation

| Risco | Mitigação |
|---|---|
| Gitleaks falso positivo em `package-lock.json` integrity hashes (`sha512-...`) | Allowlist `package-lock.json` no `.gitleaks.toml` |
| Gitleaks falso positivo em `vendor/three.module.min.js` (binary-ish, hashes) | Allowlist `vendor/**` no `.gitleaks.toml` |
| `npm audit` falha por vuln em dep transitiva sem fix disponível | Task documentada para uso de `npm audit --omit=dev` ou exceção temporária via issue rastreável (NFR-S03) |
| Operador push direto a `main` ignora gate | Aceito conscientemente — `tauan-games` é repo pessoal; gate vermelho serve como sinal, não como bloqueio. Branch protection é decisão fora desta SPEC. |
| Phase 4 depende de deploy ainda não existir | Phase 4 pode ser parcial: docs em PR agora, verificação curl quando primeiro deploy for feito (anotado em T09) |

---

## Verification

```bash
cd /home/ubuntu/workspace/repos/tauan-games

# Phase 1 hygiene
test -f .gitignore && grep -q "^\.env$" .gitignore
test -f .env.example
test -f .gitleaks.toml

# Phase 2 secret scan (local)
gitleaks detect --config=.gitleaks.toml --no-git --verbose; echo "exit=$?"

# Phase 3 dep audit (local)
npm audit --audit-level=high; echo "exit=$?"

# Phase 4 HTTPS (após primeiro deploy)
curl -sI https://marcoaureliomenezes.github.io/tauan-games/ | head -1
```

CI integration validation:

```bash
# After merging PR with new jobs:
gh workflow view ci.yml
gh run list --workflow=ci.yml --limit=3
gh run view <latest-run-id> --json jobs -q '.jobs[].name'
# Expect: ["Playwright Tests", "Secret Scan", "Dependency Audit"]
```

---

## Approval

- [ ] Draft reviewed by operator
- [ ] **Status:** [ ] Approved — _date_
