# PLAN: Space War — Solar System Flight & Combat

> **Status:** Aprovado
> **Aprovação:** 2026-06-13 — operador: "Go ahead, do your best work."
> **SPEC:** `specs/releases/space-war-v1/SPEC.md` [Aprovado]
> **Created:** 2026-06-13

---

## 1. Goal e modelo de operação

Construir `space-war/` como jogo Three.js procedural, sem build step, espelhando a
arquitetura modular de `aero-fighters/` (orquestrador `main.js` + módulos de
responsabilidade única). Implementação direta por agente único (build criativo a
pedido do operador), com smoke test Playwright ao final.

## 2. Modelo físico (decisões de engenharia)

- **Unidades.** 1 unidade Three.js = 1.000 km. AU ≈ 149.600 u. Para manter o jogo
  navegável e evitar perda de precisão float em escala real, distâncias planetárias
  usam um **fator de compressão radial** `K≈0.18` aplicado ao raio orbital (o
  Sistema fica denso o suficiente para travessia em minutos), mas as **razões de
  período orbital são reais** (Kepler relativo).
- **Tempo.** `EARTH_YEAR = 1800 s` (30 min). Período de cada planeta =
  `EARTH_YEAR · (T_planeta/T_terra)` usando períodos reais. Rotação da Terra = 60 s.
  Lua orbita a Terra em ~45 s (escala "similar" pedida).
- **Gravidade.** Cada corpo tem `mu = G·M` tunado por um fator global `GFAC` para que:
  (a) perto de um planeta sinta-se puxão; (b) exista raio de não-retorno no Sol a
  throttle máximo. Aceleração da nave = `Σ mu_i · (p_i - p_ship)/|d|³`. Planetas são
  cinemáticos (não sofrem gravidade) — problema restrito.
- **Voo.** Nave Newtoniana: empuxo ao longo do nariz, sem arrasto no espaço; dentro
  da atmosfera (perto da superfície da Terra) há leve arrasto + sustentação para a
  fase de decolagem.

## 3. Renderização

- **Skybox** = esfera invertida gigante com `CanvasTexture` pintada proceduralmente:
  campo de estrelas (com classes de cor/redshift), banda da Via Láctea, Andrômeda,
  Nuvens de Magalhães, nebulosas (Órion/Carina/Águia/Hélix), buracos negros,
  supernova, quasares vermelhos. Pintura 2D em canvas de alta resolução = controle
  total de cor.
- **Planetas** = esferas com material procedural por corpo (cores/bandas/manchas),
  atmosfera por fresnel additive sphere, anéis para Saturno/Urano.
- **Sol** = esfera emissiva + glow sprite + `PointLight` + corona; LOD.
- **LOD/escala-aparente** = corpos distantes ainda visíveis (tamanho mínimo angular)
  para "ganhar forma" na aproximação.
- **Bloom** = leve, via composição manual (sem postprocessing externo pesado) ou
  additive sprites; manter custo baixo (Iris Xe).

## 4. Módulos (`space-war/src/`)

| Módulo | Responsabilidade |
|---|---|
| `config.js` | Constantes: unidades, tempo, GFAC, dados dos corpos (massa, raio, órbita, cor). |
| `state.js` | Estado global `game` (window.__spaceWar). |
| `scene.js` | scene/camera/renderer/luzes. |
| `skybox.js` | Skybox galáctico procedural (Via Láctea, nebulosas, BHs, quasares). |
| `bodies.js` | Construção de Sol/planetas/luas + materiais procedurais + anéis. |
| `orbits.js` | Movimento cinemático orbital + rotação (Kepler relativo). |
| `gravity.js` | Campo gravitacional newtoniano sobre a nave + detecção de zona de não-retorno. |
| `ship.js` | Nave do jogador: mesh, voo 6-DOF, throttle, decolagem. |
| `input.js` | Teclado/mouse. |
| `weapons.js` | Lasers + nukes + projéteis. |
| `enemies.js` | Naves inimigas, estações, defesas de superfície, IA simples. |
| `missions.js` | Objetivos de bombardeio + progressão. |
| `fx.js` | Partículas: motor, explosões, nuke spectacle, trilhas. |
| `hud.js` | HUD textual + alertas. |
| `map.js` | Overlay do mapa do sistema (canvas 2D). |
| `main.js` | Orquestrador + loop rAF. |

## 5. Sequência de implementação (waves)

1. **W1 Fundação** — config, state, scene, skybox, bodies, orbits, loop básico (voo livre + planetas em órbita).
2. **W2 Gravidade + nave** — gravity, ship (6-DOF + decolagem + atmosfera), HUD, mapa.
3. **W3 Combate + missões** — weapons, enemies, missions, fx (nuke).
4. **W4 Polish + QA** — afinação visual/cor, balance de gravidade, catálogo (card), smoke Playwright.

## 6. Riscos

- Precisão float em escala grande → mitigado por compressão radial + câmera relativa.
- Performance do skybox pintado → renderizar uma vez para textura, não por frame.
- Balance de gravidade (jogável vs "real") → expor tuning em `config.js`.
