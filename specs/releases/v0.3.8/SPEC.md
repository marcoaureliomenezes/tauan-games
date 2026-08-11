# SPEC — v0.3.8

- **Status:** Aprovado
- Release: `v0.3.8`
- Fonte da verdade funcional: implementação web em `src/web-games/space-war/`
  (auditada em 2026-07-19, 37 arquivos) + diretrizes do operador em 2026-07-19.
- Motor: **Godot 4.7.1** (binário `godot4`), GDScript, Forward+, alvo Intel Iris Xe.

## 1. Visão

Reconstruir o **Space War** em Godot 4. A versão web está **funcionalmente boa**
(física, universo, missões) mas **visualmente ruim** (efeitos, renderização,
componentes) e — principalmente — **não realizou o conceito de frames/estados de
voo** que o operador descreve. Esta release existe para (a) extrair e preservar
TODO o funcional, (b) implementar corretamente o modelo de frames e (c) refazer o
visual com componentes de qualidade.

**Regra de convivência:** o jogo web só poderá ser deletado quando a versão
Godot atingir paridade funcional desta SPEC e for aprovada pelo operador.

**Jogo em uma frase:** simulador de voo espacial com física orbital real onde
cada sistema planetário é uma "fase" jogável (acoplado ao campo gravitacional do
planeta e suas luas), e fora das fases viaja-se por um "mapa" interplanetário e
interestelar entre 6 sistemas estelares.

## 2. O conceito de frames (analogia Mario World) — CORAÇÃO DESTA SPEC

Como no Super Mario World: ao sair de uma fase entra-se no mapa, onde se navega
entre fases. Aqui, **cada fase é um sistema planetário** no qual a nave está
**acoplada gravitacionalmente** ao planeta e suas luas; o "mapa" é o espaço
interplanetário/interestelar.

### 2.1 Máquina de estados de voo

| Estado | Nome | Descrição |
|---|---|---|
| `LANDED` | Pousado | Nave na superfície de um planeta (estado inicial: Terra). Gira com o planeta. |
| `LAUNCH` | Decolagem | Subida pilotada pela atmosfera (ver §2.2). |
| `ORBIT` | Fase (acoplamento planetário) | Frame fechado co-móvel do sistema planetário (ver §2.3). |
| `CRUISE` | Mapa interplanetário | Voo livre entre planetas/sistemas do sistema estelar atual (ver §2.4). |
| `JOURNEY` | Viagem interestelar | Queima automatizada entre sistemas estelares (ver §2.5). |

### 2.2 Decolagem (`LANDED` → `LAUNCH` → `ORBIT`)

- Segurar **W**: a nave inicia trajetória ascendente. **Não é cutscene** — o
  jogador pilota o tempo todo (W mantido para subir).
- **Câmera lateral** durante a subida: vê-se a paisagem do planeta (horizonte
  curvando, terreno, céu escurecendo).
- ~**20 s** de subida inicial; depois a nave **inclina** (gravity turn) por mais
  ~**10 s** para entrar em movimento tangente ao planeta.
- Inserção orbital a **100 km de altitude** a **27.000 km/h** → entra no estado
  `ORBIT` com o planeta em **frame fixo embaixo**.
- Física real durante toda a subida: gravidade, inércia, arrasto atmosférico.

### 2.3 Fase — acoplamento planetário (`ORBIT`)

- **Frame fechado e co-móvel:** o planeta fica fixo abaixo da nave (a não ser
  que o jogador rotacione a nave — a Terra aparece como um **arco luminoso azul**
  da atmosfera). Efeitos de translação do planeta no sistema solar e gravidade
  de corpos fora do sistema planetário **não afetam a nave**.
- **Corpos com influência gravitacional:** o planeta e suas luas (a Lua tem
  tamanho grande e campo próprio: dá para voar da órbita da Terra até a Lua e
  **entrar em órbita da Lua**).
- **Corpos sem influência gravitacional:** satélites artificiais, EEI/estações,
  naves inimigas.
- Dinâmica orbital real: velocidade orbital estacionária `v = √(μ/r)`; inércia;
  **acelerar → aumenta altitude** (centrífuga > centrípeta, saída pela tangente);
  **mover para baixo → reentra na atmosfera**; desacelerar → desce de órbita.
- É aqui que as missões acontecem (release 2); o cenário de cada fase deve ser
  trabalhado em profundidade (visual do planeta, luas, estações).
- Cada planeta com sistema de luas é uma fase distinta (Terra ≠ Marte ≠ Júpiter
  ≠ Saturno…), incluindo planetas de outros sistemas estelares.

### 2.4 Sair da fase / entrar na fase (transições)

- **Sair (`ORBIT` → `CRUISE`):** manter aceleração até ultrapassar **1,5× a
  órbita do satélite natural mais distante** do planeta (Terra: 1,5× órbita da
  Lua). Desacopla e entra-se no "mapa" — vê-se o sistema planetário se movendo
  em translação (a visão atual do jogo web).
- **Entrar (`CRUISE` → `ORBIT`):** mirar o planeta com **T** e pressionar **O**
  estando a no máximo **3× a distância do satélite mais distante**. A nave
  acelera numa trajetória automática de captura; ao entrar em órbita externa, o
  jogador desacelera (S) para se aproximar do planeta.

### 2.5 Viagem interestelar (`JOURNEY`)

- Alvo em outro sistema estelar selecionado com **T**; **Z** engata/aborta.
- Perfil trapezoidal (30% aceleração / 40% cruzeiro / 30% frenagem), duração
  normalizada **180–360 s** conforme distância entre sistemas.
- Durante a queima: voo manual suspenso, imunidade a colisão, chegada com
  velocidade residual controlada; efeitos relativísticos visuais ∝ β.

### 2.6 Velocidades na fase

- HUD em **km/h** no estado `ORBIT`.
- Entrada em órbita: **27.000 km/h**. Máximo: **72.000 km/h**.
- **W** acelera e **S** desacelera a **300 km/h por segundo** (constante
  `ACCEL_RATE_KMH_S = 300`, tunável).
- Sem combustível: recursos do jogo são HP, nukes (regen) e cooldown da Higgs.

## 3. Nave e controles

| Tecla | Ação |
|---|---|
| `W` / `S` | acelerar / desacelerar (na decolagem: W mantido para subir) |
| `X` | freio |
| Setas ↑↓ / ←→ | arfagem / guinada |
| `A` / `D` | rolagem |
| Mouse (pointer lock) | pilotagem fina |
| Espaço / botão esq. | laser (release 2) |
| `F` / `G` / `H` | nuke / traçadora gravitacional / bomba de Higgs (release 2) |
| `T` / Shift+T | cicla alvo próximo/anterior |
| `C` | aponta o nariz para o alvo (com solução balística, release 2) |
| `N` | auto-aproximação (toggle; qualquer manche cancela) |
| `O` | contextual: captura orbital quando em CRUISE com alvo ≤3×; assistente de órbita (circularizar) quando em fase |
| `V` | câmera de observação |
| `Z` | contextual: viagem interestelar se alvo em outro sistema; senão toggle flight-assist |
| `M` / `P` / Enter | mapa / pausa / confirmar |

- **Flight assist** (padrão): fly-by-wire "set speed" — throttle 0 **não freia**,
  a nave coasta sob inércia + gravidade (essencial para órbitas).
- **Fade newtoniano:** perto de corpos compactos (BN, NS, estrelas) a autoridade
  do assist decai e o motor vira empuxo newtoniano puro.
- **Assistente de órbita (O em fase):** circulariza a órbita em torno do corpo
  dominante; toast ao travar.
- **Frame local-nível:** em `ORBIT`, "baixo" = centro do corpo dominante; sem
  input, as asas nivelam com o horizonte orbital automaticamente.
- Câmera 3ª pessoa ancorada na nave (offset menor em fase, maior em cruise);
  câmera de observação `V`.
- **Spawn grace:** 6 s sem dano/inimigos após decolar.

## 4. Física

- Integração: Euler semi-implícito, dt clampado (≤ 0,05 s), float64 (GDScript).
- **Patched conics:** o corpo de **menor SOI que contém a nave** domina;
  perturbação de maré dos corpos do mesmo sistema dentro de `gravReach`.
- **Frame co-móvel:** na fase, a simulação roda no frame do planeta (planeta
  fixo na origem) — órbitas fecham redondo; nada de "perder o empuxo do planeta".
- **Corpos compactos** (BN, NS, SMBH): potencial Paczyński–Wiita
  `a = μ/(r − rs)²`; ISCO em 3·rs; `v_circ = √(μr)/(r − rs)`; `v_esc = √(2μ/(r − rs))`.
- **Maré:** `dist < tideKillR` → dano de espaguetificação `min(85, 55×((tideKillR/dist)³ − 1))` hp/s.
- **Disco de acreção:** dentro do disco, velocidade arrastada para fluxo
  kepleriano sub-circular (espiral da morte).
- **Atmosfera/reentrada:** drag ∝ profundidade; aquecimento acima de velocidade
  limiar; dano térmico; morte `burned`.
- **Superfície:** contato com corpo compacto/estrela/gigante gasoso → morte
  instantânea; corpos sólidos: impacto > limiar → dano/morte; oceano + velocidade → morte `sea`.
- **Análise de fuga (HUD):** `v_circ`, `v_esc`, `canEscape`, `noReturn`,
  velocidade tangencial/radial, altitude — tudo no frame co-móvel.
- **N-corpos real** apenas no sistema Binário Caótico (velocity-Verlet,
  softening de Plummer ε, reinjeção de fugitivos).
- **Poços gravitacionais transientes** (bomba de Higgs, release 2): poço μ
  transiente que afeta nave e projéteis.

## 5. Universo — 6 sistemas estelares

Dados numéricos efetivos extraídos do pipeline de escalas do `config.js` web
para `data/systems.json` (raios, μ, SOI, órbitas, períodos, cores, discos,
tideKillR, luminosidades). Tabela de referência (valores efetivos do web):

### 5.1 Sistema Solar (centro [0,0,0], raio 4.200.000 u)

- **Sol:** raio 11.000, μ 1,1e12, SOI 4,2M, spin 540 s.
- **8 planetas** (raio / órbita / características): Mercúrio 1.254/208.000
  (crateras); Vênus 3.135/320.000 (nuvens, atmosfera); **Terra 3.300/440.000**
  (oceanos, continentes, calotas, nuvens, city lights, atmosfera azul, spin 60 s);
  Marte 1.749/624.000 (calotas CO₂, mares); Júpiter 9.900/1.200.000 (8 bandas,
  Grande Mancha); Saturno 8.235/1.960.000 (bandas ouro, **anéis** 10.350–19.350,
  tilt 0,47); Urano 5.400/2.960.000 (anéis 7.020–9.450, tilt 1,5); Netuno
  5.197,5/3.840.000 (Mancha Escura).
- **12 luas:** Lua (Terra, 1.782, órbita 3.200, T=80 s); Fobos/Deimos (Marte);
  Io/Europa/Ganimedes/Calisto (Júpiter); Titã/Reia (Saturno); Titânia/Oberon
  (Urano); Tritão (Netuno, **retrógrada**).
- **Estações** (sem gravidade): **EEI** (órbita 1,35×R Terra) + Satélites
  Órbita-1/2/3; um posto/estação por planeta.
- **Cometa Halley:** elipse a=900.000, e=0,90, cauda de íons anti-solar + cauda
  de poeira + coma, comprimento ∝ (rPeri/r)².

### 5.2 Betelgeuse (centro [16,64M, 0,96M, −16,64M], raio 300.000)

- **Betelgeuse** (supergigante vermelha): raio 60.000, μ 1,6e13, células de
  convecção gigantes, silhueta assimétrica, envelope de poeira.
- **Siwarha** (companheira azul-branca): órbita 86.000.
- **3 planetas** (fases jogáveis): Cinza (lua Bruxa), Brasa (atmosfera, luas
  Tição e Fagulha), Fuligem (lua Carvão) — cada um com estação.

### 5.3 Binário BN + Pulsar (centro [−20,8M, 0, 7,04M], raio 280.000)

- Par binário circular (separação 140.000, baricentro).
- **Buraco negro:** rs=480, μ 5,0e12, disco 1.440–16.000 (estrias + aro
  branco-quente + Doppler beaming), anel de fótons 1.248, `tideKillR` 7.800,
  jato bipolar.
- **Estrela de nêutrons (pulsar):** raio 90, μ 2,0e12, farol ~30 Hz, jatos
  polares, linhas de campo dipolo, `tideKillR` 420, toro síncrotron 270–2.600.
- Decoração: remanescente de supernova (casca em expansão) + corrente de acreção.

### 5.4 Binário Caótico (centro [5,76M, −0,96M, 23,36M], raio 260.000)

- Estrelas Azurak (μ 6,0e11) e Karvon (μ 2,5e11) + **5 planetas
  circumbinários** (Vagante I–V), tudo em **N-corpos integrado** (velocity-Verlet,
  softening 2.500, vis-viva inicial, excentricidade 0,45).

### 5.5 Núcleo da Galáxia (centro [−12,16M, 1,92M, −23,04M], raio 420.000)

- **Sgr A✦** (SMBH): rs=2.700, μ 4,0e13, disco quiescente 8.100–28.000, anel de
  fótons 7.020, **sem tideKillR** (cruza o horizonte intacto), jato bipolar.
- **12 estrelas S** em elipses keplerianas (a 70.000–260.000, e 0,12–0,50, SOI
  de Hill no periélio) — dá para orbitar e acompanhar cada uma.
- **3 planetas errantes** em elipses inclinadas.

### 5.6 Véu (centro [21M, 0,525M, 16,625M], raio 200.000) — exploração livre

- Gigante vermelha **Braseiro** (pulsação radial) + anã branca **Véspera** em
  par binário; cometa do Véu; corrente de acreção gigante→anã.

## 6. Visual (reconstrução total — o ponto fraco do web)

- **Skybox:** NASA SVS Deep Star Maps (equiretangular galáctico) ou ESO
  GigaGalaxy Zoom (CC BY 4.0) — Via Láctea fotográfica.
- **Planetas:** texturas reais CC BY 4.0 (Solar System Scope, NASA Visible
  Earth — incluindo **city lights** da Terra no lado noturno, nuvens em camada
  separada); normal maps (Zenodo CC BY 4.0).
- **Atmosfera:** shader de scattering rápido (arco azul do limbo visto de órbita
  — elemento central da fase) com fallback leve para Iris Xe.
- **Estrelas:** shader custom (FBM/granulação + limb darkening + coroa +
  lens flare com oclusão); LOD ponto↔disco fotométrico por luminosidade.
- **Anéis:** malha anelar + textura radial CC BY + sombreamento analítico.
- **Buracos negros:** shader custom (disco com gradiente térmico + beaming +
  sombra/anel de fótons; lente gravitacional de tela próxima).
- **Pulsar:** núcleo + cones de feixe rotacionando + strobe.
- **Cometas:** núcleo + coma + caudas (íons anti-solar, poeira defasada).
- **Assets:** somente CC0/CC-BY; `ATTRIBUTION.md` obrigatório.
- Efeitos de frame: bloom, pulso na transição de modo, escurecimento do céu com β.

## 7. HUD e UI (pt-BR)

- Barra superior: missão/alvo, velocidade (km/h na fase; indicador WARP/
  INTERESTELAR fora), throttle, estado do frame (`◎ FASE — SISTEMA X` /
  `✦ CRUISE` / `⭒ JORNADA`), corpo dominante, altitude, G (com cores por
  severidade), instrumento orbital (`v○`, tangencial, radial), análise de fuga
  (PRESO/FUGA/ÓRBITA/QUEDA/SUBINDO), casco, nukes/cooldowns (release 2), score.
- **Alertas priorizados:** segurar W para decolar; horizonte de eventos;
  gravidade da NS; maré extrema; arrasto do disco; reentrada; escudo; casco
  crítico; atmosfera.
- Overlay de nav (brackets do alvo, distância, ETA, arco balístico em release 2),
  **mapa 2D** (`M`): galáctico (projeção radial-log) em CRUISE, local linear
  centrado no planeta em fase.
- Toasts de transição de estado; menus: menu inicial, briefing, pausa,
  game-over (com causa da morte), vitória (release 2).

## 8. Gameplay de combate e campanha (DOCUMENTADO — release 2)

Extraído e preservado aqui; **fora do escopo de implementação desta release**:

- **Campanha:** 5 fases ordenadas (Solar → Betelgeuse → Binário → Caótico →
  Núcleo), desbloqueio progressivo, viagem livre; vitória final.
- **Missões:** `hunt` (5→13 alvos por fase, bases de superfície em luas/
  planetas com escolta de 3 caças; a cada 3º alvo, nave capital no sistema
  binário), `visit` (chegar a distância X de um corpo), `clear`.
- **Inimigos:** fighter (HP 50, persegue < 2.500 u), bomber (HP 90, bomba
  balística), station (HP 220); patrulha orbital em frame do corpo-âncora;
  oclusão analítica de tiro.
- **Armas:** laser (dano 34, cd 0,12 s), nuke (balística com solver de
  shooting-method, área 2.500 u, reserva 4, regen 1/20 s), traçadora
  gravitacional (sonda), bomba de Higgs (poço μ=5e11 por 8 s, critério de Roche,
  70% extração de plasma / 30% supernova), bomba inimiga.
- **Recompensas:** abate +150, alvo +500, missão +1.000.

## 9. Escopo desta release

**Incluído:** máquina de frames completa (decolagem, fase, cruise, journey),
física orbital de alta fidelidade, os 6 sistemas com todas as fases planetárias,
visual reconstruído (§6), HUD/mapas/menus (§7), navegação T/N/O/C/V/Z,
testes headless (probe + smoke + screenshots).

**Excluído (release 2 `space-war-godot-gameplay-v1`):** inimigos, armas,
missões, campanha, score (já especificados em §8).

## 10. Requisitos não-funcionais

- Constitution: offline-first; assets CC0/CC-BY documentados; README pt-BR com
  tabela de controles; smoke test headless com exit code; sondas empíricas
  (`tests/probe.gd`); screenshots via env var; física documentada no código.
- Performance: 60 fps na fase terrestre em Intel Iris Xe a 1080p (Forward+),
  com degradação automática de efeitos caros.
- Código em inglês (identificadores), comentários pt-BR, tipagem estática
  GDScript, header comment por arquivo (convenção dos projetos Godot do repo).
