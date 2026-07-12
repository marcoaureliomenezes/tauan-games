# PLAN — Release: memoria-bichos-v1

> **Status:** Aprovado
> **Release ID:** memoria-bichos-v1
> **Spec:** `SPEC.md` Aprovado
> **Criado:** 2026-07-12

## 1. Problema e estrategia

Memoria dos Bichos deve nascer como um novo jogo web standalone, infantil, curto e
imediatamente jogavel, sem depender de outro jogo, engine, build step, CDN ou rede em
runtime. A implementacao deve ser pequena o bastante para caber em HTML/CSS/JS estatico,
mas testavel por Playwright com ordem deterministica para cobrir pareamento, erro,
vitoria e estrelas sem depender de sorte.

Estrategia escolhida:

- criar a pasta propria `memoria-bichos/`;
- implementar a experiencia com `index.html`, `styles.css`, `game.js` e `README.md`;
- usar animais locais por emoji grande, com desenho visual por CSS e estados DOM
  observaveis;
- expor um modo de teste controlado por query string ou hook local de debug para fixar a
  ordem das cartas e facilitar validacao Playwright;
- adicionar o link do jogo ao catalogo principal do repo sem alterar gameplay de jogos
  existentes;
- adicionar uma suite Playwright dedicada em `tests/memoria-bichos/`.

## 2. Write set permitido para implementacao

Arquivos e pastas permitidos para esta release:

| Caminho | Uso permitido |
|---------|---------------|
| `memoria-bichos/index.html` | pagina standalone do jogo |
| `memoria-bichos/styles.css` | layout, cartas, feedback visual e responsividade |
| `memoria-bichos/game.js` | regras do jogo, estado, audio sintetizado local e hooks de teste |
| `memoria-bichos/README.md` | como rodar, objetivo, niveis e controles |
| `index.html` | somente link navegavel para `memoria-bichos/` no catalogo principal |
| `tests/memoria-bichos/**` | smoke e ACs Playwright do novo jogo |
| `package.json` | somente se for necessario adicionar script de teste dedicado, sem dependencia nova |
| `specs/releases/memoria-bichos-v1/**` | PLAN, TASKS e marcadores SDD |

Arquivos de `tauan-trex/`, `aero-fighters/`, `space-war/`, `corrida/`,
`aero-fighters-v2/`, `vendor/`, workflows e assets de outros jogos ficam fora do write
set da release.

## 3. Workstreams

### W1 — Scaffold standalone e catalogo

Criar `memoria-bichos/` com HTML sem CDN, CSS local e JS local. A primeira tela deve
mostrar a identidade visual do jogo e tres controles grandes para iniciar 6, 12 ou 20
cartas. O catalogo principal deve apontar para `memoria-bichos/` por link navegavel.

Validacao planejada:

- abrir `/memoria-bichos/` em servidor estatico sem erro de console;
- interceptar requests e reprovar qualquer URL externa;
- navegar do `index.html` principal ate a pagina do jogo;
- verificar que a primeira tela nao mostra loading e expõe tres escolhas de nivel.

Entrega SPEC: R-01, R-02, R-03, R-04, R-12; AC-01, AC-02, AC-03, AC-10, AC-11, AC-12.

### W2 — Modelo de jogo deterministico

Implementar estado local em `game.js` com niveis fixos:

- 6 cartas / 3 pares;
- 12 cartas / 6 pares;
- 20 cartas / 10 pares.

O embaralhamento normal deve ser local, mas a suite deve conseguir iniciar uma partida
deterministica, por exemplo com `?testDeck=...` ou `window.__memoriaBichosDebug`, sem
afetar a experiencia normal. Cada carta deve carregar dados observaveis (`data-animal`,
`data-state`, `data-card-id` ou equivalente) para que a validacao teste comportamento,
nao detalhes internos fragilizados.

Validacao planejada:

- iniciar cada nivel e contar cartas e pares;
- iniciar um deck fixo para revelar um par, um erro e uma vitoria pequena;
- revisar que nao ha imports ou caminhos para outros jogos.

Entrega SPEC: R-05, R-06, R-10; AC-03, AC-09, AC-10, AC-11.

### W3 — Interacao de duas cartas, match e mismatch

Implementar a jogada por clique/toque: o jogador pode abrir exatamente duas cartas por
jogada. Durante a avaliacao, o tabuleiro fica bloqueado para novas aberturas ate resolver
match ou mismatch.

Regras:

- tentativa incrementa uma vez quando a segunda carta da jogada e revelada;
- match: as duas cartas ficam abertas ate o fim, recebem estado persistente de
  encontrada e disparam sinal visual temporario nao-audio por pelo menos 600 ms;
- mismatch: as duas cartas ficam visiveis por pelo menos 650 ms apos a segunda virada e
  fecham novamente ate 1200 ms;
- audio sintetizado local pode existir, mas nenhuma aceitacao depende dele.

Validacao planejada:

- acionar cartas via eventos de ponteiro;
- tentar abrir uma terceira carta durante o bloqueio e provar que o estado nao corrompe;
- medir a janela de mismatch com Playwright;
- medir que o indicador visual de match permanece detectavel por pelo menos 600 ms;
- confirmar persistencia das cartas encontradas.

Entrega SPEC: R-07, R-08, R-09; AC-04, AC-05, AC-06, AC-07, AC-09.

### W4 — Vitoria, estrelas e acoes finais

Implementar conclusao da partida quando todos os pares do nivel estiverem encontrados. A
tela final deve mostrar estrelas pela formula do SPEC e oferecer acoes claras para jogar
novamente ou trocar de nivel.

Regras:

- `3 estrelas` quando `tentativas <= pares`;
- `2 estrelas` quando `tentativas <= ceil(pares * 1.5)`;
- `1 estrela` acima disso.

Validacao planejada:

- concluir partida pequena deterministica com 3 tentativas e esperar 3 estrelas;
- concluir partida pequena deterministica com 5 tentativas e esperar 2 estrelas;
- concluir partida pequena deterministica com 6 ou mais tentativas e esperar 1 estrela;
- confirmar botoes finais de repetir e trocar de nivel.

Entrega SPEC: R-11; AC-08, AC-09.

### W5 — README, UX final e regressao minima

Completar `memoria-bichos/README.md` com objetivo, como rodar localmente, niveis e
controles por clique/toque. Revisar grades de 6, 12 e 20 cartas em viewport desktop e
mobile para garantir animais grandes, layout legivel e controles descobertos sem leitura
obrigatoria.

Validacao planejada:

- check automatizado de existencia e conteudo do README;
- smoke visual/DOM das grades em 6, 12 e 20 cartas;
- confirmar que a suite do novo jogo passa em servidor estatico;
- rodar a suite compartilhada aplicavel para garantir que o link no catalogo nao quebrou
  jogos existentes.

Entrega SPEC: R-04, R-06, R-10, R-12; AC-01, AC-11, AC-12.

## 4. Sequencia de implementacao

1. Criar scaffold `memoria-bichos/`, primeira tela e link no catalogo.
2. Adicionar teste smoke offline e navegacao de catalogo.
3. Implementar estado de niveis, geracao de deck e modo deterministico de teste.
4. Adicionar testes de selecao de niveis e deck deterministico.
5. Implementar virada de cartas, bloqueio de jogada, match e mismatch.
6. Adicionar testes de ponteiro, terceira interacao bloqueada, match persistente e
   janela de mismatch.
7. Implementar vitoria, estrelas e acoes finais.
8. Adicionar testes das tres faixas de estrelas.
9. Escrever README e fechar checks de UX/layout.
10. Rodar validacoes finais e preparar review.

Dependencias: W1 desbloqueia W2; W2 desbloqueia W3 e W4; W5 depende do comportamento
final estar pronto.

## 5. Plano de testes

Suite nova: `tests/memoria-bichos/memoria-bichos.spec.js` ou equivalente.

Casos minimos:

| Caso | Prova |
|------|-------|
| Boot offline | Sem console error, sem requests externos, sem build |
| Catalogo | Link principal navega para `/memoria-bichos/` |
| Niveis | 6, 12 e 20 cartas criam 3, 6 e 10 pares |
| Ponteiro | Cartas viram por clique/touch sem teclado obrigatorio |
| Bloqueio | Terceira carta nao abre durante avaliacao |
| Match | Par igual persiste aberto, incrementa encontrados e exibe sinal visual >= 600 ms |
| Mismatch | Par diferente fica visivel >= 650 ms e fecha ate 1200 ms |
| Vitoria | Todos os pares abertos acionam tela final |
| Estrelas | 3, 5 e 6+ tentativas no nivel pequeno geram 3, 2 e 1 estrela |
| Determinismo | Teste conclui partida pequena sem depender de sorte |
| Standalone | Scan/revisao confirma ausencia de imports/assets de outros jogos |
| README | Arquivo existe e cobre execucao, objetivo, niveis e controles |

Os testes devem observar comportamento externo por DOM, eventos de ponteiro, console e
network interception. Hooks de teste sao permitidos apenas para fixar deck ou ler estado
diagnostico local, sem criar dependencia de rede, storage remoto ou API externa.

## 6. Cobertura requisito -> workstream

| Requisito | Workstreams |
|-----------|-------------|
| R-01 | W1, W2 |
| R-02 | W1, W5 |
| R-03 | W1, W2 |
| R-04 | W1, W5 |
| R-05 | W2 |
| R-06 | W2, W5 |
| R-07 | W3 |
| R-08 | W3 |
| R-09 | W3 |
| R-10 | W2, W5 |
| R-11 | W4 |
| R-12 | W1, W5 |

## 7. Cobertura AC -> workstream

| AC | Workstreams |
|----|-------------|
| AC-01 | W1, W5 |
| AC-02 | W1 |
| AC-03 | W1, W2 |
| AC-04 | W3 |
| AC-05 | W3 |
| AC-06 | W3 |
| AC-07 | W3 |
| AC-08 | W4 |
| AC-09 | W2, W3, W4 |
| AC-10 | W1, W2 |
| AC-11 | W1, W2, W5 |
| AC-12 | W5 |

## 8. Fora de escopo operacional

- nao adicionar engine, bundler, TypeScript, backend, PWA ou dependencia runtime externa;
- nao reaproveitar codigo, mapas, veiculos, assets ou logica de outro jogo;
- nao alterar gameplay de jogos existentes;
- nao adicionar persistencia, login, placar online, analytics ou chamadas de rede;
- nao escrever memory nesta fase.
