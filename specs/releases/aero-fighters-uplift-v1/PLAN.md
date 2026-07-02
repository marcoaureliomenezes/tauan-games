# PLAN — aero-fighters-uplift-v1

> **Status:** Aprovado
> **Aprovação:** 2026-06-12 — composto e aprovado na mesma sessão da diretiva
> `/goal implement` do operador (SPEC Aprovado + grill ADR-U1..U5).
> **Criado:** 2026-06-12

## 1. Estratégia

Implementação single-session na branch `feature/aero-fighters-uplift-v1`, em 6 waves
sequenciais (dependências do SPEC). Sem build step; tudo ES modules sobre Three.js
r165 vendorado. Cada wave fecha com a suíte `npm run test:aero` verde + probe live
Playwright dos ACs da wave. Commits convencionais por wave referenciando task-ids.

A verdade de superfície (Wave 1) é a fundação: um único `surfaceInfoAt(x, z)` em
`world.js` (evita ciclo de import — world já enxerga maps via `_activeHeightFn` e
landing-zones) devolvendo `{ height, kind }` com
`kind ∈ {water, land, mountain, runway, taxiway, service}`. Crash, pouso, clamp e
HUD passam a ler a MESMA verdade — mata floor-glue, "MAR no deserto" e diverge zero
da malha visual (heightFns já têm paridade com os meshes).

## 2. Waves

| Wave | Workstreams | Conteúdo | Arquivos principais |
|---|---|---|---|
| 1 | WS-1 + bugs CRIT-2/HIGH-3 | `surfaceInfoAt`; roteamento de crash por kind; máquina de contato (touchdown oportunista fora de RTB; fim do clamp silencioso); velocidade terminal no ground roll | `world.js`, `player.js`, `landing-zones.js`, `ground-physics.js` |
| 2 | WS-2 + bugs CRIT-1/CRIT-2b | Registro de aeroportos por mapa + builder genérico; pista costeira islands (ADR-U2) + pista rio; remoção do override `activeMap='desert'` em start/restart; airport-flatten nos heightFns islands/rio | `airport.js`, `landing-zones.js`, `missions.js`, `world.js`, `maps/rio.js`, `state.js` |
| 3 | WS-4 + bug HIGH-4b | Rotação no solo com ↑ OU ↓ (ADR-U1); trem de pouso visível (retrai/baixa por altura); rumble + poeira na corrida; PAPI na cabeceira + guia de aproximação no HUD + pista no minimapa; touchdown contínuo (sem teleporte) + fumaça de pneu + rollout progressivo; hard-landing em pista = bounce + 1 hp (não crash) | `player.js`, `hud.js`, `ui/minimap.js`, `airport.js`, `fx.js` |
| 4 | WS-3 | Energia: atitude×velocidade (subir drena, mergulhar ganha), drag, auto-trim suave, stall com queda de nariz, teto prático; altímetro honesto (m reais) | `player.js`, `config.js`, `hud.js` |
| 5 | WS-5 + WS-6 | Mortes por superfície: água = splash + afundamento com câmera baixa; terra = explosão + cicatriz (scorch decal compartilhado). Nuke: cinematic sempre (wide-shot baixo, dolly), slow-mo dt global 0.35×/1.5 s (ADR-U4, guarda testMode/mayday), shake na chegada do anel (delay distância/340), PointLight transitória, cratera+scorch em qualquer piso, coluna de fumaça residual 60 s | `missions.js`, `player.js`, `fx.js`, `nuclear-fx.js`, `camera-modes.js`, `projectiles.js`, `main.js` |
| 6 | WS-7 | Nuvens ADR-U5 (`fog:false`, achatadas, leve emissive); textura procedural no piso desert; scatter InstancedMesh (rochas/cactos desert, palmeiras islands); fill light no jato (metalness ↓); speed lines só >60 m/s | `world.js`, `maps/*.js`, `player.js`, `scene.js`, `main.js` |
| 7 | QA | ACs novos Playwright (liftoff 4 mapas via botão, no-floor-glue, label de crash por mapa, nuke stages, ALT honesto); suíte completa verde; bugs → Closed | `tests/aero-fighters/`, `specs/bugs/*` |

## 3. Riscos

| Risco | Mitigação |
|---|---|
| Refactor de colisão quebra testes existentes | `npm run test:aero` após cada wave; heightFns intocados (paridade visual já validada) |
| Slow-mo global interfere em testes | Guarda `testMode`/webdriver (ADR-U4) — dt nunca dilatado em teste |
| Pista rio colide com grid de prédios | Exclusão por `airportSurface` no gerador de prédios (mesmo padrão dos morros) |
| Scatter derruba FPS em Iris Xe | InstancedMesh único por tipo, counts modestos (≤200) |

## 4. Verificação final

1. `npm run test:aero` 100% verde.
2. Probe live: decolagem nos 4 mapas selecionados VIA BOTÃO (não `?map=`).
3. Probe live: mergulho no desert → label de terra; islands fora de ilha → afundamento.
4. Probe live: nuke → `nuclearFxState` percorre os 4 stages + cinematic ativa.
5. `dadaia specs doctor` 0 erros; bugs da release com `status: Closed`.
