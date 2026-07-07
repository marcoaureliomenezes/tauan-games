const { test, expect } = require('@playwright/test');

// Suite da release space-war-phases-and-roster-v1 — achados 1/2/3/5 da QA
// end-of-alpha: fluxo missão-pendente→viagem→materialização (AC-07), evidência
// de dispose entre fases (AC-05), gate de captura da nuke EXECUTADO (P0-3) e
// teardrop+corrente de Roche do Devorador (AC-06).

async function startFlight(page) {
  await page.goto('/space-war/index.html');
  await page.waitForSelector('canvas', { state: 'attached', timeout: 15000 });
  await page.waitForFunction(() => window.__spaceWarReady === true, { timeout: 15000 });
  await page.keyboard.press('Enter');
  await page.waitForTimeout(150);
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => window.__spaceWar.screen === 'flight', { timeout: 4000 });
}

test.describe('Space War — Fases e Roster (QA end-of-alpha)', () => {

  // Finding 1 (HIGH, AC-07): vencer a fase 1 deixa a missão da fase 2 PENDENTE
  // ("viaje para Betelgeuse"); a viagem interestelar REAL carrega o sistema e a
  // missão MATERIALIZA (caçada retomável do alvo 1).
  test('AC-07: missão pendente → viagem → materialização + caçada viva', async ({ page }) => {
    test.setTimeout(150000);
    await startFlight(page);
    await page.evaluate(() => window.__swDebug.goTo('terra', 4));
    // vence a CAÇADA da fase 1…
    await page.evaluate(() => window.__swDebug.winMission());
    await page.waitForFunction(
      () => window.__spaceWar.mission && window.__spaceWar.mission._done === true,
      undefined, { timeout: 10000 },
    );
    // …espera a missão VISIT (Halley) começar de fato antes de forçá-la
    await page.waitForFunction(
      () => {
        const m = window.__spaceWar.mission;
        return m && m.type === 'visit' && !m._done;
      },
      undefined, { timeout: 20000 },
    );
    await page.evaluate(() => window.__swDebug.winMission());
    // fase 2 desbloqueia; a missão nova nasce PENDENTE (sistema não carregado)
    await page.waitForFunction(
      () => {
        const sw = window.__spaceWar;
        return sw.campaign && sw.campaign.phase === 1
          && sw.mission && sw.mission.pending === true;
      },
      undefined, { timeout: 30000 },
    );
    const pending = await page.evaluate(() => ({
      label: window.__spaceWar.mission.label,
      targetKey: window.__spaceWar.nav.target && window.__spaceWar.nav.target.key,
      targets: window.__spaceWar.mission.targets.length,
    }));
    expect(pending.label).toContain('VIAJE');
    expect(pending.targetKey).toBe('betelgeuse');     // nav já mira o sistema
    expect(pending.targets).toBe(0);                  // nada materializado ainda
    // VIAGEM REAL: [Z] engata (alvo já é o descritor), warp até a chegada
    await page.evaluate(() => window.__swDebug.journeyToggle());
    await page.waitForFunction(() => window.__spaceWar.journey && window.__spaceWar.journey.active, { timeout: 5000 });
    await page.evaluate(() => window.__swDebug.journeyWarp(0.999));
    await page.waitForFunction(() => !window.__spaceWar.journey.active, { timeout: 20000 });
    // chegada: fase carregada + missão MATERIALIZADA (caçada com alvo vivo)
    await page.waitForFunction(
      () => {
        const sw = window.__spaceWar;
        return sw.world.systemKey === 'betelgeuse'
          && sw.mission && sw.mission.pending !== true
          && sw.mission.targets.length >= 1;
      },
      undefined, { timeout: 20000 },
    );
    const mat = await page.evaluate(() => ({
      label: window.__spaceWar.mission.label,
      enemies: window.__spaceWar.enemies.length,
    }));
    expect(mat.label).toContain('CAÇADA');
    expect(mat.enemies).toBeGreaterThanOrEqual(1);    // spawns da fase vieram junto
    // a cadeia da caçada segue viva: mata o alvo 1 → contador avança
    await page.evaluate(() => window.__swDebug.killTarget());
    await page.waitForFunction(
      () => window.__spaceWar.mission && window.__spaceWar.mission.killed >= 1,
      undefined, { timeout: 10000 },
    );
  });

  // Finding 2 (HIGH, AC-05): trocar de fase NÃO vaza GPU — geometrias/texturas
  // vivas voltam ao mesmo patamar ao recarregar o mesmo sistema (dispose real).
  test('AC-05: sem vazamento de GPU entre fases (dispose real)', async ({ page }) => {
    test.setTimeout(120000);
    await startFlight(page);
    const probe = async (key) => {
      await page.evaluate((k) => window.__swDebug.loadSystem(k), key);
      await page.waitForTimeout(700);                 // frames p/ fx/starlod assentarem
      return page.evaluate(() => window.__swDebug.rendererInfo());
    };
    const bin1 = await probe('binary');
    await probe('core');
    await probe('pulsar');
    const bin2 = await probe('binary');
    // tolerância pequena (partículas/projéteis flutuam); vazamento real somaria
    // dezenas de geometrias por ciclo (cada sistema tem 15-30 meshes)
    expect(bin2.geometries).toBeLessThanOrEqual(bin1.geometries + 8);
    expect(bin2.textures).toBeLessThanOrEqual(bin1.textures + 8);
    // e o mundo continua íntegro (corpos do binário vivos)
    const alive = await page.evaluate(() => window.__spaceWar.bodies.length);
    expect(alive).toBeGreaterThanOrEqual(2);
  });

  // Finding 3 (MEDIUM, P0-3): o gate de captura EXECUTADO — nuke hiperbólica
  // (1600 u/s ≫ 1.5·v_esc ~190) dentro do SOI da Terra segue BALÍSTICA: a
  // velocidade relativa NÃO é arrastada p/ o fluxo kepleriano (piso 320).
  test('P0-3: flyby hiperbólico da nuke fica balístico (sem captura)', async ({ page }) => {
    test.setTimeout(90000);
    await startFlight(page);
    await page.evaluate(() => window.__swDebug.goTo('terra', 4));
    await page.waitForTimeout(200);
    await page.keyboard.press('KeyF');
    await page.waitForFunction(
      () => window.__spaceWar.projectiles.some((p) => p.isNuke),
      undefined, { timeout: 5000 },
    );
    // Perto da Terra o computador balístico costuma ter solução fresca → a nuke
    // nasce `aimed` e o bloco de guiagem (onde vive o gate P0-3) é PULADO
    // (`if (dom && !p.aimed)`). Força o tiro LIVRE para EXECUTAR o gate de
    // verdade (mutation-sanity da QA: com aimed=true o teste não vê o gate).
    await page.evaluate(() => {
      window.__spaceWar.projectiles.find((p) => p.isNuke).aimed = false;
    });
    // ~2 s de queda: sob a guiagem antiga a v_rel despencaria rumo a ~320·0.92;
    // balística pura mantém ~1600 (a gravidade local mal arranha isso).
    await page.waitForTimeout(2000);
    const rel = await page.evaluate(() => {
      const sw = window.__spaceWar;
      const p = sw.projectiles.find((x) => x.isNuke);
      if (!p) return null;
      const earth = sw.bodies.find((b) => b.def.key === 'earth');
      const dv = {
        x: p.vel.x - (earth.worldVel ? earth.worldVel.x : 0),
        y: p.vel.y - (earth.worldVel ? earth.worldVel.y : 0),
        z: p.vel.z - (earth.worldVel ? earth.worldVel.z : 0),
      };
      return {
        speed: Math.hypot(dv.x, dv.y, dv.z),
        dist: p.mesh.position.distanceTo(earth.worldPos),
        soi: earth.soi,
      };
    });
    // Mutation-sanity (QA re-verificação): com o gate DELETADO a captura
    // espirala a nuke até detonar em <2s — o desaparecimento É o sintoma da
    // regressão, então a sobrevivência é asserida (sem escape vacuoso).
    expect(rel).not.toBeNull();                       // balística ⇒ ainda viva a 2s
    expect(rel.dist).toBeLessThan(rel.soi);           // ainda dentro do SOI
    expect(rel.speed).toBeGreaterThan(800);           // NÃO capturada (antiga: ~300)
  });

  // Finding 5 (MEDIUM, AC-06): o Devorador mostra o TEARDROP (uniforms de maré
  // aplicados na gigante, apontando ao BN) e a CORRENTE DE ROCHE construída.
  test('AC-06: teardrop da Devorada + corrente de Roche vivos', async ({ page }) => {
    test.setTimeout(90000);
    await startFlight(page);
    await page.evaluate(() => window.__swDebug.loadSystem('binary'));
    await page.waitForFunction(
      () => window.__spaceWar.rocheStream && window.__spaceWar.rocheStream.built === true,
      undefined, { timeout: 10000 },
    );
    const dev = await page.evaluate(() => {
      const sw = window.__spaceWar;
      const gi = sw.bodies.find((b) => b.def.key === 'devorada');
      const bh = sw.bodies.find((b) => b.def.key === 'blackhole');
      const u = gi.mesh.material.uniforms;
      return {
        amp: u.uTideAmp.value,
        stream: sw.rocheStream,
        // uTideDir vive no espaço do MESH (que gira com o spin): reconverte
        // p/ mundo e compara com a direção real gigante→BN
        align: (() => {
          const v = u.uTideDir.value.clone().applyQuaternion(gi.mesh.quaternion);
          const d = bh.worldPos.clone().sub(gi.worldPos).normalize();
          return v.dot(d);
        })(),
      };
    });
    expect(dev.amp).toBeGreaterThanOrEqual(0.25);     // teardrop APLICADO
    expect(dev.stream.built).toBe(true);              // corrente construída
    expect(dev.stream.tideAmp).toBeGreaterThanOrEqual(0.25);
    expect(dev.align).toBeGreaterThan(0.9);           // bulge aponta AO buraco negro
  });
});
