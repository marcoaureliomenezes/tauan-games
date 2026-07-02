# TASKS — aero-fighters-world-realism-v1

> **Status:** Aprovado
> **Aprovação:** 2026-07-01 — junto com SPEC/PLAN via `/goal` do operador.
> **SPEC:** `specs/releases/aero-fighters-world-realism-v1/SPEC.md`
> **PLAN:** `specs/releases/aero-fighters-world-realism-v1/PLAN.md`

## Pre-implementation checklist

- [x] SPEC.md aprovado
- [x] PLAN.md aprovado
- [x] TASKS.md aprovado
- [x] Release ativada em `specs/releases/ACTIVE.md`
- [x] Nenhuma task `[-]` duplicada

## Write set (permitido quando ativo)

- `specs/memory/product/**` (fase DEFINITION/CLOSURE — WS-0)
- `specs/memory/product/catalog.json` (regenerado)
- `aero-fighters/src/maps/inhauma-scene.js`
- `aero-fighters/src/maps/inhauma.js`
- `aero-fighters/src/maps/inhauma-road-defs.js`
- `aero-fighters/src/maps/inhauma-road-props.js`
- `aero-fighters/src/maps/inhauma-road-render.js`
- `aero-fighters/src/targets.js`
- `aero-fighters/src/config.js`
- `aero-fighters/src/sortie-state.js` (WS-6)
- `aero-fighters/src/player.js` (WS-6)
- `aero-fighters/src/main.js` (WS-6)
- `aero-fighters/src/nuclear-fx.js`
- `aero-fighters/src/fx.js`
- `aero-fighters/src/projectiles.js`
- `aero-fighters/src/debug.js`
- `aero-fighters/src/world.js` (só se WS-1/WS-3 exigir)
- `tests/aero-fighters/**`
- `specs/bugs/aero-inhauma-invisible-mountains.md` (ADITIVO)
- esta pasta de release

## Tasks

### [x] T-WR-00 — WS-0 Memory atoms (autoridade de spec) — CONCLUÍDA 2026-07-01

**Owner:** `product-engineer` · **Fase:** DEFINITION

Autorados 5 atoms em `specs/memory/product/`: `aero-strike.md` (loop/objetivo),
`aero-strike-world.md` (mapas/terreno/água/estradas/cenário), `aero-strike-flight.md`
(controles/voo/surtida), `aero-strike-combat.md` (inimigos/armas/boss), `aero-strike-fx.md`
(explosões/nuke/câmera/HUD/áudio). Placeholder `feature.md` removido; `index.md` e
`catalog.json` regenerados.

**Evidência:** `dadaia specs doctor` — os 5 atoms `[OK]`; os 2 únicos ERROR são
pré-existentes (`space-war-v1` SemVer, não desta release). AC-W0-01/02 atendidos.

### [x] T-WR-01 — WS-1 Grounding de montanha (bug "montanha invisível") — VERIFICADO

**Owner:** `game-developer` (software-engineer)

Root-cause confirmada (ver `specs/bugs/aero-inhauma-invisible-mountains.md`): a montanha
**renderiza**; o sintoma é (1) float de ~7-9 m de objetos nos cumes agudos das 2 serras
`ridge` (aliasing do mesh de 48 m), (2) helicópteros a 46 m sobre terreno plano, (3)
armadilha latente do fallback `islandHeightAt`. Corrigir os 3: ancorar objetos na
superfície renderizada nas serras (subir `TERR.seg` OU amostrador bilinear OU alargar banda
de `ridge`); rever `HELI_ALTITUDE`/reposicionar helis para serras; endurecer fallback em
`targets.js:341,346`.

**Verify:** **browser real** (dev server + screenshots) mostrando alvo de serra assentado
sem float e helis sobre relevo; probe de heightError por alvo de morro (AC-W1-01/02).

### [x] T-WR-02 — WS-3 Rio visível + árvores variadas

**Owner:** `game-developer`

Remover skip do rio (`inhauma-scene.js:227`), alargar/meandrar; tabela de 4-5 espécies de
árvore com jitter de cor por instância em `buildForests`.

**Verify:** screenshots inhauma (rio ao longo do polyline; ≥3 espécies); test de fidelidade
FPS dentro do budget (AC-W3-01/02, AC-W5-04).

### [x] T-WR-03 — WS-2 Terminação de estradas

**Owner:** `game-developer`

`buildTunnelPortals` em `inhauma-road-props.js` + wire; campos `endcap`/`startcap` e
reposição de pontas em `inhauma-road-defs.js`.

**Verify:** screenshots das 4 pontas (túnel/fronteira/terra); diagnóstico de estrada e
tráfego inalterados (AC-W2-01/02).

### [x] T-WR-04 — WS-4 Inimigos lentos móveis — VERIFICADO (spawn + movimento)

**Owner:** `game-developer`

Adicionar `tank` (solo) e `patrolAir` (ar) via receita de 7 pontos; distribuir nos layouts.

**Verify:** probe que confirma movimento (posição muda) a velocidade baixa; aparecem no
mapa (AC-W4-01).

### [-] T-WR-05 — WS-5 Nuke/explosões realistas (REWORK 2026-07-01; aceite visual do operador pendente)

**Owner:** `game-developer`

De-dup do cogumelo duplo; flash + fireball multicor → cogumelo 60 s subindo; shockwave de
solo; ignição de árvores/casas (pool com cap + guardas headless); retiming de nuclearFxState.

**REWORK (feedback do operador — "cogumelo fake, explosão fake, sem câmera nova"):**
`nuclear-fx.js` reescrito: fireball = esfera com ShaderMaterial FBM (ferve, esfria por
rampa blackbody, silhueta irregular); copa+talo+saia = UM InstancedMesh de ~134 billboards
de fumaça procedural (1 draw call, animação por uniforms na GPU — barato p/ 60 s); anéis
de condensação (Wilson); proporções reais (teto 950 m, copa ⌀~660 m); fumaça cor de poeira
iluminada (não fuligem preta). Pops secundários espalhados de fx.js reduzidos 18→7 e
aproximados do epicentro (gracioso, não caótico). **Câmera cinematográfica da detonação
REMOVIDA** (decisão do operador 2026-07-01 — reverte §7 do atom `aero-strike-fx`; amender
o atom na CLOSURE). Slow-mo e shake mantidos. U-AC-5 atualizado (assert cinematic OFF).

**Verify:** screenshots `.dadaia/tmp/claude/20260701/nuke-wide-*.png` (fireball 4 s +
cogumelo 12/25 s); suite `test:aero:qa` verde; aceite visual final = operador no preview.

### [x] T-WR-09 — Suavização de decolagem/pouso + reuso de terceiros (operador 2026-07-01)

**Owner:** `game-developer`

Decolagem/pouso suaves: assentamento exponencial no piso (sem snap de altura), derrotação
graciosa pós-toque, spool de throttle no pouso (sem corte seco), spool de velocidade na
rotação (sem salto 32→45), continuidade de vsp no liftoff (`_liftoffCarry`, manual e
auto), auto-taxi dirigível (curva ao longo do nariz, acel/frenagem limitadas, fase
`line_up` sem teleporte de heading). Reuso: vendorados examples/jsm r165 (Water,
Lensflare, EffectComposer/UnrealBloom/OutputPass, imports patched p/ relativo) +
waternormals.jpg; novo `src/environment/water-surface.js` (lago reflexivo jsm Water +
shader de rio compartilhado, REUTILIZÁVEL pelos outros mapas); Inhauma ligado nele.

**Verify:** `test:aero:unit` 7/7, `test:aero:sim` 5/5+9/9 (bounce ≤0.3 m e monotonia já
asseridas), e2e 70/70, `validate:aero-map` OK.

### [x] T-WR-10 — Space-war: revisão profunda + overhaul de realismo (operador 2026-07-01)

**Owner:** `game-developer` · Bug: `space-war-blackhole-no-attraction` (JSONL, reported)

Fora do write-set original desta release — extensão de escopo dirigida pelo operador na
mesma sessão. GRAVIDADE: fix do bug do buraco negro sem atração (zona morta fora de todos
os SOIs → fallback argmax-aceleração; par binário soma os DOIS parceiros). VISUAL: disco
de acreção shader (rotação diferencial Kepler, streaks FBM, Doppler beaming, anel de
lensing billboard), estrela de nêutrons (jatos 2 camadas, magnetosfera dipolo 3D, efeito
farol p/ câmera), corrente de acreção NS→BH, bump maps nos rochosos, lens flare no Sol,
bloom (UnrealBloomPass vendorado), skybox repintada (nebulosas estruturadas, galáxias
inclinadas + redshifted, Via Láctea com dust lanes multiply), SOI wireframe removido.
NAVEGAÇÃO: auto-aproximação [N] (perfil de chegada, cancela com manche), closing-speed +
ETA na mira, mapa log-radial incluindo o sistema binário + linha até o alvo.

**Verify:** boot sem erros de console; prova numérica live (dominant=Buraco Negro,
gravMag≈2.8e7 u/s², noReturn=true perto do horizonte); screenshots
`.dadaia/tmp/claude/20260701/sw-*.png`; aceite visual final = operador no preview.

### [x] T-WR-11 — Space-war: UNIVERSO DE 5 SISTEMAS + física orbital honesta (operador 2026-07-01)

**Owner:** `game-developer`

5 sistemas: Solar (trilhos) · BETELGEUSE (supergigante shader com células de convecção
GIGANTES, limbo assimétrico ALMA, envelope de poeira, companheira real Siwarha 2025,
3 planetas carbonizados) · BINÁRIO BN+pulsar (separação 140k, período do par DERIVADO
da física T=2π√(a³/μ), remanescente de supernova filamentar — a origem do BN) ·
CAÓTICO (2 estrelas diferentes + 5 planetas, N-corpos REAL) · NÚCLEO DA GALÁXIA
(SMBH Sagitário A✦ + 12 estrelas S + 3 errantes, N-corpos velocity-Verlet com
softening de Plummer e substeps fixos, reinjeção de ejetados). FÍSICA: fix do coast
(assist com throttle 0 FREAVA — órbita era impossível), aceleração de FRAME do corpo
dominante (patched-conics honesto: órbita da Terra fecha e=0.01, órbita do BURACO
NEGRO fecha e=0.25 em coast puro — provas numéricas live), campo somado nos sistemas
caóticos, decomposição tangencial/radial no frame co-móvel. NAVEGAÇÃO: assistente de
órbita [O] (circulariza em torno de QUALQUER corpo), câmera de observação [V]
(OrbitControls r165 vendorado), MOTOR INTERESTELAR por gravidade-fraca (Terra→binário
596k em 101 s passivo), estrelas gerais via shader único (Sol granulação fina),
tesselação alta (limbo contínuo na aproximação — arco→plano na colisão), mapa
galáctico com os 5 sistemas, alvos por sistema. Fix: mapa crashava no SMBH sem cor.

**Verify:** provas numéricas (órbita Terra 60 s drift 2.5%; órbita BN 50 s coast
e=0.25 bound; viagem 101 s; overdrive 1.00), console limpo, screenshots
`.dadaia/tmp/claude/20260701/v2-*.png`; aceite visual/jogável = operador.

### [x] T-WR-12 — Rodada de bugs do operador (2026-07-01, tarde): lag, água no aeroporto, pouso negado, câmera fugitiva — ENTREGUE + DEPLOYED (PR #5 merged 2026-07-02, Pages verde, live verificado)

**Owner:** `game-developer`

Cinco bugs reportados no playtest do operador, com causa-raiz e fix:
1. **Lag de voo (aero):** cruzar borda de célula reconstruía os 9 chunks de terreno num
   único frame (27k amostras FBM + 9 computeVertexNormals). Fix: reciclagem AMORTIZADA —
   chunks que continuam na janela 3×3 são reutilizados; rebuilds na fila, máx. 1/frame.
   Bônus: reflexo do jsm Water a 30 Hz + pulado a >2.4 km do lago (o passe re-renderizava
   a cena inteira todo frame).
2. **Água no aeroporto (Inhauma):** o rio passava a ~52 m do centro da pista (dentro do
   leito de 60) e o ribbon d'água ponta-a-ponta (WS-3) cobria o pavimento (cota 0 < 4.5).
   Fix: curso a montante RE-ROTEADO pelo norte do aeródromo (≥122 m de qualquer superfície,
   provado numericamente); nenhuma estrada autorada cruza o novo traçado.
3. **Pouso negado no retorno:** exigir vsp<-0.5 criava DEADLOCK com o clamp
   anti-atravessar (segura a 0.9 u → vsp≈0 → 'descending' nunca mais dispara). Fix: avião
   ASSENTADO na janela de toque conta como toque; tentativa de touchdown agora gated nos
   3 estados DE VOO (senão o gatilho assentado sequestraria a decolagem via auto-taxi).
4. **Lag sob puxão gravitacional (space-war):** perto de um corpo os shaders FBM
   (estrela 4×fbm3, remanescente em TELA CHEIA dentro do binário) dominam o custo por
   fragmento — com pixel-ratio até 2 + log-depth (sem early-Z) + bloom full-res. Fix:
   teto de pixel-ratio 1.5, RESOLUÇÃO ADAPTATIVA por frame-time (postfx.js, degraus
   1.0→0.55 com histerese), warp da estrela 3→2 fbm3, detalhe do remanescente 4→2
   oitavas, HUD só toca o DOM quando o texto muda, zero alocações por frame no loop.
5. **Câmera fugitiva (space-war):** lerp de POSIÇÃO absoluto tinha atraso de regime
   v/k — em overdrive a câmera assentava a milhares de unidades da nave. Fix: posição
   ANCORADA rígida na nave (deriva zero em qualquer velocidade), suavização só na
   ROTAÇÃO (slerp exponencial frame-rate-independente).
6. **(achado na inspeção visual) Preso em TAKEOFF_ROLL para sempre:** a rotação de
   decolagem exigia `contact.type==='runway'` — quem passava do fim da pista rolava
   pelo campo em estado de solo PERMANENTE (nariz derrotado a 0, LIFTOFF inalcançável).
   Fix: rotação vale de qualquer solo (decolagem de gramado), só não d'água.

**Verify (executado):** `validate:aero-map` OK; unit 7/7; sim 5/5+9/9 (ciclo de pouso);
distâncias rio→aeroporto ≥149 u provadas por script (ribbon 84); suíte Playwright
47/48 + auto-sortie/service 6/6 com budgets honestos (falhas anteriores = contenção de
host, trex intocado idem); INSPEÇÃO VISUAL: aeroporto SECO em vista aérea top-down
(screenshots .dadaia/tmp/claude/20260702/aero-airport-*.jpg), decolagem manual real,
BN + disco renderizando (sw-blackhole.jpg), câmera↔nave = 13.4 CONSTANTE a 178.900 u/s
(antes: atraso ~12.800 u), resolução adaptativa degrauou 1.0→0.55 sob carga.

### [x] T-WR-13 — Space-war: rodada FÍSICA ORBITAL + ESCALA + design BN/pulsar (operador 2026-07-02)

**Owner:** `game-developer`

Pedidos do operador, com causa-raiz e fix:
1. **Nave perto demais da tela:** camOffset (0,3.4,13)→(0,6.5,24) + estiramento ×1.45
   em overdrive.
2. **"Sucção reta" p/ corpos compactos:** o fly-by-wire lavava o momento angular
   (velocidade→nariz). Perto de estrela/BN/pulsar a autoridade do assist decai e o
   motor vira empuxo newtoniano — a gravidade CURVA a trajetória (flybys/espirais).
   Provado: nariz no BN + throttle 1 + v tangencial = trajetória orbital, viva, minD
   35.8k ≫ rs. Perto de PLANETAS o assist continua pleno.
3. **Espiral da morte:** arrasto do disco de acreção (BN) e do vento de pulsar (NS,
   novo def.disk) — dentro do disco a velocidade é arrastada p/ fluxo kepleriano
   sub-circular + deriva p/ dentro → captura em espiral decadente (provado: apoápside
   4126→3821 em 45 s), aviso HUD "ESPIRAL DA MORTE". Morte só no horizonte.
4. **Núcleo galáctico calmo e SEGUÍVEL:** 12 estrelas S saíram do N-corpos p/ ELIPSES
   KEPLERIANAS railed (r(θ)=p/(1+e·cosθ), θ̇=h/r², worldAcc = gravidade EXATA do SMBH
   no trilho), maiores (2.8k–6.5k), mais distantes (a 70k–260k), SOI de Hill por
   estrela → patched-conics. PROVADO seguir estrela: 45 s co-móvel com S6 enquanto ela
   andou 13.750 u ao redor do BN. [N] chega co-móvel + engata [O] sozinho.
5. **Corpos "bolinha" na aproximação:** ESCALA DE APROXIMAÇÃO — rochosos ×9, médios
   ×3.2, gigantes ×2.4, luas ×9 (órbitas re-espaçadas, anéis junto), Sol ×2 (μ ×2.2 p/
   manter a zona de não-retorno), μ ∝ fator (v_circ/v_esc de superfície preservadas).
   Terra a 169 u de altitude agora é PAREDE de horizonte, não bolinha. BN/pulsar
   ficam compactos DE PROPÓSITO (física). Overdrive ganhou portão de distância (g de
   superfície caiu — só-g engatava overdrive colado no planeta).
6. **Design BN (referências EHT/Interstellar):** passe de LENTE GRAVITACIONAL
   (ShaderPass próprio no composer — arcos de Einstein, sombra, aro quente; núcleo
   suavizado sem singularidade; proteção do 1º plano na região da nave). Bisseção ao
   vivo matou o artefato do "globo branco": AdditiveBlending+log-depth+bloom gerava
   NaN nos mips do UnrealBloom → glow do motor virou NormalBlending.
7. **[N] desvia de corpos no caminho** (a Terra entre você e a Lua matava o autopiloto
   na escala nova — waypoint arqueia a 1.6R) + alvo de MISSÃO expõe .body (chegada
   co-móvel na Lua; antes a velocidade relativa nunca zerava e a chegada nunca vinha).

**Verify (executado):** smoke space-war 12/12 (AC-04b re-verificado com μ do Sol ×2.2;
FPS headless ≥4 com material básico + pixel-ratio 0.5 em webdriver); provas numéricas
live (segue-estrela, anti-sucção, espiral); screenshots
.dadaia/tmp/claude/20260702/sw-*.jpg (horizonte-parede da Terra, núcleo galáctico,
lente no BN estilo Interstellar, bisseção do globo); suíte completa na CI do PR.

### [x] T-WR-14 — Space-war: estilos dos corpos celestes por REFERÊNCIA VISUAL (operador 2026-07-02, prints em img/)

**Owner:** `game-developer`

O operador entregou 24 prints (vídeo D.A "What Black Holes Look Like At Different
Distances" — Gaia BH1, Cygnus X-1, HLX-1, Sgr A*, Crab, M87*, TON 618) como referência
de estilo + pediu a lente gravitacional "de verdade". Entregue:
1. **Disco de acreção ESTRIADO** (prints Sgr A*/HLX-1): ruído ridged com freq radial
   alta/angular baixa cisalhado pela rotação Kepler → dezenas de filamentos
   concêntricos finos; rampa térmica marrom-avermelhado → laranja → dourado → borda
   interna BRANCO-QUENTE; Doppler beaming 0.55→0.70.
2. **Anel de fótons** fino e ofuscante (torus rs·0.020, branco 0xfffdf2) + vão escuro
   até o halo — a sombra volta a ler PRETA com uma linha de luz cravada.
3. **"Monte" lenseado com física**: o halo billboard agora é modulado por quão
   de-quina a câmera está do plano do disco (uGain 0.08+0.62·edgeOn²) — de lado,
   look Interstellar; de frente, disco + anel limpos.
4. **Lente de tela mais notável que o corpo** ("it's the distortion"): alcance
   rs·700→rs·1400, mix mais cedo, REDEMOINHO tangencial (frame-dragging visual),
   aberração cromática nos arcos (3 taps), aro de Einstein mais forte.
5. **Estrela de nêutrons TAMBÉM lenteia** (lensRs 80) — sem sombra (uShadow 0: pulsar
   tem superfície, não horizonte); jatos viraram AGULHAS (comprimento 90R→150R, raios
   ~metade, feixe interno opacity 0.75).
6. **Jato bipolar do SMBH** (print M87*): cilindros aditivos finos rs·34 no eixo do
   disco de Sagitário A✦ (def.jet).
7. **Banda de poeira SÉPIA na Via Láctea** (todos os prints): sopros marrons tênues +
   grumos de absorção ao longo da banda (1× no canvas, custo zero por frame).
8. **Terra do print final**: LUZES DE CIDADE âmbar (emissiveMap procedural com viés
   costeiro, intensity 0.55 — o dia lava, a noite acende) + GLINT do Sol no oceano
   (roughnessMap: água lisa 70/255, terra/calotas ásperas) + clamp do bumpScale ≤8
   (18 desenhava contornos pretos nos continentes pós-escala).

**Verify (executado):** smoke space-war 12/12 local (porta 8181; FPS floor e skybox
verdes); 60 fps medidos no browser real a 9.5k do BN com pipeline completo (estrias +
lente + croma + bloom); screenshots vs prints em .dadaia/tmp/claude/20260702/
(sw-bh-final ↔ HLX-1/Interstellar, sw-smbh-jet ↔ M87*, sw-pulsar-v2 ↔ Crab,
sw-earth-night/glint-v2 ↔ print Terra, sw-bh-far-lens ↔ Cygnus X-1 "visível de longe");
staging-only: bolha branca na nave = FX de overdrive do pino de teleporte (não ocorre
em voo real). Suíte completa na CI do PR.

### [ ] T-WR-06 — QA/fechamento

**Owner:** `qa-engineer` + `code-reviewer`

Suíte aero verde (ou thresholds atualizados com evidência); novos ACs Playwright onde
aplicável; revisão de código; CLOSURE com refinos finais de memory.

**Verify:** `npm run test:aero:qa`; `dadaia specs doctor`.

### [x] T-WR-07 — WS-6 Decolagem após ser destruído (bug crítico) — VERIFICADO

**Owner:** `game-developer` · Bug: `specs/bugs/aero-respawn-cannot-takeoff.md`

Ao ser abatido e voltar à base, o avião ficava travado (surtida presa em MAYDAY, auto-taxi
nunca rearmado). Fix: `relaunchSortie()` (reset incondicional → TAXI_OUT) + `respawnAndRelaunch()`
(respawn na zona de serviço → relaunch → auto-taxi `taxi_runway` → rearma munição/HP), usado
pelos dois caminhos de recuperação (queda no solo e ejeção manual).

**Verify:** sim `test-aero-sortie-sim.js` (2 regressões novas, 9/9); e2e `ejection`/`auto-sortie`/
`sortie`/`landing` verdes; boot limpo no browser real.

### [x] T-WR-08 — WS-7 Estradas não terminam mais no nada — VERIFICADO (mapa/altura)

**Owner:** `game-developer` · Bug: `specs/bugs/aero-roads-end-in-nothing.md`

Toda ponta aberta entra num túnel: relevo real onde existe (morros-oeste/serra-leste/morro-norte)
ou colina de portal sintética (`getPortalMounds`, somada ao campo de altura) onde é rural plano.
MG-060 recuada da água (h=0 → terra seca). Garganta do portal corrigida (recua para dentro da
encosta) e mais funda.

**Verify:** cada colina/portal validado contra o campo de altura (seco, longe do aeroporto e de
alvos); `validate:aero-map` inhauma OK (4 arestas); fidelidade e2e verde. Aceite visual das bocas
de túnel = browser real do operador.

## Verification log (2026-07-01)

- **Suíte automatizada (sem regressão):** `test:aero:unit` 7/7, `test:aero:sim` 7/7,
  `validate:aero-map` OK (rio/desert/inhauma; road graph 4 edges; runway-obstacle sweeps
  limpos), Playwright e2e 69/70 → após corrigir ordem do layout (2 helis na wave 1),
  U-AC-8 verde → efetivamente 70/70. Boot sem erros de console; fidelidade visual dentro
  do budget.
- **WS-1 (grounding) provado live:** AA da serra-sete-lagoas (760,-300) agora em y=103.7 =
  superfície RENDERIZADA (antes 112.7, o pico sub-amostrado → float de ~9 m eliminado).
- **WS-4 provado live:** wave 1 spawna tank×2, patrolAir×1, helicopter×2; tank moveu
  (306→158) e patrolAir moveu (645→495) — movimento lento confirmado.
- **WS-5:** nuke disparada/detonada (nuclearMissiles 3→2, slow-mo, pluma mesh 60 s
  ticada). Aceite visual do espetáculo (cogumelo subindo + ignição) = browser real do
  operador (headless pula HEADLESS_FX).
- **Preview registrado:** `http://127.0.0.1:8145/aero-fighters/?map=inhauma` (dadaia
  server register, port 8145).
- Pendente: re-run da suíte completa antes de qualquer push; aceite visual do operador;
  CLOSURE (refinos finais de memory).

## Completion criteria

- [ ] Atoms de memória recriam o jogo (AC-W0-01/02); `dadaia specs doctor` sem erros novos.
- [ ] Montanhas visíveis sob alvos (AC-W1).
- [ ] Rio visível + ≥3 espécies de árvore (AC-W3).
- [ ] Estradas terminam graciosamente (AC-W2).
- [ ] ≥1 inimigo lento de solo + ≥1 de ar, móveis (AC-W4).
- [ ] Nuke: cogumelo único, 60 s, multicor, shockwave, ignição (AC-W5).
- [ ] `npm run test:aero:qa` verde ou thresholds justificados; FPS dentro do budget.
- [ ] Evidência de screenshots para revisão manual do operador.
