---
slug: aero-strike-flight
title: Aero Strike — voo e jogabilidade
category: product
tldr: Controles, modelo de energia de voo (com constantes), e a máquina de estados de surtida (aeroporto, decolagem, pouso, auto-taxi).
summary: Especifica os controles do teclado, o modelo de física de voo do F-35 com as constantes de config.js, e o sistema de surtida do modo realista (FSM sortie, aeroportos por mapa, decolagem por rotação, pouso por flare, auto-taxi e cena de serviço). Detalhe suficiente para recriar a jogabilidade.
tags:
  - product
  - aero-strike
  - flight
  - controls
agent_tier: self-pull
token_estimate: 0
last_updated: "2026-07-01"
release_origin: aero-fighters-world-realism-v1
---

## Propósito

Descrever como o F-35 é controlado e voado, e como decolagem/pouso funcionam — com
detalhe suficiente para recriar a jogabilidade. Parte de [[aero-strike]].

## Visão geral

### Controles (teclado)

| Tecla | Ação |
|-------|------|
| ↑ / I | **Nariz para BAIXO** (esquema invertido, sim-style) |
| ↓ / K | **Nariz para CIMA** |
| ← → / A D | Roll (banking) + yaw coordenado |
| Q / E | Rudder (yaw puro) |
| W / S | Acelerar / desacelerar throttle (S também freia no solo) |
| Space / Z | Canhão Vulcan (segurar = contínuo); também **Start** quando parado |
| X | Míssil leve teleguiado (precisa de lock) |
| B | Míssil pesado (precisa de lock) |
| T | Míssil **nuclear** (dispara sem lock) |
| C | Alterna modo de câmera (5 modos) |
| Shift | Barrel roll (invencível 0,5 s, cooldown 1,5 s) |
| J | Ejetar (só durante mayday) |
| P / Esc | Pausa · M | Mudo · Enter | Start/restart |

**Descoberta (regra do público-alvo):** no **solo**, tanto ↑ quanto ↓ iniciam a rotação
de decolagem (o input natural funciona); em voo o esquema invertido permanece (ADR-U1).
Space/setas usam `preventDefault` para não rolar a página.

### Modelo de energia de voo

Atitude por **quaternion** (nunca Euler para controle). A cada frame o `throttle/speed/
stalled` são atualizados **antes** de `x/y/pitch/pz` (contrato de ordenação). Constantes
canônicas (`config.js` `PLAYER`):

- Velocidade: `MAX_SPD 80`, `MIN_SPD 8`, alvo = `MIN_SPD + throttle·(MAX_SPD−MIN_SPD)`;
  imposto de subida (`CLIMB_TRADE 35`, só em subida íngreme); empuxo cai perto do
  `CEILING 9500`; teto de mergulho `MAX_SPD·DIVE_OVERSPEED(1.3)`; convergência
  `CONVERGE_RATE 1.6`.
- **Stall** abaixo de `STALL_SPD 14`: nariz cai `STALL_NOSE_DROP 0.45 rad/s`, autoridade de
  comando `STALL_CTL 0.45`.
- Movimento: `pos += frente·speed·dt`; `y −= GRAVITY 14·dt`; sustentação devolvida quando
  não em stall. **Auto-trim** `TRIM_RATE 0.22` nivela o nariz sem input.
- Taxas: `PITCH_RATE 1.45` (limites `PITCH_UP 0.82` / `PITCH_DOWN −0.70` rad), `ROLL_RATE
  2.30`, `YAW_RATE 0.80` (rudder ×`RUDDER_FACTOR 0.65`).
- Visual: pós-combustor escala com throttle, luzes de nav + strobe (1,2 Hz), trem de pouso
  recolhe acima de ~16 m AGL, mísseis de asa somem conforme a munição acaba.

### Sistema de surtida (modo realista — padrão)

`game.missionRealism` (default habilitado) troca o loop arcade por um ciclo de surtida com
FSM (`sortie-state.js`): `MENU → TAXI_OUT → TAKEOFF_ROLL → AIRBORNE → MISSION_ACTIVE →
RETURN_TO_BASE → LANDING_ROLL → TAXI_IN → SERVICE_SCENE → NEXT_SORTIE_READY` (+ `MAYDAY`,
`EJECTION`, `CRASHED`). Componentes:

- **Aeroporto por mapa** (`airport.js`): pista, taxiway, zona de serviço, touchdown-zone,
  luzes PAPI, marcas de centerline, rótulo no chão. `landing-zones.js` classifica o
  contato e **achata o terreno** ao redor da pista (nenhuma montanha na pista).
- **Decolagem:** rolagem no solo (`ground-physics.js`: `groundSpeed += (throttle·18 −
  freio − arrasto)·dt`, terminal ~62 m/s); rotação em `V_ROTATE 32` com sustentação extra
  `ROTATE_LIFT 15`; liftoff quando > ~4 m acima do aeroporto.
- **Pouso:** tocar qualquer pavimento abaixo de `FLARE_LO 2.2 m` descendo a ≤ `LAND_MAX_SPD
  62` e sem afundamento catastrófico (`SINK_HARD −26`) → touchdown seguro, throttle→idle.
- **Auto-taxi** (`auto-taxi.js`): após pousar, o avião dirige sozinho à zona de serviço
  (~34 m/s), reabastece/rearma (`service-scene.js`, ~35 s / 5 s em testMode), volta ao
  limiar da pista e **auto-decola** (~56 m/s). O jogador não taxia manualmente.
- **Ejeção** (`ejection.js`): durante mayday, para-quedas desce ~9 m/s; ao aterrissar, o
  jato é restaurado com munição/HP cheios (consome 1 vida).
- **Progressão por ciclo:** HP dos alvos `+3`; intervalo de tiro AA encurta; flak ambiente
  após o ciclo 2.

## Estado runtime tocado

- `game.player.{x,y,pz,speed,throttle,pitch,stalled,dead,hp}`; `game.missionRealism.sortie
  .state`; `game.flags.{cameraShake,nukeSlowmo,...}`.

## Dependências

- [[aero-strike]] — o jogo. [[aero-strike-world]] — a superfície que se pousa/coliide.
- [[aero-strike-combat]] — o que se combate em voo.
