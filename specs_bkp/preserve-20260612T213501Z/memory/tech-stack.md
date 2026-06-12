# Tech-Stack Memory: tauan-games

## Stack Comprometida por Jogo

| Jogo | Engine | Versão | Justificativa |
|---|---|---|---|
| tauan-trex | Phaser.js | 3.60 (CDN) | Handles canvas, input, physics loop out of the box; great docs; no build step needed |
| aero-fighters | Three.js | r165 (`vendor/three.module.min.js`, ES module build) | Best 3D in browser; ES module habilita modularização do jogo em 15 src/*.js |

## Princípios de Stack

- **Sem build step** — todos os jogos são `index.html` + `game.js`, abre direto no browser
- **Sem arquivos de assets externos** — sprites, sons e modelos 3D todos procedurais/programáticos; zero dependências de load externo que possam falhar
- **Vendor local commitado em `vendor/`** — libs de terceiros (Phaser, Three.js) baixadas uma vez de CDN e versionadas no repo; testing-infra exige offline (NFR-02 `testing-infra/SPEC.md`)
- **Zero TypeScript** nos jogos — JS puro para simplicidade e sem compilação

## Testing Stack

| Ferramenta | Versão | Uso |
|---|---|---|
| Playwright | latest | Smoke tests + AC validation para todos os jogos |
| @playwright/test | ^1.44 | Test runner |
| npx serve (ou python3 -m http.server) | — | Static server no `globalSetup` dos testes |

## Padrão de Deploy

- Jogos web: GitHub Pages (branch `gh-pages`, cada jogo em subpasta)
- Jogos desktop: executável buildado e linkado no README

## Descartado / Não Adotado

| Opção | Razão descartada |
|---|---|
| Kaboom.js | Menos maduro que Phaser, menos documentação |
| Babylon.js | Mais pesado que Three.js para jogos simples; API maior que necessário |
| Pygame | Desktop only; objetivo é browser |
| TypeScript + bundler | Over-engineering para jogos simples; complica deploy estático |
