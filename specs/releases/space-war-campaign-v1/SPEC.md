# SPEC — Release: space-war-campaign-v1

**Status:** Aprovado
**Aprovação:** 2026-07-03 — goal do operador: "understand and implement all backlog for space-war" (diretriz autônoma; decisões de grill registradas em §6).
**Release ID:** space-war-campaign-v1
**Owner:** product-engineer
**Opened:** 2026-07-03
**Segment:** rc-1 (2026-07-03) — alpha-1 fechado com QA APPROVE 11/11 (unit 26 + smoke 12 + campanha 7 verdes); ship conforme TASKS T-CP-06
**Backlog:** `specs/backlog/space-war-phased-campaign-physics-enemies.md` (candidate → promovido)
**Bugs:** `space-war-solar-flare-universe-overlay` (MEDIUM — SEMPRE resolvido: lei bug-always-solved)
**Depende de:** `space-war-celestial-components-v1` (rc-1, PR #10) — branch empilhado nela.

---

## 1. Problem and context

O space-war é um sandbox aberto: as 4 missões existem só no Sistema Solar, os outros
5 sistemas são cenário sem propósito, inimigos são 3 grupos fixos (Marte/Júpiter/
Saturno) com lasers retilíneos sem física, e o flare do Sol cobre o universo inteiro
(bug MEDIUM). O backlog `space-war-phased-campaign-physics-enemies` pede: campanha
faseada com desbloqueio ordenado, inimigos/bases/armas fisicamente críveis e
map/HUD ciente da campanha.

## 2. Objective

Transformar o jogo em uma campanha de guerra espacial em 5 fases (Solar → Betelgeuse
→ Binário → Caótico → Núcleo), com missões por sistema, inimigos em frames
body-relativos com ordnance sob gravidade, bases críveis, nukes recarregáveis,
map/HUD de campanha — e o flare solar fisicamente local (bug resolvido).

## 3. Scope

- **S1 Bug flare (prioridade 1):** flare do Sol atenuado/cortado por distância
  (some além do Sistema Solar); flag de diagnóstico exposta; teste de regressão.
- **S2 Campanha:** `campaign.js` — 5 fases ordenadas; cada fase = conjunto de
  missões (`bomb` | `clear` | `visit` novo); desbloqueio ao completar a fase;
  overlays de briefing por fase; vitória final "GALÁXIA LIBERTADA". Halley entra
  como missão `visit` (cometas com relevância de missão). O sistema Véu fica de
  exploração livre (fora da campanha).
- **S3 Inimigos:** frames body-relativos (co-movem com o corpo-âncora — offsets
  locais, não posições absolutas); papéis: patrol fighter, interceptor (persegue),
  station, bomber; spawn POR FASE (não tudo no boot); zona segura da Terra mantida;
  fogo respeita oclusão do corpo-âncora e proteção de spawn; bombers/stations
  lançam BOMBAS balísticas sob gravidade (mesmo campo da nave/nukes).
- **S4 Armas:** nukes efetivamente ilimitadas via recarga (reserva 4, regen 1/20 s);
  lasers permanecem feixes de energia retilíneos (D-4); bombas inimigas ballistic
  + dano em área contra o jogador.
- **S5 Map/HUD:** mapa marca cada sistema com estado de campanha (✔ concluído /
  ▶ atual / 🔒 bloqueado); HUD mostra fase + missão + indicador de recarga de nuke.
- **S6 Testes:** `tests/space-war/campaign.spec.js` — gating de fase, desbloqueio,
  bomba inimiga sob gravidade, teto de pegada de base (≤3% da área), regressão do
  flare, recarga de nuke; smoke existente permanece verde.

## 4. Out of scope

- Novo passe cego de escala (D-3): as metas de escala do backlog foram atendidas
  por T-WR-15 (distâncias ×4, aproximação ×22/×9/×6) ANTES desta release — nenhum
  multiplicador novo; regressões pontuais só com evidência visual.
- Persistência de progresso entre sessões (campanha é por sessão).
- Sistemas fisicamente inalcançáveis antes do desbloqueio (D-2: viajar é livre;
  missões/progresso é que são bloqueados).
- Migração dos inimigos para atores N-body integrados (D-5: rails body-relativos
  com ordnance sob gravidade).
- `gravity.js` / `orbits.js`: intocados (invariante herdado da release anterior).

## 5. Dependencies and risks

| Risco | Mitigação |
|---|---|
| Smoke atual assume missão 1 = Lua e nuke decrementa | Fase 1 preserva as 4 missões solares atuais; recarga só REPÕE depois (decremento imediato preservado) |
| Bombas inimigas + gravidade custarem FPS | Bombas usam o caminho balístico simples (sem guiagem orbital); teto de projéteis |
| Oclusão cara | Teste analítico segmento-esfera só contra o corpo-âncora do inimigo |
| Flare fix regredir o visual perto do Sol | Atenuação suave por distância (não corte seco dentro do sistema); teste near/far |
| PR empilhado no PR #10 não mergeado | Base do PR = main; se #10 mergear antes, rebase limpo; senão o PR carrega ambos |

## 6. Decisões (registro grill — operador delegou via /goal)

- **D-1 Ordem de fases:** Solar → Betelgeuse → Binário BN+Pulsar → Binário Caótico
  → Núcleo (Sgr A*), como inferido no backlog. Véu (demo da release anterior) fica
  fora da campanha — exploração livre.
- **D-2 Bloqueio por missão, não por física:** sistemas continuam alcançáveis
  (preserva o sandbox/overdrive); missões e progresso só existem na fase ativa;
  HUD/mapa comunicam 🔒.
- **D-3 Escala:** metas de escala do backlog consideradas ENTREGUES por T-WR-15
  (o entry foi escrito antes do playtest da rodada ×4/×22). Sem novos multiplicadores.
- **D-4 Lasers continuam energia:** decisão explícita pedida pelo backlog ("do not
  leave ambiguous"): lasers = feixes retilíneos curtos; TODO ordnance pesado
  (nukes do jogador, bombas inimigas) é balístico sob gravidade.
- **D-5 Inimigos em rails body-relativos** com ordnance sob gravidade (não atores
  N-body plenos) — custo/benefício; revisável em release futura.
- **D-6 Bases:** teto de pegada ≤3% da ÁREA de superfície (hoje: cúpula r=0.112·R
  → ~0,3% — já dentro; o teto vira invariante testado).
- **D-7 Nukes:** reserva 4 + regen 1/20 s (missão-friendly, sem contador punitivo);
  smoke AC-05 (decremento imediato) preservado.
- **D-8 Flare:** atenuação por distância + corte além de ~1,1× o raio do Sistema
  Solar; diagnóstico `__spaceWar.sunFlareVisible` para teste determinístico.

## 7. Acceptance Criteria

- **AC-01** O jogador começa na fase Solar; missões de fases futuras não existem/
  não avançam antes do desbloqueio (gating real, testado).
- **AC-02** Completar a cadeia solar desbloqueia Betelgeuse; cada fase desbloqueia
  a próxima; a última termina em Sgr A* com vitória final.
- **AC-03** O cometa Halley tem relevância de missão (missão `visit` na fase Solar).
- **AC-04** Gravidade afeta nave, nukes do jogador E bombas inimigas (teste: bomba
  inimiga muda de velocidade sob gravidade).
- **AC-05** Nukes efetivamente ilimitadas via recarga (reserva volta a crescer
  após disparo; teto 4); decremento imediato preservado (smoke).
- **AC-06** Inimigos co-movem com seus corpos-âncora (frame body-relativo) e
  respeitam oclusão do corpo-âncora + zona segura ao atirar.
- **AC-07** Bombers/estações lançam bombas balísticas que detonam com dano em área.
- **AC-08** Base ≤3% da área de superfície do corpo (invariante testado); bases
  presas à superfície de corpos que giram/orbitam (existente, preservado).
- **AC-09** Mapa mostra estado por sistema (✔/▶/🔒) e HUD mostra fase + recarga.
- **AC-10** Flare do Sol: visível/dominante só na vizinhança solar; invisível de
  outros sistemas (bug resolvido + regressão testada).
- **AC-11** `campaign.spec.js` verde cobrindo AC-01/02/04/05/08/10; smoke 12/12
  continua verde.
