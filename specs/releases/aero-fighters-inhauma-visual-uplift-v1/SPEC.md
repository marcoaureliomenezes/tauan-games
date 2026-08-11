# SPEC — aero-fighters-inhauma-visual-uplift-v1

> **Status:** Aprovado
> **Aprovação:** 2026-07-18 — operador aprovou em sessão ("Aprovado, implemente todas
> as ondas da 0 a 5") após auditoria full do mapa Inhaúma.
> **Criado:** 2026-07-18
> **Insumo:** auditoria completa com 17 screenshots in-game e análise estática de ~25
> arquivos: `.dadaia/reports/tauan-games/software-architect/2026-07-18T025812Z-inhauma-map-audit.html`
> (handoff `.dadaia/handoff/tauan-games/2026-07-18T025812Z-software-architect-inhauma-map-audit.handoff.json`).

## Demanda do operador (condensada)

O mapa Inhaúma está visualmente ruim: cidade de cubos, árvores default, terreno sem
textura, horizonte vazio com bugs (brilho noturno, borda flutuante, entardecer preto),
céu dia/noite fraco. Implementar as 6 ondas da auditoria para evoluir o realismo.

## Veredito da auditoria (base desta release)

Não é tecnologia nem hardware (222 draw calls / 148k tris medidos — Iris Xe tem folga).
Causas: render scale 0.75, zero texturas, malha 39 m/vértice, fog 300/700, fog
dessincronizado do céu fora de islands, cidade = 1 InstancedMesh de BoxGeometry sem
janelas, sem backdrop de montanhas, DEM vira plano de 6 m fora dos limites, céu =
gradiente de 2 paradas com addons Preetham/bloom vendored e sem uso.

## Escopo — as 6 ondas aprovadas

- **Onda 0 — destravar:** cap de triângulos do e2e 200k → 800k; `RENDER_SCALE = 1.0`;
  formalizar texturas procedurais canvas em CONVENTIONS.md.
- **Onda 1 — imagem e céu:** fog sincronizado com time-of-day em TODOS os mapas (mata
  o bug do horizonte noturno); céu Preetham (`vendor/jsm/objects/Sky.js`) dirigido pelo
  `sunDir`; bloom leve via EffectComposer vendored; estrelas/lua/nebulosas corrigidos;
  paleta dusk refeita; fog ~400/3000; `camera.near` 1.0; HemisphereLight; fill light
  modulado pelo dia; shadow pass off à noite; nuvens sem emissive noturno + merge de
  esferas (Onda 5 antecipada — mesmo arquivo).
- **Onda 2 — horizonte e terreno:** anel de montanhas backdrop low-poly a 4-8 km
  tintado pelo fog; extensão procedural do relevo além do DEM (fim da panqueca de 6 m);
  textura procedural splat/detail × vertex colors + normal map de ruído; snowline
  irregular por slope+ruído.
- **Onda 3 — cidade e vegetação:** textura de janelas em canvas com emissiveMap
  noturno; batches instanciados por tipologia (low-rise/torre com setback/telhados);
  `castShadow` na cidade; copas de árvore multi-primitiva mescladas com tilt/escala por
  instância.
- **Onda 4 — rio e rodovias:** rio como ribbon contínuo único com largura variável +
  margens + foam (~30→2 draw calls); reimport seletivo OSM (highway/primary/secondary,
  ≤40 corredores) se os dados estiverem no disco, senão corredores autorais adicionais;
  MG-238 com pista dupla + canteiro + guardrails.
- **Onda 5 — performance e verificação:** nuvens mescladas (~1000-1400 → ~60 draw
  calls); suite Playwright verde; verificação visual por screenshots.

## Restrições (inalteradas)

- Sem build step, sem TypeScript, sem libs externas, 100% offline.
- Não quebrar o contrato `window.game`; suite Playwright (26 ACs) sempre verde.
- `vendor/` intocado (usar os addons já vendored: Sky, EffectComposer, UnrealBloomPass,
  OutputPass, BufferGeometryUtils).
- Módulos ≤250 linhas (criar módulos novos em vez de inflar existentes).

## Critérios de aceite

1. `npx playwright test --config tests/playwright.config.js tests/aero-fighters/` verde.
2. Sem horizonte brilhante à noite; entardecer alaranjado visível; sem borda de mundo
   flutuante; montanhas presentes no horizonte em qualquer direção (screenshots).
3. Cidade com janelas (acesas à noite), telhados e ≥3 tipologias; árvores com copas
   compostas; rio contínuo visível; rodovias ≥8 corredores ou teto de dados OSM.
4. Céu diurno com gradiente atmosférico; sol/explosões com bloom sutil.
5. Draw calls totais ≤ onda anterior + ganhos (meta ≤ 400 após merge de nuvens) e
   triângulos ≤ 800k.

> **Nota pós-release (2026-07-18):** o diretório do jogo foi movido de `aero-fighters/` para `src/web-games/aero-fighters/` (decisão do operador). O caminho canônico novo é `src/web-games/aero-fighters/`.
