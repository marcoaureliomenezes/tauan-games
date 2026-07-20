# TASKS - Release: james-bond-browser-fps-v1

> **Status:** Aprovado
> **Release ID:** james-bond-browser-fps-v1

## Tarefas

- [x] **T-JB-01 - Primeiro jogável completo do FPS James Bond**
  - **Owner:** game-developer (software-engineer acting as game-developer)
  - **Write set:** `src/web-games/james-bond/**`, `vendor/james-bond/**`, `tests/james-bond/**`,
    `package.json`, `index.html`, `specs/releases/james-bond-browser-fps-v1/**`,
    `.dadaia/handoff/tauan-games/**`, `.dadaia/tmp/root/20260718/james-bond-*/**`.
  - **Descrição:** implementar stack local, seis fases, controles, combate, IA, FX,
    áudio, HUD, radar, mapa, progressão e testes definidos em SPEC/PLAN.
  - **Validação:** testes unitários + Playwright verdes; screenshots desktop/mobile;
    canvas não vazio; zero requests externos e zero erros de console; URL registrada.
  - **Evidência:** `npm run test:james-bond` verde; seis mapas alcançáveis; três testes
    Playwright verdes; servidor `tauan-games` ativo na porta 3658. Hotfix visual e de
    desempenho validado com 12 cargas de missão, heap estável e zero erros de runtime.
