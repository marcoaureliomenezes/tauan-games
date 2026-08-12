# SPEC: v0.9.0 alpha-1 — demolition-ball-city-uplift

**Status:** Aprovado <!-- 2026-08-11: escopo aprovado pelo operador no grill-me; implementação autorizada ("continue the work") -->
**Release ID:** v0.9.0
**Segment:** alpha-1
**Owner:** product-engineer
**Created:** 2026-08-11
**Consumes:** demolition-ball-city-uplift-v1

---

## 1. Problem and context

Demanda do operador (2026-08-11). O `src/web-games/demolition-ball/` foi
construído em 1 shot: o trator-guindaste com a bola de demolição está excelente
(pêndulo físico, destruição volumétrica — NÃO refazer), mas a cidade é pobre
(caixas planas, sem pedestres, sem vida), destruir é difícil demais para o filho
de 3 anos do operador, e o ESPAÇO hoje é só um impulso fixo na direção da lança.

Jogo inspecionado a fundo nesta sessão: 3.064 LOC, 14 módulos, WebGL2 puro
(renderer/física/áudio próprios), cidade 7×7 procedural determinística
(`city.js`), trânsito em grafo (`traffic.js`), 6 contratos com prazo/multa
(`missions.js`). Baseline verde: 18 unit + 6 e2e Playwright.

Grill-me obrigatório CONCLUÍDO (4/4 respostas do operador) — relatório:
`.dadaia/reports/tauan-games/product-engineer/2026-08-11T150217Z-refine-specs.html`;
handoff validado em `.dadaia/handoff/tauan-games/2026-08-11T150424Z-…`.

## 2. Objective

Transformar o Demolition Ball num jogo que uma criança de 3 anos consegue jogar e
amar: cidade viva e bonita (pedestres, praças, rio com pontes, céu com nuvens),
ESPAÇO que busca o alvo sozinho, equipe de isolamento com cones, operador visível
na cabine — sem tocar na física do pêndulo nem na identidade WebGL2-puro.

## 3. Scope

### Modos e acessibilidade

- **R-01 — Dois modos de jogo (P0) [ADR-1]:** seleção na tela inicial.
  **Modo Tauan**: sem prazo, sem multa colateral, threshold ~50%, um alvo por vez,
  texto grande e simples. **Modo Contratos**: o jogo atual, intacto.
- **R-02 — Destruição fácil no Modo Tauan (P0):** multiplicador de dano/energia por
  impacto e vida de estrutura ajustados de modo que 2–4 pancadas de bola em balanço
  derrubem o alvo do contrato 1 (hoje ~5% de um galpão por pancada forte).

### ESPAÇO com homing

- **R-03 — Servo de velocidade no ESPAÇO (P0) [ADR-2]:** enquanto ESPAÇO estiver
  pressionado, a bola recebe aceleração horizontal limitada (~26 m/s² cap) em
  direção ao alvo corrente — a estrutura-alvo do contrato; sem alvo ativo, o carro
  de rua mais próximo. `Q/E` (slew) e `Z/X` (cabo) permanecem 100% manuais.
  Assistência mais forte no Modo Tauan (ganho/cap maiores). Lei validada em spike
  com o Rig real: 8 impactos/25s, 1º impacto ~1,1s (lei atual: 2/25s).
  SHIFT mantém o impulso reverso atual.
- **R-04 — Spawn seguro da bola (P1):** bola nunca inicia/é reposicionada dentro de
  volume de estrutura ou abaixo do solo (achado do spike: hoje o constructor e o
  `teleportBallTo` podem deixá-la intersectando; o solver empurra para fora).

### Cidade viva

- **R-05 — Fachadas (P0):** prédios com janelas com moldura/vidro e portas no
  térreo, variação por tipo (torre espelhada, residencial com varanda, casa com
  porta+janela frontal, galpão com portão). Refinar as bandas procedurais já
  existentes em `shaders.js` + detalhe geométrico no nível de célula onde fizer
  diferença (térreo/fachada frontal).
- **R-06 — Praças e vegetação (P1):** praças com gramado, caminhos, árvores
  variadas (2–3 formas/tamanhos), canteiros com flores (cor por canteiro);
  árvores também nas calçadas de bairros residenciais.
- **R-07 — Rio com pontes (P1) [ADR-4]:** rio real cruzando o mapa (faixa de água
  com cor/reflexo simples), sem estruturas no leito; 2–3 pontes ligando as ruas
  que o cruzam (tabuleiro + guarda-corpos); trânsito e pedestres atravessam pelas
  pontes.
- **R-08 — Céu (P1):** sol já existente (disco + glow) preservado; adicionar
  nuvens procedurais em movimento lento via `snoise` (webgl-noise, MIT — único
  vendor novo, arquivo único em `src/vendor/` com licença). Céu com gradiente
  mais rico (manhã ensolarada).
- **R-09 — Pedestres (P0):** pedestres andando nas calçadas (bonecos articulados
  simples: tronco, cabeça, pernas alternadas), em rotas ao longo dos quarteirões;
  atravessam praças; reagem fugindo de perto de impactos da bola. Nunca são
  atingidos (jogo para criança): a bola os atravessa sem dano e eles se afastam.
- **R-10 — Carros melhorados (P1):** variedade de modelos (carro, caminhonete,
  ônibus/caminhão simples) com cabine/vidros, faróis e lanternas (cor emissiva
  simples); manter fila/freio atuais; ao serem arremessados pela bola, já sem
  ocupantes visíveis (manter regra atual).

### Equipe de isolamento

- **R-11 — "CHAMAR EQUIPE 🚧" (P0) [ADR-3]:** ao chegar perto do alvo do contrato
  (raio ~30 m do centro do alvo), aparece botão grande na HUD (também tecla `C`).
  Ao acionar: um furgão de obra dirige até a entrada do quarteirão, um ajudante
  desce, caminha colocando cones laranjas ao redor da área do alvo (perímetro do
  quarteirão), e o tráfego para nas extremidades do quarteirão enquanto os cones
  estiverem postos. Uma vez por contrato; cones removidos (equipe recolhe e vai
  embora) quando o alvo é concluído.

### Personagem

- **R-12 — Operador visível na cabine (P1) [ADR-6]:** figura procedural
  (caixas/cilindros instanciados, padrão do renderer) sentada na cab do trator —
  capacete, tronco, braços voltados à lança; acompanha o slew da torre.

### Memória SDD e documentação

- **R-13 — Regularizar memória (P1):** adicionar demolition-ball ao
  `specs/memory/product/games-catalog.md` e criar os atoms do jogo em
  `specs/memory/product/web-games/demolition-ball/` (o jogo, a cidade,
  a física/controles, os modos) — hoje o jogo não existe na memória SDD.
- **R-14 — Docs do jogo (P2):** atualizar `demolition-ball/README.md`
  (controles novos, modos) e a linha do jogo no README raiz se necessário.

## 4. Decisions (grill-me 2026-08-11)

- **ADR-1** dois modos (Tauan + Contratos) — operador.
- **ADR-2** homing = servo de velocidade, ambos os modos, mais forte no Tauan;
  lança e cabo manuais — operador.
- **ADR-3** equipe de isolamento exatamente como proposto (botão, furgão, ajudante,
  cones, tráfego parado, 1×/contrato) — operador.
- **ADR-4** rio real com 2–3 pontes — operador.
- **ADR-5** permanecer WebGL2 puro; única dependência nova = `snoise` MIT vendor —
  inspeção (identidade do jogo + regras do repo: sem build, sem CDN, vendor local).
- **ADR-6** operador visível na cabine — operador (escopo "Plus").

## 5. Non-goals

- NÃO refazer trator, bola, pêndulo, renderer, física ou áudio (apenas estender).
- NÃO adotar Three.js/engine nem pipeline de build; sem CDN.
- NÃO tocar em speed-run/v0.8.0 nem mover `specs/releases/ACTIVE.md` (release
  v0.8.0 em IMPLEMENTATION por outra sessão — presença advisory respeitada).
- NÃO mudar a cidade determinística para aleatória por partida (mesma semente;
  a cidade nova é a nova "mesma cidade").
- NÃO sanitizar entradas alheias do backlog (erros pré-existentes do
  `backlog doctor` ficam para demanda própria).

## 6. Acceptance criteria

- **AC-1** Tela inicial oferece Modo Tauan e Modo Contratos; no Tauan não há
  cronômetro nem multa e o threshold é ≤50%.
- **AC-2** Segurar ESPAÇO com um alvo ativo produz impacto na estrutura-alvo em
  ≤3s e impactos repetidos (~1 por balanço) sem input adicional; sem alvo ativo,
  a bola busca o carro mais próximo. `Q/E` e `Z/X` respondem normalmente durante
  o homing. (e2e)
- **AC-3** No Modo Tauan, o alvo do contrato 1 cai com ≤4 pancadas boas. (e2e)
- **AC-4** Pedestres visíveis andando nas calçadas; carros com ao menos 3 modelos
  distintos; prédios com janelas detalhadas e portas; praça com árvores e flores;
  rio com ≥2 pontes; nuvens visíveis no céu. (screenshots Playwright anotados)
- **AC-5** Botão "CHAMAR EQUIPE" aparece a ≤30 m do alvo; ao acionar, furgão
  chega, ajudante coloca cones e os carros param no quarteirão; após concluir o
  alvo, a equipe recolhe os cones. (e2e)
- **AC-6** Operador visível na cabine em qualquer câmera. (screenshot)
- **AC-7** Baseline estendida verde: unit + e2e existentes atualizados e novos
  testes (homing, modos, equipe) passando; `npm test` do jogo verde.
- **AC-8** games-catalog + atoms de memória criados e coerentes com o jogo.

## 7. Validation plan

- Unit (`tests/demolition-ball/unit.mjs`): leis de homing no Rig real
  (espelho do spike), destruição fácil no Modo Tauan, spawn seguro da bola,
  cones bloqueiam tráfego (modelo de grafo), pedestres nunca feridos.
- E2E Playwright (`tests/demolition-ball/`): boot sem erros, AC-2, AC-3,
  AC-5, screenshots para AC-4/AC-6. GPU flags do config dedicado (angle-gl).
- Aceitação final: operador (e filho) jogam localmente.

## 8. Risks

- **Branch/concorrência:** a working tree está em
  `feature/aero-fighters-flight-combat-v1` com mudanças não commitadas de outra
  sessão viva. Implementação desta release exige branch própria a partir de
  `main` — mutação git a confirmar com o operador antes de codar.
- **Perf:** pedestres/cones/vegetação aumentam instâncias — manter budget de
  3 draw calls instanciados + estáticos (renderer atual aguenta; medir fps no e2e).
- **Rio × trânsito:** pontes viram gargalos no grafo de ruas — validar que carros
  não travam filas permanentes (unit test de fluxo).

## 9. Sanitization (passo 1 do protocolo)

Conjunto escolhido = 1 item de backlog criado nesta sessão (fresco, sem
staleness); nenhum bug de `specs/bugs/` escolhido — demanda não é dirigida por
bugs. Nada a subsumir; nada deferido/rejeitado neste escopo.
