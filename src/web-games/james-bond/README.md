# James Bond - Operações

FPS 3D de espionagem para browser, inspirado na estrutura de missões dos shooters de
1997 e no Counter-Strike 1.6, adaptado para controles de PC. Cenário, efeitos e áudio
são procedurais e originais; os inimigos usam modelos animados CC0 do Quaternius
vendorizados em `vendor/models/enemies/` (ver `vendor/models/LICENSES.md`). Nenhum
asset do GoldenEye 007 é incluído.

Cada operação tem **dois andares**: mezaninos com parapeito maciço, ligados ao térreo
por escadarias sólidas em diagonal — anda-se até o topo, sem escalada nem tecla
especial. As posições elevadas servem de ninho de sniper (o parapeito bate na cintura).

Cada mapa passa por uma **auditoria automática** que varre os dois andares com a
física real e prova, a cada rodada de teste, que: não existe ponto onde o jogador
fique preso ou dentro de geometria; todo objetivo, a extração e o mezanino inteiro
são alcançáveis; cada escadaria sobe e desce andando; e todo volume de colisão tem
geometria visível e opaca — nada sólido é invisível, nada invisível é sólido.

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
| Olhar / atirar / mirar | Mouse / botão esquerdo / botão direito |
| Selecionar arma | 1-5, Q ou roda do mouse |
| Recarregar (3s) | E ou R — **automático quando o pente zera** |
| Interagir com objetivos | F |
| Pular / agachar | Espaço / Shift — o pulo vence parapeitos e obstáculos baixos (é a saída da torre) |
| Subir/descer | Andar pela escadaria (degraus vencidos automaticamente) |
| Granada rápida (infinita) | G |
| Mapa tático (inimigos no radar, canto inferior direito) | M |
| Pausa | Esc |

## Modo criança

A caixa **MODO CRIANÇA** no menu prende a mira num cone estreito à frente
(24° para baixo, 16° para cima) e deixa o mouse mais lento. Serve para quem ainda
está aprendendo a usar o mouse não acabar olhando para o chão ou para o céu — nem
mesmo o coice da AK-47 tira a mira do cone. A preferência fica salva.

## Arsenal (5 slots, inspirado em CS 1.6)

| Slot | Arma | Munição | Notas |
|---|---|---|---|
| 1 | **Faca** | infinita | Golpe de curto alcance (2,4 m), quase silencioso. |
| 2 | **Desert Eagle** | 7 por pente, reserva infinita | Recarga 3s (automática ao zerar), dano pesado. |
| 3 | **AK-47** | 30 por pente, reserva infinita | Recarga 3s (automática ao zerar), automática. |
| 4 | **Lança-granadas** | infinita | 1 tiro a cada 2s; o foguete é visível em voo e detona no impacto. |
| 5 | **Granada de mão** | infinita | Arremesso com pavio de ~2s. |

Lança-granadas e granada compartilham a mesma explosão em camadas: clarão, bola de
fogo que esfria de amarelo a vermelho, anel de choque, pluma de fumaça e estilhaços.

## Inimigos por operação

Todos animados por esqueleto (andar/correr/atacar/levar dano/morrer), com passos e
vocalização própria por espécie sintetizados em Web Audio.

- **OP-01 Barragem Alpina** — humanos armados (fogo em rajadas com tempo de reação).
- **OP-02 Complexo Químico** — vampiros: rápidos, ataque corpo a corpo.
- **OP-03 Relay Congelado** — fantasmas brancos translúcidos que flutuam e não sangram.
- **OP-04 Silo de Mísseis** — monstros brutos: lentos, muito resistentes, sem flinch.
- **OP-05 Fragata Sequestrada** — demônios: rápidos e fortes.
- **OP-06 Controle na Selva** — **dinossauros**: matilha de velociraptores mais um
  **T-Rex** como chefe único (5,5x de vida, passo que treme o chão).

Tiros empurram o inimigo para trás com impulso acumulativo — três tiros de AK-47 ou
Desert Eagle projetam o corpo, com sangue direcional e poça no chão ao cair. Bichos
grandes resistem mais ao empurrão; o chefe quase não recua.

## Reforços de asa-delta

Cada operação repõe as perdas a uma taxa de 5 inimigos por minuto (até o teto de
16 vivos). O reforço não aparece do nada: **entra no mapa voando de asa-delta**,
vindo da direção da borda, e pousa depois de ~5 s de planeio. Em voo ele já está
vivo e pode ser alvejado — um tiro certeiro no piloto deixa o corpo planando até
o chão.

Trilha de suspense procedural (drone menor + batimento) toca durante a operação.

## Stack

- Three.js r165, local em `vendor/`.
- Colisão AABB determinística para o grid, sem compilação WASM no carregamento.
- Yuka 0.7.8 para grafo de navegação e A* dos guardas.
- GLTFLoader vendorizado para os inimigos animados; os GLBs são carregados do disco
  local no boot (sem rede em runtime) e clonados com rebind de esqueleto.
- Áudio: Web Audio puro (síntese, sem samples/Howler — nenhuma dependência de mixer
  carregada e nunca usada).

## Renderização e estabilidade

- Materiais PBR e texturas procedurais 512px (concreto, reboco, piso industrial) por missão.
- Céu atmosférico, iluminação por missão, lanterna tática (camada 0) e fill suave no view model (camada 1).
- Arsenal com view models detalhados, tracers, decals de impacto, sangue, recuo com recuperação e mira (ADS) com zoom de FOV.
- Guardas com silhueta tática, fogo em rajadas com tempo de reação, tracers e animação de queda.
- Mapas mobiliados com engradados, tambores, estantes, terminais acesos, luminárias,
  canos e quadros de parede — tudo instanciado (uma draw call por tipo de prop) e
  gerado em canvas, sem imagem externa.
- Segundo andar por missão: lajes pisáveis, parapeito maciço (desenho e colisor com
  o mesmo volume) e escadarias externas à laje, maciças do chão ao topo. A física
  distingue LAJE FLUTUANTE (passa-se por baixo) de MACIÇO (não se entra) pela base do
  volume — é o que impede entrar dentro da escada. Inimigos navegam por nível: guarda
  de mezanino só pisa em laje, e a laje bloqueia visão entre andares.
- Paredes contíguas usam colisores mesclados; o preview é reaproveitado no deploy.
- GPUs por software desligam MSAA e sombras e usam materiais leves; a resolução nunca é reduzida abaixo de 1.25x do pixel ratio.
- A qualidade entra automaticamente no modo compatível quando o FPS sustentado cai (ou force com `?quality=high|compatibility`).

Execute a partir da raiz do repositório com um servidor estático e abra
`/src/web-games/james-bond/`. O estado de teste está disponível em `window.game`.
