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
- aero-fighters-multi-mission-campaign — Estender Aero Strike para múltiplas missões encadeadas (campaign mode) com persistência de progresso, debriefing screens e progressão de armamento. Hoje cada missão é independente. (owner: game-designer, contexto: `specs/releases/v0.0.5/SPEC.md`)
- security-baseline-followup — Refresh do baseline de segurança do repo: `npm audit` ainda passando, `gitleaks` configurado, GitHub Pages servindo HTTPS apenas. A spec original foi arquivada em `_archive` em estado "In Review" com tasks done mas sem aprovação formal — vale revalidar antes de assumir compliance. (owner: game-tester, contexto: `specs/_archive/releases/v0.0.9/SPEC.md`)
- testing-infra-visual-regression — Adicionar screenshot diff (visual regression) à infra Playwright além dos smoke tests atuais; capturar regressões visuais antes do operador. (owner: game-tester, contexto: `specs/_archive/releases/v0.0.3/SPEC.md`)
- aero-fighters-audio-pass — Aero Strike hoje é silencioso ou tem áudio mínimo procedural. Pass dedicado de áudio (engine, missile lock, AAA fire, ground impact) com Web Audio API procedural, mantendo o princípio "zero assets externos". (owner: game-designer, contexto: `specs/memory/tech-stack.html`)
- third-game-phaser-2d — Próximo jogo Phaser 2D para Tauan ainda a ser definido (ideias em `backlog/ideas.md`). Atende objetivo de portfólio multi-jogo. (owner: game-designer, contexto: `specs/memory/product/index.html`)

## Hotfixes pendentes

(nenhum no momento)

## Histórico (candidatas promovidas a release)

- aero-fighters-inhauma-map → release `v0.0.6` (promovido em 2026-05-16, em andamento; SPEC em `specs/releases/v0.0.6/SPEC.md`)
- aero-fighters-mission-realism → release `v0.0.5` (promovido em 2026-05-13, ACTIVE em 2026-05-17; SPEC em `specs/releases/v0.0.5/SPEC.md`)
- aero-fighters → release `v0.0.1` (encerrado em 2026-05-12; SPEC final em `_archive/releases/v0.0.1/SPEC.md`)
- aero-fighters-qa-hardening → release `v0.0.4` (encerrado; SPEC final em `_archive/releases/v0.0.4/SPEC.md`)
- tauan-trex → release `v0.0.2` (encerrado; SPEC final em `_archive/releases/v0.0.2/SPEC.md`)
- testing-infra → release `v0.0.3` (encerrado; SPEC final em `_archive/releases/v0.0.3/SPEC.md`)
- security (baseline) → release `v0.0.9` (encerrado em estado "In Review", todas as tasks done; SPEC final em `_archive/releases/v0.0.9/SPEC.md`)
- repo-hygiene-playwright-report — Remover `tests/playwright-report/` (e screenshots de
  runs) do tracking do repo: artefato de test-runner proibido pela regra de higiene;
  flagged por QA e security nas releases space-war de 2026-07-03. Inclui corrigir os 5
  backlog entries antigos sem `intents[]` (BL-SCHEMA). (owner: project-manager)
- release-naming-canon-reconciliation — Todos os releases do repo usam slugs legados
  (`<jogo>-vN`) e o doctor exige canon SemVer (SPEC-DOC-016/027, ERR no v0.1.1
  arquivado). Renomear quebra referências históricas — decidir: adotar SemVer daqui
  em diante + allowlist dos legados, ou renomear em massa. (owner: project-manager,
  decisão do operador)
