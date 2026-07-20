// Web game package: james-bond.
const map = (...rows) => rows;

export const MISSIONS = [
  {
    code: 'OP-01', title: 'BARRAGEM ALPINA', location: 'Montes Orlov, 05:40',
    brief: 'Intercepte os dados da instalação e alcance a crista da barragem.',
    palette: { sky: 0x7f98a0, fog: 0x72868a, wall: 0x687477, floor: 0x4c5958, accent: 0xf1bc58 },
    objectives: { A: 'Copiar dados de vigilância', B: 'Instalar relay clandestino', C: 'Desativar alarme da barragem' },
    grid: map(
      '#########################', '#S....G......#..........#', '#.#####.####.#.#####.##.#',
      '#.....#....#.#..X..#....#', '###.#.####.#.#####.####.#', '#...#....#.#...A.#....#.#',
      '#.######.#.#####.####.#.#', '#......#.#.....#....#.#.#', '#.####.#.#####.####.#.#.#',
      '#.#..#.#..B..#....#.#...#', '#.#.##.#####.####.#.###.#', '#...G......#....C.#...G.#',
      '#.########.###########..#', '#......................E#', '#########################'),
  },
  {
    code: 'OP-02', title: 'COMPLEXO QUÍMICO', location: 'Setor industrial K-7, 23:10',
    brief: 'Encontre o contato, sabote a linha e saia antes da detonação.',
    palette: { sky: 0x17221d, fog: 0x1e2b25, wall: 0x657168, floor: 0x303a34, accent: 0x50e29a },
    objectives: { A: 'Encontrar o informante', B: 'Plantar cargas na linha', C: 'Recuperar o dossiê químico' },
    grid: map(
      '#########################', '#S#.....#...G.....#.....#', '#.#.###.#.#######.#.###.#',
      '#...#A#.#.....X.#.#...#.#', '#####.#.#####.#.#.###.#.#', '#.....#.....#.#.#.....#.#',
      '#.#########.#.#.#######.#', '#...G.....#.#.#.....G...#', '#.#######.#.#.#########.#',
      '#.#.....#.#...#...B...#.#', '#.#.###.#.#####.#####.#.#', '#...#C..#.....#.....#...#',
      '###.#########.#####.###.#', '#......................E#', '#########################'),
  },
  {
    code: 'OP-03', title: 'RELAY CONGELADO', location: 'Círculo polar, 02:25',
    brief: 'Corte as comunicações e copie a chave criptográfica do bunker.',
    palette: { sky: 0x9fb9c7, fog: 0xb8c9ce, wall: 0x81949b, floor: 0xced9da, accent: 0x3b7b95 },
    objectives: { A: 'Desligar antena primária', B: 'Fotografar tela de controle', C: 'Copiar chave criptográfica' },
    grid: map(
      '#########################', '#S...........#..........#', '#..G...###...#..G..###..#',
      '#.......A#......X..B#...#', '#..###.#.#.#######.#.##.#', '#....#.#.#.......#.#....#',
      '####.#.#.#######.#.####.#', '#....#.#....G..#.#......#', '#.####.######..#.######.#',
      '#......#....#..#......#.#', '#.######.##.##########..#', '#...G....#C............E#',
      '#.#####################.#', '#.......................#', '#########################'),
  },
  {
    code: 'OP-04', title: 'SILO DE MÍSSEIS', location: 'Planície de Karak, 18:50',
    brief: 'Documente os lançadores, arme as cargas e escape do silo.',
    palette: { sky: 0x2a211d, fog: 0x3b2e28, wall: 0x74675c, floor: 0x433b35, accent: 0xee5b55 },
    objectives: { A: 'Fotografar ogivas', B: 'Coletar cartões de lançamento', C: 'Armar cargas do silo' },
    grid: map(
      '#########################', '#S..#.....#.....#.....#.#', '#.#.#.###.#.###.#.###.#.#',
      '#.#...#A#...#X#...#B#...#', '#.#####.#####.#####.###.#', '#.....#.....#.....#.....#',
      '#####.#####.#.###.#####.#', '#G....#..G..#...#...G...#', '#.#####.#######.#######.#',
      '#.....#.....#...#.....#.#', '#.###.#####.#.###.###.#.#', '#.#C#.......#.....#...#.#',
      '#.#.#################.#.#', '#.....................#E#', '#########################'),
  },
  {
    code: 'OP-05', title: 'FRAGATA SEQUESTRADA', location: 'Mar de Ligúria, 21:15',
    brief: 'Desarme os explosivos, liberte a tripulação e marque o helicóptero.',
    palette: { sky: 0x35536a, fog: 0x315064, wall: 0x6e7c83, floor: 0x343f44, accent: 0x56bde4 },
    objectives: { A: 'Desarmar carga da proa', B: 'Libertar tripulação', C: 'Marcar helicóptero furtivo' },
    grid: map(
      '#########################', '#S......................#', '#.#####.###########.###.#',
      '#.#A..#.....G.....#...#.#', '#.#.#.###########.###.#.#', '#...#.....#X#.....#...#.#',
      '###.#####.#.#.#####.###.#', '#...#..G..#.#..G..#.....#', '#.###.#####.#####.#####.#',
      '#.#...#B........#.....#.#', '#.#.###########.#.###.#.#', '#...#.....C.....#...#...#',
      '#.###.#############.###.#', '#......................E#', '#########################'),
  },
  {
    code: 'OP-06', title: 'CONTROLE NA SELVA', location: 'Vale de Santa Aurelia, 04:05',
    brief: 'Invada a central, proteja a técnica e destrua o núcleo de controle.',
    palette: { sky: 0x274131, fog: 0x304c39, wall: 0x5b695d, floor: 0x263229, accent: 0xe6a04b },
    objectives: { A: 'Neutralizar comandante de elite', B: 'Proteger hack do sistema', C: 'Destruir núcleo de controle' },
    grid: map(
      '#########################', '#S.....#.....G.....#....#', '#.###..#.#########.#.##.#',
      '#...#..#.#.......#.#....#', '###.####.#.##A##.#.####.#', '#...G........X...#....G.#',
      '#.########.#####.######.#', '#......#...#B..#.#......#', '#.####.#.#####.#.#.####.#',
      '#.#....#...G...#.#....#.#', '#.#.###########.####.#..#', '#.#.........C........#..#',
      '#.####################..#', '#......................E#', '#########################'),
  },
];
