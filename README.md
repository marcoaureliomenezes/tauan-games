# tauan-games

Jogos web do Tauan — jogáveis direto no navegador, sem build step.

**🎮 Jogar agora: <https://marcoaureliomenezes.github.io/tauan-games/>**

| Jogo | Engine | URL |
|---|---|---|
| 🌌 **Space War** — simulador de universo com 5 sistemas estelares, física orbital real, buraco negro, pulsar e núcleo galáctico | Three.js r165 (vendorado) | [/space-war/](https://marcoaureliomenezes.github.io/tauan-games/space-war/) |
| ✈️ **Aero Strike** — ataque ao solo com F-35: 4 mapas, decolagem/pouso, canhão, mísseis e NUKE com cogumelo volumétrico | Three.js r165 (vendorado) | [/aero-fighters/](https://marcoaureliomenezes.github.io/tauan-games/aero-fighters/) |
| 🦖 **Tauan T-Rex** — corrida infinita do dinossauro | Phaser 3 | [/tauan-trex/](https://marcoaureliomenezes.github.io/tauan-games/tauan-trex/) |

`aero-fighters-v2/` é o remake em Godot 4.4 (pausado — só CI de lint/validade de cena).

## Rodar localmente

Qualquer servidor estático na **raiz do repo** (os jogos importam `/vendor/` compartilhado):

```bash
python3 -m http.server 8146
# http://127.0.0.1:8146/                → landing
# http://127.0.0.1:8146/aero-fighters/  → Aero Strike
# http://127.0.0.1:8146/space-war/      → Space War
```

## Testes

```bash
npm install                      # 1ª vez (Playwright)
npm run validate:aero-map        # validador de mapas (Node, rápido)
npm run test:aero:unit           # unit (Node)
npm run test:aero:sim            # simulações de física/surtida (Node)
npm test                         # suíte Playwright completa (sobe servidor próprio)
TEST_PORT=8153 npm test          # se a porta 8080 estiver ocupada
```

## Deploy no GitHub Pages — o processo

O deploy é **automático via GitHub Actions** (`.github/workflows/pages.yml`): todo push
em `main` monta o site e publica no Pages. Ninguém publica na mão.

O fluxo completo, do código ao ar:

1. **Branch** a partir de `main`:
   `git checkout main && git pull && git checkout -b feature/minha-mudanca`
2. **Desenvolver e testar localmente** (seção acima). Nunca abrir PR com teste vermelho.
3. **Push + PR** para `main`:
   `git push -u origin feature/minha-mudanca && gh pr create --base main`
4. **CI do PR toda verde** — obrigatório, sem exceção:
   - `CI / Playwright Tests` — suíte e2e dos 3 jogos;
   - `GitGuardian` — vazamento de segredos;
   - `aero-fighters-v2 Godot CI` (só dispara se tocar `aero-fighters-v2/**`) —
     gdlint (sem `addons/` vendorado), validade de cena Godot 4.4 headless,
     flake8/black em `Tools/`, LFS.
   Se algum job falhar: `gh run view <id> --log-failed`, corrigir a causa raiz,
   push de novo e esperar verde. **Nunca fazer merge com job vermelho ou pendente.**
5. **Merge do PR** (merge commit): `gh pr merge <n> --merge`
6. O merge dispara o **`Deploy to GitHub Pages`** em `main`, que:
   - monta `_site/` = `index.html` (landing) + `aero-fighters/` + `space-war/` +
     `tauan-trex/` + `vendor/` (three.js + jsm compartilhados);
   - publica via `actions/deploy-pages` (Settings → Pages → Source: *GitHub Actions*).
7. **Acompanhar até o fim**: `gh run list --branch main` → o run `Deploy to GitHub
   Pages` precisa concluir `success`.
8. **Verificar no ar**:
   - <https://marcoaureliomenezes.github.io/tauan-games/> (landing)
   - <https://marcoaureliomenezes.github.io/tauan-games/aero-fighters/>
   - <https://marcoaureliomenezes.github.io/tauan-games/space-war/>
   - **Ctrl+Shift+R** (hard refresh) na primeira visita pós-deploy — o Chrome
     cacheia módulos ES antigos e pode quebrar imports com a versão velha.

### Regras que mantêm o deploy funcionando

- **Caminhos sempre RELATIVOS** dentro dos jogos (`src/main.js`,
  `../vendor/...`) — o site vive sob o subpath `/tauan-games/`; caminho absoluto
  (`/vendor/...`) quebra no Pages.
- **`vendor/` é compartilhado e vendorado** (three.module.min.js + examples/jsm
  patchados para import relativo) — nada de CDN, nada de npm em runtime.
- **Jogo novo** = pasta na raiz + card no `index.html` + acrescentar a pasta no
  passo *Build site directory* do `pages.yml`.
