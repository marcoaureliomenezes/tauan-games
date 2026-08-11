# Demolition Ball — Opus 5

Jogo 3D de demolição: você opera um trator-guindaste com bola de demolição de
4,2 toneladas numa cidade com trânsito e cumpre contratos de destruição que
chegam um atrás do outro.

**Sem engine.** Nada de Godot, nada de Three.js, nada de Babylon, nenhuma
biblioteca de física, nenhum asset externo. O renderer WebGL2, o motor de
física, a destruição volumétrica e o áudio foram escritos do zero neste
diretório. Abrir `index.html` num servidor estático é tudo o que é preciso.

## Como jogar

| Tecla | Ação |
|---|---|
| `W` `A` `S` `D` | dirigir o trator de esteiras |
| `Q` / `E` | girar a lança (slew) |
| `R` / `F` | elevar / baixar a lança |
| `Z` / `X` | encurtar / soltar cabo |
| `ESPAÇO` | **a bola busca o alvo** (servo de velocidade rumo à estrutura do contrato; sem alvo, o carro mais próximo) |
| `SHIFT` | impulso reverso (freia ou inverte o balanço) |
| `C` | chama a **equipe de isolamento** (a ≤30 m do alvo; também botão na tela) |
| `M` | abre / fecha o mapa da cidade |
| `V` | alterna câmera (trator / bola) |
| `N` | muta o áudio |
| arrastar mouse | orbitar a câmera · roda do mouse = zoom |

A bola **não** é um cursor: é uma massa presa a um cabo inextensível. Para
derrubar algo você precisa **construir o balanço** — acelerar, girar a lança,
soltar cabo — e acertar a estrutura no ponto mais baixo do arco, onde a
velocidade (e portanto a energia cinética) é máxima. Com `ESPAÇO`, um servo
de aceleração limitada embala o pêndulo em direção ao alvo — a lança (`Q/E`)
e o cabo (`Z/X`) continuam 100% manuais.

## Modos (v0.9.0)

Na tela inicial:

- **🧒 Modo Tauan** (padrão) — sem prazo, sem multa por dano colateral, um alvo
  por vez, threshold 50%, dano ×2,5 e homing mais forte. Só demolir.
- **💼 Modo Contratos** — o jogo original: prazos, multa por dano colateral,
  salário e os thresholds de cada contrato.

## Cidade viva (v0.9.0)

Fachadas com janelas/portas por tipo de prédio, praças com árvores e canteiros
de flores, um **rio de verdade com 3 pontes** (o trator só cruza por elas),
pedestres que fogem da bola (e nunca se ferem), carros em 3 modelos com faróis,
céu de manhã com nuvens procedurais (`snoise`, único vendor do jogo) e a
**equipe de isolamento**: perto do alvo, chame pelo botão 🚧 (ou `C`) — um
furgão chega, um ajudante cerca o quarteirão de cones e o trânsito para de
entrar até o alvo cair.

## Mecânica

**Pêndulo.** A bola é um ponto de massa sob gravidade e arrasto, restrito à
distância do cabo a partir da ponta da lança. O cabo só *puxa*: quando a
distância excede o comprimento, a posição é projetada de volta e apenas a
componente radial *de afastamento* da velocidade relativa à ponta é removida.
Como a ponta se move junto com a máquina, dirigir e girar bombeiam o pêndulo —
igual à máquina real. A tensão do cabo é devolvida ao chassi, então um balanço
pesado puxa o trator visivelmente. A integração roda em sub-passos fixos de
12,5 ms, então o comportamento não muda com o frame rate.

**Destruição.** Cada estrutura é uma malha de células de 2,5 m, cada uma com
vida própria (mais resistente embaixo, mais frágil em cima). No impacto,
E = ½mv² é convertida em orçamento de dano e gasta nas células mais próximas
do ponto de contato primeiro, com atenuação — a bola abre um cone, não uma
esfera perfeita. A energia gasta quebrando concreto **sai da bola**: um golpe
que destrói muito para o balanço.

**Colapso estrutural.** Depois de cada impacto, um flood-fill a partir do
térreo marca todas as células que ainda têm caminho de carga até o chão. O que
perdeu o caminho **cai** — vira escombro rígido com rotação, quica e assenta.
Cortar a base derruba o prédio inteiro sozinho, que é exatamente a técnica que
o jogo recompensa.

**Cidade e trânsito.** 7×7 quarteirões gerados por PRNG determinístico
(mesma cidade a cada partida), com centro adensado de torres, praças, casas,
galpões e silos. Os carros andam no grafo de ruas, mantêm a mão direita, fazem
fila, freiam pelo trator — e são arremessados se a bola pegá-los.

**Contratos.** Seis missões em cadeia, cada uma escolhida da cidade gerada,
com alvos, meta de percentual, prazo e pagamento. Dano em estrutura que não é
alvo vira **multa por dano colateral** descontada do pagamento.

## Arquitetura

```
src/
  math.js         vetores, quaternions, matrizes, PRNG determinístico
  gl.js           wrapper WebGL2 (programas, VAOs, instancing, shadow map)
  shaders.js      GLSL: GGX + ambiente hemisférico + PCF + fog + tonemap ACES
  geometry.js     primitivas procedurais (cubo/esfera/cilindro) + malha estática
  renderer.js     passes: céu → shadow map → sólidos instanciados → partículas
  city.js         geração da cidade + estruturas voxelizadas + índice espacial
  destruction.js  impacto → dano por energia → colapso por perda de sustentação
  debris.js       escombros rígidos, poeira e faíscas
  rig.js          trator, lança, e o pêndulo da bola de demolição
  traffic.js      carros no grafo de ruas
  missions.js     cadeia de contratos, prazos, pagamento e multa colateral
  minimap.js      mapa 2D (canto ou expandido)
  audio.js        motor diesel, impactos, desabamento — WebAudio sintetizado
  main.js         input, câmera, HUD e loop
```

O mundo inteiro é desenhado com **3 draw calls instanciados** (caixa, esfera,
cilindro) mais o chão estático, o céu e as partículas — milhares de blocos de
concreto por quadro sem custo de CPU por objeto.

## Testes

```bash
cd src/web-games
node tests/demolition-ball-opus-5/unit.mjs                        # simulação pura
TEST_PORT=8177 npx playwright test tests/demolition-ball-opus-5/ \
  --config=tests/playwright.config.js                             # E2E no browser
```
