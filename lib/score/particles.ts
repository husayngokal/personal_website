/*
 * The effects engine: one full-screen canvas, one animation loop that runs
 * only while something is moving, everything drawn in the accent orange.
 *
 * Canvas rather than DOM nodes because a burst is dozens of particles and
 * a full bar is a hundred-odd: as elements that is layout and compositing
 * work on every frame, on a canvas it is a few hundred fills. The loop
 * stops the moment the last particle dies, so an idle page costs nothing.
 *
 *   ring    a shockwave from the tap
 *   burst   sparks thrown out under gravity, each with a soft glow
 *   comets  the points themselves, flying from the tap into the top bar,
 *           trailing sparks; the first to arrive calls back (the bar fills
 *           then, not before)
 *   rain    confetti from the top edge, for a full bar or a new level
 *
 * Browser-only. Pixel ratio capped at 2 so large phones stay smooth.
 */

type Kind = 'spark' | 'ring' | 'comet' | 'confetti';

interface P {
  kind: Kind;
  x: number; y: number; vx: number; vy: number;
  age: number; life: number; size: number;
  rot: number; vr: number;
  /* comets: start, control, end, done callback */
  sx?: number; sy?: number; cx?: number; cy?: number; tx?: number; ty?: number;
  land?: () => void;
  delay: number;
}

const GRAVITY = 1400;      // px/s^2
const DRAG = 0.985;

export class FxCanvas {
  private ctx: CanvasRenderingContext2D;
  private ps: P[] = [];
  private raf: number | null = null;
  private last = 0;
  private color = '#F26B1F';
  private dpr = 1;
  /* The site zooms the whole document (--site-zoom), so a pointer's
     clientX and the canvas's own CSS pixels differ by that factor.
     `k` is measured, not assumed: on-screen width over CSS width. */
  private k = 1;
  w = 0;
  h = 0;

  constructor(private canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d')!;
    const c = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim();
    if (c) this.color = c;
    this.resize();
  }

  resize() {
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.w = this.canvas.clientWidth || window.innerWidth;
    this.h = this.canvas.clientHeight || window.innerHeight;
    const rect = this.canvas.getBoundingClientRect();
    this.k = rect.width && this.w ? rect.width / this.w : 1;
    this.canvas.width = Math.round(this.w * this.k * this.dpr);
    this.canvas.height = Math.round(this.h * this.k * this.dpr);
  }

  /** A viewport point (pointer clientX/Y) in the canvas's own pixels. */
  toLocal(x: number, y: number): { x: number; y: number } {
    const rect = this.canvas.getBoundingClientRect();
    return { x: (x - rect.left) / this.k, y: (y - rect.top) / this.k };
  }

  ring(x: number, y: number, size = 1) {
    this.add({ kind: 'ring', x, y, vx: 0, vy: 0, age: 0, life: 0.55, size: 70 * size, rot: 0, vr: 0, delay: 0 });
    this.add({ kind: 'ring', x, y, vx: 0, vy: 0, age: 0, life: 0.75, size: 120 * size, rot: 0, vr: 0, delay: 0.06 });
  }

  burst(x: number, y: number, n: number, power = 1) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = (260 + Math.random() * 420) * power;
      this.add({
        kind: 'spark', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 260 * power,
        age: 0, life: 0.6 + Math.random() * 0.5, size: 2 + Math.random() * 3.5,
        rot: 0, vr: 0, delay: Math.random() * 0.04,
      });
    }
  }

  /** n comets from (x, y) into (tx, ty). `onLand` fires once, when the
   *  first arrives. Returns the flight time in ms. */
  comets(x: number, y: number, tx: number, ty: number, n: number, onLand: () => void): number {
    let landed = false;
    const land = () => { if (!landed) { landed = true; onLand(); } };
    const dur = 0.62;
    for (let i = 0; i < n; i++) {
      const spread = (i - (n - 1) / 2) * 34;
      this.add({
        kind: 'comet', x, y, vx: 0, vy: 0, age: 0, life: dur + i * 0.05, size: 5 + Math.random() * 2,
        rot: 0, vr: 0, delay: i * 0.05,
        sx: x, sy: y,
        cx: x + (tx - x) * 0.25 + spread + (Math.random() - 0.5) * 60,
        cy: Math.min(y, ty) - 140 - Math.random() * 80,
        tx: tx + (Math.random() - 0.5) * 24, ty,
        land,
      });
    }
    return dur * 1000;
  }

  rain(n: number) {
    const w = this.w;
    for (let i = 0; i < n; i++) {
      this.add({
        kind: 'confetti', x: Math.random() * w, y: -20 - Math.random() * 120,
        vx: (Math.random() - 0.5) * 160, vy: 120 + Math.random() * 220,
        age: 0, life: 2.4 + Math.random() * 1.2, size: 5 + Math.random() * 6,
        rot: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 12, delay: Math.random() * 0.8,
      });
    }
  }

  private add(p: P) {
    this.ps.push(p);
    if (this.raf === null) {
      this.last = performance.now();
      this.raf = requestAnimationFrame(this.tick);
    }
  }

  private tick = (now: number) => {
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    const { ctx } = this;
    ctx.setTransform(this.dpr * this.k, 0, 0, this.dpr * this.k, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.fillStyle = this.color;
    ctx.strokeStyle = this.color;

    const alive: P[] = [];
    for (const p of this.ps) {
      if (p.delay > 0) { p.delay -= dt; alive.push(p); continue; }
      p.age += dt;
      const k = p.age / p.life;
      if (k >= 1) {
        if (p.kind === 'comet') p.land?.();
        continue;
      }
      alive.push(p);

      if (p.kind === 'spark') {
        p.vx *= DRAG; p.vy = p.vy * DRAG + GRAVITY * dt;
        p.x += p.vx * dt; p.y += p.vy * dt;
        const r = p.size * (1 - k * 0.7);
        ctx.globalAlpha = 0.22 * (1 - k);
        ctx.beginPath(); ctx.arc(p.x, p.y, r * 2.6, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1 - k * k;
        ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.fill();
      } else if (p.kind === 'ring') {
        const e = 1 - (1 - k) ** 3;
        ctx.globalAlpha = 0.7 * (1 - k);
        ctx.lineWidth = 3 * (1 - k) + 0.5;
        ctx.beginPath(); ctx.arc(p.x, p.y, 8 + p.size * e, 0, Math.PI * 2); ctx.stroke();
      } else if (p.kind === 'comet') {
        const t = k * k * (3 - 2 * k);           // smoothstep: lift, then dive
        const u = 1 - t;
        const x = u * u * p.sx! + 2 * u * t * p.cx! + t * t * p.tx!;
        const y = u * u * p.sy! + 2 * u * t * p.cy! + t * t * p.ty!;
        if (Math.random() < 0.8) {
          alive.push({ kind: 'spark', x, y, vx: (Math.random() - 0.5) * 60, vy: (Math.random() - 0.5) * 60, age: 0, life: 0.35, size: 1.6 + Math.random() * 1.6, rot: 0, vr: 0, delay: 0 });
        }
        ctx.globalAlpha = 0.3;
        ctx.beginPath(); ctx.arc(x, y, p.size * 2.8, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1;
        ctx.beginPath(); ctx.arc(x, y, p.size, 0, Math.PI * 2); ctx.fill();
      } else {
        p.vy += 160 * dt;
        p.x += (p.vx + Math.sin(p.age * 4 + p.rot) * 40) * dt; p.y += p.vy * dt;
        p.rot += p.vr * dt;
        ctx.globalAlpha = k > 0.8 ? (1 - k) / 0.2 : 1;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.scale(1, Math.abs(Math.cos(p.age * 6 + p.rot)) * 0.8 + 0.2);
        ctx.fillRect(-p.size / 2, -p.size / 3, p.size, (p.size * 2) / 3);
        ctx.restore();
      }
    }
    ctx.globalAlpha = 1;
    this.ps = alive;
    this.raf = alive.length ? requestAnimationFrame(this.tick) : null;
    if (!alive.length) ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  };

  destroy() {
    if (this.raf !== null) cancelAnimationFrame(this.raf);
    this.ps = [];
  }
}
