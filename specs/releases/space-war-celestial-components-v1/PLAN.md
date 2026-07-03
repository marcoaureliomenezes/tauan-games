# PLAN — Release: space-war-celestial-components-v1

**Status:** Aprovado
**SPEC:** `specs/releases/space-war-celestial-components-v1/SPEC.md` [Aprovado]
**Created:** 2026-07-03

---

## 1. Arquitetura alvo

```
space-war/src/
  celestial/
    physics.js   ← PURO (sem THREE): leis de derivação (massa→μ/cor/raio, Hill, vis-viva, Kepler)
    atoms.js     ← átomos visuais (shaders, sprites, texturas procedurais, atmosfera, anéis, esfera)
    body.js      ← CelestialBody (record canônico gravity/orbits + group/mesh/fx + register())
    motion.js    ← Pinned | KeplerRail | MoonRail | EllipseRail | BinaryPair | NBodyDynamic
    stars.js     ← Star ⟶ MainSequenceStar | RedGiant | RedSupergiant | WhiteDwarf | BrownDwarf
                          | NeutronStar | BlackHole  (herança; visual build por subclasse)
    planets.js   ← Planet | Moon | Comet
    system.js    ← buildSystem(def): instancia bodies + decorações + beacon; ÚNICO builder
    index.js     ← re-exports
  universe.js    ← MAPA DECLARATIVO: 6 sistemas como dados (tipo + params + motion)
  bodies.js      ← fachada: buildSolarSystem() → universe; updateBodyFX; updateSOIView
  config.js      ← intocado (constantes/escala); universe.js consome SUN/PLANETS/BINARY/…
  gravity.js     ← INTOCADO (AC-05)
  orbits.js      ← INTOCADO (AC-05)
```

## 2. Contrato do record de corpo (canônico em `body.js`)

Consumidores auditados: `gravity.js`, `orbits.js`, `nav.js`, `map.js`, `missions.js`,
`enemies.js`, `weapons.js`, `main.js` (via `game.bodies`).

- Identidade/física: `def` (com `key,name,kind,radius,rs?,color,disk?`), `mu`, `soi`,
  `gravReach`, `system`, `isSun`, `isMoon`, `parent`, `moons[]`.
- Cinemática: `worldPos`, `worldVel`, `worldAcc`, `_pvp` (mantidos por orbits.js).
- Regimes: `orbitCenter`+`orbit`+`period`+`angle` (rail), `ellipse` (kepler elíptico),
  `binaryPair`+`barycenter`+`pairRadius`+`pairPhase`+`period` (par),
  `dynamic`+`vel`+`acc`+`softening`+`anchor`+`systemDef`+`centralMu`+`reinjectR`
  (N-corpos), `spin`, `retrograde`.
- Visual: `group`, `mesh` (+ fx registrado no ticker de `system.js`).

`CelestialBody` materializa os campos com os MESMOS nomes; os componentes de motion
apenas setam o subconjunto do seu regime (idêntico ao que os builders bespoke setavam).

## 3. Leis de derivação (`physics.js`)

- `muFromSolarMasses(M) = 1.0e12·M`; `muFromEarthMasses(M) = 3.0e6·M` (escala atual).
- `spectralFromMass(M☉)`: rampa O→M (≥16 azul 0xbcd2ff · ≥8 azul-branco · ≥1.4 branco
  · ≥1.04 amarelo-branco 0xfff2bf · ≥0.8 amarelo · ≥0.45 laranja · <0.45 anã vermelha
  0xff6a3a) → {color, color2, cellScale sugerido}.
- `radiusFromMass(M☉)` (main sequence, escala do jogo): R ≈ R_SUN_GAME·M^0.8 com
  clamps; tipos evoluídos definem seus próprios defaults (subclasse).
- `hillSoi(rPeri, mu, muParent)`, `visVivaSpeed(mu, r, a)`, `keplerPeriod(a, mu)`,
  `defaultGravReach(def)` (movido/re-exportado de config).
- Escada de destino (doc + helper `remnantTypeForMass`): <8→white-dwarf, 8–20→neutron,
  >20→black-hole.

## 4. Estratégia de migração (paridade primeiro)

1. **Extração verbatim** dos átomos visuais (zero edição de GLSL/canvas) → `atoms.js`.
2. Classes construídas SOBRE os átomos reproduzindo exatamente os builds atuais
   (`buildStar`, `buildPlanetBody`, `buildBlackHole`, `buildNeutronStar`).
3. `universe.js` re-expressa os 5 sistemas com os MESMOS valores de `config.js`
   (massa retro-calculada onde a API pede massa: μ/1e12 solar, μ/3e6 terrestre).
4. Lógica peculiar de cada sistema vira dado/decoração: envelope+pluma (Betelgeuse),
   corrente de acreção + remanescente (binário), elipses randomizadas (core: gerador
   determinístico chamado pelo def), jitter (chaotic), beacons/culling (system.js).
5. Deletar as 5 funções bespoke; `bodies.js` fica <80 linhas de fachada.
6. Só DEPOIS da paridade verde: cometa solar + 6º sistema demo (dados apenas).

## 5. Testes

- `tests/space-war/tools/test-celestial-unit.js` (node puro, padrão aero):
  leis de derivação, monotonicidade massa→cor/raio, Hill, vis-viva, Kepler,
  escada de destino. Script npm `test:space-war:unit`.
- Smoke Playwright existente (`tests/space-war/smoke.spec.js`) INTOCADO e verde —
  é o harness de paridade (contagem de corpos, órbita da Terra, gravidade, nav, FPS).
- Sanidade visual: screenshot dos sistemas migrados via dev server registrado.

## 6. Sequência de ondas

- **W1** physics.js + unit tests (T-CC-01)
- **W2** atoms.js extração (T-CC-02) · body.js+motion.js (T-CC-03)
- **W3** stars.js (T-CC-04) · planets.js (T-CC-05)
- **W4** system.js + universe.js + migração 5 sistemas + fachada (T-CC-06)
- **W5** cometa solar + sistema demo (T-CC-07)
- **W6** testes verdes + dev server + screenshots (T-CC-08) · QA review · commits

Rollback: cada onda comita separada; a fachada preserva os imports de `main.js`,
então reverter W4+ restaura o comportamento anterior sem tocar consumidores.
