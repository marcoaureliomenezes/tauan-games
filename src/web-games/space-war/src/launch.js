// launch.js — SEQUÊNCIA DE DECOLAGEM pilotada (port do launch.gd do space-war
// Godot, onde o conceito foi evoluído; o web é o destino do backport).
//
// NÃO é cutscene: o jogador pilota o tempo todo (W MANTIDO para subir); a
// física é real o tempo inteiro (gravidade, inércia, arrasto atmosférico). O
// controlador só fornece o PROGRAMA DE ARFAGEM (pitch program) e o empuxo
// enquanto W estiver pressionado:
//
//   1. LANDED:       nave presa à superfície, girando com o planeta.
//   2. ASCENT:       subida quase vertical com início suave de inclinação.
//   3. GRAVITY_TURN: a direção de empuxo gira de radial para tangente
//                    (prograde) — a nave entra em movimento tangente.
//   4. INSERTED:     altitude da órbita de entrada (R/3) + velocidade
//                    tangencial ≈ v_circ → órbita alcançada.
//
// A simulação da subida é PLANETA-PINADO (conceito PhaseWorld do Godot): o
// estado integrado é RELATIVO ao planeta (pos−worldPos, vel−worldVel) — a
// translação do planeta no sistema solar não perturba a malha fechada; o
// ship.js converte de volta ao frame de mundo a cada frame.
//
// Malha FECHADA nos DOIS canais (adaptação necessária da lei do Godot: lá o
// empuxo é ~4,6× g_surf e o canal tangencial pode ser aberto; aqui g_surf=300
// e o empuxo sobra — canal tangencial aberto estouraria v_circ em <1 s):
//   radial:     persegue v_rad desejada (afunila até 0 na altitude de entrada)
//   tangencial: persegue v_circ_local × blend (o gravity turn emerge disso)
//
// Módulo THREE-free (duck-typing em {x,y,z}) → testável em node puro.

export const LAUNCH_STAGE = { LANDED: 0, ASCENT: 1, GRAVITY_TURN: 2, INSERTED: 3 };

export const LAUNCH = {
  ENTRY_ALT_FRAC: 1 / 3,   // altitude da órbita de entrada = raio × isto ("100 km")
  THRUST_G: 4.6,           // empuxo máx = 4,6 × g_surf (Godot: 18 u/s² p/ g 3,9
                           // — vence gravidade + arrasto denso; 2,5× encalhava
                           // na atmosfera baixa com terminal ~30 u/s)
  VRAD_GAIN: 0.15,         // 1/s — v_rad desejada = (altT − alt) × isto…
  VRAD_CAP_FRAC: 0.05,     // …capada em 0,05 × altT por segundo (perfil ~20 s)
  TURN_ALT_FRAC: 0.5,      // alt ≥ 0,5 × altT → estágio GRAVITY_TURN (toast)
  FINAL_ALT_FRAC: 0.9,     // alt ≥ 0,9 × altT → reta final (circularização)
  MIN_T: 18,               // s mínimos de subida (nunca inserção instantânea)
  BOOSTER_ALT_FRAC: 0.14,  // 1º booster separa a 0,14 × altT; o 2º +0,11 depois
  BOOSTER_GAP_FRAC: 0.11,
  // janela de inserção (frações de v_circ local — iguais ao Godot, exceto o
  // piso de altitude: 0,9 × altT fica ACIMA do topo da atmosfera (0,84 × altT)
  // — inserir a 0,8 deixava a órbita DENTRO do arrasto e ela decaía até reentrar
  INS_ALT_MIN: 0.9, INS_VTAN_MIN: 0.998, INS_TOL: 0.010,
};

// Raio da órbita de entrada do planeta (u) — Ship.entry_orbit_radius do Godot.
export function entryOrbitRadius(planet) {
  return planet.def.radius * (1 + LAUNCH.ENTRY_ALT_FRAC);
}

// Velocidade de inserção orbital (u/s) = v_circ na órbita de entrada.
export function entrySpeed(planet) {
  return Math.sqrt(planet.mu / entryOrbitRadius(planet));
}

// Estado da sequência (recriar a cada pouso).
export function createLaunch() {
  return { stage: LAUNCH_STAGE.LANDED, t: 0, boostersDropped: 0, events: [] };
}

const _n = (v) => Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
const _dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;

// Um tick da subida (ASCENT/GRAVITY_TURN). `rel` = {pos, vel} RELATIVOS ao
// planeta ({x,y,z} duck-typed); `planet` = {def:{radius}, mu}; devolve
// { ax, ay, az (aceleração de empuxo, frame do planeta), dirX/Y/Z (atitude
// do nariz), gain (0..1 p/ FX do motor) } e MUTA L (stage/t/events).
export function launchTick(L, rel, planet, wHeld, dt) {
  L.t += dt;
  const R = planet.def.radius;
  const altT = R * LAUNCH.ENTRY_ALT_FRAC;
  const r = _n(rel.pos);
  const alt = r - R;
  const ux = rel.pos.x / r, uy = rel.pos.y / r, uz = rel.pos.z / r;  // radial local
  // prograde = up × Ŷ (mesmo sentido orbital da Lua — plano quase-equatorial)
  let tx = -uz, ty = 0, tz = ux;
  const tl = Math.sqrt(tx * tx + ty * ty + tz * tz) || 1;
  tx /= tl; ty /= tl; tz /= tl;

  const blend = Math.max(0, Math.min(1, alt / altT));
  if (L.stage === LAUNCH_STAGE.ASCENT && alt >= altT * LAUNCH.TURN_ALT_FRAC) {
    L.stage = LAUNCH_STAGE.GRAVITY_TURN;
    L.events.push({ type: 'turn' });
  }
  // separação de estágios (2 boosters na subida)
  if (L.boostersDropped < 2 &&
      alt >= altT * (LAUNCH.BOOSTER_ALT_FRAC + L.boostersDropped * LAUNCH.BOOSTER_GAP_FRAC)) {
    L.events.push({ type: 'booster', idx: L.boostersDropped });
    L.boostersDropped += 1;
  }

  const vRad = _dot(rel.vel, { x: ux, y: uy, z: uz });
  const vTan = _dot(rel.vel, { x: tx, y: ty, z: tz });
  const vCircHere = Math.sqrt(planet.mu / r);
  const gHere = planet.mu / (r * r);
  const T = LAUNCH.THRUST_G * (planet.mu / (R * R));       // teto de empuxo

  // canal RADIAL (malha fechada + feedforward da gravidade): persegue a razão
  // de subida desejada, que afunila até 0 na altitude de entrada
  const vRadCap = altT * LAUNCH.VRAD_CAP_FRAC;
  const vRadDes = Math.max(0, Math.min((altT - alt) * LAUNCH.VRAD_GAIN, vRadCap));
  // ganho 12/s: firme o bastante para SEGURAR v_rad no cap contra g≈300 (com
  // 2/s a correção de −9 u/s² era invisível ao lado do feedforward e a razão
  // de subida estourava — perfil de 20 s virava 4 s)
  let aRad = gHere + (vRadDes - vRad) * 12.0;
  aRad = Math.max(0, Math.min(aRad, T));
  // canal TANGENCIAL (malha fechada): alvo = v_circ local × blend — o gravity
  // turn EMERGE da altitude; sem overshoot mesmo com empuxo sobrando
  const vTanDes = vCircHere * blend;
  let aTan = (vTanDes - vTan) * 4.0;
  aTan = Math.max(0, Math.min(aTan, T * Math.max(blend, 0.05)));

  // reta final (circularização): casa v_circ tangente + mata a radial — o
  // erro vetorial completo, empuxo suavizado pelo erro (pouso macio na órbita)
  let ax, ay, az, dirX, dirY, dirZ, gain;
  if (alt >= altT * LAUNCH.FINAL_ALT_FRAC) {
    const ex = tx * vCircHere + ux * vRadDes - rel.vel.x;
    const ey = ty * vCircHere + uy * vRadDes - rel.vel.y;
    const ez = tz * vCircHere + uz * vRadDes - rel.vel.z;
    const el = Math.sqrt(ex * ex + ey * ey + ez * ez);
    // gain ∝ erro, SEM piso relevante e SEM feedforward de gravidade: com o
    // erro zerado o empuxo morre e a gravidade fecha a órbita (o feedforward
    // aqui congelava v_rad e a nave subia para sempre — creep até alt 159)
    gain = Math.max(0.01, Math.min(el / (entrySpeed(planet) * 0.15), 1));
    if (el > 0.5) { dirX = ex / el; dirY = ey / el; dirZ = ez / el; }
    else { dirX = tx; dirY = ty; dirZ = tz; gain = 0.01; }
    ax = dirX * T * gain;
    ay = dirY * T * gain;
    az = dirZ * T * gain;
  } else {
    ax = ux * aRad + tx * aTan;
    ay = uy * aRad + ty * aTan;
    az = uz * aRad + tz * aTan;
    const al = Math.sqrt(ax * ax + ay * ay + az * az) || 1;
    // atitude = direção do voo/empuxo (nariz acompanha o programa de arfagem)
    dirX = ax / al; dirY = ay / al; dirZ = az / al;
    gain = Math.min(1, al / T);
  }
  if (!wHeld) { ax = 0; ay = 0; az = 0; gain = 0.05; }     // W solto = coast

  // inserção: altitude da órbita de entrada + voo tangencial ≈ v_circ local
  if (alt >= altT * LAUNCH.INS_ALT_MIN &&
      vTan >= vCircHere * LAUNCH.INS_VTAN_MIN &&
      Math.abs(vTan - vCircHere) < vCircHere * LAUNCH.INS_TOL &&
      Math.abs(vRad) < vCircHere * LAUNCH.INS_TOL &&
      L.t >= LAUNCH.MIN_T) {
    L.stage = LAUNCH_STAGE.INSERTED;
    L.events.push({ type: 'inserted' });
  }
  return { ax, ay, az, dirX, dirY, dirZ, gain, alt, altT, blend, vRad, vTan, vCircHere };
}
