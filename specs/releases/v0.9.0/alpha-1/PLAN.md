# PLAN: v0.9.0 alpha-1 — demolition-ball-city-uplift

**Status:** Aprovado <!-- 2026-08-11: escopo aprovado pelo operador no grill-me; implementação autorizada ("continue the work") -->
**Release ID:** v0.9.0
**Segment:** alpha-1
**Owner:** product-engineer
**Created:** 2026-08-11

---

## Approach

Extensão modular do engine WebGL2 próprio — nenhuma reescrita, nenhuma dependência
além do snippet `snoise` (MIT). Módulos novos são irmãos dos atuais e seguem o mesmo
padrão (funções puras de `math.js`, renderer por instâncias, sem estado global fora
de `main.js`).

**Arquitetura de mudanças:**

- `src/vendor/snoise.js` (NOVO) — snippet GLSL `snoise` 2D/3D (webgl-noise, MIT) como
  string exportada + cópia da licença. Consumido pelo sky shader (nuvens) e,
  se útil, por variação de vegetação.
- `src/modes.js` (NOVO) — configuração de modo: `tauan` (sem prazo/multa, threshold
  0.5, 1 alvo, homing forte, dano ×2.5) vs `contratos` (parâmetros atuais).
  `missions.js` consome `modes.js`; overlay inicial em `index.html`/`main.js` ganha
  os dois botões grandes.
- `rig.js` — `stepBall` ganha o servo de homing: quando `input.pump > 0` e existe
  `world.homingTarget()`, a força de pump passa a ser o servo de velocidade em direção
  ao alvo (cap ~26 m/s²; Tauan: ganho/cap maiores); sem alvo, comportamento atual.
  Alvo fornecido por `main.js` (estrutura do contrato → senão carro mais próximo).
  Spawn seguro: constructor e reposicionamentos fazem clamp acima do solo e fora de
  footprints. `render` ganha a figura do operador na cab (capacete, tronco, braços,
  acompanha `worldTurretYaw`).
- `src/pedestrians.js` (NOVO) — walkers nas calçadas: rotas pelo grafo de
  quarteirões/calçadas, locomoção com pernas alternadas (2 cilindros oscilando),
  reação de fuga a impactos próximos (`world.debris`/eventos de impacto), imunes à
  bola (bola os atravessa; eles se afastam). Render via instâncias (caixa/cilindro/
  esfera), mesmo padrão de `traffic.js`.
- `traffic.js` — variantes de veículo (carro, caminhonete, van/ônibus) com
  cabine/vidros/faróis/lanternas; grafo de ruas passa a conhecer arestas-ponte;
  regra de parada total nas entradas de quarteirão isolado por cones
  (`world.closedBlocks` consultável).
- `city.js` — (a) fachadas: metadados por estrutura (layout de porta/janela do
  térreo e pavimentos) consumidos pelo shader de bandas refinado + cores por célula
  de porta; (b) praças: caminhos, canteiros de flores (props `flowerbed`),
  árvores variadas (2–3 silhuetas) também em calçadas residenciais; (c) rio:
  faixa de água atravessando o mapa (canal no eixo escolhido pela semente), leito
  sem estruturas, 2–3 pontes (tabuleiro + guarda-corpos como static mesh),
  calçadas contínuas pelas pontes.
- `src/crew.js` (NOVO) — equipe de isolamento: estado `idle → driving → placing →
  holding → collecting → leaving`; furgão (modelo de van de obra), ajudante
  (mesmo rig visual dos pedestres, colete laranja), cones (instâncias cilindro+
  base) no perímetro do quarteirão-alvo; expõe `closedBlocks` para o tráfego.
  Botão na HUD (`index.html`) + tecla `C`, visível a ≤30 m do alvo; 1×/contrato.
- `shaders.js` — bandas de fachada refinadas (janela com moldura + vidro, porta no
  térreo), céu: gradiente de manhã + nuvens móveis via `snoise` + sol preservado.
- `main.js` — seleção de modo no overlay, provider de alvo do homing, botão da
  equipe, wiring de `pedestrians.js`/`crew.js`, `?quality=low` preservado p/ testes.

**Ordem:** modos+homing primeiro (jogabilidade central do Tauan), cidade viva em
seguida (maior massa visual), equipe/personagem depois, memória/docs por último.
Testes unit/e2e crescem junto de cada workstream (baseline nunca vermelha).

**Branch:** implementação em branch própria a partir de `main`
(`feature/demolition-ball-city-uplift-v1`) — a working tree atual pertence a outra
sessão/release (v0.8.0). Mutação git a confirmar com o operador no início da
implementação.

## Validation Dependency Table

| Workstream | Produces by end | Direct validation | Validation dependencies | Deferred integration evidence |
|---|---|---|---|---|
| WS-1 Modos + destruição fácil (R-01, R-02) | `modes.js`, missions parametrizado, overlay de seleção | unit: threshold/timer/multa por modo; e2e: AC-1, AC-3 | none | none |
| WS-2 Homing + spawn seguro (R-03, R-04) | servo no `rig.js`, provider de alvo | unit: leis no Rig real (espelho do spike), spawn fora de volume; e2e: AC-2 | none | none |
| WS-3 Fachadas + praças + céu (R-05, R-06, R-08) | shaders/city/vendor snoise | screenshots Playwright anotados (AC-4 parcial); fps ≥ 20 em quality=low | none | none |
| WS-4 Rio + pontes (R-07) | city.js rio/pontes, arestas-ponte no tráfego | unit: leito sem estruturas, fluxo de carros sem deadlock; screenshot AC-4 | WS-3 (mesma geração) | none |
| WS-5 Pedestres + carros (R-09, R-10) | pedestrians.js, variantes em traffic.js | unit: pedestre imune à bola e foge de impacto; e2e screenshot (AC-4) | WS-4 (rotas usam pontes) | none |
| WS-6 Equipe de isolamento (R-11) | crew.js + botão HUD + parada de tráfego | e2e: AC-5; unit: `closedBlocks` para o grafo | WS-4 | none |
| WS-7 Operador na cabine (R-12) | figura no `rig.render` | screenshot AC-6 | none | none |
| WS-8 Memória SDD + docs (R-13, R-14) | games-catalog + atoms + READMEs | `dadaia` spec reviewer passa; links íntegros | WS-1..7 (descreve o final) | none |
| WS-9 Fecho | suíte completa + screenshots finais | AC-1..8; `npm test` verde; aceitação do operador | todos | none |
