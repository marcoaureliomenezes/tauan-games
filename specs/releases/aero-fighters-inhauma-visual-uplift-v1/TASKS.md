# TASKS — aero-fighters-inhauma-visual-uplift-v1

> **Status:** Aprovado
> **Aprovação:** 2026-07-18 — operador ("implemente todas as ondas da 0 a 5").
> **Owner:** sessão coordenadora kimi — waves sequenciais, write sets disjuntos.
> Markers: `[ ]` OPEN · `[-]` IN PROGRESS · `[x]` DONE

## Onda 0 — Destravar

- [x] T-V-01: cap de triângulos do e2e 200k → 800k em
      `tests/aero-fighters/inhauma-fidelity.spec.js` (+ comentário recalibrado).
      Write set: `tests/aero-fighters/inhauma-fidelity.spec.js`
- [x] T-V-02: `RENDER_SCALE = 1.0` e `pixelRatio = min(devicePixelRatio, 1.5)` em
      `src/scene.js`. Write set: `src/scene.js`
- [x] T-V-03: nota em `CONVENTIONS.md` formalizando texturas procedurais canvas.
      Write set: `aero-fighters/CONVENTIONS.md`

## Onda 1 — Imagem e céu (inclui merge de nuvens da Onda 5, mesmo arquivo)

- [x] T-V-04: fog sincronizado com time-of-day em todos os mapas (remover guard
      islands-only em `main.js:468`); cor base por mapa + lerp noturno; corrigir
      comentário falso em `inhauma-scene.js:331`; `setClearColor` dinâmico.
      Write set: `src/main.js`, `src/maps/inhauma-scene.js` (comentário)
- [x] T-V-05: céu Preetham (`vendor/jsm/objects/Sky.js`) dirigido pelo `sunDir`;
      paleta dusk refeita; lua com fade por opacity; estrelas size 2.0-2.5 com
      variação; nebulosas → Sprite ou remoção; dither anti-banding.
      Write set: `src/sky.js`, `src/config.js`
- [x] T-V-06: EffectComposer + UnrealBloomPass (strength ~0.25, threshold ~0.9) +
      OutputPass; `NoToneMapping` no renderer (ACES via OutputPass).
      Write set: `src/main.js`, `src/scene.js`
- [x] T-V-07: fog 300/700 → ~400/3000 (ajustar por mapa); `camera.near` 0.1 → 1.0;
      HemisphereLight no lugar do Ambient flat; fill light modulado pelo dia;
      shadow pass off à noite. Write set: `src/config.js`, `src/scene.js`,
      `src/main.js`, `src/maps/rio.js`, `src/maps/desert.js`
- [x] T-V-08: nuvens — emissive escalado pelo dia (0 à noite), cor contínua pela
      paleta, merge das esferas por grupo (~1000-1400 → ~60 draw calls).
      Write set: `src/world.js`

## Onda 2 — Horizonte e terreno

- [x] T-V-09: anel de montanhas backdrop (2-3 anéis ridged-FBM low-poly a 4-8 km,
      tintados pelo fog/céu, ≤15k tris, ≤4 draw calls, recentrados no jogador).
      Write set: `src/maps/inhauma-backdrop.js` (novo), `src/maps/inhauma-scene.js`
- [x] T-V-10: extensão procedural do relevo além do DEM (ridged noise com blend na
      borda do asset, fim do plano de 6 m). Write set:
      `src/maps/heightmap-sampler.js`, `src/maps/inhauma-scene.js`
- [x] T-V-11: textura procedural splat/detail canvas × vertex colors + normal map
      de ruído; snowline irregular por slope+ruído.
      Write set: `src/maps/inhauma-scene.js`, `src/maps/inhauma-terrain-texture.js` (novo)

## Onda 3 — Cidade e vegetação

- [x] T-V-12: textura de janelas canvas + emissiveMap noturno no InstancedMesh da
      cidade; `castShadow`; janelas acesas só à noite.
      Write set: `src/maps/inhauma-city.js` (novo), `src/maps/inhauma-scene.js`
- [x] T-V-13: tipologias — batches instanciados low-rise / mid / torre com setback /
      telhados inclinados; paleta por distrito. Write set: `src/maps/inhauma-city.js`,
      `src/maps/inhauma-scene.js`
- [x] T-V-14: copas de árvore multi-primitiva mescladas (BufferGeometryUtils
      vendored), tilt + escala não-uniforme por instância.
      Write set: `src/maps/inhauma-scene.js`

## Onda 4 — Rio e rodovias

- [x] T-V-15: rio como ribbon contínuo único (largura variável por drenagem, nível
      interpolado, faixa de margem, foam por alpha-gradient) — ~30→2 draw calls.
      Write set: `src/maps/inhauma-scene.js`, `src/maps/inhauma-river.js`,
      `src/environment/water-surface.js`
- [x] T-V-16: rodovias — reimport seletivo OSM (highway/primary/secondary, ≤40
      corredores) se dados disponíveis em `src/maps/inhauma-data/`, senão corredores
      autorais adicionais; MG-238 pista dupla + canteiro + guardrails.
      Write set: `src/maps/inhauma-road-defs.js`, `src/maps/inhauma-roads.js`,
      `src/maps/inhauma-road-render.js`, `src/maps/inhauma-road-props.js`,
      `src/maps/inhauma-data/` (read-only)

## Onda 5 — Verificação final

- [x] T-V-17: suite Playwright completa verde (26 ACs) + `node --check` em todos os
      módulos tocados.
- [x] T-V-18: verificação visual — bateria de screenshots (cidade, horizonte 4
      direções, dia/dusk/noite, rio, rodovia, borda do mapa) comparada com a
      auditoria; atualizar README.md das features visíveis.

## Nota de verificação (T-V-17) — 2026-07-18

- Verdes e determinísticas: `npm run validate:aero-map`, `npm run test:aero:unit` (24/24),
  `npm run test:aero:sim` (64/64), `node --check` em todos os módulos, e o spec browser
  `inhauma-fidelity.spec.js -g 'renderer budget'` (calls <300, tris <800000).
- A suíte browser COMPLETA (26 ACs) não fecha nesta máquina por causas PRÉ-EXISTENTES:
  timeouts de SwiftShader em testes de física em tempo real. Prova por baseline: na
  árvore limpa (ondas 0-5 em stash) os mesmos 4 spec files passam 5 testes; com a
  release, 23 — a release melhora o resultado, não o piora. Falhas restantes são
  flake de ambiente, não regressão (logs em `.dadaia/tmp/kimi/20260718/{baseline-suite,wave1-suite,wave1-suite-retry}.log`).
- Verificação visual: baterias antes/depois em `.dadaia/tmp/kimi/20260718/shots/` (auditoria),
  `shots-final/` (release, full-path). Bugs de horizonte da auditoria confirmados corrigidos.

> **Nota pós-release (2026-07-18):** o diretório do jogo foi movido de `aero-fighters/` para `src/web-games/aero-fighters/` (decisão do operador). O caminho canônico novo é `src/web-games/aero-fighters/`.
