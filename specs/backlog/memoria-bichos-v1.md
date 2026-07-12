---
title: Memoria dos Bichos
status: candidate
opened: 2026-07-12
release: memoria-bichos-v1
description: Criar Memoria dos Bichos como jogo infantil standalone de memoria com cartas de animais, tres niveis, feedback alegre e operacao estatica/offline.
intents:
  - subject:
      kind: doc
      ref: memory/architecture.md#Regras de dependência
    change: "Manter Memoria dos Bichos como jogo isolado em pasta propria, sem dependencia horizontal de tauan-trex, aero-fighters/Aero Strike, space-war ou corrida."
  - subject:
      kind: doc
      ref: memory/tech-stack.md#Padrão de deploy
    change: "Entregar Memoria dos Bichos como Vanilla HTML/CSS/JS estatico publicavel em GitHub Pages e executavel por servidor estatico local."
  - subject:
      kind: doc
      ref: memory/product/overview.md#Diferencial
    change: "Projetar Memoria dos Bichos para Tauan e criancas de 5-8 anos: imediatamente jogavel, sem texto obrigatorio para jogar, controles simples por clique/toque e feedback visual claro."
  - subject:
      kind: doc
      ref: memory/product/quality-bar.md#Diferencial
    change: "Exigir boot sem erro de console, operacao offline, smoke Playwright e ausencia de regressao nos jogos existentes antes de promover/fechar a release."
---

# Memoria dos Bichos

## Description

Criar `memoria-bichos-v1`: um jogo infantil novo e standalone para Tauan, chamado
**Memoria dos Bichos**, em Vanilla HTML/CSS/JS estatico. O jogo apresenta uma grade de
cartas viradas para baixo; a crianca vira 2 cartas por vez; pares de animais iguais
ficam abertos com som e animacao alegre; erro vira as cartas de volta apos feedback
curto. A pagina deve ser propria, linkada do index do repo, rodar offline e funcionar
em GitHub Pages sem build.

O jogo tem 3 niveis selecionaveis:

- 6 cartas, com 3 pares.
- 12 cartas, com 6 pares.
- 20 cartas, com 10 pares.

A vitoria ocorre quando todos os pares ficam abertos. A tela final mostra estrelas
conforme o numero de tentativas, de forma visual e compreensivel sem leitura
obrigatoria.

## Motivation

O tauan-games precisa de um novo jogo leve para crianca de 5-8 anos, diferente dos
jogos de reflexo, corrida, voo ou combate existentes. Memoria dos Bichos ocupa o espaco
de jogo cognitivo curto: reconhecer figuras, lembrar posicoes, receber reforco positivo
e repetir partidas sem friccao.

Evidencia usada: a demanda do operador fixa o nome, genero, mecanica de virar 2 cartas,
3 niveis, condicao de vitoria, estrelas por tentativas, visual colorido com animais
grandes, ausencia de texto obrigatorio para jogar, stack Vanilla HTML/CSS/JS estatico,
offline/GitHub Pages e link no index. O backlog existente nao contem item relacionado a
jogo de memoria infantil; `corrida-primeiro-jogavel-v1` cobre outro genero, e os demais
itens listados pertencem a Aero/Space War/orquestracao.

## Acceptance criteria

- O jogo abre direto em browser por servidor estatico local e GitHub Pages, sem build
  step, sem chamadas de rede em runtime e sem dependencia de CDN.
- Existe uma pagina propria do jogo, linkada do index/catalogo principal do repo.
- A primeira tela permite escolher ou iniciar os 3 niveis: 6 cartas/3 pares,
  12 cartas/6 pares e 20 cartas/10 pares.
- A grade inicia com todas as cartas viradas para baixo; a crianca consegue jogar por
  clique/toque, sem teclado obrigatorio e sem precisar ler texto para entender a acao.
- O jogo permite virar exatamente 2 cartas por jogada; cartas iguais permanecem abertas
  com feedback alegre de som e animacao; cartas diferentes viram de volta apos um curto
  intervalo.
- Cada carta exibe animal grande por emoji ou desenho, com visual colorido, amigavel e
  legivel para crianca de 5-8 anos.
- O contador de tentativas aumenta uma vez por par de cartas revelado e alimenta uma
  avaliacao final por estrelas.
- A vitoria ocorre somente quando todos os pares do nivel escolhido ficam abertos; a tela
  final mostra estrelas e oferece uma acao clara para jogar novamente ou trocar de nivel.
- Ha pelo menos um smoke Playwright cobrindo boot sem erro de console e ausencia de
  requests externos, mais uma validacao minima de iniciar nivel, virar cartas, manter um
  par aberto e concluir uma partida deterministica.
- A implementacao fica isolada na pasta do novo jogo e nao importa codigo de outros
  jogos; compartilhamento permitido limita-se a infraestrutura transversal do repo.
