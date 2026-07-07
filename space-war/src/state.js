// state.js — Estado global do jogo, exposto em window.__spaceWar para testes/diagnóstico.

export const game = {
  paused: false,
  // TELA da UI (ex-`phase`, renomeado no audit T-PR-05: "phase" agora é
  // reservado p/ fases de campanha/sistema): menu | briefing | flight | win | gameover
  screen: 'menu',
  time: 0,                // tempo de jogo (s)
  // Mundo — FASES (audit T-PR-06): só UM sistema existe por vez, construído na
  // ORIGEM da cena (mata o jitter float32 dos centros a 19–29M u). `origin` é a
  // posição GALÁCTICA da origem da cena: pos_galáctica = origin + pos_cena.
  // systemKey = null ⇒ vazio interestelar (fase de viagem): nenhum corpo,
  // starfield + glows + skybox; a origem REBASEIA acompanhando a nave.
  world: {
    systemKey: null,
    origin: null,         // THREE.Vector3 (preenchido em celestial/system.js)
  },
  bodies: [],             // corpos do sistema ATIVO: { def, group, mesh, worldPos:Vector3, mu, soi, … }
  sun: null,
  // Nave
  ship: {
    pos: null,            // THREE.Vector3 (preenchido em ship.js)
    vel: null,            // THREE.Vector3
    quat: null,           // THREE.Quaternion (orientação)
    throttle: 0,          // 0..1
    boost: false,
    speed: 0,
    flightAssist: true,   // fly-by-wire (Set Speed): throttle = velocidade-alvo, fácil de pilotar
    landed: true,
    hp: 100,
    nukes: 4,
    higgsCd: 0,           // recarga da bomba de Higgs (0 = pronta)
    altitude: 0,          // distância à superfície do corpo dominante
    dominant: null,       // corpo gravitacional dominante (quem mais puxa agora)
    gravMag: 0,           // magnitude da gravidade atual (u/s²)
    escapeVel: 0,         // velocidade de escape do corpo dominante (u/s)
    circVel: 0,           // velocidade de órbita circular no raio atual (u/s)
    canEscape: true,      // a nave consegue escapar com a velocidade máxima?
    killedBy: null,       // 'blackhole'|'neutron'|'gas'|'sea'|'sun'|null — causa da morte
    heat: 0,              // 0..1 aquecimento de reentrada (brilho na tela + dano)
    atmoBody: null,       // corpo cuja atmosfera a nave está atravessando
    inAtmosphere: false,
    noReturn: false,      // dentro da zona de não-retorno (Sol / buraco negro / nêutrons)
    spawnGrace: 0,        // segundos de proteção pós-decolagem (sem dano / inimigos seguram fogo)
    nukeRegen: 0,         // s acumulados p/ recarregar 1 nuke (armas efetivamente ilimitadas)
  },
  // Combate
  enemies: [],
  projectiles: [],
  particles: [],
  // Campanha em fases (campaign.js): { phase, unlocked[], done[] }
  campaign: null,
  // Flare do Sol (diagnóstico do bug space-war-solar-flare-universe-overlay;
  // escrito por celestial/stars.js a cada frame)
  sunFlareVisible: true,
  // Missões
  mission: null,
  missionIndex: 0,
  score: 0,
  kills: 0,
  // Navegação (solution = solução de tiro balística viva, ballistics.js)
  nav: { target: null, aligning: false, solution: null },
  wells: [],              // poços gravitacionais transientes {pos, mu, until, soft} — bomba de Higgs
  journey: null,          // viagem interestelar brachistochrone {active, s, T, D, beta, ...}
  cinema: null,           // câmera-cinema temporária {at:Vector3, until} — ex.: fling de supernova
  // UI
  mapOpen: false,
  // diagnostics
  fps: 0,
};

if (typeof window !== 'undefined') {
  window.__spaceWar = game;
}
