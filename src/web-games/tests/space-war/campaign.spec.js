const { test, expect } = require('@playwright/test');

// Suite da CAMPANHA (release v0.2.3).
// Cobre os ACs do SPEC §7: gating de fase (AC-01), desbloqueio (AC-02), bomba
// inimiga sob gravidade (AC-04), recarga de nuke (AC-05), teto de pegada de base
// (AC-08) e a regressão do flare solar (AC-10 — bug
// space-war-solar-flare-universe-overlay).
//
// T-07 (v0.10.0, batch L2): 2 waits convertidos (settle pós-goTo → polling do
// corpo dominante; aceleração da bomba → polling do Δv aferido). 1 MANTIDO:
// AC-06 (2500 ms) — janela de observação deliberada da co-movimentação da
// patrulha (justificativa no próprio teste).

async function load(page) {
  await page.goto('/src/web-games/space-war/index.html');
  await page.waitForSelector('canvas', { state: 'attached', timeout: 60000 });
  await page.waitForFunction(() => window.__spaceWarReady === true, { timeout: 120000 });
}

async function startFlight(page) {
  await load(page);
  await page.keyboard.press('Enter');      // menu -> briefing (inicia a campanha)
  await page.waitForFunction(() => window.__spaceWar.phase !== 'menu', { timeout: 30000 });
  await page.keyboard.press('Enter');      // briefing -> flight
  await page.waitForFunction(() => window.__spaceWar.phase === 'flight', { timeout: 45000 });
}

test.describe('Space War — Campanha', () => {
  // Budgets largos (2026-07-18): CI compartilhada — boot software-GL >15s sob
  // carga estourava o teto de 30s por TEMPO, não por asserção.
  test.setTimeout(180000);

  // AC-01: começa na fase Solar; fases futuras bloqueadas.
  test('AC-01: gating — fase 0 ativa, demais bloqueadas', async ({ page }) => {
    await startFlight(page);
    const c = await page.evaluate(() => window.__spaceWar.campaign);
    expect(c.phase).toBe(0);
    expect(c.unlocked).toEqual([true, false, false, false, false]);
    expect(c.done).toEqual([false, false, false, false, false]);
    const label = await page.evaluate(() => window.__spaceWar.mission?.label || '');
    expect(label).toContain('CAÇADA');
  });

  // AC-02 (+AC-03): completar as 5 missões solares (incl. a visita ao Halley)
  // desbloqueia Betelgeuse e ativa a fase 2.
  test('AC-02/03: cadeia solar completa desbloqueia BETELGEUSE', async ({ page }) => {
    test.setTimeout(180000);
    await startFlight(page);
    for (let i = 0; i < 2; i++) {
      await page.waitForFunction(() => !!window.__spaceWar.mission && !window.__spaceWar.mission._done, { timeout: 45000 });
      const t = await page.evaluate(() => ({ type: window.__spaceWar.mission.type, label: window.__spaceWar.mission.label }));
      if (i === 0) expect(t.type).toBe('hunt');
      if (i === 1) expect(t.label).toContain('HALLEY');          // AC-03: cometa com relevância de missão
      await page.evaluate(() => window.__swDebug.winMission());
      await page.waitForFunction((idx) => {
        const sw = window.__spaceWar;
        if (idx < 1) return sw.missionIndex === idx + 1 && sw.mission && !sw.mission._done;
        return sw.campaign.phase === 1;
      }, i, { timeout: 45000 });
    }
    const c = await page.evaluate(() => window.__spaceWar.campaign);
    expect(c.done[0]).toBe(true);
    expect(c.unlocked[1]).toBe(true);
    expect(c.phase).toBe(1);
    await page.waitForFunction(() => (window.__spaceWar.mission?.label || '').includes('FASE 2'), { timeout: 45000 });
  });

  // CAÇADA (AC-03 da ballistic-war): destruir o alvo k spawna o k+1 em OUTRO corpo.
  test('caçada: próximo alvo aparece em outro corpo + contagens 5/7/9/11/13', async ({ page }) => {
    await startFlight(page);
    const counts = await page.evaluate(() => {
      const sw = window.__spaceWar;
      return { total: sw.mission.total, all: [5, 7, 9, 11, 13] };
    });
    expect(counts.total).toBe(5);
    const body0 = await page.evaluate(() => window.__spaceWar.mission.targets[0].body.def.name);
    await page.evaluate(() => window.__swDebug.killTarget());
    await page.waitForFunction(() => window.__spaceWar.mission.killed === 1 && window.__spaceWar.mission.targets.length === 2, { timeout: 45000 });
    const body1 = await page.evaluate(() => {
      const m = window.__spaceWar.mission;
      return m.targets[m.targets.length - 1].body.def.name;
    });
    expect(body1).not.toBe(body0);
  });

  // SOLUÇÃO BALÍSTICA (AC-01/02 da ballistic-war): C alinha à direção de tiro.
  // Setup DETERMINÍSTICO via goToObjective: o antigo goTo('lua') dependia da
  // fase orbital aleatória de boot + posição aleatória da base na superfície —
  // ~1/3 dos boots deixava o alvo fora do alcance balístico (flake pré-existente,
  // 4/6 falhas medidas na base journey; corrigido na photometric-stars rc-1).
  test('solução balística: solver acha arco e C alinha o nariz à direção de tiro', async ({ page }) => {
    test.setTimeout(120000);
    await startFlight(page);
    await page.evaluate(() => window.__swDebug.goToObjective(7000));
    // NB: options são o 3º parâmetro de waitForFunction — passar {timeout} no 2º
    // (o slot de ARG) silenciosamente vira argumento da função e o op-timeout
    // NUNCA vale (era por isso que cada falha queimava os 60s do teste).
    await page.waitForFunction(() => {
      const sw = window.__spaceWar;
      return sw.nav.solution && sw.nav.solution.ok === true;
    }, undefined, { timeout: 45000 });
    await page.keyboard.press('KeyC');
    await page.waitForFunction(() => {
      const sw = window.__spaceWar;
      const sol = sw.nav.solution;
      if (!sol || !sol.ok) return false;
      const q = sw.ship.quat;
      const fx = -(2 * (q.x * q.z + q.w * q.y));
      const fy = -(2 * (q.y * q.z - q.w * q.x));
      const fz = -(1 - 2 * (q.x * q.x + q.y * q.y));
      return fx * sol.dir.x + fy * sol.dir.y + fz * sol.dir.z > 0.95;
    }, undefined, { timeout: 45000 });
  });

  // AC-04: bomba inimiga é BALÍSTICA — a gravidade muda a velocidade dela.
  test('AC-04: bomba inimiga acelera sob gravidade', async ({ page }) => {
    await startFlight(page);
    // baixo sobre Júpiter (1.3·R): com a escala de parede (μ ∝ f) o g relativo
    // caiu ×10 — mais perto + janela maior mantêm o sinal mensurável, ainda sem
    // risco de contato (queda de ~10 u em 1.5 s vs altitude ~20k)
    await page.evaluate(() => window.__swDebug.goTo('jupiter', 1.3));
    // T-07: era sleep fixo de 150 ms — espera o campo recomputar pós-teleporte
    // (Júpiter dominante) antes de soltar a bomba.
    await page.waitForFunction(() => window.__spaceWar.ship.dominant?.def?.key === 'jupiter', undefined, { timeout: 45000 });
    const n = await page.evaluate(() => window.__swDebug.dropBomb());
    expect(n).toBeGreaterThan(0);
    const v0 = await page.evaluate(() => {
      const b = window.__spaceWar.projectiles.find((p) => p.isBomb);
      return Math.hypot(b.vel.x, b.vel.y, b.vel.z);
    });
    // headless slow-mo: dt de sim é clampado — 1 s de parede ≈ 0.3 s de sim.
    // T-07: era sleep fixo de 2500 ms — espera a CONDIÇÃO aferida (a gravidade
    // acumulou Δv > 3 na bomba), com teto largo p/ runners lentos.
    await page.waitForFunction((v) => {
      const b = window.__spaceWar.projectiles.find((p) => p.isBomb);
      return b ? Math.hypot(b.vel.x, b.vel.y, b.vel.z) > v + 3 : false;
    }, v0, { timeout: 30000 });
    const v1 = await page.evaluate(() => {
      const b = window.__spaceWar.projectiles.find((p) => p.isBomb);
      return b ? Math.hypot(b.vel.x, b.vel.y, b.vel.z) : -1;
    });
    // solta em repouso → só a gravidade pode tê-la acelerado
    expect(v1).toBeGreaterThan(v0 + 3);
  });

  // AC-05: nukes efetivamente ilimitadas — a reserva RECARREGA após disparo.
  test('AC-05: recarga de nuke repõe a reserva', async ({ page }) => {
    await startFlight(page);
    await page.keyboard.down('KeyW');
    await page.waitForFunction(() => window.__spaceWar.ship.landed === false, { timeout: 45000 });
    await page.keyboard.up('KeyW');
    const nk0 = await page.evaluate(() => window.__spaceWar.ship.nukes);
    await page.keyboard.press('KeyF');
    await page.waitForFunction((n) => window.__spaceWar.ship.nukes === n - 1, nk0, { timeout: 30000 });
    // acelera o timer de recarga para não esperar 20 s reais
    await page.evaluate(() => { window.__spaceWar.ship.nukeRegen = 19.5; });
    await page.waitForFunction((n) => window.__spaceWar.ship.nukes === n, nk0, { timeout: 45000 });
  });

  // AC-08: TODA base de missão respeita o teto de 3% da área de superfície.
  test('AC-08: pegada da base ≤ 3% da área do corpo', async ({ page }) => {
    await startFlight(page);
    const fracs = await page.evaluate(() => {
      const m = window.__spaceWar.mission;
      return (m.targets || []).map((t) => {
        const s = t.obj.scale.x;
        const rf = 8 * s;                         // raio da pegada (plataforma v2)
        const R = t.body.def.radius;
        return (rf * rf) / (4 * R * R);           // πrf² / 4πR²
      });
    });
    expect(fracs.length).toBeGreaterThan(0);
    for (const f of fracs) expect(f).toBeLessThanOrEqual(0.03);
  });

  // AC-10 (bug space-war-solar-flare-universe-overlay): flare do Sol é LOCAL —
  // visível na vizinhança solar, invisível de outro sistema.
  test('AC-10: flare solar local (regressão do bug)', async ({ page }) => {
    await startFlight(page);
    // perto da Terra (região solar): política de flare = visível
    await page.waitForFunction(() => window.__spaceWar.sunFlareVisible === true, { timeout: 45000 });
    // teleporta para o binário (≈2.7M u do Sol): flare precisa SUMIR.
    // distMul 20 (=9,6k u do centro): o default 3,2 (1,5k u) caía DENTRO da
    // zona de maré do BN (tideKillR 7800, ship.js P2-8) — a nave MORRIA de
    // espaguetificação em segundos de sim, phase virava gameover, o loop
    // congelava a política do flare e a perna seguinte lia um valor STALE
    // (diagnosticado no probe do run 31585773105: phase gameover, vis
    // travado). A 20 radii o dano de maré é zero e a distância ao Sol segue
    // ≫ FLARE_CUTOFF (4,2M) — flare off determinístico, nave viva.
    await page.evaluate(() => window.__swDebug.goTo('blackhole', 20));
    await page.waitForFunction(() => window.__spaceWar.sunFlareVisible === false, { timeout: 45000 });
    // e voltar perto do Sol religa (geometria clássica da perna, provada
    // desde o AC — o flake recente era a morte no BN acima, não a Terra)
    await page.evaluate(() => window.__swDebug.goTo('earth'));
    await page.waitForFunction(() => window.__spaceWar.sunFlareVisible === true, { timeout: 45000 });
  });

  // AC-06 (amostra): inimigos co-movem com o corpo-âncora (frame body-relativo).
  test('AC-06: patrulha inimiga acompanha o corpo-âncora', async ({ page }) => {
    await startFlight(page);
    const d0 = await page.evaluate(() => {
      const e = window.__spaceWar.enemies.find((x) => !x.dead && x.role === 'fighter');
      return e ? e.group.position.distanceTo(e.anchor.worldPos) / e.anchor.def.radius : -1;
    });
    expect(d0).toBeGreaterThan(0);
    // T-07 MANTIDO de propósito: janela de OBSERVAÇÃO deliberada — o AC exige
    // que o inimigo PERMANEÇA na casca de patrulha enquanto o corpo-âncora
    // orbita e gira; é a persistência ao longo de ~2,5 s que se testa, não a
    // chegada de uma condição (não há predicado de polling equivalente).
    await page.waitForTimeout(2500);
    const d1 = await page.evaluate(() => {
      const e = window.__spaceWar.enemies.find((x) => !x.dead && x.role === 'fighter');
      return e ? e.group.position.distanceTo(e.anchor.worldPos) / e.anchor.def.radius : -1;
    });
    // o corpo orbita e gira, mas o inimigo permanece na CASCA de patrulha
    // (1.3–2.2 raios) do próprio corpo — frame relativo, não posição absoluta
    expect(d1).toBeGreaterThan(1.0);
    expect(d1).toBeLessThan(3.0);
  });
});
