# PLAN — Release: v0.7.0

> **Status:** Aprovado
> **Release ID:** v0.7.0
> **Spec:** `SPEC.md`

---

## Workstreams (ordem)

- **WS-1 (R-01+R-02+R-03) — P0 física/colisão/timestep**: reescrever a captura
  do `surfaceAt` (validação espacial + rejeição por deslocamento implausível;
  `sHint` nunca recebe `q.s` rejeitado), fence collider FORA da visual, cercas
  visíveis (alpha), colisor por-bbox, ordenação car-car→fence, accumulator
  fixo + interpolação, steering com falloff `×1/(1+av/60)`.
- **WS-2 (R-04) — P1 rampas**: launch consistente em dt fixo, air-drag leve,
  validação das 3 pistas: reta de aterrissagem após toda crista.
- **WS-3 (R-05) — P1 visual**: prédios instanciados + pool de fachadas, anel
  de nuvens, horizonte texturizado, LOD árvores, chão com detalhe, gantry.
- **WS-4 (R-06) — P2 Idea**: ~30 partes do dossiê em Three.js (cores/medidas
  exatas), rig de rodas por pivô no cubo.
- **WS-5 (R-07+R-08) — P2 sprint + perseguição**: pista A→B com cidades,
  HUD "Faltam X km", polícia/vida/spikes.
- **WS-6 (R-09+R-10) — higiene**: delete godot speed-run, dispose/PMREM,
  Playwright input-real, validação operador, memory sync.

## Evidência-chave

**M1 (o bug das "pedras invisíveis"):** `world.js:438-448` — busca por amostra
mais próxima na janela `sHint±40`; perto de hairpins a amostra mais próxima pode
ser da OUTRA perna → `q.dist` medido contra a centerline errada → fence
(`physics.js:97-124`) teleporta o carro e reflete velocidade; o `q.s` errado
vira o novo `sHint` (`physics.js:46`) e o erro fica sticky. Fix: validação
espacial + rejeição de salto implausível + fence gateado na validação.
M2: textura da cerca ~85% transparente some com `alphaTest: 0.4` (`world.js:155`).
M3: colisor em `width/2+2.1` vs visual em `width/2+2.4` — bate no ar antes da cerca.

**Dossiê Godot:** Idea = caixas com coords exatas (lower body 1.70×0.52×4.05 @
(0,0.62,0.05), greenhouse 1.56×0.62×2.50 @ (0,1.28,-0.32), estepe externo @
(0.12,0.88,-2.16), cladding, roof rails; cores SILVER #A6A9AD etc.); sprint =
Curve3D aberta A→B com trechos tipados + cidades endpoint (26 caixas pastel) +
fords; perseguição = polícia PIT + MAX_LIFE 100 + spike a cada 16 s.

**Pesquisa OSS:** pmndrs/racing-game, pocket-racer, javascript-racer (segments),
PolyTrack (worker). Veredito: manter stack; fixed-dt + spline-source-of-truth +
raycast wheels fake. Referências registradas no SPEC das tasks.
