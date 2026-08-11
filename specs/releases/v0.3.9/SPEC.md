# SPEC — v0.3.9

> **Status:** Aprovado
> **Aprovação:** 2026-07-19 — operador, diretiva detalhada em sessão (playtest do
> modo inhauma-defense: "o jogo está muito difícil... precisamos desse maior poder
> de fogo").
> **Criado:** 2026-07-19
> **Base:** release `v0.3.5` (fechada). Escopo: SOMENTE o
> modo `inhauma-defense`.

## Demanda do operador (condensada)

1. **Lock vermelho persistente:** mira vermelha = míssil segue e acerta. O lock deve
   durar **3 segundos OU 3 mísseis lançados naquele alvo** (hoje expira no 1º tiro).
2. **Dois mísseis AA:** `X` fraco (avaria — **3 acertos derrubam**), taxa **2/s**;
   `B` forte (**1 acerto abate**), taxa **1 a cada 2 s**.
3. **Retargeting:** mísseis cujo alvo morre em voo **buscam o oponente mais próximo**.
4. **Rod cinético (`R`):** taxa **1/5 s**, velocidade **3×** a do míssil simples,
   **atravessa** o oponente e se redireciona ao próximo mais próximo no campo de
   visão, até destruir **3 inimigos**.
5. **Boss:** uma **formação de tropas se monta no horizonte** e avança; há uma
   **janela de tempo** para destruí-la antes que atinja a cidade. Para ela temos
   **3 nukes táticas (`T`)**.
6. Paridade de armas com o caça (1 simples ∞, 2 forte B, 3 nuke T, 4 rod R) — na
   bateria: `X`, `B`, `T`, `R`.

## Arquitetura

- Constantes em `config.js#AA_DEFENSE` (bloco WEAPONS-V1): dano por tier, taxas,
  lock-hold (3 s / 3 tiros), rod (velocidade ×3, pierce 3), boss (janela, distância,
  composição), nuke (estoque 3, raio).
- Lock: `turret.lock` ganha `shotsFired` + `lockedAt`; o gasto do lock passa a ser
  por tempo (3 s) ou 3 disparos — o que vier primeiro (defense-mode + turret-weapons).
- Mísseis: `spawnAaMissile` ganha `damage`/`tier`; `updateAaMissiles` ganha
  **retarget** quando o alvo morre (o mais próximo vivo dentro do campo de visão).
- Rod: novo projétil perfurante (pool próprio ou extensão do AA): PN direto,
  `pierceLeft=3`, ao matar/atravessar retargeta ao vivo mais próximo.
- Boss: reuso de `src/formations/` (formation.js/units.js) — `mixedBattlegroup` ou
  `troopColumn` grande spawnando no horizonte (borda do vale) e marchando para a
  cidade; HUD com aviso "HORDA NO HORIZONTE" + contagem da janela; chegada = dano
  pesado na integridade da cidade. Nuke `T`: projétil pesado com arco, megaExplosion
  + wipe por raio; estoque 3, sem recarga.
- Seleção de arma: scroll/1-5 cicla mg → X → B → T → R; HUD mostra arma ativa,
  estoque de T e cooldowns; X no `X`, e teclas diretas B/T/R além do scroll.
- Lógica pura Node-testável (lock-hold, retarget, pierce, boss window) em
  turret-weapons.js / módulo novo ≤250 linhas; testes em
  `tests/aero-fighters/tools/test-aero-defense-weapons.mjs` (adaptar) + novo arquivo
  se preciso.

## Critérios de aceite

1. Lock persiste 3 s OU 3 disparos (testado em Node + evidência visual).
2. X avaria (3 hits), B abate (1 hit), taxas 2/s e 1/2s respeitadas.
3. Míssil órfão retargeta ao vivo mais próximo (Node + visual).
4. Rod atravessa e encadeia até 3 kills, velocidade 3×.
5. Boss formation aparece no horizonte com aviso + janela; nuke T a varre (raio);
   chegada à cidade = dano pesado.
6. Suites Node verdes; zero regressão nos outros modos; prints de evidência.

## ADENDO 2026-07-19 (playtest 2 — SUBSTITUI T-W-01 e o modelo de mira)

1. **Chapa metálica REMOVIDA por completo** — só o cano da arma fica na tela
   (executado pelo coordenador em fx.js).
2. **Mira (quadrado de lock) — novo modelo de fases e acerto:**
   - Ao aproximar a mira de um alvo: **amarelo por 1,5 s** (50% de chance de acerto),
     depois **vermelho por 1,5 s** (80%), depois **amarelo de novo por 1,5 s** (50%).
   - O quadrado **some após 5 mísseis lançados** no mesmo inimigo.
   - **Disparo seguido:** cada pressão no X lança 1 míssil — 5 pressões = 5 mísseis
     (respeitando só a cadência 0,5 s; pressões dentro da cadência são enfileiradas,
     não perdidas). Segurar o X também repete na cadência.
   - Nossos mísseis são **manobráveis** — homing com trajetória curva visível
     (complementa T-W-07: rastro de fumaça ~1 s + chama de propulsão à noite).
3. **Nuke tática (T):** é **disparada do cano da bateria** com trajetória visível
   até o alvo na mira (quadrado vermelho) — NUNCA queda instantânea na cidade.
4. **Rod cinético (R):** corrigir até funcionar como especificado (1/5 s, 3×
   velocidade, perfura e encadeia até 3 abates).
