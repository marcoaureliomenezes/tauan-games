# PLAN — Release: far-west-open-world-v1

> **Status:** Aprovado
> **Release ID:** far-west-open-world-v1
> **Spec:** `SPEC.md` Aprovado
> **Criado:** 2026-07-18

## 1. Estratégia

Jogo Three.js r165 em ES modules com import map para `vendor/`, no padrão já provado
por `aero-fighters/` (state.js como fonte única `window.game`, config.js com todas as
constantes, main.js orquestrando o loop, módulos ≤250 linhas). Mundo procedural com
seed fixa a partir de heightmap + mapa de umidade (simplex-noise vendorado), rios
traçados como splines de descida de altitude. Modelos GLTF CC0 vendorados com fallback
procedural low-poly para qualquer modelo ausente — o jogo NUNCA quebra por asset
faltante.

Contratos centrais (definidos no scaffold, antes de qualquer feature):

- `state.js` → `window.game` com `world`, `player`, `entities`, `ui`, `flags`.
- `terrain.js` exporta `heightAt(x, z)` e `normalAt(x, z)` — única fonte de altura
  para cavalo, NPCs, vagões, trem e câmera.
- `assets.js` exporta `loadModels()` → registry `{ nome: {scene, animations} }` com
  clone helpers; fallback procedural por categoria.
- Input map único em `input.js`: WASD marcha/rumo, Shift galope, V câmera, F mira,
  Espaço tiro, R recarga, M mapa, E interagir (capturar/entregar/comer).

## 2. Write set permitido

| Caminho | Uso |
|---------|-----|
| `far-west/**` | todo o jogo (index.html, src/*.js, README.md) |
| `vendor/jsm/**` | addons three r165 novos (GLTFLoader, Sky, PointerLockControls, utilitários exigidos por eles) |
| `vendor/simplex-noise.js` | ruído procedural |
| `vendor/models/**` | packs GLTF CC0 + LICENSES.md com atribuição |
| `index.html` | somente link navegável para `far-west/` no catálogo |
| `tests/far-west/**` | smoke Playwright |
| `package.json` | somente script de teste dedicado, sem dependência nova |
| `specs/releases/far-west-open-world-v1/**` | artefatos SDD |
| `specs/backlog/far-west-open-world-v1.md` | status/release do item consumido |

## 3. Workstreams

### W1 — Vendor e assets (fundação)

Vendorizar addons three r165 e simplex-noise; baixar packs GLTF CC0 (cavalo, cowboy,
veado, cobra, águia, NPCs, nativos, trem, árvores/rochas); `vendor/models/LICENSES.md`
com atribuição e confirmação CC0. `assets.js` com registry + fallbacks procedurais.

Validação: `node`/`npx serve` servindo, nenhum 404 local, LICENSES.md completo.

### W2 — Mundo (terreno, água, céu, vegetação)

Heightmap seed fixa, chunks 8×8 com 2 níveis de LOD, material por altitude/inclinação
(neve, rocha, grama, trilha), rios com vaus e 2+ pontes, lagos, Sky + FogExp2 + ciclo
dia/noite, scatter de árvores/rochas/arbustos por bioma.

Validação: `heightAt` consistente com a malha renderizada; FPS estável; smoke de boot.

### W3 — Cavalo, jogador, câmeras, combate

Locomotion por marchas com stamina, alinhamento à encosta, input, 1ª/3ª pessoa,
mira/tiro/recarga hitscan com tracer e impacto.

Validação: simulação headless (sim harness no padrão `tests/aero-fighters/tools/`)
de marchas/stamina; Playwright: teclas alteram `window.game.player`.

### W4 — Entidades vivas (cidades, aldeias, trem, fauna, bandidos, acampamento)

2 cidades com prédios/NPCs/carroças, 2 aldeias com arqueiros, trem em spline, veados
com fuga, cobras, águias, 5 bandidos com rendição/captura, acampamento com
entrega/comida/recarga.

Validação: sim headless de IA (fuga de veado, rendição de bandido, flecha de
arqueiro); contadores em `window.game.entities`.

### W5 — Mapa, HUD, polish, testes, catálogo

Mapa fullscreen [M] com relevo + marcadores, minimapa, HUD completo, áudio WebAudio
sintetizado (galope, tiro, ambiente), smoke Playwright completo, link no catálogo,
README.

Validação: `npx playwright test tests/far-west` verde.

## 4. Riscos

| Risco | Mitigação |
|-------|-----------|
| Download dos packs CC0 falha ou licença não confirma | fallback procedural low-poly obrigatório por categoria; jogo nunca bloqueia |
| FPS em hardware modesto com mundo 2 km | chunks+LOD, scatter instanciado (InstancedMesh), fog limitando draw distance |
| Complexidade do controlador do cavalo | marchas discretas + interpolação, sem ragdoll; sim headless dirigindo tuning |
| Escopo estourar | requisitos marcados R-04..R-14 são o MVP; polish além deles só se tudo verde |
