# SPEC — Release: space-war-celestial-components-v1

**Status:** Aprovado
**Aprovação:** 2026-07-03 — mandato direto do operador: "Define the release and implement it" (goal /goal da sessão; backlog `space-war-celestial-body-component-library` escrito e aprovado na mesma sessão).
**Release ID:** space-war-celestial-components-v1
**Owner:** product-engineer
**Opened:** 2026-07-03
**Backlog:** `specs/backlog/space-war-celestial-body-component-library.md` (candidate → promovido por esta release)
**Referência científica:** NASA — Types of Stars <https://science.nasa.gov/universe/stars/types/>

---

## 1. Problem and context

Todo corpo celeste do space-war é construído à mão: `bodies.js` (1.193 linhas)
concentra 5 funções bespoke de montagem (uma por sistema), cada "instância" de corpo
é um object literal sem tipo montado em ≥5 lugares com campos inconsistentes, e cada
parâmetro físico (`mu`, `radius`, `soi`, cores, knobs de shader) é um número
hand-tuned em `config.js` que o autor mantém coerente manualmente. Refinar a
aparência/física de um TIPO de corpo exige caçar cada instância; criar um sistema
novo exige escrever código novo. A massa não determina nada — no universo real, a
massa determina quase tudo (cor, raio, destino evolutivo).

## 2. Objective

Transformar os corpos celestes em uma **biblioteca de componentes parametrizáveis**
— `Star` superclasse + subclasses da taxonomia NASA, planetas, luas, cometas,
buracos negros, estrelas de nêutrons — instanciáveis por parâmetros físicos (massa,
velocidade angular, órbita) e automaticamente interativos nos sistemas, de modo que
os 5 sistemas atuais virem **dados declarativos** e um sistema novo custe zero código.

## 3. Scope

- **S1 Núcleo físico puro** (`celestial/physics.js`, sem THREE): massa→μ (escala
  solar/terrestre do jogo), massa→cor espectral (O azul → M vermelho), massa→raio
  default, SOI de Hill, vis-viva, período de Kepler, gravReach default. Testável em
  node puro.
- **S2 Átomos visuais** (`celestial/atoms.js`): shaders (estrela, disco, remanescente),
  sprites radiais, texturas procedurais de planeta, atmosfera, anéis, flare — extraídos
  verbatim de `bodies.js` e exportados como módulos reutilizáveis.
- **S3 Base + movimento** (`celestial/body.js`, `celestial/motion.js`):
  `CelestialBody` carrega exatamente o record que `gravity.js`/`orbits.js` consomem;
  componentes de movimento plugáveis 1:1 com os regimes existentes (Pinned,
  KeplerRail, MoonRail, EllipseRail, BinaryPair, NBodyDynamic).
- **S4 Hierarquia estelar NASA** (`celestial/stars.js`): `Star` superclasse
  (shader de convecção, corona, luz, defaults derivados de massa) e subclasses que
  herdam e adicionam características próprias: `MainSequenceStar` (0.08–200 M☉ —
  massa baixa É uma anã vermelha), `RedGiant`, `RedSupergiant` (células gigantes,
  limbo assimétrico, envelope de poeira), `WhiteDwarf`, `BrownDwarf` (13–80 M♃,
  quase sem luz), `NeutronStar` (anatomia pulsar: toro síncrotron, jatos-agulha,
  gaiola dipolo, farol), `BlackHole` (horizonte, anel de fótons, disco com rotação
  diferencial + Doppler, lente billboard, jato opcional). Escada de destino
  documentada: <8 M☉ → anã branca; 8–20 → estrela de nêutrons; >20 → buraco negro.
- **S5 Não-estelares** (`celestial/planets.js`): `Planet` (rock/gas/ice/earth/cloud,
  atmosfera, anéis), `Moon`, `Comet` (**novo**: elipse excêntrica + coma + cauda
  anti-solar que cresce perto do periélio).
- **S6 Montagem declarativa** (`celestial/system.js` + `universe.js`): builder
  genérico único; os 5 sistemas re-expressos como dados (instanciações tipo+params);
  as 5 funções bespoke deletadas; `bodies.js` vira fachada mantendo os imports de
  `main.js` (`buildSolarSystem`, `updateBodyFX`, `updateSOIView`).
- **S7 Prova de reuso**: 1 cometa no Sistema Solar; 1 sistema novo (gigante
  vermelha + anã branca binária com cometa) autorado SÓ com dados.
- **S8 Testes**: derivation-laws em node (padrão `tests/aero-fighters/tools/`);
  smoke Playwright existente verde (paridade `window.__spaceWar`); screenshot de
  sanidade visual.

## 4. Out of scope

- Campanha em fases / gating de sistemas (backlog irmão
  `space-war-phased-campaign-physics-enemies` — esta release é o enabler dele).
- Magnetar como subclasse distinta (fica anotado como follow-up; NeutronStar cobre).
- Mudança de gameplay/balanceamento: valores físicos migrados devem PRESERVAR o
  comportamento atual (μ, raios, SOIs efetivos idênticos nos 5 sistemas).
- Alterar `gravity.js`/`orbits.js` — a prova de que a componentização é real é que
  eles não precisam mudar.
- Migração do pipeline de escala (`approachScale`, distâncias ×4): permanece em
  `config.js` como está; a biblioteca consome os valores já escalados.

## 5. Dependencies and risks

| Risco | Mitigação |
|---|---|
| Regressão visual sutil na migração dos 5 sistemas | Extração verbatim dos shaders/texturas; smoke + screenshot antes/depois; parity harness `window.__spaceWar` |
| Campos do record consumidos por gravity/orbits/nav/map/hud divergirem | `CelestialBody` define o record canônico num único lugar; contrato listado no PLAN §2 |
| THREE em node (testes) | `physics.js` puro sem imports de THREE |
| Sistema novo (6º) perturbar nav/map/missions | nav/map são data-driven sobre `SYSTEMS`; missões são solar-only; smoke cobre |
| Trabalho anterior não pushado no branch base (T-WR-14/15) | Branch desta release nasce do HEAD atual; os commits anteriores viajam juntos no eventual PR — anotado para o operador |

## 6. Decisões (registro grill — operador delegou; racional documentado)

- **D-1 Herança para taxonomia, composição para movimento/visual.** O operador pediu
  explicitamente classes que "herdam" a superclasse `Star`. Movimento é componente
  plugável (qualquer corpo × qualquer regime) — herança aqui explodiria em produto
  cartesiano.
- **D-2 NeutronStar e BlackHole herdam de Star.** A página da NASA os lista como
  tipos estelares (remanescentes); mantém a taxonomia única que o operador pediu.
  Override completo do visual build.
- **D-3 Escala μ do jogo preservada.** API em massas solares/terrestres;
  μ = 1.0e12·M☉ (== `mu(333000)`) e μ = 3.0e6·M⊕ (== `MU_EARTH`). Corpos migrados
  passam massa retro-calculada (Betelgeuse μ 1.6e13 ↔ 16 M☉ — já era o comentário
  do config). Zero mudança de comportamento.
- **D-4 Layout:** pacote `space-war/src/celestial/` (physics, atoms, body, motion,
  stars, planets, system, index) + `universe.js` com o mapa declarativo;
  `bodies.js` reduz a fachada.
- **D-5 Paridade estrutural, não pixel-perfect.** Shaders extraídos verbatim ⇒
  visual idêntico por construção; a validação é o smoke + contagem/nomes de corpos
  + screenshot de sanidade, não diff de pixels.
- **D-6 Envelope de poeira/pluma (Betelgeuse) e remanescente de supernova viram
  componentes decorativos reutilizáveis** (`decorations` no def do sistema) — baratos
  de generalizar agora que o builder é único.
- **D-7 Sem push nesta release até o rc:** implementação + review + commits locais;
  o operador decide ship/iterate no fim do rc (release-governance).

## 7. Acceptance Criteria

- **AC-01** Qualquer corpo é criado por API tipada com parâmetros físicos (mínimo
  massa; opcionais: spin/velocidade angular, raio/visual overrides, componente de
  movimento). Nenhum object literal ad-hoc de corpo sobra em `bodies.js`/sistemas.
- **AC-02** `Star` é superclasse; cada tipo estelar é subclasse que herda e adiciona
  características próprias, seguindo a taxonomia NASA.
- **AC-03** Para main-sequence, massa sozinha determina defaults coerentes de cor,
  raio e μ (0.2 M☉ lê como anã vermelha; 15 M☉ lê como estrela azul quente) —
  testado em node.
- **AC-04** Buracos negros, estrelas de nêutrons, planetas, luas e cometas são
  componentes instanciáveis com o mesmo contrato base.
- **AC-05** Corpos instanciados interagem out-of-the-box (gravidade da nave, órbitas,
  SOI/HUD, colisão) **sem editar `gravity.js`/`orbits.js`** (diff vazio nesses arquivos).
- **AC-06** Refinar um tipo em UM lugar propaga a todas as instâncias (as estrelas
  de solar/chaotic/core usam o MESMO `Star.buildVisual`).
- **AC-07** Os 5 sistemas atuais reconstruídos declarativamente com paridade
  (smoke verde; mesmas contagens/nomes de corpos; funções bespoke deletadas).
- **AC-08** O 6º sistema demo (gigante vermelha + anã branca + cometa) existe e é
  100% dados em `universe.js` — zero função de montagem nova.
- **AC-09** Cometas são componentes de primeira classe com órbita excêntrica e cauda
  anti-solar; ≥1 cometa no Sistema Solar.
- **AC-10** `node` derivation-tests + smoke Playwright de space-war verdes.
