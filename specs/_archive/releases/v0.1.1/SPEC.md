# SPEC: Space War — Solar System Flight & Combat

> **Status:** Aprovado
> **Aprovação:** 2026-06-13 — aprovado pelo operador: "Go ahead, Fable 5. Do your better work."
> **Author:** Claude (Opus 4.8) / dadaia Labs
> **Created:** 2026-06-13
> **Depends on:** `specs/memory/tech-stack.md` (Three.js r165, vendored, no build step)

---

## 1. Overview

Novo jogo web jogável `space-war/` no catálogo tauan-games. É um simulador de voo
espacial em escala de Sistema Solar com gravidade real (acelerada), combate
nave-contra-nave e missões de bombardeio nuclear em planetas e luas.

O jogo é construído sobre a **mesma fundação do `aero-fighters`** (Three.js r165
vendorizado, ES modules nativos, zero build step, zero TypeScript, assets 100%
procedurais), mas com mecânica nova: voo 6-DOF no espaço, poços gravitacionais
newtonianos, decolagem a partir da Terra, e travessia livre do Sistema Solar.

Nome visível: **SPACE WAR**.

## 2. Referências (jogos existentes — extração de elementos)

Conforme pedido do operador ("grab a similar game that already exists"):

| Jogo de referência | Elemento extraído |
|---|---|
| **Spacewar! (1962)** | Núcleo: duelo de naves sob o poço gravitacional de uma estrela. O nome do jogo é uma homenagem direta. |
| **Kerbal Space Program** | Modelo de gravidade newtoniana, decolagem de um planeta, zona de não-retorno perto do Sol. |
| **Star Fox / Rogue Squadron** | Sensação arcade de dogfight, mira/lock, HUD de combate. |
| **Elite Dangerous / No Man's Sky** | Planeta "ganha forma" na aproximação, skybox galáctico (Via Láctea, nebulosas), escala. |

## 3. Requisitos funcionais (do briefing do operador)

- **FR-01 Decolagem.** A nave começa pousada na Terra; vê-se o horizonte curvo; ao
  subir, o planeta "ganha forma" (esfera completa).
- **FR-02 Voo espacial 6-DOF.** Acelerar/frear, pitch/yaw/roll, atingir altas
  velocidades.
- **FR-03 Gravidade real (acelerada).** Cada corpo (Sol, 8 planetas, luas maiores)
  exerce gravidade newtoniana sobre a nave (Σ G·M/r²). Perto do Sol há uma **zona de
  não-retorno** (escape impossível).
- **FR-04 Sistema Solar completo.** Sol + 8 planetas. Luas para Terra, Marte,
  Júpiter (4 galileanas), Saturno (Titã + Rhea), Urano (Titânia/Oberon), Netuno
  (Tritão). Anéis em Saturno (e Urano sutil).
- **FR-05 Órbitas reais aceleradas.** Terra orbita o Sol em **~30 min**; razões de
  período relativas reais para os outros planetas; Lua orbita a Terra em escala
  similar; a Terra **rotaciona ~1×/min**. Luas transladam ao redor dos planetas.
- **FR-06 Ir a qualquer corpo.** Pode-se voar até qualquer planeta/lua e até o Sol.
- **FR-07 Combate.** Naves inimigas perto de planetas, estações em luas, defesas em
  regiões de planetas sólidos. Laser/canhão da nave do jogador.
- **FR-08 Missões de bombardeio.** Lançar **nukes** em alvos (bases alienígenas) em
  luas e planetas; grande espetáculo de explosão.
- **FR-09 Background galáctico bonito.** Banda da Via Láctea grande e clara;
  Andrômeda e galáxias satélite (Nuvens de Magalhães) mais distantes; nebulosas
  famosas (Órion, Carina, Águia, Hélix); estrelas; buracos negros (disco +
  anel de acreção); supernova; quasares distantes com cor **desviada para o
  vermelho (redshift)**. Cores muito bonitas e vibrantes.
- **FR-10 Mapa do sistema.** Overlay mostrando Sol, planetas, órbitas e a posição
  atual da nave (tecla M).
- **FR-11 HUD.** Velocidade, throttle, altitude/distância, corpo gravitacional
  dominante, alvo, armas (laser + nukes), missão, alerta de gravidade.

## 4. Não-objetivos (escopo desta release)

- Não há multiplayer.
- Não há terreno caminhável na superfície dos planetas (aproximação + bombardeio
  orbital apenas).
- N-corpos completo (planetas perturbando uns aos outros) **não** é simulado — os
  corpos seguem órbitas cinemáticas; só a **nave** sofre gravidade (problema
  restrito), exatamente como KSP no patched-conics simplificado.
- Sem áudio obrigatório (efeitos simples opcionais).

## 5. Critérios de aceitação

- AC-01 O jogo abre em `space-war/index.html` sem build step, importando
  `../vendor/three.module.min.js`.
- AC-02 A nave decola da Terra e o planeta ganha forma esférica ao subir.
- AC-03 Os 8 planetas + Sol + luas listadas existem, com órbitas em movimento e a
  Terra completando uma volta em ~30 min (tolerância ±10%).
- AC-04 A nave sofre puxão gravitacional perceptível perto de corpos; existe uma
  zona perto do Sol de onde não se escapa no throttle máximo.
- AC-05 Há inimigos atacáveis e o laser os destrói; há ao menos uma missão de nuke
  com explosão espetacular.
- AC-06 O skybox mostra a banda da Via Láctea, ≥3 nebulosas distintas, Andrômeda,
  ≥1 buraco negro e quasares avermelhados.
- AC-07 O mapa do sistema (M) mostra órbitas e a posição da nave.
- AC-08 Smoke test Playwright: a cena inicializa, `window.__spaceWar` expõe estado,
  e não há erro de console fatal.

## 6. Reference Inputs

Memory: [[tech-stack]], [[index]]. Fundação de código: `aero-fighters/src/*`
(padrão de módulos, HUD, vendor import). Nenhum asset externo entra em runtime.
