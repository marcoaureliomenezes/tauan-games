# Tauan T-Rex

Um clone aprimorado do Chrome Dino, personalizado para o Tauan. Pule cactos, abaixe sob pterodactilos e veja ate onde voce consegue chegar.

## Como rodar

Abra `index.html` em qualquer navegador moderno. Nao ha build step, nao precisa de servidor.

> Dica: para rodar via servidor estatico local (recomendado pelos testes), execute na raiz do repositorio:
> ```bash
> python3 -m http.server 8080
> ```
> Depois abra `http://localhost:8080/tauan-trex/index.html`.

## Controles

| Acao | Tecla | Touch |
|---|---|---|
| Iniciar / Pular | `Espaco` ou `Seta para cima` | Toque rapido na tela |
| Abaixar | `Seta para baixo` (segurar) | Segurar a tela (>200ms) |
| Mutar / Desmutar audio | `M` | — |
| Reiniciar apos game over | `Espaco` | Toque na tela |

## Mecanicas

- Velocidade inicial: 6 px/frame, aumenta 0.5 a cada 300 pontos (limite 18).
- Pterodactilos so aparecem apos 300 pontos.
- A cada 700 pontos o cenario alterna entre dia e noite.
- A cada 100 pontos toca um som curto de marco.
- Recorde salvo em `localStorage` (chave `tauan-hiscore`).

## Requisitos

- Navegador moderno (Chrome, Firefox, Edge, Safari) com JavaScript habilitado.
- Phaser 3.60 e carregado de `../vendor/phaser.min.js` (ja incluido no repositorio). Nao requer internet em runtime.

## Arquivos

```
tauan-trex/
├── index.html   # carrega Phaser do vendor local + game.js
├── game.js      # logica completa do jogo (Phaser.GameObjects.Graphics)
└── README.md    # este arquivo
```
