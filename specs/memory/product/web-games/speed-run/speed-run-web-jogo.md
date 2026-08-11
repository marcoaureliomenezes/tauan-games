---
slug: speed-run-web-jogo
title: Speed Run (web) — o jogo
category: product
tldr: Corrida arcade estilo Cruis'n World — 3 circuitos + sprint A→B com Fuga, réplica do Idea Adventure 2013, nitro, música, fixed timestep.
summary: "Intuito, pistas, lógica e características do speed-run web (src/web-games/speed-run, Three.js). v0.8.0 (2026-08-11): réplica v2 do Idea guiada por fotos reais, nitro (Shift), música procedural 144 BPM, sinalização por dados (chevrons/LOMBADA/VADO/300-200-100) + sol com flare + zebras, full-scan permanente zerado (com guard de estreitamento). v0.7.0: colisões invisíveis zeradas, timestep fixo 120 Hz, sprint + perseguição portados do Godot (encerrado)."
tags: [product, speed-run, corrida]
token_estimate: 0
last_updated: "2026-08-11"
release_origin: v0.8.0
---

## Intuito
Corrida arcade no espírito Cruis'n World (N64): pistas cênicas, tráfego civil,
carro especial do operador (Fiat Idea Adventure 2013 Dual Logic). Visual era
PS1: low-poly + textura procedural rica (lei: sem textura = rejeitado).
Versão Godot existiu e foi encerrada (v0.7.0) — seus melhores elementos foram
portados para cá.

## Pistas (4, declarativas em tracks.js)
- **Centro Urbano** — prédios instanciados com fachadas acesas, avenidas.
- **Floresta Temperada** — pinheiros (LOD 2 níveis), trechos de terra.
- **Deserto do Arizona** — mesas/estratos, saguaros, offroad.
- **Serra do Tauan (sprint A→B)** — Tauan City → Vila Serrana, ~2 km abertos,
  trechos dual/single/terra/vados, cidades visíveis nos endpoints, HUD
  "Faltam X km" (sem voltas). Modo **Fuga**: 3 policiais PIT com giroflex,
  barra de vida, spike strips, "VOCÊ ESCAPOU/PEGO".
Spline Catmull-Rom é FONTE ÚNICA: render, colisão, AI, respawn, progresso.
Regra de rampa (lei do operador): toda lombada tem reta de pouso (κ<0,002 por
~92 u) — curva após rampa é proibida e validada por probe.
**Sinalização por dados** (`signage.js`): chevrons gerados da curvatura κ da
spline (−25/−10 m da entrada + ápice pelo lado de fora), LOMBADA/VADO 30 m
antes de cada crista/lâmina, tábuas 300/200/100 — 2 draw calls no total,
clearance por canto de placa auditado por spec (`world.signage`). Zebras
vermelho/branco nas curvas e sol com flare (Arizona).

## Carros (5 + tráfego)
Idea Adventure 2013 **procedural** (`idea-model.js`, 22 meshes) — **réplica v2
guiada por 7 fotos reais curadas** (`docs/idea-ref/`): capa do estepe centrada
com tiras em V prata, rodas prata 5 raios nas bitolas reais, faixa de cladding
nas portas, quebra-vento pilar A, faróis 0,50×0,20 envolventes + fogs duplos,
lanternas altas, cabine monovolume, vão 0,20 (ficha real: 4.207×1.753×1.814 m,
205/70 R15). Demais: GLB Quaternius CC0 recolorido (Thunder V8, Velocità GT,
Mule Pickup, Neon 2049). Rodas rig por pivô no cubo (cache, sem leak).

## Lógica/física
`physics.js` arcade point-mass — escolha confirmada pela pesquisa OSS
(Cruis'n = kinematic fake, não sim). **Fixed timestep 120 Hz** com accumulator
(slow-motion impossível); `surfaceAt` com validação espaço-temporal (rejeita
captura de perna errada em hairpins — era o bug das "pedras invisíveis");
cercas: colisor FORA da visual, texturas robustas (nunca parede invisível);
colisores cápsula por bbox do modelo; clamp de cerca pós-colisão car-car;
steering com falloff `1/(1+av/150)` (−27..−33% em top speed); rampas projetam
(vy ×1.1, cap 3+v·0.16, air-drag 6%/s, pouso com dip); GRAV=28.
**NITRO (v0.8.0, Shift):** acel ×1,8 + teto +25% na física; recurso no main
(carga 100, dreno 33/s, regen 8/s por substep ×2 após 3 s limpo, mín. 5,
flash "SEM NITRO" na borda de subida seca) + FOV kick +6° e glow de
escapamento. Só o jogador; na Fuga o ram policial não drena nem zera regen.

## Características
Three.js r165, texturas canvas procedurais (pool de fachadas — cidade 257→105
draw calls), montanhas parallax texturizadas (neve/estrato/mata) + anel médio
k=0,3 + 38 nuvens impostoras, gantry+torcida no grid, PMREM cacheado por
pista, dispose completo no restart. **Música procedural** (`music.js`, Web
Audio, 144 BPM, loop Am F C G / Am F Dm E, baixo pulsante + lead saw com
glide, mix menu/corrida, mute no M). Debug `window.__corrida`, IA pode dirigir
o jogador nos testes. Suite: 23 specs Playwright (incl. `input.spec.js` e
`nitro.spec.js` com teclado real, `ws6-signs.spec.js` 5/5) + probe 42/42 +
**full-scan permanente** (`tools/full-scan.mjs`, 4 pistas × 3 velocidades:
0 crit/high/med, com guard de estreitamento de largura local — sprint dupla
18,4→single 9,4 em s=0,30 é saída unilateral legal, não brecha).

## Legado (auditoria v0.4.0 → resolvida em v0.7.0)
A auditoria de 2026-08-10 marcou DEFEITOS GRAVES (dt-clamp slow-motion, carro
de lado, leak GPU, pile-up da IA). Todos endereçados no uplift v0.7.0 — ver
`releases/v0.7.0/TASKS.md` T-02..T-06 para evidência por item.
