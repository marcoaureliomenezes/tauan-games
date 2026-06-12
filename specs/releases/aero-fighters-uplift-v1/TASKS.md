# TASKS — aero-fighters-uplift-v1

> **Status:** Aprovado
> **Aprovação:** 2026-06-12 — composto junto com o PLAN (diretiva `/goal implement`).
> **Criado:** 2026-06-12
> **Owner:** sessão coordenadora (sess_46d790b3) — waves sequenciais, write sets
> disjuntos por wave.

## Wave 1 — Verdade de superfície (WS-1)

- [x] T-U-01: `surfaceInfoAt(x,z)` em `world.js` — `{height, kind}` por mapa
      (water só em islands/rio onde o mapa tem água); `checkTerrainCollision`
      passa a devolver `'WATER'|'GROUND'|'MOUNTAIN'|null` derivado dela.
- [x] T-U-02: máquina de contato em `player.js` — fim do floor-clamp silencioso;
      tocar pista em voo = touchdown oportunista (sink baixo) ou hard contact;
      fora de pista = crash roteado por kind.
- [x] T-U-03: velocidade terminal no ground roll (`ground-physics.js`).

## Wave 2 — Aeroportos por mapa (WS-2)

- [x] T-U-04: builder genérico de aeroporto + registro por mapa em `airport.js`;
      pista costeira islands (ADR-U2) + pista rio; flatten nos heightFns.
- [x] T-U-05: remover override `activeMap='desert'` de start/restart
      (`missions.js`) e posição inicial por mapa (`state.js`).

## Wave 3 — Decolagem/pouso (WS-4)

- [x] T-U-06: rotação no solo com ↑ OU ↓ (ADR-U1) (`player.js`).
- [x] T-U-07: trem de pouso visível com retração/extensão por altura (`player.js`).
- [x] T-U-08: PAPI na cabeceira + guia de aproximação no HUD + pista no minimapa.
- [x] T-U-09: touchdown contínuo (sem teleporte) + fumaça de pneu + rollout
      progressivo; hard-landing em pista = bounce + 1 hp.
- [x] T-U-10: rumble/poeira na corrida de decolagem.

## Wave 4 — Voo com energia (WS-3)

- [x] T-U-11: acoplamento atitude×velocidade + drag + auto-trim + stall com queda
      de nariz + teto prático (`player.js`, `config.js`).
- [x] T-U-12: altímetro honesto (m reais) no HUD.

## Wave 5 — Mortes + Nuke (WS-5/WS-6)

- [x] T-U-13: scorch decal compartilhado + crash de terra com explosão+cicatriz;
      crash de água com splash+afundamento e câmera baixa (`fx.js`, `missions.js`,
      `player.js`).
- [x] T-U-14: nuke cinematic sempre ativa, wide-shot baixo com dolly
      (`camera-modes.js`); slow-mo dt global 0.35×/1.5 s com guardas (ADR-U4)
      (`main.js`).
- [x] T-U-15: shake na chegada do anel (delay dist/340) + PointLight transitória +
      cratera/scorch em qualquer piso + fumaça residual 60 s (`projectiles.js`,
      `fx.js`, `nuclear-fx.js`).

## Wave 6 — Mapas/visual (WS-7)

- [-] T-U-16: nuvens ADR-U5 (`fog:false`, achatadas, leve emissive) (`world.js`).
- [-] T-U-17: textura procedural do piso desert + scatter rochas/cactos; palmeiras
      islands (`maps/desert.js`, `world.js`).
- [-] T-U-18: leitura do jato (metalness ↓ + fill light) + speed lines só >60 m/s
      (`player.js`, `scene.js`, `main.js`).

## Wave 7 — QA e fechamento

- [ ] T-U-19: ACs Playwright novos (liftoff 4 mapas via botão, no-floor-glue,
      label de crash por mapa, nuke stages, ALT honesto) (`tests/aero-fighters/`).
- [ ] T-U-20: suíte `npm run test:aero` verde + probes live; bugs da release →
      `status: Closed` com referência de fix.
