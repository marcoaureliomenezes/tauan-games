# SPEC — aero-fighters-uplift-v1

> **Status:** Aprovado
> **Aprovação:** 2026-06-12 — operador aprovou via diretiva `/goal implement` após
> grill 5/5 concluído (ADR-U1..U5).
> **Criado:** 2026-06-12
> **Contexto:** Pivô do operador 2026-06-12 — o trabalho em `aero-fighters-v2` (Godot,
> release `aero-fighters-v2-godot-stylized-inhauma-v1`) fica PAUSADO; o foco volta ao
> jogo web `aero-fighters/` (Three.js, Degrau 2).
> **Insumo:** audit completo `specs/audits/2026-06-12T220815Z/aero-fighters-full-review.md`
> (código 100% lido + execução live com evidência em screenshots).

## Demanda do operador (condensada)

Revisão completa do jogo `aero-fighters/` e uplift de qualidade em:

1. **Mapas** — mais bem desenhados e detalhados.
2. **Mecânicas** — melhores mecânicas de voo e combate.
3. **Decolagem e aterrissagem** — experiência muito melhor.
4. **Explosões** — mais bonitas e detalhadas, especialmente a **Nuke**, com tomada de
   câmera dedicada quando a nuke explode.
5. **Realismo de colisão** — colisão com o mar ≠ colisão com a terra; ao colidir com
   montanha o avião deve cair até o chão com fumaça e explodir no solo, ou afundar
   no mar.

## Bugs dobrados nesta release (bugs are always solved)

| Bug | Severidade | Workstream |
|-----|------------|------------|
| `aero-islands-realism-softlock` | CRITICAL | WS-2 |
| `aero-airborne-floor-glue` | CRITICAL | WS-1 |
| `aero-startgame-forces-desert-activemap` | CRITICAL | WS-2 |
| `aero-sea-label-on-land` | HIGH | WS-1 + WS-5 |
| `aero-rotate-key-undiscoverable` | HIGH | WS-4 |

## Workstreams propostos (detalhe no audit §4)

- **WS-1 — Verdade de superfície e colisão:** `surfaceAt(x,z)` único por mapa
  (`{height, kind}`); colisão/pouso/crash leem a mesma verdade; máquina de contato
  mata o floor-glue; ground roll com velocidade terminal.
- **WS-2 — Aeroporto em todo mapa:** islands (pista costeira ou porta-aviões — grill)
  e rio (pista Santos Dumont); registro por mapa em `getAirportForMap`.
- **WS-3 — Modelo de voo com energia:** atitude×velocidade acoplados, auto-trim,
  stall real, teto prático, altímetro honesto (HUD ALT = metros reais).
- **WS-4 — Decolagem/pouso:** trem de pouso visível e animado, rumble + callouts,
  glide-slope/PAPI/marcador de pista, flare assistido, touchdown contínuo (sem
  teleporte), rollout e taxi guiado.
- **WS-5 — Morte bonita por superfície:** todo impacto fatal entra na rota mayday;
  montanha/terra = tumble + skid de fogo + explosão + cicatriz; água = splash +
  afundamento 4-5 s com câmera baixa.
- **WS-6 — Nuke espetáculo:** câmera dedicada SEMPRE (wide-shot baixo, slow-mo 0.35×,
  shake na chegada do anel com delay sonoro pela distância), fireball emissiva, cap
  toroidal, PointLight transitória, cratera/cicatriz em qualquer piso, fumaça
  residual 60 s.
- **WS-7 — Mapas ricos:** texturas procedurais de piso, scatter InstancedMesh por
  mapa, haze de horizonte, nuvens sem tinta de fog, rim light no jato.

Ordem: WS-1 → WS-2 → WS-4; WS-3, WS-5 → WS-6 em paralelo após WS-1; WS-7 paralelo.

## Critérios de aceite (resumo — detalhe no audit §4)

1. LIFTOFF possível nos 4 mapas.
2. Floor-glue impossível (nenhum y colado com Δz≈0 por 3 s em AIRBORNE).
3. Crash em terra nunca rotula "MAR"; crash na água tem sequência de afundamento.
4. Montanha → mayday → queda ≥2 s → explosão no solo (preservar T-BF04).
5. Nuke: cinematic sempre ativa; stage flash→fireball→mushroom→dissipating; cratera
   em desert.
6. Pouso com guias visíveis; touchdown sem descontinuidade; ALT honesto.
7. Suíte `npm run test:aero` verde + novos ACs Playwright por WS.

## Decisões de grill (sessão 2026-06-12, operador presente)

Todas as perguntas abertas foram resolvidas — relatório:
`.dadaia/reports/tauan-games/product-engineer/2026-06-12T224500Z-refine-specs.html`.

| ADR | Decisão | Workstream |
|-----|---------|------------|
| ADR-U1 | No **solo**, ↑ OU ↓ rotacionam para decolagem; em voo o esquema invertido permanece. Sem toggle. | WS-4 |
| ADR-U2 | Islands ganha **pista costeira** numa ilha grande (reuso do registro de aeroportos + airport-flatten). Porta-aviões fora. | WS-2 |
| ADR-U3 | Caças inimigos **FORA** desta release → backlog `aero-air-combat-v1` (`entities/enemyJet.js` reservado). | — |
| ADR-U4 | Slow-mo da nuke = **dt global 0.35× por 1.5 s**; nunca em `testMode`; cancelado se player em mayday. | WS-6 |
| ADR-U5 | Nuvens permanecem **esferas melhoradas** (fog-tint corrigido, leve emissividade, cachos achatados); billboards descartados. | WS-7 |

## Estado

SPEC em Draft com grill CONCLUÍDO (5/5 decisões). Próximos passos SDD: operador
aprova este SPEC → PLAN/TASKS → implementação. Não implementar nada antes de
`**Status:** Aprovado`.
