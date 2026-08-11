# James Bond - Operações

FPS 3D de espionagem para browser, inspirado na estrutura de missões dos shooters de
1997 e adaptado para controles de PC. Todo conteúdo visual e sonoro é procedural e
original; nenhum asset do jogo GoldenEye 007 é incluído.

## Operações

1. Barragem Alpina
2. Complexo Químico
3. Relay Congelado
4. Silo de Mísseis
5. Fragata Sequestrada
6. Controle na Selva

## Controles

| Ação | Controle |
|---|---|
| Mover | WASD |
| Olhar | Mouse |
| Atirar / mirar | Clique esquerdo / direito |
| Recarregar / interagir | R / E |
| Correr / agachar | Shift / C |
| Armas | 1-5 ou roda do mouse |
| Granada / mina remota | G / Q |
| Mapa tático | M |
| Pausa | Esc |

## Stack

- Three.js r165, local em `vendor/`.
- Colisão AABB determinística para o grid, sem compilação WASM no carregamento.
- Yuka 0.7.8 para grafo de navegação e A* dos guardas.
- Howler 2.2.4 vendorizado para evolução do mixer; a v1 sintetiza áudio original por
  Web Audio para operar sem samples.

## Renderização e estabilidade

- Materiais PBR e texturas procedurais distintas para metal, concreto, piso e neve.
- Céu atmosférico, iluminação por missão, lanterna tática e props instanciados.
- Paredes contíguas usam colisores mesclados; o preview é reaproveitado no deploy.
- GPUs por software usam materiais leves, 55% da resolução, 30 Hz e nenhuma sombra.
- A qualidade entra automaticamente no modo compatível quando o FPS sustentado cai.

Execute a partir da raiz do repositório com um servidor estático e abra
`/src/web-games/james-bond/`. O estado de teste está disponível em `window.game`.
