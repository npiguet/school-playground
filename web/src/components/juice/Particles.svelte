<script lang="ts">
  // Canvas particle burst layered over its (positioned) parent. Re-fires every time
  // `trigger` changes - callers bump a counter (e.g. `xpGained += 1`) rather than
  // toggling a boolean, so the same value can fire twice in a row. Renders nothing
  // under reduced motion (decision 18).
  import { reducedMotion } from '../../lib/juice/motion';

  let { trigger, kind = 'burst' }: { trigger: number; kind?: 'burst' | 'sparkle' | 'laurel' } = $props();

  let canvas: HTMLCanvasElement | undefined;

  interface Particle {
    x: number;
    y: number;
    vx: number;
    vy: number;
    life: number;
    maxLife: number;
    color: string;
    size: number;
    rot: number;
    vr: number;
  }

  const COLORS: Record<typeof kind, string[]> = {
    burst: ['#c9a227', '#c0623b'],
    sparkle: ['#c9a227', '#f1dc9a'],
    laurel: ['#6b7a3a', '#7a8a4b'],
  };
  const COUNTS: Record<typeof kind, number> = { burst: 40, sparkle: 25, laurel: 12 };
  const DURATION_MS = 1200;

  function pick<T>(arr: T[]): T {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function spawn(k: typeof kind, w: number, h: number): Particle[] {
    const n = COUNTS[k];
    const colors = COLORS[k];
    const particles: Particle[] = [];
    for (let i = 0; i < n; i++) {
      if (k === 'burst') {
        const angle = Math.random() * Math.PI * 2;
        const speed = 60 + Math.random() * 120;
        particles.push({
          x: w / 2,
          y: h / 2,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 0,
          maxLife: 500 + Math.random() * 400,
          color: pick(colors),
          size: 2.5 + Math.random() * 3,
          rot: 0,
          vr: 0,
        });
      } else if (k === 'sparkle') {
        particles.push({
          x: Math.random() * w,
          y: Math.random() * h,
          vx: 0,
          vy: -8 - Math.random() * 12,
          life: 0,
          maxLife: 700 + Math.random() * 400,
          color: pick(colors),
          size: 1.5 + Math.random() * 2,
          rot: 0,
          vr: 0,
        });
      } else {
        particles.push({
          x: Math.random() * w,
          y: -10,
          vx: (Math.random() - 0.5) * 24,
          vy: 24 + Math.random() * 24,
          life: 0,
          maxLife: 900 + Math.random() * 300,
          color: pick(colors),
          size: 5 + Math.random() * 3,
          rot: Math.random() * Math.PI,
          vr: (Math.random() - 0.5) * 3,
        });
      }
    }
    return particles;
  }

  function draw(ctx: CanvasRenderingContext2D, p: Particle) {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot);
    ctx.globalAlpha = Math.max(0, 1 - p.life / p.maxLife);
    ctx.fillStyle = p.color;
    if (kind === 'laurel') {
      ctx.beginPath();
      ctx.ellipse(0, 0, p.size, p.size * 0.45, 0, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.arc(0, 0, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  $effect(() => {
    // Read `trigger` so this effect re-runs whenever the caller bumps it.
    void trigger;
    if (!canvas || reducedMotion()) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const parent = canvas.parentElement;
    const w = parent?.clientWidth || canvas.clientWidth || 300;
    const h = parent?.clientHeight || canvas.clientHeight || 300;
    canvas.width = w;
    canvas.height = h;

    const particles = spawn(kind, w, h);
    const start = performance.now();
    let raf = 0;

    function frame(now: number) {
      const elapsed = now - start;
      const dt = 1 / 60;
      ctx!.clearRect(0, 0, w, h);
      for (const p of particles) {
        p.life += 1000 / 60;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.rot += p.vr * dt;
        if (kind === 'burst') p.vy += 220 * dt; // gravity
        if (kind === 'laurel') p.vy += 10 * dt; // gentle drift down
        draw(ctx!, p);
      }
      if (elapsed < DURATION_MS) {
        raf = requestAnimationFrame(frame);
      } else {
        ctx!.clearRect(0, 0, w, h);
      }
    }
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      ctx.clearRect(0, 0, w, h);
    };
  });
</script>

<canvas bind:this={canvas} class="particles" aria-hidden="true"></canvas>

<style>
  .particles {
    position: absolute;
    inset: 0;
    pointer-events: none;
  }
</style>
