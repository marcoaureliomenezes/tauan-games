# REQUISITOS — Aero Fighters (port web → Godot)

> Especificação funcional extraída do web-game
> `repos/tauan-games/src/web-games/aero-fighters/` (Three.js, ~18.900 linhas).
> Todos os números vêm do código-fonte (`src/config.js` é a fonte da verdade).
> Constantes já portadas para `autoload/GameConfig.gd`.

## Status de implementação (v0.2 — 2026-07-19, rodada visual)

Implementado e validado headless (Godot 4.7.1):

- [x] Mapa Inhaúma/Cachoeira: DEM real + biomas EXATOS do web (rocha por patch,
      neve com jitter/slope-lift, verde vivo), shelves, aeródromo com luzes ciano,
      cidades com telhados terracota + paletas oficiais, fábricas, usina nuclear,
      rio por drenagem do DEM (entalhe + fita d'água), **5 corredores de estrada
      (Catmull-Rom) com leito aplainado**, floresta instanciada por banda,
      backdrop, ciclo dia/noite com piso lunar, fog calibrado.
- [x] F-35 procedural fiel ao web (radome, LERX, DSI, canopy-bolha, asas delta,
      V-tails, stabilators, nozzle com glow, plume AB por estágio de throttle,
      navlights/strobe, trem de pouso retrátil) + **loadout visível** (4 leves +
      2 pesados + 1 nuke centerline) que some com o estoque.
- [x] Lançamento de mísseis dos pylons (leve/pesado alternando, nuke centerline,
      rod wingtip) + muzzle flash nas asas.
- [x] FX com Kenney Particle Pack (CC0): fireballs/fumaça/sparks/muzzle/scorch —
      validado em combate real (nuke na guarnição: 8 kills, área de 760 m).
- [x] Áudio 100% sintetizado (15 WAVs via `tools/gen_audio.py`): turbina por
      throttle, vento, canhão/.50, explosões (mega com sub 85→28 Hz), mísseis,
      lock beeps, mayday, overheat, pickup, splash, incoming; mudo no M.
- [x] Tráfego nas estradas (~40 carros, MG-238 com mãos separadas).
- [x] Janelas acesas à noite (0xffc873) + luzes da pista.
- [x] Textura de detalhe do terreno (ruído multiplicativo em UV mundial).
- [x] Wingmen (2 aliados em formação, fogo contra a frente inimiga).
- [x] Ponte rio×MG-238 (detecção automática de cruzamentos, deck + pilares,
      cota segurada como bridgeDeckHeightAt).
- [x] Modo caça completo (voo, 5 câmeras, HUD + minimapa, campanha Ato 1/2,
      fogo inimigo probabilístico).
- [x] Modo defesa completo (bateria com vista corrigida para a cidade, .50 com
      calor, míssil AA PN, caças inimigos, ordenança, baterias aliadas, diretor
      infinito integrado, HUD + minimapa).

Bugs críticos encontrados e corrigidos nesta rodada (via screenshots do MCP
godot-runtime): winding invertido do terreno, vertex-color ausente nos
MultiMeshes, plano d'água cobrindo a pista, fog lavando as cores, yaw da
bateria invertido, billboard quebrando draw pass de partículas, noite preta.

Pendente para v0.3 (TODOs no código): áudio sintetizado, tráfego nas estradas,
pontes/túneis, campos de futebol, janelas acesas à noite, wingmen, boss
GODZILLÃO e mapas legados (ilhas/deserto/rio), pools fixos de FX, cogumelo
nuclear persistente + deformação de terreno, minimapa com terreno renderizado.

## Status de implementação (v0.1 — 2026-07-19)

Implementado e validado headless (Godot 4.7.1):

- [x] Mapa Inhaúma/Cachoeira: DEM real + biomas, shelves, aeródromo, cidades,
      fábricas, usina nuclear, rio por drenagem do DEM (entalhe + fita d'água),
      floresta instanciada, backdrop de montanhas, ciclo dia/noite, fog.
- [x] Modo caça: modelo de voo arcade completo (energia, stall, auto-trim,
      decolagem/pouso/mayday/afundamento), 5 câmeras, HUD, lock-on.
- [x] Arsenal: canhão, mísseis leve/pesado/nuke/rod com hit-roll 80%, pickups,
      explosões/mega/nuclear (GPUParticles3D).
- [x] Alvos: 10 tipos legados + 9 unidades de formação com stats exatas.
- [x] Campanha: guarnição de Cachoeira (44 unidades), agenda seedada do Ato 1,
      artilharia com guerra urbana, falha/reset ("INHAÚMA CAIU"), Ato 2, vitória.
- [x] Fogo inimigo probabilístico (AA 80%/50%, miss 2-6°) + pools de tracers.
- [x] Modo defesa: artilheiro (gimbal, zoom, .50 com calor, míssil AA com PN),
      caças inimigos (FSM completo), ordenança, baterias aliadas, **diretor
      infinito integrado** (no web ficou só especificado), HUD completo.

Pendente para v0.2 (TODOs no código): estradas/pontes reais (MG-060 hoje é
polilinha aproximada), áudio sintetizado, pools fixos de FX, cogumelo nuclear
persistente + deformação de terreno, scorch marks, tráfego, continuação
procedural do relevo além do DEM, boss GODZILLÃO e mapas legados
(ilhas/deserto/rio), telhados terracota/janelas noturnas, minimapa.


## 1. As duas perspectivas

1. **Caça (ataque ar-terra)** — piloto de F-35 em campanha sobre Inhaúma:
   taxi → decolagem → missão → pouso → serviço. Foco no mapa Inhaúma/Cachoeira.
2. **Bateria antiaérea (defesa)** — artilheiro fixo num morro a noroeste da
   cidade defendendo Inhaúma de caças inimigos.

Outros mapas (ilhas, deserto, rio) ficam para versões futuras.

## 2. Dinâmica de jogo

- Game loop 60 fps, dt capado em 0,1 s.
- **Voo:** 3 vidas, HP=3/vida. 3 hits → mayday (avião cai em chamas ≥2 s;
  mega-explosão no impacto, perde 1 vida, respawna no aeroporto). Hit simples:
  1,4 s invencibilidade + shake 0,45 s. Respawn: 3 s invencível (piscada 12 Hz).
  0 vidas = game over.
- **Derrotas (voo):** crash em montanha (mayday), crash no mar (afunda 4,2 s),
  mergulho catastrófico (sink < -26 m/s ou roll > 1,4 rad), perder as 3 vidas.
- **Inhaúma (campanha, sem waves/boss):**
  - **Ato 1 "SALVAR INHAÚMA":** 3 baterias de artilharia (5-8 un. cada, deploy a
    600-1.200 m da cidade, obuseiros com ciclo 6-11 s) + 4 colunas de invasão
    (supplyConvoy×5, troopColumn×8, armoredColumn×10, tankPlatoon×12) partindo
    do vale de Cachoeira por 3 rotas; primeiro spawn aos 5 s, intervalos 40-75 s,
    ato de 10-15 min. **Coluna que completa o path = Inhaúma cai** (game over).
  - **Ato 2 "LIBERTE CACHOEIRA":** destruir toda a guarnição de ocupação.
    Vitória = "CACHOEIRA DA PRATA LIBERTADA" + voo livre.
- **Score:** por tipo de alvo (tabela §5); +1 nuke a cada 5 alvos.

## 3. Controles

### Caça
| Tecla | Ação |
|---|---|
| ↑/I | Nariz p/ baixo (convenção simulador) |
| ↓/K | Nariz p/ cima |
| ←→/A D | Rolagem + guinada coordenada |
| W/S | Throttle sobe/desce |
| Q/E | Leme (yaw puro) |
| Espaço/Z | Canhão (contínuo) |
| X | Míssil leve (requer lock; **infinito**) |
| B | Míssil pesado (lock; estoque 10) |
| T | Míssil nuclear (estoque 3; sem lock) |
| R | Míssil cinético "rod" (estoque 4; sem lock) |
| Shift | Barrel roll (0,5 s invencível, cooldown 1,5 s) |
| C | Cicla câmera (5 modos) |
| J | Ejetar (só em mayday) |
| P/Esc | Pausa · M | Mudo · Enter | Iniciar |

### Bateria AA
| Controle | Ação |
|---|---|
| Mouse | Mira (pointer lock, sens 0,0023 rad/px) |
| LMB (segurado) | Metralhadora .50 |
| RMB (segurado) | Zoom FOV 62→32 |
| Scroll ou 1/2 | Alterna .50 ↔ míssil AA |
| X | Dispara míssil AA homing (consome lock) |
| Esc/P | Pausa |

## 4. Modelo de voo do caça

Velocidade alvo = `8 + throttle × 72`, convergência 1,6/s; modelo de energia:
subir (nariz > 0,18) drena até 35 m/s; mergulho até 104 m/s; teto 9.500 m.
Gravidade 14 m/s² com sustentação ∝ velocidade (`min(speed/20, 1)`). Stall <
14 m/s (nariz cai 0,45 rad/s, comandos a 45%). Pitch 1,45 rad/s (+0,82/-0,70),
roll 2,30 rad/s + yaw coordenado 0,80; leme = yaw × 0,65; auto-trim 0,22/s.
Throttle 1,3/s sobe, 0,9/s desce (piso 0,05 ar / 0,02 chão). Decolagem: rotação
a 32 m/s, liftoff a 4 m. Pouso: flare < 4,5 m, touchdown < 2,2 m, seguro em
pavimento ≤ 62 m/s; roll-out até 34 m/s depois auto-taxi à zona de serviço.
Câmeras (C): Chase (default), Wide, Cockpit, Flyby, Orbit. HUD: MISSÃO/ATO,
vidas, dano, SCORE, MSLS/HVY/NUK/ROD, SPD, THR, ALT, alvos, STALL, guia de
pouso. Minimapa 180 px raio 2.000 m. Lock-on: cone ±15° até 1.600 m, 0,35 s.

## 5. Alvos do caça (hp / score / raio hit / drop%)

base 28/800/6,0/60 · factory 20/600/5,3/50 · building 14/450/4,2/30 ·
convoy 12/380/7,7/40 · armedConvoy 18/700/9,7/45 (9 m/s, burst a 420 m/1,9 s) ·
helicopter 10/650/11,0/35 (46 m, 14 m/s, 620 m/2,3 s) · tank 22/550/6,6/40
(6 m/s, 470 m/2,6 s) · patrolAir 14/720/12,2/40 (95 m, 7 m/s, 700 m/3 s) ·
aaGun 6/250/3,0/10 (220 m/1,7 s) · warship 35/1200/8,9/50 (1.200 m/1 s).

**Unidades de formação (Inhaúma):** fTank 22/550, fApc 16/480, fTruck 10/320,
fTroops 8/260, fArtillery 14/600, fSam 18/900, fAaGun 6/250, fHelicopter 10/650,
fZeppelin 16/720 (stats completas em GameConfig.UNIT_STATS). Fogo inimigo de
formação: projétil reto 80 m/s/4,5 s, acerto probabilístico por distância
(AA: 80% <50 m → piso 5%; terrestre: 50% → piso 3%).

## 6. Mapa Inhaúma / Cachoeira da Prata

- **DEM real** (Chamonix U-valley, pico ~1.281 m) em
  `assets/heightmap/heightmap.u16` (1792², uint16-LE, mundo 20.000 m,
  range -146,89…1.281,36 m; `heightmap.json` tem a fórmula de dequantização).
- "Cachoeira" = a cidade **Cachoeira da Prata** (não há queda d'água no web;
  se quiser cachoeira visual, é requisito novo).
- Cota d'água 4,5 m. Biomas: areia <6 m, campo <18, mata <48, subalpino <180,
  alpino acima; rocha por slope ≥24° ou >480 m; neve 800 m; tree line 620 m.
- **Inhaúma:** shelf x[-650..150] z[-60..560]; downtown (-370,-20) r=160;
  igreja (-330,-40); praça (-390,0); 2 campos de futebol; casas terracota,
  janelas emissive à noite.
- **Cachoeira da Prata (ocupada):** shelf x[-1200..-960] z[440..620] cota 11 m;
  centro (-1080,530); igrejinha (-1058,498); praça (-1092,552).
  **Guarnição:** 2 colunas blindadas ×6 na MG-060, 2 helicópteros, 1 zepelim,
  3 ninhos AA ×5 (anel 300-800 m, sep. mín. 250 m), QG (encampment 8 +
  samSite 6) ao norte.
- **Aeródromo:** pista (-560,320) 620×52 m heading 0; toque (-560,140) 160×44;
  taxiway (-560,430); serviço (-560,475) 76×84 (spawn do jato).
- **Usina nuclear** (620,640): 2 torres 70 m + cúpula + 3 prédios.
- **Fábricas:** (1180,-260), (1080,-120), (-820,300) — galpão 70×22×44 +
  3 chaminés 30 m + 2 tanques.
- **Rio** traçado da drenagem do DEM, largura 14→56 m; pontes nos cruzamentos.
- **Estradas:** MG-238 autoral + corredores OSM (BR-040, MG-060…) com tráfego.
- **Florestas:** 1.500-2.500 árvores, 4 espécies por altitude, instanciadas.
- **Backdrop:** 3 anéis de montanhas a 3,5-5,8 km; fog 900/2600 m #b6d0c4.
- **Céu:** ciclo dia/noite ~5 min; janelas acendem à noite.

## 7. Armas do caça

- **Canhão:** 0,08 s; tracer 110 m/s; vida 2 s; 2 balas/tiro; dano 1.
- **Míssil leve (X):** ∞; lock; 80→130 m/s; turn 0,30/0,55; vida 6 s; dano 4;
  **hit-roll 80%** (miss = near-miss sem dano).
- **Míssil pesado (B):** 10; 65→100 m/s; turn 0,22/0,45; vida 8 s; dano 20.
- **Nuke (T):** 3; 60→85 m/s; vida 12 s; dano 4.000, raio 760 m (decaimento
  linear); mata jogador <300 m, -1 vida <680 m; slow-mo 0,35×/1,5 s; shockwave
  com delay distância/340; incinera ≤42 props; cratera 228 m; cogumelo ~60 s.
- **Rod (R):** 4; 160→260 m/s; turn 0,65; dano 9.999; perfura em cadeia até
  3 alvos ≤760 m (mais próximos primeiro); sem hit-roll.
- **Pickups:** verde = +3 pesados; ciano (5%) = +1 nuke; coleta <3 m; vida 18 s.

## 8. Modo defesa (bateria AA)

- Artilheiro fixo em (-760,-400) cota ~101 m, olhando p/ (-250,250); gimbal
  yaw livre, pitch -10°…+85°; câmera over-shoulder 3,2 m/1,2 m; FOV 62/zoom 32.
- **.50 (LMB):** 8 tiros/s; balístico 450 m/s, queda 3,5 m/s²; dispersão
  0,0045 rad; alcance 1.200 m; dano 1; calor +0,05/tiro (overheat em 20),
  esfria 0,35/s, rearma a 55% (histerese); tracer 1-em-4.
- **Míssil AA (X):** estoque 8, recarga 12 s; lock no caça mais próximo a ±12°
  após 1,2 s; navegação proporcional N=3, 220 m/s, cap lateral 55 m/s², saída
  60 m/s; vida 8 s; espoleta 6 m. Caça travado solta chaff/flare e evade 2,4 s
  a 2,6 rad/s.
- **Artilheiro:** HP 3, 3 vidas; regen após 8 s fora de combate (+1/4 s).
- **Caças inimigos:** ≥3 vivos; spawn 2.300 m (±10%), alt 230-330 m, 90-140 m/s,
  HP 8-12. Ciclo ingress → attack-run (abre 640 m; release 330→120 m; 1-2
  mísseis ar-solo ou rajada 11 tiros/s × 1,2 s no jogador) → egress 5,5 s com
  jinks → re-ingress; sai após 2 corridas. Alvos: cidade 45%, base 30%,
  baterias 15%, jogador 10%. Clearance 15 m (6 m no mergulho). Queda em 3
  estilos; 20% ejeção.
- **Ordenança inimiga:** míssil ar-solo 135 m/s, arco (g=12) → mergulho
  terminal a 260 m; raio 9 m; cidade = -5% integridade/impacto; bateria aliada
  = 8 de dano (HP 12); .50 intercepta mísseis anti-jogador (+250 pts, raio 4 m).
- **Baterias aliadas:** 3-5, HP 12, engajam 620 m, tracers 2,4/s + míssil
  ~5,5 s com 7% de acerto.
- **Score:** +100 caça, +250 interceptação. Derrota: cidade 0% ou vidas 0.
- **Diretor infinito** (no web ficou especificado mas não integrado — aqui
  entra integrado): spawn a cada 6 s ×0,93 a cada 5 kills (piso 1,5 s);
  esquadrilhas 1→4 por degraus 0/12/30/60 kills; cap 10 vivos.

## 9. Explosões e efeitos

Pools: 300 fireballs, 150 debris (g=18), 80 fumaças, 120 trilhas de míssil,
100 colunas de fogo, 100 sparks, anéis de shockwave, scorch ~90 s.
- explosion(scale): 22 fireballs + 8 glows + 8 debris + 10 fumaças +
  14 sparks (×scale) + anel no chão se y<20.
- megaExplosion (bases, fábricas, crash, boss): escala 5 (crash 7) + shockwave
  70-95 + explosões retardadas + 3-5 sub-explosões em 0,3-1,1 s.
- nuclearExplosion: duplo flash, fireball escala 28, 4 anéis (280/320/480/700),
  7 secundárias, cogumelo ~60 s, deformação de terreno, cratera.
- Splash: 46 sprays + 2 anéis de espuma; avião afunda 4,2 s.
- Cenário vivo: chaminés, vapor da usina, incêndios persistentes, speed lines
  >60 m/s, pós-combustor, navlights (strobe 1,2 Hz), trem de pouso retrátil.

## 10. Áudio (tudo sintetizado no web — em Godot, sintetizar via AudioStreamGenerator
ou usar assets CC0)

Turbina (acompanha throttle), canhão, .50, overheat-click, míssil, explosão,
mega-explosão (sub 85→28 Hz), AA, hit, lockBeep (800/1400 Hz), mayday
(880/620 Hz 8 s), closeMiss, radio chatter (8-25 s), vento por altitude,
booms distantes, missileWhoosh, alarme incoming, flyby com doppler.

## 11. Componentes da comunidade a usar (skills godot-*)

- **Terreno:** HTerrain (Zylann, MIT) com o DEM de `assets/heightmap/`
  (LOD quadtree aguenta câmera rápida em altitude).
- **Estradas/tráfego:** Road Generator (theduckcow, MIT) — RoadLanes para
  colunas de invasão e comboios.
- **Vegetação:** árvores instanciadas (MultiMesh) por banda de altitude.
- **VFX:** flipbooks de explosão CC0 (CGHeven) + GPUParticles3D nativas.
- **Juice:** screen shake (Shaker/Juicee), hit-stop via `Engine.time_scale`.
- **Aviões:** pack Planes (FAL, crédito) para inimigos/aliados low-poly.
- **Dano:** componentes Health/HitBox/HurtBox (awesome-godot) ou port simples.
- Física: projéteis `CharacterBody3D` + `move_and_collide` com pool; mísseis
  guiados padrão `look_follow` (`_integrate_forces`) ou steering em código.

## 12. Ressalvas do web-game (decisões para o port)

1. O `defense-director.js` web não era conectado (mínimo fixo de 3 caças) —
   aqui o diretor infinito **já entra integrado**.
2. O README web descreve versão antiga; o código é a verdade (valores acima).
3. `missionRealism` sempre true: fluxo taxi→decolagem→missão→pouso→serviço
   é o caminho real.
4. No web, derrota por cidade 0% na defesa não tinha overlay final — aqui
   implementar os dois desfechos ("INHAÚMA CAIU" e "BATERIA DESTRUÍDA").
5. Boss GODZILLÃO e mapas legados (ilhas/deserto/rio) ficam fora desta versão;
   foco: Inhaúma/Cachoeira nas duas visões.
