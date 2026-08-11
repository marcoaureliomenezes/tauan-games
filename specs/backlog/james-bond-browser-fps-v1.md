---
title: James Bond - FPS de espionagem para browser inspirado em GoldenEye 007
status: idea
opened: 2026-07-18
release: james-bond-browser-fps-v1
description: "Novo FPS 3D standalone e offline para browser, com controles WASD + mouse, campanha por missões, furtividade, IA por percepção, arsenal variado, explosões, áudio espacial e mapas originais inspirados na estrutura de GoldenEye 007 (N64)."
---

# James Bond - FPS de espionagem para browser

## Demanda do operador

Criar `src/web-games/james-bond/`, um FPS jogável no browser baseado na experiência de
**GoldenEye 007** (Nintendo 64, 1997): mapas e fases com missões, tipos de armas
distintos, inimigos que investigam ruídos e acionam alarmes, explosões, impactos de
tiro, passos, sonoplastia espacial e mapa/radar para localizar ameaças. A movimentação
deve seguir o padrão de PC popularizado por Counter-Strike 1.6: WASD e mouse look.

O resultado deve ser um jogo completo e confiável, não uma cena técnica. Cada fase
precisa ter briefing, objetivos verificáveis, condição de falha, extração, vitória e
desbloqueio da próxima missão.

## Limite autoral e identidade

Mecânicas, ritmo, categorias de armas e arquétipos de mapa podem servir de referência.
Não serão copiados ROM, código, geometria exata, modelos, texturas, interface, música,
vozes, efeitos sonoros, logotipos ou likenesses do jogo de 1997. Os mapas serão
originais, com topologia e pacing análogos, sem traçado 1:1.

`src/web-games/james-bond/` permanece o codinome e nome local pedido pelo operador. Antes de publicar
no GitHub Pages, título visível, história, personagens, facções e nomes das armas devem
ser originais, salvo se o operador fornecer licença de uso da propriedade James Bond.

## Pesquisa - mecânicas essenciais

- **FPS orientado a missões:** não basta chegar ao fim. O jogador precisa cumprir
  objetivos como instalar dispositivo, fotografar equipamento, recuperar documento,
  resgatar refém, desarmar bomba, proteger aliado e destruir instalação.
- **Três dificuldades:** Agent, Secret Agent e 00 Agent. Dificuldades superiores
  acrescentam objetivos, removem parte de armadura/munição e tornam os guardas mais
  rápidos, atentos e precisos; não serão apenas multiplicadores de HP.
- **Furtividade baseada em som:** calibre, supressor, número de disparos em uma janela
  curta, distância, portas e paredes determinam quem escuta. Tiros isolados e
  silenciosos favorecem precisão; rajadas ruidosas atraem grupos e reforços.
- **Dano localizado:** cabeça, tronco, braços e pernas têm multiplicadores e reações
  distintas. Acertar braço interrompe a mira; perna reduz movimento; cabeça recompensa
  precisão. A reação nunca pode travar a máquina de estados.
- **Combate legível:** armas de fogo são hitscan; granadas, foguetes e minas usam
  projéteis/corpos físicos. Penetração depende da arma e do material.
- **Cenários destrutíveis:** vidro, caixas, monitores, barris e painéis possuem estados
  de dano; explosivos próximos podem produzir reação em cadeia limitada.
- **Layouts memoráveis:** aproximações exteriores, corredores apertados, portas de
  segurança, atalhos, loops, mirantes, rotas alternativas e salas opcionais. Portas
  também separam visibilidade, som e navegação da IA.

## Referências de mapas e fases

O catálogo original pesquisado tem 20 estágios: Dam, Facility, Runway, Surface 1,
Bunker 1, Silo, Frigate, Surface 2, Bunker 2, Statue, Archives, Streets, Depot, Train,
Jungle, Control, Caverns, Cradle, Aztec e Egyptian. Eles serão usados como catálogo de
arquétipos, não como malhas copiadas.

### Campanha inicial recomendada - seis missões originais

1. **Barragem Alpina:** vale guardado, torres, túnel de serviço e crista da barragem.
   Interceptar dados, instalar relay secreto, desligar alarmes e alcançar a extração.
2. **Complexo Químico:** entrada por ventilação, banheiros, laboratórios, envase e
   sala de tanques. Encontrar informante, obter dossiê, plantar cargas, preservar
   civis e escapar antes da detonação.
3. **Relay Congelado:** campo de neve, cabanas, antena e bunker subterrâneo. Desligar
   comunicações, fotografar tela, copiar chave criptográfica e exfiltrar.
4. **Silo de Mísseis:** salas circulares empilhadas e corredores estreitos. Fotografar
   hardware, coletar cartões, plantar explosivos e escapar de contagem regressiva.
5. **Fragata Sequestrada:** convés, casa de máquinas, ponte e heliponto. Desarmar
   cargas, libertar reféns, marcar helicóptero e retornar ao barco de extração.
6. **Controle na Selva:** infiltração por mata até central de dois níveis. Derrotar
   rival de elite, proteger técnica durante hack, destruir consoles e escapar por
   cavernas até a plataforma de antena.

Fases posteriores podem reinterpretar cidade/parque de estátuas, arquivo, depósito,
trem, plataforma suspensa e templo. Prometer 20 mapas polidos em uma única release é
incompatível com o objetivo de jogo livre de bugs; o schema, porém, nasce expansível.

### Contrato de mapa

Cada mapa declara em dados: geometria modular, navmesh, zonas acústicas, portas,
materiais, props destrutíveis, grupos de spawn, patrulhas, pontos de cobertura,
objetivos, itens-chave, checkpoints, extração, briefing, overrides de dificuldade e
seed determinística. Deve existir uma rota principal, uma rota furtiva e ao menos um
atalho de risco/recompensa, todos orientados por landmarks visuais.

## Armas

### Catálogo original pesquisado - referência nominal

PP7, PP7 silenciada, DD44 Dostovei, Klobb, KF7 Soviet, ZMG 9mm, D5K Deutsche,
D5K silenciada, Phantom, US AR33, RC-P90, Sniper Rifle, Cougar Magnum, Shotgun,
Automatic Shotgun, Grenade Launcher, Rocket Launcher, Hand Grenade, Timed Mine,
Proximity Mine, Remote Mine, Golden Gun, Silver PP7, Gold PP7, Moonraker Laser,
facas de arremesso, luta desarmada e canhão de tanque.

### Arsenal v1 com nomes originais

- Pistola de serviço, pistola com supressor e pistola pesada.
- SMG compacta e SMG com supressor.
- Fuzil de assalto, rifle de precisão semiautomático e PDW de alta cadência.
- Escopeta pump-action.
- Granada, lança-granadas e lança-foguetes.
- Mina remota e mina de proximidade.
- Combate corpo a corpo.

Cada definição registra munição, carregador, cadência, dano por zona, falloff,
dispersão, recoil, recuperação, penetração, raio de ruído, supressão, recarga,
animações, projétil/explosão e banco de sons. Balanceamento usa papéis distintos, sem
uma arma universalmente melhor.

## IA dos inimigos

Yuka fornecerá entidades, memória/percepção, steering e navmesh. A lógica do jogo usa
uma máquina híbrida de estados e objetivos:

`idle -> patrol -> suspicious -> investigate -> alert -> take-cover/engage/flank ->
pursue -> search-last-known-position -> return-to-post`, com transições adicionais
para `operate-alarm`, `retreat` e `surrender`.

A percepção combina cone de visão, line of sight por raycast, exposição à luz, memória
recente, alerta de companheiros, portas, ruído de arma/impacto, passos por superfície e
rede de alarmes. Guardas usam atraso de reação e erro de mira limitado; nunca têm mira
perfeita instantânea. O pathfinding possui detecção de travamento, novo planejamento e
telemetria acessível aos testes.

A dificuldade altera latência de percepção, disciplina de rajada, precisão,
coordenação, orçamento de reforços, armadura/munição no mapa e objetivos exigidos.

## Tiros, impactos e explosões

- Raycast hitscan com decal, poeira/faísca/lasca por material, tracer probabilístico,
  cápsula ejetada, muzzle flash e luz curta. Todos os transientes usam pools.
- Classes de superfície: concreto, metal, vidro, madeira, terra, água, corpo e armadura.
- Explosão em estágios: flash, fireball, fumaça/poeira expansiva, fragmentos, marca de
  queimado, shockwave, impulso de câmera e abafamento auditivo curto.
- Dano radial usa falloff e oclusão por line of sight. Fragmentos têm orçamento fixo
  de rays por explosão, preservando determinismo e frame time.
- Granadas quicam e podem ser preparadas; foguetes seguem trajetória com rastro;
  minas temporizadas, remotas e de proximidade compartilham um modelo de gatilho.
- Reações em cadeia são enfileiradas e limitadas por frame, evitando recursão e picos.

## Sonoplastia e radar

Nenhum áudio do GoldenEye será reutilizado. Serão usados sons sintetizados em Web Audio
ou gravações CC0/licença permissiva vendorizadas com manifesto de origem e licença.

- Cada arma tem 6-9 variações de disparo ou camadas com pitch/envelope controlado,
  ação mecânica, cauda interna/externa, perfil suprimido, recarga e dry fire.
- Passos são posicionais e variam por concreto, metal, madeira, terra e água, além de
  pé esquerdo/direito, velocidade e postura.
- Alarmes, portas, impactos, detritos, explosões, ambiente e sinais de inimigo usam
  áudio espacial; portas/paredes fechadas aplicam oclusão e abafamento.
- Zonas leves de reverb diferenciam exterior, corredor, sala grande, silo e caverna.
- Um orçamento fixo de vozes prioriza tiros, passos próximos, alarmes e objetivos.

O minimapa não será wallhack permanente: mostra objetivos e câmeras marcadas; inimigos
aparecem dentro do alcance do sensor, após dispararem ou enquanto rastreados por um
gadget. `M` abre mapa tático maior com objetivos, última posição conhecida e extração.

## Stack recomendada

| Componente | Licença | Responsabilidade |
|---|---|---|
| Three.js r165 | MIT | render 3D, raycast, instancing, loaders, PointerLockControls |
| Rapier JavaScript 3D | Apache-2.0 | colisão, capsule controller, slopes/escadas, granadas e debris |
| Yuka | MIT | FSM/goals, percepção/memória, steering, grafos e navmesh |
| Howler.js 2.2.x | MIT | áudio confiável, sprites de áudio e reprodução espacial |
| three-mesh-bvh (opcional) | MIT | acelerar raycasts somente se profiling demonstrar gargalo |

As versões e browser builds serão fixadas em `vendor/` com checksums e licenças. Não
haverá bundler, TypeScript, CDN ou request externo em runtime. A release-definition
deve validar o custo do WASM do Rapier e o tamanho total antes da aprovação.

## Arquitetura e controles

`src/web-games/james-bond/src/` separa foundation (`config`, `state`, `random`, `time`), adapters
(`render`, `physics`, `ai`, `audio`), world/maps, player/weapons, enemies, missions,
FX, HUD e `main` orquestrador. Módulos ficam abaixo de 250 linhas ou são divididos por
responsabilidade. `window.game` expõe um contrato estável de teste.

Controles: WASD mover, mouse olhar, clique esquerdo atirar, clique direito mirar,
`R` recarregar, `E` interagir, `Shift` correr, `C` agachar, `1-5` trocar arma,
`G` granada, `M` mapa, `Esc` pausar/destravar mouse.

A simulação usa timestep fixo, interpolação visual, random seedado, object pools e
limites para inimigos, decals, luzes, partículas e vozes. O jogo pausa ao perder
pointer lock. Progresso e opções usam `localStorage` versionado.

## Acceptance criteria

- `src/web-games/james-bond/` abre por servidor estático e GitHub Pages, sem build, CDN, request
  externo ou erro de console; licença e checksum cobrem todo vendor/asset novo.
- WASD + mouse oferecem movimentação FPS com colisão, escadas, rampas, crouch, sprint,
  pointer lock, pause e sensibilidade configurável, sem atravessar paredes.
- A campanha contém seis missões originais descritas neste item, cada uma com briefing,
  pelo menos três objetivos, falhas, extração, resultado e desbloqueio da próxima.
- Agent, Secret Agent e 00 Agent mudam objetivos, recursos e comportamento da IA.
- O arsenal v1 implementa todos os papéis declarados, com recarga, recoil, dispersão,
  dano localizado, penetração/impacto, ruído e seleção por slots.
- Inimigos patrulham, enxergam, escutam, investigam, alertam aliados, operam alarmes,
  usam cobertura, perseguem, buscam a última posição e retornam sem ficar presos.
- Granadas, foguetes e minas produzem explosão ocluída, fragmentos limitados, FX
  poolados, reação em cadeia limitada e resposta de áudio/câmera.
- Passos e armas possuem variação e espacialização; portas/paredes abafam; o mixer
  respeita orçamento de vozes e desbloqueio de áudio por gesto do browser.
- Minimapa e mapa tático mostram objetivos, extração e inimigos apenas pelas regras de
  sensor/ruído/rastreamento, nunca como wallhack constante.
- Há save versionado de campanha e opções, com migração/reset seguro de schema inválido.
- Simulações determinísticas cobrem weapon timing/damage, objetivos, percepção, som,
  transições da IA, pathfinding, alarmes, explosões e save.
- Playwright cobre boot, canvas não vazio, desktop e viewport menor, pointer lock,
  WASD/mouse, tiro/recarga, resposta inimiga, objetivo, transição de fase, áudio,
  ausência de requests externos e ausência de sobreposição incoerente no HUD.
- Alvo de performance: 60 FPS em 1080p e nunca abaixo de 30 FPS no hardware de
  referência; qualidade adaptativa reduz sombras, partículas, decals, luzes e vozes.
- Single-player é o único modo da v1; multiplayer fica explicitamente fora do escopo.

## Fontes pesquisadas

- Visão geral e design: https://en.wikipedia.org/wiki/GoldenEye_007
- Manual original: https://www.videogamemanual.com/n64/GoldenEye%20007%20%28USA%29.pdf
- Catálogo e tours dos mapas: https://goldeneyedepot.com/levels
- Catálogo e estatísticas das armas: https://goldeneyedepot.com/weapons
- Retrospectiva de IA e audição: https://arstechnica.com/gaming/2022/07/book-excerpt-anti-game-design-and-the-making-of-goldeneye-007/
- Dano localizado e design: https://www.gamedeveloper.com/design/15-year-anniversary-retrospective-goldeneye-007-n64-1997-
- PointerLockControls: https://threejs.org/docs/pages/PointerLockControls.html
- PositionalAudio: https://threejs.org/docs/pages/PositionalAudio.html
- Rapier character controller: https://rapier.rs/docs/user_guides/javascript/character_controller/
- Yuka AI e navegação: https://mugen87.github.io/yuka/
- Howler e áudio espacial: https://howlerjs.com/

## Decisões abertas para release-definition

- Promover este item para `candidate` e vincular intents somente após o fechamento de
  `far-west-open-world-v1`, que hoje reserva as mesmas âncoras de catálogo e stack.
- Confirmar o título e a ficção originais antes de qualquer publicação pública.
- Confirmar o corte inicial recomendado de seis missões completas; se o risco de prazo
  for dominante, entregar três primeiro e manter as outras três na release seguinte.
- Validar versões, licenças, inicialização WASM e tamanho vendorizado de Rapier, Yuka e
  Howler antes de aprovar SPEC/PLAN/TASKS.
