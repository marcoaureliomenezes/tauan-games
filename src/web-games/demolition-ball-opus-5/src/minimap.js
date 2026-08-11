// 2D city map drawn on an overlay canvas. Compact in the corner, or expanded
// full-screen with M — same renderer, different viewport and zoom.

import { CITY_HALF, SPAN, GRID } from './city.js';

export class Minimap {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.expanded = false;
    this.pulse = 0;
  }

  toggle() { this.expanded = !this.expanded; }

  layout() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const vw = window.innerWidth, vh = window.innerHeight;
    const size = this.expanded ? Math.min(vw, vh) * 0.82 : Math.min(260, vw * 0.28);
    const x = this.expanded ? (vw - size) / 2 : vw - size - 18;
    const y = this.expanded ? (vh - size) / 2 : 18;
    this.canvas.style.left = `${x}px`;
    this.canvas.style.top = `${y}px`;
    this.canvas.style.width = `${size}px`;
    this.canvas.style.height = `${size}px`;
    if (this.canvas.width !== Math.floor(size * dpr)) {
      this.canvas.width = Math.floor(size * dpr);
      this.canvas.height = Math.floor(size * dpr);
    }
    return { size: this.canvas.width, dpr };
  }

  draw(world, rig, missions, traffic, dt) {
    const { size } = this.layout();
    const ctx = this.ctx;
    this.pulse += dt;

    // World units visible across the map.
    const span = this.expanded ? CITY_HALF * 2.15 : 330;
    const scale = size / span;
    // Corner map follows the machine; the expanded map frames the whole city.
    const cx = this.expanded ? 0 : rig.pos.x;
    const cz = this.expanded ? 0 : rig.pos.z;
    const toX = (wx) => (wx - cx) * scale + size / 2;
    const toY = (wz) => (wz - cz) * scale + size / 2;

    ctx.clearRect(0, 0, size, size);
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, size, size);
    ctx.clip();

    ctx.fillStyle = '#10161d';
    ctx.fillRect(0, 0, size, size);

    // City plate
    ctx.fillStyle = '#171e26';
    ctx.fillRect(toX(-CITY_HALF), toY(-CITY_HALF), CITY_HALF * 2 * scale, CITY_HALF * 2 * scale);

    // River + bridges (R-07)
    const river = world.river;
    if (river) {
      ctx.fillStyle = '#1c3b55';
      ctx.fillRect(toX(river.x - river.half), toY(-CITY_HALF - 40),
        river.half * 2 * scale, (CITY_HALF + 40) * 2 * scale);
    }

    // Roads
    ctx.strokeStyle = '#2b3644';
    ctx.lineWidth = Math.max(1.5, 15 * scale);
    ctx.beginPath();
    for (let g = 0; g <= GRID; g++) {
      const c = -CITY_HALF + g * SPAN;
      ctx.moveTo(toX(c), toY(-CITY_HALF));
      ctx.lineTo(toX(c), toY(CITY_HALF));
      ctx.moveTo(toX(-CITY_HALF), toY(c));
      ctx.lineTo(toX(CITY_HALF), toY(c));
    }
    ctx.stroke();

    // Bridge decks over the water, drawn on top of the road strokes.
    if (river) {
      ctx.fillStyle = '#55677c';
      for (const j of river.bridges) {
        const z = -CITY_HALF + j * SPAN;
        ctx.fillRect(toX(river.x - river.half - 3), toY(z - 8),
          (river.half + 3) * 2 * scale, 16 * scale);
      }
    }

    // Structures
    const targets = missions.current ? missions.current.targets : [];
    for (const s of world.structures) {
      const w = s.size.x * scale, h = s.size.z * scale;
      const x = toX(s.center.x - s.size.x / 2), y = toY(s.center.z - s.size.z / 2);
      if (x + w < -20 || y + h < -20 || x > size + 20 || y > size + 20) continue;
      const gone = s.progress;
      if (targets.includes(s)) continue;
      ctx.fillStyle = gone > 0.9 ? '#2a2f36' : `rgba(120,132,148,${0.35 + 0.45 * (1 - gone)})`;
      ctx.fillRect(x, y, Math.max(1.5, w), Math.max(1.5, h));
    }

    // Mission targets on top, pulsing
    const glow = 0.55 + 0.45 * Math.sin(this.pulse * 4);
    for (const s of targets) {
      const w = Math.max(3, s.size.x * scale), h = Math.max(3, s.size.z * scale);
      const x = toX(s.center.x - s.size.x / 2), y = toY(s.center.z - s.size.z / 2);
      const done = s.progress >= (missions.current ? missions.current.spec.threshold : 1);
      ctx.fillStyle = done ? `rgba(80,220,120,${0.55 + 0.2 * glow})` : `rgba(255,80,60,${0.45 + 0.5 * glow})`;
      ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = done ? '#7fe89b' : '#ff8a72';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(x, y, w, h);
      if (this.expanded) {
        ctx.fillStyle = '#ffd9cf';
        ctx.font = '11px monospace';
        ctx.fillText(`${Math.round(s.progress * 100)}%`, x, y - 4);
      }
    }

    // Traffic
    ctx.fillStyle = '#8fb4d8';
    for (const car of traffic.cars) {
      if (!car.alive) continue;
      const x = toX(car.pos.x), y = toY(car.pos.z);
      if (x < 0 || y < 0 || x > size || y > size) continue;
      ctx.fillRect(x - 1.2, y - 1.2, 2.6, 2.6);
    }

    // Wrecking ball
    ctx.fillStyle = '#f2c14b';
    ctx.beginPath();
    ctx.arc(toX(rig.ball.pos.x), toY(rig.ball.pos.z), Math.max(2, 2.6 * scale * 1.6), 0, Math.PI * 2);
    ctx.fill();

    // Player heading arrow
    const px = toX(rig.pos.x), py = toY(rig.pos.z);
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(-rig.yaw + Math.PI);
    ctx.fillStyle = '#ffe66d';
    ctx.beginPath();
    ctx.moveTo(0, -9); ctx.lineTo(6, 7); ctx.lineTo(0, 3.5); ctx.lineTo(-6, 7);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#3a2b00';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();

    // Waypoint chevron toward the objective
    const wp = missions.waypoint;
    if (wp) {
      const wx = toX(wp.x), wy = toY(wp.z);
      const inside = wx > 6 && wy > 6 && wx < size - 6 && wy < size - 6;
      ctx.strokeStyle = '#ff6b4a';
      ctx.lineWidth = 2;
      if (inside) {
        ctx.beginPath();
        ctx.arc(wx, wy, 8 + 3 * Math.sin(this.pulse * 5), 0, Math.PI * 2);
        ctx.stroke();
      } else {
        const ang = Math.atan2(wy - size / 2, wx - size / 2);
        const r = size / 2 - 14;
        const ex = size / 2 + Math.cos(ang) * r, ey = size / 2 + Math.sin(ang) * r;
        ctx.save();
        ctx.translate(ex, ey);
        ctx.rotate(ang);
        ctx.fillStyle = '#ff6b4a';
        ctx.beginPath();
        ctx.moveTo(9, 0); ctx.lineTo(-6, 6); ctx.lineTo(-6, -6);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
    }

    ctx.restore();
    ctx.strokeStyle = this.expanded ? '#4d6274' : '#33414f';
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, size - 2, size - 2);

    if (this.expanded) {
      ctx.fillStyle = 'rgba(10,14,20,0.75)';
      ctx.fillRect(0, 0, size, 26);
      ctx.fillStyle = '#cfe3f5';
      ctx.font = 'bold 13px monospace';
      ctx.fillText('MAPA DA CIDADE — M para fechar', 10, 18);
    }
  }
}
