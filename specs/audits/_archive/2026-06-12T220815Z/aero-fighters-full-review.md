# Audit — aero-fighters (Aero Strike) — revisão completa

> **Data:** 2026-06-12 · **Auditor:** sessão coordenadora (operador presente)
> **Escopo:** `aero-fighters/` completo — arquitetura, mecânicas, mapas, decolagem/
> aterrissagem, explosões (nuke), colisões — código (6.788 linhas, 35 módulos) lido
> integralmente + execução ao vivo via Playwright (desert + islands), screenshots em
> `.dadaia/tmp/claude/20260612/`.
> **Insumo para:** release `aero-fighters-uplift-v1` (DEFINITION).

## 1. Veredito executivo

O jogo é **estruturalmente bom e jogável** — a modularização pós-ARCHITECTURE.md é
real, o fluxo de surtida (taxi → decolagem → missão → RTB → pouso → serviço) existe e
funciona no mapa desert, e a base técnica (pools de partículas, FSM de surtida, rng
determinístico, debug API, guards headless) é sólida. Mas a **simulação é rasa e
inconsistente nas bordas**: 2 estados degenerados verificados ao vivo (soft-lock no
mapa islands; "cola no chão" em voo), colisão mar/terra indiferenciada, modelo de voo
sem energia (sobe para sempre), nuke visualmente fraca com câmera mal enquadrada, e
mapas com primitivas pobres (blobs radiais + planos de cor chapada). Nota global:
**6/10 funcional, 4/10 experiência**. Tudo abaixo é endereçável dentro da stack atual
(Three.js r165, zero build step).

## 2. O que o jogo é hoje (inventário verificado)

- **Loop:** `main.js` tick → player físico → projéteis (balas/mísseis L-H-N) → alvos
  (AA atira, warship patrulha+atira) → partículas → céu dia/noite → HUD/minimapa.
- **Modos de armas:** canhão (2 tracers/tiro), míssil leve ×100 (lock obrigatório),
  pesado ×10 (lock), **nuclear ×3 (T, sem lock)** com blast 400 m, dano em área,
  cratera em terreno (`deformTerrainNuclear` — só em `game.islands`), cinematic camera.
- **Mission realism:** FSM 15 estados (`sortie-state.js`), ground physics
  (`ground-physics.js`), envelopes de decolagem/pouso (`landing-zones.js`), serviço
  (35 s fuel/maintenance/rearm), mayday + ejeção (J), 5 modos de câmera (C).
- **Mapas (4):** islands (oceano animado + 18 ilhas), desert (mesas/cânions + aeroporto
  "AEROPORTO DO TAUAN E DO PAPAI"), rio (morros nomeados + malha urbana InstancedMesh),
  inhauma (fidelidade geográfica: MG-238, igreja, campo, aeródromo, Sete Lagoas).
- **Céu:** dome GLSL com fases do dia, lua/estrelas, nuvens 3 camadas (esferas).
- **Áudio:** Web Audio sintetizado completo (motor RPM, canhão, mísseis, explosões
  posicionais, radio chatter, vento por altitude) — **acima da média do conjunto**.
- **Testes:** Playwright smoke/AC em `tests/aero-fighters/`, `map-validation.js`,
  `debug.js` com métricas de frame e diagnósticos de alvos.

### Pontos fortes a preservar

1. Fronteiras de módulo e contrato de escrita (`// CONTRATO: writer de…`).
2. Pools de partículas com separação explosão/chaminé e `scheduleDelayed` (zero
   `setTimeout` no fluxo de jogo).
3. FSM de surtida com histórico — auditável nos testes.
4. `physics-core.js` puro e testável; `rng.js` seedável (`?seed=`).
5. Guards HEADLESS coerentes (render scale, pools, shadow off).

## 3. Defeitos — verificados ao vivo (evidência primeiro)

### CRIT-1 — Mapa islands (e rio) soft-locka no modo realismo
**Evidência live:** 8 s de throttle máximo + rotação no islands → `TAXI_OUT`,
y=0.9, **speed 106.5 m/s**, contact `water`. O avião "esquia" na água para sempre.
**Causa:** `evaluateTakeoffEnvelope`/liftoff gate exigem `surface === 'runway'`
(`player.js:355-358`), mas só desert e inhauma têm aeroporto
(`landing-zones.js:23-29`, `getAirportForMap` só conhece 2). Islands/rio nunca
produzem 'runway' → `LIFTOFF` impossível. Rio ainda é incoerente: `rioHeightAt`
consulta o aeroporto do **desert** (`maps/rio.js:219-224`) enquanto
`classifyGroundContact` ignora aeroporto no rio.
**Agravante:** `updateGroundRoll` não tem velocidade terminal (accel 18 > friction 4
constante) — ground speed cresce sem limite (106+ m/s observado).

### CRIT-2 — Estado degenerado "colado no chão" em voo (floor-glue)
**Evidência live (2×):** em `AIRBORNE`, descer até a pista gruda o avião em y=0.9,
z congelado em ≈−260 (borda sul da pista), speed 80, sem crash, sem progresso, sem
recuperação — para sempre.
**Causa:** o floor-clamp do caminho airborne (`player.js:518-529`) força
`y = contact.height + 0.9` sobre superfície de aeroporto, enquanto
`checkTerrainCollision` (`world.js:190`) devolve `null` quando `contact.safe`. O avião
"voa" preso ao chão; na borda da pista o clamp e o movimento se anulam. Não existe
transição AIRBORNE→touchdown fora de `RETURN_TO_BASE` (`player.js:553`), então tocar a
pista em `AIRBORNE`/`MISSION_ACTIVE` não é pouso nem crash — é limbo.

### HIGH-3 — Colisão mar vs terra indiferenciada por mapa
`checkTerrainCollision` (`world.js:191`): `if (jetPosition.y < 3) return 'SEA'` —
**incondicional, em qualquer mapa**. Mergulhar no deserto exibe "IMPACTO NO MAR".
`classifyGroundContact` até distingue (`water` só em islands, `landing-zones.js:31`),
mas o caminho de crash não usa essa classificação. Não há física diferente para água
(afundar) vs terra (explodir) — exatamente o pedido nº 5 do operador.

### HIGH-4 — Queda mayday existe SÓ para montanha; mar/terra são corte seco
`player.js:466-479`: `MOUNTAIN` → mayday (tumble + fumaça + fogo + ≥2 s de queda +
mega-explosão no impacto — bom!). `SEA`/terreno → `crashAndDie` instantâneo: avião
some, overlay, freeze 2.5 s. Sem splash, sem afundamento, sem skid. A experiência
pedida ("cair até o chão com fumaça e explodir no solo, ou afundar no mar") está
implementada em 1 de 3 superfícies.

### HIGH-5 — Nuke: espetáculo e câmera abaixo do pedido
**Evidência live:** T disparado em subida → míssil some da tela por ~5 s (homing para
alvo a km de distância), detonação distante lavada (screenshot `12-nuke-late.png`:
blob bege no chão, sem leitura de cogumelo). `nuclearFxState` ainda `idle` 3.4 s após
o disparo.
**Causas no código:**
- Cinematic **desiste** se a explosão já está no frustum (`camera-modes.js:37-45`) —
  justamente quando o jogador está olhando, não há tomada dedicada.
- Enquadramento = midpoint avião↔epicentro com elevação proporcional — de 700 m de
  altitude vira uma vista zenital sem silhueta de cogumelo contra o céu.
- Sem slow-motion, sem delay de som/onda de choque pela distância, sem shake
  sincronizado à chegada do anel, FOV salta para 90.
- Cogumelo: esferas `MeshBasicMaterial` bege opacas — sem núcleo emissivo→fuligem,
  sem anel toroidal, some em 7 s. Flash DOM ok.
- `deformTerrainNuclear` só deforma meshes de `game.islands` — **o piso plano do
  desert/rio/inhauma não ganha cratera nem cicatriz**; flash não ilumina a cena
  (nenhuma PointLight transitória).

### CRIT-2b — Seleção de mapa pelos botões roda física do desert (split-brain)
**Evidência live:** islands via botão MAR DO SUL → mundo oceano renderizado, mas
`activeMap === 'desert'`: contact `runway` invisível no meio do mar, decolagem de
pista fantasma. **Causa:** `startGame()`/`restartGame()` forçam
`game.activeMap = 'desert'` quando não há `?map=` na URL (`missions.js:55, :92`),
sobrescrevendo `window.selectMap()`. Todos os probes com `?map=` viam o soft-lock
CRIT-1; o caminho real do jogador (botões) cai NESTE bug. Bug:
`aero-startgame-forces-desert-activemap.md`.

### HIGH-4b — Decolagem indescobrível: só a tecla ↓ rotaciona ("o avião não voa")
**Evidência live:** 8 s de throttle máximo + ↑ (input natural de subir) → preso em
y=0.9 a 106 m/s, zero feedback. 3 s de ↓ → AIRBORNE. O liftoff gate escuta
exclusivamente `input.pitchDown` (`player.js:355-358`); a dica do esquema invertido
vive só no overlay de texto. Viola a quality-bar ("controles descobertos em
segundos") — relatado pelo operador como "the plane don't flight". Bug:
`aero-rotate-key-undiscoverable.md`.

### MED-6 — Modelo de voo sem energia (sobe para sempre)
**Evidência live:** após curva, atitude nose-up residual → +27 m/s de subida
constante sem input até y=595+ (e antes y=7.382 no HUD). Lift cancela exatamente a
gravidade acima de 20 m/s (`player.js:459-463`); pitch não decai (sem trim); speed
converge para o alvo do throttle **independente da atitude** (subir não custa energia,
mergulhar não acelera). Stall é quase inalcançável (alvo mínimo de speed ≈11.6 >
STALL_SPD 10). Sem teto, sem ar rarefeito.

### MED-7 — Altímetro mente ×10
`hud.js:42`: `ALT = floor(y * 10)` — voar a y=80 mostra "800 m". Incoerente com SPD
(m/s reais) e com os envelopes (metros reais). Quebra qualquer leitura de aproximação.

### MED-8 — Decolagem/pouso: funcionais mas sem experiência
- Decolagem live OK (roll → V_ROTATE → rotação com ArrowDown → AIRBORNE a 4 m), mas:
  sem trem de pouso visível (`gearState` é só string; `gearVisible: true` no estado é
  teatro), sem rumble/efeito de pista, sem callouts, rotação usa a tecla "nariz para
  baixo" do esquema invertido sem hint no HUD.
- Pouso: touchdown teleporta `y = contact.height + 0.9` e corta groundSpeed para
  `max(12, speed*0.62)` num frame (`player.js:560-563`) — sem flare visual, sem fumaça
  de pneu, sem desaceleração progressiva. Não há **nenhuma guia de aproximação**
  (glide-slope, PAPI, marcador de pista no HUD/minimapa) — achar a pista de volta é
  advinhação. TOUCHDOWN_UNSAFE em superfície segura chama `onCrash('airport-pavement')`
  → overlay "COLISÃO COM TERRENO" na própria pista.

### MED-9 — Mapas: primitivas pobres, leitura visual fraca
- **Todos** os relevos são o mesmo primitivo: PlaneGeometry radial com 1-4 octaves de
  seno (`world.js`, `maps/*.js`). Sem heightfield contínuo — terreno só existe dentro
  de círculos; entre eles, planos de cor chapada (desert: `0xd4a44a` liso 12.000 m;
  rio: oceano `0x1a4f6e` estático).
- Fog do desert tinge as nuvens de bege (evidência: screenshots 02/06 — nuvens
  parecem rochas flutuantes); horizonte termina em aresta dura piso×céu.
- Sem textura procedural no chão (o oceano do islands TEM textura canvas — o padrão
  existe e não foi replicado), sem scatter (pedras/cactos/dunas/palmeiras), sem
  estradas no desert (prometido em `desertLandmarks.roads: 2` — é só contagem fake).
- Jato renderiza quase preto contra o céu (1 dirLight + ambient fraca; metalness 0.75
  sem envMap) — silhueta sem leitura de forma (screenshots 06/10).
- Inhauma é o mais rico (estradas, igreja, cidades vizinhas) — bom benchmark interno.

### LOW-10 — Miudezas
- `speedLines` são 4 paus brancos orbitando o nariz (screenshot 06) — mais ruído que
  sensação de velocidade.
- `MOUNTAIN_BUFFER = 5` gera mortes "antes de encostar" visual em encostas íngremes.
- AA/warship atiram balas retas sem tracer de ameaça nem aviso de lock no HUD.
- `enemies` alias legado; `desertLandmarks` números fake; `criticalVideoCapture`
  nunca usado.

## 4. Solução proposta — `aero-fighters-uplift-v1`

Seis workstreams, ordenados por dependência. Tudo dentro da stack atual (Three.js,
ES modules, zero build). Cada WS fecha com AC Playwright.

### WS-1 — Verdade de superfície e colisão (fundação)
Um único serviço `surfaceAt(x, z)` por mapa devolvendo
`{ height, kind: 'water'|'land'|'mountain'|'runway'|'taxiway'|'service' }`:
- substitui o trio divergente `checkTerrainCollision` / `classifyGroundContact` /
  `heightFn` — colisão, pouso e crash leem a MESMA verdade;
- mar só existe onde o mapa diz (`islands`: y<oceano; demais: nunca) — mata HIGH-3;
- floor-glue (CRIT-2) resolvido por máquina de contato: em voo, tocar pista com sink
  baixo → touchdown (mesmo fora de RETURN_TO_BASE = pouso oportunista); sink alto ou
  fora de pista → crash de terra; nunca clamp silencioso;
- ground roll com velocidade terminal e atrito de rolagem decente (CRIT-1 agravante).

### WS-2 — Aeroporto em todo mapa (mata CRIT-1)
- Islands: pista costeira numa ilha grande (ou porta-aviões — decisão de grill).
- Rio: pista "Santos Dumont" no aterro (já há malha urbana; encaixa naturalmente).
- `getAirportForMap` vira registro por mapa; rio deixa de apontar para o desert.

### WS-3 — Modelo de voo com energia (MED-6/7)
- Acoplamento atitude×velocidade: subir drena speed, mergulhar ganha (±k·sin(pitch)),
  drag quadrático leve, auto-trim suave para pitch→0 sem input;
- stall real: abaixo de STALL_SPD o nariz cai e os comandos amolecem; buffet no HUD;
- teto prático (~1.200 m com thrust caindo), altímetro honesto (m reais, HUD
  recalibrado), VSI no HUD;
- mantém arcade: limites de pitch atuais, gravidade fraca, sem spin.

### WS-4 — Experiência de decolagem e pouso (MED-8)
- Trem de pouso visível e animado (3 pernas; retrai ao subir, baixa <120 m de alt em
  aproximação ou tecla G), sombra de contato;
- decolagem: rumble crescente (shake sutil + áudio), poeira nas rodas, callout
  "V1… rotate" no HUD, hint da tecla de rotação;
- aproximação: marcador de pista no minimapa + chevrons de glide-slope no HUD
  (verde dentro do envelope, vermelho fora), luzes PAPI na cabeceira;
- toque: flare assistido (últimos 3 m amortecem sink), fumaça de pneu + chirp, rollout
  com desaceleração contínua (sem corte 0.62), taxi guiado por placas até o serviço;
- TOUCHDOWN_UNSAFE em pista = pouso duro (bounce + dano 1 hp), não "colisão com
  terreno".

### WS-5 — Morte bonita: queda, fogo, água (HIGH-4 + pedido 5)
Unificar TODO impacto fatal na rota mayday existente, especializada por superfície:
- **Montanha/terra (mergulho raso):** tumble atual + skid de fogo/debris no solo,
  explosão final + cratera-decal e fumaça persistente (60 s);
- **Terra (mergulho íngreme):** impacto direto = mega-explosão + anel de choque +
  cicatriz no chão;
- **Água:** splash em coluna (partículas brancas + anel de espuma), avião desacelera
  semi-submerso, nariz afunda, bolhas/vapor, silhueta afundando 4-5 s, câmera baixa
  acompanhando — sem fireball debaixo d'água;
- AA kill / nuke kill continuam entrando na mesma rota (já fazem).

### WS-6 — Nuke espetáculo + câmera dedicada (HIGH-5)
- **Câmera:** sempre assume (remover skip-se-visível). Sequência: 0-0.4 s freeze do
  flash (tela branca sincronizada) → corte para wide-shot lateral BAIXO (câmera a
  ~25° de elevação, cogumelo contra o céu, avião em primeiro plano se <600 m) →
  slow-mo 0.35× por 1.5 s → dolly-out conforme o cogumelo cresce → shake quando o
  anel de choque ALCANÇA a câmera (delay = distância/340 m/s, com som casado) →
  retorno suave ao chase em 1 s. Duração total ~6 s (1.4 s em testMode).
- **Visual:** fireball emissiva (core branco→laranja→fuligem via vertex color/opacity
  ramp), stem com vorticidade (rotação lenta dos sprites), cap toroidal (anel de
  esferas orbitando + topo), PointLight transitória laranja iluminando o terreno,
  double-flash físico, anel de condensação branco em altitude, chuva de debris
  incandescente, cratera + anel de queimado em QUALQUER piso (decal circular escuro,
  não só deformação de ilhas), coluna de fumaça residual 60 s visível de longe.
- HUD: aviso "☢ DANGER — distância insegura" se o player está dentro de
  PLAYER_DAMAGE_RADIUS no momento do disparo.

### WS-7 — Mapas mais ricos (MED-9) — pode fasear
- Texturas procedurais de piso por mapa (replicar o padrão canvas do oceano: dunas
  com bandas, urbano com grid, cerrado com manchas);
- scatter InstancedMesh por mapa: pedras+cactos (desert), palmeiras+recifes
  (islands), favelas nos morros + Cristo no Corcovado (rio), árvores de cerrado
  (inhauma);
- haze de horizonte (anel gradiente entre piso e céu, casa com fog);
- nuvens: tinta por fog do mapa corrigida (usar cor neutra pré-fog) e billboards
  suaves em vez de cachos de esferas (ou manter esferas com material levemente
  emissivo — decisão de custo);
- luz de aro (rim light) fraca no jato + envMap procedural barato para o corpo
  metálico ler contra o céu;
- speed lines substituídas por streaks radiais sutis só acima de 60 m/s.

### Ordem e dependências

```
WS-1 (verdade de superfície)  →  WS-2 (aeroportos)  →  WS-4 (decolagem/pouso)
        ↘ WS-3 (voo energia)  ↘ WS-5 (mortes)  →  WS-6 (nuke)
WS-7 (mapas) — paralelo após WS-1
```

### Critérios de aceite chave (Playwright)
1. Islands/rio: decolagem possível; LIFTOFF dispara nos 4 mapas.
2. Nenhum estado com y colado e |Δz| < 1 m por 3 s em AIRBORNE (floor-glue morto).
3. Mergulho no desert → overlay de TERRA (nunca "MAR"); mergulho no islands fora de
   ilha → sequência de afundamento ≥3 s antes do overlay.
4. Montanha → mayday → impacto no solo → explosão; tempo de queda ≥2 s preservado.
5. Nuke: cinematic ativa SEMPRE; `nuclearFxState.stage` percorre
   flash→fireball→mushroom→dissipating; cratera/cicatriz presente em desert.
6. Pouso: chevrons visíveis em RETURN_TO_BASE; touchdown sem teleporte (Δy contínuo);
   rollout desacelera ≤8 m/s² até taxi.
7. Subida sustentada sem input não ocorre (auto-trim); ALT do HUD = y real ±1 m.

## 5. Estado dos artefatos

- Specs migradas para pattern-1 nesta sessão (doctor 0 erros) — ver
  `specs_bkp/0→1-20260612T214533Z/`.
- Bugs live-verificados registrados em `specs/bugs/`:
  `aero-islands-realism-softlock.md` (CRIT-1), `aero-airborne-floor-glue.md` (CRIT-2),
  `aero-startgame-forces-desert-activemap.md` (CRIT-2b),
  `aero-sea-label-on-land.md` (HIGH-3), `aero-rotate-key-undiscoverable.md` (HIGH-4b).
- Release alvo: `specs/releases/aero-fighters-uplift-v1/` (SPEC Draft — aguarda grill
  + aprovação do operador antes de PLAN/TASKS).
- Evidência visual: `.dadaia/tmp/claude/20260612/*.png` (01-33).
- Servidor de revisão: http://localhost:3640/aero-fighters/ (registrado, TTL 8 h).
