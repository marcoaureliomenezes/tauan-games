# SPEC — Release: space-war-physics-fidelity-v1

> **Status:** Aprovado — 2026-07-04 (operador via /goal; workflow inteiro no agente principal Fable 5)
> **Origem:** revisão de fidelidade física 2026-07-04 (report `2026-07-04T005415Z-space-war-physics-fidelity-review.html`, 30+ referências) + demanda de arsenal gravitacional + escala de aproximação.
> **Segment:** rc-1

## 1. Objetivo

Elevar o space-war a simulador validável por físicos: corrigir as 4 violações (P1),
aplicar os 8 upgrades de fidelidade (P2), entregar o arsenal gravitacional de 3 armas
(nuke existente + bomba traçadora gravitacional + bomba de bóson de Higgs) — todas
acopladas ao campo gravitacional real — e a ESCALA DE PAREDE (corpos ×10:
horizonte reto em voo rasante, luas re-espaçadas por Kepler — ver AC-06 emendado).

## 2. Física de referência (briefs 2026-07-04)

- **Paczyński–Wiita 1980:** a = μ/(r−r_s)² → ISCO real em 3·r_s, mergulho abaixo dela.
- **TOV:** massa máxima de estrela de nêutrons ≈ 2.2 M☉ (mais pesada conhecida: 2.08).
- **Crab (ATNF):** Ė = 4π²IṖ/P³ ≈ 1.2×10⁵ L☉ — pulsar jovem CEGA de perto; pulsa em
  luz visível a 30 Hz; brilho superficial visível ≈ 173× o solar.
- **EHT:** borda da sombra (anel) em 2.6·r_s; assimetria Doppler ~10:1; vão escuro
  horizonte→ISCO.
- **Sgr A\*:** 4.15×10⁶ M☉ (GRAVITY 2019), quiescente (~10⁻⁹ L_Edd).
- **Maré:** ∂g = 2μh/r³ — BN estelar estraçalha a ~100·r_s; SMBH deixa cruzar.
- **Extração de plasma (Higgs):** transbordo de lobo de Roche p/ um poço transiente —
  o gás flui pelo L1 ao poço; cessado o poço, a estrela reabsorve (Eggleton 1983).
- **Supernova:** filamentos multicoloridos do remanescente do Crab (H vermelho,
  O verde-azul, S amarelo).

## 3. Acceptance Criteria

- **AC-01 (P1-1/P2):** A estrela de nêutrons EMITE luz (PointLight no def) e o núcleo
  é azul-branco ofuscante com halo; e2e prova pixels claros com a câmera apontada p/ a
  NS e `def.light` presente. Strobe óptico ~30 Hz vivo (uniform/flag testável).
- **AC-02 (P1-2/P1-3/P2-10):** μ_NS = 2.0e12 (≤ TOV); μ_SgrA ≥ 4.0e13 (> μ_BN-estelar);
  companheira de Betelgeuse ≥ 0.09 M☉ OU reclassificada BrownDwarf. Trilhos das
  estrelas S rederivam do novo μ (período ∝ 1/√μ) e continuam seguíveis.
- **AC-03 (P2-5/6/7):** `_accelOf` usa Paczyński–Wiita p/ kind blackhole/neutron
  (guarda r > 1.05·r_s); node test: órbita circular a 3.5·r_s sobrevive ≥3 períodos,
  a 2.9·r_s mergulha; disco com borda interna 3·r_s; anel de fótons a 2.6·r_s.
- **AC-04 (P2-8):** zona de maré: dano ∝ 2μh/r³ acima de limiar p/ BN/NS (calibrado:
  perigoso mas escapável a ~60-100 r_s do BN estelar); SMBH atravessável até perto do
  horizonte (fator de maré por def). Node test do gradiente.
- **AC-05 (armas):** [G] bomba traçadora gravitacional — INFINITA, balística sob o
  campo real, LUMINOSA (núcleo emissivo + glow) com TRILHA visível do caminho
  percorrido; [H] bomba de Higgs — balística; ao armar vira POÇO gravitacional
  transiente (μ_higgs por ~8 s) sentido pela nave, projéteis e plasma (game.wells
  somado em computeGravity); perto de estrela: braços de plasma esticam da fotosfera
  ao poço (70%) e são reabsorvidos ao fim; 30% (roll) OU mergulho da bomba na estrela
  antes do fim do pulso → SUPERNOVA multicolorida (cascas + filamentos H/O/S + flash +
  shockwave + dano em área). e2e: as 3 armas disparam, tracer conta ∞, poço altera
  computeGravity mensuravelmente.
- **AC-06 (escala de parede — EMENDADO na implementação):** o mecanismo dinâmico
  (renderScale por distância) foi DESCARTADO durante a implementação: contato no
  raio visual dinâmico gera geometria degenerada (superfície-Zenão: o chão foge ou
  persegue a nave) e luas engolfadas. Entregue o equivalente ESTÁTICO consistente:
  planetas e luas ×10 permanentes (μ ∝ f — v_circ/v_esc de superfície preservadas),
  órbitas de luas re-espaçadas (piso 2.1·R) com períodos REDERIVADOS por Kepler
  (T ∝ √(a³/μ) — velocidade linear original preservada, luas alcançáveis pela
  balística), órbitas planetárias ×2, SOIs condicionais (varrido de sobreposição no
  unit test), Sol ×5 (μ ×5: v_esc de superfície idêntica — zona de não-retorno
  AC-04b verificada por unit test), Betelgeuse ×2.5 (segue a maior), compactos NÃO
  escalam. Terra R=22000: a 300 u de altitude o mergulho do horizonte é 9.4° —
  a "reta" pedida. e2e: Terra ≥ 22000, luas dentro da SOI, voo rasante são.
  > **SUPERSEDED (2026-07-04, release space-war-true-proportions-v1):** o operador
  > RETIFICOU a demanda ("I cannot see the sun so bigger from the earth, it's
  > fake... bigger while we approach, small as we travel — like in nature"): a
  > inflação ESTÁTICA ×10/×5 quebrava os volumes aparentes (Sol ~30° do céu da
  > Terra; Saturno disco gigante; sistemas vizinhos visíveis). A escala vigente é
  > a das PROPORÇÕES VERDADEIRAS (θ = 2R/d honesto) — ver
  > `specs/releases/space-war-true-proportions-v1/SPEC.md` e o bug
  > `space-war-fake-apparent-proportions`. As LEIS deste AC que sobrevivem:
  > μ ∝ f (gauge de superfície), Kepler √(k³/f) nas luas, varrido de SOIs,
  > compactos fora de escala estática.
- **AC-07 (regressão):** suíte space-war completa verde (smoke 12 + campanha 9 + unit
  celestial/balística) com retunes documentados; aero intocado.

## 4. Não-escopo

Relatividade completa (métrica de Kerr, dilatação temporal), remanescente pós-supernova
persistente (a estrela re-estabiliza após ejetar o envelope — documentado como licença
de gameplay), reescala do sistema solar inteiro.

## 5. Write set

`space-war/src/**` (inclui gravity.js, config.js, universe.js, celestial/**),
`tests/space-war/**`, `package.json` (scripts), esta pasta de release, memory na CLOSURE.
**Proibido:** `aero-fighters/**`, `tauan-trex/**`, `vendor/**`.
