# PLAN — Release: space-war-physics-fidelity-v1

> **Status:** Aprovado — 2026-07-04 · **SPEC:** [Aprovado]

## Decisões de engenharia

- **D-1 (PW kind-gated):** Paczyński–Wiita só em `blackhole`/`neutron` — planetas e
  estrelas normais seguem newtonianos (erro GR ~r_s/r irrelevante). r_s da NS =
  `def.rs ?? radius/2.5` (compacidade real R≈2.5·r_s).
- **D-2 (poço transiente):** `game.wells = []` — cada poço {pos, mu, until}. Somado em
  `computeGravity` DEPOIS do campo dos corpos (perturbação aditiva, sem SOI própria) e
  sentido por nave, nukes, bombas, tracers e braços de plasma. Nunca vira `dominant`
  (HUD estável).
- **D-3 (braços de plasma):** correntes de tubos/partículas da fotosfera ao poço:
  N pontos amostrados ao longo da linha estrela→poço com jitter, animados: fase
  ESTICA (0→1 ao longo do pulso), fase REABSORVE (poço morto: pontos relaxam de volta
  exponencialmente). Corpo de plasma NÃO colide; morre sozinho. Cor = paleta da
  estrela + branco no pescoço.
- **D-4 (supernova):** 3 cascas expansivas (H 0xff5a4a, O 0x4ad8c8, S 0xffd24a) +
  ~120 filamentos radiais coloridos + flash de tela + anel de choque + dano em área
  (raio ~6·R_estrela); a estrela escurece (uniform da fotosfera ×0.25) por ~40 s e
  re-estabiliza (licença documentada). Roll no ARM: 30% instável→supernova ao fim do
  pulso; mergulho (surfaceContact da bomba com a estrela durante o pulso) → supernova
  imediata.
- **D-5 (escala de parede — REVISADO):** o renderScale dinâmico foi abandonado
  (drift: contato em raio dependente da distância = superfície-Zenão degenerada;
  luas engolfadas pelo pai crescido). Implementado o rescale ESTÁTICO
  auto-consistente `wallScale()` em config.js: planetas ×10, luas ×10 c/ órbitas
  re-espaçadas E períodos Kepler √(k³/f), órbitas ×2 (periodFactor ×√(8/5)),
  SOIs ×2.2 (com luas) / ×1.6 (sem), Sol ×5/μ×5, Betelgeuse ×2.5, anel de
  vizinhos ×1.75, render/skybox ×2, overdrive ×18. Invariantes garantidos por
  varrido geométrico no test-physics-unit (sobreposição de SOIs, folga
  Mercúrio-Sol, luas ⊂ SOI, ordem de tamanhos, gauge v_esc do Sol).
- **D-6 (assist fade em SOI):** autoridade do assist ×(1 − 0.65·band) onde band =
  smoothstep(1.5·R_eff → 0.5·SOI) — decolagem/pouso plenos, altitude orbital com
  inércia honesta; overdrive e [N]/[O] inalterados.
- **D-7 (luminosidade):** `lightForMass(M)`: intensity = clamp(3·(M/1)^1.2, 1.2, 8),
  range = clamp(1e6·M^0.5, 3e5, 4e6) — monótona em M (proxy jogável de L ∝ M^3.5 sem
  estourar o range do renderer). NS: light próprio azul-branco (não deriva de massa —
  é spin-down, não fusão).
- **D-8 (beaming):** uniform de beaming do disco 0.55/0.70 → 0.35/0.85 (razão ~6:1
  percebida com bloom; 10:1 literal satura o tonemap).
- **D-9 (teclas):** [G] tracer, [H] Higgs (E/Q/F/T/C/M/N/O/V/Z ocupadas). HUD mostra
  ∞ p/ tracer e cooldown do Higgs (1 por vez ativo; recarga 12 s).

## Riscos

- **R-1:** escala dinâmica × testes de pouso/decolagem — mitigar: s=1 quando pousado/
  decolando abaixo de 1.5R (a rampa começa acima), AC-07 re-roda a suíte completa.
- **R-2:** poço Higgs × solver balístico (arcos mudam durante o pulso) — aceito
  (recompute 0.3 s), documentar.
- **R-3:** μ_SgrA ×10 acelera estrelas S (T ∝ 1/√μ ≈ /3.2) — verificar seguibilidade
  ([O] em estrela S) no e2e/probe.
- **R-4:** PW perto do disco intensifica a espiral — desejado (ISCO), calibrar p/ o
  smoke FPS não cair.

## Ordem de execução

T-PF-01 (config/massas/discos) → T-PF-02 (NS shine) → T-PF-03 (stream) → T-PF-04
(PW+maré+unit) → T-PF-05 (beaming/luzes/assist) → T-PF-06 (tracer) → T-PF-07 (Higgs+
supernova) → T-PF-08 (escala) → T-PF-09 (testes/QA/security/push/PR/CI).
