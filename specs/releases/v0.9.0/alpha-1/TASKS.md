# TASKS: v0.9.0 alpha-1 — demolition-ball-city-uplift

**Status:** Aprovado <!-- 2026-08-11: escopo aprovado pelo operador no grill-me; implementação autorizada ("continue the work") -->
**Release ID:** v0.9.0
**Segment:** alpha-1
**Owner:** product-engineer
**Created:** 2026-08-11

Marks: `[ ]` OPEN, `[-]` IN PROGRESS, `[x]` DONE.

---

## Tasks

- [x] T1 - Branch da release (`feature/demolition-ball-city-uplift-v1`)
  - **Owner:** software-engineer
  - **Acceptance:** branch criada com aval do operador; working tree da outra sessão
    (v0.8.0) intacta; `git status` limpo para os arquivos desta release ao final.
  - **Resolução (2026-08-11):** `main` NÃO contém o jogo (o layout `src/` inteiro e
    `specs/` nunca chegaram a `main`; demolition-ball era 100% untracked). Branch
    criada a partir de `4def7bd` (tip de `feature/aero-fighters-flight-combat-v1`,
    a linhagem onde `src/` vive) via **git worktree** em
    `.dadaia/tmp/software-engineer/20260811/db-worktree` — a working tree da outra
    sessão não foi tocada. Baseline do jogo commitada como primeiro commit da branch.

- [x] T2 - Modos Tauan/Contratos + destruição fácil no Tauan (R-01, R-02, WS-1)
  - **Owner:** software-engineer
  - **Acceptance:** AC-1 e AC-3 da SPEC; unit por modo; e2e da seleção de modo;
    baseline anterior segue verde.
  - **Nota:** implementação iniciada em shadow copy `/tmp/db-impl/` (T1 pendente de
    aval git do operador); arquivos finais copiados para a branch quando T1 resolver.

- [x] T3 - ESPAÇO com homing (servo) + spawn seguro da bola (R-03, R-04, WS-2)
  - **Owner:** software-engineer
  - **Acceptance:** AC-2; unit espelhando o spike (≥6 impactos/25s no cenário
    padrão); bola nunca spawna dentro de volume; `Q/E`/`Z/X` intactos durante o homing.
  - **Nota:** idem T2 — shadow copy primeiro, validação unit no shadow.

- [x] T4 - Fachadas detalhadas + praças/vegetação + céu com nuvens (R-05, R-06, R-08, WS-3)
  - **Owner:** software-engineer
  - **Acceptance:** screenshots Playwright anotados mostrando janelas com
    moldura/vidro, portas no térreo, praça com árvores variadas e flores, nuvens
    móveis e sol; `snoise` vendor com licença MIT em `src/vendor/`;
    fps ≥ 20 em `?quality=low` no e2e.

- [ ] T5 - Rio com 2–3 pontes (R-07, WS-4)
  - **Owner:** software-engineer
  - **Acceptance:** leito sem estruturas (unit); ≥2 pontes atravessáveis; tráfego e
    pedestres usam as pontes; unit de fluxo sem deadlock; screenshot anotado.

- [ ] T6 - Pedestres nas calçadas (R-09, WS-5)
  - **Owner:** software-engineer
  - **Acceptance:** walkers com pernas alternadas em rotas de calçada/praça/ponte;
    fogem de impactos próximos; bola nunca os fere (unit); visíveis em screenshot.

- [ ] T7 - Carros melhorados (R-10, WS-5)
  - **Owner:** software-engineer
  - **Acceptance:** ≥3 modelos (carro, caminhonete, van/ônibus) com vidros, faróis e
    lanternas; fila/freio atuais preservados (unit de tráfego verde); screenshot.

- [ ] T8 - Equipe de isolamento "CHAMAR EQUIPE 🚧" (R-11, WS-6)
  - **Owner:** software-engineer
  - **Acceptance:** AC-5: botão a ≤30 m do alvo (também tecla `C`); furgão chega,
    ajudante de colete coloca cones no perímetro do quarteirão; tráfego para nas
    entradas; 1×/contrato; equipe recolhe cones ao concluir o alvo (e2e + unit de
    `closedBlocks`).

- [ ] T9 - Operador visível na cabine (R-12, WS-7)
  - **Owner:** software-engineer
  - **Acceptance:** AC-6 — figura com capacete/tronco/braços sentada na cab,
    acompanhando o slew; visível nas câmeras follow e ball (screenshots).

- [ ] T10 - Memória SDD + docs (R-13, R-14, WS-8)
  - **Owner:** product-engineer
  - **Acceptance:** AC-8 — games-catalog atualizado; atoms em
    `specs/memory/product/web-games/demolition-ball-opus-5/`; README do jogo e raiz
    coerentes; `dadaia backlog doctor` sem erros novos.

- [ ] T11 - Fecho: suíte completa + screenshots finais + aceitação
  - **Owner:** qa-engineer
  - **Acceptance:** AC-1..AC-8; `node tests/demolition-ball-opus-5/unit.mjs` e
    Playwright do jogo verdes; relatório de QA + handoff; operador (e filho) jogam.
