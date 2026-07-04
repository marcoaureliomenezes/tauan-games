// test-physics-unit.js — Fidelidade física dos corpos compactos (release
// space-war-physics-fidelity-v1). Roda em node puro:
//   node --experimental-default-type=module tests/space-war/tools/test-physics-unit.js
//
// Prova as leis da literatura no código REAL do jogo:
//  1. Paczyński–Wiita: ISCO em 3·r_s — órbita a 3.5·r_s sobrevive, a 2.9·r_s mergulha.
//  2. Convergência newtoniana longe do horizonte (r ≫ r_s).
//  3. Gradiente de maré ∝ 1/r³.
//  4. Invariantes de massa do config: TOV, hierarquia SMBH, companheira ≥ 0.08 M☉.

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  pwAccel, pwCircularSpeed, tidalGradient, MU_SUN_GAME,
  journeyProfile, journeyDuration, aberrateCos, dopplerFactor,
} from '../../../space-war/src/celestial/physics.js';

// Integra órbita 2D no potencial PW com semi-implícito Euler (mesma família de
// integração do jogo). Retorna r mínimo e máximo ao longo de nPeriods.
function integratePW(mu, rs, r0, vScale, nPeriods) {
  let x = r0, y = 0;
  const vCirc = pwCircularSpeed(mu, r0, rs);
  let vx = 0, vy = vCirc * vScale;
  const T = 2 * Math.PI * r0 / vCirc;
  const dt = T / 4000;
  let rMin = r0, rMax = r0;
  const steps = Math.ceil(nPeriods * T / dt);
  for (let i = 0; i < steps; i++) {
    const r = Math.hypot(x, y);
    rMin = Math.min(rMin, r); rMax = Math.max(rMax, r);
    if (r < rs * 1.02) return { rMin, rMax, plunged: true };
    const a = pwAccel(mu, r, rs);
    vx += (-x / r) * a * dt;
    vy += (-y / r) * a * dt;
    x += vx * dt; y += vy * dt;
  }
  return { rMin, rMax, plunged: false };
}

const MU = 5.0e12;   // BN estelar do jogo
const RS = 160;

test('PW: órbita circular a 3.5·r_s é ESTÁVEL (≥3 períodos, r nunca cai a 3·r_s)', () => {
  const { rMin, rMax, plunged } = integratePW(MU, RS, RS * 3.5, 0.995, 3);
  assert.equal(plunged, false);
  assert.ok(rMin > RS * 3.0, `rMin ${rMin.toFixed(0)} deve ficar acima da ISCO ${RS * 3}`);
  assert.ok(rMax < RS * 4.5, `rMax ${rMax.toFixed(0)} contido (órbita ligada)`);
});

test('PW: órbita a 2.9·r_s (abaixo da ISCO) com perturbação MERGULHA no horizonte', () => {
  const { plunged } = integratePW(MU, RS, RS * 2.9, 0.995, 6);
  assert.equal(plunged, true, 'abaixo da ISCO não existe órbita estável — mergulho');
});

test('PW: converge ao newtoniano longe do horizonte (r = 100·r_s → erro < 3%)', () => {
  const r = RS * 100;
  const newton = MU / (r * r);
  const pw = pwAccel(MU, r, RS);
  assert.ok(Math.abs(pw - newton) / newton < 0.03);
});

test('maré: gradiente ∝ 1/r³ (dobrar r divide o gradiente por 8)', () => {
  const g1 = tidalGradient(MU, 1000, 10);
  const g2 = tidalGradient(MU, 2000, 10);
  assert.ok(Math.abs(g1 / g2 - 8) < 1e-9);
});

test('proporções verdadeiras: geometria do sistema solar é consistente (T-TP-01)', async () => {
  const { SUN, PLANETS, BETELGEUSE } = await import('../../../space-war/src/config.js');
  // 1. Nenhum par de SOIs planetários vizinhos se sobrepõe.
  const sorted = [...PLANETS].sort((a, b) => a.orbit - b.orbit);
  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i], b = sorted[i + 1];
    const gap = b.orbit - a.orbit;
    assert.ok(gap > a.soi + b.soi,
      `SOIs de ${a.name} (${a.soi}) e ${b.name} (${b.soi}) não cabem no gap ${gap}`);
  }
  // 2. Mercúrio (órbita mais interna) fora do Sol com folga ≥ 1.3×.
  assert.ok(sorted[0].orbit - sorted[0].soi > SUN.radius * 1.3,
    `${sorted[0].name} precisa de folga do Sol (R=${SUN.radius})`);
  // 3. Toda lua orbita DENTRO da SOI do pai (patched-conics íntegro) e fora de 2·R.
  for (const p of PLANETS) {
    for (const m of (p.moons || [])) {
      assert.ok(m.orbit + m.soi < p.soi, `lua ${m.name} (${m.orbit}+${m.soi}) fora da SOI de ${p.name} (${p.soi})`);
      assert.ok(m.orbit > p.radius * 2.0, `lua ${m.name} colada em ${p.name}`);
    }
  }
  // 4. Ordem de tamanhos: Betelgeuse > Sol > todo planeta; Terra grande vs a
  //    NAVE (≥ 275 naves de raio) — a "parede" vem de CHEGAR PERTO (retificação
  //    do operador 2026-07-04: inflação estática de raio foi rejeitada).
  const maxPlanet = Math.max(...PLANETS.map((p) => p.radius));
  assert.ok(BETELGEUSE.star.radius > SUN.radius, 'Betelgeuse segue a maior estrela');
  assert.ok(SUN.radius > maxPlanet, 'Sol maior que qualquer planeta');
  const earth = PLANETS.find((p) => p.key === 'earth' || /terra/i.test(p.name));
  assert.ok(earth.radius >= 2200, `Terra ${earth.radius} pequena demais vs a nave`);
  // 4b. HONESTIDADE ANGULAR (θ = 2R/d — bug space-war-fake-apparent-proportions):
  //     o Sol do chão da Terra entre ~1.1° e ~8.6° (nunca ~30° de céu);
  //     Saturno visto da Terra na conjunção < 0.7° (não um disco gigante).
  const thetaSun = 2 * SUN.radius / earth.orbit;
  assert.ok(thetaSun > 0.02 && thetaSun < 0.15,
    `Sol da Terra subtende ${(thetaSun * 57.3).toFixed(1)}° — fora de [1.1°, 8.6°]`);
  const saturn = PLANETS.find((p) => /saturno/i.test(p.name));
  const thetaSat = 2 * (saturn.ring ? saturn.ring.outer : saturn.radius) / (saturn.orbit - earth.orbit);
  assert.ok(thetaSat < 0.022, `Saturno da Terra subtende ${(thetaSat * 57.3).toFixed(2)}° — deve ser < ~1.26° (joia, não disco)`);
  // 5. Gauge: v_esc de superfície do Sol preservada (μ/R re-gauge exato —
  //    a zona de não-retorno vive; derivado do CONFIG, não constante mágica).
  const vEsc = Math.sqrt(2 * SUN.mu / SUN.radius);
  assert.ok(Math.abs(vEsc - 14142) / 14142 < 0.05, `v_esc do Sol ${vEsc.toFixed(0)} ≠ ~14142`);
});

test('proporções verdadeiras: anos-luz entre sistemas + compactos das referências', async () => {
  const { SYSTEMS, BINARY, CORE, SUN } = await import('../../../space-war/src/config.js');
  const solar = SYSTEMS.find((x) => x.key === 'solar');
  // Sistemas vizinhos a ≥ 4× o raio do solar (nenhum disco cruza o vazio).
  for (const s of SYSTEMS) {
    if (s.key === 'solar') continue;
    const d = Math.hypot(...s.center);
    assert.ok(d > 4 * solar.radius, `${s.key} a ${(d / 1e6).toFixed(1)}M — perto demais do solar`);
    // De lá, o Sol subtende < 0.11° — invisível como disco (só ponto/glow).
    assert.ok(2 * SUN.radius / d < 2e-3, `Sol visível como disco de ${s.key}`);
  }
  // BN das referências: 3× horizonte, disco 5× (ISCO 3·rs, sombra 2.6·rs, o
  // disco DOMINA a cena >30·rs), maré ~16·rs, jato ligado.
  const bh = BINARY.blackHole;
  assert.equal(bh.rs, 480);
  assert.ok(Math.abs(bh.disk.inner / bh.rs - 3.0) < 0.01, 'ISCO = 3·rs');
  assert.ok(Math.abs(bh.photonRing / bh.rs - 2.6) < 0.01, 'sombra = 2.6·rs');
  assert.ok(bh.disk.outer / bh.rs > 30, 'disco domina a cena (>30·rs)');
  assert.ok(bh.disk.outer >= 16_000, 'disco 5× (operador)');
  assert.equal(bh.jet, true, 'jato bipolar (referências)');
  assert.ok(bh.tideKillR > bh.rs * 12 && bh.tideKillR < bh.rs * 22, 'maré ~16·rs');
  // Sgr A* 3× coerente (ISCO/sombra); disco NÃO invade o periélio das estrelas S.
  assert.ok(Math.abs(CORE.smbh.disk.inner / CORE.smbh.rs - 3.0) < 0.01);
  assert.ok(Math.abs(CORE.smbh.photonRing / CORE.smbh.rs - 2.6) < 0.01);
  assert.ok(CORE.smbh.disk.outer < CORE.aMin * (1 - CORE.eMax), 'disco de Sgr A* invade periélio das S');
  // NS das referências: 3× visual, TOV intacto, maré fora da superfície.
  const ns = BINARY.neutronStar;
  assert.equal(ns.radius, 90);
  assert.ok(ns.mu / 1e12 <= 2.2, 'TOV');
  assert.ok(ns.tideKillR > ns.radius, 'zona de maré fora da superfície');
});

test('viagem brachistochrone: perfil flip-and-burn correto (AC-02 journey)', () => {
  const D = 5_000_000, T = 300;
  // extremos exatos
  assert.ok(Math.abs(journeyProfile(D, T, 0).x) < D * 0.001);
  assert.ok(Math.abs(journeyProfile(D, T, T).x - D) < D * 0.01, 'x(T) = D');
  // pico de velocidade no MEIO = 2D/T; aceleração a = 4D/T²
  const mid = journeyProfile(D, T, T / 2);
  assert.ok(Math.abs(mid.v - 2 * D / T) / (2 * D / T) < 0.01, 'v_pico = 2D/T em s=½');
  assert.ok(Math.abs(mid.a - 4 * D / (T * T)) < 1e-9);
  // simetria: v(s) = v(1−s) (desacelera na MESMA proporção — demanda do operador)
  for (const s of [0.1, 0.25, 0.4]) {
    const va = journeyProfile(D, T, s * T).v;
    const vb = journeyProfile(D, T, (1 - s) * T).v;
    assert.ok(Math.abs(va - vb) / va < 1e-9, `v(${s}) = v(${1 - s})`);
  }
  // duração clampada aos limites do operador (3:00–6:00)
  assert.equal(journeyDuration(0, 1e6, 9e6), 180);
  assert.equal(journeyDuration(1e9, 1e6, 9e6), 360);
  const dMid = journeyDuration(5e6, 1e6, 9e6);
  assert.ok(dMid > 180 && dMid < 360);
});

test('relatividade: aberração agrupa à FRENTE e Doppler azula o rumo (AC-04)', () => {
  // estrela a 90° do rumo aparece em arccos β (headlight effect)
  const b = 0.99;
  assert.ok(Math.abs(aberrateCos(0, b) - b) < 1e-12, 'cos θ_ap(90°) = β');
  const thetaAp = Math.acos(aberrateCos(0, b)) * 180 / Math.PI;
  assert.ok(thetaAp < 9, `a β=0.99 a estrela de 90° aparece a ${thetaAp.toFixed(1)}° do nariz`);
  // à frente: blueshift (δ>1); atrás: redshift (δ<1)
  assert.ok(dopplerFactor(1, 0.9) > 3, 'frente fortemente azulada');
  assert.ok(dopplerFactor(-1, 0.9) < 0.3, 'trás fortemente avermelhada');
  // β=0 → identidade
  assert.ok(Math.abs(aberrateCos(0.5, 0) - 0.5) < 1e-12);
  assert.ok(Math.abs(dopplerFactor(0.5, 0) - 1) < 1e-12);
});

test('config: massas respeitam a física (TOV, hierarquia SMBH, companheira)', async () => {
  const { BINARY, CORE, BETELGEUSE } = await import('../../../space-war/src/config.js');
  const nsSun = BINARY.neutronStar.mu / MU_SUN_GAME;
  assert.ok(nsSun <= 2.2, `NS ${nsSun} M☉ deve respeitar o limite TOV (~2.2)`);
  assert.ok(CORE.smbh.mu > BINARY.blackHole.mu,
    'SMBH deve ser mais massivo que qualquer BN estelar (hierarquia)');
  const compSun = BETELGEUSE.companion.mu / MU_SUN_GAME;
  assert.ok(compSun >= 0.08, `companheira ${compSun} M☉ ≥ limite de fusão de H (0.08)`);
  // Geometria EHT: anel na borda da sombra (2.6·r_s), disco interno na ISCO (3·r_s)
  assert.ok(Math.abs(BINARY.blackHole.photonRing / BINARY.blackHole.rs - 2.6) < 0.01);
  assert.ok(Math.abs(BINARY.blackHole.disk.inner / BINARY.blackHole.rs - 3.0) < 0.01);
  assert.ok(Math.abs(CORE.smbh.photonRing / CORE.smbh.rs - 2.6) < 0.01);
  assert.ok(Math.abs(CORE.smbh.disk.inner / CORE.smbh.rs - 3.0) < 0.01);
});

// ═══════════ FOTOMETRIA DE FONTES PONTUAIS (photometric-stars, AC-01/02) ═════

test('fotometria: fluxo inverso-quadrado e gauge', async () => {
  const { pointIntensity, PHOTO_D0 } = await import('../../../space-war/src/celestial/physics.js');
  // I(L=1, d=D0) = 1 (gauge); dobrar d divide I por 4 (F ∝ L/d²)
  assert.ok(Math.abs(pointIntensity(1, PHOTO_D0) - 1) < 1e-12);
  const I1 = pointIntensity(3, 500_000);
  const I2 = pointIntensity(3, 1_000_000);
  assert.ok(Math.abs(I1 / I2 - 4) < 1e-9, 'dobrar d deve dividir o fluxo por 4');
  // magnitude de Pogson consistente: Δm = −2.5·log10(I2/I1) = +1.505 (mais fraca)
  const dm = -2.5 * Math.log10(I2 / I1);
  assert.ok(Math.abs(dm - 1.50515) < 1e-3);
});

test('fotometria: PSF — núcleo fixo, glare √(I−1), teto e cobertura sub-pixel', async () => {
  const { pointPx, pointAlpha } = await import('../../../space-war/src/celestial/physics.js');
  // Sub-saturada (I ≤ 1): tamanho NÃO muda (núcleo fixo) — só a opacidade cai
  assert.equal(pointPx(0.04), pointPx(1.0));
  assert.ok(Math.abs(pointAlpha(0.04) - 0.04) < 1e-12, 'α = I (fade por cobertura)');
  assert.equal(pointAlpha(7), 1);
  // Saturada: cresce ∝ √(I−1) (Spencer 1995), monótona, com teto
  const p2 = pointPx(2), p5 = pointPx(5), p1e4 = pointPx(1e4);
  assert.ok(p2 > pointPx(1) && p5 > p2, 'glare cresce com I');
  assert.ok(Math.abs((p5 - 2.2) / (p2 - 2.2) - 2) < 1e-9, '√(5−1)/√(2−1) = 2');
  assert.equal(p1e4, 26, 'teto maxPx');
});

test('fotometria: LOD ponto↔disco com histerese 2px↑/1px↓', async () => {
  const { lodStep, discPx } = await import('../../../space-war/src/celestial/physics.js');
  // θ_px: NS (R=30) a 90k u com pixel de 1.67 mrad → sub-pixel (modo ponto)
  const pxAngle = 1.67e-3;
  assert.ok(discPx(30, 90_000, pxAngle) < 1, 'NS é sub-pixel a 90k');
  assert.ok(discPx(110_000, 5_000_000, pxAngle) > 2, 'Sol a 5M ainda é disco resolvível');
  // histerese: sobe a disco só em ≥2px; desce a ponto só em <1px; banda mantém
  assert.equal(lodStep('point', 1.5), 'point');
  assert.equal(lodStep('point', 2.0), 'disc');
  assert.equal(lodStep('disc', 1.5), 'disc');
  assert.equal(lodStep('disc', 0.9), 'point');
});

test('fotometria: hierarquia de luminosidades declaradas (D-7)', async () => {
  const { lumForStar, STAR_LUM_DEFAULTS } = await import('../../../space-war/src/celestial/physics.js');
  const { BINARY, BETELGEUSE, CHAOTIC } = await import('../../../space-war/src/config.js');
  // O pulsar é a fonte PONTUAL mais brilhante do jogo (Crab comprimido)
  assert.ok(lumForStar(BINARY.neutronStar) > lumForStar(BETELGEUSE.star));
  assert.ok(lumForStar(BETELGEUSE.star) > 1, 'supergigante ≫ Sol');
  assert.ok(lumForStar(CHAOTIC.stars[0]) < 1 && lumForStar(CHAOTIC.stars[0]) > 0);
  // defaults por kind: BN e planetas não emitem (0 → sem ponto fotométrico)
  assert.equal(lumForStar({ kind: 'blackhole' }), 0);
  assert.equal(lumForStar({ kind: 'rock' }), 0);
  assert.equal(lumForStar({ kind: 'neutron' }), STAR_LUM_DEFAULTS.neutron);
  assert.equal(lumForStar({ kind: 'neutron', lum: 5 }), 5, 'override declarado manda');
});
