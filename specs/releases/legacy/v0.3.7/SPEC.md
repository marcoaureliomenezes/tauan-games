# SPEC — v0.3.7

- Status: [x] Aprovado (operador, 2026-07-19)
- Release: `v0.3.7`
- Supersede: `far-west-godot-v1` (draft removido — o jogo mudou de nome)
- Referência comportamental: `src/web-games/bang-bag/` (web, Three.js — inventário auditado em 2026-07-18)
- Consolida e eleva: `v0.3.1`, `v0.3.2`, `v0.3.3`

## 1. Visão

Reconstruir **Bang-Bag** (ex-far-west) em **Godot 4.7**, com paridade funcional do
jogo web E correção definitiva das falhas graves reportadas pelo operador na versão
web: personagem deformado em 2 componentes, visões ruins, mapa/cenário fraco
("estilo Minecraft"), trem sem detalhe, trajetória de projéteis e mira imperfeitas.

**Doutrina da release:** usar o **ecossistema Godot e componentes de terceiros
confiáveis** (Terrain3D, ProtonScatter, packs CC0) — **não reinventar a roda**.
O que era código bespoke frágil na web vira componente maduro no Godot.

**Jogo em uma frase:** cowboy sempre montado em mundo aberto do Velho Oeste
caçando 5 bandidos foragidos, com caça para comida, acampamento base, 2 cidades,
2 aldeias indígenas hostis e uma ferrovia com trem cruzando o mapa.

**Convivência:** o jogo web só será deletado quando a versão Godot estiver
operacional e aprovada pelo operador (paridade desta SPEC).

## 2. Personagem — UM componente (a falha nº 1 da web)

| ID | Requisito |
|---|---|
| P-01 | **Um único modelo skinned "homem-a-cavalo"**: cavalo + cela + cowboy (com chapéu) compartilhando UM esqueleto e UMA malha de personagem. PROIBIDA a montagem de 2 componentes independentes (cavalo + homem separados) que gerou o "homem deformado" da web |
| P-02 | Rig com: ossos de locomoção do cavalo + ossos do tronco/braços/cabeça do cowboy; camada de animação de MIRA — o braço da arma aponta para onde a câmera mira (pitch), o tronco acompanha levemente o yaw relativo |
| P-03 | Detalhe de produção: sela modelada com arreios, cowboy com chapéu, coldre e casaco; cavalo com crina/rabo e materiais corretos (sem anomalias de material da web) |
| P-04 | Animações: idle, passo, trote, galope (com impulso de câmera sutil), salto, mira (braço armado), disparo (recuo), rendição dos bandidos, morte de animais/NPCs |
| P-05 | **1ª pessoa**: câmera nos olhos do cowboy — vê as mãos/rédeas, a cabeça do cavalo e o braço ao atirar. **3ª pessoa**: câmera atrás e acima do cowboy (spring arm com colisão). Toggle [V] instantâneo |
| P-06 | Aceitação VISUAL: screenshots de referência (frente/lado/trás/3⁄4 × idle/passo/galope/mira nas 2 câmeras) aprovados pelo operador — sem pose quebrada, sem clipping, sem membro deformado |

## 3. Controles — estilo Counter-Strike 1.6

| Tecla | Ação |
|---|---|
| W / S | cavalo para frente / para trás (marcha-ré lenta) |
| A / D | virar à esquerda / à direita (giro do cavalo) |
| Shift | galope (drena estamina) |
| Space | salto do cavalo (~1,6 m, só do chão) |
| Mouse | **mira independente** — câmera/arma livres do rumo do cavalo |
| LMB | disparo da arma atual |
| R | recarga (revólver) |
| 1 / 2 (ou Q) | troca de arma: 1 = revólver, 2 = espingarda 12 |
| F | mira precisa (zoom leve, só revólver) |
| E | interação (capturar bandido, pegar/entregar caça) |
| M | mapa fullscreen · V câmera · Esc libera o mouse/pausa |

Movimento e mira são **desacoplados**: o cavalo obedece às teclas; a câmera e a
arma obedecem ao mouse — sem o cavalo "seguir a câmera" automaticamente.

## 4. Armas

| Arma | Especificação |
|---|---|
| **Revólver** | hitscan preciso; tambor de **8 balas**; recarga **infinita** de **3,0 s**; dano 34; alcance 220 m; tracer + flash de boca; mira↔impacto <0,5 m a 30 m (teste obrigatório, parado e no galope lateral) |
| **Espingarda 12 (escopeta)** | **munição infinita, sem recarga**; **6–8 pelotes por disparo em cone** — a dispersão dos pelotes forma um raio de impacto que **cresce com a distância** (perto = concentrado, longe = leque); dano por pelote (ex.: 12) com queda por distância; alcance útil ~35 m; cadência ~0,9 s; fumaça do cano |

A trajetória de TODOS os projéteis/pelotes sai da câmera (centro da tela) — nunca
do quadril do modelo (bug da web: mira e impacto divergiam).

## 5. Mundo e cenário — o salto de qualidade

| ID | Requisito |
|---|---|
| M-01 | Terreno 2048×2048 m via **Terrain3D** (GDExtension, MIT) — clipmap LOD, 32 texturas, splatting, colisão nativa. **Proibido look "Minecraft"** (chunks visíveis, degraus, baixa densidade) |
| M-02 | Layout geral preservado (referência da web): vale central navegável, anel de montanhas com viés norte, 2 rios descendo a 1 lago, neve no alto; seed fixa (layout determinístico) |
| M-03 | **Florestas com DESIGN**: 3+ espécies de árvore (pinheiro, folhosa seca, folhosa verde) com variação de escala/rotação/tinta via **ProtonScatter**; clareiras, bosques densos nas encostas, capim e arbustos no vale; nada de distribuição uniforme artificial |
| M-04 | Rios com leito escavado no terreno, água com shader (fluxo, espuma em vaus, reflexo no lago); vaus ≤1,2 m atravessáveis (−45% velocidade), trechos profundos bloqueiam; 2 pontes de madeira detalhadas |
| M-05 | Céu dia/noite (600 s), sol com sombras, névoa atmosférica por horário; pôr-do-sol quente |
| M-06 | **Ferrovia de produção**: trilhos com dormentes e lastro, curvas suaves; **trem detalhado** (locomotiva a vapor com chaminé/fumaça, 3 vagões) cruzando o mapa em loop a 12 m/s com apito; passagem de nível sinalizada |
| M-07 | Assentamentos com acabamento: 2 cidades (rua principal com fachadas nomeadas — saloon, banco, hotel, armazém, xerife — com falso-front, cartazes, tambores, carroça circulando, 4 NPCs passeando); 2 aldeias indígenas (5 tendas, totem, fogueira); acampamento do jogador (fogueira animada, tenda, caixotes) |

## 6. Gameplay (paridade com a web + fechamento de loop)

- **Cavalo**: passo 2,2 / trote 6,0 / galope 14,0 m/s; estamina 100 (galope 22/s, regen 9/s, trava até 25); inclinação ao declive; salto 1,6 m; colisão com árvores/rochas/construções (push-out + deslize).
- **Vida/comida**: HP 100; comida 100 drenando 0,14/s; fome zero → −1 HP/s; caça de veados (3 bandos de 4–6; 1 tiro abate; [E] carrega; entrega na fogueira → +40 comida); acampamento cura +5 HP/s e (só revólver) mantém recarga pronta.
- **Perigos**: 12 cobras (bote ≤2,5 m, 8 de dano); arqueiros das aldeias (8/aldeia, aggro <40 m, flechas balísticas 6 de dano); 4 águias ambientais.
- **Bandidos**: 5, em regiões ≥200 m, fogem <50 m; 1 tiro → rendição; [E] ≤4 m → captura; contador HUD n/5.
- **MORTE (novo, obrigatório)**: HP → 0 ⇒ tela de game over ⇒ respawn no acampamento com revólver carregado e comida em 50. (Na web, nada acontecia.)
- **VITÓRIA (novo, obrigatório)**: 5/5 capturados ⇒ tela de vitória + opção de continuar no mundo. (Na web, nada acontecia.)

## 7. HUD, mapa e áudio

HUD (HP/STA/COMIDA, arma atual + munição, contador de bandidos, prompt [E], flash de dano, indicador de carcaça); mapa fullscreen [M] com relevo e marcadores vivos; minimapa circular; áudio: casco por andadura, disparos distintos por arma, recarga, flechas, fogueira, trem, vento — via buses Godot com atenuação por distância.

## 8. Requisitos técnicos

- **Godot 4.7.1** (instalado no ambiente), GDScript, projeto em `src/godot/bang-bag/`.
- Componentes de terceiros permitidos (e preferidos): **Terrain3D** (MIT, TokisanGames), **ProtonScatter** (MIT, HungryProton), packs CC0 **Quaternius/Kenney** (já vendorados em `src/web-games/vendor/models/`, reaproveitáveis), Waterways ou shader de água maduro para rios/lago.
- **Reaproveitamento da web** (auditado): layout do mundo e parâmetros (seed, gaits, números de combate/sobrevivência — SPEC far-west-godot-v1 §2–7), GLBs CC0 vendorados, contrato conceitual `heightAt/normalAt`.
- Offline absoluto em runtime; sem novos sistemas (economia, missões, diálogo, clima, save, multiplayer, modo a pé) — paridade + qualidade, não escopo novo.
- QA: testes de lógica headless (godot --headless) + **protocolo de screenshots de aceitação visual** (personagem, florestas, rios, trem, cidades) revisado pelo operador antes do fechamento.

## 9. Critérios de aceitação (resumo)

1. Boot sem erros; mundo Terrain3D com layout do §5 (vale, montanhas, rios, lago, neve).
2. Personagem único aprovado nos screenshots do P-06 (2 câmeras × 4 poses).
3. Controles CS: WASD move, mouse mira independente; troca de arma 1/2.
4. Revólver 8 balas/3 s infinita com mira↔impacto <0,5 m/30 m; espingarda com leque crescente por distância e infinita.
5. Florestas com 3+ espécies e agrupamento natural; rios com vaus/pontes; trem detalhado com fumaça e apito.
6. Morte → respawn; 5/5 → tela de vitória.
7. Zero interpenetração do cavaleiro; colisão do cavalo sem travar (empurrar 5 s contra rocha ⇒ sem penetração).
8. Suite headless verde + screenshots de cenário aprovados pelo operador.

## 10. Fora de escopo

Multiplayer, save, economia, missões, diálogo, clima, modo a pé/desmontar, interiores, export web (desktop primeiro; HTML5 em release futura se pedido).
