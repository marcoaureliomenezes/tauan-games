# tauan-games

Jogos web do Tauan — jogáveis direto no navegador, sem build step.

**🎮 Jogar agora: <https://marcoaureliomenezes.github.io/tauan-games/>**

| Jogo | Engine | URL |
|---|---|---|
| 🌌 **Space War** — simulador de universo com 5 sistemas estelares, física orbital real, buraco negro, pulsar e núcleo galáctico | Three.js r165 (vendorado) | [/src/web-games/space-war/](https://marcoaureliomenezes.github.io/tauan-games/src/web-games/space-war/) |
| ✈️ **Aero Strike** — ataque ao solo com F-35: 4 mapas (incl. Inhaúma realista), decolagem/pouso, canhão, mísseis, NUKE com cogumelo volumétrico e firestorm | Three.js r165 (vendorado) | [/src/web-games/aero-fighters/](https://marcoaureliomenezes.github.io/tauan-games/src/web-games/aero-fighters/) |
| 🕵️ **James Bond: Operações** — FPS de espionagem com 6 operações | Three.js r165 | [/src/web-games/james-bond/](https://marcoaureliomenezes.github.io/tauan-games/src/web-games/james-bond/) |
| 🏁 **Cruis'n Tauan** — corrida arcade estilo Cruis'n World | Three.js r165 | [/src/web-games/speed-run/](https://marcoaureliomenezes.github.io/tauan-games/src/web-games/speed-run/) |
| 🏗️ **Demolition Ball** — trator-guindaste com bola de demolição numa cidade de blocos | WebGL2 puro | [/src/web-games/demolition-ball-opus-5/](https://marcoaureliomenezes.github.io/tauan-games/src/web-games/demolition-ball-opus-5/) |

O repositório é 100% jogos WEB (decisão do operador, 2026-08-11 — os projetos
Godot 4 foram removidos; histórico no git).

## Rodar localmente

Qualquer servidor estático na **raiz do repo** (os jogos importam o vendor
compartilhado em `src/web-games/vendor/`):

```bash
python3 -m http.server 8146
# http://127.0.0.1:8146/                → landing
# http://127.0.0.1:8146/src/web-games/aero-fighters/  → Aero Strike
# http://127.0.0.1:8146/src/web-games/space-war/  → Space War
```

## Testes

```bash
cd src/web-games
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
   - `CI / Playwright Tests` — suíte e2e dos jogos web;
   - `GitGuardian` — vazamento de segredos;
     Godot 4.7 e gdUnit4 quando o projeto tem testes.
   Se algum job falhar: `gh run view <id> --log-failed`, corrigir a causa raiz,
   push de novo e esperar verde. **Nunca fazer merge com job vermelho ou pendente.**
5. **Merge do PR** (merge commit): `gh pr merge <n> --merge`
6. O merge dispara o **`Deploy to GitHub Pages`** em `main`, que:
   - monta `_site/` = `index.html` (landing) + `src/` (web-games com vendor
     compartilhado — three.js + jsm);
   - publica via `actions/deploy-pages` (Settings → Pages → Source: *GitHub Actions*).
7. **Acompanhar até o fim**: `gh run list --branch main` → o run `Deploy to GitHub
   Pages` precisa concluir `success`.
8. **Verificar no ar**:
   - <https://marcoaureliomenezes.github.io/tauan-games/> (landing)
   - <https://marcoaureliomenezes.github.io/tauan-games/src/web-games/aero-fighters/>
   - <https://marcoaureliomenezes.github.io/tauan-games/src/web-games/space-war/>
   - **Ctrl+Shift+R** (hard refresh) na primeira visita pós-deploy — o Chrome
     cacheia módulos ES antigos e pode quebrar imports com a versão velha.

### Regras que mantêm o deploy funcionando

- **Caminhos sempre RELATIVOS** dentro dos jogos (`src/main.js`,
  `../vendor/...`) — o site vive sob o subpath `/tauan-games/`; caminho absoluto
  (`/vendor/...`) quebra no Pages.
- **`vendor/` é compartilhado e vendorado** em `src/web-games/vendor/`
  (three.module.min.js + examples/jsm patchados para import relativo) — nada de
  CDN, nada de npm em runtime.
- **Jogo novo** = pasta em `src/web-games/<jogo>/` + card no `index.html` — o
  passo *Build site directory* do `pages.yml` já copia `src/` inteiro.
