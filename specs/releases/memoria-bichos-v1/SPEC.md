# SPEC — Release: memoria-bichos-v1

> **Status:** Aprovado
> **Release ID:** memoria-bichos-v1
> **Consumes:** memoria-bichos-v1
> **Criado:** 2026-07-12
> **Origem:** backlog `memoria-bichos-v1` + handoff
> `2026-07-12T140642Z-product-engineer-reldef-memoria-bichos-release-scope.handoff.json`.

## 1. Problema

O tauan-games precisa de um novo jogo infantil leve, cognitivo e imediatamente jogavel
para Tauan: **Memoria dos Bichos**, um jogo standalone de memoria com cartas de
animais, feito para criancas de 5 a 8 anos jogarem por clique ou toque, sem leitura
obrigatoria e sem configuracao.

Hoje o catalogo cobre jogos de reflexo, voo, combate espacial e corrida. Falta um jogo
curto de reconhecimento visual e lembranca de posicoes. Esta release deve criar esse
espaco sem reaproveitar codigo, mapas, veiculos, assets ou logica de outros jogos.

## 2. Escopo escolhido

### Backlog consumido

| Item | Decisao | Cobertura |
|------|---------|-----------|
| `memoria-bichos-v1` | Picked e consumido integralmente | Requisitos R-01 a R-12 |

### Bugs escolhidos

Nenhum bug foi escolhido para esta release. Os bugs abertos revisados pertencem a Aero
Strike, Space War, Corrida ou superficies de workflow/intake; nenhum se aplica a um
jogo de memoria que ainda nao existe.

### Auditorias escolhidas

Nenhum achado de auditoria foi escolhido para esta release.

## 3. Requisitos

- **R-01 — Jogo standalone:** criar Memoria dos Bichos como jogo web em pasta propria,
  isolado de `tauan-trex/`, `aero-fighters/`, `space-war/`, `corrida/` e
  `aero-fighters-v2/`. O compartilhamento permitido se limita a infraestrutura
  transversal do repo, como `tests/`, `package.json` e bibliotecas ja vendoradas se
  necessarias.
- **R-02 — Runtime estatico e offline:** o jogo deve rodar por `index.html` +
  HTML/CSS/JS estatico, sem build step, sem servidor proprio, sem CDN e sem chamadas
  de rede em runtime. O mesmo artefato deve funcionar em servidor estatico local e em
  GitHub Pages.
- **R-03 — Stack Vanilla:** implementar a experiencia em Vanilla HTML/CSS/JS. Nao
  introduzir nova engine, bundler, TypeScript, backend, storage remoto ou dependencia
  runtime externa para este jogo.
- **R-04 — Primeira tela infantil:** a primeira tela deve apresentar o jogo de forma
  visual e permitir escolher ou iniciar os 3 niveis sem exigir leitura para entender a
  acao principal.
- **R-05 — Niveis fixos:** entregar exatamente estes niveis selecionaveis: 6 cartas
  com 3 pares, 12 cartas com 6 pares, e 20 cartas com 10 pares.
- **R-06 — Grade inicial fechada:** ao iniciar um nivel, todas as cartas comecam
  viradas para baixo, em uma grade legivel para a quantidade de cartas do nivel.
- **R-07 — Jogada de duas cartas:** o jogador vira exatamente 2 cartas por jogada.
  Enquanto o feedback de uma jogada esta em andamento, novas cartas nao podem quebrar
  o par em avaliacao nem abrir uma terceira carta.
- **R-08 — Pares corretos:** cartas iguais permanecem abertas com feedback alegre de
  animacao e som sintetizado/local. O feedback nao pode depender de audio: cada par
  correto deve aplicar estado visual persistente de carta encontrada e tambem disparar
  um sinal visual temporario verificavel por pelo menos 600 ms, como pulso, brilho,
  marcador de celebracao ou equivalente.
- **R-09 — Pares incorretos:** cartas diferentes devem mostrar feedback curto e virar
  de volta apos um intervalo mensuravel: as duas cartas incorretas ficam visiveis por
  pelo menos 650 ms apos a segunda virada e devem estar fechadas novamente ate 1200 ms,
  sem travar a partida nem esconder a resposta instantaneamente.
- **R-10 — Animais grandes e legiveis:** cada carta deve exibir um animal grande por
  emoji, desenho procedural ou asset local criado para o jogo. O visual deve ser
  colorido, amigavel e legivel para criancas de 5 a 8 anos.
- **R-11 — Tentativas, vitoria e estrelas:** o contador de tentativas aumenta uma vez
  por par de cartas revelado. A vitoria ocorre somente quando todos os pares do nivel
  ficam abertos. A tela final mostra avaliacao por estrelas conforme tentativas usando
  a formula fixa abaixo e oferece acoes claras para jogar novamente ou trocar de nivel:
  3 estrelas quando `tentativas <= pares`; 2 estrelas quando `tentativas <=
  ceil(pares * 1.5)`; 1 estrela acima disso. Assim, os niveis esperam: 6 cartas/3
  pares = 3 estrelas ate 3 tentativas, 2 estrelas ate 5, 1 estrela a partir de 6; 12
  cartas/6 pares = 3 ate 6, 2 ate 9, 1 a partir de 10; 20 cartas/10 pares = 3 ate 10,
  2 ate 15, 1 a partir de 16.
- **R-12 — README do jogo:** o jogo deve ter README proprio com como rodar localmente,
  objetivo, niveis e controles por clique/toque.

## 4. Acceptance Criteria

- **AC-01 (boot offline):** o jogo abre em servidor estatico local sem erro de console,
  sem request de rede externa e sem build step. Evidencia: smoke Playwright do jogo.
- **AC-02 (link no catalogo):** existe pagina propria do jogo e ela e acessivel pelo
  index/catalogo principal do repo. Evidencia: teste ou revisao de link navegavel para
  a subpasta do jogo.
- **AC-03 (selecao de nivel):** a primeira tela permite iniciar os niveis de 6, 12 e
  20 cartas; cada escolha cria a quantidade correta de cartas e pares.
- **AC-04 (interacao clique/toque):** uma partida pode ser jogada por ponteiro
  (clique/touch) sem teclado obrigatorio. Evidencia: Playwright aciona cartas por
  eventos de ponteiro.
- **AC-05 (duas cartas por jogada):** durante uma jogada, no maximo 2 cartas ficam
  abertas para avaliacao antes de resolver match/mismatch; uma terceira interacao
  durante o bloqueio nao corrompe o estado.
- **AC-06 (match persistente):** quando duas cartas iguais sao reveladas, elas ficam
  abertas ate o fim da partida, o contador de pares encontrados aumenta, ambas recebem
  estado visual persistente de carta encontrada e um sinal visual nao-audio permanece
  detectavel por pelo menos 600 ms apos o match.
- **AC-07 (mismatch retorna):** quando duas cartas diferentes sao reveladas, o contador
  de tentativas aumenta uma vez, as cartas ficam visiveis por pelo menos 650 ms apos a
  segunda virada e estao fechadas novamente ate 1200 ms.
- **AC-08 (vitoria e estrelas):** ao encontrar todos os pares de um nivel, o jogo entra
  em estado final, oferece acoes claras para repetir ou trocar de nivel, e mostra a
  quantidade de estrelas definida por R-11 para partidas deterministicamente montadas
  com tentativas conhecidas. Exemplos obrigatorios de validacao: 6 cartas/3 pares com 3
  tentativas resulta em 3 estrelas; 6 cartas/3 pares com 5 tentativas resulta em 2
  estrelas; 6 cartas/3 pares com 6 ou mais tentativas resulta em 1 estrela.
- **AC-09 (partida deterministica):** a suite Playwright consegue iniciar uma partida
  com ordem deterministica em modo de teste, revelar um par, validar um erro e concluir
  uma partida pequena sem depender de sorte.
- **AC-10 (standalone):** nenhum arquivo do novo jogo importa modulo de outro jogo ou
  depende de assets/codigo de Aero Strike, Space War, Corrida ou Tauan T-Rex. Evidencia:
  revisao de imports/paths e smoke passando com dependencias permitidas.
- **AC-11 (qualidade Tauan):** nao ha tela de loading visivel, erro de console,
  controle essencial escondido em texto obrigatorio, nem layout ilegivel nas grades de
  6, 12 ou 20 cartas. Evidencia: smoke + revisao de UX antes da review humana.
- **AC-12 (README):** o README do jogo existe e cobre como rodar localmente, objetivo,
  niveis e controles. Evidencia: check automatizado de existencia + revisao de conteudo.

## 5. Nao-escopo

- Multiplayer, placar online, login, persistencia remota ou analytics.
- Campanha, desbloqueios, loja, colecao de cartas ou progressao permanente.
- Dependencias de CDN, assets remotos, backend, service worker obrigatorio ou PWA.
- Reaproveitamento de mapas, veiculos, mundo, logica de jogo ou assets de Aero Strike,
  Space War, Corrida ou Tauan T-Rex.
- Alteracoes de gameplay em jogos existentes. O index/catalogo pode ser atualizado
  apenas para expor o novo jogo.
- Suporte a leitor de tela completo nesta release; a exigencia aqui e nao depender de
  leitura para jogar, com controles simples e feedback visual claro.

## 6. Sanitizacao e exclusoes

| Item | Resultado | Motivo |
|------|-----------|--------|
| Bugs Aero Strike/Inhauma | Deferidos | Pertencem a outro jogo e nao afetam Memoria dos Bichos. |
| Bugs Space War | Deferidos | Pertencem a outro jogo e outra linha de produto. |
| Bugs Corrida/workflow | Deferidos | Pertencem a release ou superficie distinta. |
| `corrida-primeiro-jogavel-v1` | Excluido | Ja representa outro novo jogo e outro release. |
| Backlogs Space War ativos/deferidos | Deferidos | Outro jogo e outro objetivo de produto. |
| Backlogs Aero Strike ativos/historicos | Deferidos | Outro jogo; nao devem contaminar esta release. |
| `agent-orchestration`, `backlog-future`, `candidates`, `ideas` | Excluidos | Superficies de planejamento/referencia, nao itens escolhidos. |

Nao ha links de subsuncao: nenhum bug escolhido foi coberto por backlog escolhido.

## 7. Conformidade

- **Constituicao:** respeita projetos independentes, simplicidade primeiro e README
  obrigatorio por jogo.
- **Arquitetura:** Memoria dos Bichos entra como jogo isolado em pasta propria, sem
  dependencia horizontal de outros jogos; compartilha apenas infraestrutura transversal.
- **Tech stack:** mantem `index.html` + HTML/CSS/JS estatico, sem build step, sem rede
  em runtime e com operacao compativel com GitHub Pages.
- **Identidade do produto:** atende Tauan e criancas de 5 a 8 anos com sessao curta,
  controles por clique/toque e feedback visual claro.
- **Quality bar:** exige boot sem erro, operacao offline, smoke Playwright e ausencia
  de regressao nos jogos existentes antes de fechar a release.

## 8. Traceability

| Origem | Requisitos | Acceptance Criteria |
|--------|------------|---------------------|
| `memoria-bichos-v1`: jogo standalone/offline | R-01, R-02, R-03, R-12 | AC-01, AC-02, AC-10, AC-12 |
| `memoria-bichos-v1`: 3 niveis | R-04, R-05, R-06 | AC-03, AC-11 |
| `memoria-bichos-v1`: virar 2 cartas | R-07, R-08, R-09 | AC-04, AC-05, AC-06, AC-07, AC-09 |
| `memoria-bichos-v1`: animais e feedback infantil | R-08, R-10, R-11 | AC-06, AC-08, AC-11 |
| Memory `architecture.md` | R-01 | AC-10 |
| Memory `tech-stack.md` | R-02, R-03 | AC-01 |
| Memory `overview.md` + `quality-bar.md` | R-04, R-10, R-11 | AC-01, AC-04, AC-08, AC-11 |

## 9. Write set esperado para PLAN/TASKS

O PLAN deve detalhar e restringir o write set antes da implementacao. A expectativa de
produto para esta release e:

- pasta propria do novo jogo, a ser nomeada no PLAN;
- `index.html` ou catalogo principal do repo somente para linkar o jogo;
- `tests/memoria-bichos/**` ou arquivo equivalente na suite Playwright compartilhada;
- `package.json` apenas se necessario para script de teste;
- `specs/releases/memoria-bichos-v1/**`.

Arquivos de outros jogos ficam proibidos para esta release.
