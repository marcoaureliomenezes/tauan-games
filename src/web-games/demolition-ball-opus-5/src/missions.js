// Contract chain. Missions arrive one after another, each one picked from the
// generated city, each one a step harder: more mass, less time, tighter
// collateral tolerance.

import { mulberry32, v3 } from './math.js';

const CONTRACTS = [
  {
    title: 'Contrato 1 — Aquecendo a bola',
    brief: 'Derrube a casa condenada. Ganhe embalo no pêndulo antes de bater.',
    types: ['house'], count: 1, threshold: 0.9, reward: 8000, time: 0,
  },
  {
    title: 'Contrato 2 — Galpões desativados',
    brief: 'Dois galpões abandonados. A prefeitura quer o terreno limpo.',
    types: ['warehouse', 'shop'], count: 2, threshold: 0.85, reward: 15000, time: 0,
  },
  {
    title: 'Contrato 3 — Edifício interditado',
    brief: 'Prédio residencial interditado. Corte a base e deixe cair.',
    types: ['apartment'], count: 1, threshold: 0.85, reward: 24000, time: 210,
  },
  {
    title: 'Contrato 4 — Quarteirão inteiro',
    brief: 'Três estruturas vizinhas. Relógio rodando, mantenha o ritmo.',
    types: ['house', 'shop', 'warehouse', 'apartment'], count: 3, threshold: 0.8, reward: 38000, time: 240,
  },
  {
    title: 'Contrato 5 — Torre comercial',
    brief: 'A grande torre. Trabalhe os andares de baixo e derrube tudo.',
    types: ['skyscraper'], count: 1, threshold: 0.8, reward: 60000, time: 300,
  },
  {
    title: 'Contrato 6 — Operação limpeza',
    brief: 'Cinco estruturas. Fim de linha para este setor da cidade.',
    types: ['apartment', 'warehouse', 'shop', 'silo', 'house'], count: 5, threshold: 0.8, reward: 90000, time: 330,
  },
];

export class MissionSystem {
  constructor(structures, seed = 4242) {
    this.rand = mulberry32(seed);
    this.structures = structures;
    this.index = -1;
    this.current = null;
    this.money = 0;
    this.collateral = 0;      // non-target cells destroyed
    this.completed = [];
    this.failed = false;
    this.banner = null;
    this.allDone = false;
    this.used = new Set();
  }

  pickTargets(spec) {
    const pool = this.structures.filter(
      (s) => spec.types.includes(s.type) && !this.used.has(s.id) && s.total > 8 && !s.isFlattened,
    );
    if (!pool.length) return [];
    // Anchor on a random candidate, then take its nearest neighbours so the
    // mission reads as one job site instead of scattered pins.
    const anchor = pool[Math.floor(this.rand() * pool.length)];
    const sorted = pool
      .map((s) => ({ s, d: Math.hypot(s.center.x - anchor.center.x, s.center.z - anchor.center.z) }))
      .sort((a, b) => a.d - b.d)
      .map((e) => e.s);
    return sorted.slice(0, spec.count);
  }

  start(now = 0) {
    this.index++;
    if (this.index >= CONTRACTS.length) {
      this.current = null;
      this.allDone = true;
      this.banner = { text: 'TODOS OS CONTRATOS CONCLUÍDOS', sub: `Faturamento final: $${this.money.toLocaleString('pt-BR')}`, until: now + 999999 };
      return null;
    }
    const spec = CONTRACTS[this.index];
    let targets = this.pickTargets(spec);
    if (!targets.length) {
      // Fall back to any surviving structure so the chain never dead-ends.
      targets = this.structures.filter((s) => !this.used.has(s.id) && !s.isFlattened).slice(0, spec.count);
    }
    for (const t of targets) { t.isTarget = true; this.used.add(t.id); }
    this.current = {
      spec,
      targets,
      startedAt: now,
      deadline: spec.time ? now + spec.time : 0,
      done: false,
    };
    this.banner = { text: spec.title, sub: spec.brief, until: now + 6 };
    return this.current;
  }

  get waypoint() {
    if (!this.current || !this.current.targets.length) return null;
    let x = 0, z = 0, n = 0;
    for (const t of this.current.targets) {
      if (t.progress >= this.current.spec.threshold) continue;
      x += t.center.x; z += t.center.z; n++;
    }
    if (!n) {
      const t = this.current.targets[0];
      return v3(t.center.x, 0, t.center.z);
    }
    return v3(x / n, 0, z / n);
  }

  get progress() {
    if (!this.current) return 1;
    const th = this.current.spec.threshold;
    let sum = 0;
    for (const t of this.current.targets) sum += Math.min(1, t.progress / th);
    return this.current.targets.length ? sum / this.current.targets.length : 0;
  }

  /** Called whenever cells are destroyed, to bill collateral damage. */
  registerDamage(structure, cells) {
    if (!this.current) return;
    if (!this.current.targets.includes(structure)) {
      this.collateral += cells;
    }
  }

  update(now) {
    if (!this.current || this.current.done) return;
    const c = this.current;
    if (this.progress >= 0.999) {
      c.done = true;
      const timeBonus = c.deadline ? Math.max(0, Math.round((c.deadline - now) * 60)) : 0;
      const fine = Math.round(this.collateral * 45);
      const payout = Math.max(0, c.spec.reward + timeBonus - fine);
      this.money += payout;
      this.completed.push({ title: c.spec.title, payout, timeBonus, fine });
      this.collateral = 0;
      this.banner = {
        text: 'CONTRATO CONCLUÍDO',
        sub: `+$${payout.toLocaleString('pt-BR')}${timeBonus ? ` (bônus tempo $${timeBonus.toLocaleString('pt-BR')})` : ''}${fine ? ` — multa colateral $${fine.toLocaleString('pt-BR')}` : ''}`,
        until: now + 5,
      };
      c.finishedAt = now;
      return;
    }
    if (c.deadline && now > c.deadline) {
      c.done = true;
      c.failed = true;
      this.banner = { text: 'TEMPO ESGOTADO', sub: 'Contrato perdido. Próximo serviço a caminho.', until: now + 5 };
      c.finishedAt = now;
    }
  }

  /** Advance to the next contract a few seconds after the current one closes. */
  tickChain(now) {
    if (this.allDone) return;
    if (!this.current) { this.start(now); return; }
    if (this.current.done && now - this.current.finishedAt > 4.5) this.start(now);
  }

  timeLeft(now) {
    if (!this.current || !this.current.deadline || this.current.done) return null;
    return Math.max(0, this.current.deadline - now);
  }
}

export { CONTRACTS };
