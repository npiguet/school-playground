<script lang="ts">
  // Ambient particle layer (scenes UI spec §2.1). SceneStage never mounts it under reduced motion.
  import { FX_COUNTS, moteAlpha, spawnMote, stepMotes, type Mote } from '../../lib/scene/fx';
  import type { FxPreset } from '../../lib/scene/types';

  let { preset }: { preset: FxPreset } = $props();

  let canvas: HTMLCanvasElement | undefined = $state();

  $effect(() => {
    const el = canvas;
    const kind = preset;
    if (!el || kind === 'none') return;
    const ctx = el.getContext('2d');
    if (!ctx) return;

    let w = 1;
    let h = 1;
    const resize = () => {
      const r = el.getBoundingClientRect();
      w = el.width = Math.max(1, Math.round(r.width));
      h = el.height = Math.max(1, Math.round(r.height));
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(el);

    let motes: Mote[] = Array.from({ length: FX_COUNTS[kind] }, () => spawnMote(kind, w, h, Math.random, true));
    let last = performance.now();
    let raf = 0;
    const frame = (now: number) => {
      const dt = Math.min(64, now - last);
      last = now;
      motes = stepMotes(motes, kind, w, h, dt, Math.random);
      ctx.clearRect(0, 0, w, h);
      for (const m of motes) {
        ctx.globalAlpha = moteAlpha(m);
        ctx.fillStyle = m.color;
        ctx.beginPath();
        ctx.arc(m.x, m.y, m.size, 0, Math.PI * 2);
        ctx.fill();
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  });
</script>

<canvas bind:this={canvas} class="fx-canvas" data-testid="fx-canvas" aria-hidden="true"></canvas>

<style>
  .fx-canvas {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    z-index: 2;
    pointer-events: none;
  }
</style>
