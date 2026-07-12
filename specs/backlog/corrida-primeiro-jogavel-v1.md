---
title: Corrida primeiro jogavel browser-first
status: candidate
opened: 2026-07-12
release: corrida-v0.1.0
description: Criar o primeiro jogavel de corrida 2D top-down para Tauan, standalone e publicavel via GitHub Pages, usando Phaser Arcade conforme a demanda de produto.
intents:
  - subject:
      kind: catalog
      ref: games-catalog
    change: "Adicionar Corrida como novo jogo web standalone do tauan-games: loop leve de corrida 2D top-down, uma pista autoral com voltas cronometradas, controles simples de acelerar/frear/esterçar e 3 adversarios com IA simples."
  - subject:
      kind: doc
      ref: memory/architecture.md#Camadas
    change: "Manter Corrida como jogo isolado de Degrau 1/Phaser em pasta propria, sem dependencia horizontal de tauan-trex, aero-fighters/Aero Strike ou space-war."
  - subject:
      kind: doc
      ref: memory/tech-stack.md#Princípios de stack
    change: "Entregar Corrida como index.html + JS estatico, sem build step, sem rede em runtime, com biblioteca vendorada/local e deploy compativel com GitHub Pages."
---

# Corrida primeiro jogavel

## Description

Criar o primeiro jogavel `corrida-v0.1.0`: um jogo de corrida browser-first para Tauan,
em 2D top-down com Phaser Arcade, controles simples e uma corrida curta com voltas
cronometradas. O jogo deve ser standalone, publicado como subpasta propria do repo, sem
reaproveitar estradas, carros, mapas ou assets do Aero Strike.

## Motivation

O tauan-games precisa de um novo jogo leve e imediatamente jogavel para Tauan, diferente
dos jogos existentes. Corrida deve ocupar o espaco de jogo 2D arcade simples: sessao
curta, objetivo claro, feedback visual rapido e controles descobertos em segundos.

Evidencia usada: a demanda do operador fixa o primeiro jogavel `corrida-v0.1.0`,
Phaser Arcade, 2D top-down, uma pista, voltas cronometradas, 3 adversarios com IA
simples, standalone e publicavel via GitHub Pages. Nenhum artefato `research-corrida`
foi encontrado no repo; por isso a recomendacao de Phaser Arcade e tratada aqui como
restricao ja decidida pela demanda, nao como novo achado.

## Acceptance criteria

- O jogo abre direto no browser por GitHub Pages e por servidor estatico local, sem build
  step e sem chamadas de rede em runtime.
- A primeira tela ja e jogavel: jogador ve carro, pista, HUD basico e pode iniciar a
  corrida sem configuracao.
- Controles de teclado cobrem acelerar, frear/re e esterçar para esquerda/direita; eles
  devem funcionar no desktop e ser simples o bastante para Tauan descobrir em segundos.
- A pista e autoral e standalone: nao reutiliza estradas, carros, mapas, splines,
  texturas procedurais ou logica de mundo do Aero Strike.
- A corrida tem uma pista fechada com linha de largada/chegada, contador de voltas e
  cronometro por volta e total.
- Existem 3 adversarios controlados por IA simples, capazes de completar voltas seguindo
  a pista sem travar em comportamento obvio.
- O jogo possui condicao clara de fim de corrida e ranking/resultado final.
- Ha pelo menos um smoke Playwright para boot sem erro de console e uma validacao minima
  de que a corrida inicializa com jogador, pista, HUD e 3 adversarios.
