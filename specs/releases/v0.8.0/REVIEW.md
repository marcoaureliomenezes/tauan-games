# REVIEW — speed-run web (2026-08-10, pré-v0.8.0)

> Base: playtests do operador + auditorias v0.4.0 + autópsia profunda + 5
> workstreams da v0.7.0 (todos verificados por probes/screenshots).

## Veredito executivo

O jogo saiu de "injogável" (manhã de 2026-08-10) para um arcade racer correto e
agradável na tarde do mesmo dia. Os defeitos estruturais foram todos atacados na
raiz. O que falta para "impecável" é exatamente o escopo da v0.8.0: réplica fiel
do Idea, nitro, música, placas e o full scan de relevo (em execução).

## O que está BOM (verificado)

- **Física**: fixed timestep 120 Hz — impossível câmera lenta; steering com
  falloff calibrado por carro; rampas projetam de verdade (1,36 s de ar medido)
  e toda lombada tem reta de pouso verificada por probe (κ < 0,002).
- **Colisão**: zero colisões invisíveis nos probes — validação espaço-temporal
  do surfaceAt, cerca visível = cerca colidível, cápsulas por bbox, ordem de
  resolução correta.
- **Visual**: montanhas texturizadas (neve/estrato/mata) com 2 anéis parallax,
  38 nuvens, prédios instanciados com janelas acesas (cidade 257→105 draw
  calls), gantry + torcida, chão multi-escala.
- **Conteúdo**: 3 circuitos + sprint A→B (Serra do Tauan) com modo Fuga
  (polícia PIT, vida, spike strips); Idea Adventure procedural v1 (15 meshes,
  estepe externo, cladding, roof rails).
- **Testes**: 14 specs Playwright (incl. teclado real) + probe 42/42 + scanner
  de restart (leaks zerados).

## O que FALTA / riscos (escopo v0.8.0)

| Item | Por que importa |
|---|---|
| Idea não é RÉPLICA ainda | v1 foi construído só por dimensões; a v2 sai da análise de 5+ fotos reais do carro do operador |
| Sem nitro | pedido explícito; design pronto no PLAN (Shift, boost ×1.8, regen) |
| Sem música | pedido explícito (Top Gear/Barry Leitch); workstream em execução |
| Placas escassas | chevrons antes de curvas devem ser GERADOS da curvatura da spline |
| Full scan de relevo | em execução; qualquer finding vira fix na hora |

## Dívida conhecida (não bloqueante)

- AI turn-1 pile-up (mitigado? não — registrado; sem fix até agora: IA converge
  para uma racing line). Candidato a v0.8.1.
- `recolor()` clona materiais GLB por corrida (leak JS-side pequeno).
- Polícia da Fuga: geometrias de giroflex/portas não dispostas no restart.
- Flake pré-existente `sprint.spec.js:44` ("browser has been closed", passa no
  retry).
