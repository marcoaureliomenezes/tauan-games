// Rubble chunks and dust. Chunks are cheap rigid bodies (position + spin,
// no inertia tensor) that bounce, settle into a pile and slowly fade out.

import { v3, qidentity, qIntegrate, clamp } from './math.js';

const GRAVITY = -22.5;
const MAX_CHUNKS = 900;
const MAX_DUST = 1400;

export class DebrisField {
  constructor() {
    this.chunks = [];
    this.dust = [];
  }

  spawnChunk(pos, half, color, vel, damage = 1) {
    if (this.chunks.length >= MAX_CHUNKS) {
      // Recycle the oldest settled chunk so the pile stays bounded.
      let idx = 0;
      for (let i = 0; i < this.chunks.length; i++) {
        if (this.chunks[i].settled) { idx = i; break; }
      }
      this.chunks.splice(idx, 1);
    }
    this.chunks.push({
      pos: { x: pos.x, y: pos.y, z: pos.z },
      vel: { x: vel.x, y: vel.y, z: vel.z },
      quat: qidentity(),
      omega: v3((Math.random() - 0.5) * 7, (Math.random() - 0.5) * 7, (Math.random() - 0.5) * 7),
      half,
      color,
      damage,
      life: 0,
      settled: false,
    });
  }

  spawnDust(pos, count, spread, color, size = 1.6, upward = 2.2) {
    for (let i = 0; i < count; i++) {
      if (this.dust.length >= MAX_DUST) this.dust.shift();
      this.dust.push({
        pos: { x: pos.x + (Math.random() - 0.5) * spread, y: pos.y + (Math.random() - 0.5) * spread, z: pos.z + (Math.random() - 0.5) * spread },
        vel: v3((Math.random() - 0.5) * 5, Math.random() * upward, (Math.random() - 0.5) * 5),
        size: size * (0.6 + Math.random() * 0.9),
        grow: 1.4 + Math.random(),
        color,
        life: 0,
        maxLife: 1.4 + Math.random() * 1.9,
      });
    }
  }

  spawnSparks(pos, count, dir) {
    for (let i = 0; i < count; i++) {
      if (this.dust.length >= MAX_DUST) this.dust.shift();
      this.dust.push({
        pos: { x: pos.x, y: pos.y, z: pos.z },
        vel: v3(dir.x * 4 + (Math.random() - 0.5) * 9, Math.random() * 6 + 1, dir.z * 4 + (Math.random() - 0.5) * 9),
        size: 0.22 + Math.random() * 0.2,
        grow: 0,
        color: [1.4, 0.85, 0.35],
        life: 0,
        maxLife: 0.32 + Math.random() * 0.3,
      });
    }
  }

  update(dt) {
    for (let i = this.chunks.length - 1; i >= 0; i--) {
      const c = this.chunks[i];
      c.life += dt;
      if (!c.settled) {
        c.vel.y += GRAVITY * dt;
        c.pos.x += c.vel.x * dt;
        c.pos.y += c.vel.y * dt;
        c.pos.z += c.vel.z * dt;
        c.quat = qIntegrate(c.quat, c.omega, dt);

        const floor = c.half.y * 0.85;
        if (c.pos.y < floor) {
          c.pos.y = floor;
          if (c.vel.y < -1.2) {
            c.vel.y = -c.vel.y * 0.28;
            c.vel.x *= 0.62; c.vel.z *= 0.62;
            c.omega.x *= 0.5; c.omega.y *= 0.5; c.omega.z *= 0.5;
          } else {
            c.vel.y = 0;
            c.vel.x *= 0.82; c.vel.z *= 0.82;
            c.omega.x *= 0.7; c.omega.y *= 0.7; c.omega.z *= 0.7;
            if (Math.abs(c.vel.x) + Math.abs(c.vel.z) < 0.35) {
              c.settled = true;
              c.vel.x = c.vel.z = 0;
              c.omega.x = c.omega.y = c.omega.z = 0;
            }
          }
        }
      }
      // Settled rubble lingers a good while, then dissolves.
      if (c.life > 26) this.chunks.splice(i, 1);
    }

    for (let i = this.dust.length - 1; i >= 0; i--) {
      const p = this.dust[i];
      p.life += dt;
      if (p.life >= p.maxLife) { this.dust.splice(i, 1); continue; }
      p.vel.y += (p.grow > 0 ? 1.4 : GRAVITY * 0.55) * dt; // dust rises, sparks fall
      p.vel.x *= 1 - 1.1 * dt;
      p.vel.z *= 1 - 1.1 * dt;
      p.pos.x += p.vel.x * dt;
      p.pos.y += p.vel.y * dt;
      p.pos.z += p.vel.z * dt;
      if (p.pos.y < 0.15 && p.grow === 0) { p.pos.y = 0.15; p.vel.y *= -0.3; }
    }
  }

  render(renderer) {
    for (const c of this.chunks) {
      const fade = clamp((26 - c.life) / 3, 0, 1);
      renderer.pushBox(c.pos, c.half, c.quat, c.color, 0.9, clamp(c.damage * fade + (1 - fade), 0, 1));
    }
    for (const p of this.dust) {
      const t = p.life / p.maxLife;
      const size = p.size * (1 + p.grow * t);
      const alpha = (p.grow > 0 ? 0.55 : 0.9) * (1 - t) * (t < 0.12 ? t / 0.12 : 1);
      renderer.pushParticle(p.pos, size, p.color, alpha);
    }
  }

  get counts() {
    return { chunks: this.chunks.length, dust: this.dust.length };
  }
}
