# Backlog — Candidates

Game features candidatas a virar release. Cada candidata tem owner sugerido (um dos três
agentes `game-*`) e link para contexto histórico (archive ou report). Nada aqui autoriza
implementação — apenas sinaliza que vale a pena considerar para a próxima rodada de planning
após a release ativa chegar a CLOSURE.

## Convenções

- Um bullet por candidata, com formato:
  `- <nome> — <one-liner do problema> (owner: <agent>, contexto: <link>)`
- Manter ordenado por prioridade percebida (mais quente no topo).
- Quando uma candidata virar release ativa, mover linha para o histórico abaixo com
  data e release-id correspondente.

## Candidatas ativas

Originadas da migração estrutural de specs (2026-05-17) — esta lista substitui a antiga
pasta `specs/features/`. Specs históricas que originaram cada candidata estão arquivadas em
`specs/_archive/releases/<release-id>/`. Promover para release exige nova passagem de
discovery + grill-me + SPEC Aprovado pelo product-engineer.

- space-war-phased-campaign-physics-enemies — Transformar Space War de sandbox aberto de 5 sistemas em campanha faseada com escala, gravidade, cometas, inimigos, bases e armas mais realistas. (owner: game-designer, contexto: `specs/backlog/space-war-phased-campaign-physics-enemies.md`)
- aero-fighters-ue5-migration — Migrar Aero Strike (atualmente Three.js r165) para Unreal Engine 5 conforme regra `game-developer-scope` que prevê o jogo `aero-fighters-v2` em UE5. Requer plano de portabilidade de mecânicas (voo, AAA defense, bombing/strafing), assets procedurais → assets nativos UE5, e build pipeline novo. (owner: game-developer, contexto: `.claude/rules/game-developer-scope.md` + `specs/_archive/releases/aero-fighters-v1/SPEC.md`)
- aero-fighters-multi-mission-campaign — Estender Aero Strike para múltiplas missões encadeadas (campaign mode) com persistência de progresso, debriefing screens e progressão de armamento. Hoje cada missão é independente. (owner: game-designer, contexto: `specs/releases/aero-fighters-mission-realism-v1/SPEC.md`)
- security-baseline-followup — Refresh do baseline de segurança do repo: `npm audit` ainda passando, `gitleaks` configurado, GitHub Pages servindo HTTPS apenas. A spec original foi arquivada em `_archive` em estado "In Review" com tasks done mas sem aprovação formal — vale revalidar antes de assumir compliance. (owner: game-tester, contexto: `specs/_archive/releases/security-baseline-v1/SPEC.md`)
- tauan-trex-mobile-controls — Adicionar controles touch (tap para pular, swipe para abaixar) ao tauan-trex para que Tauan possa jogar no tablet sem teclado. (owner: game-developer, contexto: `specs/_archive/releases/tauan-trex-v1/SPEC.md`)
- testing-infra-visual-regression — Adicionar screenshot diff (visual regression) à infra Playwright além dos smoke tests atuais; capturar regressões visuais antes do operador. (owner: game-tester, contexto: `specs/_archive/releases/testing-infra-v1/SPEC.md`)
- aero-fighters-audio-pass — Aero Strike hoje é silencioso ou tem áudio mínimo procedural. Pass dedicado de áudio (engine, missile lock, AAA fire, ground impact) com Web Audio API procedural, mantendo o princípio "zero assets externos". (owner: game-designer, contexto: `specs/memory/tech-stack.html`)
- third-game-phaser-2d — Próximo jogo Phaser 2D para Tauan ainda a ser definido (ideias em `backlog/ideas.md`). Atende objetivo de portfólio multi-jogo. (owner: game-designer, contexto: `specs/memory/product/index.html`)

## Hotfixes pendentes

(nenhum no momento)

## Histórico (candidatas promovidas a release)

- aero-fighters-inhauma-map → release `aero-fighters-inhauma-map-v1` (promovido em 2026-05-16, em andamento; SPEC em `specs/releases/aero-fighters-inhauma-map-v1/SPEC.md`)
- aero-fighters-mission-realism → release `aero-fighters-mission-realism-v1` (promovido em 2026-05-13, ACTIVE em 2026-05-17; SPEC em `specs/releases/aero-fighters-mission-realism-v1/SPEC.md`)
- aero-fighters → release `aero-fighters-v1` (encerrado em 2026-05-12; SPEC final em `_archive/releases/aero-fighters-v1/SPEC.md`)
- aero-fighters-qa-hardening → release `aero-fighters-qa-hardening-v1` (encerrado; SPEC final em `_archive/releases/aero-fighters-qa-hardening-v1/SPEC.md`)
- tauan-trex → release `tauan-trex-v1` (encerrado; SPEC final em `_archive/releases/tauan-trex-v1/SPEC.md`)
- testing-infra → release `testing-infra-v1` (encerrado; SPEC final em `_archive/releases/testing-infra-v1/SPEC.md`)
- security (baseline) → release `security-baseline-v1` (encerrado em estado "In Review", todas as tasks done; SPEC final em `_archive/releases/security-baseline-v1/SPEC.md`)
