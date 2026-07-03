# SPEC — Release: space-war-ballistic-war-v1

**Status:** Aprovado
**Aprovação:** 2026-07-03 — demanda direta do operador em playtest (transcrita no backlog entry); decisões em §4.
**Release ID:** space-war-ballistic-war-v1
**Owner:** product-engineer
**Backlog:** `specs/backlog/space-war-ballistic-war-v1.md`
**Segment:** rc-1 (2026-07-03) — alpha-1 QA APPROVE 6/6 ACs; e2e 21/21; ship conforme TASKS

## 1. Objective

Guerra balística honesta: C calcula a SOLUÇÃO DE TIRO sob o campo gravitacional real
dos corpos componentizados (a nuke faz o arco curvo até o alvo), a campanha vira uma
CAÇADA sequencial de alvos entre luas e naves capitais (5/7/9/11/13 por fase), as
bases ficam legíveis e a explosão nuclear fica realista.

## 2. Scope

- **S1 Solver balístico** (`ballistics.js`): dado estado da nave, alvo (posição+
  velocidade do corpo hospedeiro) e velocidade de lançamento, iterar direções de tiro
  simulando a trajetória com o MESMO `computeGravity` do jogo (corpo dominante +
  marés — física séria, não estrita) até miss < tolerância. Devolve direção, tempo de
  voo e pontos do arco (para o HUD). Testável em node via gravityFn injetada.
- **S2 C = solução de tiro:** com alvo de missão, C alinha o nariz à DIREÇÃO DE
  LANÇAMENTO (não ao alvo); HUD desenha o arco previsto + marcador de impacto;
  F lança a nuke com a solução → projétil `aimed` segue GRAVIDADE PURA (a guiagem de
  espiral orbital fica só para tiro livre sem solução — compat com T-WR-15).
- **S3 Caçada sequencial:** cada fase tem `hunt` de N alvos (Solar 5, Betelgeuse 7,
  Binário 9, Caótico 11, Núcleo 13) distribuídos em luas/planetas DIFERENTES ou
  NAVES CAPITAIS orbitando corpos (binário = 100% naves); destruir o alvo k spawna o
  k+1 em outro corpo + retarget automático do nav + toast com a localização; escoltas
  (2-3 caças) nascem com cada alvo. Missões `visit` mantidas após a caçada.
- **S4 Anatomia legível:** base v2 (plataforma + cúpula de comando com janelas
  emissivas + módulos habitat + antena + luzes de perímetro + pad) respeitando o teto
  ≤3% de área; NAVE CAPITAL nova (casco alongado ~600-900 u, brilho de motores,
  luzes de navegação) em órbita body-relativa lenta.
- **S5 Explosão realista:** impacto em superfície → COGUMELO (coluna + copa + anel de
  choque no plano da superfície, ~20 s, referência aero nuclear-fx); no vácuo →
  casca esférica em expansão + duplo flash. Orientado pela normal do corpo.
- **S6 Testes:** solver em node (arco curva e acerta em campo central analítico);
  e2e: solução válida + nariz alinhado à direção de tiro ≠ direção direta, cadeia de
  caçada avança para corpo diferente, contagens 5/7/9/11/13, smoke+campanha verdes.

## 3. Out of scope

`gravity.js`/`orbits.js`/`config.js`/`universe.js` intocados. Persistência. Lasers
(seguem energia). Guiagem de espiral REMOVIDA apenas para tiros com solução.

## 4. Decisões

- **D-1** Solver por iteração de alvo virtual (shooting method) com passo fixo 0.1 s
  e teto 45 s — "sério, não estrito": converge em campos suaves; sem solução → HUD
  avisa e C cai no apontamento direto.
- **D-2** Alvo em movimento: predição linear (worldVel × tof) refinada por 2
  iterações de ponto fixo.
- **D-3** Solução recalculada a cada 0.3 s enquanto C ativo (custo ~2 M ops — ok).
- **D-4** Binário sem superfícies → naves capitais em órbitas largas do BN/pulsar.
- **D-5** Contagens por fase substituem as missões `clear` (as escoltas são os caças);
  `visit` mantidas.

## 5. Acceptance Criteria

- **AC-01** Com alvo de missão, C alinha à direção de LANÇAMENTO calculada sob o
  campo real; HUD mostra o arco e o ponto de impacto previsto.
- **AC-02** Nuke lançada com solução segue gravidade pura e acerta o alvo previsto
  (tolerância = raio de detonação); a trajetória é visivelmente CURVA quando o campo
  dobra o tiro (teste: direção de tiro ≠ direção direta perto de corpo massivo).
- **AC-03** Caçada: destruir o alvo k faz o k+1 aparecer em OUTRO corpo, nav
  retargeta e o toast anuncia; contagens 5/7/9/11/13 por fase.
- **AC-04** Alvos são bases de superfície legíveis (v2) ou naves capitais orbitando
  corpos; escoltas nascem com cada alvo.
- **AC-05** Explosão: cogumelo orientado pela normal em impactos de superfície;
  casca + duplo flash no vácuo.
- **AC-06** Solver validado em node; e2e da caçada + solução verdes; smoke 12/12 e
  campanha (adaptada) verdes; protegidos com diff vazio.
