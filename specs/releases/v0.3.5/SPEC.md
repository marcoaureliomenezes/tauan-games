# SPEC — v0.3.5

> **Status:** Aprovado
> **Aprovação:** 2026-07-18 — operador, diretiva detalhada em sessão ("Nova fase
> defensiva: BATERIA ANTIAÉREA DE INHAÚMA" — o texto da diretiva é a spec funcional).
> **Criado:** 2026-07-18
> **Depende de:** `v0.3.4` (ondas C1-C6 em execução;
> esta release NÃO toca a campanha — é um MODO de mapa novo, ortogonal).

## Conceito

Fase especial jogada **do chão**: o jogador é o soldado de uma **bateria antiaérea**
no alto de uma colina com vista para Inhaúma e a base militar. Caças inimigos chegam
em **ondas infinitas** para bombardear a cidade, a base e as baterias; a taxa de
spawn **escala com o score/kills**. Missão: abater o máximo de caças e segurar a
barra de integridade da cidade. Clima caótico mas justo: inimigos priorizam
cidade/base (pesos 45/30/15/10 cidade/base/baterias/jogador); ataques ao jogador têm
telegraph claro e os mísseis que o miram são interceptáveis pela .50.

## Arquitetura (módulos novos em `src/defense/`, ≤250 linhas, constantes em `config.js#AA_DEFENSE`)

- Novo modo `'inhauma-defense'` no registry (`src/maps/index.js`) reutilizando a cena
  de Inhaúma (sem duplicar terreno); posição do soldado ancorada em ponto alto real
  do DEM com vista para a TOWN_SHELF.
- `turret-player.js` (posição fixa, gimbal yaw/pitch, HP, arma, munição),
  `turret-camera.js` (pointer lock, mouse mira, pitch -10°..+85°, zoom botão direito,
  integração com `camera-modes.js` sem quebrar voo),
  `turret-weapons.js` (.50 com tracers+queda leve+heat; míssil AA homing com lock
  no HUD + navegação proporcional simplificada, pode errar),
  `enemy-fighters.js` (mesh adaptado de `ally-war.js#_buildEnemyFighter`; estados
  ingress→attack-run→egress→re-ingress; 1-2 mísseis ar-solo e/ou rajada; jinks;
  chaff/flare quando travado),
  `enemy-ordnance.js` (trajetórias caprichadas: arco/terminal dive, smoke trail
  persistente, impacto real com explosão+scorch; telegraph dos mísseis anti-jogador;
  interceptação = bônus),
  `allied-batteries.js` (3-5 baterias autônomas, eficácia baixa, destrutíveis com
  carcaça fumegante),
  `defense-director.js` (spawn infinito com taxa escalando por kills — intervalo
  base 6s ×0.93/N kills mín 1.5s, esquadrilha 1→4, direções variadas; integridade
  da cidade ~20 impactos; derrota cidade 0% ou jogador sem vidas; rng seedado).
- `input.js`: eventos de mouse como flags semânticas (sem acoplar Three.js).
- HUD no padrão diff-render de `hud.js` (retículo + lead indicator, lock, heat,
  mísseis/recarga, barra INHAÚMA, score, alerta de míssil); spans novos no index.html.
- Áudio sintetizado novo em `audio.js` (.50 grave, whoosh, lock beep, alarme,
  flyby doppler fake, explosões distantes abafadas).

## A queda cinematográfica (requisito de destaque)

Caça abatido entra em estado `dying`: explosão inicial, spiral/pique/glide por RNG,
trilha densa de fumaça preta+fogo (pool próprio — não roubar o das explosões),
debris se soltando, ao tocar o terreno real: megaExplosion + shockwave + scorch +
coluna de fumaça; 20% ejeção com paraquedas (ref: `ejection.js`).

## Controles / balanceamento

Pointer lock ao iniciar (clique trava, Esc solta+pausa); mouse mira; LMB .50;
RMB ou X míssil AA; scroll ou 1/2 alterna arma. Caça: 8-12 balas .50 ou 1 míssil,
90-140 m/s. Jogador: 3 vidas, HP regen fora de combate. Escala infinita por taxa de
spawn/agressividade, nunca por HP-sponge. Tudo calibrável em `AA_DEFENSE`.

## Restrições e aceite

- Sem build/TS/assets; ES modules; vendor compartilhado intacto; pools bounded para
  tudo (balas, mísseis, fumaça, debris).
- **Não quebrar nenhum modo existente** (islands/desert/rio/inhauma voo + campaign):
  sistemas da defesa só ativam quando `game.activeMap === 'inhauma-defense'`.
- Lógica pura (director, PN, seleção de alvo, heat) Node-testável; testes novos em
  `tests/aero-fighters/tools/test-aero-defense.mjs` + suites Node existentes verdes.
- Regime visual: sempre 3+ caças visíveis, tracers aliados cruzando, quedas
  cinematográficas frequentes, framerate estável (medido via debug snapshot).
- Evidência: bateria de screenshots (mira, lock, .50 com tracers, queda em espiral
  com fumaça, impacto na cidade, baterias aliadas) — preview para o operador antes
  de qualquer commit.
