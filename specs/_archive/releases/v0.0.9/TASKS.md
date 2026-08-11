# TASKS: Security Baseline — tauan-games

> **Status:** [ ] In Review
> **PLAN:** `specs/security/PLAN.md`
> **SPEC:** `specs/security/SPEC.md`

---

## Pre-implementation Checklist

- [ ] SPEC.md [x] Approved
- [ ] PLAN.md [x] Approved
- [x] CI workflow já existe em `.github/workflows/ci.yml`
- [x] `package-lock.json` existe (sem ele, `npm audit` é ineficaz)
- [x] Repo possui remote GitHub (`origin → marcoaureliomenezes/tauan-games`)
- [x] Baseline `npm audit --audit-level=high` = `found 0 vulnerabilities`

Ferramentas necessárias localmente (para verificar tasks antes de push):
- `gitleaks` (`brew install gitleaks` | `go install github.com/gitleaks/gitleaks/v8@latest` | usar binary release)
- `npm` v9+, `node` v20+
- `gh` CLI autenticado (para validar runs no CI)

---

## Phase 1 — Hygiene Baseline

### T01 — Criar `.gitignore` raiz

Criar `/repos/tauan-games/.gitignore` com as seguintes entradas (uma por linha):

```
# Dependencies
node_modules/

# Test artifacts
test-results/
tests/screenshots/
tests/.server.pid
playwright-report/

# Local environment (FR-S04 — nunca commitar .env real)
.env
.env.local
.env.*.local
*.local

# OS / editor
.DS_Store
Thumbs.db
.vscode/
.idea/

# Logs
*.log
npm-debug.log*
```

**Não incluir** `vendor/` — vendor é versionado por decisão da `testing-infra` PLAN T08 (offline tests).

**Verify:**
```bash
cd /home/ubuntu/workspace/repos/tauan-games
test -f .gitignore && echo "exists ok"
grep -E "^(node_modules/|\.env|test-results/)$" .gitignore | wc -l    # esperado: 3
git status --short                                                     # node_modules/ NÃO deve aparecer
git check-ignore -v node_modules test-results .env tests/.server.pid   # cada linha deve casar regra do .gitignore
```

---

### T02 — Criar `.env.example` placeholder

Criar `/repos/tauan-games/.env.example` com header documentando a política FR-S04:

```
# tauan-games — Environment template
#
# This repository contains 100% static games and DOES NOT require runtime secrets.
# This file exists to enforce policy FR-S04: NEVER commit a real `.env`.
#
# If a future game needs a config value (analytics ID, public read-only API URL, etc.):
#   1. Add the variable here with a placeholder value.
#   2. Document it in the game's README.
#   3. Each developer creates a local `.env` (gitignored) with their real value.
#   4. NEVER paste secrets into committed files.
```

**Verify:**
```bash
test -f .env.example && echo "exists ok"
test ! -f .env && echo "no real .env present"
grep -q "FR-S04" .env.example && echo "policy referenced ok"
```

---

### T03 — Criar `.gitleaks.toml` com allowlist mínima

Criar `/repos/tauan-games/.gitleaks.toml`:

```toml
title = "tauan-games gitleaks config"

[extend]
useDefault = true

[allowlist]
description = "Files with high-entropy strings that are NOT secrets"
paths = [
  '''package-lock\.json''',         # npm integrity hashes (sha512-...)
  '''vendor/.*''',                   # phaser.min.js, three.module.min.js — minified bundles
  '''node_modules/.*''',             # never scanned anyway, defensive
  '''test-results/.*''',
  '''tests/screenshots/.*''',
]
```

**Verify:**
```bash
test -f .gitleaks.toml && echo "exists ok"
gitleaks detect --config=.gitleaks.toml --no-git --verbose --redact; echo "exit=$?"
# esperado: exit=0 (nenhum secret real existe no working tree hoje)
```

---

## Phase 2 — Secret Scanning Gate

### T04 — Adicionar job `secret-scan` ao `ci.yml`

Editar `.github/workflows/ci.yml` adicionando, **paralelo a `playwright-tests`**, o job:

```yaml
  secret-scan:
    name: Secret Scan
    runs-on: ubuntu-latest
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4
        with:
          fetch-depth: 0    # gitleaks precisa do histórico completo para escanear commits

      - name: Run gitleaks
        uses: gitleaks/gitleaks-action@v2
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          GITLEAKS_CONFIG: .gitleaks.toml
```

**Não modificar** o job `playwright-tests` existente — apenas adicionar `secret-scan` sob `jobs:`.

**Verify:**
```bash
yq '.jobs | keys' .github/workflows/ci.yml
# esperado: ["playwright-tests", "secret-scan"]
grep -q "gitleaks-action@v2" .github/workflows/ci.yml && echo "action wired ok"
```

---

### T05 — Validar gate com fake secret (test PR)

Criar branch local `chore/test-secret-gate`, adicionar arquivo throwaway com fake AWS key (formato real para garantir match):

```bash
git checkout -b chore/test-secret-gate
echo "AWS_KEY=AKIAIOSFODNN7EXAMPLE" > /tmp/fake-secret.txt
cp /tmp/fake-secret.txt ./fake-secret.txt
git add fake-secret.txt
git commit -m "test: trigger secret scanner (will be reverted)"
git push -u origin chore/test-secret-gate
gh pr create --title "test: secret gate validation" --body "Validates T05 — must FAIL secret-scan job. Will close without merge."
```

Aguardar CI:

```bash
gh pr checks <pr-number>
# esperado: secret-scan = ❌ failure ; playwright-tests = ✅ success
```

Após validar:

```bash
gh pr close <pr-number> --delete-branch
git checkout main
```

**Verify:** screenshot/log do `secret-scan` mostrando exit code não-zero e o leak detectado. PR fechada sem merge.

---

## Phase 3 — Dependency Audit Gate

### T06 — Adicionar job `dep-audit` ao `ci.yml`

Editar `.github/workflows/ci.yml` adicionando o job:

```yaml
  dep-audit:
    name: Dependency Audit
    runs-on: ubuntu-latest
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm

      - name: Install dependencies (no scripts)
        run: npm ci --ignore-scripts

      - name: Run npm audit (high+critical fail build)
        run: npm audit --audit-level=high
```

`--ignore-scripts` reduz risco de execução de código de pacote durante install no CI.

**Verify:**
```bash
yq '.jobs | keys' .github/workflows/ci.yml
# esperado: ["playwright-tests", "secret-scan", "dep-audit"]

# Local baseline
cd /home/ubuntu/workspace/repos/tauan-games
npm audit --audit-level=high; echo "local exit=$?"
# esperado: exit=0
```

---

### T07 — Validar `dep-audit` no CI com PR real

Após T06 mergeada, qualquer PR seguinte (incluindo a própria PR que adiciona o job) deve mostrar o job rodando:

```bash
gh run list --workflow=ci.yml --limit=1 --json databaseId,conclusion,name -q '.[]'
gh run view <run-id> --json jobs -q '.jobs[] | {name: .name, conclusion: .conclusion}'
# esperado: dep-audit conclusion = success
```

**Verify:** o nome `Dependency Audit` aparece em `gh run view` com conclusion `success` na baseline atual.

---

## Phase 4 — HTTPS Verification & Docs

### T08 — Documentar política em `AGENTS.md` e `README.md`

Adicionar seção "Security" ao `/repos/tauan-games/AGENTS.md` com:

- Referência a `specs/security/SPEC.md`
- Regra: nunca commitar `.env` real (FR-S04)
- Regra: rodar `npm audit --audit-level=high` antes de adicionar nova dep (FR-S02)
- Regra: rodar `gitleaks detect --config=.gitleaks.toml --no-git` antes de qualquer commit grande (FR-S01)
- Política HTTPS (FR-S03): jogos só são publicados em GitHub Pages, que serve HTTPS por default

Adicionar parágrafo curto em `README.md` apontando para `AGENTS.md` § Security.

**Verify:**
```bash
grep -q "specs/security/SPEC.md" AGENTS.md && echo "spec referenced"
grep -q "FR-S04" AGENTS.md && grep -q "FR-S03" AGENTS.md && echo "policies referenced"
grep -q "Security" README.md && echo "readme pointer ok"
```

---

### T09 — Verificar HTTPS na URL pública (post-deploy)

Esta task **só pode ser executada após o primeiro deploy** em GitHub Pages (escopo da feature de deploy, fora desta SPEC). Quando o deploy acontecer:

```bash
# HTTPS retorna 200
curl -sI https://marcoaureliomenezes.github.io/tauan-games/ | head -1
# esperado: HTTP/2 200

# HTTP redireciona para HTTPS (GitHub Pages policy)
curl -sI http://marcoaureliomenezes.github.io/tauan-games/ | grep -iE "^(HTTP|location)"
# esperado: HTTP/1.1 301 Moved Permanently ; location: https://...
```

**Verify:** ambos os comandos produzem o output esperado. Anotar resultado em `specs/security/PLAN.md` § Verification (linha "Phase 4 HTTPS").

Se Pages ainda não foi habilitado, esta task fica `[ ] blocked: aguardando feature de deploy` e não impede o restante do SDD pipeline ser fechado para Phases 1–3.

---

## Done Condition

- T01–T08 completos e mergeados em `main`
- `.github/workflows/ci.yml` contém os 3 jobs: `playwright-tests`, `secret-scan`, `dep-audit`
- Última run de CI verde nos 3 jobs
- `AGENTS.md` referencia `specs/security/SPEC.md`
- T09 marcada `[x] done` (após primeiro deploy) **ou** `[ ] blocked` documentada

Após Done Condition, atualizar `specs/security/SPEC.md` para `[x] Implementado` (ação humana após validação operador).
