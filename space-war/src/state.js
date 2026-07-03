// state.js — Estado global do jogo, exposto em window.__spaceWar para testes/diagnóstico.

export const game = {
  started: false,
  paused: false,
  phase: 'menu',          // menu | flight | gameover | win
  time: 0,                // tempo de jogo (s)
  // Mundo
  bodies: [],             // todos os corpos: { def, group, mesh, worldPos:Vector3, mu, soi, isMoon, parent }
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
  // Flare do Sol (diagnóstico do bug space-war-solar-flare-universe-overlay)
  sunFlareVisible: true,
  // Missões
  mission: null,
  missionIndex: 0,
  score: 0,
  kills: 0,
  // Navegação
  nav: { target: null, aligning: false },
  // UI
  mapOpen: false,
  // diagnostics
  fps: 0,
};

if (typeof window !== 'undefined') {
  window.__spaceWar = game;
}
