// Web game package: james-bond.
//
// A CAMPANHA — seis quarteirões, não seis labirintos.
//
// A primeira geração destes mapas era corredor de uma célula: paredes lisas,
// bifurcações cegas, nenhuma leitura de lugar. O desenho atual segue o modelo
// urbano de Medal of Honor (Allied Assault / Frontline): rua larga com calçada
// dos dois lados, quarteirões de construções em que SE ENTRA, becos ligando os
// fundos, e a rua entulhada de carcaças de carro, escombros e barricadas.
//
// A herança do labirinto não foi jogada fora — ela ficou onde funciona: DENTRO
// das construções, em divisórias com vão único que obrigam a limpar cômodo por
// cômodo, e nos becos entre os quarteirões.
//
// O momento assinatura de Medal of Honor está montado em todo mapa: entrar
// numa construção, subir ao mezanino e atirar de cima sobre a barricada da rua.
// Por isso dois prédios de cada mapa são SALÕES com laje (`upper`), sempre
// virados para a via principal.
//
// Vocabulário de tile: ver content/tiles.js. Resumo:
//   #  fachada        n  fachada com janela   +  vão de porta
//   .  piso interno   =  asfalto              ,  calçada
//   c  carro destruído  u  escombro   b  barricada   t  poste
//   S  início  E  extração  G  inimigo  A/B/C  objetivos  X  barril explosivo
//
// `enemyMix` dá a cada missão DUAS espécies, com peso — nunca uma só. Ver
// TYPE_STATS em ai/guards.js para o que cada nome significa em cor e andar.
//
// F3 — reforço contínuo: cada missão declara `spawnRate` (reforços por
// minuto) e `maxAlive` (teto de vivos simultâneos). A guarnição inicial (os
// tiles `G` do grid + `upper.guards`) já soma 16 em toda missão hoje — o
// spawner só REPÕE quem morre até o teto, nunca eleva a contagem acima dele.
// Vitória continua 100% por objetivo (ver gameplay/mission-rules.js);
// spawning é pressão constante, não condição de fim de jogo. Ver
// gameplay/spawner.js para o modelo puro (agendamento + escolha de célula).
const map = (...rows) => rows;

export const MISSIONS = [
  {
    code: 'OP-01', title: 'BARRAGEM ALPINA', location: 'Vila de Orlov, sob a barragem, 05:40',
    enemyMix: { human: 3, wraith: 2 }, spawnRate: 5, maxAlive: 16,
    brief: 'Atravesse a vila, recupere os dados da instalação e alcance a crista da barragem.',
    palette: { sky: 0x7f98a0, fog: 0x72868a, wall: 0x8a8177, floor: 0x565b58, accent: 0xf1bc58 },
    objectives: { A: 'Copiar dados de vigilância', B: 'Instalar relay clandestino', C: 'Desativar alarme da barragem' },
    upper: { slabs: [[13, 2, 19, 6], [16, 14, 21, 18]], stairs: [[12, 4], [15, 16]], guards: [[14, 2], [19, 6], [17, 14], [21, 18]] },
    // M1 — telhado sobre o mezanino de entrada (sub-retângulo, escada nasce
    // na própria laje). M2 — torre de vigia na calçada norte da rua. M3 —
    // esgoto ligando 3 bocas de visita sob a rua principal.
    roof: { slabs: [[13, 4, 19, 6]], stairs: [[16, 3]] },
    tower: { base: [6, 8], door: [0, 1] },
    underground: { slabs: [[5, 9, 14, 9]], entrances: [[4, 9], [15, 9], [9, 8]] },
    grid: map('#################################',
      '##n#n#n##,#n#n#n#n#n#,,#n#n#n#n##',
      '#n...#..n,n.........n,,n...#...n#',
      '##...#..#,#.........#,,#...#...##',
      '#n..A...n,+.........n,,n...C...n#',
      '##...#G.#,#.........#,,#....G..##',
      '#n......n,n......G..n,,n.......n#',
      '##n#n+n##,#n#n#+#n#n#,,#n#n+n#n##',
      '#,,t,,,,,,,,,,,,,t,,,,,,,,,,t,,,#',
      '#,=G========u=G===========c==G=,#',
      '#,S====c===X===b====G===X=====E,#',
      '#,=======G=========c===u=G=====,#',
      '#,,,,,,,,t,,,,,,,,,,,t,,,,,,,,,,#',
      '##n#n+n#n##,,#n#n+n#n##,,#n#+#n##',
      '#n........n,,n........n,,n.....n#',
      '##........#,,#......G.#,,#.....##',
      '#n##.#####n,,+........n,,n##.##n#',
      '##..G.....#,,#.....B..#,,#...G.##',
      '#n........n,,n........n,,n.....n#',
      '##n#n#n#n##,,#n#n#n#n##,,#n#n#n##',
      '#################################'),
  },
  {
    code: 'OP-02', title: 'COMPLEXO QUÍMICO', location: 'Distrito industrial K-7, 23:10',
    enemyMix: { vampire: 3, ghoul: 3 }, spawnRate: 5, maxAlive: 16,
    brief: 'Encontre o contato nos galpões, sabote a linha e saia antes da detonação.',
    palette: { sky: 0x17221d, fog: 0x1e2b25, wall: 0x6b7168, floor: 0x363a34, accent: 0x50e29a },
    objectives: { A: 'Encontrar o informante', B: 'Plantar cargas na linha', C: 'Recuperar o dossiê químico' },
    upper: { slabs: [[15, 2, 20, 5], [14, 13, 20, 18]], stairs: [[14, 3], [13, 15]], guards: [[16, 2], [20, 5], [15, 13], [20, 18]] },
    roof: { slabs: [[17, 2, 20, 5]], stairs: [[16, 3]] },
    tower: { base: [5, 8], door: [0, 1] },
    underground: { slabs: [[4, 9, 12, 9]], entrances: [[3, 9], [13, 9], [8, 8]] },
    grid: map('#################################',
      '##n#n#n#n#,,#n#n#n#n##,,#n#n#n###',
      '#n...#...n,,n........n,,n......n#',
      '##.A...G.#,,+........#,,#...C..##',
      '#n...#...n,,n......G.n,,n###.##n#',
      '##.......#,,#........#,,#......##',
      '##n#n+n#n#,,#n#n+n#n##,,n....G.n#',
      '#,,,,,,,,,,,,,,,,,,,,,,,#......##',
      '#,========t======u==G==,#n#+#n###',
      '#,==G=====c=G==X=======,,b,,,,,,#',
      '#,S==========b========c====G===,#',
      '#,====u===,,,,,,,,,G,,,===X==u=,#',
      '#,=t===G==,#n#n#+#n#n#,t======E,#',
      '#,,,,,,,,,,n.........n,,,,,,,,,,#',
      '##n#+#n##,,#.........#,,#n#+#n###',
      '#n......n,,n.........n,,n......n#',
      '##..#...#,,#.........+,,#......##',
      '#n.G....n,,n..B...G..n,,n###G##n#',
      '##..#...#,,#.........#,,#......##',
      '##n#n#n##,,#n#n#n#n#n#,,#n#n#n###',
      '#################################'),
  },
  {
    code: 'OP-03', title: 'RELAY CONGELADO', location: 'Povoado polar de Vetrny, 02:25',
    enemyMix: { phantom: 3, brute: 2 }, spawnRate: 5, maxAlive: 16,
    brief: 'Corte as comunicações do povoado e copie a chave criptográfica do bunker.',
    palette: { sky: 0x9fb9c7, fog: 0xb8c9ce, wall: 0x93a1a7, floor: 0xc6d1d2, accent: 0x3b7b95 },
    objectives: { A: 'Desligar antena primária', B: 'Fotografar tela de controle', C: 'Copiar chave criptográfica' },
    upper: { slabs: [[13, 2, 18, 6], [18, 14, 23, 18]], stairs: [[12, 4], [17, 16]], guards: [[14, 2], [18, 6], [19, 14], [23, 18]] },
    roof: { slabs: [[15, 2, 18, 6]], stairs: [[14, 4]] },
    tower: { base: [14, 12], door: [0, -1] },
    underground: { slabs: [[4, 9, 24, 9]], entrances: [[3, 9], [25, 9], [14, 8]] },
    grid: map('#################################',
      '##n#n#n#,,#n#n#n#n##,,#n#n#n#n###',
      '#n.....n,,n........n,,n........n#',
      '##.A...#,,#........#,,#.....C..##',
      '#n#.###n,,n.....G..+,,+.###.###n#',
      '##.....#,,#........#,,#......G.##',
      '#n.G...n,,n........n,,n........n#',
      '##.....#,,#n#n+n#n##,,#........##',
      '##n#+#n#,,,,,,,,,,,,,,#n#n+n#n###',
      '#,,,,,,,,t===u====G==,,,X,,,,G,,#',
      '#,==G===============c========tE,#',
      '#,S=====c==X====b======G====c==,#',
      '#,===uG=====G=,,,,,,,t,,,u,,,,,,#',
      '#,============,#n#n+n#n##,,#n+n##',
      '#,,,,,,,,,,,,,,n........n,,n...n#',
      '##n#n#+#n#n##,,#........#,,#...##',
      '#n..........n,,n........n,,n...n#',
      '##..G.......#,,#.G....B.#,,#.G.##',
      '#n....#.....n,,n........n,,n...n#',
      '##n#n#n#n#n##,,#n#n#n#n##,,#n#n##',
      '#################################'),
  },
  {
    code: 'OP-04', title: 'SILO DE MÍSSEIS', location: 'Base de Karak, praça central, 18:50',
    enemyMix: { brute: 2, demon: 3 }, spawnRate: 5, maxAlive: 16,
    brief: 'Documente os lançadores, arme as cargas e escape da base pelo portão leste.',
    palette: { sky: 0x2a211d, fog: 0x3b2e28, wall: 0x7d6f63, floor: 0x4a413a, accent: 0xee5b55 },
    objectives: { A: 'Fotografar ogivas', B: 'Coletar cartões de lançamento', C: 'Armar cargas do silo' },
    upper: { slabs: [[15, 2, 19, 4], [12, 17, 17, 18]], stairs: [[14, 3], [11, 17]], guards: [[16, 2], [19, 4], [13, 17], [17, 18]] },
    roof: { slabs: [[17, 2, 19, 4]], stairs: [[16, 3]] },
    tower: { base: [25, 8], door: [0, -1] },
    underground: { slabs: [[4, 9, 10, 9]], entrances: [[3, 9], [11, 9], [7, 8]] },
    grid: map('#################################',
      '##n#n#n#n#,,#n#n#n#n#,,#n#n#n#n##',
      '#n...#...n,,n.......n,,n...#.G.n#',
      '##.A...G.#,,#....BG.#,,+...#...##',
      '#n.......n,,n.......n,,n.....C.n#',
      '##n#n+n#n#,,#n#n+n#n#,,#.......##',
      '#,,,,,,,,,,,,,,,,,,,,,,#n#n+n#n##',
      '#,,,,,,,t=============t,,,,,,,,,#',
      '##n#n##,==c=============u,,,G,E,#',
      '#n....n,========c========,#n#n###',
      '##...G#,====X=======b====,n....n#',
      '#n#G#.+,===G===========G=,#....##',
      '##....#,u====b===G=======,+.#.#n#',
      '#n....n,==============c==,#....##',
      '##n#n##,========G========,n....n#',
      '#,,,,,,,t,,,,,,,,,,u=====X#n#n###',
      '#,======,#n#n+n#n##,t,,,G,,,,,,,#',
      '#,=====G,n........n,,#n#n#+#n#n##',
      '#,=S====,#........#,,n.........n#',
      '#,,,,,,,,#n#n#n#n##,,#n#n#n#n#n##',
      '#################################'),
  },
  {
    code: 'OP-05', title: 'DOCA SEQUESTRADA', location: 'Porto de Ligúria, cais 4, 21:15',
    enemyMix: { demon: 3, witch: 2 }, spawnRate: 5, maxAlive: 16,
    brief: 'Desarme os explosivos do cais, liberte a tripulação e marque o helicóptero.',
    palette: { sky: 0x35536a, fog: 0x315064, wall: 0x78838a, floor: 0x3c464b, accent: 0x56bde4 },
    objectives: { A: 'Desarmar carga do armazém', B: 'Libertar tripulação', C: 'Marcar helicóptero furtivo' },
    upper: { slabs: [[16, 2, 20, 6], [15, 14, 21, 18]], stairs: [[15, 4], [14, 16]], guards: [[17, 2], [20, 6], [16, 14], [21, 18]] },
    roof: { slabs: [[16, 4, 20, 6]], stairs: [[18, 3]] },
    tower: { base: [6, 8], door: [0, 1] },
    underground: { slabs: [[6, 9, 18, 9]], entrances: [[5, 9], [19, 9], [12, 8]] },
    grid: map('#################################',
      '##n#n#n#n##,,#n#n#n#n#,,#n#n#n###',
      '#n....#...n,,n.......n,,n..#...n#',
      '##.A..#...+,,#....G..#,,#..#.G.##',
      '#n...G....n,,n.......n,,n....C.n#',
      '##....#...#,,#.......#,,#..#...##',
      '#n........n,,n.......n,,n......n#',
      '##n#n#+#n##,,#n#n+n#n#,,#n#+#n###',
      '#,,,,,,,,,,t,,,,,,,,,,,t,,,,,,,,#',
      '#,=u===G====G==u=======c==X===E,#',
      '#,S========c======G======G==b==,#',
      '#,==G=c======X=====b====t,,,,G,,#',
      '#,,,,,,,,,t,,,,,,,,,,,,,u#n#+#n##',
      '##n#n+n#n#,,#n#n#+#n#n#,,n.....n#',
      '#n.......n,,n.........n,,#.....##',
      '##.......#,,#.......G.#,,n.....n#',
      '#n#.#####n,,+.........n,,####.###',
      '##.G.....#,,#..B......#,,n..G..n#',
      '#n.......n,,n.........n,,#.....##',
      '##n#n#n#n#,,#n#n#n#n#n#,,#n#n#n##',
      '#################################'),
  },
  {
    code: 'OP-06', title: 'POVOADO NA SELVA', location: 'Santa Aurelia, praça da igreja, 04:05',
    enemyMix: { raptor: 5, trex: 1 }, spawnRate: 5, maxAlive: 16,
    brief: 'Tome o povoado, proteja a técnica e destrua o núcleo de controle na central.',
    palette: { sky: 0x274131, fog: 0x304c39, wall: 0x6a7360, floor: 0x2f3a2e, accent: 0xe6a04b },
    objectives: { A: 'Neutralizar comandante de elite', B: 'Proteger hack do sistema', C: 'Destruir núcleo de controle' },
    upper: { slabs: [[14, 2, 18, 7], [13, 15, 19, 18]], stairs: [[13, 4], [12, 16]], guards: [[15, 2], [18, 7], [14, 15], [19, 18]] },
    roof: { slabs: [[14, 4, 18, 7]], stairs: [[16, 3]] },
    tower: { base: [22, 8], door: [0, 1] },
    underground: { slabs: [[4, 9, 10, 9]], entrances: [[3, 9], [11, 9], [7, 8]] },
    grid: map('#################################',
      '##n#n#n##,,#n#n#n#n#,,#n#n#n#n###',
      '#n..#...n,,n.......n,,n...#....n#',
      '##.A..G.#,,#.....G.#,,#...#.C..##',
      '#n..#...n,,+.......n,,n......G.n#',
      '##......#,,#.......#,,#........##',
      '##n#+#n##,,n.......n,,#n#n+n#n###',
      '#,,,,,,,,t,#.......#,t,,,,,,,,,,#',
      '#,========,#n#n+n#n#,=========E,#',
      '#,===u====,,,,,,,,,,b===X=G=u==,#',
      '#,S=G====c===G===u====t,,,,,,,,,#',
      '#,,,,,,,t=====X====G==,#n#+#n#n##',
      '##n#+#G#,===u========c,n.......n#',
      '#n.....n,b,,,,,,,G,,,,,#.......##',
      '##.....#,,#n#n#+#n#n#,,n.......n#',
      '#n.....n,,n.........n,,+.##.#####',
      '###G####,,#.........#,,n.......n#',
      '#n.....n,,n..B....G.+,,#.....G.##',
      '##.....#,,#.........#,,n.......n#',
      '##n#n#n#,,#n#n#n#n#n#,,#n#n#n#n##',
      '#################################'),
  },
];
